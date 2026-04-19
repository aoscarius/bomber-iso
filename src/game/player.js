// ============================================================
// player.js — Bomber ISO player state machine + input
//
// Based on porta-iso player — all input machinery preserved:
//   platform detection, AR handlers, BFS path-following,
//   touch D-pad, classic/tank scheme.
//
// Changed vs porta-iso:
//   - Portal gun calls removed (Q/R → bomb)
//   - SPACE / X key → place bomb
//   - dpad-portal-a/b buttons → dpad-bomb button
//   - portalUses → bombsPlaced counter
//   - No multi-layer transitions (single-layer game)
//   - Power-up stats: maxBombs, bombRange, moveSpeed
// ============================================================

const Player = (() => {

  // ── State ─────────────────────────────────────────────────
  let position     = { x: 0, z: 0 };
  let currentLayer = 0;
  let facing       = CONSTANTS.DIRS.DOWN;
  let isMoving     = false;
  let alive        = true;
  let stepCount    = 0;
  let bombsPlaced  = 0;

  // Power-up stats
  let maxBombs  = CONSTANTS.PLAYER_MAX_BOMBS;
  let bombRange = CONSTANTS.EXPLOSION_RANGE;
  let moveSpeed = 1;

  let _scheme   = 'classic';
  let _platform = 'desktop';

  // Path-following queue (click-to-move)
  let _pathQueue = [];
  let _pathTimer = null;

  // ── Rotation table ────────────────────────────────────────
  const TURN_ORDER = [
    CONSTANTS.DIRS.UP, CONSTANTS.DIRS.RIGHT,
    CONSTANTS.DIRS.DOWN, CONSTANTS.DIRS.LEFT,
  ];
  const CLASSIC_MAP = {
    KeyW: CONSTANTS.DIRS.DOWN,  ArrowUp:    CONSTANTS.DIRS.DOWN,
    KeyS: CONSTANTS.DIRS.UP,    ArrowDown:  CONSTANTS.DIRS.UP,
    KeyA: CONSTANTS.DIRS.LEFT,  ArrowLeft:  CONSTANTS.DIRS.LEFT,
    KeyD: CONSTANTS.DIRS.RIGHT, ArrowRight: CONSTANTS.DIRS.RIGHT,
  };

  // ── Listeners ─────────────────────────────────────────────
  let _keyHandler   = null;
  let _mouseHandler = null;
  let _arHandlers   = [];
  let _hoverMesh    = null;

  // ── Lifecycle ─────────────────────────────────────────────

  function init(startX, startZ, startLayer = 0) {
    position     = { x: startX, z: startZ };
    currentLayer = startLayer;
    facing       = CONSTANTS.DIRS.RIGHT;
    isMoving     = false;
    alive        = true;
    stepCount    = 0;
    bombsPlaced  = 0;
    maxBombs     = CONSTANTS.PLAYER_MAX_BOMBS;
    bombRange    = CONSTANTS.EXPLOSION_RANGE;
    moveSpeed    = 1;
    _cancelPath();
    _detectPlatform();
    Renderer.setPlayerMesh(startX, startZ, startLayer);
    _rotateMesh(facing);
    _startListeners();
  }

  function destroy() { alive = false; _cancelPath(); _stopListeners(); }

  function setScheme(s) { if (s === 'classic' || s === 'tank') _scheme = s; }
  function getScheme()  { return _scheme; }
  function getLayer()   { return currentLayer; }
  function isAlive()    { return alive; }

  // ── Platform detection ─────────────────────────────────────

  function _detectPlatform() {
    const ua      = navigator.userAgent || '';
    const isQuest  = /OculusBrowser|MetaQuest/i.test(ua);
    const isMobile = /Android|iPhone|iPad/i.test(ua) || (navigator.maxTouchPoints > 1);
    if      (typeof ARManager !== 'undefined' && ARManager?.isActive?.()) _platform = 'ar';
    else if (isQuest)                                                      _platform = 'ar';
    else if (isMobile)                                                     _platform = 'touch';
    else                                                                   _platform = 'desktop';
  }

  // ── Listeners ─────────────────────────────────────────────

  function _startListeners() {
    _keyHandler = e => { if (e.type === 'keydown') _onKey(e.code); };
    window.addEventListener('keydown', _keyHandler);

    // Left-click: BFS walk; Right-click: nothing (no bombs)
    _mouseHandler = e => {
      if (e.button !== 0) return;
      _handleMouseClick(e);
    };
    const canvas = document.getElementById('game-canvas');
    canvas?.addEventListener('mousedown', _mouseHandler);
    canvas?.addEventListener('contextmenu', e => e.preventDefault());

    const arCellHandler   = ({ x, z, action }) => {
      if (action === 'move') { _cancelPath(); _moveToCell(x, z); }
    };
    const arActionHandler = ({ action }) => {
      switch (action) {
        case 'bomb':   _placeBomb(); break;
        case 'up':    _step(CONSTANTS.DIRS.UP);    break;
        case 'down':  _step(CONSTANTS.DIRS.DOWN);  break;
        case 'left':  _step(CONSTANTS.DIRS.LEFT);  break;
        case 'right': _step(CONSTANTS.DIRS.RIGHT); break;
      }
    };
    const arHoverHandler  = ({ mesh }) => _onARHover(mesh);

    EventBus.on('ar:cell-picked',       arCellHandler);
    EventBus.on('ar:controller-action', arActionHandler);
    EventBus.on('ar:pointer-hover',     arHoverHandler);
    _arHandlers = [
      ['ar:cell-picked',       arCellHandler],
      ['ar:controller-action', arActionHandler],
      ['ar:pointer-hover',     arHoverHandler],
    ];

    // Multitouch test
    const supportsTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (supportsTouch && navigator.maxTouchPoints > 1)
      _setupMTouchDpad();
    else
      _setupTouchDpad();

    EventBus.on('ar:entered', () => { _platform = 'ar'; _setupARHighlight(); });
    EventBus.on('ar:exited',  () => { _detectPlatform(); _clearARHighlight(); });
  }

  function _stopListeners() {
    if (_keyHandler)   window.removeEventListener('keydown', _keyHandler);
    if (_mouseHandler) document.getElementById('game-canvas')?.removeEventListener('mousedown', _mouseHandler);
    _arHandlers.forEach(([ev, fn]) => EventBus.off(ev, fn));
    _arHandlers = [];
    _keyHandler = _mouseHandler = null;
  }

  // ── Touch D-pad ───────────────────────────────────────────

  function _setupMTouchDpad() {
    const activeKeys = new Set();
    let moveInterval = null;

    // Haptic Feedback Helper
    const _vibrate = () => {
      if (typeof navigator.vibrate === 'function') {
        navigator.vibrate(10); // 10ms vibration for a crisp feel
      }
    };

    const _crm = dir => typeof CamRelativeMove !== 'undefined' 
      ? CamRelativeMove.remap(dir) : dir;

    const map = {
      'dpad-up':    () => _step(_crm(CONSTANTS.DIRS.DOWN)),
      'dpad-down':  () => _step(_crm(CONSTANTS.DIRS.UP)),
      'dpad-left':  () => _step(_crm(CONSTANTS.DIRS.LEFT)),
      'dpad-right': () => _step(_crm(CONSTANTS.DIRS.RIGHT)),
      'action-A':   () => _placeBomb(),
      'action-B':   () => _placeBomb(),
    };

    const handleTouch = (e) => {
      e.preventDefault();
      const currentlyPressed = new Set();

      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        let target = document.elementFromPoint(touch.clientX, touch.clientY);
        const btn = target?.closest('.btn-dpad, .btn-action');
        if (btn && map[btn.id]) {
          currentlyPressed.add(btn.id);
        }
      }

      // New presses & visual activation
      currentlyPressed.forEach(id => {
        if (!activeKeys.has(id)) {
          activeKeys.add(id);
          const el = document.getElementById(id);
          if (el) el.classList.add('active'); // Feedback ON
          _vibrate(); map[id](); 
        }
      });

      // Releases & visual deactivation
      activeKeys.forEach(id => {
        if (!currentlyPressed.has(id)) {
          activeKeys.delete(id);
          const el = document.getElementById(id);
          if (el) el.classList.remove('active'); // Feedback OFF
        }
      });

      // Movement Loop logic
      const isDirectionalPressed = [...activeKeys].some(id => id.startsWith('dpad'));
      if (isDirectionalPressed && !moveInterval) {
        moveInterval = setInterval(() => {
          activeKeys.forEach(id => {
            if (id.startsWith('dpad')) map[id]();
          });
        }, 150);
      } else if (!isDirectionalPressed && moveInterval) {
        clearInterval(moveInterval);
        moveInterval = null;
      }
    };

    const container = document.getElementById('mobile-controls');
    if (!container) return;

    ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(eventType => {
      container.addEventListener(eventType, handleTouch, { passive: false });
    });
  }

  function _setupTouchDpad() {
    // Haptic Feedback Helper
    const _vibrate = () => {
      if (typeof navigator.vibrate === 'function') {
        navigator.vibrate(10); // 10ms vibration for a crisp feel
      }
    };

    const _crm = dir => typeof CamRelativeMove !== 'undefined'
      ? CamRelativeMove.remap(dir) : dir;

    const map = {
      'dpad-up':    () => _step(_crm(CONSTANTS.DIRS.DOWN)),
      'dpad-down':  () => _step(_crm(CONSTANTS.DIRS.UP)),
      'dpad-left':  () => _step(_crm(CONSTANTS.DIRS.LEFT)),
      'dpad-right': () => _step(_crm(CONSTANTS.DIRS.RIGHT)),
      'action-A':   () => _placeBomb(),
      'action-B':   () => _placeBomb(),
    };
    Object.entries(map).forEach(([id, fn]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', e => { e.preventDefault(); fn(); _vibrate; el.classList.add('active'); }, { passive: false });
      el.addEventListener('touchend', e => { e.preventDefault(); fn(); el.classList.remove('active'); }, { passive: false });
      el.addEventListener('mousedown',  e => { e.preventDefault(); fn(); });
    });
  }

  // ── AR tile highlight ─────────────────────────────────────

  function _setupARHighlight() {
    const scene = Renderer.getScene();
    if (!scene) return;
    scene.meshes.forEach(m => { m.isPickable = true; });
  }

  function _clearARHighlight() {
    if (_hoverMesh) {
      EventBus.emit('ar:unhover', { mesh: _hoverMesh });
      _hoverMesh = null;
    }
  }

  function _onARHover(mesh) {
    if (_hoverMesh && _hoverMesh !== mesh) EventBus.emit('ar:unhover', { mesh: _hoverMesh });
    _hoverMesh = mesh;
    EventBus.emit('ar:hover', { mesh });
  }

  // ── BFS path following ────────────────────────────────────

  function _moveToCell(tx, tz) {
    const path = Physics.findPath(position, { x: tx, z: tz }, currentLayer);
    if (!path.length) return;
    _cancelPath();
    _pathQueue = path;
    _drivePathStep();
  }

  function _drivePathStep() {
    if (!_pathQueue.length) return;
    if (isMoving) { _pathTimer = setTimeout(_drivePathStep, 40); return; }
    const next = _pathQueue.shift();
    const dx = next.x - position.x, dz = next.z - position.z;
    if (Math.abs(dx) + Math.abs(dz) !== 1) { _cancelPath(); return; }
    const dir = dx !== 0
      ? (dx > 0 ? CONSTANTS.DIRS.RIGHT : CONSTANTS.DIRS.LEFT)
      : (dz > 0 ? CONSTANTS.DIRS.DOWN  : CONSTANTS.DIRS.UP);
    _step(dir);
    if (_pathQueue.length) _pathTimer = setTimeout(_drivePathStep, 40);
  }

  function _cancelPath() {
    if (_pathTimer) { clearTimeout(_pathTimer); _pathTimer = null; }
    _pathQueue = [];
  }

  // ── Keyboard ──────────────────────────────────────────────

  function _onKey(code) {
    if (!alive) return;
    switch (code) {
      case 'Space': case 'KeyX': _placeBomb(); return;
      case 'Escape': EventBus.emit('ui:escape'); return;
    }
    _cancelPath();
    if (_scheme === 'classic') _handleClassic(code);
    else                       _handleTank(code);
  }

  function _handleClassic(code) {
    const dir = CLASSIC_MAP[code];
    if (dir) _step(typeof CamRelativeMove !== 'undefined'
      ? CamRelativeMove.remap(dir) : dir);
  }

  function _handleTank(code) {
    switch (code) {
      case 'KeyW': case 'ArrowUp':    _step(typeof CamRelativeMove !== 'undefined' ? CamRelativeMove.remap(facing) : facing); break;
      case 'KeyS': case 'ArrowDown':  _step(typeof CamRelativeMove !== 'undefined' ? CamRelativeMove.remap({ dx: -facing.dx, dz: -facing.dz }) : { dx: -facing.dx, dz: -facing.dz }); break;
      case 'KeyA': case 'ArrowLeft':  _turn(-1); break;
      case 'KeyD': case 'ArrowRight': _turn(+1); break;
    }
  }

  function _turn(delta) {
    if (isMoving) return;
    const idx = TURN_ORDER.findIndex(d => d.dx === facing.dx && d.dz === facing.dz);
    facing = TURN_ORDER[(idx + delta + 4) % 4];
    _rotateMesh(facing);
    EventBus.emit('player:turned', { facing });
  }

  // ── Bomb placement ────────────────────────────────────────

  function _placeBomb() {
    if (!alive) return;
    EventBus.emit('player:place-bomb', {
      x: position.x, z: position.z, range: bombRange,
    });
    bombsPlaced++;
  }

  // ── Core movement ─────────────────────────────────────────

  function _step(dir) {
    if (!alive || isMoving) return;
    facing = dir;
    _rotateMesh(dir);
    const nx = position.x + dir.dx;
    const nz = position.z + dir.dz;

    // Check if target cell is walkable (no bombs, no cubes in Bomber)
    const result = Physics.canMoveTo(position.x, position.z, nx, nz, currentLayer);
    if (!result.ok) { EventBus.emit('player:bumped', { x: nx, z: nz }); return; }

    _commit(nx, nz);
  }

  function _commit(nx, nz) {
    isMoving = true;
    position = { x: nx, z: nz };
    stepCount++;
    const el = document.getElementById('step-count');
    if (el) el.textContent = stepCount;
    EventBus.emit('player:step', { x: nx, z: nz, layer: currentLayer });

    Renderer.animatePlayerTo(nx, nz, currentLayer, () => {
      isMoving = false;
      EventBus.emit('player:landed', { x: nx, z: nz, layer: currentLayer });
    });
  }

  // ── Mouse click (BFS walk only, no bombs) ───────────────

  function _handleMouseClick(e) {
    try {
      const scene  = Renderer.getScene();
      const canvas = document.getElementById('game-canvas');
      if (!scene || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const pick = scene.pick(e.clientX - rect.left, e.clientY - rect.top);
      if (!pick?.hit || !pick.pickedMesh) return;
      const meta  = pick.pickedMesh.metadata;
      const gx    = meta?.gridX ?? Math.round(pick.pickedPoint.x / CONSTANTS.TILE_SIZE);
      const gz    = meta?.gridZ ?? Math.round(pick.pickedPoint.z / CONSTANTS.TILE_SIZE);
      const layer = meta?.layerIdx ?? currentLayer;
      if (layer !== currentLayer) return;
      const tileId = meta?.tileId ?? Physics.getTile(gx, gz, currentLayer);
      if (!Physics.isSolidTile(tileId)) {
        _cancelPath();
        _moveToCell(gx, gz);
      }
    } catch (err) {
      console.warn('[Player] click handler:', err);
    }
  }

  // ── Power-ups ─────────────────────────────────────────────

  function applyUpgrade(type) {
    const T = CONSTANTS.TILE;
    if (type === T.UPGRADE_BOMB)  maxBombs++;
    if (type === T.UPGRADE_RANGE) bombRange++;
    if (type === T.UPGRADE_SPEED) moveSpeed = Math.min(moveSpeed + 1, 3);
    EventBus.emit('player:upgraded', { maxBombs, bombRange, moveSpeed });
  }

  // ── Mesh helper ───────────────────────────────────────────

  function _rotateMesh(dir) { try { Renderer.rotatePlayerMesh(dir); } catch(_) {} }

  // ── Public API ────────────────────────────────────────────

  return {
    init, destroy, isAlive,
    setScheme, getScheme, getLayer,
    applyUpgrade,
    getPosition:   () => ({ ...position }),
    getFacing:     () => ({ ...facing }),
    getStepCount:  () => stepCount,
    getBombsUses: () => bombsPlaced,   // alias kept for uiManager win stats
    getMaxBombs:   () => maxBombs,
    getBombRange:  () => bombRange,
    getMoveSpeed:  () => moveSpeed,
  };
})();
