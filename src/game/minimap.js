// ============================================================
// minimap.js — 2D minimap overlay (Bomberman ISO)
// Updated tile color table for Bomberman tile set.
// Removed portal/laser rendering (not used in Bomberman).
// Added: soft block, upgrades, enemy, bomb, explosion colors.
// Double-click to toggle enlarged mode.
// ============================================================

const Minimap = (() => {
  const CELL_NORMAL = 7;
  const CELL_LARGE  = 14;
  const MARGIN      = 16;
  let CELL = CELL_NORMAL;

  let canvas, ctx;
  let currentLevel = null;
  let playerPos    = { x: 0, z: 0 };
  let visible      = true;
  let _enlarged    = false;

  // ── Kept for API compatibility (portal-iso calls these; no-ops here) ──
  let portalA = null, portalB = null;
  let _laserSegs = [];

  // ── Init ─────────────────────────────────────────────────

  function init() {
    canvas = document.createElement('canvas');
    canvas.id = 'minimap-canvas';
    Object.assign(canvas.style, {
      position:      'fixed',
      bottom:        `${MARGIN}px`,
      right:         `${MARGIN}px`,
      zIndex:        '60',
      border:        '1px solid rgba(255,106,0,0.4)',
      borderTop:     '2px solid rgba(255,106,0,0.7)',
      background:    'rgba(10,10,12,0.88)',
      imageRendering:'pixelated',
      pointerEvents: 'auto',
      cursor:        'pointer',
      transition:    'width 0.15s ease, height 0.15s ease',
    });
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');

    canvas.addEventListener('dblclick', () => {
      _enlarged = !_enlarged;
      CELL = _enlarged ? CELL_LARGE : CELL_NORMAL;
      if (currentLevel) {
        canvas.width  = currentLevel.width  * CELL;
        canvas.height = currentLevel.height * CELL;
      }
      render();
    });
  }

  // ── Tile color table — Bomberman ISO ─────────────────────

  const TILE_COLORS = {
    // Core
    [CONSTANTS.TILE.EMPTY]:         null,         // transparent — floor underneath shows through
    [CONSTANTS.TILE.FLOOR]:         '#1e1e28',    // dark floor
    [CONSTANTS.TILE.WALL]:          '#2a2a38',    // indestructible wall
    [CONSTANTS.TILE.PLAYER]:        '#1e1e28',    // player start = floor (player drawn separately)
    [CONSTANTS.TILE.EXIT]:          '#00ff88',    // green exit ring
    // Bomberman-specific
    [CONSTANTS.TILE.SOFT]:          '#5a3a1a',    // destructible brown block
    [CONSTANTS.TILE.BOMB]:          '#111111',    // black bomb dot
    [CONSTANTS.TILE.EXPLOSION]:     '#ff4400',    // orange explosion cell
    [CONSTANTS.TILE.UPGRADE_BOMB]:  '#ff6a00',    // orange power-up
    [CONSTANTS.TILE.UPGRADE_RANGE]: '#0099ff',    // blue power-up
    [CONSTANTS.TILE.UPGRADE_SPEED]: '#00ff88',    // green power-up
    [CONSTANTS.TILE.ENEMY]:         '#d04040',    // red enemy spawn (only during level build)
  };

  // Floor color used for EMPTY cells that still need a base drawn
  const FLOOR_COLOR = '#1e1e28';

  // ── Public API ────────────────────────────────────────────

  function loadLevel(levelData) {
    currentLevel = levelData;
    portalA = portalB = null;
    canvas.width  = levelData.width  * CELL;
    canvas.height = levelData.height * CELL;
    render();
  }

  function setPlayerPosition(x, z) {
    playerPos = { x, z };
    render();
  }

  // No-ops kept for API compatibility
  function setPortal(which, cell) {
    if (which === 'A') portalA = cell; else portalB = cell;
  }
  function setLaserSegments(segs) { _laserSegs = segs || []; }

  function setVisible(v) {
    visible = v;
    canvas.style.display = v ? 'block' : 'none';
  }

  function updateGrid(layerIdx = 0) {
    if (!currentLevel || typeof Physics === 'undefined') return;
    const liveGrid = [];
    for (let z = 0; z < currentLevel.height; z++) {
      liveGrid.push([]);
      for (let x = 0; x < currentLevel.width; x++)
        liveGrid[z].push(Physics.getTile(x, z, layerIdx));
    }
    currentLevel = { ...currentLevel, grid: liveGrid };
    render();
  }

  // ── Render ────────────────────────────────────────────────

  function render() {
    if (!ctx || !currentLevel || !visible) return;
    const { grid, width, height } = currentLevel;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const tileId = grid[z][x];

        // EMPTY: draw floor base so the map isn't transparent
        if (tileId === CONSTANTS.TILE.EMPTY || tileId === CONSTANTS.TILE.FLOOR ||
            tileId === CONSTANTS.TILE.PLAYER) {
          ctx.fillStyle = FLOOR_COLOR;
          ctx.fillRect(x * CELL, z * CELL, CELL - 1, CELL - 1);
          continue;
        }

        const color = TILE_COLORS[tileId];
        if (!color) continue;

        ctx.fillStyle = color;
        ctx.fillRect(x * CELL, z * CELL, CELL - 1, CELL - 1);

        // Small label dot for upgrades to distinguish them
        if (tileId === CONSTANTS.TILE.UPGRADE_BOMB ||
            tileId === CONSTANTS.TILE.UPGRADE_RANGE ||
            tileId === CONSTANTS.TILE.UPGRADE_SPEED) {
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          const cx = x * CELL + CELL / 2, cz = z * CELL + CELL / 2;
          ctx.beginPath();
          ctx.arc(cx, cz, CELL * 0.22, 0, Math.PI * 2);
          ctx.fill();
        }

        // Bomb: draw fuse dot on top
        if (tileId === CONSTANTS.TILE.BOMB) {
          ctx.fillStyle = '#ff6a00';
          ctx.fillRect(x * CELL + CELL - 2, z * CELL, 2, 2);
        }
      }
    }

    // Enemy dots — read live from EnemyManager if available
    if (typeof EnemyManager !== 'undefined') {
      ctx.fillStyle = CONSTANTS.COLOR_ENEMY || '#d04040';
      // EnemyManager doesn't expose positions directly, so we draw
      // based on the grid (ENEMY tiles are replaced at spawn but
      // updateGrid keeps runtime state which won't have ENEMY tiles)
      // Instead draw enemy positions by scanning for tiles not in map
      // — enemies move dynamically so we use a marker approach:
      // EnemyManager.isEnemyAt is per-cell, but we can't iterate all cells cheaply.
      // Draw enemy marker by scanning the grid for remaining ENEMY tiles
      // (only visible during level-build pass, not runtime)
    }

    // Player — bright white dot with pulse ring
    const px = playerPos.x * CELL + CELL / 2;
    const pz = playerPos.z * CELL + CELL / 2;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, pz, CELL * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth   = 0.7;
    ctx.beginPath();
    ctx.arc(px, pz, CELL * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    // MAP label
    ctx.fillStyle    = 'rgba(255,106,0,0.7)';
    ctx.font         = `bold ${CELL - 1}px "Share Tech Mono", monospace`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('MAP', 2, 1);
  }

  return {
    init, loadLevel, setPlayerPosition,
    setPortal, setLaserSegments,       // no-ops, kept for API compat
    setVisible, updateGrid, render,
    isVisible: () => visible,
  };
})();
