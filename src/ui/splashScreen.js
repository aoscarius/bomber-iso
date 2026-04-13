// splashScreen.js — Loading splash shown while GLB assets are fetched.
//
// Usage:
//   SplashScreen.show();
//   // ... loading ...
//   SplashScreen.setProgress(loaded, total, modelName);
//   // ... done ...
//   SplashScreen.hide();  // fades out and removes
//
// The splash element (#splash-screen) must exist in the DOM.

const SplashScreen = (() => {

  let _el      = null;
  let _bar     = null;
  let _label   = null;
  let _pct     = null;
  let _visible = false;

  function show() {
    _el    = document.getElementById('splash-screen');
    _bar   = document.getElementById('splash-bar-fill');
    _label = document.getElementById('splash-label');
    _pct   = document.getElementById('splash-pct');
    if (!_el) return;
    _el.style.display = 'flex';
    _el.classList.remove('hidden');
    _visible = true;
    _setProgress(0, 1, '');
  }

  function setProgress(loaded, total, modelName) {
    if (!_visible) return;
    _setProgress(loaded, total, modelName);
  }

  function _setProgress(loaded, total, modelName) {
    const frac = total > 0 ? loaded / total : 0;
    const pct  = Math.round(frac * 100);
    if (_bar)   _bar.style.width = pct + '%';
    if (_pct)   _pct.textContent = pct + '%';
    if (_label && modelName) {
      // Show just the filename without path/extension
      const name = modelName.replace(/^.*[\\/]/, '').replace(/\.glb$/i, '').toUpperCase();
      _label.textContent = 'LOADING ' + name + '…';
    } else if (_label && loaded === 0) {
      _label.textContent = 'INITIALIZING…';
    }
  }

  function hide() {
    if (!_el) return;
    _visible = false;
    _el.classList.add('splash-fadeout');
    _el.addEventListener('animationend', () => {
      _el.style.display = 'none';
      _el.classList.add('hidden');
      _el.classList.remove('splash-fadeout');
    }, { once: true });
  }

  return { show, setProgress, hide };
})();
