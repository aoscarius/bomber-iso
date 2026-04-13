// ============================================================
// levels.js — Built-in test chamber definitions
// Grid: 0=empty, 1=floor, 2=wall, 3=player, 4=exit,
//       5=button, 6=door, 7=cube, 8=hazard,
//       9=portal-wall, 10=emitter, 11=receiver,
//      12=movable
// ============================================================

let LEVELS = [];
let DIALOGUE_SCRIPTS = [];

const LevelLoader = (() => {

  async function load(onProgress = null) {
    const res = await fetch('levels/levels.json');
    const manifest = await res.json();

    const files = manifest.files || [];
    const total = files.length;
    let loaded = 0;

    if (onProgress) onProgress(0, total, '');

    for (const file of files) {
      await _loadLevelFile(file);
      loaded++;
      if (onProgress) onProgress(loaded, total, file);
    }

    if (onProgress) onProgress(total, total, '');
    console.log(`[LevelLoader] ${loaded}/${total} levels loaded.`);
  }

  function _loadLevelFile(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const genHash = () => Math.random().toString(36).substring(2, 10);
      script.src = `${src}?v=${genHash()}`;
      script.onload = () => resolve(src);
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(script);
    });
  }

  return { load };
})();

/**
 * Locate the player's starting position in a level grid.
 * @param {number[][]} grid
 * @returns {{x:number, z:number}}
 */
function findPlayerStart(grid) {
  for (let z = 0; z < grid.length; z++) {
    for (let x = 0; x < grid[z].length; x++) {
      if (grid[z][x] === CONSTANTS.TILE.PLAYER) return { x, z };
    }
  }
  return { x: 1, z: 1 }; // Fallback
}
