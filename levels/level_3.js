// ── Bomber ISO — Stage 03: The Labyrinth ─────────────────

if (typeof LEVELS === 'undefined') LEVELS = [];

LEVELS.push({
  id: 3,
  name: { en: 'STAGE 03 — THE LABYRINTH', it: 'STADIO 03 — IL LABIRINTO' },
  hint: { en: 'Chain explosions to clear multiple blocks at once.', it: 'Usa esplosioni a catena per liberare più blocchi.' },
  amica: { en: 'Three hostiles. They have learned to chase you.', it: 'Tre ostili. Hanno imparato a inseguirti.' },
  width: 15, height: 13,
  hidden: [
    { x: 13, z: 11, type: 4  },   // EXIT
    { x: 7,  z: 6,  type: 8  },   // UPGRADE_BOMB
    { x: 2,  z: 10, type: 9  },   // UPGRADE_RANGE
  ],
  grid: [
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [2, 3, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 0, 2],
    [2, 0, 2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2],
    [2, 5, 5, 5, 5,11, 5, 5, 5, 5, 5, 5, 5, 5, 2],
    [2, 5, 2, 5, 2, 5, 2, 0, 2, 5, 2, 5, 2, 5, 2],
    [2, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 2],
    [2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2],
    [2, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 2],
    [2, 5, 2, 5, 2, 5, 2, 0, 2, 5, 2, 5, 2, 5, 2],
    [2, 5, 5, 5, 5,11, 5, 5, 5, 5, 5,11, 5, 5, 2],
    [2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2],
    [2, 0, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 2],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  ],
});
