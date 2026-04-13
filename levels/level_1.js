// ── Bomber ISO — Stage 01: Awakening ──────────────────────
// Tiles: 0=empty/floor  2=wall  3=player  4=exit
//        5=soft block   8=+bomb  9=+range  11=enemy
// Exit is placed directly in grid (no hidden array needed).

if (typeof LEVELS === 'undefined') LEVELS = [];

LEVELS.push({
  id: 1,
  name: { en: 'STAGE 01 — AWAKENING', it: 'STADIO 01 — RISVEGLIO' },
  hint: { en: 'Destroy soft blocks with bombs. Reach the exit!', it: 'Distruggi i blocchi con le bombe. Raggiunge l\'uscita!' },
  amica: { en: 'Welcome, Bomber. Destroy all enemies to reveal the exit.', it: 'Benvenuto, Bomber. Distruggi i nemici per rivelare l\'uscita.' },
  width: 13, height: 11,
  // Exit hidden under soft block at (11,9)
  hidden: [
    { x: 11, z: 9, type: 4 },
  ],
  grid: [
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [2, 3, 0, 0, 0, 5, 0, 5, 0, 0, 0, 0, 2],
    [2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2],
    [2, 0, 0, 5, 5, 5, 5, 5, 5, 5, 5, 0, 2],
    [2, 5, 2, 5, 2, 0, 2, 0, 2, 5, 2, 5, 2],
    [2, 0, 5, 5, 0, 0, 0, 0, 0, 5, 5, 0, 2],
    [2, 5, 2, 0, 2, 0, 2, 0, 2, 0, 2, 5, 2],
    [2, 0, 5, 5, 0, 0, 0, 0, 0, 5, 5, 0, 2],
    [2, 5, 2, 5, 2, 0, 2, 0, 2, 5, 2, 5, 2],
    [2, 0, 0, 5, 5, 5, 5, 5, 5, 5, 5,11, 2],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  ],
});
