// ============================================================
// constants.js — Bomber ISO global configuration
// Based on porta-iso constants; portal/laser tiles replaced with
// Bomber-specific tiles (SOFT, BOMB, EXPLOSION, UPGRADE_*).
// ============================================================

const CONSTANTS = {

  // ── Isometric grid ─────────────────────────────────────────
  TILE_SIZE:   2,
  TILE_HEIGHT: 0.5,
  WALL_HEIGHT: 2.5,

  // ── Isometric camera ───────────────────────────────────────
  ISO_ALPHA:  -Math.PI / 4,
  ISO_BETA:    Math.PI / 3.6,
  ISO_RADIUS:  36,

  // ── Player ─────────────────────────────────────────────────
  PLAYER_SPEED:     5,
  PLAYER_STEP_TIME: 0.12,

  // ── Bomber gameplay ─────────────────────────────────────
  BOMB_TIMER:           3.0,   // seconds before bomb detonates
  EXPLOSION_TIME:       0.65,  // seconds explosion tiles linger
  EXPLOSION_RANGE:      2,     // default blast radius
  PLAYER_MAX_BOMBS:     1,     // starting max bombs on field
  PLAYER_MAX_RANGE:     2,     // starting blast range
  ENEMY_MOVE_INTERVAL:  1.1,   // seconds between enemy steps

  // ── Tile colour palette ────────────────────────────────────
  COLOR_FLOOR:        '#1e1e28',
  COLOR_WALL:         '#2a2a38',
  COLOR_SOFT_WALL:    '#5a3a1a',   // destructible block
  COLOR_PLAYER:       '#e8d080',   // Bomber yellow
  COLOR_ENEMY:        '#d04040',
  COLOR_BOMB:         '#111111',
  COLOR_BOMB_FUSE:    '#ff6a00',
  COLOR_EXPLOSION:    '#ff4400',
  COLOR_EXPLOSION_2:  '#ffdd00',
  COLOR_EXIT:         '#00ff88',
  COLOR_UPGRADE_BOMB:  '#ff6a00',
  COLOR_UPGRADE_RANGE: '#0099ff',
  COLOR_UPGRADE_SPEED: '#00ff88',

  // ── Tile IDs ───────────────────────────────────────────────
  TILE: {
    EMPTY:          0,
    FLOOR:          1,
    WALL:           2,   // indestructible
    PLAYER:         3,   // player start marker
    EXIT:           4,   // level exit
    SOFT:           5,   // destructible block
    BOMB:           6,   // active bomb (runtime)
    EXPLOSION:      7,   // active explosion (runtime)
    UPGRADE_BOMB:   8,   // +1 max bombs
    UPGRADE_RANGE:  9,   // +1 blast range
    UPGRADE_SPEED:  10,  // speed boost
    ENEMY:          11,  // enemy spawn marker
  },

  // ── Direction vectors ──────────────────────────────────────
  DIRS: {
    UP:    { dx:  0, dz: -1 },
    DOWN:  { dx:  0, dz:  1 },
    LEFT:  { dx: -1, dz:  0 },
    RIGHT: { dx:  1, dz:  0 },
  },

  // ── Multi-layer (kept for compatibility, single-layer game) ─
  LAYER_HEIGHT:     3.0,
  LAYER_FADE_ABOVE: 0.12,
  LAYER_FADE_BELOW: 0.35,
};
