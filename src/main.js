// ============================================================
// main.js — Bomber ISO application entry point
//
// Based on porta-iso main.js.
// Removed: PortalGun, LaserSystem, LEVELS_MULTI, LevelGeneratorMulti,
//          portal/laser event routing, multi-floor buttons.
// Kept:    all AR init, splash, asset loading, settings,
//          editor, infinite mode, all EventBus routing.
// Added:   bomb:exploded screen flash.
// ============================================================

(async function () {

  // ── 1. Preferences ───────────────────────────────────────
  I18n.loadSaved();
  Themes.loadSaved();

  // ── 2. Core engine ────────────────────────────────────────
  const canvas = document.getElementById('game-canvas');
  Renderer.init(canvas);
  const scene = Renderer.getScene();
  Themes.apply(Themes.getCurrent());

  // ── Company intro splash (before loading) ─────────────
  await IntroSplash.show();

  // ── Splash + asset loading ────────────────────────────
  SplashScreen.show();

  try {
    await AssetLoader.load(scene, (loaded, total, path) => {
      SplashScreen.setProgress(loaded, total, path);
    });
  } catch (_) { /* missing models — procedural fallback */ }

  try {
    await LevelLoader.load((loaded, total, path) => {
      SplashScreen.setProgress(loaded, total, path);
      document.getElementById('chambers-cnt').innerText = loaded;
    });
  } catch (_) { /* skip */ }

  SplashScreen.hide();

  // ── 4. Subsystems ─────────────────────────────────────────
  ARManager.init(scene).catch(e => console.warn('[AR init]', e));
  Particles.init(scene);
  Minimap.init();
  AudioEngine.init();
  AMICA.init();
  DialoguePanel.init();

  // ── 5. UI ─────────────────────────────────────────────────
  UIManager.bindButtons();
  UIManager.showMainMenu();

  // Restore saved control scheme
  try {
    const saved = localStorage.getItem('bomber_iso_scheme');
    if (saved) Player.setScheme(saved);
  } catch(_) {}

  // Resume Web Audio on first gesture
  const _resumeAudio = () => AudioEngine.resume();
  document.addEventListener('click',   _resumeAudio, { once: true });
  document.addEventListener('keydown', _resumeAudio, { once: true });

  // ── 6. AR init ───────────────────────────────────────────
  _initAR();

  async function _initAR() {
    try {
      if (typeof ARManager === 'undefined') return;
      const supported = await ARManager.isSupported();
      const arBtn     = document.getElementById('ar-entry-btn');
      const arNoSupp  = document.getElementById('ar-not-supported');

      if (!supported) {
        if (arBtn)    arBtn.style.display = 'none';
        if (arNoSupp) arNoSupp.style.display = 'block';
        return;
      }

      arBtn?.classList.add('ar-available');

      document.getElementById('ar-entry-btn')?.addEventListener('click', () => {
        const arOv = document.getElementById('ar-overlay');
        if (arOv) { arOv.classList.remove('hidden'); arOv.style.display = 'flex'; }
        document.getElementById('main-menu')?.classList.add('hidden');
      });

      document.getElementById('ar-back-btn')?.addEventListener('click', () => {
        const arOvBack = document.getElementById('ar-overlay');
        if (arOvBack) { arOvBack.classList.add('hidden'); arOvBack.style.display = 'none'; }
        document.getElementById('main-menu')?.classList.remove('hidden');
      });

      document.getElementById('ar-start-btn')?.addEventListener('click', async () => {
        document.getElementById('ar-overlay')?.style.setProperty('display', 'none');
        await ARManager.enter(0);
      });

      // ar:entered: board is placed automatically 1m ahead — ar:rebuild-level
      // fires from arManager which triggers startFromLevel there. Nothing to do here.
      EventBus.on('ar:entered', () => { 
        UIManager.showGame(); 
      });

      document.getElementById('ar-btn-place')?.addEventListener('click',
        () => ARManager.placeBoardOnTap?.());
      document.getElementById('ar-btn-reset')?.addEventListener('click',
        () => ARManager.resetPlacement?.());
      document.getElementById('ar-btn-scale-up')?.addEventListener('click',
        () => ARManager.rescaleBoard?.(1.15));
      document.getElementById('ar-btn-scale-down')?.addEventListener('click',
        () => ARManager.rescaleBoard?.(0.87));
      document.getElementById('ar-btn-rot-left')?.addEventListener('click',
        () => ARManager.rotateBoard?.(-15));
      document.getElementById('ar-btn-rot-right')?.addEventListener('click',
        () => ARManager.rotateBoard?.(15));
      document.getElementById('ar-btn-exit')?.addEventListener('click',
        async () => ARManager.exit());
      document.getElementById('ar-btn-menu')?.addEventListener('click',
        () => EventBus.emit('ar:menu'));

      // AR pause menu buttons
      document.getElementById('ar-menu-resume')?.addEventListener('click', () => {
        document.getElementById('ar-menu-panel').style.display = 'none';
      });
      document.getElementById('ar-menu-retry')?.addEventListener('click', () => {
        document.getElementById('ar-menu-panel').style.display = 'none';
        GameLogic.retryLevel?.();
      });
      document.getElementById('ar-menu-reset')?.addEventListener('click', () => {
        document.getElementById('ar-menu-panel').style.display = 'none';
        ARManager.resetPlacement?.();
      });
      document.getElementById('ar-menu-exit')?.addEventListener('click', async () => {
        document.getElementById('ar-menu-panel').style.display = 'none';
        ARManager.exit();
      });

      // Enter AR button in HUD (next to fullscreen/orbit)
      document.getElementById('btn-enter-ar')?.addEventListener('click', async () => {
        await ARManager.enter(GameLogic.getCurrentLevelIdx());
      });

      // AR win toast buttons
      function _hideArWinToast() {
        const t = document.getElementById('ar-win-toast');
        if (t) t.style.display = 'none';
      }
      document.getElementById('ar-win-next')?.addEventListener('click', () => {
        _hideArWinToast();
        GameLogic.nextLevel?.();
      });
      document.getElementById('ar-win-retry')?.addEventListener('click', () => {
        _hideArWinToast();
        GameLogic.retryLevel?.();
      });
      document.getElementById('ar-win-exit')?.addEventListener('click',  async () => {
        _hideArWinToast();
        ARManager.exit();
      });
      // AR fail toast buttons
      function _hideArFailToast() {
        const t = document.getElementById('ar-fail-toast');
        if (t) t.style.display = 'none';
      }
      document.getElementById('ar-fail-retry')?.addEventListener('click', () => {
        _hideArFailToast();
        GameLogic.retryLevel?.();
      });
      document.getElementById('ar-fail-exit')?.addEventListener('click',  async () => {
        _hideArFailToast();
        ARManager.exit();
        GameLogic.retryLevel?.();
      });

    } catch (err) {
      console.warn('[AR] Init skipped:', err.message);
    }
  }

  EventBus.on('ar:placed', () =>
    document.getElementById('ar-scan-hint')?.classList.remove('visible'));
  EventBus.on('ar:exited', () =>
    document.getElementById('ar-scan-hint')?.classList.remove('visible'));
  EventBus.on('ar:entered', () => {
    AudioEngine.resume?.();
    try { window.speechSynthesis?.getVoices(); } catch(_) {}
  });
  EventBus.on('ar:menu', () => {
    const panel = document.getElementById('ar-menu-panel');
    if (!panel) return;
    panel.style.display = panel.style.display !== 'none' ? 'none' : 'flex';
  });
  EventBus.on('ar:rebuild-level', ({ levelIdx }) => {
    const toast = document.getElementById('ar-win-toast');
    if (toast) toast.style.display = 'none';
    GameLogic.unloadLevel();
    UIManager.showGame();
    GameLogic.startFromLevel(levelIdx ?? 0);
  });

  // ── 7. Top-level EventBus routing ────────────────────────

  EventBus.on('game:start', (levelIdx) => {
    UIManager.showGame();
    GameLogic.startFromLevel(levelIdx ?? 0);
  });

  // Random stage via LevelGenerator
  let _infiniteDifficulty = 1;
  let _infiniteCount = 0;
  let _infiniteMode  = false;

  EventBus.on('game:infinite', ({ difficulty }) => {
    _infiniteDifficulty = difficulty || 2;
    _infiniteCount      = 0;
    _infiniteMode       = true;
    _startInfinite();
  });

  function _startInfinite() {
    _infiniteCount++;
    const ld = LevelGenerator.generate({
      seed:       Date.now() + _infiniteCount,
      difficulty: Math.min(5, Math.ceil(_infiniteCount / 2) + _infiniteDifficulty - 1),
      width:  11 + Math.min(8, _infiniteCount),
      height: 9  + Math.min(6, _infiniteCount),
      id:     1000 + _infiniteCount,
    });
    UIManager.showGame();
    GameLogic.loadCustomLevel(ld);
  }

  EventBus.on('game:infinite-next', () => _startInfinite());

  EventBus.on('game:next-level', () => {
    UIManager.showGame();
    if (_infiniteMode) _startInfinite();
    else GameLogic.nextLevel();
  });

  EventBus.on('game:retry', () => {
    UIManager.showGame();
    GameLogic.retryLevel();
  });

  EventBus.on('game:to-menu', () => {
    _infiniteMode = false;
    GameLogic.unloadLevel();
    UIManager.showMainMenu();
  });

  EventBus.on('game:to-editor', () => {
    GameLogic.unloadLevel();
    UIManager.showEditor();
  });

  EventBus.on('game:pause', () => UIManager.showMainMenu());

  EventBus.on('game:all-done', () => {
    UIManager.showWin({
      steps:   Player.getStepCount(),
      bombs: Player.getPortalUses(),
      isLast:  true,
    });
  });

  EventBus.on('editor:open',  () => UIManager.showEditor());
  EventBus.on('editor:close', () => UIManager.showMainMenu());
  EventBus.on('editor:test',  (levelData) => {
    UIManager.showGame(true);
    GameLogic.loadCustomLevel(levelData);
  });

  EventBus.on('theme:rebuild', () => {
    if (!document.getElementById('hud').classList.contains('hidden')) {
      GameLogic.retryLevel?.();
    }
  });

  // Screen flash on explosion (portal flash reuse)
  EventBus.on('bomb:exploded', () => {
    const flash = document.createElement('div');
    Object.assign(flash.style, {
      position:'fixed', inset:'0',
      background:'#ff4400', opacity:'0.12',
      pointerEvents:'none', zIndex:'200',
      transition:'opacity 0.35s ease',
    });
    document.body.appendChild(flash);
    requestAnimationFrame(() => {
      flash.style.opacity = '0';
      setTimeout(() => flash.remove(), 380);
    });
  });

  // ── 8. Keyboard shortcuts ─────────────────────────────────
  let _minimapOn = true;
  window.addEventListener('keydown', e => {
    if (e.code === 'F1') { e.preventDefault(); GameLogic.retryLevel?.(); }
    if (e.code === 'KeyM') {
      _minimapOn = !_minimapOn;
      Minimap.setVisible(_minimapOn);
    }
  });

  // ── 9. Console greeting ───────────────────────────────────
  console.log(
    '%c[BOMBER ISO]%c v1.0 — Isometric Edition\n' +
    '  WASD=Move  SPACE=Bomb  F1=Retry  M=Minimap  ESC=Menu',
    'color:#ff6a00;font-weight:bold;font-family:monospace',
    'color:#666;font-family:monospace'
  );

})();
