// ============================================================
// levelEditor.js — Bomber ISO level editor
// Single-layer only. No links, no lasers, no multi-floor.
// Includes random level generator integration.
// ============================================================

const LevelEditor = (() => {
  const CELL = 46;   // Pixels per cell in editor canvas

  let _hidden = [];
  let _grid = [];
  let gridW = 13, gridH = 11;
  let selectedTile = CONSTANTS.TILE.FLOOR;
  let activeTool   = 'paint';
  let hoverCell    = null;

  let _canvas  = null;
  let _ctx     = null;
  let _isDragging = false;

  // ── Init ──────────────────────────────────────────────────

  function init() {
    _canvas = document.getElementById('editor-canvas');
    _ctx    = _canvas?.getContext('2d');
    if (!_canvas || !_ctx) return;

    if (_grid.length === 0) _resetToEmpty(gridW, gridH);

    _resizeCanvas();
    _buildPalette();
    _attachEvents();
    _render();
    _setStatus('Select a tile and paint on the grid.');
  }

  function _resetToEmpty(w, h) {
    gridW = w; gridH = h;
    _hidden = [];
    _grid = Array.from({ length: h }, () => Array(w).fill(CONSTANTS.TILE.FLOOR));
    for (let x = 0; x < w; x++) { _grid[0][x] = CONSTANTS.TILE.WALL; _grid[h-1][x] = CONSTANTS.TILE.WALL; }
    for (let z = 0; z < h; z++) { _grid[z][0] = CONSTANTS.TILE.WALL; _grid[z][w-1] = CONSTANTS.TILE.WALL; }
    // Classic Bomber: pillar walls at even x AND even z
    for (let x = 0; x < w; x++)
      for (let z = 0; z < h; z++) 
        if (x % 2 === 0 && z % 2 === 0) {
          _grid[z][x] = CONSTANTS.TILE.WALL;
          continue;
        }
  }

  function _makeBlankGrid(w, h) {
    const g = Array.from({ length: h }, () => Array(w).fill(CONSTANTS.TILE.FLOOR));
    for (let x = 0; x < w; x++) { g[0][x] = CONSTANTS.TILE.WALL; g[h-1][x] = CONSTANTS.TILE.WALL; }
    for (let z = 0; z < h; z++) { g[z][0] = CONSTANTS.TILE.WALL; g[z][w-1] = CONSTANTS.TILE.WALL; }
    return g;
  }

  // ── Canvas ────────────────────────────────────────────────

  function _resizeCanvas() {
    if (!_canvas) return;
    _canvas.width  = gridW * CELL;
    _canvas.height = gridH * CELL;
  }

  // ── Palette ───────────────────────────────────────────────

  function _buildPalette() {
    const container = document.getElementById('tile-palette');
    if (!container) return;
    container.innerHTML = '';

    Object.values(TileTypes).forEach(t => {
      const btn = document.createElement('button');
      btn.className   = 'tile-btn' + (t.id === selectedTile ? ' selected' : '');
      btn.textContent = t.editorLabel;
      btn.dataset.tileId = t.id;

      // Color-coded border
      btn.style.borderColor = t.id === selectedTile
        ? 'var(--portal-b)' : t.editorColor + '88';

      btn.addEventListener('click', () => {
        selectedTile     = t.id;
        activeTool       = 'paint';
        _pendingLinkDoor = null;
        document.querySelectorAll('.tile-btn').forEach(b => {
          const tid = parseInt(b.dataset.tileId);
          b.classList.toggle('selected', tid === selectedTile);
          b.style.borderColor = tid === selectedTile
            ? 'var(--portal-b)' : (TileTypes[tid]?.editorColor || '#333') + '88';
        });
      });
      container.appendChild(btn);
    });
  }

  // ── Events ────────────────────────────────────────────────

  function _attachEvents() {
    if (!_canvas) return;

    _canvas.addEventListener('mousedown',  e => { _isDragging = true;  _handleAction(e); });
    _canvas.addEventListener('mousemove',  e => {
      if (_isDragging) _handleAction(e);
      const c = _cellAt(e);
      hoverCell  = c; _render();
      if (c) {
        const el = document.getElementById('editor-cursor-pos');
        if (el) el.textContent = `(${c.x}, ${c.z})`;
      }
    });
    _canvas.addEventListener('mouseup',    () => { _isDragging = false; });
    _canvas.addEventListener('mouseleave', () => { _isDragging = false; });
    _canvas.addEventListener('contextmenu', e => e.preventDefault());

    _canvas.addEventListener('touchstart', e => { e.preventDefault(); _isDragging = true;  _handleTouch(e); }, { passive: false });
    _canvas.addEventListener('touchmove',  e => { e.preventDefault(); if (_isDragging) _handleTouch(e); }, { passive: false });
    _canvas.addEventListener('touchend',   () => { _isDragging = false; });

    // Tool buttons
    ['paint','erase','fill'].forEach(t => {
      document.getElementById(`tool-${t}`)?.addEventListener('click', () => {
        activeTool = t; _syncToolBtns();
      });
    });

    document.getElementById('btn-resize-grid')?.addEventListener('click', () => {
      const w = parseInt(document.getElementById('grid-w')?.value) || gridW;
      const h = parseInt(document.getElementById('grid-h')?.value) || gridH;
      _resizeGrid(w, h);
      _setStatus(`Grid resized to ${w}×${h}`);
    });

    document.getElementById('btn-generate-level')?.addEventListener('click', _generateRandom);
    document.getElementById('btn-test-level')?.addEventListener('click',     _testLevel);
    document.getElementById('btn-export-level')?.addEventListener('click',   _exportLevel);
    document.getElementById('btn-copy-level')?.addEventListener('click',     _copyClipboard);
    document.getElementById('btn-import-level')?.addEventListener('click', () =>
      document.getElementById('import-file-input')?.click());
    document.getElementById('import-file-input')?.addEventListener('change', _importLevel);
    document.getElementById('btn-clear-level')?.addEventListener('click', () => {
      _resetToEmpty(gridW, gridH); _resizeCanvas(); _render();
      _setStatus('Grid cleared.');
    });

    const _close = () => EventBus.emit('editor:close');
    document.getElementById('btn-close-editor')?.addEventListener('click', _close);
    document.getElementById('btn-exit')?.addEventListener('click', _close);
    document.getElementById('btn-toggle')?.addEventListener('click', () =>
      document.getElementById('cnt-sidebar')?.classList.toggle('hidden'));

    // Sync size inputs
    const wEl = document.getElementById('grid-w');
    const hEl = document.getElementById('grid-h');
    if (wEl) wEl.value = gridW;
    if (hEl) hEl.value = gridH;
  }

  function _syncToolBtns() {
    ['paint','erase','fill'].forEach(t => {
      document.getElementById(`tool-${t}`)?.classList.toggle('active', activeTool === t);
    });
  }

  function _cellAt(e) {
    const rect   = _canvas.getBoundingClientRect();
    const scaleX = _canvas.width  / rect.width;
    const scaleY = _canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX / CELL);
    const z = Math.floor((e.clientY - rect.top)  * scaleY / CELL);
    if (x < 0 || x >= gridW || z < 0 || z >= gridH) return null;
    return { x, z };
  }

  function _handleTouch(e) {
    const t = e.touches[0];
    if (t) _handleAction({ clientX: t.clientX, clientY: t.clientY, button: 0 });
  }

  function _handleAction(e) {
    const cell = _cellAt(e);
    if (!cell) return;
    if (e.button === 2) { _eraseAt(cell.x, cell.z); return; }
    if (activeTool === 'paint') _paintAt(cell.x, cell.z);
    else if (activeTool === 'erase') _eraseAt(cell.x, cell.z);
    else if (activeTool === 'fill')  _floodFill(cell.x, cell.z, _grid[cell.z][cell.x], selectedTile);
  }

  // ── Grid ops ──────────────────────────────────────────────

  function _paintAt(x, z) {
    if (x === 0 || x === gridW-1 || z === 0 || z === gridH-1) {
      if (selectedTile !== CONSTANTS.TILE.WALL) return; // border must stay wall
    }
    const T = CONSTANTS.TILE;

    // Unique tiles
    if (isUnique(selectedTile)) {
      for (let zz = 0; zz < gridH; zz++)
        for (let xx = 0; xx < gridW; xx++)
          if (_grid[zz][xx] === selectedTile) _grid[zz][xx] = CONSTANTS.TILE.FLOOR;
      _hidden = _hidden.filter(item => item.type !== selectedTile);
    }
    // Hiiden tiles
    if (isHidden(selectedTile)) {
      _hidden = _hidden.filter(item => item.x !== x || item.z !== z);
      _hidden.push({ x, z, type: selectedTile });
    } else {
      _grid[z][x] = selectedTile;
    }

    _render();
  }

  function _eraseAt(x, z) {
    if (x === 0 || x === gridW-1 || z === 0 || z === gridH-1) return;
    _hidden = _hidden.filter(item => item.x !== x || item.z !== z);
    _grid[z][x] = CONSTANTS.TILE.FLOOR;
    _render();
  }

  function _floodFill(sx, sz, targetId, fillId) {
    if (targetId === fillId) return;
    const stack = [{ x: sx, z: sz }];
    const seen  = new Set();
    while (stack.length) {
      const { x, z } = stack.pop();
      const key = `${x}_${z}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (x < 0 || x >= gridW || z < 0 || z >= gridH) continue;
      if (_grid[z][x] !== targetId) continue;
      _grid[z][x] = fillId;
      stack.push({ x:x+1,z },{ x:x-1,z },{ x,z:z+1 },{ x,z:z-1 });
    }
    _render();
  }

  function _resizeGrid(newW, newH) {
    newW = Math.max(5, Math.min(32, newW));
    newH = Math.max(5, Math.min(32, newH));
    const ng = _makeBlankGrid(newW, newH);
    for (let z = 1; z < Math.min(gridH-1, newH-1); z++)
      for (let x = 1; x < Math.min(gridW-1, newW-1); x++)
        ng[z][x] = _grid[z]?.[x] ?? 0;
    gridW = newW; gridH = newH; _grid = ng;
    _resizeCanvas(); _render();
    _setStatus(`Grid resized to ${newW}×${newH}.`);
  }

  // ── Random generator ──────────────────────────────────────

  function _generateRandom() {
    if (typeof LevelGenerator === 'undefined') {
      _setStatus('LevelGenerator not loaded.'); return;
    }
    const diffEl = document.getElementById('gen-difficulty');
    const diff = diffEl ? parseInt(diffEl.value) || 2 : 2;
    const ld = LevelGenerator.generate({
      seed:       Date.now(),
      difficulty: Math.max(1, Math.min(5, diff)),
      width:      gridW,
      height:     gridH,
      id:         9000 + Math.floor(Math.random() * 900),
    });
    gridW = ld.width; gridH = ld.height;
    _hidden = Array.isArray(ld.hidden) ? ld.hidden.map(item => ({
        x: item.x, z: item.z, type: item.type,
      })) : [];
    _grid = ld.grid.map(row => [...row]);
    _resizeCanvas(); _render();
    const wEl = document.getElementById('grid-w');
    const hEl = document.getElementById('grid-h');
    if (wEl) wEl.value = gridW;
    if (hEl) hEl.value = gridH;
    const nameEl = document.getElementById('editor-level-name');
    if (nameEl) nameEl.value = typeof I18n !== 'undefined'
      ? I18n.getLocalized(ld.name) : (ld.name?.en || 'GENERATED');
    _setStatus(`Random stage generated (difficulty ${diff}).`);
  }

  // ── Rendering ─────────────────────────────────────────────

  // Cached tile colors for fast render
  const _TILE_COLORS = {};
  function _getTileColor(tileId) {
    if (!_TILE_COLORS[tileId]) _TILE_COLORS[tileId] = TileTypes[tileId]?.editorColor || '#0a0a0c';
    return _TILE_COLORS[tileId];
  }

  function _render() {
    if (!_ctx) return;
    _ctx.clearRect(0, 0, _canvas.width, _canvas.height);

    // Background
    _ctx.fillStyle = '#07070a';
    _ctx.fillRect(0, 0, _canvas.width, _canvas.height);

    // Tiles + Hiddens
    for (let z = 0; z < gridH; z++)
      for (let x = 0; x < gridW; x++) {
        const item = _hidden.find(item => item.x === x && item.z === z);
        hiddenItem = item ? item.type : null;
        _drawCell(x, z, _grid[z][x], hiddenItem);
    }

    // Grid lines
    _drawGridLines();

    // Hover highlight
    if (hoverCell) {
      _ctx.strokeStyle = 'rgba(255,106,0,0.7)';
      _ctx.lineWidth   = 2;
      _ctx.strokeRect(hoverCell.x * CELL + 1, hoverCell.z * CELL + 1, CELL - 2, CELL - 2);
    }
  }

  function _drawCell(x, z, tileId, hiddenId = null) {
    const T  = CONSTANTS.TILE;
    const px = x * CELL, py = z * CELL;

    // Base fill
    _ctx.fillStyle = _getTileColor(tileId);
    _ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);

    // Inner bevel for walls
    if (tileId === T.WALL || tileId === T.SOFT) {
      _ctx.fillStyle = 'rgba(255,255,255,0.04)';
      _ctx.fillRect(px + 2, py + 2, CELL - 4, 3);
      _ctx.fillStyle = 'rgba(0,0,0,0.15)';
      _ctx.fillRect(px + 2, py + CELL - 5, CELL - 4, 3);
    }

    // Label for interactive tiles
    if (tileId !== T.EMPTY && tileId !== T.FLOOR && tileId !== T.WALL) {
      const meta  = TileTypes[tileId];
      const label = (meta?.editorLabel || '').replace(/^[^\s]+\s/, '');
      _ctx.fillStyle    = 'rgba(255,255,255,0.9)';
      _ctx.font         = `bold 9px "Share Tech Mono", monospace`;
      _ctx.textAlign    = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(label.slice(0,6), px + CELL/2, py + CELL/2);
    }

    _ctx.fillStyle = _getTileColor(hiddenId);

    // Circle for hiddens
    if (hiddenId !== null) {
      const centerX = px + CELL / 2;
      const centerY = py + CELL / 2;
      const size = CELL / 3;
      _ctx.beginPath();
      if (hiddenId == T.EXIT) {
        _ctx.arc(centerX, centerY, size, 0, Math.PI * 2);
      } else {
        _ctx.moveTo(centerX, centerY - size);
        _ctx.lineTo(centerX + size, centerY);
        _ctx.lineTo(centerX, centerY + size);
        _ctx.lineTo(centerX - size, centerY);
        _ctx.closePath();     
      }
      _ctx.fill();
    }

    // Label for hidden
    if (hiddenId !== T.EMPTY && hiddenId !== T.FLOOR && hiddenId !== T.WALL) {
      const meta  = TileTypes[hiddenId];
      const label = (meta?.editorLabel || '').replace(/^[^\s]+\s/, '');
      _ctx.fillStyle    = 'rgba(0,0,0,0.9)';
      _ctx.font         = `bold 8px "Share Tech Mono", monospace`;
      _ctx.textAlign    = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(label.slice(0,6), px + CELL/2, py + CELL/2);
    }
  }

  function _drawGridLines() {
    _ctx.strokeStyle = 'rgba(255,106,0,0.09)';
    _ctx.lineWidth   = 1;
    for (let x = 0; x <= gridW; x++) {
      _ctx.beginPath(); _ctx.moveTo(x*CELL, 0); _ctx.lineTo(x*CELL, gridH*CELL); _ctx.stroke();
    }
    for (let z = 0; z <= gridH; z++) {
      _ctx.beginPath(); _ctx.moveTo(0, z*CELL); _ctx.lineTo(gridW*CELL, z*CELL); _ctx.stroke();
    }
  }

  // ── Export / Import ───────────────────────────────────────

  function _buildLevelObject() {
    const name  = document.getElementById('editor-level-name')?.value.trim() || 'CUSTOM STAGE';
    const amica = document.getElementById('editor-amica-text')?.value.trim() || '';
    return {
      id:    Date.now() % 10000,
      name:  { en: name,  it: name  },
      hint:  { en: '',    it: ''    },
      amica: { en: amica, it: amica },
      width:  gridW,
      height: gridH,
      hidden: Array.isArray(_hidden) ? _hidden.map(item => ({ x: item.x, z: item.z, type: item.type })) : [],
      grid:   _grid.map(row => [...row]),
    };
  }

  function _levelToJS(data) {
    const rows = data.grid.map(row => '    [' + row.join(', ') + ']').join(',\n');
    return [
      `if (typeof LEVELS === 'undefined') LEVELS = [];`,
      ``,
      `LEVELS.push({`,
      `  id: ${data.id},`,
      `  name:  { en: ${JSON.stringify(data.name.en)},  it: ${JSON.stringify(data.name.it)}  },`,
      `  hint:  { en: '', it: '' },`,
      `  amica: { en: ${JSON.stringify(data.amica.en)}, it: ${JSON.stringify(data.amica.it)} },`,
      `  width: ${data.width}, height: ${data.height},`,
      `  hidden: ${JSON.stringify(data.hidden || [])},`,
      `  grid: [`,
      rows + ',',
      `  ],`,
      `});`,
      ``,
    ].join('\n');
  }

  function _exportLevel() {
    const data = _buildLevelObject();
    const blob = new Blob([_levelToJS(data)], { type: 'text/javascript' });
    const a    = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `level_${data.id}.js`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
    _setStatus('Level exported.');
  }

  function _copyClipboard() {
    const js = _levelToJS(_buildLevelObject());
    navigator.clipboard?.writeText(js)
      .then(() => _setStatus('Copied to clipboard.'))
      .catch(() => _setStatus('Clipboard copy failed.'));
  }

  function _importLevel(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const temp = [];
        new Function('LEVELS', ev.target.result)(temp);
        const ld = temp[0];
        if (!ld?.grid) { _setStatus('Invalid level file.'); return; }
        gridW = ld.width; gridH = ld.height;
        _grid = ld.grid.map(row => [...row]);
        _hidden = Array.isArray(ld.hidden) ? ld.hidden.map(item => ({
          x: item.x, z: item.z, type: item.type,
        })) : [];
        _resizeCanvas(); _render();
        const wEl = document.getElementById('grid-w');
        const hEl = document.getElementById('grid-h');
        const nEl = document.getElementById('editor-level-name');
        const aEl = document.getElementById('editor-amica-text');
        if (wEl) wEl.value = gridW;
        if (hEl) hEl.value = gridH;
        if (nEl) nEl.value = typeof I18n !== 'undefined' ? I18n.getLocalized(ld.name)  : (ld.name?.en  || '');
        if (aEl) aEl.value = typeof I18n !== 'undefined' ? I18n.getLocalized(ld.amica) : (ld.amica?.en || '');
        _setStatus('Level imported.');
      } catch(err) {
        _setStatus('Import error: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ── Test ──────────────────────────────────────────────────

  function _testLevel() {
    const data = _buildLevelObject();
    const hasPlayer = data.grid.some(row => row.includes(CONSTANTS.TILE.PLAYER));
    if (!hasPlayer) { _setStatus('Place a PLAYER tile (◈) before testing.'); return; }
    EventBus.emit('editor:test', data);
  }

  // ── Status ────────────────────────────────────────────────

  function _setStatus(msg) {
    const el = document.getElementById('editor-status');
    if (el) el.textContent = msg;
  }

  return { init };
})();
