// ── Bomber ISO — Stage 04: Power Up ──────────────────────

if (typeof LEVELS === 'undefined') LEVELS = [];

LEVELS.push({
  id: 4,
  name: { en: 'STAGE 04 — POWER UP', it: 'STADIO 04 — POTENZIAMENTO' },
  hint: { en: 'Collect all upgrades before hunting enemies.', it: 'Raccogli tutti i potenziamenti prima di cacciare i nemici.' },
  amica: { en: 'Four smart guards. Collect the upgrades wisely.', it: 'Quattro guardie intelligenti. Raccogli i potenziamenti con saggezza.' },
  width: 13, height: 13,
  hidden: [
    { x: 11, z: 11, type: 4  },   // EXIT
    { x: 3,  z: 3,  type: 8  },   // UPGRADE_BOMB
    { x: 9,  z: 3,  type: 9  },   // UPGRADE_RANGE
    { x: 3,  z: 9,  type: 9  },   // UPGRADE_RANGE
    { x: 9,  z: 9,  type: 8  },   // UPGRADE_BOMB
    { x: 6,  z: 6,  type: 10 },   // UPGRADE_SPEED
  ],
  grid: [
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [2, 3, 0, 0, 0, 5, 0, 5, 0, 0, 0, 0, 2],
    [2, 0, 2, 5, 2, 5, 2, 5, 2, 5, 2, 0, 2],
    [2, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 2],
    [2, 0, 2, 5, 2,11, 2,11, 2, 5, 2, 0, 2],
    [2, 5, 5, 5,11, 5, 5, 5,11, 5, 5, 5, 2],
    [2, 0, 2, 5, 2, 5, 2, 5, 2, 5, 2, 0, 2],
    [2, 5, 5, 5,11, 5, 5, 5,11, 5, 5, 5, 2],
    [2, 0, 2, 5, 2,11, 2,11, 2, 5, 2, 0, 2],
    [2, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 2],
    [2, 0, 2, 5, 2, 5, 2, 5, 2, 5, 2, 0, 2],
    [2, 0, 0, 0, 0, 5, 0, 5, 0, 0, 0, 0, 2],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  ],
});
