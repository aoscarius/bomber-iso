// ============================================================
// enemyManager.js — Enemy spawning, AI movement, death
//
// AI types (set per-enemy based on level difficulty):
//   'random'  — random walk, avoids walls
//   'chase'   — BFS toward player when within sight range
//   'smart'   — chase + avoids cells adjacent to active bombs
// ============================================================

const EnemyManager = (() => {

  const enemies = new Map();   // id → { id, x, z, type, alive }
  let _idCounter    = 0;
  let _tickInterval = null;

  function reset() {
    if (_tickInterval) clearInterval(_tickInterval);
    _tickInterval = null;
    enemies.forEach(e => Renderer.removeEnemyMesh(e.id));
    enemies.clear();
    _idCounter = 0;
  }

  // ── Spawn ─────────────────────────────────────────────────

  /**
   * Read ENEMY tiles from the level grid, replace them with EMPTY,
   * and create enemy objects. Enemy type cycles: first enemies random,
   * later ones smarter.
   */
  function spawnFromLevel(levelData) {
    const T    = CONSTANTS.TILE;
    let count  = 0;
    for (let z = 0; z < levelData.height; z++) {
      for (let x = 0; x < levelData.width; x++) {
        if (levelData.grid[z][x] === T.ENEMY) {
          Physics.setTile(x, z, T.EMPTY);
          const type = count < 2 ? 'random' : (count < 5 ? 'chase' : 'smart');
          _spawnEnemy(x, z, type);
          count++;
        }
      }
    }
    if (count > 0) _startTick();
  }

  function _spawnEnemy(x, z, type) {
    const id   = ++_idCounter;
    const mesh = Renderer.createEnemyMesh(x, z, id);
    enemies.set(id, { id, x, z, type, alive: true });
    return id;
  }

  // ── AI tick ───────────────────────────────────────────────

  function _startTick() {
    if (_tickInterval) clearInterval(_tickInterval);
    _tickInterval = setInterval(_tick, CONSTANTS.ENEMY_MOVE_INTERVAL * 1000);
  }

  function _tick() {
    enemies.forEach(e => {
      if (!e.alive) return;
      try { _moveEnemy(e); } catch(_) {}
    });
  }

  function _moveEnemy(enemy) {
    const DIRS = Object.values(CONSTANTS.DIRS);
    const T    = CONSTANTS.TILE;

    // Collect walkable neighbours (not walls, not soft, not bombs, not other enemies)
    const walkable = DIRS.filter(d => {
      const nx = enemy.x + d.dx, nz = enemy.z + d.dz;
      if (!Physics.isWalkable(nx, nz)) return false;
      // Don't step on bombs
      if (Physics.getTile(nx, nz) === T.BOMB) return false;
      // Don't collide with other enemies
      if (isEnemyAt(nx, nz) && !(nx === enemy.x && nz === enemy.z)) return false;
      return true;
    });

    if (!walkable.length) return;

    let chosen = null;

    if (enemy.type === 'random') {
      // Pure random walk
      chosen = walkable[Math.floor(Math.random() * walkable.length)];

    } else if (enemy.type === 'chase') {
      // BFS toward player if within 8 cells, else random
      const pp = Player?.getPosition?.();
      if (pp) {
        const path = Physics.findPath(
          { x: enemy.x, z: enemy.z },
          { x: pp.x, z: pp.z }
        );
        if (path.length && path.length <= 8) {
          const next = path[0];
          const dir  = walkable.find(d =>
            enemy.x + d.dx === next.x && enemy.z + d.dz === next.z
          );
          chosen = dir || walkable[Math.floor(Math.random() * walkable.length)];
        } else {
          chosen = walkable[Math.floor(Math.random() * walkable.length)];
        }
      } else {
        chosen = walkable[Math.floor(Math.random() * walkable.length)];
      }

    } else if (enemy.type === 'smart') {
      // Chase player AND avoid cells adjacent to active bombs
      const safe = walkable.filter(d => {
        const nx = enemy.x + d.dx, nz = enemy.z + d.dz;
        return !_isNearBomb(nx, nz);
      });
      const pool = safe.length ? safe : walkable;

      const pp = Player?.getPosition?.();
      if (pp) {
        const path = Physics.findPath(
          { x: enemy.x, z: enemy.z },
          { x: pp.x, z: pp.z }
        );
        if (path.length && path.length <= 10) {
          const next = path[0];
          const dir  = pool.find(d =>
            enemy.x + d.dx === next.x && enemy.z + d.dz === next.z
          );
          chosen = dir || pool[Math.floor(Math.random() * pool.length)];
        } else {
          chosen = pool[Math.floor(Math.random() * pool.length)];
        }
      } else {
        chosen = pool[Math.floor(Math.random() * pool.length)];
      }
    }

    if (!chosen) return;

    const nx = enemy.x + chosen.dx;
    const nz = enemy.z + chosen.dz;
    enemy.x = nx;
    enemy.z = nz;
    Renderer.animateEnemyTo(enemy.id, nx, nz);
    EventBus.emit('enemy:moved', { id: enemy.id, x: nx, z: nz });
  }

  /** Returns true if any active bomb is within blast range of (x, z). */
  function _isNearBomb(x, z) {
    for (const d of Object.values(CONSTANTS.DIRS)) {
      for (let i = 1; i <= CONSTANTS.EXPLOSION_RANGE + 1; i++) {
        const bx = x + d.dx * i, bz = z + d.dz * i;
        if (Physics.getTile(bx, bz) === CONSTANTS.TILE.BOMB) return true;
        if (Physics.getTile(bx, bz) === CONSTANTS.TILE.WALL) break;
      }
    }
    return Physics.getTile(x, z) === CONSTANTS.TILE.BOMB;
  }

  // ── Kill ──────────────────────────────────────────────────

  function killEnemy(id) {
    const e = enemies.get(id);
    if (!e || !e.alive) return;
    e.alive = false;
    Renderer.removeEnemyMesh(id);
    Particles.enemyDeathBurst?.(e.x, e.z);
    AudioEngine.enemyDie?.();
    enemies.delete(id);
    EventBus.emit('enemy:died', { id, x: e.x, z: e.z });
  }

  function checkExplosionKills(blastCells) {
    const cellSet = new Set(blastCells.map(c => `${c.x}_${c.z}`));
    [...enemies.keys()].forEach(id => {
      const e = enemies.get(id);
      if (e && cellSet.has(`${e.x}_${e.z}`)) killEnemy(id);
    });
  }

  function isEnemyAt(x, z) {
    for (const e of enemies.values())
      if (e.alive && e.x === x && e.z === z) return true;
    return false;
  }

  function getEnemyCount() {
    return [...enemies.values()].filter(e => e.alive).length;
  }

  // Physics.isWalkable proxy (kept here to avoid circular dep)
  return {
    reset, spawnFromLevel,
    killEnemy, checkExplosionKills,
    isEnemyAt, getEnemyCount,
  };
})();
