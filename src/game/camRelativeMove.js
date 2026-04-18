// ============================================================
// camRelativeMove.js — Camera-relative movement mapping
//
// When the camera is rotated (orbit mode or AR board rotation),
// WASD / D-pad directions are remapped so that the screen-up
// direction always corresponds to the player moving "away" from
// the viewer — regardless of camera yaw or AR board orientation.
//
// Algorithm
// ─────────
// 1. Read the current world-space camera yaw (camera.alpha in
//    BabylonJS ArcRotateCamera, measured from the +Z axis,
//    counter-clockwise when viewed from above).
//
// 2. In AR mode, add the board's own Y rotation so that the
//    input axes are relative to the board's orientation in the
//    real world, not just the camera angle.
//
// 3. Snap the combined angle to the nearest 90° step.
//    This gives a clean integer rotation count (0–3), each
//    representing a 90° clockwise rotation of the grid from the
//    viewer's perspective.
//
// 4. Use that rotation count to re-index the four cardinal
//    directions so that "screen up" always maps to grid UP,
//    "screen right" maps to grid RIGHT, etc.
//
// Usage
// ─────
//   CamRelativeMove.enable(true);   // turn on
//   CamRelativeMove.enable(false);  // revert to fixed
//
//   // Called automatically by Player when _step() is invoked:
//   const dir = CamRelativeMove.remap(rawDir);
//
// The module reads Renderer.getCamera() and ARManager
// lazily (no hard dependencies at load time).
// ============================================================

const CamRelativeMove = (() => {

  let _enabled = true;   // on by default

  // The four canonical grid directions, clockwise from UP.
  // Index 0 = UP, 1 = RIGHT, 2 = DOWN, 3 = LEFT
  const DIRS_CW = [
    { dx:  0, dz: -1 },   // 0 UP
    { dx:  1, dz:  0 },   // 1 RIGHT
    { dx:  0, dz:  1 },   // 2 DOWN
    { dx: -1, dz:  0 },   // 3 LEFT
  ];

  // Map a direction object to its index in DIRS_CW
  function _dirIndex(dir) {
    return DIRS_CW.findIndex(d => d.dx === dir.dx && d.dz === dir.dz);
  }

  // ── Core angle reader ─────────────────────────────────────

  /**
   * Returns the effective yaw (radians) that represents how many
   * degrees the "grid north" has rotated clockwise relative to
   * "screen up" from the player's current viewpoint.
   *
   * Two modes:
   *
   * NON-AR  — read ArcRotateCamera.alpha (orbit camera yaw).
   *           The default ISO angle gives 0 compensation; rotating
   *           the camera requires remapping inputs.
   *
   * AR      — the ArcRotateCamera is replaced by the XR device
   *           camera and alpha is meaningless. Instead we compute
   *           the angle from the board centre to the viewer's eye
   *           in board-local space. This naturally handles BOTH:
   *             • explicit board rotation (user rotates board with buttons)
   *             • viewer walking around the table without touching the board
   */
  function _getEffectiveYaw() {

    const arActive = (typeof ARManager !== 'undefined') && ARManager.isActive?.();

    if (arActive) {
      // getViewerRelativeYaw() returns the angle in board-local space
      // from the board's +Z axis to the camera→board vector.
      // When the viewer is at the "default south" position this is 0.
      // Walking 90° clockwise around the table returns ~π/2, etc.
      return ARManager.getViewerRelativeYaw?.() ?? 0;
    }

    // Non-AR: read ArcRotateCamera yaw.
    // BabylonJS alpha = horizontal orbit angle, counter-clockwise positive.
    // Default ISO_ALPHA = -π/4. We want "how much has camera rotated from
    // its default" so we subtract the default.
    const cam = (typeof Renderer !== 'undefined') ? Renderer.getCamera?.() : null;
    if (!cam || typeof cam.alpha !== 'number') return 0;

    const ISO_ALPHA_DEFAULT = -Math.PI / 4;  // matches CONSTANTS.ISO_ALPHA
    // Clockwise delta from the default iso angle:
    return -(cam.alpha - ISO_ALPHA_DEFAULT);
  }

  // ── Snap to nearest 90° ───────────────────────────────────

  /**
   * Returns how many 90° clockwise steps the camera/board has
   * rotated from the default orientation.
   * Value is 0, 1, 2, or 3.
   */
  function _rotationSteps() {
    const yaw = _getEffectiveYaw();
    // Normalise to [0, 2π)
    const τ = Math.PI * 2;
    const norm = ((yaw % τ) + τ) % τ;
    // Snap to nearest quarter turn
    return Math.round(norm / (Math.PI / 2)) % 4;
  }

  // ── Public API ────────────────────────────────────────────

  function enable(v) { _enabled = v; }
  function isEnabled() { return _enabled; }

  /**
   * Remap a raw movement direction to the camera-relative
   * equivalent.
   *
   * @param  {{ dx: number, dz: number }} rawDir
   * @returns {{ dx: number, dz: number }}
   */
  function remap(rawDir) {
    if (!_enabled) return rawDir;

    const raw = _dirIndex(rawDir);
    if (raw === -1) return rawDir;   // diagonal or zero — pass through

    const steps = _rotationSteps();
    // Rotate the direction index by -steps (counter-rotate the input
    // to compensate for the camera having rotated clockwise by `steps`).
    const remapped = (raw - steps + 4) % 4;
    return DIRS_CW[remapped];
  }

  return { enable, isEnabled, remap };

})();
