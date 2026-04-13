// ============================================================
// amica.js — AMICA dialogue system (i18n-aware)
// - Analytical Matrix for Interactive Computational Assessment -
//
// Reads lines from I18n.getAmicaLines() so voice lines switch
// language automatically when I18n.setLang() is called.
// TTS voice is selected by BCP-47 language tag from I18n.getTTSLang().
// ============================================================

const AMICA = (() => {
  let synth        = null;
  let enabled      = true;
  let ttsAvailable = false;

  let subtitleEl = null;
  let hideTimer  = null;

  const queue = [];
  let speaking = false;
  let _gen     = 0;   // Incremented on clear() to invalidate stale callbacks

  // ── Init ─────────────────────────────────────────────────

  function init() {
    ttsAvailable = 'speechSynthesis' in window;
    if (ttsAvailable) synth = window.speechSynthesis;

    // _buildSubtitleEl();

    // Re-render subtitle on language change (in case it's still showing)
    EventBus.on('i18n:changed', () => { /* subtitle is ephemeral; no action needed */ });
  }

  // function _buildSubtitleEl() {
  //   subtitleEl = document.createElement('div');
  //   subtitleEl.id = 'amica-subtitle';
  //   Object.assign(subtitleEl.style, {
  //     position:      'fixed',
  //     bottom:        '80px',
  //     left:          '50%',
  //     transform:     'translateX(-50%)',
  //     maxWidth:      '700px',
  //     padding:       '12px 24px',
  //     background:    'rgba(10,10,12,0.92)',
  //     border:        '1px solid rgba(255,106,0,0.4)',
  //     borderLeft:    '3px solid var(--portal-b, #ff6a00)',
  //     color:         'var(--text-primary, #e2e2ee)',
  //     fontFamily:    "'Share Tech Mono', monospace",
  //     fontSize:      '13px',
  //     lineHeight:    '1.6',
  //     letterSpacing: '0.5px',
  //     zIndex:        '80',
  //     opacity:       '0',
  //     transition:    'opacity 0.4s ease',
  //     pointerEvents: 'none',
  //     textAlign:     'center',
  //   });

  //   const nameTag = document.createElement('div');
  //   nameTag.textContent = 'AMICA';
  //   Object.assign(nameTag.style, {
  //     fontSize:     '10px',
  //     letterSpacing:'3px',
  //     color:        'var(--portal-b, #ff6a00)',
  //     marginBottom: '4px',
  //     textTransform:'uppercase',
  //   });
  //   subtitleEl.appendChild(nameTag);

  //   const textEl = document.createElement('div');
  //   textEl.id = 'amica-text';
  //   subtitleEl.appendChild(textEl);

  //   document.body.appendChild(subtitleEl);
  // }

  // ── Public API ────────────────────────────────────────────

  /**
   * Queue a text line for TTS + subtitle display.
   * @param {string} text  - Localised string (caller responsible for translation)
   * @param {number} delay - ms delay before speaking
   */
  function say(text, delay = 0) {
    clear();
    queue.push({ text, delay });
    if (!speaking) _processQueue();
  }

  /** Speak a keyed line from the current language's LINES map. */
  function sayLine(key, delay = 0) {
    clear();
    const lines = I18n.getAmicaLines();
    if (lines[key]) say(lines[key], delay);
  }

  /** Stop all queued speech and hide subtitle. */
  function clear() {
    _gen++;            // Invalidate all in-flight utterance callbacks
    queue.length = 0;
    speaking     = false;
    if (synth) {
      synth.cancel();  // Stops current speech
    }
    // _hideSubtitle();
  }

  function setEnabled(v) {
    enabled = v;
    if (!v) clear();
  }

  // ── Internal ──────────────────────────────────────────────

  function _processQueue() {
    if (!queue.length) { speaking = false; return; }
    speaking = true;
    const { text, delay } = queue.shift();
    const myGen = _gen;   // Capture generation at scheduling time

    setTimeout(() => {
      if (_gen !== myGen) return;   // clear() was called — abort this entry
      // _showSubtitle(text);
      if (ttsAvailable && enabled) {
        _speak(text, myGen);
      } else {
        const readTime = Math.max(2000, text.length * 55);
        setTimeout(() => {
          if (_gen !== myGen) return;
          // _hideSubtitle();
          _processQueue();
        }, readTime);
      }
    }, delay);
  }

  function _speak(text, gen) {
    if (!synth) return;
    synth.cancel();

    const utt   = new SpeechSynthesisUtterance(text);
    utt.lang    = I18n.getTTSLang();
    utt.rate    = 0.88;
    utt.pitch   = 0.72;
    utt.volume  = 0.9;

    const voices = synth.getVoices();
    const langTag = utt.lang.slice(0, 2).toLowerCase();
    let preferred = voices.find(v => v.lang.toLowerCase().startsWith(langTag));
    if (!preferred) {
      preferred = voices.find(v =>
        v.name.toLowerCase().includes('samantha') ||
        v.name.toLowerCase().includes('zira')     ||
        v.name.toLowerCase().includes('alice')    ||
        v.name.toLowerCase().includes('luca')
      );
    }
    if (preferred) utt.voice = preferred;

    utt.onend  = () => {
      if (_gen !== gen) return;  // Stale — level changed while speaking
      // _hideSubtitle();
      setTimeout(_processQueue, 400);
    };
    utt.onerror = () => {
      if (_gen !== gen) return;
      // _hideSubtitle();
      setTimeout(_processQueue, 400);
    };

    synth.speak(utt);
  }

  // function _showSubtitle(text) {
  //   if (!subtitleEl) return;
  //   // Suppress if DialoguePanel is already displaying this content
  //   if (document.body.classList.contains('dialogue-open')) return;
  //   if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  //   const el = document.getElementById('amica-text');
  //   if (el) el.textContent = text;
  //   subtitleEl.style.opacity = '1';
  // }

  // function _hideSubtitle() {
  //   if (!subtitleEl) return;
  //   subtitleEl.style.opacity = '0';
  // }

  return { init, say, sayLine, clear, setEnabled };
})();
