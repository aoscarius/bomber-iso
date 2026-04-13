// ============================================================
// levelGenerator.js — Bomber ISO procedural stage generator
//
// Generates a playable single-layer Bomber stage with:
//   - Random soft block placement (checkerboard safe zones)
//   - Enemy placement scaled by difficulty
//   - Power-up hidden under soft blocks
//   - Exit hidden under a soft block
//   - Clear spawn area around player
// ============================================================

const LevelGenerator = (() => {

  // ── PRNG (deterministic) ──────────────────────────────────
  function _prng(seed) {
    let s = (seed >>> 0) || 1;
    return () => {
      s ^= s << 13; s ^= s >> 17; s ^= s << 5;
      return (s >>> 0) / 0xffffffff;
    };
  }

  // ── Generate ──────────────────────────────────────────────

  /**
   * @param {object} opts
   * @param {number} [opts.seed]        - random seed (default: Date.now())
   * @param {number} [opts.difficulty]  - 1–5 (default: 2)
   * @param {number} [opts.width]       - grid width  (default: 13, min 9)
   * @param {number} [opts.height]      - grid height (default: 11, min 9)
   * @param {number} [opts.id]          - level id
   */
  function generate(opts = {}) {
    const seed       = opts.seed       ?? (Date.now() & 0xffffffff);
    const difficulty = Math.max(1, Math.min(5, opts.difficulty ?? 2));
    const width      = Math.max(9, Math.min(32, opts.width  ?? 13));
    const height     = Math.max(9, Math.min(32, opts.height ?? 11));
    const id         = opts.id ?? (1000 + Math.floor(seed % 9000));
    const rng        = _prng(seed);

    const T = CONSTANTS.TILE;
    const grid = _makeGrid(width, height);

    // Player always spawns top-left safe corner
    const playerX = 1, playerZ = 1;
    grid[playerZ][playerX] = T.PLAYER;

    // Soft block density scales with difficulty (30%–65% of fillable cells)
    const softDensity = 0.30 + difficulty * 0.07;

    // Fill interior with soft blocks, respecting:
    //  - fixed indestructible wall pillars at even x,z positions
    //  - 2-cell safe zone around player start
    for (let z = 1; z < height - 1; z++) {
      for (let x = 1; x < width - 1; x++) {
        if (grid[z][x] !== T.FLOOR) continue;

        // Classic Bomber: pillar walls at even x AND even z
        if (x % 2 === 0 && z % 2 === 0) {
          grid[z][x] = T.WALL;
          continue;
        }

        // Safe zone: the 3×3 area around player start
        if (x <= playerX + 2 && z <= playerZ + 2) continue;

        // Random soft block
        if (rng() < softDensity) grid[z][x] = T.SOFT;
      }
    }

    // Place enemies — count and type scale with difficulty
    const enemyCount = 1 + difficulty;
    _placeEnemies(grid, width, height, enemyCount, playerX, playerZ, rng);

    // Build hidden items array (exit + power-ups under soft blocks)
    const hidden = [];
    const softCells = [];
    for (let z = 1; z < height - 1; z++)
      for (let x = 1; x < width - 1; x++)
        if (grid[z][x] === T.SOFT) softCells.push({ x, z });

    _shuffle(softCells, rng);

    // Exit hidden in a soft block far from player
    const exitCell = _pickFar(softCells, playerX, playerZ);
    if (exitCell) hidden.push({ x: exitCell.x, z: exitCell.z, type: T.EXIT });

    // Power-ups (1–3 depending on difficulty)
    const upgradeTypes = [T.UPGRADE_BOMB, T.UPGRADE_RANGE, T.UPGRADE_SPEED];
    const upgradeCount = Math.min(difficulty, 3);
    let placed = 0;
    for (const cell of softCells) {
      if (cell === exitCell) continue;
      if (placed >= upgradeCount) break;
      hidden.push({ x: cell.x, z: cell.z, type: upgradeTypes[placed % upgradeTypes.length] });
      placed++;
    }

    const diffLabels = ['', 'EASY', 'NORMAL', 'HARD', 'EXPERT', 'INSANE'];
    return {
      id,
      name:   { en: `STAGE ${id} — ${diffLabels[difficulty]}`, it: `STADIO ${id} — ${diffLabels[difficulty]}` },
      hint:   { en: 'Destroy all enemies to reveal the exit.', it: 'Elimina tutti i nemici per rivelare l\'uscita.' },
      amica:  { en: `Procedural stage — difficulty ${difficulty}.`, it: `Livello procedurale — difficoltà ${difficulty}.` },
      width, height, hidden,
      grid: grid.map(row => [...row]),
    };
  }

  // ── Helpers ───────────────────────────────────────────────

  function _makeGrid(w, h) {
    const g = Array.from({ length: h }, () => Array(w).fill(CONSTANTS.TILE.FLOOR));
    for (let x = 0; x < w; x++) { g[0][x] = CONSTANTS.TILE.WALL; g[h-1][x] = CONSTANTS.TILE.WALL; }
    for (let z = 0; z < h; z++) { g[z][0] = CONSTANTS.TILE.WALL; g[z][w-1] = CONSTANTS.TILE.WALL; }
    return g;
  }

  function _placeEnemies(grid, w, h, count, px, pz, rng) {
    const T      = CONSTANTS.TILE;
    const placed = [];
    let   tries  = 0;
    while (placed.length < count && tries < 400) {
      tries++;
      const x = 1 + Math.floor(rng() * (w - 2));
      const z = 1 + Math.floor(rng() * (h - 2));
      if (grid[z][x] !== T.FLOOR) continue;
      // Must be far enough from player (Manhattan distance ≥ 5)
      if (Math.abs(x - px) + Math.abs(z - pz) < 5) continue;
      grid[z][x] = T.ENEMY;
      placed.push({ x, z });
    }
  }

  function _placePowerUps(grid, w, h, count, px, pz, rng) {
    const T      = CONSTANTS.TILE;
    const placed = [];
    let   tries  = 0;
    while (placed.length < count && tries < 400) {
      tries++;
      const x = 1 + Math.floor(rng() * (w - 2));
      const z = 1 + Math.floor(rng() * (h - 2));
      if (grid[z][x] !== T.FLOOR) continue;
      // Must be far enough from player (Manhattan distance ≥ 5)
      if (Math.abs(x - px) + Math.abs(z - pz) < 5) continue;
      grid[z][x] = Math.floor(Math.random() * (T.UPGRADE_SPEED - T.UPGRADE_BOMB + 1)) + T.UPGRADE_BOMB;
      placed.push({ x, z });
    }
  }

  function _pickFar(cells, px, pz) {
    if (!cells.length) return null;
    // Pick from the farthest 25% of cells
    const sorted = [...cells].sort((a, b) =>
      (Math.abs(b.x-px) + Math.abs(b.z-pz)) - (Math.abs(a.x-px) + Math.abs(a.z-pz))
    );
    const pool = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.25)));
    return pool[0];
  }

  function _shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  return { generate };
})();
