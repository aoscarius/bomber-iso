// ============================================================
// themes.js — Visual theme system
//
// Three themes:
//   'dark'  — Industrial Dark (original: near-black, orange/blue)
//   'lab'   — Aperture Lab (clean white laboratory, clinical)
//   'neon'  — Neon Toxic (deep purple/black, acid green + hot pink)
//
// Each theme defines:
//   css     — CSS variable overrides applied to :root
//   babylon — BabylonJS scene / light colours
//   tiles   — 3D mesh colour overrides (matched to CONSTANTS.TILE keys)
//
// Usage:
//   Themes.apply('lab')
//   Themes.getCurrent()   → 'lab'
// ============================================================

const Themes = (() => {

  let _current = 'dark';

  // ── Theme definitions ────────────────────────────────────
  const DEFS = {

    // ── Industrial Dark (original) ───────────────────────
    dark: {
      label: 'theme_dark',  // I18n key
      css: {
        '--bg-deep':       '#08080b',
        '--bg-panel':      '#0f0f14',
        '--bg-surface':    '#17171f',
        '--bg-raised':     '#1e1e28',
        '--border':        '#252530',
        '--border-bright': '#383848',
        '--portal-a':      '#0099ff',
        '--portal-b':      '#ff6a00',
        '--text-primary':  '#e2e2ee',
        '--text-dim':      '#5a5a72',
        '--text-mid':      '#9090a8',
        '--success':       '#00e87a',
        '--danger':        '#ff2244',
        '--laser':         '#ff2020',
        '--dlg-bg':        'rgba(20,10,5,0.97)',
        '--dlg-accent':    '#ff6a00',
      },
      babylon: {
        clearColor:   [0.04, 0.04, 0.07, 1],
        ambientColor: [0.15, 0.15, 0.20],
        sunDiffuse:   [0.95, 0.90, 0.85],
        hemiDiffuse:  [0.60, 0.70, 0.90],
        hemiGround:   [0.10, 0.10, 0.15],
        sunIntensity: 0.9,
        hemiIntensity:0.3,
      },
      tiles: {
        floor:       '#1e1e28',
        wall:        '#2a2a38',
        wallAccent:  '#3a3a50',
        exit:        '#00ff88',
        button:      '#ffdd00',
        door:        '#ff4444',
        cube:        '#aaaacc',
        movable:     '#5a3a1a',
        hazard:      '#ff2244',
        emitter:     '#ff6a00',
        receiver:    '#00ccff',
        player:      '#ccccdd',
      },
    },

    // ── Aperture Lab (clean clinical white) ──────────────
    lab: {
      label: 'theme_lab',
      css: {
        '--bg-deep':       '#f0f0f5',
        '--bg-panel':      '#ffffff',
        '--bg-surface':    '#f7f7fc',
        '--bg-raised':     '#ebebf5',
        '--border':        '#d0d0e0',
        '--border-bright': '#b0b0c8',
        '--portal-a':      '#0077cc',
        '--portal-b':      '#e06000',
        '--text-primary':  '#1a1a2e',
        '--text-dim':      '#7070a0',
        '--text-mid':      '#4a4a72',
        '--success':       '#00aa55',
        '--danger':        '#cc1133',
        '--laser':         '#cc0000',
        '--dlg-bg':        'rgba(250,250,255,0.97)',
        '--dlg-accent':    '#0077cc',
      },
      babylon: {
        clearColor:   [0.93, 0.93, 0.96, 1],
        ambientColor: [0.50, 0.50, 0.55],
        sunDiffuse:   [1.00, 1.00, 1.00],
        hemiDiffuse:  [0.90, 0.90, 1.00],
        hemiGround:   [0.70, 0.70, 0.80],
        sunIntensity: 1.1,
        hemiIntensity:0.5,
      },
      tiles: {
        floor:       '#e8e8f4',
        wall:        '#c0c0d8',
        wallAccent:  '#a0a8d0',
        exit:        '#00aa55',
        button:      '#e06000',
        door:        '#cc1133',
        cube:        '#8888bb',
        movable:     '#46465e',
        hazard:      '#cc1133',
        emitter:     '#e06000',
        receiver:    '#0077cc',
        player:      '#2a2a55',
      },
    },

    // ── Neon Toxic (deep purple + acid green + hot pink) ─
    neon: {
      label: 'theme_neon',
      css: {
        '--bg-deep':       '#06020e',
        '--bg-panel':      '#0e0518',
        '--bg-surface':    '#160a24',
        '--bg-raised':     '#1e1030',
        '--border':        '#2a1545',
        '--border-bright': '#4a2075',
        '--portal-a':      '#cc00ff',
        '--portal-b':      '#00ff88',
        '--text-primary':  '#e8f0e0',
        '--text-dim':      '#5a4872',
        '--text-mid':      '#a080c8',
        '--success':       '#00ff88',
        '--danger':        '#ff0055',
        '--laser':         '#ff0055',
        '--dlg-bg':        'rgba(6,2,14,0.97)',
        '--dlg-accent':    '#00ff88',
      },
      babylon: {
        clearColor:   [0.024, 0.008, 0.055, 1],
        ambientColor: [0.10, 0.05, 0.20],
        sunDiffuse:   [0.80, 0.40, 1.00],
        hemiDiffuse:  [0.30, 1.00, 0.50],
        hemiGround:   [0.10, 0.05, 0.15],
        sunIntensity: 0.8,
        hemiIntensity:0.4,
      },
      tiles: {
        floor:       '#160a24',
        wall:        '#1e1030',
        wallAccent:  '#2a1548',
        exit:        '#00ff88',
        button:      '#ffff00',
        door:        '#ff0055',
        cube:        '#cc88ff',
        movable:     '#443053',
        hazard:      '#ff0055',
        emitter:     '#00ff88',
        receiver:    '#cc00ff',
        player:      '#e0d0ff',
      },
    },
  };

  // ── Apply theme ───────────────────────────────────────────

  /**
   * Apply a theme by id ('dark' | 'lab' | 'neon').
   * Updates CSS variables, BabylonJS scene colours, and CONSTANTS colours.
   * @param {string} id
   */
  function apply(id) {
    const def = DEFS[id];
    if (!def) { console.warn(`[Themes] Unknown theme: ${id}`); return; }
    _current = id;

    // 1. Apply CSS variables to :root
    const root = document.documentElement;
    Object.entries(def.css).forEach(([k, v]) => root.style.setProperty(k, v));

    // 2. Add body class for theme-specific overrides in CSS
    document.body.className = document.body.className
      .replace(/\btheme-\w+\b/g, '').trim();
    document.body.classList.add(`theme-${id}`);

    // 3. Update CONSTANTS colours (used by Renderer mesh factory)
    const t = def.tiles;
    CONSTANTS.COLOR_FLOOR       = t.floor;
    CONSTANTS.COLOR_WALL        = t.wall;
    CONSTANTS.COLOR_WALL_ACCENT = t.wallAccent;
    CONSTANTS.COLOR_EXIT        = t.exit;
    CONSTANTS.COLOR_BUTTON      = t.button;
    CONSTANTS.COLOR_DOOR        = t.door;
    CONSTANTS.COLOR_CUBE        = t.cube;
    CONSTANTS.COLOR_MOVABLE     = t.movable;
    CONSTANTS.COLOR_HAZARD      = t.hazard;
    CONSTANTS.COLOR_EMITTER     = t.emitter;
    CONSTANTS.COLOR_PLAYER      = t.player;

    // 4. Update BabylonJS scene if it's already initialised
    _applyBabylon(def.babylon);

    // 5. Persist preference
    try { localStorage.setItem('portal_iso_theme', id); } catch(_) {}

    // 6. Notify other systems
    EventBus.emit('theme:changed', { id });
  }

  /** Patch BabylonJS scene colours. Safe to call even if scene not ready. */
  function _applyBabylon(b) {
    if (typeof Renderer === 'undefined') return;
    const scene = Renderer.getScene?.();
    if (!scene) return;

    scene.clearColor   = new BABYLON.Color4(...b.clearColor);
    scene.ambientColor = new BABYLON.Color3(...b.ambientColor);

    // Patch named lights
    const sun  = scene.getLightByName('sun');
    const hemi = scene.getLightByName('hemi');
    if (sun) {
      sun.diffuse    = new BABYLON.Color3(...b.sunDiffuse);
      sun.intensity  = b.sunIntensity;
    }
    if (hemi) {
      hemi.diffuse      = new BABYLON.Color3(...b.hemiDiffuse);
      hemi.groundColor  = new BABYLON.Color3(...b.hemiGround);
      hemi.intensity    = b.hemiIntensity;
    }
  }

  /** Restore saved theme on startup. */
  function loadSaved() {
    try {
      const saved = localStorage.getItem('portal_iso_theme');
      if (saved && DEFS[saved]) apply(saved);
      else                       apply('dark');
    } catch(_) {
      apply('dark');
    }
  }

  function getCurrent() { return _current; }

  /** List of all themes for the settings UI. */
  const LIST = Object.entries(DEFS).map(([id, def]) => ({ id, label: def.label }));

  return { apply, loadSaved, getCurrent, LIST, DEFS };
})();
