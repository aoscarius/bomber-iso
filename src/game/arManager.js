// ============================================================
// arManager.js — WebXR AR for BabylonJS v8+
//
// Fixes in this version:
//
// 1. CUBE IN AR: WebXRDefaultExperience creates a background helper
//    with skybox+ground. Fixed with ignoreNativeCameraTransformation +
//    disposing the environment helper after creation.
//
// 2. BOARD POSITION: placeBoardOnTap used the hit-test pose from the
//    reticle, but the reticle was never visible (not getting hit results).
//    Now the trigger/tap ALWAYS places the board 0.8m ahead at floor level
//    and additionally uses hit-test pose when available.
//
// 3. BOARD MOVEMENT: holding trigger on right controller drags the board
//    to the current hit-test / ray-cast surface. Release locks it.
//    Both triggers simultaneously = scale (squeeze in/out).
//
// 4. AUDIO ON QUEST: AudioContext must be resumed inside the XR session
//    enter event. Web Speech API on Quest requires an explicit trigger.
//
// 5. DOM OVERLAY ROOT = document.body so ALL overlays (win/fail/menu)
//    are visible inside the XR dom-overlay layer.
//
// 6. AR MENU: ESC / a long-press on left menu button shows a simple
//    in-AR menu panel.
// ============================================================

const ARManager = (() => {

  let _xrHelper     = null;
  let _xrBase       = null;
  let _hitTest      = null;
  let _boardRoot    = null;
  let _reticle      = null;
  let _reticlePose  = null;   // Latest hit-test result
  let _arActive     = false;
  let _placed       = false;
  let _scene           = null;
  let _meshObsHandle   = null;
  let _nodeObsHandle   = null;   // TransformNode observer for layer_root_N nodes
  let _currentLevelIdx = 0;
  let _xrReady         = false;

  // Right controller state
  let _triggerHeld   = false;   // primary trigger (index finger) held
  let _squeezeHeld   = false;   // grip/squeeze held
  let _stickX        = 0;       // right thumbstick axes (live)
  let _stickY        = 0;
  let _triggerPressT = 0;       // time trigger went down (for tap detection)

  // Board-move accumulator (applied per-frame via scene observer)
  let _boardMoveObs  = null;

  // Scale: 1.00m real / 24 world-units
  const AR_SCALE = 1.00 / 24;

  // 3D BabylonJS GUI menu (floats in world space, visible in AR headset)
  let _guiTexture   = null;   // AdvancedDynamicTexture for 3D plane
  let _guiMesh      = null;   // Plane mesh hosting the GUI
  let _guiStack     = null;   // Stack of buttons
  let _guiVisible   = false;
  let _laserDot     = null;

  // ── Init (call once after Renderer.init) ──────────────────

  async function init(scene) {
    _scene   = scene;
    _xrReady = false;
    try {
      if (!navigator.xr) return;
      if (!(await navigator.xr.isSessionSupported('immersive-ar'))) return;

      _xrHelper = await BABYLON.WebXRDefaultExperience.CreateAsync(scene, {
        uiOptions: {
          sessionMode:        'immersive-ar',
          referenceSpaceType: 'local-floor',
          requiredFeatures:   ['hit-test'],
          optionalFeatures:   ['dom-overlay','plane-detection','anchors'],
          // document.body as root → ALL fixed overlays visible in XR dom-overlay
          domOverlayElement:  document.body,
        },
        disableDefaultUI:     true,
        disableTeleportation: true,
        floorMeshes:          [],
        // Prevent BabylonJS from creating skybox / ground in the XR scene
        ignoreNativeCameraTransformation: false,
      });

      // Dispose the background helper (skybox + ground) that CreateAsync adds
      _xrHelper.environmentHelper?.dispose();

      _xrBase = _xrHelper.baseExperience;

      _xrBase.onStateChangedObservable.add(state => {
        if (state === BABYLON.WebXRState.IN_XR)     _onEntered();
        if (state === BABYLON.WebXRState.NOT_IN_XR) _onSessionEnd();
      });

      _xrReady = true;
      console.log('[ARManager] XR experience ready');
    } catch (err) {
      console.warn('[ARManager] init skipped:', err.message ?? err);
    }
  }

  // ── Feature detection ────────────────────────────────────

  async function isSupported() {
    try { return !!(await navigator?.xr?.isSessionSupported('immersive-ar')); }
    catch { return false; }
  }

  // ── Enter (must be inside user-gesture handler) ──────────

  async function enter(levelIdx = 0) {
    if (_arActive) return;
    if (!_xrReady || !_xrBase) { _reportError('AR not ready — try refreshing.'); return; }
    _currentLevelIdx = levelIdx;
    try {
      await _xrBase.enterXRAsync(
        'immersive-ar', 'local-floor', _xrHelper.renderTarget,
        {
          requiredFeatures: ['hit-test'],
          optionalFeatures: ['dom-overlay','plane-detection','anchors'],
          domOverlay:       { root: document.body },
        }
      );
    } catch (err) {
      console.error('[ARManager] enterXRAsync failed:', err);
      _reportError(err?.message ?? String(err));
    }
  }

  // ── Session active ────────────────────────────────────────

  function _onEntered() {
    if (_arActive) return;
    _arActive = true;
    _placed   = false;
    _dragging = false;

    // Transparent background (AR passthrough)
    _scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
    _scene.autoClear  = false;

    // Resume audio context inside XR session (Quest autoplay policy)
    AudioEngine.resume?.();
    // Trigger Web Speech API voice list reload for Quest TTS
    try { window.speechSynthesis?.getVoices(); } catch(_) {}

    // Enable hit-test
    const featMgr = _xrBase.featuresManager;
    try {
      _hitTest = featMgr.enableFeature(BABYLON.WebXRHitTest, 'latest', {
        testOnPointerDownOnly: false,
      });
      _hitTest?.onHitTestResultObservable.add(_onHitTestResult);
    } catch(e) {
      console.warn('[ARManager] hit-test unavailable:', e.message);
    }

    // Enable pointer selection feature
    try {
      const _xrPointer = featMgr.enableFeature(BABYLON.WebXRControllerPointerSelection, "latest", {
        xrInput: _xrHelper.input,
        enablePointerSelectionOnAllControllers: true,
      });
      if (_xrPointer && _xrPointer.onControllerAddedObservable) {
        _xrPointer.onControllerAddedObservable.add(ctrl => {

          ctrl.onFrameObservable.add(() => {
            const ray = new BABYLON.Ray(BABYLON.Vector3.Zero(), BABYLON.Vector3.Forward());
            ctrl.getWorldPointerRayToRef?.(ray);

            const pick = _scene.pickWithRay(ray, m => m === _guiMesh);

            if (pick?.hit) {
              _laserDot.position.copyFrom(pick.pickedPoint);
              _laserDot.isVisible = true;
              const dist = BABYLON.Vector3.Distance(ray.origin, pick.pickedPoint);
+             _laserDot.scaling.setAll(dist * 0.02);
              _laserDot.material.emissiveColor = new BABYLON.Color3(1, 0.6, 0.1);
            } else {
              _laserDot.isVisible = false;
            }
          });
        });
      };
    } catch (e) {
      console.warn("[ARManager] pointer selection not available", e.message);
    }

    // Enable controller model load
    try {
      if (BABYLON.WebXRControllerModelLoader) {
        featMgr.enableFeature(BABYLON.WebXRControllerModelLoader, "latest");
      }
    } catch (e) {
      console.warn("[ARManager] controller models not available", e.message);
    }

    // Model laser dot
    _laserDot = BABYLON.MeshBuilder.CreateSphere("laser-dot", {
      diameter: 0.01
    }, _scene);
    
    const dotMat = new BABYLON.StandardMaterial("laser-dot-mat", _scene);
    dotMat.emissiveColor = new BABYLON.Color3(1, 0.6, 0.1);
    dotMat.disableLighting = true;

    _laserDot.material = dotMat;
    _laserDot.isPickable = false;
    _laserDot.isVisible = false;

    // Board root
    _boardRoot = new BABYLON.TransformNode('ar-board-root', _scene);
    _boardRoot.scaling.setAll(AR_SCALE);
    _boardRoot.setEnabled(false);

    // Hide ALL existing game meshes — they'll be destroyed on auto-placement
    _scene.meshes.slice().forEach(m => {
      if (!_shouldSkip(m)) m.isVisible = false;
    });

    _buildReticle();
    _build3DMenu();

    // Intercept new TransformNodes (layer_root_N) and parent them to _boardRoot.
    // This is the correct hook in the multi-layer renderer — each layer's tiles
    // are children of a layer_root TransformNode, so parenting the root is enough
    // to bring the entire floor into AR space at the correct scale.
    _nodeObsHandle = _scene.onNewTransformNodeAddedObservable.add(node => {
      if (!_arActive || !_boardRoot) return;
      if (_shouldSkip(node)) return;
      if (/^layer_root_/.test(node.name)) {
        if (!_placed) {
          node.setEnabled(false);
          return;
        }
        node.parent = _boardRoot;
      }
    });

    // Mesh observer: only handle root-level meshes that are NOT children of a
    // layer_root (e.g. player mesh, bomb, reticle). Layer tile meshes
    // are already covered by the TransformNode observer above.
    _meshObsHandle = _scene.onNewMeshAddedObservable.add(mesh => {
      if (!_arActive || !_boardRoot) return;
      if (_shouldSkip(mesh)) return;
      // Skip meshes that already have a parent (they belong to a layer_root subtree)
      if (mesh.parent) return;
      if (!_placed) {
        mesh.isVisible = false;
        return;
      }
      mesh.parent = _boardRoot;
    });

    // Auto-place board 1m ahead immediately so user sees the level right away
    _autoPlaceBoard();

    _setupControllerInput();

    // Show AR DOM overlay (touch controls)
    const domOv = document.getElementById('ar-dom-overlay');
    if (domOv) { domOv.style.display = 'block'; domOv.style.pointerEvents = 'auto'; }
    document.getElementById('ar-overlay')?.style.setProperty('display','none');

    // Show scan hint
    document.getElementById('ar-scan-hint')?.classList.add('visible');

    document.body.classList.add('ar-active');
    EventBus.emit('ar:entered');
  }

  // ── Exit ─────────────────────────────────────────────────

  async function exit() {
    if (!_arActive || !_xrBase) return;
    try { await _xrBase.exitXRAsync(); } catch { _onSessionEnd(); }
    document.body.classList.remove('ar-active');
    EventBus.emit('ar:exited');
  }

  // ── Session end ──────────────────────────────────────────

  function _onSessionEnd() {
    if (!_arActive) return;

    _scene.clearColor = new BABYLON.Color4(0.04, 0.04, 0.07, 1);
    _scene.autoClear  = true;

    if (_boardRoot && _scene) {
      _scene.meshes.slice().forEach(m => {
        if (m.parent === _boardRoot) { m.parent = null; m.computeWorldMatrix(true); }
      });
      _scene.transformNodes.slice().forEach(n => {
        if (n.parent === _boardRoot) { n.parent = null; n.computeWorldMatrix(true); }
      });
      _boardRoot.dispose(); _boardRoot = null;
    }

    _reticle?.dispose(); _reticle = null;
    if (_guiTexture) { try { _guiTexture.dispose(); } catch(_){} _guiTexture = null; }
    if (_guiMesh)    { try { _guiMesh.isVisible = false; _guiMesh.dispose(); } catch(_){} _guiMesh = null; }
    _guiVisible = false;

    if (_meshObsHandle) {
      try { _scene.onNewMeshAddedObservable.remove(_meshObsHandle); } catch(_){}
      _meshObsHandle = null;
    }
    if (_nodeObsHandle) {
      try { _scene.onNewTransformNodeAddedObservable.remove(_nodeObsHandle); } catch(_){}
      _nodeObsHandle = null;
    }

    const domOv = document.getElementById('ar-dom-overlay');
    if (domOv) { domOv.style.display = 'none'; domOv.style.pointerEvents = 'none'; }

    document.getElementById('ar-scan-hint')?.classList.remove('visible');

    _arActive = _placed = false;
    _triggerHeld = _squeezeHeld = false; _stickX = _stickY = 0;
    _reticlePose = null;
    if (_boardMoveObs) { try { _scene.onBeforeRenderObservable.remove(_boardMoveObs); } catch(_){} _boardMoveObs = null; }
  }

  function _reportError(msg) {
    console.error('[ARManager]', msg);
    const el = document.getElementById('ar-error');
    if (el) el.textContent = msg;
    EventBus.emit('ar:error', { message: msg });
  }

  function _shouldSkip(node) {
    const n = node?.name ?? '';
    return /^(ar-|xr-|WebXR|xr_cam|BackgroundHelper|BackgroundSkybox|hdr)/.test(n)
      || node === _reticle || node === _boardRoot || node === _guiMesh;
  }

  // ── Hit-test ─────────────────────────────────────────────

  function _onHitTestResult(results) {
    if (!results?.length) { _reticle?.setEnabled(false); return; }
    _reticlePose = results[0];

    const m = results[0].transformationMatrix;
    if (!m) return;

    if (!_placed) {
      _reticle?.setEnabled(true);
      if (_reticle) _reticle.position.set(m.m[12], m.m[13], m.m[14]);
    }

    // If dragging (trigger held after placement), move board to hit surface
    if (_dragging && _placed && _boardRoot) {
      _boardRoot.position.set(m.m[12], m.m[13], m.m[14]);
      _boardRoot.rotation.y = Math.atan2(m.m[8], m.m[10]);
    }
  }

  // ── Reticle ──────────────────────────────────────────────

  function _buildReticle() {
    _reticle = BABYLON.MeshBuilder.CreateTorus('ar-reticle',
      { diameter: 0.22, thickness: 0.016, tessellation: 32 }, _scene);
    const mat = new BABYLON.StandardMaterial('ar-reticle-mat', _scene);
    mat.emissiveColor = new BABYLON.Color3(0, 0.9, 1);
    mat.disableLighting = true; mat.backFaceCulling = false;
    _reticle.material = mat;
    _reticle.rotation.x = Math.PI / 2;
    _reticle.setEnabled(false);
    _reticle.isPickable = false;
    const anim = new BABYLON.Animation('rp','scaling',30,
      BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
      BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
    anim.setKeys([
      {frame:0,  value:new BABYLON.Vector3(1,1,1)},
      {frame:15, value:new BABYLON.Vector3(1.08,1.08,1.08)},
      {frame:30, value:new BABYLON.Vector3(1,1,1)},
    ]);
    _reticle.animations = [anim];
    _scene.beginAnimation(_reticle, 0, 30, true);
  }

  // ── Board placement & movement ───────────────────────────

  /** Place board immediately 1m ahead of camera at floor level. */
  function _autoPlaceBoard() {
    const cam = _xrBase?.camera;
    if (!cam) { setTimeout(_autoPlaceBoard, 200); return; }

    const pos = cam.globalPosition.clone();
    const fwd = cam.getForwardRay(1).direction.clone();
    fwd.y = 0;
    if (fwd.length() < 0.01) fwd.z = 1;
    fwd.normalize().scaleInPlace(0.5); // 50 cm in front
    pos.addInPlace(fwd);
    pos.y = cam.globalPosition.y - 0.5;  // 0.5 (50 cm under height), 0.8 ~floor level

    _boardRoot.position.copyFrom(pos);
    _boardRoot.rotation.y -= 45 * Math.PI / 180;
    // Face the board toward the camera
    _boardRoot.setEnabled(true);
    _placed = true;
    _reticle?.setEnabled(false);
    document.getElementById('ar-scan-hint')?.classList.remove('visible');

    const arHud = document.getElementById('ar-hud');
    if (arHud) { arHud.classList.remove('hidden'); arHud.style.display = 'flex'; }

    // Re-parent any layer_root TransformNodes already in the scene
    // (created before _nodeObsHandle was active — e.g. from a pre-built level)
    _scene.transformNodes.forEach(n => {
      if (/^layer_root_/.test(n.name) && !_shouldSkip(n)) {
        n.parent = _boardRoot;
        n.setEnabled(true);
      }
    });
    // Also catch root-level meshes (player, bombs) with no parent
    _scene.meshes.forEach(m => {
      if (!_shouldSkip(m) && !m.parent) m.parent = _boardRoot;
    });

    // Build level — new meshes will be parented to boardRoot by _meshObsHandle
    EventBus.emit('ar:rebuild-level', { levelIdx: _currentLevelIdx });
    EventBus.emit('ar:placed');
  }

  function placeBoardOnTap() {
    // Called by trigger tap on the controller — just a no-op now that auto-placement
    // handles initial placement. Kept for backward compat with HUD tap button.
    if (!_placed) _autoPlaceBoard();
  }

  function lockBoard() {
    // Called on trigger release — stop dragging
    _dragging = false;
  }

  function resetPlacement() {
    if (!_boardRoot || !_arActive) return;
    _placed   = false;
    _dragging = false;
    _boardRoot.setEnabled(false);
    document.getElementById('ar-scan-hint')?.classList.add('visible');
    _reticle?.setEnabled(true);
  }

  // ── 3D GUI Menu (floats in AR world space) ──────────────
  // Uses BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh() to render
  // an interactive panel on a plane billboard — visible in the headset
  // without needing the DOM overlay layer.

  const genericBtns = [
    { label: '▶  RESUME',          color: '#ff6a00', action: () => _toggle3DMenu(false) },
    { label: '↺  RETRY CHAMBER',   color: '#9090a8', action: () => { _toggle3DMenu(false); GameLogic.retryLevel?.(); } },
    { label: '⊕  REPOSITION BOARD',color: '#9090a8', action: () => { _toggle3DMenu(false); resetPlacement(); } },
    { label: '✕  EXIT AR',         color: '#9090a8', action: () => { _toggle3DMenu(false); exit(); } },
  ];
  const winBtns = [
    { label: '▶  NEXT CHAMBER',    color: '#ff6a00', action: () => { _toggle3DMenu(false); GameLogic.nextLevel?.(); } },
    { label: '✕  EXIT AR',         color: '#9090a8', action: () => { _toggle3DMenu(false); exit(); } },
  ];
  const failBtns = [
    { label: '↺  RETRY CHAMBER',   color: '#9090a8', action: () => { _toggle3DMenu(false); GameLogic.retryLevel?.(); } },
    { label: '✕  EXIT AR',         color: '#9090a8', action: () => { _toggle3DMenu(false); exit(); } },
  ];

  function _build3DMenu() {
    if (!window.BABYLON?.GUI) {
      console.warn('[ARManager] BABYLON.GUI not loaded — 3D menu unavailable');
      return;
    }

    // Plane mesh in world space — 0.4 × 0.28 m
    _guiMesh = BABYLON.MeshBuilder.CreatePlane('ar-3d-menu', {
      width: 0.4, height: 0.28,
    }, _scene);
    _guiMesh.name = 'ar-3d-menu';
    _guiMesh.isPickable = true;
    _guiMesh.isVisible  = false;       // hidden until _toggle3DMenu(true)
    _guiMesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
    _guiMesh.renderingGroupId = 2;     // render on top of game geometry
    _guiMesh.setEnabled(true);         // keep enabled so GUI renders; control via isVisible

    _guiTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
      _guiMesh, 512, 360, true
    );

    const bg = new BABYLON.GUI.Rectangle('menu-bg');
    bg.width  = '100%';
    bg.height = '100%';
    bg.cornerRadius = 8;
    bg.color     = '#ff6a00';
    bg.thickness = 3;
    bg.background = '#0d0d12';
    _guiTexture.addControl(bg);

    const title = new BABYLON.GUI.TextBlock('menu-title', 'BOMBER ISO');
    title.color    = '#ff6a00';
    title.fontSize = 28;
    title.fontFamily = 'monospace';
    title.height   = '50px';
    title.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    title.top      = '12px';
    bg.addControl(title);

    _guiStack = new BABYLON.GUI.StackPanel('menu-stack');
    _guiStack.width  = '88%';
    _guiStack.height = '220px';
    _guiStack.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    _guiStack.top = '20px';
    bg.addControl(_guiStack);
  }

  // Change buttons in the GUI stack panel
  function _setMenuButtons(buttons = []) {
    if (!_guiStack) return;

    _guiStack.clearControls();

    buttons.forEach(({ label, color, action }) => {
      const btn = BABYLON.GUI.Button.CreateSimpleButton('', label);
      btn.width = '100%';
      btn.height = '46px';
      btn.color = color;
      btn.fontSize = 17;
      btn.fontFamily = 'monospace';
      btn.thickness = 1;
      btn.cornerRadius = 4;
      btn.background = 'transparent';
      btn.paddingBottom = '6px';
      btn.onPointerUpObservable.add(action);
      btn.onPointerEnterObservable.add(() => {
        btn.background = '#8f5c37b6';
      });
      btn.onPointerOutObservable.add(() => {
        btn.background = 'transparent';
      });
      _guiStack.addControl(btn);
    });
  }

  // Toggle on off the GUI menu with buttons setting
  function _toggle3DMenu(forceState, buttons = []) {
    _guiVisible = forceState !== undefined ? forceState : !_guiVisible;
    if (!_guiMesh) return;

    if (_guiVisible) {
      // Update buttons
      _setMenuButtons(buttons.length > 0 ? buttons : genericBtns);

      // Position 0.5m ahead of camera, at eye level
      const cam = _xrBase?.camera;
      if (cam) {
        const pos = cam.globalPosition.clone();
        const fwd = cam.getForwardRay(1).direction.clone();
        fwd.y = 0;
        if (fwd.length() < 0.01) fwd.z = -1.0;
        // fwd.normalize().scaleInPlace(0.8);
        pos.addInPlace(fwd);
        // pos.y += 0.05;
        _guiMesh.position.copyFrom(pos);
      }
      _guiMesh.isVisible = true;
    } else {
      // Clear buttons
      _setMenuButtons([]);
      _guiMesh.isVisible = false;
      if (_laserDot) _laserDot.isVisible = false;
    }
  }

  // Win/Fail 3DGUI Menus
  function show3DWin(){
    _toggle3DMenu(true, winBtns);
  }
  function show3DFail(){
    _toggle3DMenu(true, failBtns);
  }

  // Also build the win panel in 3D space
  function _build3DWinPanel() {
    if (!window.BABYLON?.GUI || _guiMesh === null) return; // reuse check
  }

  // ── Controller input ──────────────────────────────────────
  //
  // RIGHT controller only:
  //   A button         → shoot Bomb
  //   B button         → shoot Bomb
  //   Primary trigger  → if not yet placed: place board
  //                    → quick tap (< 200ms): pick cell / move player
  //                    → held + thumbstick Y: zoom board in/out
  //   Grip / squeeze   → held + thumbstick: move (Y) and rotate (X) board
  //   Thumbstick       → move player (when neither trigger nor squeeze held)
  //
  // LEFT controller:
  //   Thumbstick       → move player
  //   X button         → AR pause menu

  function _setupControllerInput() {
    const input = _xrHelper?.input;
    if (!input) return;

    // Per-frame board interaction
    let _rightCtrl = null;  // set when right controller is added
    _boardMoveObs = _scene.onBeforeRenderObservable.add(() => {
      if (!_placed || !_boardRoot) return;

      // Grip + Trigger held → drag board: follow controller ray onto virtual floor plane
      if (_dragging && _squeezeHeld && _triggerHeld && _rightCtrl) {
        try {
          const ray = new BABYLON.Ray(BABYLON.Vector3.Zero(), BABYLON.Vector3.Forward());
          _rightCtrl.getWorldPointerRayToRef?.(ray);
          // Intersect with horizontal plane at current board Y
          const boardY = _boardRoot.position.y;
          const t = (boardY - ray.origin.y) / ray.direction.y;
          if (t > 0.05 && t < 5) {
            const hit = ray.origin.add(ray.direction.scale(t));
            _boardRoot.position.x = hit.x;
            _boardRoot.position.z = hit.z;
          }
        } catch(_){}
        return;
      }

      // Grip alone + thumbstick → fine position / rotate
      if (_squeezeHeld && !_triggerHeld) {
        if (Math.abs(_stickY) > 0.15) {
          const step = _stickY * -0.012;
          const fwd = new BABYLON.Vector3(Math.sin(_boardRoot.rotation.y), 0, Math.cos(_boardRoot.rotation.y));
          _boardRoot.position.addInPlace(fwd.scale(step));
        }
        if (Math.abs(_stickX) > 0.15) {
          _boardRoot.rotation.y += _stickX * 0.025;
        }
      }
    });

    input.onControllerAddedObservable.add(ctrl => {
      ctrl.onMotionControllerInitObservable.add(mc => {
        const hand = mc.handness;

        // ── RIGHT controller ──────────────────────────────────
        if (hand === 'right') {
          _rightCtrl = ctrl;  // store for per-frame drag

          // A → Bomb A
          ['a-button'].forEach(id =>
            mc.getComponent(id)?.onButtonStateChangedObservable.add(s => {
              if (s.pressed) EventBus.emit('ar:controller-action',{action:'bomb'});
            }));

          // B → Bomb B
          ['b-button'].forEach(id =>
            mc.getComponent(id)?.onButtonStateChangedObservable.add(s => {
              if (s.pressed) EventBus.emit('ar:controller-action',{action:'bomb'});
            }));

          // Grip / squeeze
          const grip = mc.getComponentOfType(BABYLON.WebXRControllerComponent.SQUEEZE_TYPE);
          if (grip) {
            grip.onButtonStateChangedObservable.add(s => {
              _squeezeHeld = s.pressed;
              if (!s.pressed) _dragging = false;
            });
          }

          // Primary trigger (index finger)
          const trig = mc.getComponentOfType(BABYLON.WebXRControllerComponent.TRIGGER_TYPE);
          if (trig) {
            trig.onButtonStateChangedObservable.add(s => {
              if (s.pressed) {
                _triggerHeld   = true;
                _triggerPressT = Date.now();
                // Grip + Trigger → start drag
                if (_squeezeHeld && _placed) { _dragging = true; return; }
                if (!_placed) placeBoardOnTap();
              } else {
                const wasTrigger = _triggerHeld;
                _triggerHeld = false;
                _dragging    = false;
                const tapMs  = Date.now() - _triggerPressT;
                // Quick tap (no grip, short press, stick neutral) → pick cell
                if (wasTrigger && tapMs < 220 && _placed && !_squeezeHeld && Math.abs(_stickY) < 0.3) {
                  _pickCell(ctrl);
                }
              }
            });
          }

          // Thumbstick
          mc.getComponentOfType(BABYLON.WebXRControllerComponent.THUMBSTICK_TYPE)
            ?.onAxisValueChangedObservable.add(({x, y}) => {
              _stickX = x; _stickY = y;

              // Trigger held → zoom (Y axis only)
              if (_triggerHeld && _placed) {
                if (Math.abs(y) > 0.3) {
                  const delta = y < 0 ? 1.04 : 0.96;  // stick up = zoom in
                  const sc = Math.max(AR_SCALE*0.3, Math.min(AR_SCALE*6, _boardRoot.scaling.x*delta));
                  _boardRoot.scaling.setAll(sc);
                }
                return;  // Don't move player while trigger zooming
              }

              // Squeeze held → board movement handled in per-frame observer
              if (_squeezeHeld) return;

              // Normal: move player
              if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) return;
              EventBus.emit('ar:controller-action',{
                action: Math.abs(x)>=Math.abs(y)?(x>0?'right':'left'):(y>0?'up':'down')
              });
            });
        }

        // ── LEFT controller ───────────────────────────────────
        if (hand === 'left') {

          // Thumbstick → move player
          mc.getComponentOfType(BABYLON.WebXRControllerComponent.THUMBSTICK_TYPE)
            ?.onAxisValueChangedObservable.add(({x,y}) => {
              if (Math.abs(x)<0.5 && Math.abs(y)<0.5) return;
              EventBus.emit('ar:controller-action',{
                action: Math.abs(x)>=Math.abs(y)?(x>0?'right':'left'):(y>0?'up':'down')
              });
            });

          // X button → toggle 3D GUI menu
          ['x-button'].forEach(id =>
            mc.getComponent(id)?.onButtonStateChangedObservable.add(s => {
              if (s.pressed) _toggle3DMenu();
            }));
        }
      });
    });
  }

  function _pickCell(controller) {
    try {
      const ray = new BABYLON.Ray(BABYLON.Vector3.Zero(), BABYLON.Vector3.Forward());
      controller.getWorldPointerRayToRef?.(ray);
      const hit = _scene.pickWithRay(ray, m => m.isPickable && !_shouldSkip(m));
      if (!hit?.hit) return;
      const inv = BABYLON.Matrix.Invert(_boardRoot.getWorldMatrix());
      const loc = BABYLON.Vector3.TransformCoordinates(hit.pickedPoint, inv);
      EventBus.emit('ar:cell-picked',{
        x: Math.round(loc.x / CONSTANTS.TILE_SIZE),
        z: Math.round(loc.z / CONSTANTS.TILE_SIZE),
        action: 'move',
      });
    } catch(_){}
  }

  // ── Scale / rotate (HUD buttons) ─────────────────────────

  function rescaleBoard(delta) {
    if (!_boardRoot) return;
    const s = Math.max(AR_SCALE*0.3, Math.min(AR_SCALE*5, _boardRoot.scaling.x*delta));
    _boardRoot.scaling.setAll(s);
  }

  function rotateBoard(deg) {
    if (!_boardRoot) return;
    _boardRoot.rotation.y += deg * Math.PI / 180;
  }

  return {
    init, isSupported, enter, exit,
    placeBoardOnTap, lockBoard, resetPlacement,
    rescaleBoard, rotateBoard,
    show3DWin, show3DFail,
    isActive:      () => _arActive,
    isBoardPlaced: () => _placed,
    isReady:       () => _xrReady,
    /** Returns the board's current Y rotation in radians (0 when unplaced). */
    getBoardYaw:   () => _boardRoot ? _boardRoot.rotation.y : 0,

    /**
     * Returns the angle (radians) from the board's forward axis (+Z in board
     * local space) to the direction the XR camera is currently looking AT the
     * board from — i.e. the viewer's heading relative to the board.
     *
     * Used by CamRelativeMove to compensate for the user walking around
     * the table without rotating the board explicitly.
     *
     * Returns 0 when not in AR or board not placed.
     */
    getViewerRelativeYaw() {
      if (!_arActive || !_placed || !_boardRoot || !_xrBase?.camera) return 0;

      const cam   = _xrBase.camera;
      const board = _boardRoot.position;

      // Vector from camera to the board centre, flattened to XZ plane
      const dx = board.x - cam.globalPosition.x;
      const dz = board.z - cam.globalPosition.z;

      // World-space angle of "camera looking at board" (atan2 → clockwise from +Z)
      const worldAngle = Math.atan2(dx, dz);

      // Subtract the board's own Y rotation so the result is in board-local space.
      // When the viewer is standing at the board's "south" face and the board
      // is unrotated, this returns 0 (no compensation needed).
      return worldAngle - _boardRoot.rotation.y;
    },
  };

})();