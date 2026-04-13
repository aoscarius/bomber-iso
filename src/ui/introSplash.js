// ============================================================
// introSplash.js — 42 Software company intro splash
//
// Displays the company logo for ~3.2 s before the loading
// splash, then fades out. Clickable anywhere (or SKIP button)
// to dismiss immediately.
//
// Called in main.js:   await IntroSplash.show();
// ============================================================

const IntroSplash = (() => {

  const HOLD_MS     = 3200;   // how long the logo stays fully visible
  const FADE_IN_MS  =  550;
  const FADE_OUT_MS =  650;

  function show() {
    return new Promise(resolve => {
      const el = document.getElementById('intro-splash');
      if (!el) { resolve(); return; }

      let _dismissed = false;

      const dismiss = () => {
        if (_dismissed) return;
        _dismissed = true;
        clearTimeout(_holdTimer);
        _fadeOut();
      };

      // Fade in
      el.style.opacity    = '0';
      el.style.display    = 'flex';
      el.style.transition = `opacity ${FADE_IN_MS}ms ease`;
      void el.offsetWidth;          // force reflow
      el.style.opacity = '1';

      // Skip button + click anywhere
      document.getElementById('intro-skip-btn')
        ?.addEventListener('click', dismiss, { once: true });
      el.addEventListener('click', dismiss, { once: true });

      // Auto-dismiss after HOLD_MS
      const _holdTimer = setTimeout(dismiss, HOLD_MS);

      function _fadeOut() {
        el.style.transition = `opacity ${FADE_OUT_MS}ms ease`;
        el.style.opacity    = '0';
        setTimeout(() => {
          el.style.display = 'none';
          resolve();
        }, FADE_OUT_MS);
      }
    });
  }

  return { show };
})();
