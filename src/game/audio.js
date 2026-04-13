// ============================================================
// audio.js — Synthetic audio engine via Web Audio API
// Generates all sounds procedurally — no audio files needed
// ============================================================

const AudioEngine = (() => {
  let ctx = null;   // AudioContext
  let masterGain;   // Master volume node
  let enabled = true;

  // ── Init ─────────────────────────────────────────────────

  function init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.4;
      masterGain.connect(ctx.destination);
    } catch (e) {
      console.warn('[Audio] Web Audio API not available:', e);
      enabled = false;
    }
  }

  /** Resume context on first user gesture (browser autoplay policy). */
  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function setEnabled(v) { enabled = v; if (masterGain) masterGain.gain.value = v ? 0.4 : 0; }

  // ── Low-level helpers ────────────────────────────────────

  /**
   * Create an oscillator burst — one-shot tone.
   * @param {number}   freq      - Hz
   * @param {string}   type      - OscillatorNode type
   * @param {number}   duration  - seconds
   * @param {number}   vol       - 0..1
   * @param {number}   startTime - AudioContext time offset
   */
  function _tone(freq, type, duration, vol = 0.3, startTime = 0) {
    if (!ctx || !enabled) return;
    const t   = ctx.currentTime + startTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(masterGain);
    osc.type      = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  /**
   * Create a noise burst (filtered white noise).
   * @param {number} freq      - Filter cutoff Hz
   * @param {number} duration  - seconds
   * @param {number} vol
   */
  function _noise(freq, duration, vol = 0.2) {
    if (!ctx || !enabled) return;
    const bufSize = ctx.sampleRate * duration;
    const buffer  = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data    = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src    = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain   = ctx.createGain();

    src.buffer = buffer;
    filter.type            = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value         = 1.5;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    src.start();
  }

  // ── Game sound events ────────────────────────────────────

  /** Footstep — metallic clank */
  function step() {
    _noise(800,  0.06, 0.15);
    _tone(120, 'square', 0.05, 0.08);
  }

  /** Portal A placed — ascending whoosh (blue) */
  function portalA() {
    if (!ctx || !enabled) return;
    const t   = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(masterGain);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.25);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.start(t); osc.stop(t + 0.35);
    _noise(1200, 0.2, 0.15);
  }

  /** Portal B placed — descending whoosh (orange) */
  function portalB() {
    if (!ctx || !enabled) return;
    const t   = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(masterGain);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.25);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.start(t); osc.stop(t + 0.35);
    _noise(600, 0.2, 0.15);
  }

  /** Teleport through portal */
  function teleport() {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    // Swoosh chord
    [400, 600, 800].forEach((f, i) => {
      _tone(f, 'sine', 0.4, 0.12, i * 0.02);
    });
    _noise(2000, 0.35, 0.2);
  }

  /** Portal shot misses wall */
  function portalMiss() {
    _tone(150, 'square', 0.1, 0.1);
    _noise(300, 0.1, 0.08);
  }

  /** Player bumps into wall */
  function bump() {
    _noise(400, 0.08, 0.12);
    _tone(80, 'square', 0.08, 0.08);
  }

  /** Button press */
  function buttonPress() {
    _tone(440, 'sine', 0.12, 0.2);
    _tone(660, 'sine', 0.12, 0.15, 0.05);
    _noise(200, 0.1, 0.1);
  }

  /** Door opening — mechanical slide */
  function doorOpenClose() {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(masterGain);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.linearRampToValueAtTime(90, t + 0.4);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.start(t); osc.stop(t + 0.55);
    _noise(500, 0.4, 0.1);
  }

  /** Cube/Movable push — heavy scrape */
  function cubeMovablePush() {
    _noise(300, 0.15, 0.2);
    _tone(100, 'sawtooth', 0.15, 0.1);
  }

  /** Win level — ascending arpeggio */
  function win() {
    if (!ctx || !enabled) return;
    const notes = [261, 329, 392, 523, 659, 784];
    notes.forEach((f, i) => _tone(f, 'sine', 0.4, 0.25, i * 0.12));
    setTimeout(() => _tone(1047, 'sine', 0.8, 0.3), notes.length * 120);
  }

  /** Fail / death — descending noise */
  function fail() {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(masterGain);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.8);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    osc.start(t); osc.stop(t + 1.1);
    _noise(800, 0.5, 0.2);
  }

  /** Laser hum — continuous tone (returns stop function) */
  function laserHum(freq = 880) {
    if (!ctx || !enabled) return () => {};
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(masterGain);
    osc.type            = 'sine';
    osc.frequency.value = freq;
    gain.gain.value     = 0.06;
    osc.start();
    return () => { gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1); osc.stop(ctx.currentTime + 0.15); };
  }

  /** Level select ambient drone */
  function ambientDrone() {
    if (!ctx || !enabled) return;
    [55, 110, 220].forEach((f, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(masterGain);
      osc.type            = 'sine';
      osc.frequency.value = f + Math.random() * 2;
      gain.gain.value     = 0.04;
      osc.start();
      setTimeout(() => {
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);
        osc.stop(ctx.currentTime + 1.6);
      }, 3000 + i * 1000);
    });
  }

  /** Typewriter tick — soft click for dialogue text */
  function dialogueClick() {
    if (!ctx || !enabled) return;
    const t   = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(masterGain);
    osc.type            = 'square';
    osc.frequency.value = 1200 + Math.random() * 400;
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
    osc.start(t); osc.stop(t + 0.02);
  }

  /** Panel open whoosh */
  function dialogueOpen() {
    _noise(300, 0.12, 0.08);
    _tone(220, 'sine', 0.1, 0.06);
  }

  /** Dialogue panel open — subtle electronic chime */
  function dialogueOpen() {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    // Short two-tone chime: high + low
    _tone(880, 'sine', 0.09, 0.12, 0);
    _tone(660, 'sine', 0.12, 0.08, 0.07);
    _noise(1200, 0.06, 0.06);
  }

  /** Dialogue page advance — soft tick */
  function dialogueTick() {
    _noise(900, 0.04, 0.08);
    _tone(440, 'sine', 0.04, 0.06);
  }


  // ── Bomber-specific sounds ─────────────────────────────

  /** Bomb placed — low dull thud */
  function bombPlace() {
    if (!ctx || !enabled) return;
    _tone(90,  'sawtooth', 0.14, 0.28);
    _noise(120, 0.09, 0.12);
  }

  /** Big explosion — layered boom + noise burst */
  function explosion() {
    if (!ctx || !enabled) return;
    _tone(55,  'sawtooth', 0.45, 0.55);
    _tone(42,  'sine',     0.55, 0.45, 0.02);
    _noise(380, 0.38, 0.42);
    _noise(880, 0.22, 0.28);
  }

  /** Power-up collected — ascending chime */
  function upgrade() {
    _tone(523, 'sine', 0.1,  0.3);
    _tone(659, 'sine', 0.1,  0.3,  0.1);
    _tone(784, 'sine', 0.15, 0.35, 0.2);
  }

  /** Enemy death — descending crunch */
  function enemyDie() {
    _tone(660, 'square', 0.06, 0.22);
    _tone(400, 'square', 0.08, 0.18, 0.06);
    _tone(220, 'square', 0.10, 0.15, 0.13);
  }

  return {
    init, resume, setEnabled,
    step, portalA, portalB, teleport, portalMiss,
    bump, buttonPress, doorOpenClose, cubeMovablePush, win, fail,
    laserHum, ambientDrone, dialogueClick, dialogueOpen,
    // Bomber
    bombPlace, explosion, upgrade, enemyDie,
  };
})();
