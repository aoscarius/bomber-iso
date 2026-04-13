// ============================================================
// physics.js — Grid-based collision (Bomber ISO)
// Based on porta-iso physics.
// Removed: multi-layer, portal ray-cast, portal exit, cube/movable push.
// Kept:    init, getTile, setTile, isSolidTile, canMoveTo, findPath.
// Added:   isBlastPassable, getGrid.
// ============================================================

const Physics = (() => {

  let _grid   = [];
  let _width  = 0;
  let _height = 0;

  // ── Init ─────────────────────────────────────────────────

  function init(levelData) {
    _width  = levelData.width;
    _height = levelData.height;
    // Single-layer — deep copy the grid
    _grid = levelData.grid.map(row => [...row]);
  }

  // ── Tile access ───────────────────────────────────────────

  function getTile(x, z, _layerIdx = 0) {
    if (x < 0 || x >= _width || z < 0 || z >= _height) return CONSTANTS.TILE.WALL;
    return _grid[z][x];
  }

  function setTile(x, z, tileId, _layerIdx = 0) {
    if (x < 0 || x >= _width || z < 0 || z >= _height) return;
    _grid[z][x] = tileId;
  }

  function getGrid()      { return _grid; }
  function getLayerCount(){ return 1; }

  // ── Solid check ───────────────────────────────────────────

  function isSolidTile(tileId) {
    const T = CONSTANTS.TILE;
    return tileId === T.WALL || tileId === T.SOFT || tileId === T.BOMB;
  }

  // ── Blast passability ─────────────────────────────────────

  /**
   * Returns whether a blast wave can propagate through (x, z).
   * WALL blocks blast. SOFT blocks blast after destroying it.
   * All other tiles (including BOMB — chain reaction) are passable.
   */
  function isBlastPassable(x, z) {
    const t = getTile(x, z);
    return t !== CONSTANTS.TILE.WALL;
  }

  // ── Movement validation ───────────────────────────────────

  /**
   * Check whether the player can move to (nx, nz).
   * No cube/movable pushing in Bomber.
   * Player cannot walk into a bomb they placed.
   */
  function canMoveTo(px, pz, nx, nz, _layerIdx = 0) {
    const tile = getTile(nx, nz);
    if (isSolidTile(tile)) return { ok: false, pushCube: null, pushMovable: null };
    return { ok: true, pushCube: null, pushMovable: null };
  }

  // ── Layer transition (stub — single-layer game) ───────────

  function getLayerTransition() { return null; }

  // ── BFS pathfind ─────────────────────────────────────────

  function findPath(from, to, _layerIdx = 0) {
    if (from.x === to.x && from.z === to.z) return [];
    if (isSolidTile(getTile(to.x, to.z))) return [];

    const DIRS4   = [[1,0],[-1,0],[0,1],[0,-1]];
    const visited = new Set([`${from.x}_${from.z}`]);
    const queue   = [{ x: from.x, z: from.z, path: [] }];

    while (queue.length) {
      const { x, z, path } = queue.shift();
      for (const [dx, dz] of DIRS4) {
        const nx = x + dx, nz = z + dz;
        const key = `${nx}_${nz}`;
        if (visited.has(key)) continue;
        visited.add(key);
        if (isSolidTile(getTile(nx, nz))) continue;
        const newPath = [...path, { x: nx, z: nz }];
        if (nx === to.x && nz === to.z) return newPath;
        queue.push({ x: nx, z: nz, path: newPath });
      }
    }
    return [];
  }

  return {
    init, getTile, setTile, getGrid, getLayerCount,
    isSolidTile,
    isWalkable: (x,z) => !isSolidTile(getTile(x,z)),
    isBlastPassable, canMoveTo,
    getLayerTransition, findPath,
  };
})();

// isWalkable added separately (used by EnemyManager)
