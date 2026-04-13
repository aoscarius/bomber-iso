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
      win_portals:      'PORTALS USED',
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
      win_portals:      'PORTALI USATI',
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
      portal_first:   "You've discovered portals. Please try not to get stuck in one.",
      portal_both:    "Both portals placed. You are now thinking with portals. Statistically, this ends badly.",
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
      portal_first:   "Hai scoperto i portali. Cerca di non rimanere intrappolato in uno.",
      portal_both:    "Entrambi i portali piazzati. Stai pensando con i portali. Statisticamente, finirà male.",
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

  // ── Per-level dialogue scripts ────────────────────────────
  const SCRIPTS = {
    en: {
      1: {
        intro: { speaker:'amica', lines:[
          "Good morning. I'm AMICA, your personal assistant. You have been in stasis for an indeterminate period.",
          "This is Test Chamber 01. Your objective: reach the green exit tile.",
          "Use WASD or arrow keys to move. I trust you can handle that.",
        ]},
        stepCues:[
          { steps:1,  lines:["You can walk. This exceeds the baseline expectation."] },
          { steps:4,  lines:["Progress noted. The exit is nearby.", "I'm watching. Not judgementally. Well — mostly not judgementally."] },
        ],
      },
      2: {
        intro: { speaker:'amica', lines:[
          "Welcome to Chamber 02. Today we introduce the portal device.",
          "Press Z X C V to aim without moving. Q places Portal A (blue), R places Portal B (orange).",
          "The glowing teal walls accept portals. Face them and press Q or R.",
          "Place one portal on the left wall, one on the right, then walk into either one.",
        ]},
        stepCues:[
          { steps:3, lines:["You've been walking without placing portals.", "The walls with the teal wireframe outline — those are portal surfaces."] },
        ],
        events:{
          'portal:placed':{ condition:()=>true, lines:["Portal placed. Now place the second on a different wall, then walk through."], once:true },
          'portal:miss':  { condition:()=>true, lines:["That surface does not accept portals. Target only the glowing teal walls."], once:true },
          'portal:used':  { condition:()=>true, lines:["Traversal complete. Your molecules arrived intact. Statistically fortunate."], once:true },
        },
      },
      3: {
        intro: { speaker:'amica', lines:[
          "Chamber 03 introduces pressure plates.",
          "The yellow disc is a pressure plate. Stand on it to activate the linked door.",
          "The red slab is the door. Step — door opens — walk through — exit.",
          "This is not complicated. I mention this because it consistently proves to be.",
        ]},
        events:{
          'player:landed':{ condition:(d)=>{ try{ return Physics.getTile(d.x,d.z)===CONSTANTS.TILE.BUTTON; }catch(e){ return false; } },
            lines:["Button activated. Door is now open. Walk to the exit."], once:true },
        },
      },
      4: {
        intro: { speaker:'amica', lines:[
          "This is a Weighted Storage Cube. It is not your friend.",
          "Walk into it to push it. Push it onto the yellow pressure plate.",
          "The cube will hold the door open, allowing you to pass.",
          "Unlike you, the cube performs its function perfectly every time.",
        ]},
        stepCues:[
          { steps:6, lines:["Tip: you can only push the cube — not pull it.", "If stuck, press F1 to reset the chamber."] },
        ],
        events:{
          'cube:moved':{ condition:()=>true, lines:["Cube displaced. Continue positioning it toward the button."], once:true },
        },
      },
      5: {
        intro: { speaker:'amica', lines:[
          "The red tiles in this chamber are a hazard grid.",
          "Contact will result in immediate test termination.",
          "Use portals to teleport over the hazard zone. Portal walls flank it on both sides.",
          "Fire Portal A on the left wall, Portal B on the right. Walk through.",
        ]},
        stepCues:[
          { steps:2, lines:["Portal walls are the teal-outlined tiles on either side of the red hazard.", "Place one portal on each side, then walk through."] },
        ],
      },
      6: {
        intro: { speaker:'amica', lines:[
          "Chamber 06. The exit is locked. The button is unreachable by foot.",
          "You will need to use the portal network creatively.",
          "Left cluster reaches the button. Right cluster reaches the exit.",
          "I designed this test in forty-three seconds.",
        ]},
        stepCues:[
          { steps:5, lines:["The left portal cluster reaches the inner room with the button.", "Press it, and the center door will open. Then use the right cluster for the exit."] },
        ],
      },
      7: {
        intro: { speaker:'aperture', lines:["APERTURE SCIENCE SYSTEMS — NOTICE: HIGH-ENERGY LASER PROTOCOLS ACTIVE."] },
        introDelay:800,
        introContinue: { speaker:'amica', lines:[
          "That's a laser emitter. The red beam it fires is dangerous and extremely useful.",
          "The circular panel on the far wall is the receiver. Direct the laser into it to open the door.",
          "Use portals — place one where the beam enters, another where you want it to exit.",
          "The laser travels through the portal as if it were a window.",
        ]},
        events:{
          'laser:receiver-changed':{ condition:(d)=>d.active, lines:["Receiver activated. Door unlocked."], once:true },
          'portal:placed':{ condition:()=>true, lines:["Portal placed. If on the laser's path, the beam will now redirect through it."], once:true },
        },
      },
      8: {
        intro: { speaker:'amica', lines:[
          "Two cubes. Two buttons. Two doors. One exit. One of you.",
          "Each cube must be pushed onto its corresponding button to open a door.",
          "Both doors must be open simultaneously to access the exit.",
          "Think about the order. Once a cube is on a button, leave it there.",
        ]},
        stepCues:[
          { steps:8, lines:["If you've pushed a cube into an unrecoverable position, press F1 to restart.", "There is no shame in restarting. There is also no reward."] },
        ],
      },
      9: {
        intro: { speaker:'amica', lines:[
          "The laser emitter is at the far left. The receiver is behind a wall on the right.",
          "A direct shot is blocked. You must create a portal path for the beam.",
          "Place portals on the walls adjacent to the laser path to redirect it.",
          "Once the receiver activates, the door to the exit will open.",
        ]},
        stepCues:[
          { steps:4,  lines:["Look at the portal walls on either side of the blocked laser path.", "They're placed there deliberately. Everything in this facility is deliberate."] },
          { steps:10, lines:["You're still working on it. I appreciate the persistence.", "I appreciate it instrumentally. Not emotionally."] },
        ],
      },
      10: {
        intro: { speaker:'amica', lines:[
          "This is the final test chamber.",
          "It requires: portals, cube logistics, laser redirection, and hazard avoidance.",
          "All simultaneously.",
          "I want you to know I have genuinely enjoyed this experiment.",
          "The laser must reach its receiver. A cube must reach its button. Then — the exit.",
          "Good luck. I mean that in the statistical sense.",
        ]},
        stepCues:[
          { steps:3,  lines:["The red tiles are real hazards. Navigate around or through portals."] },
          { steps:12, lines:["You're doing better than expected.", "That's not a compliment. My expectations were very low."] },
          { steps:20, lines:["Still here. That itself is a data point worth recording.", "Press F1 for a fresh start if needed."] },
        ],
        events:{
          'laser:receiver-changed':{ condition:(d)=>d.active, lines:["Laser receiver active. One mechanism unlocked.", "The cube still needs its button. Do not celebrate yet."], once:true },
        },
      },
    },

    it: {
      1: {
        intro: { speaker:'amica', lines:[
          "Buongiorno. Io sono AMICA, il tuo assistente personale. Sei stato in stasi per un periodo indeterminato.",
          "Questa è la Camera di Test 01. Obiettivo: raggiungere la tile verde di uscita.",
          "Usa WASD o le frecce per muoverti. Sono abbastanza fiduciosa che tu riesca.",
        ]},
        stepCues:[
          { steps:1, lines:["Riesci a camminare. Supera le aspettative di base."] },
          { steps:4, lines:["Progresso registrato. L'uscita è vicina.", "Ti sto osservando. Non in modo giudicante. Quasi."] },
        ],
      },
      2: {
        intro: { speaker:'amica', lines:[
          "Benvenuto nella Camera 02. Oggi introduciamo il dispositivo portale.",
          "Premi Z X C V per ruotare senza muoverti. Q piazza il Portale A (blu), R il B (arancio).",
          "Le pareti turchese brillante accettano i portali. Giraci verso e premi Q o R.",
          "Piazza un portale sul muro sinistro, uno sul destro, poi cammina in uno qualsiasi.",
        ]},
        stepCues:[
          { steps:3, lines:["Hai camminato senza piazzare portali.", "Le pareti con il wireframe turchese — quelle sono le superfici portale."] },
        ],
        events:{
          'portal:placed':{ condition:()=>true, lines:["Portale piazzato. Ora metti il secondo su una parete diversa, poi attraversa."], once:true },
          'portal:miss':  { condition:()=>true, lines:["Quella superficie non accetta portali. Mira solo alle pareti turchese brillanti."], once:true },
          'portal:used':  { condition:()=>true, lines:["Attraversamento completato. Le tue molecole sono arrivate. Quasi tutte."], once:true },
        },
      },
      3: {
        intro: { speaker:'amica', lines:[
          "La Camera 03 introduce le piastre di pressione.",
          "Il disco giallo è una piastra. Cammina sopra per attivare la porta collegata.",
          "La lastra rossa è la porta. Piastra — porta si apre — attraversa — esci.",
          "Non è complicato. Lo dico perché di solito lo diventa.",
        ]},
        events:{
          'player:landed':{ condition:(d)=>{ try{ return Physics.getTile(d.x,d.z)===CONSTANTS.TILE.BUTTON; }catch(e){ return false; } },
            lines:["Pulsante attivato. La porta è ora aperta. Vai all'uscita."], once:true },
        },
      },
      4: {
        intro: { speaker:'amica', lines:[
          "Questo è un Cubo di Stoccaggio Pesato. Non è tuo amico.",
          "Cammina contro di esso per spingerlo. Spingilo sulla piastra gialla.",
          "Il cubo terrà aperta la porta, permettendoti di passare.",
          "A differenza tua, il cubo svolge la sua funzione perfettamente.",
        ]},
        stepCues:[
          { steps:6, lines:["Suggerimento: puoi solo spingere il cubo — non tirarlo.", "Se bloccato, premi F1 per ricominciare."] },
        ],
        events:{
          'cube:moved':{ condition:()=>true, lines:["Cubo spostato. Continua a posizionarlo verso il pulsante."], once:true },
        },
      },
      5: {
        intro: { speaker:'amica', lines:[
          "Le tile rosse in questa camera sono una griglia di pericolo.",
          "Il contatto comporta l'immediata terminazione del test.",
          "Usa i portali per teletrasportarti sopra la zona pericolosa.",
          "Piazza un portale su ogni lato del pericolo, poi attraversa.",
        ]},
        stepCues:[
          { steps:2, lines:["Le pareti portale sono quelle con il bordo turchese ai lati del pericolo rosso.", "Piazza un portale su ogni lato, poi attraversa."] },
        ],
      },
      6: {
        intro: { speaker:'amica', lines:[
          "Camera 06. L'uscita è bloccata. Il pulsante è irraggiungibile a piedi.",
          "Dovrai usare la rete portale in modo creativo.",
          "Il cluster di sinistra raggiunge il pulsante. Quello di destra l'uscita.",
          "Ho progettato questo test in quarantatré secondi.",
        ]},
        stepCues:[
          { steps:5, lines:["Il cluster portale di sinistra porta alla stanza con il pulsante.", "Premi il pulsante, e la porta centrale si aprirà. Poi usa quello di destra per l'uscita."] },
        ],
      },
      7: {
        intro: { speaker:'aperture', lines:["SISTEMI APERTURE SCIENCE — AVVISO: PROTOCOLLI LASER AD ALTA ENERGIA ATTIVI."] },
        introDelay:800,
        introContinue: { speaker:'amica', lines:[
          "Quello è un emettitore laser. Il raggio rosso è pericoloso e utilissimo.",
          "Il pannello circolare sulla parete lontana è il ricevitore. Dirigici il laser per aprire la porta.",
          "Usa i portali — metti uno dove entra il raggio, un altro dove vuoi che esca.",
          "Il laser attraversa il portale come se fosse una finestra.",
        ]},
        events:{
          'laser:receiver-changed':{ condition:(d)=>d.active, lines:["Ricevitore attivato. Porta sbloccata."], once:true },
          'portal:placed':{ condition:()=>true, lines:["Portale piazzato. Se è sul percorso del laser, il raggio ora lo attraverserà."], once:true },
        },
      },
      8: {
        intro: { speaker:'amica', lines:[
          "Due cubi. Due pulsanti. Due porte. Una uscita. Un solo te.",
          "Ogni cubo deve essere spinto sul suo pulsante per aprire una porta.",
          "Entrambe le porte devono essere aperte contemporaneamente per accedere all'uscita.",
          "Pensa all'ordine. Una volta che un cubo è sul pulsante, lascialo lì.",
        ]},
        stepCues:[
          { steps:8, lines:["Se hai spinto un cubo in una posizione irrecuperabile, premi F1 per ricominciare.", "Non c'è vergogna. Non c'è nemmeno ricompensa."] },
        ],
      },
      9: {
        intro: { speaker:'amica', lines:[
          "L'emettitore laser è all'estrema sinistra. Il ricevitore è dietro una parete a destra.",
          "Un tiro diretto è bloccato. Devi creare un percorso portale per il raggio.",
          "Piazza i portali sulle pareti adiacenti al percorso laser per reindirizzarlo.",
          "Una volta che il ricevitore si attiva, la porta dell'uscita si aprirà.",
        ]},
        stepCues:[
          { steps:4,  lines:["Guarda le pareti portale ai lati del percorso laser bloccato.", "Sono lì deliberatamente. Tutto in questa struttura è deliberato."] },
          { steps:10, lines:["Stai ancora lavorandoci. Apprezzo la tenacia.", "La apprezzo in senso strumentale. Non emotivo."] },
        ],
      },
      10: {
        intro: { speaker:'amica', lines:[
          "Questa è la camera di test finale.",
          "Richiede: portali, logistica cubi, reindirizzamento laser e schivata pericoli.",
          "Tutto contemporaneamente.",
          "Voglio che tu sappia che ho genuinamente apprezzato questo esperimento.",
          "Il laser deve raggiungere il ricevitore. Un cubo deve raggiungere il pulsante. Poi — l'uscita.",
          "Buona fortuna. Lo dico in senso statistico.",
        ]},
        stepCues:[
          { steps:3,  lines:["Le tile rosse sono veri pericoli. Aggirali o attraversali con i portali."] },
          { steps:12, lines:["Stai andando meglio del previsto.", "Non è un complimento. Le mie aspettative erano molto basse."] },
          { steps:20, lines:["Sei ancora qui. Questo è in sé un dato scientifico.", "Premi F1 per un nuovo tentativo se necessario."] },
        ],
        events:{
          'laser:receiver-changed':{ condition:(d)=>d.active, lines:["Ricevitore laser attivo. Un meccanismo sbloccato.", "Il cubo deve ancora raggiungere il suo pulsante. Non festeggiare ancora."], once:true },
        },
      },
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
