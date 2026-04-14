// ============================================================
// uiManager.js — Overlay management, HUD, and settings
//
// All user-facing strings are now read from I18n.t().
// Language and theme changes trigger a full UI relabel pass.
// ============================================================

const UIManager = (() => {

  let _hintTimer = null;
  let _fromEditor = false;

  // ── Overlay helpers ───────────────────────────────────────

  /** Hide every overlay, then make the target one visible (exclusive). */
  function _show(id) {
    document.querySelectorAll('.overlay').forEach(el => {
      el.classList.add('hidden');
      el.classList.remove('active');
    });
    const el = document.getElementById(id);
    if (el) { el.classList.remove('hidden'); el.classList.add('active'); }
  }

  /** Show one panel on top without hiding others (for settings / level-select). */
  function _showPanel(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('hidden'); el.classList.add('active'); }
  }

  function _hide(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('hidden'); el.classList.remove('active'); }
  }

  // ── Screen transitions ─────────────────────────────────────

  function showMainMenu() {
    _show('main-menu');
    document.getElementById('btn-menu-from-game')?.classList.remove('cam-visible');
    document.getElementById('btn-editor-from-game')?.classList.remove('cam-visible');
    document.getElementById('btn-fullscreen')?.classList.remove('cam-visible');
    document.getElementById('btn-orbit')?.classList.remove('cam-visible');
    document.getElementById('btn-enter-ar')?.classList.remove('cam-visible');
    document.getElementById('hud').classList.add('hidden');
    Minimap.setVisible(false);
    DialoguePanel?.clear();
    document.body.classList.remove('dialogue-open');
    _showTouchControls(false);
    _relabel();   // Refresh all text with current language
  }

  function showGame(fromEditor = false) {
    ['main-menu','win-overlay','fail-overlay','editor-overlay',
     'settings-overlay','level-select-overlay'].forEach(id => _hide(id));
    document.getElementById('hud').classList.remove('hidden');
    Minimap.setVisible(true);
    const id = fromEditor ? 'btn-editor-from-game' : 'btn-menu-from-game' ;
    document.getElementById(id)?.classList.add('cam-visible');
    document.getElementById('btn-fullscreen')?.classList.add('cam-visible');
    document.getElementById('btn-orbit')?.classList.add('cam-visible');
    // Show AR button only if AR is supported
    if (typeof ARManager !== 'undefined' && ARManager.isReady?.()) {
      document.getElementById('btn-enter-ar')?.classList.add('cam-visible');
    }
    // Show touch D-pad when on a touch device and outside AR
    if (_isTouchDevice()) _showTouchControls(true);
    // Save starting state
    _fromEditor = fromEditor;
  }

  function showWin({ steps, bombs, isLast }) {
    DialoguePanel?.clear();
    document.getElementById('btn-menu-from-game')?.classList.remove('cam-visible');
    document.getElementById('btn-editor-from-game')?.classList.remove('cam-visible');
    document.getElementById('btn-fullscreen')?.classList.remove('cam-visible');
    document.getElementById('btn-orbit')?.classList.remove('cam-visible');
    document.getElementById('btn-enter-ar')?.classList.remove('cam-visible');
    
    // In AR: show toast inside ar-dom-overlay instead of blocking overlay
    if (typeof ARManager !== 'undefined' && ARManager.isActive?.()) {
      const toast = document.getElementById('ar-win-toast');
      const stats = document.getElementById('ar-win-stats');
      const next  = document.getElementById('ar-win-next');
      if (toast) {
        if (stats) stats.textContent = `STEPS: ${steps}  ·  BOMBS: ${bombs}`;
        if (next)  next.style.display = isLast ? 'none' : '';
        toast.style.display = 'flex';
      }
      if (!_isTouchDevice()) ARManager.show3DWin?.();
      return;
    }
    
    document.getElementById('btn-back-editor-win')?.style.setProperty('display', _fromEditor ? 'block' : 'none');
    Minimap.setVisible(false);
    _showTouchControls(false);
    
    document.getElementById('win-steps').textContent   = steps;
    document.getElementById('win-bombs').textContent = bombs;
    const nextBtn = document.getElementById('btn-next-level');
    if (nextBtn) nextBtn.style.display = isLast ? 'none' : '';
    
    _show('win-overlay');
  }

  function showFail(message) {
    DialoguePanel?.clear();
    document.getElementById('fail-message').textContent = message;
    document.getElementById('btn-menu-from-game')?.classList.remove('cam-visible');
    document.getElementById('btn-editor-from-game')?.classList.remove('cam-visible');
    document.getElementById('btn-fullscreen')?.classList.remove('cam-visible');
    document.getElementById('btn-orbit')?.classList.remove('cam-visible');
    document.getElementById('btn-enter-ar')?.classList.remove('cam-visible');
    
    if (typeof ARManager !== 'undefined' && ARManager.isActive?.()) {
      const toast = document.getElementById('ar-fail-toast');
      if (toast) {
        toast.style.display = 'flex';
      }
      if (!_isTouchDevice()) ARManager.show3DFail?.();
      return;
    }
    
    document.getElementById('btn-back-editor-fail')?.style.setProperty('display', _fromEditor ? 'block' : 'none');
    Minimap.setVisible(false);
    _showTouchControls(false);

    _show('fail-overlay');
  }

  function showEditor() {
    _show('editor-overlay');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('btn-menu-from-game')?.classList.remove('cam-visible');
    document.getElementById('btn-editor-from-game')?.classList.remove('cam-visible');
    document.getElementById('btn-fullscreen')?.classList.remove('cam-visible');
    document.getElementById('btn-orbit')?.classList.remove('cam-visible');
    document.getElementById('btn-enter-ar')?.classList.remove('cam-visible');
    _showTouchControls(false);
    Minimap.setVisible(false);
    LevelEditor.init();
  }

  // ── HUD ───────────────────────────────────────────────────

  function showHint(msg, duration = 3000) {
    const el = document.getElementById('hud-hint');
    if (!el) return;
    if (_hintTimer) clearTimeout(_hintTimer);
    el.textContent = msg;
    el.classList.add('visible');
    _hintTimer = setTimeout(() => el.classList.remove('visible'), duration);
  }

  function portalFlash(colorHex = '#0099ff') {
    const flash = document.createElement('div');
    Object.assign(flash.style, {
      position: 'fixed', inset: '0',
      background: colorHex, opacity: '0.15',
      pointerEvents: 'none', zIndex: '200',
      transition: 'opacity 0.4s ease',
    });
    document.body.appendChild(flash);
    requestAnimationFrame(() => {
      flash.style.opacity = '0';
      setTimeout(() => flash.remove(), 420);
    });
  }

  // ── Level select ──────────────────────────────────────────

  function _buildLevelSelect() {
    const container = document.getElementById('level-select-grid');
    if (!container) return;
    container.innerHTML = '';

    LEVELS.forEach((level, idx) => {
      const btn = document.createElement('button');
      btn.className = 'level-select-btn menu-btn';
      const [, title] = I18n.getLocalized(level.name).split('—');
      btn.innerHTML =
        `<span class="ls-num">${String(level.id).padStart(2,'0')}</span>` +
        `<span class="ls-name">${(title || I18n.getLocalized(level.name)).trim()}</span>`;
      btn.addEventListener('click', () => {
        _hide('level-select-overlay');
        EventBus.emit('game:start', idx);
      });
      container.appendChild(btn);
    });
  }

  // ── Full UI relabel (called on language change) ───────────

  /**
   * Update every static text node in the DOM that carries a data-i18n attribute.
   * Elements in index.html are tagged with data-i18n="key" for easy targeting.
   */
  function _relabel() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      el.textContent = I18n.t(key);
    });
  }

  // ── Settings panel ────────────────────────────────────────

  function _buildLanguagePicker() {
    const row = document.getElementById('lang-picker-row');
    if (!row) return;
    row.innerHTML = '';
    I18n.SUPPORTED.forEach(({ code, label }) => {
      const btn = document.createElement('button');
      btn.className = 'theme-btn' + (I18n.getLang() === code ? ' active' : '');
      btn.textContent = label;
      btn.dataset.lang = code;
      btn.addEventListener('click', () => {
        I18n.setLang(code);
        // Refresh picker highlight
        row.querySelectorAll('.theme-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.lang === code)
        );
        _relabel();
        // Rebuild level select text if it's open
        _buildLevelSelect();
      });
      row.appendChild(btn);
    });
  }

  function _buildThemePicker() {
    const row = document.getElementById('theme-picker-row');
    if (!row) return;
    row.innerHTML = '';
    Themes.LIST.forEach(({ id, label }) => {
      const btn = document.createElement('button');
      btn.className = 'theme-btn' + (Themes.getCurrent() === id ? ' active' : '');
      btn.textContent = I18n.t(label);
      btn.dataset.theme = id;
      btn.addEventListener('click', () => {
        Themes.apply(id);
        row.querySelectorAll('.theme-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.theme === id)
        );
        // Rebuild Renderer scene with new tile colours (reload current level)
        EventBus.emit('theme:rebuild');
      });
      row.appendChild(btn);
    });
  }

  function _buildSchemePicker() {
    const row = document.getElementById('scheme-picker-row');
    if (!row) return;
    row.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const scheme = btn.dataset.scheme;
        // Apply to Player if active
        if (typeof Player !== 'undefined') Player.setScheme(scheme);
        // Persist
        try { localStorage.setItem('portal_iso_scheme', scheme); } catch(_) {}
        row.querySelectorAll('.theme-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.scheme === scheme)
        );
        _updateControlsLegend(scheme);
      });
    });
    // Restore saved scheme
    try {
      const saved = localStorage.getItem('portal_iso_scheme');
      if (saved) {
        row.querySelectorAll('.theme-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.scheme === saved)
        );
        if (typeof Player !== 'undefined') Player.setScheme(saved);
      }
    } catch(_) {}
  }

  function _updateControlsLegend(scheme) {
    const legend = document.querySelector('.controls-legend');
    if (!legend) return;
    if (scheme === 'tank') {
      legend.innerHTML =
        '<span>W/S: FWD/BACK</span><span>A/D: TURN</span>' +
        '<span>Q: PORTAL A</span><span>R: PORTAL B</span>' +
        '<span>SPACE: DIALOGUE</span><span>M: MAP</span><span>ESC: MENU</span>';
    } else {
      legend.innerHTML =
        '<span>WASD: MOVE</span><span>ZXCV: AIM</span>' +
        '<span>Q: PORTAL A</span><span>R: PORTAL B</span>' +
        '<span>SPACE: DIALOGUE</span><span>M: MAP</span><span>ESC: MENU</span>';
    }
  }

  function _bindSettings() {
    document.getElementById('toggle-audio')?.addEventListener('change', e => {
      AudioEngine.setEnabled(e.target.checked);
    });
    document.getElementById('toggle-tts')?.addEventListener('change', e => {
      AMICA.setEnabled(e.target.checked);
    });
    document.getElementById('toggle-dialogue')?.addEventListener('change', e => {
      DialoguePanel?.setEnabled(e.target.checked);
    });
    document.getElementById('toggle-minimap')?.addEventListener('change', e => {
      Minimap.setVisible(e.target.checked);
    });
    document.getElementById('toggle-shadows')?.addEventListener('change', e => {
      Renderer.setShadowsEnabled(e.target.checked);
    });
    document.getElementById('toggle-orbit')?.addEventListener('change', e => {
      const want = e.target.checked;
      const is   = Renderer.isOrbitUnlocked?.() ?? false;
      if (want !== is) {
        Renderer.toggleOrbit?.();
        document.getElementById('btn-orbit')?.classList.toggle('active', want);
      }
    });

    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      _hide('settings-overlay');
      // Restore correct background screen
      const anyVisible = ['win-overlay','fail-overlay','editor-overlay',
        'level-select-overlay'].some(id => {
        const el = document.getElementById(id);
        return el && !el.classList.contains('hidden');
      });
      const gameRunning = !document.getElementById('hud').classList.contains('hidden');
      if (!anyVisible && !gameRunning) _show('main-menu');
    });

    _buildSchemePicker();
    _buildLanguagePicker();
    _buildThemePicker();

    // Refresh theme picker labels on language change
    EventBus.on('i18n:changed', () => { _relabel(); _buildThemePicker(); });
  }

  // ── Button bindings ───────────────────────────────────────

  // ── Touch / fullscreen helpers ────────────────────────────

  function _isTouchDevice() {
    const isQuest  = /OculusBrowser|MetaQuest/i.test(navigator.userAgent || '');
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent || '') || (navigator.maxTouchPoints > 1);
    return !isQuest && isMobile;
  }

  function _showTouchControls(show) {
    const v = show ? 'flex' : 'none';
    const arrows  = document.getElementById('touch-dpad-arrows');
    const bombs = document.getElementById('touch-dpad-buttons');
    if (arrows)  arrows.style.display  = v;
    if (bombs) bombs.style.display = v;
  }

  function _setupFullscreen() {
    const btn = document.getElementById('btn-fullscreen');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    });
    document.addEventListener('fullscreenchange', () => {
      if (btn) btn.textContent = document.fullscreenElement ? '⛶' : '⛶';
    });
  }

  function bindButtons() {
    _setupFullscreen();

    // Menu button (visible during gameplay)
    // Orbit camera toggle (visible during gameplay)
    document.getElementById('btn-menu-from-game')?.addEventListener('click', () => {
      EventBus.emit('game:to-menu');
    });
    document.getElementById('btn-editor-from-game')?.addEventListener('click', () => {
      EventBus.emit('game:to-editor');
    });

    // Orbit camera toggle (visible during gameplay)
    document.getElementById('btn-orbit')?.addEventListener('click', () => {
      const unlocked = Renderer.toggleOrbit?.();
      document.getElementById('btn-orbit')?.classList.toggle('active', !!unlocked);
      // Keep settings checkbox in sync
      const cb = document.getElementById('toggle-orbit');
      if (cb) cb.checked = !!unlocked;
    });

    // Show camera buttons when game is active
    // Camera buttons shown when game panel is shown
    // shown via showGame() call

    // D-pad is shown/hidden per screen via showGame/showMainMenu/showEditor
    document.getElementById('btn-play')?.addEventListener('click', () => {
      _showPanel('level-select-overlay');
      _buildLevelSelect();
    });
    document.getElementById('btn-infinite')?.addEventListener('click', () => {
      EventBus.emit('game:infinite', { difficulty: 1 });
    });
    document.getElementById('btn-play-first')?.addEventListener('click', () => {
      _hide('level-select-overlay');
      EventBus.emit('game:start', 0);
    });
    document.getElementById('btn-close-level-select')?.addEventListener('click', () => {
      _hide('level-select-overlay');
    });
    document.getElementById('btn-editor')?.addEventListener('click', () => {
      EventBus.emit('editor:open');
    });
    document.getElementById('btn-settings')?.addEventListener('click', () => {
      _showPanel('settings-overlay');
    });

    document.getElementById('btn-next-level')?.addEventListener('click', () => {
      EventBus.emit('game:next-level');
    });
    document.getElementById('btn-back-editor-win')?.addEventListener('click', () => {
      EventBus.emit('game:to-editor');
    });
    document.getElementById('btn-menu-from-win')?.addEventListener('click', () => {
      EventBus.emit('game:to-menu');
    });
    document.getElementById('btn-retry')?.addEventListener('click', () => {
      EventBus.emit('game:retry');
    });
    document.getElementById('btn-back-editor-fail')?.addEventListener('click', () => {
      EventBus.emit('game:to-editor');
    });
    document.getElementById('btn-menu-from-fail')?.addEventListener('click', () => {
      EventBus.emit('game:to-menu');
    });

    _bindSettings();
    _relabel();  // Initial label pass
  }

  return {
    showMainMenu, showGame, showWin, showFail, showEditor,
    showHint, portalFlash, bindButtons,
  };
})();
