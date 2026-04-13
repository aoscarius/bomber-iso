// ── Bomber ISO — Stage 02: First Patrol ───────────────────

if (typeof LEVELS === 'undefined') LEVELS = [];

LEVELS.push({
  id: 2,
  name: { en: 'STAGE 02 — FIRST PATROL', it: 'STADIO 02 — PRIMA PATTUGLIA' },
  hint: { en: 'Find the range upgrade to clear distant blocks.', it: 'Trova il potenziamento del raggio per colpire da lontano.' },
  amica: { en: 'Two guards spotted. Eliminate them to unlock the exit.', it: 'Due guardie rilevate. Eliminale per sbloccare l\'uscita.' },
  width: 13, height: 13,
  hidden: [
    { x: 11, z: 11, type: 4  },   // EXIT
    { x: 5,  z: 5,  type: 9  },   // UPGRADE_RANGE
  ],
  grid: [
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [2, 3, 0, 0, 5, 0, 5, 0, 5, 0, 0, 0, 2],
    [2, 0, 2, 5, 2, 5, 2, 5, 2, 5, 2, 0, 2],
    [2, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 2],
    [2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2],
    [2, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 2],
    [2, 5, 2, 0, 2,11, 2, 0, 2, 0, 2, 5, 2],
    [2, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 2],
    [2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2],
    [2, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 2],
    [2, 5, 2, 5, 2, 0, 2, 0, 2, 5, 2, 5, 2],
    [2, 0, 0, 5, 0, 5, 0, 5, 0,11, 0, 0, 2],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  ],
});
