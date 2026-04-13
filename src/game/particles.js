// ============================================================
// particles.js — BabylonJS particle systems for visual effects
//
// BUG FIX: Every ParticleSystem requires ps.particleTexture.
// Without it particles are created but never rendered (invisible).
// We generate a tiny white dot texture procedurally so no
// external image file is needed.
//
// Includes portal-iso effects AND bomber effects so the same
// file works for both games.
// ============================================================

const Particles = (() => {
  let scene = null;
  let _dotTexture = null;   // shared procedural dot — created once in init()
  let _nextId = 0;

  // Active persistent particle systems stored by key
  const systems = {};

  function _uid(prefix) {
    return `${prefix}_${Date.now()}_${_nextId++}`;
  }

  function _textureIsDisposed(tex) {
    return !tex ||
      tex.isDisposed === true ||
      (typeof tex.isDisposed === 'function' && tex.isDisposed());
  }

  function init(babylonScene) {
    if (scene && scene !== babylonScene) clearAll();
    scene = babylonScene;
    if (_textureIsDisposed(_dotTexture)) _dotTexture = _makeDotTexture();
  }

  // ── Procedural dot texture ────────────────────────────────
  // Draws a radial white-to-transparent gradient into a 32×32
  // DynamicTexture so no external file is required.

  function _makeDotTexture() {
    if (!scene) return null;
    try {
      const tex = new BABYLON.DynamicTexture('_particle_dot', { width: 32, height: 32 }, scene, false);
      const ctx = tex.getContext();
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0,   'rgba(255,255,255,1)');
      grad.addColorStop(0.4, 'rgba(255,255,255,0.8)');
      grad.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
      tex.update();
      tex.hasAlpha = true;
      return tex;
    } catch(e) {
      console.warn('[Particles] Could not create dot texture:', e);
      return null;
    }
  }

  /** Assign the shared dot texture to a particle system.
   * Recreates the texture if it was previously disposed.
   */
  function _tex(ps) {
    if (_textureIsDisposed(_dotTexture)) _dotTexture = _makeDotTexture();
    if (_dotTexture) ps.particleTexture = _dotTexture;
    return ps;
  }

  // ── Helper: create invisible emitter anchor mesh ──────────

  function _emitter(name, pos) {
    const m = BABYLON.MeshBuilder.CreateBox(name, { size: 0.01 }, scene);
    m.position = pos.clone();
    m.isVisible = false;
    return m;
  }

  // ══════════════════════════════════════════════════════════
  // PORTAL-ISO EFFECTS
  // ══════════════════════════════════════════════════════════

  function portalBurst(gx, gz, which) {
    if (!scene) return;
    const color = which === 'A'
      ? new BABYLON.Color4(0, 0.6, 1, 1)
      : new BABYLON.Color4(1, 0.42, 0, 1);

    const pos  = Renderer.gridToWorld(gx, gz);
    pos.y      = CONSTANTS.WALL_HEIGHT * 0.5;
    const emit = _emitter(_uid(`pe_${which}`), pos);

    const ps = _tex(new BABYLON.ParticleSystem(_uid(`ps_burst_${which}`), 80, scene));
    ps.emitter     = emit;
    ps.minEmitBox  = new BABYLON.Vector3(-0.3, -0.3, -0.1);
    ps.maxEmitBox  = new BABYLON.Vector3( 0.3,  0.3,  0.1);
    ps.color1      = color;
    ps.color2      = color.scale(0.5);
    ps.colorDead   = new BABYLON.Color4(0, 0, 0, 0);
    ps.minSize     = 0.06;  ps.maxSize     = 0.22;
    ps.minLifeTime = 0.3;   ps.maxLifeTime = 0.7;
    ps.emitRate    = 400;
    ps.minEmitPower = 3;    ps.maxEmitPower = 6;
    ps.updateSpeed = 0.015;
    ps.gravity     = new BABYLON.Vector3(0, -3, 0);
    ps.direction1  = new BABYLON.Vector3(-1, 1, -1);
    ps.direction2  = new BABYLON.Vector3( 1, 2,  1);
    ps.start();
    setTimeout(() => { ps.stop(); setTimeout(() => { ps.dispose(false); emit.dispose(); }, 1000); }, 120);
  }

  function startPortalSwirl(gx, gz, which) {
    stopPortalSwirl(which);
    if (!scene) return;

    const color = which === 'A'
      ? new BABYLON.Color4(0, 0.6, 1, 0.8)
      : new BABYLON.Color4(1, 0.42, 0, 0.8);

    const pos  = Renderer.gridToWorld(gx, gz);
    pos.y      = CONSTANTS.WALL_HEIGHT * 0.5;
    const emit = _emitter(_uid(`swirl_emit_${which}`), pos);

    const ps = _tex(new BABYLON.ParticleSystem(_uid(`swirl_${which}`), 60, scene));
    ps.emitter    = emit;
    ps.minEmitBox = new BABYLON.Vector3(-0.5, -0.5, -0.05);
    ps.maxEmitBox = new BABYLON.Vector3( 0.5,  0.5,  0.05);
    ps.color1     = color;  ps.color2 = color.clone();
    ps.colorDead  = new BABYLON.Color4(0, 0, 0, 0);
    ps.minSize    = 0.04;  ps.maxSize     = 0.14;
    ps.minLifeTime = 0.5;  ps.maxLifeTime = 1.2;
    ps.emitRate   = 30;
    ps.minEmitPower = 0.2; ps.maxEmitPower = 0.6;
    ps.direction1 = new BABYLON.Vector3(-0.3, -0.3, 0);
    ps.direction2 = new BABYLON.Vector3( 0.3,  0.3, 0.1);
    ps.gravity    = new BABYLON.Vector3(0, 0, 0);
    ps.start();
    systems[`swirl_${which}`] = { ps, emit };
  }

  function stopPortalSwirl(which) {
    const key = `swirl_${which}`;
    if (systems[key]) {
      systems[key].ps.stop();
      setTimeout(() => { systems[key]?.ps.dispose(false); systems[key]?.emit.dispose(); }, 1200);
      delete systems[key];
    }
  }

  function teleportBurst(gx, gz) {
    if (!scene) return;
    const pos = Renderer.gridToWorld(gx, gz);
    pos.y     = CONSTANTS.TILE_SIZE * 0.8;
    const emit = _emitter(_uid('tele_emit'), pos);

    const ps = _tex(new BABYLON.ParticleSystem(_uid('tele_burst'), 120, scene));
    ps.emitter    = emit;
    ps.minEmitBox = new BABYLON.Vector3(-0.4, 0, -0.4);
    ps.maxEmitBox = new BABYLON.Vector3( 0.4, 0.2, 0.4);
    ps.color1     = new BABYLON.Color4(0.5, 0.8, 1, 1);
    ps.color2     = new BABYLON.Color4(1, 0.5, 0.1, 1);
    ps.colorDead  = new BABYLON.Color4(0, 0, 0, 0);
    ps.minSize    = 0.05;  ps.maxSize     = 0.2;
    ps.minLifeTime = 0.3;  ps.maxLifeTime = 0.8;
    ps.emitRate   = 600;
    ps.minEmitPower = 2; ps.maxEmitPower = 5;
    ps.direction1 = new BABYLON.Vector3(-1, 1, -1);
    ps.direction2 = new BABYLON.Vector3( 1, 3,  1);
    ps.gravity    = new BABYLON.Vector3(0, -4, 0);
    ps.start();
    setTimeout(() => { ps.stop(); setTimeout(() => { ps.dispose(false); emit.dispose(); }, 1000); }, 150);
  }

  function startHazardEmbers(gx, gz) {
    const key = `hazard_${gx}_${gz}`;
    if (systems[key] || !scene) return;

    const pos = Renderer.gridToWorld(gx, gz);
    pos.y = 0.1;
    const emit = _emitter(_uid(`${key}_emit`), pos);

    const ps = _tex(new BABYLON.ParticleSystem(_uid(key), 40, scene));
    ps.emitter    = emit;
    ps.minEmitBox = new BABYLON.Vector3(-0.8, 0, -0.8);
    ps.maxEmitBox = new BABYLON.Vector3( 0.8, 0,  0.8);
    ps.color1     = new BABYLON.Color4(1, 0.2, 0.1, 0.9);
    ps.color2     = new BABYLON.Color4(1, 0.5, 0,   0.6);
    ps.colorDead  = new BABYLON.Color4(0.2, 0.2, 0.2, 0);
    ps.minSize    = 0.04;  ps.maxSize     = 0.12;
    ps.minLifeTime = 0.4;  ps.maxLifeTime = 1.0;
    ps.emitRate   = 15;
    ps.minEmitPower = 0.5; ps.maxEmitPower = 1.5;
    ps.direction1 = new BABYLON.Vector3(-0.2, 1, -0.2);
    ps.direction2 = new BABYLON.Vector3( 0.2, 2,  0.2);
    ps.gravity    = new BABYLON.Vector3(0, -1, 0);
    ps.start();
    systems[key] = { ps, emit };
  }

  function buttonFlash(gx, gz) {
    if (!scene) return;
    const pos = Renderer.gridToWorld(gx, gz);
    pos.y = 0.15;
    const emit = _emitter(_uid('btn_flash_emit'), pos);

    const ps = _tex(new BABYLON.ParticleSystem(_uid('btn_flash'), 60, scene));
    ps.emitter    = emit;
    ps.minEmitBox = new BABYLON.Vector3(-0.5, 0, -0.5);
    ps.maxEmitBox = new BABYLON.Vector3( 0.5, 0.1, 0.5);
    ps.color1     = new BABYLON.Color4(1, 0.9, 0.2, 1);
    ps.color2     = new BABYLON.Color4(1, 0.6, 0,   0.8);
    ps.colorDead  = new BABYLON.Color4(0, 0, 0, 0);
    ps.minSize    = 0.05;  ps.maxSize     = 0.18;
    ps.minLifeTime = 0.2;  ps.maxLifeTime = 0.5;
    ps.emitRate   = 300;
    ps.minEmitPower = 1; ps.maxEmitPower = 3;
    ps.direction1 = new BABYLON.Vector3(-0.5, 1, -0.5);
    ps.direction2 = new BABYLON.Vector3( 0.5, 2,  0.5);
    ps.gravity    = new BABYLON.Vector3(0, -3, 0);
    ps.start();
    setTimeout(() => { ps.stop(); setTimeout(() => { ps.dispose(false); emit.dispose(); }, 600); }, 100);
  }

  // ══════════════════════════════════════════════════════════
  // BOMBER EFFECTS
  // ══════════════════════════════════════════════════

  function explosionBurst(gx, gz) {
    if (!scene) return;
    const pos = Renderer.gridToWorld(gx, gz);
    pos.y = 0.2;
    const emit = _emitter(_uid(`expl_${gx}_${gz}`), pos);

    const ps = _tex(new BABYLON.ParticleSystem(_uid(`ps_expl_${gx}_${gz}`), 120, scene));
    ps.emitter    = emit;
    ps.minEmitBox = new BABYLON.Vector3(-0.8, 0, -0.8);
    ps.maxEmitBox = new BABYLON.Vector3( 0.8, 0,  0.8);
    ps.color1     = new BABYLON.Color4(1, 0.6, 0,  1);
    ps.color2     = new BABYLON.Color4(1, 0.2, 0,  1);
    ps.colorDead  = new BABYLON.Color4(0.2, 0.1, 0, 0);
    ps.minSize    = 0.1;   ps.maxSize     = 0.45;
    ps.minLifeTime = 0.2;  ps.maxLifeTime = 0.55;
    ps.emitRate   = 600;
    ps.minEmitPower = 4;   ps.maxEmitPower = 9;
    ps.updateSpeed = 0.015;
    ps.gravity    = new BABYLON.Vector3(0, -6, 0);
    ps.direction1 = new BABYLON.Vector3(-1, 2, -1);
    ps.direction2 = new BABYLON.Vector3( 1, 4,  1);
    ps.start();
    setTimeout(() => { ps.stop(); setTimeout(() => { ps.dispose(false); emit.dispose(); }, 700); }, 120);
  }

  function softBlockBurst(gx, gz) {
    if (!scene) return;
    const pos = Renderer.gridToWorld(gx, gz);
    pos.y = 1.2;
    const emit = _emitter(_uid(`sb_${gx}_${gz}`), pos);

    const ps = _tex(new BABYLON.ParticleSystem(_uid(`ps_sb_${gx}_${gz}`), 60, scene));
    ps.emitter    = emit;
    ps.minEmitBox = new BABYLON.Vector3(-0.5, -0.5, -0.5);
    ps.maxEmitBox = new BABYLON.Vector3( 0.5,  0.5,  0.5);
    ps.color1     = new BABYLON.Color4(0.55, 0.32, 0.12, 1);
    ps.color2     = new BABYLON.Color4(0.35, 0.22, 0.08, 1);
    ps.colorDead  = new BABYLON.Color4(0, 0, 0, 0);
    ps.minSize    = 0.08;  ps.maxSize     = 0.3;
    ps.minLifeTime = 0.3;  ps.maxLifeTime = 0.7;
    ps.emitRate   = 300;
    ps.minEmitPower = 3;   ps.maxEmitPower = 6;
    ps.updateSpeed = 0.015;
    ps.gravity    = new BABYLON.Vector3(0, -5, 0);
    ps.direction1 = new BABYLON.Vector3(-1, 1, -1);
    ps.direction2 = new BABYLON.Vector3( 1, 3,  1);
    ps.start();
    setTimeout(() => { ps.stop(); setTimeout(() => { ps.dispose(false); emit.dispose(); }, 700); }, 100);
  }

  function enemyDeathBurst(gx, gz) {
    if (!scene) return;
    const pos = Renderer.gridToWorld(gx, gz);
    pos.y = 0.8;
    const emit = _emitter(_uid(`ed_${gx}_${gz}`), pos);

    const ps = _tex(new BABYLON.ParticleSystem(_uid(`ps_ed_${gx}_${gz}`), 80, scene));
    ps.emitter    = emit;
    ps.minEmitBox = new BABYLON.Vector3(-0.3, -0.3, -0.3);
    ps.maxEmitBox = new BABYLON.Vector3( 0.3,  0.3,  0.3);
    ps.color1     = new BABYLON.Color4(0.8, 0.2, 0.2, 1);
    ps.color2     = new BABYLON.Color4(1,   0.5, 0,   1);
    ps.colorDead  = new BABYLON.Color4(0, 0, 0, 0);
    ps.minSize    = 0.08;  ps.maxSize     = 0.28;
    ps.minLifeTime = 0.25; ps.maxLifeTime = 0.6;
    ps.emitRate   = 500;
    ps.minEmitPower = 3;   ps.maxEmitPower = 7;
    ps.updateSpeed = 0.018;
    ps.gravity    = new BABYLON.Vector3(0, -4, 0);
    ps.direction1 = new BABYLON.Vector3(-1, 2, -1);
    ps.direction2 = new BABYLON.Vector3( 1, 4,  1);
    ps.start();
    setTimeout(() => { ps.stop(); setTimeout(() => { ps.dispose(false); emit.dispose(); }, 700); }, 110);
  }

  // ── Cleanup ───────────────────────────────────────────────

  function clearAll() {
    Object.keys(systems).forEach(k => {
      systems[k]?.ps?.dispose(false);
      systems[k]?.emit?.dispose();
      delete systems[k];
    });

    if (!_textureIsDisposed(_dotTexture)) {
      _dotTexture.dispose();
      _dotTexture = null;
    }
  }

  return {
    init, clearAll,
    portalBurst, startPortalSwirl, stopPortalSwirl,
    teleportBurst, startHazardEmbers, buttonFlash,
    explosionBurst, softBlockBurst, enemyDeathBurst,
  };
})();
