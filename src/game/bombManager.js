// ============================================================
// bombManager.js — Active bomb tracking, explosion propagation,
// chain reactions, tile destruction.
// ============================================================

const BombManager = (() => {

  const activeBombs = new Map();   // id → { x, z, range, timerId, isPlayer }
  let _bombIdCounter      = 0;
  let _playerBombsOnField = 0;

  function reset() {
    activeBombs.forEach(b => clearTimeout(b.timerId));
    activeBombs.clear();
    _playerBombsOnField = 0;
    _bombIdCounter      = 0;
  }

  // ── Place bomb ────────────────────────────────────────────

  function placePlayerBomb(x, z, range, maxBombs) {
    if (_playerBombsOnField >= maxBombs) return false;
    if (Physics.getTile(x, z) === CONSTANTS.TILE.BOMB) return false;

    _playerBombsOnField++;
    const id = ++_bombIdCounter;

    Physics.setTile(x, z, CONSTANTS.TILE.BOMB);
    Renderer.placeBombMesh(x, z, id);
    AudioEngine.bombPlace?.();

    const timerId = setTimeout(
      () => _explode(id, true),
      CONSTANTS.BOMB_TIMER * 1000
    );
    activeBombs.set(id, { x, z, range, timerId, isPlayer: true });
    EventBus.emit('bomb:placed', { x, z, id });
    return true;
  }

  function triggerBomb(id) {
    const b = activeBombs.get(id);
    if (!b) return;
    clearTimeout(b.timerId);
    _explode(id, b.isPlayer);
  }

  // ── Explosion ─────────────────────────────────────────────

  function _explode(bombId, isPlayer) {
    const b = activeBombs.get(bombId);
    if (!b) return;
    activeBombs.delete(bombId);
    if (isPlayer) _playerBombsOnField = Math.max(0, _playerBombsOnField - 1);

    Physics.setTile(b.x, b.z, CONSTANTS.TILE.EMPTY);
    Renderer.removeBombMesh(b.x, b.z, bombId);
    AudioEngine.explosion?.();

    const blastCells = _calcBlast(b.x, b.z, b.range);

    blastCells.forEach(cell => {
      Physics.setTile(cell.x, cell.z, CONSTANTS.TILE.EXPLOSION);
      Renderer.showExplosionMesh(cell.x, cell.z, cell.type);
      Particles.explosionBurst?.(cell.x, cell.z);
    });

    EventBus.emit('bomb:exploded', { x: b.x, z: b.z, cells: blastCells });

    setTimeout(() => {
      blastCells.forEach(cell => {
        if (Physics.getTile(cell.x, cell.z) === CONSTANTS.TILE.EXPLOSION)
          Physics.setTile(cell.x, cell.z, CONSTANTS.TILE.EMPTY);
        Renderer.removeExplosionMesh(cell.x, cell.z);
      });
      EventBus.emit('bomb:cleared', { cells: blastCells });
    }, CONSTANTS.EXPLOSION_TIME * 1000);
  }

  // ── Blast calculation ────────────────────────────────────

  function _calcBlast(cx, cz, range) {
    const cells = [{ x: cx, z: cz, type: 'center' }];
    const DIRS  = Object.values(CONSTANTS.DIRS);

    for (const dir of DIRS) {
      for (let i = 1; i <= range; i++) {
        const bx = cx + dir.dx * i;
        const bz = cz + dir.dz * i;
        const tile = Physics.getTile(bx, bz);
        const T    = CONSTANTS.TILE;

        if (tile === T.WALL) break;   // hard wall — stop

        const isLast = (i === range);
        cells.push({ x: bx, z: bz, type: isLast ? 'tip' : 'cross', dir });

        if (tile === T.SOFT) {
          // Destroy soft block and stop propagation
          Physics.setTile(bx, bz, T.EMPTY);
          Renderer.removeSoftWallMesh(bx, bz);
          Particles.softBlockBurst?.(bx, bz);
          EventBus.emit('soft:destroyed', { x: bx, z: bz });
          break;
        }

        if (tile === T.BOMB) {
          // Chain reaction — find and trigger that bomb
          for (const [cid, cb] of activeBombs.entries()) {
            if (cb.x === bx && cb.z === bz) {
              setTimeout(() => triggerBomb(cid), 60);
              break;
            }
          }
          break;
        }
      }
    }
    return cells;
  }

  function getPlayerBombsOnField() { return _playerBombsOnField; }

  return { reset, placePlayerBomb, triggerBomb, getPlayerBombsOnField };
})();
