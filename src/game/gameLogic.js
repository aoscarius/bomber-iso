// ============================================================
// gameLogic.js — Bomber ISO level lifecycle & state machine
//
// Same structure as porta-iso gameLogic.
// Removed: portal gun, laser system, multi-layer, cube/movable,
//          button/door mechanics, AMICA dialogue scripts.
// Added:   BombManager integration, EnemyManager integration,
//          power-up pickup, hidden-item reveal (exit under soft).
//
// Delegates to: Physics, Renderer, Player, BombManager,
//               EnemyManager, Particles, AudioEngine, Minimap,
//               AMICA, DialoguePanel.
// ============================================================

const GameLogic = (() => {

  let currentLevel    = null;
  let currentLevelIdx = 0;
  let currentGrid     = null;

  // Hidden items under soft blocks: 'x_z' → tileId
  let _hiddenItems = {};
  let _exitRevealed = false;
  let _exitPos = null;

  let _handlers = {};

  // ── Level lifecycle ───────────────────────────────────────

  function loadLevel(levelIdx, levelData) {
    currentLevel    = levelData;
    currentLevelIdx = levelIdx;
    currentGrid     = levelData.grid.map(row => [...row]);
    _hiddenItems    = {};
    _exitRevealed   = false;
    _exitPos        = null;

    // Scan level.hidden array for items concealed under soft blocks
    if (levelData.hidden) {
      levelData.hidden.forEach(h => {
        _hiddenItems[`${h.x}_${h.z}`] = h.type;
        if (h.type === CONSTANTS.TILE.EXIT) _exitPos = { x: h.x, z: h.z };
      });
    }

    // Exit may also be placed directly in the grid
    if (!_exitPos) {
      outer:
      for (let z = 0; z < levelData.height; z++) {
        for (let x = 0; x < levelData.width; x++) {
          if (currentGrid[z][x] === CONSTANTS.TILE.EXIT) {
            _exitPos = { x, z };
            _exitRevealed = true;
            break outer;
          }
        }
      }
    }

    Physics.init(levelData);
    Renderer.buildLevel(levelData);
    Particles.clearAll();
    BombManager.reset();
    EnemyManager.reset();
    EnemyManager.spawnFromLevel(levelData);

    // HUD
    document.getElementById('level-num').textContent =
      String(levelData.id ?? levelIdx + 1).padStart(2, '0');
    document.getElementById('hud-title').textContent =
      (typeof I18n !== 'undefined' ? I18n.getLocalized(levelData.name)
       : levelData.name?.en ?? levelData.name ?? '');

    _updateHUD();
    Minimap.loadLevel({ ...levelData, grid: currentGrid });

    // Player start
    const start = findPlayerStart(currentGrid);
    Player.init(start.x, start.z);
    Minimap.setPlayerPosition(start.x, start.z);

    // AMICA intro text
    const amicaText = (typeof I18n !== 'undefined')
      ? I18n.getLocalized(levelData.amica)
      : levelData.amica?.en ?? levelData.amica ?? '';
    if (amicaText && typeof AMICA !== 'undefined') AMICA.say(amicaText, 400);

    AudioEngine.resume?.();
    AudioEngine.ambientDrone?.();

    _subscribeEvents();
  }

  function unloadLevel() {
    _unsubscribeEvents();
    Player.destroy?.();
    BombManager.reset();
    EnemyManager.reset();
    Particles.clearAll();
    if (typeof AMICA !== 'undefined') AMICA.clear?.();
    if (typeof DialoguePanel !== 'undefined') DialoguePanel.clear?.();
  }

  // ── EventBus subscriptions ────────────────────────────────

  function _subscribeEvents() {
    _handlers.landed = ({ x, z }) => _onPlayerLanded(x, z);

    _handlers.step = ({ x, z }) => {
      AudioEngine.step?.();
      Minimap.setPlayerPosition?.(x, z);
    };

    _handlers.bump   = () => AudioEngine.bump?.();
    _handlers.escape = () => EventBus.emit('game:pause');

    _handlers.placeBomb = ({ x, z, range }) => {
      const placed = BombManager.placePlayerBomb(x, z, range, Player.getMaxBombs());
      if (placed) _updateHUD();
    };

    _handlers.bombExploded = ({ cells }) => {
      // Kill player if in blast zone
      if (Player.isAlive()) {
        const pp = Player.getPosition();
        if (cells.some(c => c.x === pp.x && c.z === pp.z)) {
          _triggerFail('💥 You were caught in your own blast!');
          return;
        }
      }
      // Kill enemies in blast zone
      EnemyManager.checkExplosionKills(cells);
      _updateHUD();
      Minimap.loadLevel({ ...currentLevel, grid: Physics.getGrid() });
      _checkWinCondition();
    };

    _handlers.bombCleared = () => {
      _updateHUD();
      Minimap.loadLevel({ ...currentLevel, grid: Physics.getGrid() });
    };

    _handlers.softDestroyed = ({ x, z }) => {
      const key = `${x}_${z}`;
      const hidden = _hiddenItems[key];
      if (hidden !== undefined) {
        delete _hiddenItems[key];
        if (hidden === CONSTANTS.TILE.EXIT) {
          _exitRevealed = true;
          Physics.setTile(x, z, CONSTANTS.TILE.EXIT);
          Renderer.showExitMesh(x, z);
          AudioEngine.doorOpenClose?.();
          if (typeof AMICA !== 'undefined') AMICA.sayLine?.('door_open', 400);
          _checkWinCondition();
        } else {
          Physics.setTile(x, z, hidden);
          Renderer.showUpgradeMesh(x, z, hidden);
        }
      }
      Minimap.loadLevel({ ...currentLevel, grid: Physics.getGrid() });
    };

    _handlers.enemyMoved = ({ id, x, z }) => {
      if (!Player.isAlive()) return;
      const pp = Player.getPosition();
      if (pp.x === x && pp.z === z)
        _triggerFail('👾 Caught by an enemy!');
    };

    _handlers.enemyDied = () => {
      _updateHUD();
      // If all enemies dead AND no exit yet, reveal it now
      if (EnemyManager.getEnemyCount() === 0 && !_exitRevealed && _exitPos) {
        _exitRevealed = true;
        Physics.setTile(_exitPos.x, _exitPos.z, CONSTANTS.TILE.EXIT);
        Renderer.showExitMesh(_exitPos.x, _exitPos.z);
        AudioEngine.doorOpenClose?.();
        if (typeof AMICA !== 'undefined') AMICA.say?.('All enemies defeated! Find the exit.', 400);
        Minimap.loadLevel({ ...currentLevel, grid: Physics.getGrid() });
      }
    };

    _handlers.upgraded = () => _updateHUD();

    EventBus.on('player:landed',      _handlers.landed);
    EventBus.on('player:step',        _handlers.step);
    EventBus.on('player:bumped',      _handlers.bump);
    EventBus.on('player:place-bomb',  _handlers.placeBomb);
    EventBus.on('player:upgraded',    _handlers.upgraded);
    EventBus.on('bomb:exploded',      _handlers.bombExploded);
    EventBus.on('bomb:cleared',       _handlers.bombCleared);
    EventBus.on('soft:destroyed',     _handlers.softDestroyed);
    EventBus.on('enemy:moved',        _handlers.enemyMoved);
    EventBus.on('enemy:died',         _handlers.enemyDied);
    EventBus.on('ui:escape',          _handlers.escape);
  }

  function _unsubscribeEvents() {
    EventBus.off('player:landed',      _handlers.landed);
    EventBus.off('player:step',        _handlers.step);
    EventBus.off('player:bumped',      _handlers.bump);
    EventBus.off('player:place-bomb',  _handlers.placeBomb);
    EventBus.off('player:upgraded',    _handlers.upgraded);
    EventBus.off('bomb:exploded',      _handlers.bombExploded);
    EventBus.off('bomb:cleared',       _handlers.bombCleared);
    EventBus.off('soft:destroyed',     _handlers.softDestroyed);
    EventBus.off('enemy:moved',        _handlers.enemyMoved);
    EventBus.off('enemy:died',         _handlers.enemyDied);
    EventBus.off('ui:escape',          _handlers.escape);
  }

  // ── Player landing ────────────────────────────────────────

  function _onPlayerLanded(x, z) {
    if (!Player.isAlive()) return;
    const tile = Physics.getTile(x, z);
    const T    = CONSTANTS.TILE;

    Minimap.setPlayerPosition?.(x, z);

    // Enemy on same cell = instant death
    if (EnemyManager.isEnemyAt(x, z)) {
      _triggerFail('👾 Caught by an enemy!');
      return;
    }

    switch (tile) {
      case T.EXIT:
        if (_exitRevealed) _triggerWin();
        break;

      case T.EXPLOSION:
        _triggerFail('💥 Walked into an explosion!');
        break;

      case T.UPGRADE_BOMB:
      case T.UPGRADE_RANGE:
      case T.UPGRADE_SPEED:
        Player.applyUpgrade(tile);
        Physics.setTile(x, z, T.FLOOR);
        Renderer.removeUpgradeMesh(x, z);
        AudioEngine.upgrade?.();
        break;
    }
  }

  // ── Win condition check ───────────────────────────────────

  function _checkWinCondition() {
    // Win if exit revealed AND player is already standing on it
    if (_exitRevealed && _exitPos) {
      const pp = Player.getPosition();
      if (pp.x === _exitPos.x && pp.z === _exitPos.z)
        _triggerWin();
    }
  }

  // ── HUD update ────────────────────────────────────────────

  function _updateHUD() {
    const el = id => document.getElementById(id);
    if (el('hud-bombs'))   el('hud-bombs').textContent   = `💣 ${Player.getMaxBombs?.() ?? 1}`;
    if (el('hud-range'))   el('hud-range').textContent   = `🔥 ${Player.getBombRange?.() ?? 2}`;
    if (el('hud-enemies')) el('hud-enemies').textContent = `👾 ${EnemyManager.getEnemyCount()}`;
    if (el('step-count'))  el('step-count').textContent  = Player.getStepCount?.() ?? 0;
  }

  // ── Win / Fail ────────────────────────────────────────────

  function _triggerWin() {
    Player.destroy?.();
    AudioEngine.win?.();
    const isLast = currentLevelIdx !== -1 && currentLevelIdx === LEVELS.length - 1;
    if (typeof AMICA !== 'undefined') AMICA.sayLine?.('win_generic', 200);
    setTimeout(() => {
      UIManager.showWin({
        steps:   Player.getStepCount?.() ?? 0,
        bombs: 0,
        isLast,
      });
    }, 700);
  }

  function _triggerFail(message) {
    if (!Player.isAlive()) return;
    Player.destroy?.();
    Renderer.playerDeathFlash?.();
    AudioEngine.fail?.();
    BombManager.reset();
    setTimeout(() => UIManager.showFail(message), 900);
  }

  // ── Public API (same shape as porta-iso GameLogic) ────────

  function getCurrentLevelIdx() { return currentLevelIdx; }
  function isRunning()          { return !!currentLevel; }

  function startFromLevel(index) {
    currentLevelIdx = index;
    loadLevel(index, LEVELS[index]);
  }

  function retryLevel() {
    unloadLevel();
    startFromLevel(currentLevelIdx);
  }

  function nextLevel() {
    unloadLevel();
    const next = currentLevelIdx + 1;
    if (next < LEVELS.length) startFromLevel(next);
    else EventBus.emit('game:all-done');
  }

  function loadCustomLevel(levelData) {
    unloadLevel();
    currentLevelIdx = -1;
    LEVELS[currentLevelIdx] = levelData;
    loadLevel(-1, levelData);
  }

  return {
    getCurrentLevelIdx, isRunning,
    startFromLevel, retryLevel, nextLevel, loadCustomLevel, unloadLevel,
  };
})();
