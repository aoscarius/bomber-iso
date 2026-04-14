// ============================================================
// i18n.js — Internationalisation (i18n) system
//
// Supports: English (en), Italian (it)
// Provides:
//   - I18n.t(key)           → translated string
//   - I18n.setLang(code)    → switch language, emit 'i18n:changed'
//   - I18n.getLang()        → current language code
//   - I18n.getTTSLang()     → BCP-47 language tag for Web Speech API
//   - I18n.getAmicaLines() → full LINES map in current language
//   - I18n.getScripts()     → full SCRIPTS map in current language
// ============================================================

const I18n = (() => {

  let _lang = 'en';   // Default language

  // ── BCP-47 tags for TTS voice selection ──────────────────
  const TTS_LANG = {
    en: 'en-US',
    it: 'it-IT',
  };

  // ── UI string translations ────────────────────────────────
  // Used by uiManager to render localised labels.
  const UI = {
    en: {
      // Main menu
      menu_play:        '▶ INITIALIZE TESTS',
      menu_multi:       '▶ MULTI-FLOOR CHAMBERS ',
      menu_infinite:    '♾︎ PROCEDURAL CHAMBERS',
      menu_multi_infinite: '♾︎ PROCEDURAL MULTI-FLOOR CHAMBERS ',
      menu_editor:      '⬡ LEVEL EDITOR',
      menu_settings:    '⚙ SETTINGS',
      menu_chambers:    'LOADED CHAMBERS:',
      // Level select
      ls_title:         'SELECT TEST CHAMBER',
      ls_start_first:   '▶ START FROM CHAMBER 01',
      // Settings
      settings_title:   '⚙ APERTURE SETTINGS',
      settings_audio:   'AUDIO EFFECTS',
      settings_tts:     'AMICA VOICE (TTS)',
      settings_dialogue:'DIALOGUE PANEL',
      settings_minimap: 'MINIMAP',
      settings_shadows: 'SHADOWS',
      settings_lang:    'LANGUAGE',
      settings_theme:   'VISUAL THEME',
      // Controls
      ctrl_move:        'MOVE',
      ctrl_aim:         'AIM (no move)',
      ctrl_portal_a:    'PORTAL A (BLUE)',
      ctrl_portal_b:    'PORTAL B (ORANGE)',
      ctrl_dialogue:    'ADVANCE DIALOGUE',
      ctrl_map:         'TOGGLE MINIMAP',
      ctrl_retry:       'RESTART CHAMBER',
      ctrl_menu:        'MENU',
      // HUD
      hud_steps:        'STEPS',
      hud_loading:      'CHAMBER LOADING…',
      hud_access:       'ACCESS GRANTED',
      hud_portal_a:     '◉ A',
      hud_portal_b:     '◉ B',
      // Win/Fail
      win_title:        'TEST COMPLETE',
      win_subtitle:     'Chamber protocol satisfied.',
      win_steps:        'STEPS',
      win_bombs:        'BOMBS USED',
      win_next:         'NEXT CHAMBER ▶',
      win_menu:         '◂ MAIN MENU',
      fail_title:       'TEST FAILED',
      fail_retry:       '↺ RETRY CHAMBER',
      fail_menu:        '◂ MAIN MENU',
      // Editor
      editor_tools:     'TOOLS',
      editor_tiles:     'TILES',
      editor_grid:      'GRID SIZE',
      editor_laser_dir: 'LASER DIR',
      editor_file:      'FILE',
      editor_test:      '▶ TEST',
      editor_export:    '↓ EXPORT JSON',
      editor_import:    '↑ IMPORT JSON',
      editor_clear:     '⌫ CLEAR',
      editor_close:     '✕ CLOSE',
      editor_ready:     'Ready — select a tile and paint on the grid',
      // Themes
      theme_dark:       'INDUSTRIAL DARK',
      theme_lab:        'APERTURE LAB',
      theme_neon:       'NEON TOXIC',
    },

    it: {
      // Menu principale
      menu_play:        '▶ AVVIA TESTS',
      menu_multi:       '▶ CAMERE MULTI-PIANO',
      menu_infinite:    '♾︎ CAMERE PROCEDURALI',
      menu_multi_infinite: '♾︎ CAMERE MULTI-PIANO PROCEDURALI',
      menu_editor:      '⬡ EDITOR LIVELLI',
      menu_settings:    '⚙ IMPOSTAZIONI',
      menu_chambers:    'CAMERE CARICATE:',
      // Selezione livello
      ls_title:         'SELEZIONA CAMERA DI TEST',
      ls_start_first:   '▶ INIZIA DALLA CAMERA 01',
      // Impostazioni
      settings_title:   '⚙ IMPOSTAZIONI APERTURE',
      settings_audio:   'EFFETTI AUDIO',
      settings_tts:     'VOCE AMICA (TTS)',
      settings_dialogue:'PANNELLO DIALOGO',
      settings_minimap: 'MINIMAPPA',
      settings_shadows: 'OMBRE',
      settings_lang:    'LINGUA',
      settings_theme:   'TEMA VISIVO',
      // Controlli
      ctrl_move:        'MOVIMENTO',
      ctrl_aim:         'MIRA (fermo)',
      ctrl_portal_a:    'PORTALE A (BLU)',
      ctrl_portal_b:    'PORTALE B (ARANCIO)',
      ctrl_dialogue:    'AVANZA DIALOGO',
      ctrl_map:         'MINIMAPPA',
      ctrl_retry:       'RIAVVIA CAMERA',
      ctrl_menu:        'MENU',
      // HUD
      hud_steps:        'PASSI',
      hud_loading:      'CARICAMENTO CAMERA…',
      hud_access:       'ACCESSO CONSENTITO',
      hud_portal_a:     '◉ A',
      hud_portal_b:     '◉ B',
      // Vittoria/Sconfitta
      win_title:        'TEST COMPLETATO',
      win_subtitle:     'Protocollo camera soddisfatto.',
      win_steps:        'PASSI',
      win_bombs:        'BOMBE USATE',
      win_next:         'CAMERA SUCCESSIVA ▶',
      win_menu:         '◂ MENU PRINCIPALE',
      fail_title:       'TEST FALLITO',
      fail_retry:       '↺ RIPROVA CAMERA',
      fail_menu:        '◂ MENU PRINCIPALE',
      // Editor
      editor_tools:     'STRUMENTI',
      editor_tiles:     'MATTONI',
      editor_grid:      'DIMENSIONE GRIGLIA',
      editor_laser_dir: 'DIR. LASER',
      editor_file:      'FILE',
      editor_test:      '▶ TEST',
      editor_export:    '↓ ESPORTA JSON',
      editor_import:    '↑ IMPORTA JSON',
      editor_clear:     '⌫ CANCELLA',
      editor_close:     '✕ CHIUDI',
      editor_ready:     'Pronto — seleziona una tile e dipingi sulla griglia',
      // Temi
      theme_dark:       'INDUSTRIALE SCURO',
      theme_lab:        'LABORATORIO APERTURE',
      theme_neon:       'NEON TOSSICO',
    },
  };

  // ── AMICA voiced lines ───────────────────────────────────
  const AMICA_LINES = {
    en: {
      welcome:        "Welcome back. I'm happy. Genuinely. Don't look into that.",
      portal_first:   "You've discovered bombs. Please try not to get stuck in one.",
      portal_both:    "Both bombs placed. You are now thinking with bombs. Statistically, this ends badly.",
      button_pressed: "Button activated. The machine acknowledges your contribution. It's not impressed.",
      door_open:      "Door opened. Walk through it. That is what doors are for.",
      cube_pushed:    "The cube cannot speak. But if it could, it would probably say nothing useful.",
      cube_on_button: "The cube is on the button. This is the smartest thing you've done today.",
      movable_on_button: "The block is on the button. This is the smartest thing you've done today.",
      hazard_warning: "I would advise against touching the hazard. Medically speaking.",
      teleport:       "Portal traversal complete. All your molecules arrived. Most of them.",
      win_generic:    "Another chamber cleared. I'm running out of ways to express my indifference.",
      fail_hazard:    "You stepped into the hazard. The science was fascinating. You are less fascinating.",
      fail_generic:   "Failure recorded. This is not your fault. It is entirely your fault.",
      laser_active:   "Laser beam activated. Please don't stare directly at it. I need your eyes for testing.",
      laser_received: "Target receiver activated. Excellent. The machine is pleased. I am not the machine.",
      all_done:       "All test chambers complete. I hope you're proud of yourself. I'm certainly not proud of you.",
    },
    it: {
      welcome:        "Bentornato. Sono felice. Davvero. Non investigare su questo.",
      portal_first:   "Hai scoperto le bombe. Cerca di non rimanere seduto su una di esse.",
      portal_both:    "Bomba piazzata. Stai pensando alle bombe. Statisticamente, finirà male.",
      button_pressed: "Pulsante attivato. La macchina riconosce il tuo contributo. Non è impressionata.",
      door_open:      "Porta aperta. Attraversala. È per questo che esiste.",
      cube_pushed:    "Il cubo non può parlare. Ma se potesse, probabilmente non direbbe nulla di utile.",
      cube_on_button: "Il cubo è sul pulsante. Questa è la cosa più intelligente che hai fatto oggi.",
      movable_on_button: "Il blocco è sul pulsante. Questa è la cosa più intelligente che hai fatto oggi.",
      hazard_warning: "Ti sconsiglio di toccare il pericolo. Medicalmente parlando.",
      teleport:       "Attraversamento portale completato. Tutte le tue molecole sono arrivate. Quasi tutte.",
      win_generic:    "Un'altra camera completata. Sto esaurendo i modi per esprimere la mia indifferenza.",
      fail_hazard:    "Sei entrato nella zona pericolosa. La scienza era affascinante. Tu lo sei meno.",
      fail_generic:   "Fallimento registrato. Non è colpa tua. È interamente colpa tua.",
      laser_active:   "Raggio laser attivato. Non guardarlo direttamente. Ho bisogno dei tuoi occhi per i test.",
      laser_received: "Ricevitore attivato. Eccellente. La macchina è soddisfatta. Io non sono la macchina.",
      all_done:       "Tutte le camere completate. Spero che tu sia orgoglioso. Io certamente non lo sono.",
    },
  };

  // ── Public API ────────────────────────────────────────────

  /** Get a translated UI string. Falls back to English if key missing. */
  function t(key) {
    return (UI[_lang] && UI[_lang][key]) || UI.en[key] || key;
  }

  /** Switch active language and notify all subscribers. */
  function setLang(code) {
    if (!UI[code]) { console.warn(`[I18n] Unknown language: ${code}`); return; }
    _lang = code;
    EventBus.emit('i18n:changed', { lang: code });
    // Persist to localStorage if available
    try { localStorage.setItem('portal_iso_lang', code); } catch(_) {}
  }

  /** Restore saved language preference on startup. */
  function loadSaved() {
    try {
      const saved = localStorage.getItem('portal_iso_lang');
      if (saved && UI[saved]) _lang = saved;
    } catch(_) {}
  }

  function getLang()    { return _lang; }
  function getTTSLang() { return TTS_LANG[_lang] || 'en-US'; }

  /** Returns the AMICA LINES map for current language. */
  function getAmicaLines() {
    return AMICA_LINES[_lang] || AMICA_LINES.en;
  }

  /** Returns the full SCRIPTS map for current language. */
  function getScripts(levelId) {
    return SCRIPTS[_lang] || SCRIPTS.en;
  }

  /** Extract localized test from an object (es level.name) */
  function getLocalized(obj) {
    if (!obj) return "";
    if (typeof obj === 'string') return obj;
    if (Array.isArray(obj)) return obj;
    return obj[_lang] || obj['en'] || "";
  }

  /** Returns the full per-level SCRIPTS map for current language. */
  function getLevelScripts(levelId) {
    const fullScript = DIALOGUE_SCRIPTS ? DIALOGUE_SCRIPTS[levelId] : null;
    if (!fullScript) return null;

    if (fullScript.en || fullScript.it) {
      return fullScript[_lang] || fullScript.en;
    }
    // Legacy mode - return as-is if it's a simple array
    return fullScript;
  }

  /** Returns the full per-level WIN SCRIPTS lines for current language. */
  function getLevelWinScripts(levelId) {
    // return SCRIPTS[_lang] || SCRIPTS.en;
    const fullScript = DIALOGUE_SCRIPTS ? DIALOGUE_SCRIPTS[levelId] : null;
    if (!fullScript) return null;

    if (fullScript.win?.lines.en || fullScript.win?.lines.it) {
      return fullScript.win?.lines[_lang] || fullScript.win?.lines.en;
    }
    // Not present
    return null;
  }

  /** List of supported languages for the UI picker. */
  const SUPPORTED = [
    { code: 'en', label: 'ENGLISH' },
    { code: 'it', label: 'ITALIANO' },
  ];

  return { t, setLang, getLang, getTTSLang, loadSaved, getAmicaLines, getScripts, getLocalized, getLevelScripts, getLevelWinScripts, SUPPORTED };
})();
