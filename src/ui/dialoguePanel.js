// ============================================================
// dialoguePanel.js — RPG-style bottom dialogue panel
//
// Inspired by Pokémon / Final Fantasy dialogue boxes.
// Features:
//   - Slides up from the bottom of the screen
//   - Animated AMICA eye avatar (SVG, CSS-only animation)
//   - Typewriter text effect with configurable speed
//   - Multi-page support: SPACE or click advances to next line
//   - Speaker system: different names / colours per character
//   - Queue support: enqueue() adds without interrupting current
//   - Fires 'dialogue:done' on EventBus when sequence completes
//
// Public API:
//   DialoguePanel.show({ speaker, lines, onDone })
//   DialoguePanel.enqueue({ speaker, lines, onDone })
//   DialoguePanel.clear()
//   DialoguePanel.setEnabled(bool)
// ============================================================

const DialoguePanel = (() => {

  // ── Config ────────────────────────────────────────────────

  const CHAR_DELAY = 26; // ms between characters while typing

  /** Speaker definitions — extend here to add new characters. */
  const SPEAKERS = {
    amica: {
      label:       'AMICA',
      accentColor: '#ff6a00',
      eyePulse:    true,
    },
    aperture: {
      label:       'APERTURE SCIENCE',
      accentColor: '#aaaacc',
      eyePulse:    false,
    },
    system: {
      label:       'SYSTEM',
      accentColor: '#0099ff',
      eyePulse:    false,
    },
  };

  // ── State ─────────────────────────────────────────────────

  let _panel     = null;   // Root DOM node
  let _textEl    = null;   // <span> that receives typewriter text
  let _nameEl    = null;   // Speaker name label
  let _promptEl  = null;   // "▼ SPACE" advance indicator
  let _eyeSvg    = null;   // SVG eye element

  let _queue     = [];     // Pending dialogue entries
  let _current   = null;   // Active entry { speaker, lines, onDone }
  let _lineIdx   = 0;      // Which line of current entry is showing
  let _typeTimer = null;   // setInterval handle for typewriter
  let _charIdx   = 0;      // Characters revealed so far
  let _isTyping  = false;  // True while typewriter is running
  let _visible   = false;  // True while panel is on screen
  let _enabled   = true;   // Global enable flag

  // ── Initialization ────────────────────────────────────────

  function init() {
    _buildDOM();
    _bindKeys();

    // Listen for imperative show requests via EventBus
    EventBus.on('dialogue:show', opts => show(opts));
    EventBus.on('dialogue:clear', clear);

    // Auto-clear when game resets
    EventBus.on('game:to-menu', clear);
    EventBus.on('game:pause',   clear);
  }

  // ── DOM Construction ──────────────────────────────────────

  function _buildDOM() {
    _panel = document.createElement('div');
    _panel.id = 'dialogue-panel';

    // ── Left: Avatar ───────────────────────────────────────
    const avatarCol = document.createElement('div');
    avatarCol.className = 'dlg-avatar';

    // SVG eye — all animation done in dialogue.css
    avatarCol.innerHTML = `
      <div class="dlg-avatar-frame">
        <svg class="dlg-eye-svg" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
          <circle class="eye-ring-outer" cx="40" cy="40" r="36" fill="none" stroke-width="2"/>
          <circle class="eye-ring-mid"   cx="40" cy="40" r="26" fill="none" stroke-width="1.5"/>
          
          <circle class="eye-pupil"      cx="40" cy="40" r="7"/>
          <circle class="eye-core"       cx="40" cy="40" r="3"/>
          <g class="eye-ticks">
            <line x1="40" y1="4"    x2="40" y2="11"/>
            <line x1="40" y1="69"   x2="40" y2="76"/>
            <line x1="4"  y1="40"   x2="11" y2="40"/>
            <line x1="69" y1="40"   x2="76" y2="40"/>
            <line x1="15" y1="15"   x2="20" y2="20"/>
            <line x1="60" y1="60"   x2="65" y2="65"/>
            <line x1="65" y1="15"   x2="60" y2="20"/>
            <line x1="15" y1="65"   x2="20" y2="60"/>
          </g>
          <circle class="eye-spin" cx="40" cy="40" r="36"
                  fill="none" stroke-width="1"
                  stroke-dasharray="22 204"/>
        </svg>
        <div class="dlg-speaker-name" id="dlg-speaker-name">AMICA</div>
      </div>`;

    _eyeSvg = avatarCol.querySelector('.dlg-eye-svg');
    _nameEl = avatarCol.querySelector('#dlg-speaker-name');
    _panel.appendChild(avatarCol);

    // ── Right: Text ────────────────────────────────────────
    const textCol = document.createElement('div');
    textCol.className = 'dlg-text-wrap';

    // Decorative corner brackets
    textCol.innerHTML = `
      <div class="dlg-corner dlg-corner-tl"></div>
      <div class="dlg-corner dlg-corner-tr"></div>
      <div class="dlg-corner dlg-corner-bl"></div>
      <div class="dlg-corner dlg-corner-br"></div>
      <div class="dlg-text-inner">
        <span id="dlg-text"></span><span class="dlg-cursor">█</span>
      </div>`;

    _textEl   = textCol.querySelector('#dlg-text');
    _promptEl = document.createElement('div');
    _promptEl.className = 'dlg-prompt';
    _promptEl.textContent = '▼ SPACE';
    textCol.appendChild(_promptEl);

    _panel.appendChild(textCol);
    document.body.appendChild(_panel);
  }

  // ── Input Handling ────────────────────────────────────────

  function _bindKeys() {
    window.addEventListener('keydown', e => {
      if (!_visible) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        _advance();
      }
    });
    _panel.addEventListener('click', () => { if (_visible) _advance(); });
  }

  // ── Public API ────────────────────────────────────────────

  /**
   * Show a dialogue sequence immediately (interrupts current if any).
   * @param {object}   opts
   * @param {string}   opts.speaker  - Key from SPEAKERS (default: 'amica')
   * @param {string[]} opts.lines    - Array of text strings (one page each)
   * @param {Function} [opts.onDone] - Called after last line is dismissed
   */
  function show({ speaker = 'amica', lines = [], onDone = null } = {}) {
    if (!_enabled || !lines.length) { onDone?.(); return; }
    _queue = [{ speaker, lines, onDone }]; // Replace queue
    _startNext();
  }

  /**
   * Add a dialogue entry to the end of the queue without interrupting.
   */
  function enqueue({ speaker = 'amica', lines = [], onDone = null } = {}) {
    if (!_enabled || !lines.length) { onDone?.(); return; }
    _queue.push({ speaker, lines, onDone });
    if (!_visible) _startNext(); // Start immediately if idle
  }

  /** Hide panel and clear all queued dialogue. */
  function clear() {
    _stopTypewriter();
    _queue   = [];
    _current = null;
    _hide();
  }

  /** Enable or disable the dialogue panel globally. */
  function setEnabled(v) {
    _enabled = v;
    if (!v) clear();
  }

  // ── Internal Flow ─────────────────────────────────────────

  function _startNext() {
    if (!_queue.length) { _hide(); return; }
    _current  = _queue.shift();
    _lineIdx  = 0;
    _applySpeaker(_current.speaker);
    _showPanel();
    _typeLine(_current.lines[_lineIdx]);
  }

  /**
   * Advance:
   *   - If still typing → reveal full line immediately
   *   - If done typing  → next line, or close if last line
   */
  function _advance() {
    if (_isTyping) {
      // Skip to end of current line
      _stopTypewriter();
      _textEl.textContent = _current.lines[_lineIdx];
      _isTyping = false;
      _showPrompt(true);
    } else {
      _lineIdx++;
      if (_lineIdx < _current.lines.length) {
        _typeLine(_current.lines[_lineIdx]);
      } else {
        _current.onDone?.();
        EventBus.emit('dialogue:done', { speaker: _current.speaker });
        _startNext();
      }
    }
  }

  // ── Typewriter ────────────────────────────────────────────

  function _typeLine(text) {
    _stopTypewriter();
    _textEl.textContent = '';
    _charIdx  = 0;
    _isTyping = true;
    _showPrompt(false);

    _typeTimer = setInterval(() => {
      _charIdx++;
      _textEl.textContent = text.slice(0, _charIdx);

      if (_charIdx >= text.length) {
        _stopTypewriter();
        _isTyping = false;
        _showPrompt(true);
      }
    }, CHAR_DELAY);
  }

  function _stopTypewriter() {
    if (_typeTimer) { clearInterval(_typeTimer); _typeTimer = null; }
  }

  // ── Panel Show / Hide ─────────────────────────────────────

  function _showPanel() {
    if (_visible) return;
    _visible = true;
    _panel.classList.add('visible');
    _eyeSvg?.classList.add('active');
    document.body.classList.add('dialogue-open');
  }

  function _hide() {
    if (!_visible) return;
    _visible = false;
    _panel.classList.remove('visible');
    _eyeSvg?.classList.remove('active');
    document.body.classList.remove('dialogue-open');
    if (_textEl) _textEl.textContent = '';
  }

  function _showPrompt(show) {
    _promptEl?.classList.toggle('visible', show);
  }

  // ── Speaker Styling ───────────────────────────────────────

  function _applySpeaker(key) {
    const cfg = SPEAKERS[key] || SPEAKERS.amica;

    // Name label
    if (_nameEl) {
      _nameEl.textContent = cfg.label;
      _nameEl.style.color = cfg.accentColor;
    }

    // CSS accent variable drives border and corner colours
    _panel?.style.setProperty('--dlg-accent', cfg.accentColor);

    // Recolour SVG eye elements
    const stroked = _panel?.querySelectorAll(
      '.eye-ring-outer,.eye-ring-mid,.eye-spin,.eye-ticks line'
    );
    stroked?.forEach(el => { el.style.stroke = cfg.accentColor; });

    const pupil = _panel?.querySelector('.eye-pupil');
    if (pupil) pupil.style.fill = cfg.accentColor;

    // Pulse animation class
    _eyeSvg?.classList.toggle('pulse', !!cfg.eyePulse);
  }

  // ── Expose ────────────────────────────────────────────────

  return { init, show, enqueue, clear, setEnabled };
})();
