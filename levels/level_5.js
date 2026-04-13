// ── Bomber ISO — Stage 05: Final Battle ──────────────────

if (typeof LEVELS === 'undefined') LEVELS = [];

LEVELS.push({
  id: 5,
  name: { en: 'STAGE 05 — FINAL BATTLE', it: 'STADIO 05 — BATTAGLIA FINALE' },
  hint: { en: 'Use chain explosions. The exit appears when all enemies fall.', it: 'Usa le catene di esplosione. L\'uscita appare quando tutti i nemici cadono.' },
  amica: { en: 'Final stage. Six elite guards. Good luck.', it: 'Stadio finale. Sei guardie elite. Buona fortuna.' },
  width: 15, height: 15,
  hidden: [
    { x: 13, z: 13, type: 4  },   // EXIT
    { x: 7,  z: 7,  type: 10 },   // UPGRADE_SPEED (centre bonus)
    { x: 2,  z: 2,  type: 9  },
    { x: 12, z: 2,  type: 8  },
    { x: 2,  z: 12, type: 8  },
    { x: 12, z: 12, type: 9  },
  ],
  grid: [
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [2, 3, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 0, 2],
    [2, 0, 2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2],
    [2, 5,11, 5, 5, 5, 5, 5, 5, 5, 5, 5,11, 5, 2],
    [2, 0, 2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2],
    [2, 5, 5, 5, 5, 5,11, 5,11, 5, 5, 5, 5, 5, 2],
    [2, 0, 2, 5, 2,11, 2, 5, 2,11, 2, 5, 2, 5, 2],
    [2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 2],
    [2, 0, 2, 5, 2,11, 2, 5, 2,11, 2, 5, 2, 5, 2],
    [2, 5, 5, 5, 5, 5,11, 5,11, 5, 5, 5, 5, 5, 2],
    [2, 0, 2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2],
    [2, 5,11, 5, 5, 5, 5, 5, 5, 5, 5, 5,11, 5, 2],
    [2, 0, 2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2],
    [2, 0, 5, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 0, 2],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  ],
});
