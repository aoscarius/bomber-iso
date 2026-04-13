// ============================================================
// renderer.js — BabylonJS scene, camera, lighting, mesh factory
// Based on porta-iso renderer; adapted for Bomber ISO.
//
// KEPT:    GLB asset loading, AR passthrough, shadow generator,
//          orbit/iso camera toggle, scroll+pinch zoom,
//          gridToWorld, material cache, clearLevel.
//
// REMOVED: portal walls, portals, laser emitter/receiver,
//          doors, buttons, cubes, movables, stairs, floor holes,
//          multi-layer / layer switching logic.
//
// ADDED:   soft wall, bomb mesh (fuse flicker), explosion mesh,
//          upgrade gem (floating), enemy mesh, player death flash,
//          placeBombMesh / removeBombMesh / showExplosionMesh /
//          removeExplosionMesh / removeSoftWallMesh / showExitMesh /
//          createEnemyMesh / animateEnemyTo / removeEnemyMesh.
// ============================================================

const Renderer = (() => {
  let engine, scene, camera, shadowGenerator;

  const meshMap  = {};
  const matCache = {};

  let _orbitUnlocked = false;
  let _cameraAnimObs = null;

  // ── Babylon helpers ──────────────────────────────────────

  function hex2color3(hex) {
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    return new BABYLON.Color3(r,g,b);
  }

  function randomHex2color3(hex, variance = 0.16) {
    const base = hex2color3(hex);
    const clamp = v => Math.min(1, Math.max(0, v));
    const r = clamp(base.r + (Math.random() * 2 - 1) * variance);
    const g = clamp(base.g + (Math.random() * 2 - 1) * variance);
    const b = clamp(base.b + (Math.random() * 2 - 1) * variance);
    return `#${[r,g,b].map(v =>
      Math.round(v * 255).toString(16).padStart(2, '0')
    ).join('')}`;
  }

  function getMaterial(hexColor, emissiveIntensity = 0) {
    const key = hexColor + '_' + emissiveIntensity;
    if (matCache[key]) return matCache[key];
    const mat = new BABYLON.StandardMaterial(key, scene);
    const col = hex2color3(hexColor);
    mat.diffuseColor  = col.scale(0.9);
    mat.specularColor = new BABYLON.Color3(0.08, 0.08, 0.12);
    if (emissiveIntensity > 0) mat.emissiveColor = col.scale(emissiveIntensity);
    matCache[key] = mat;
    return mat;
  }

  // ── Scene init ───────────────────────────────────────────

  function init(canvas) {
    engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true, stencil: true,
    });
    scene = new BABYLON.Scene(engine);
    scene.clearColor  = new BABYLON.Color4(0.04, 0.04, 0.07, 1);
    scene.ambientColor = new BABYLON.Color3(0.15, 0.15, 0.2);

    _setupCamera();
    _setupLights();

    engine.runRenderLoop(() => scene.render());
    window.addEventListener('resize', () => engine.resize());
    return scene;
  }

  function _setupCamera() {
    camera = new BABYLON.ArcRotateCamera(
      'iso-cam', CONSTANTS.ISO_ALPHA, CONSTANTS.ISO_BETA,
      CONSTANTS.ISO_RADIUS, BABYLON.Vector3.Zero(), scene
    );
    _lockCamera();
    camera.lowerRadiusLimit = 8;
    camera.upperRadiusLimit = 80;
    _setupScrollZoom();
    _setupPinchZoom();
  }

  function _setupScrollZoom() {
    const canvas = engine.getRenderingCanvas();
    if (!canvas) return;
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      if (!camera) return;
      const factor = e.deltaY > 0 ? 1.12 : 0.89;
      camera.radius = Math.max(camera.lowerRadiusLimit,
                      Math.min(camera.upperRadiusLimit, camera.radius * factor));
    }, { passive: false });
  }

  function _setupPinchZoom() {
    const canvas = engine.getRenderingCanvas();
    if (!canvas) return;
    let _pinchDist = null;
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 2)
        _pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                                e.touches[0].clientY - e.touches[1].clientY);
    }, { passive: true });
    canvas.addEventListener('touchmove', e => {
      if (e.touches.length !== 2 || _pinchDist === null) return;
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                           e.touches[0].clientY - e.touches[1].clientY);
      camera.radius = Math.max(camera.lowerRadiusLimit,
                      Math.min(camera.upperRadiusLimit, camera.radius * (_pinchDist / d)));
      _pinchDist = d;
    }, { passive: true });
    canvas.addEventListener('touchend', () => { _pinchDist = null; }, { passive: true });
  }

  function _lockCamera() {
    camera.lowerAlphaLimit = camera.upperAlphaLimit = CONSTANTS.ISO_ALPHA;
    camera.lowerBetaLimit  = camera.upperBetaLimit  = CONSTANTS.ISO_BETA;
    camera.inputs.removeByType('ArcRotateCameraPointersInput');
    _orbitUnlocked = false;
  }

  function _unlockCamera() {
    camera.lowerAlphaLimit = null; camera.upperAlphaLimit = null;
    camera.lowerBetaLimit  = 0.1;  camera.upperBetaLimit  = Math.PI / 2 - 0.05;
    try { camera.inputs.addPointers(); } catch(_) {}
    camera.attachControl(engine.getRenderingCanvas(), true);
    _orbitUnlocked = true;
  }

  function toggleOrbit() {
    if (_orbitUnlocked) {
      camera.alpha = CONSTANTS.ISO_ALPHA;
      camera.beta  = CONSTANTS.ISO_BETA;
      _lockCamera();
    } else {
      _unlockCamera();
    }
    return _orbitUnlocked;
  }

  function _setupLights() {
    const sun = new BABYLON.DirectionalLight('sun',
      new BABYLON.Vector3(-1, -2, -1), scene);
    sun.intensity = 1.0;
    sun.diffuse   = new BABYLON.Color3(0.95, 0.9, 0.85);

    const hemi = new BABYLON.HemisphericLight('hemi',
      new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity   = 0.4;
    hemi.groundColor = new BABYLON.Color3(0.1, 0.1, 0.15);

    shadowGenerator = new BABYLON.ShadowGenerator(1024, sun);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 16;
  }

  // ── World-space conversion ───────────────────────────────

  function gridToWorld(gx, gz, layerY = 0) {
    return new BABYLON.Vector3(
      gx * CONSTANTS.TILE_SIZE, layerY, gz * CONSTANTS.TILE_SIZE
    );
  }

  // ── Level build ──────────────────────────────────────────

  function clearLevel() {
    Object.values(meshMap).forEach(m => {
      try { (Array.isArray(m) ? m : [m]).forEach(x => x?.dispose()); } catch(_) {}
    });
    Object.keys(meshMap).forEach(k => delete meshMap[k]);
    Object.values(matCache).forEach(m => { try { m.dispose(); } catch(_) {} });
    Object.keys(matCache).forEach(k => delete matCache[k]);
    if (_cameraAnimObs) {
      try { scene.onBeforeRenderObservable.remove(_cameraAnimObs); } catch(_) {}
      _cameraAnimObs = null;
    }
  }

  function buildLevel(levelData) {
    clearLevel();
    const { width, height, grid } = levelData;
    for (let z = 0; z < height; z++)
      for (let x = 0; x < width; x++)
        _buildTile(grid[z][x], x, z);

    camera.target = new BABYLON.Vector3(
      (width  / 2) * CONSTANTS.TILE_SIZE,
      0,
      (height / 2) * CONSTANTS.TILE_SIZE
    );
    camera.radius = Math.max(24, Math.max(width, height) * 2.4);
  }

  // ── Tile builder ─────────────────────────────────────────

  function _buildTile(tileId, gx, gz) {
    const T   = CONSTANTS.TILE;
    const pos = gridToWorld(gx, gz, 0);
    const TS  = CONSTANTS.TILE_SIZE;
    const TH  = CONSTANTS.TILE_HEIGHT;
    const WH  = CONSTANTS.WALL_HEIGHT;

    const mk = suffix => `${suffix}_${gx}_${gz}`;

    const _box = (name, w, h, d) => {
      const m = BABYLON.MeshBuilder.CreateBox(name, { width:w, height:h, depth:d }, scene);
      m.receiveShadows = true;
      shadowGenerator?.addShadowCaster(m);
      return m;
    };

    const _tag = (m, tid) => {
      m.metadata = { gridX: gx, gridZ: gz, tileId: tid };
      m.getChildMeshes?.().forEach(c => {
        c.metadata = { gridX: gx, gridZ: gz, tileId: tid };
      });
    };

    // GLB clone helper (same as porta-iso)
    const _glb = (assetKey, meshName) => {
      if (typeof AssetLoader === 'undefined' || !AssetLoader.isLoaded(assetKey)) return null;
      const inst = AssetLoader.clone(assetKey, meshName);
      if (!inst) return null;
      inst.root.position   = pos.clone();
      inst.root.position.y = 0;
      inst.root.getChildMeshes(false).forEach(m => {
        if (!(m instanceof BABYLON.InstancedMesh)) m.receiveShadows = true;
        shadowGenerator?.addShadowCaster(m);
      });
      return inst;
    };

    // Slab floor helper
    const _sfloor = (tileId, meshName) => {
        const g = _glb(T.FLOOR, meshName);
        if (g) { _tag(g.root, tileId); meshMap[meshName] = g.root; }
        else {
          const f = _box(meshName, TS - 0.04, TH, TS - 0.04);
          f.position = pos.clone(); f.position.y = -TH / 2;
          f.material = getMaterial(CONSTANTS.COLOR_FLOOR);
          _tag(f, tileId); meshMap[meshName] = f;
        }
    };

    switch (tileId) {

      // ── Floor / player start ──────────────────────────────
      case T.FLOOR:
      case T.PLAYER: {
        _sfloor(tileId, mk('floor'));
        break;
      }

      // ── Indestructible wall ───────────────────────────────
      case T.WALL: {
        const g = _glb(T.WALL, mk('wall'));
        if (g) { _tag(g.root, tileId); meshMap[mk('wall')] = g.root; }
        else {
          // Floor slab under wall
          const f = _box(mk('wfloor'), TS - 0.04, TH, TS - 0.04);
          f.position = pos.clone(); f.position.y = -TH / 2;
          f.material = getMaterial(CONSTANTS.COLOR_FLOOR);
          meshMap[mk('wfloor')] = f;

          const w = _box(mk('wall'), TS, WH, TS);
          w.position = pos.clone(); w.position.y = WH / 2 - TH;
          w.material = getMaterial(CONSTANTS.COLOR_WALL);
          _tag(w, tileId); meshMap[mk('wall')] = w;
        }
        break;
      }

      // ── Soft (destructible) wall ──────────────────────────
      case T.SOFT: {
        // Floor under soft block
        _sfloor(tileId, mk('sfloor'));

        const g = _glb(T.SOFT, mk('soft'));
        if (g) { _tag(g.root, tileId); meshMap[mk('soft')] = g.root; }
        else {
          const h = WH * 0.82;
          const s = _box(mk('soft'), TS * 0.9, WH, TS * 0.9);
          s.position = pos.clone(); s.position.y = WH / 2 - TH;
          s.material = getMaterial(CONSTANTS.COLOR_SOFT_WALL);
          _tag(s, tileId); meshMap[mk('soft')] = s;

          // Accent stripe on top
          const stripe = _box(mk('soft_stripe'), TS * 0.3, 0.06, TS * 0.9);
          stripe.position = pos.clone(); stripe.position.y = WH - TH + 0.03;
          stripe.material = getMaterial(CONSTANTS.COLOR_SOFT_WALL, 0.3);
          meshMap[mk('soft_stripe')] = stripe;
        }
        break;
      }

      // ── Exit ──────────────────────────────────────────────
      case T.EXIT: {
        _sfloor(tileId, mk('efloor'));

        const g = _glb(T.EXIT, mk('exit'));
        if (g) { _tag(g.root, tileId); meshMap[mk('exit')] = g.root; }
        else {
          const ring = BABYLON.MeshBuilder.CreateTorus(mk('ring'),
            { diameter: TS * 0.44, thickness: 0.08, tessellation: 32 }, scene);
          ring.rotation.x = Math.PI / 2;
          ring.position = pos.clone(); ring.position.y = 0.05;
          ring.material = getMaterial(CONSTANTS.COLOR_EXIT, 0.45);
          _tag(ring, tileId); meshMap[mk('ring')] = ring;

          // Pulsing animation
          let t = 0;
          const obs = scene.onBeforeRenderObservable.add(() => {
            if (!meshMap[mk('ring')]) { scene.onBeforeRenderObservable.remove(obs); return; }
            t += 0.04;
            ring.scaling.setAll(0.9 + Math.abs(Math.sin(t)) * 0.15);
          });
        }
        break;
      }

      // ── Power-up upgrades ─────────────────────────────────
      case T.UPGRADE_BOMB:
      case T.UPGRADE_RANGE:
      case T.UPGRADE_SPEED: {
        _sfloor(tileId, mk('ufloor'));
        _buildUpgradeMesh(gx, gz, tileId);
        break;
      }

      // ── Enemy spawn (floor only — enemy mesh created by EnemyManager) ─
      case T.ENEMY: {
        _sfloor(tileId, mk('floor'));
        break;
      }

      // ── EMPTY / unhandled — render a plain floor slab ───────
      default: {
        // tile 0 (EMPTY) is open walkable floor — always needs a slab
        // Skip only negative or truly invalid tile IDs
        if (tileId >= 0) {
          _sfloor(tileId, mk('floor'));
        }
        break;
      }
    }
  }

  // ── Upgrade gem mesh ─────────────────────────────────────

  function _buildUpgradeMesh(gx, gz, type) {
    const pos = gridToWorld(gx, gz, 0);
    const key = `upgrade_${gx}_${gz}`;
    if (meshMap[key]) return;

    const colors = {
      [CONSTANTS.TILE.UPGRADE_BOMB]:  CONSTANTS.COLOR_UPGRADE_BOMB,
      [CONSTANTS.TILE.UPGRADE_RANGE]: CONSTANTS.COLOR_UPGRADE_RANGE,
      [CONSTANTS.TILE.UPGRADE_SPEED]: CONSTANTS.COLOR_UPGRADE_SPEED,
    };
    const col = colors[type] || '#00aaff';

    const gem = BABYLON.MeshBuilder.CreatePolyhedron(key, { type: 1, size: 0.28 }, scene);
    gem.position.set(pos.x, 0.52, pos.z);
    gem.material = getMaterial(col, 0.65);
    shadowGenerator?.addShadowCaster(gem);
    meshMap[key] = gem;

    let t = Math.random() * Math.PI * 2;
    const obs = scene.onBeforeRenderObservable.add(() => {
      if (!meshMap[key]) { scene.onBeforeRenderObservable.remove(obs); return; }
      t += 0.04;
      gem.position.y = 0.44 + Math.sin(t) * 0.14;
      gem.rotation.y = t * 0.7;
    });
  }

  function showUpgradeMesh(gx, gz, type) {
    // Place floor slab first
    const pos = gridToWorld(gx, gz, 0);
    const mk  = s => `${s}_${gx}_${gz}`;
    if (!meshMap[mk('ufloor')]) {
      const f = BABYLON.MeshBuilder.CreateBox(mk('ufloor'),
        { width: CONSTANTS.TILE_SIZE - 0.04, height: CONSTANTS.TILE_HEIGHT,
          depth: CONSTANTS.TILE_SIZE - 0.04 }, scene);
      f.position = pos.clone(); f.position.y = -CONSTANTS.TILE_HEIGHT / 2;
      f.material = getMaterial(CONSTANTS.COLOR_FLOOR);
      meshMap[mk('ufloor')] = f;
    }
    _buildUpgradeMesh(gx, gz, type);
  }

  function removeUpgradeMesh(gx, gz) {
    const key = `upgrade_${gx}_${gz}`;
    const m = meshMap[key];
    if (m) { try { m.dispose(); } catch(_) {} delete meshMap[key]; }
  }

  // ── Show exit after clearing ──────────────────────────────

  function showExitMesh(gx, gz) {
    const mk = s => `${s}_${gx}_${gz}`;
    if (meshMap[mk('ring')] || meshMap[mk('exit')]) return;
    const pos = gridToWorld(gx, gz, 0);
    const TS  = CONSTANTS.TILE_SIZE;

    if (!meshMap[mk('efloor')]) {
      const f = BABYLON.MeshBuilder.CreateBox(mk('efloor'),
        { width: TS - 0.04, height: CONSTANTS.TILE_HEIGHT, depth: TS - 0.04 }, scene);
      f.position = pos.clone(); f.position.y = -CONSTANTS.TILE_HEIGHT / 2;
      f.material = getMaterial(CONSTANTS.COLOR_EXIT, 0.15);
      meshMap[mk('efloor')] = f;
    }

    const ring = BABYLON.MeshBuilder.CreateTorus(mk('ring'),
      { diameter: TS * 0.44, thickness: 0.08, tessellation: 32 }, scene);
    ring.rotation.x = Math.PI / 2;
    ring.position = pos.clone(); ring.position.y = 0.05;
    ring.material = getMaterial(CONSTANTS.COLOR_EXIT, 0.45);
    meshMap[mk('ring')] = ring;

    let t = 0;
    const obs = scene.onBeforeRenderObservable.add(() => {
      if (!meshMap[mk('ring')]) { scene.onBeforeRenderObservable.remove(obs); return; }
      t += 0.04;
      ring.scaling.setAll(0.9 + Math.abs(Math.sin(t)) * 0.15);
    });
  }

  // ── Soft wall removal ────────────────────────────────────

  function removeSoftWallMesh(gx, gz) {
    for (const suffix of ['soft', 'soft_stripe']) {
      const key = `${suffix}_${gx}_${gz}`;
      const m = meshMap[key];
      if (m) { try { m.dispose(); } catch(_) {} delete meshMap[key]; }
    }
    // Also handle GLB variant
    const gkey = `soft_${gx}_${gz}`;
    if (meshMap[gkey]) { try { meshMap[gkey].dispose(); } catch(_) {} delete meshMap[gkey]; }
  }

  // ── Bomb mesh ─────────────────────────────────────────────

  function placeBombMesh(gx, gz, id) {
    const pos = gridToWorld(gx, gz, 0);
    const TS  = CONSTANTS.TILE_SIZE;
    const TH  = CONSTANTS.TILE_HEIGHT;
    const key = `bomb_${id}`;

    const g = (typeof AssetLoader !== 'undefined' && AssetLoader.isLoaded('bomb'))
      ? AssetLoader.clone('bomb', key) : null;

    if (g) {
      g.root.position = pos.clone();
      meshMap[key] = g.root;
      return g.root;
    }

    // Procedural bomb: dark sphere + fuse
    const body = BABYLON.MeshBuilder.CreateSphere(key,
      { diameter: TS * 0.52, segments: 8 }, scene);
    body.position.set(pos.x, TH + TS * 0.27, pos.z);
    body.material = getMaterial(CONSTANTS.COLOR_BOMB);
    shadowGenerator?.addShadowCaster(body);

    const fuse = BABYLON.MeshBuilder.CreateBox(`${key}_fuse`,
      { width: 0.07, height: 0.38, depth: 0.07 }, scene);
    fuse.parent = body;
    fuse.position.set(0.06, TS * 0.3, 0);
    fuse.rotation.z = 0.3;
    fuse.material = getMaterial(CONSTANTS.COLOR_BOMB_FUSE, 0.85);

    // Fuse flicker + scale pulse
    let t = 0;
    const obs = scene.onBeforeRenderObservable.add(() => {
      if (!meshMap[key]) { scene.onBeforeRenderObservable.remove(obs); return; }
      t += 0.18;
      body.scaling.setAll(0.9 + Math.abs(Math.sin(t * 5)) * 0.14);
    });

    meshMap[key] = body;
    return body;
  }

  function removeBombMesh(gx, gz, id) {
    const key = `bomb_${id}`;
    const m = meshMap[key];
    if (m) { try { m.dispose(); } catch(_) {} delete meshMap[key]; }
  }

  // ── Explosion mesh ────────────────────────────────────────

  function showExplosionMesh(gx, gz, type) {
    const pos = gridToWorld(gx, gz, 0);
    const key = `expl_${gx}_${gz}`;
    if (meshMap[key]) return;

    const TS   = CONSTANTS.TILE_SIZE;
    const TH   = CONSTANTS.TILE_HEIGHT;
    const size = type === 'center' ? TS * 0.98 : TS * 0.65;

    const base = BABYLON.MeshBuilder.CreateBox(key,
      { width: size, height: 0.2, depth: size }, scene);
    base.position.set(pos.x, TH + 0.1, pos.z);
    base.material = getMaterial(CONSTANTS.COLOR_EXPLOSION, 0.85);

    const core = BABYLON.MeshBuilder.CreateBox(`${key}_core`,
      { width: size * 0.45, height: 0.26, depth: size * 0.45 }, scene);
    core.position.set(pos.x, TH + 0.23, pos.z);
    core.material = getMaterial(CONSTANTS.COLOR_EXPLOSION_2, 1.0);

    meshMap[key]           = base;
    meshMap[`${key}_core`] = core;
  }

  function removeExplosionMesh(gx, gz) {
    for (const suffix of ['', '_core']) {
      const key = `expl_${gx}_${gz}${suffix}`;
      const m = meshMap[key];
      if (m) { try { m.dispose(); } catch(_) {} delete meshMap[key]; }
    }
  }

  // ── Player mesh ──────────────────────────────────────────
  // (identical pattern to porta-iso — GLB first, procedural fallback)

  function setPlayerMesh(gx, gz, layerIdx = 0) {
    const key    = 'player_mesh';
    const pos    = gridToWorld(gx, gz, 0);

    if (!meshMap[key]) {
      const glb = AssetLoader?.isLoaded('player')
        ? AssetLoader.clone('player', key) : null;

      if (glb) {
        glb.root.position = pos.clone();
        shadowGenerator?.addShadowCaster(glb.root);
        glb.root.getChildMeshes().forEach(m => shadowGenerator?.addShadowCaster(m));
        meshMap[key]          = glb.root;
        meshMap[key + '_glb'] = glb;
        return;
      }

      // Procedural: body + head + eyes
      const TS   = CONSTANTS.TILE_SIZE;
      const body = BABYLON.MeshBuilder.CreateCylinder(`${key}_body`, {
        diameterTop: 0.52, diameterBottom: 0.64, height: 1.32, tessellation: 12,
      }, scene);
      body.position.set(pos.x, TS * 0.45, pos.z);
      body.material = getMaterial(CONSTANTS.COLOR_PLAYER);
      shadowGenerator?.addShadowCaster(body);

      const head = BABYLON.MeshBuilder.CreateSphere(`${key}_head`,
        { diameter: 0.54, segments: 8 }, scene);
      head.parent = body; head.position.y = 0.98;
      head.material = getMaterial(CONSTANTS.COLOR_PLAYER, 0.12);

      for (const sx of [-0.14, 0.14]) {
        const eye = BABYLON.MeshBuilder.CreateSphere(`${key}_eye${sx}`,
          { diameter: 0.1, segments: 6 }, scene);
        eye.parent = head;
        eye.position.set(sx, 0.06, 0.22);
        eye.material = getMaterial('#111111');
      }

      meshMap[key] = body;
    } else {
      const isGLB = !!meshMap[key + '_glb'];
      const targetY = isGLB ? 0 : CONSTANTS.TILE_SIZE * 0.45;
      meshMap[key].position.set(pos.x, targetY, pos.z);
    }
  }

  function animatePlayerTo(gx, gz, layerIdx, onDone) {
    const key  = 'player_mesh';
    const mesh = meshMap[key];
    if (!mesh) { onDone?.(); return; }

    const isGLB  = !!meshMap[key + '_glb'];
    const start  = mesh.position.clone();
    const target = new BABYLON.Vector3(
      gx * CONSTANTS.TILE_SIZE,
      isGLB ? 0 : CONSTANTS.TILE_SIZE * 0.45,
      gz * CONSTANTS.TILE_SIZE
    );
    const STEPS = 10; let frame = 0;

    const obs = scene.onBeforeRenderObservable.add(() => {
      frame++;
      const t   = frame / STEPS;
      const arc = Math.sin(t * Math.PI) * 0.15;
      mesh.position.x = start.x + (target.x - start.x) * t;
      mesh.position.z = start.z + (target.z - start.z) * t;
      mesh.position.y = start.y + (target.y - start.y) * t + arc;
      if (frame >= STEPS) {
        mesh.position.copyFrom(target);
        scene.onBeforeRenderObservable.remove(obs);
        onDone?.();
      }
    });
  }

  function rotatePlayerMesh(dir) {
    try {
      const mesh = meshMap['player_mesh'];
      if (!mesh) return;
      if (mesh.rotationQuaternion) {
        mesh.rotation = mesh.rotationQuaternion.toEulerAngles();
        mesh.rotationQuaternion = null;
      }
      const isGLB = !!meshMap['player_mesh_glb'];
      let angle = 0;
      if (!isGLB) {
        if      (dir.dx ===  1) angle =  Math.PI * 0.25;
        else if (dir.dx === -1) angle = -Math.PI * 0.75;
        else if (dir.dz ===  1) angle =  Math.PI * 0.75;
        else if (dir.dz === -1) angle = -Math.PI * 0.25;
      } else {
        if      (dir.dx ===  1) angle =  Math.PI * 0.5;
        else if (dir.dx === -1) angle = -Math.PI * 0.5;
        else if (dir.dz ===  1) angle =  0;
        else if (dir.dz === -1) angle =  Math.PI;
      }
      mesh.rotation.y = angle;
    } catch(_) {}
  }

  function playerDeathFlash() {
    const mesh = meshMap['player_mesh'];
    if (!mesh) return;
    let t = 0;
    const orig  = mesh.material;
    const flash = getMaterial('#ff2244', 0.9);
    const obs = scene.onBeforeRenderObservable.add(() => {
      t++;
      mesh.material = (t % 4 < 2) ? flash : orig;
      const s = Math.max(0, 1 - t / 30);
      mesh.scaling.setAll(s);
      if (t >= 28) {
        scene.onBeforeRenderObservable.remove(obs);
        const m = meshMap['player_mesh'];
        if (m) { try { m.dispose(); } catch(_) {} delete meshMap['player_mesh']; }
      }
    });
  }

  // ── Enemy mesh ────────────────────────────────────────────

  /**
 * Change the 'color' material on an enemy GLB to a new hex color.
 * Works for both PBRMaterial (glTF import) and StandardMaterial.
 */
  function _setEnemyColor(mesh, hex) {
    if (!mesh) return;
    const col = hex2color3(hex);
    mesh.getChildMeshes(false).forEach(m => {
      if (!m.material || m.material.name !== 'color') return;
      const mat = m.material;
      if (mat.albedoColor !== undefined) {
        // PBRMaterial (standard GLB import)
        mat.albedoColor  = col.toColor4
          ? new BABYLON.Color3(col.r, col.g, col.b)
          : col;
        mat.emissiveColor = col.scale(0.15);
      } else if (mat.diffuseColor !== undefined) {
        // StandardMaterial fallback
        mat.diffuseColor  = col;
        mat.emissiveColor = col.scale(0.15);
      }
    });
  }

  function createEnemyMesh(gx, gz, id) {
    const key = `enemy_${id}`;
    const pos = gridToWorld(gx, gz, 0);
    const TS  = CONSTANTS.TILE_SIZE;
    
    const enemyColor = randomHex2color3(CONSTANTS.COLOR_ENEMY, 0.22);

    const glb = (typeof AssetLoader !== 'undefined' && AssetLoader.isLoaded('enemy'))
      ? AssetLoader.clone('enemy', key) : null;

    if (glb) {
      glb.root.position = pos.clone();
      shadowGenerator?.addShadowCaster(glb.root);
      glb.root.getChildMeshes().forEach(m => shadowGenerator?.addShadowCaster(m));
      // Change color of enemy
      _setEnemyColor(glb.root, enemyColor);
      meshMap[key]          = glb.root;
      meshMap[`${key}_glb`] = glb;
      return glb.root;
    }

    // Procedural enemy: red cylinder + head + angry brow
    const body = BABYLON.MeshBuilder.CreateCylinder(`${key}_body`, {
      diameterTop: 0.42, diameterBottom: 0.56, height: 1.1, tessellation: 12,
    }, scene);
    body.position.set(pos.x, TS * 0.38, pos.z);
    body.material = getMaterial(enemyColor);
    shadowGenerator?.addShadowCaster(body);

    const head = BABYLON.MeshBuilder.CreateSphere(`${key}_head`,
      { diameter: 0.49, segments: 8 }, scene);
    head.parent = body; head.position.y = 0.8;
    head.material = getMaterial(enemyColor, 0.22);

    const brow = BABYLON.MeshBuilder.CreateBox(`${key}_brow`,
      { width: 0.4, height: 0.07, depth: 0.08 }, scene);
    brow.parent = head; brow.position.set(0, 0.15, 0.2);
    brow.rotation.z = 0.25;
    brow.material = getMaterial('#220000');

    for (const sx of [-0.12, 0.12]) {
      const eye = BABYLON.MeshBuilder.CreateSphere(`${key}_eye${sx}`,
        { diameter: 0.09, segments: 5 }, scene);
      eye.parent = head; eye.position.set(sx, 0.04, 0.21);
      eye.material = getMaterial('#ffdd00', 0.4);
    }

    meshMap[key] = body;
    return body;
  }

  function animateEnemyTo(id, gx, gz) {
    const key  = `enemy_${id}`;
    const mesh = meshMap[key];
    if (!mesh) return;

    const isGLB  = !!meshMap[`${key}_glb`];
    const target = new BABYLON.Vector3(
      gx * CONSTANTS.TILE_SIZE,
      isGLB ? 0 : CONSTANTS.TILE_SIZE * 0.38,
      gz * CONSTANTS.TILE_SIZE
    );
    const start = mesh.position.clone();
    const STEPS = 8; let frame = 0;

    const obs = scene.onBeforeRenderObservable.add(() => {
      frame++;
      const t = frame / STEPS;
      mesh.position.x = start.x + (target.x - start.x) * t;
      mesh.position.z = start.z + (target.z - start.z) * t;
      if (frame >= STEPS) {
        mesh.position.copyFrom(target);
        scene.onBeforeRenderObservable.remove(obs);
      }
    });
  }

  function removeEnemyMesh(id) {
    const key = `enemy_${id}`;
    const m = meshMap[key];
    if (m) { try { m.dispose(); } catch(_) {} delete meshMap[key]; }
  }

  // ── Public API ───────────────────────────────────────────

  return {
    init, buildLevel, clearLevel, gridToWorld,

    // Player
    setPlayerMesh, animatePlayerTo, rotatePlayerMesh, playerDeathFlash,

    // Bomb / explosion
    placeBombMesh, removeBombMesh,
    showExplosionMesh, removeExplosionMesh,

    // Level objects
    removeSoftWallMesh, showExitMesh,
    showUpgradeMesh, removeUpgradeMesh,

    // Enemies
    createEnemyMesh, animateEnemyTo, removeEnemyMesh,

    // Camera
    toggleOrbit,
    isOrbitUnlocked: () => _orbitUnlocked,

    // Accessors
    getScene:  () => scene,
    getEngine: () => engine,
    getCamera: () => camera,

    // AR passthrough (called by arManager)
    setARTransparent(transparent) {
      if (transparent) {
        scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
        scene.autoClear  = false;
      } else {
        scene.clearColor = new BABYLON.Color4(0.04, 0.04, 0.07, 1);
        scene.autoClear  = true;
      }
    },

    setShadowsEnabled(enabled) {
      if (shadowGenerator)
        shadowGenerator.getShadowMap().refreshRate = enabled ? 1 : 0;
    },

    // Stubs kept so arManager / uiManager don't crash
    setActiveLayer() {},
    getLayerY: () => 0,
  };
})();
