// assetLoader.js — GLB preloader with animation support (BabylonJS)
// Uses instantiateHierarchy() for correct mesh+skeleton copying.
// AnimationGroups are rebuilt manually to avoid null-target crashes.

const AssetLoader = (() => {

  const _cache  = {};
  let   _scene  = null;
  let   _loaded = false;

  const MODEL_MAP = {
    [CONSTANTS.TILE.FLOOR]:         'assets/models/floor.glb',
    [CONSTANTS.TILE.WALL]:          'assets/models/wall.glb',
    [CONSTANTS.TILE.SOFT]:          'assets/models/soft_wall.glb',
    [CONSTANTS.TILE.EXIT]:          'assets/models/exit.glb',
    [CONSTANTS.TILE.UPGRADE_BOMB]:  'assets/models/upgrade_bomb.glb',
    [CONSTANTS.TILE.UPGRADE_RANGE]: 'assets/models/upgrade_range.glb',
    [CONSTANTS.TILE.UPGRADE_SPEED]: 'assets/models/upgrade_speed.glb',
    'bomb':                         'assets/models/bomb.glb',
    'enemy':                        'assets/models/enemy.glb',
    'player':                       'assets/models/player.glb',
  };

  // ── Load ──────────────────────────────────────────────────

  async function load(scene, onProgress = null) {
    _scene  = scene;
    _loaded = false;
    const entries = Object.entries(MODEL_MAP);
    const total   = entries.length;
    let   loaded  = 0;

    if (onProgress) onProgress(0, total, '');

    const promises = entries.map(([k, p]) =>
      _loadOne(k, p).then(() => {
        loaded++;
        if (onProgress) onProgress(loaded, total, p);
      })
    );
    await Promise.allSettled(promises);
    _loaded = true;
    if (onProgress) onProgress(total, total, '');
    console.log(`[AssetLoader] ${Object.keys(_cache).length}/${Object.keys(MODEL_MAP).length} models loaded.`);
  }

  async function _loadOne(key, path) {
    try {
      const result = await BABYLON.SceneLoader.ImportMeshAsync('', '', path, _scene);
      if (!result.meshes?.length) return;

      const root = result.meshes[0];

      // Disable template — only ever cloned, never rendered directly
      root.setEnabled(false);
      root.getChildMeshes(false).forEach(m => m.setEnabled(false));

      // Stop and reset all animation groups so template is in bind pose
      result.animationGroups.forEach(ag => { ag.stop(); ag.reset(); });

      _cache[key] = { root, animGroups: result.animationGroups };
    } catch (_) {
      // Missing file — silent fallback to procedural geometry
    }
  }

  // ── Clone ─────────────────────────────────────────────────

  /**
   * Instantiate a model and return { root, playAnim, stopAnim, stopAllAnims, disposeAnims }.
   * Returns null when the model wasn't loaded.
   *
   * Uses instantiateHierarchy() which copies meshes and skeletons correctly,
   * then rebuilds each AnimationGroup by walking the original TargetedAnimations
   * and remapping their targets to the equivalent nodes in the new instance.
   * Any TargetedAnimation whose target cannot be found is skipped — this prevents
   * the "Cannot read properties of null (reading 'position')" crash.
   */
  function clone(key, name) {
    const entry = _cache[key];
    if (!entry) return null;

    const { root: tmplRoot, animGroups: tmplAnims } = entry;

    // Full hierarchy copy (preserves bones / skeletons)
    const newRoot = tmplRoot.instantiateHierarchy(null, { doNotInstantiate: false });
    if (!newRoot) return null;

    newRoot.name = name;
    newRoot.setEnabled(true);
    newRoot.isPickable = true;
    // Disable bounding boxes that instantiateHierarchy sometimes enables
    newRoot.showBoundingBox = false;
    newRoot.showSubMeshesBoundingBox = false;
    newRoot.getChildMeshes(false).forEach(m => {
      m.setEnabled(true);
      m.isPickable = true;
      m.showBoundingBox = false;
      m.showSubMeshesBoundingBox = false;
    });

    // Build lookup: original node name → new node
    const newNodes = [newRoot, ...newRoot.getChildMeshes(false),
                               ...newRoot.getChildTransformNodes(false)];
    const byName = {};
    newNodes.forEach(n => { byName[n.name] = n; });

    // Also map by source node for instantiated meshes
    // (instantiateHierarchy keeps a reference in .sourceMesh for InstancedMesh)
    newRoot.getChildMeshes(false).forEach(m => {
      if (m.sourceMesh) byName[m.sourceMesh.name] = m;
    });

    // Rebuild animation groups with retargeted TargetedAnimations
    const instanceAnims = {};
    tmplAnims.forEach(tmplAg => {
      const newAg = new BABYLON.AnimationGroup(`${name}_${tmplAg.name}`, _scene);

      tmplAg.targetedAnimations.forEach(ta => {
        const origName  = ta.target?.name;
        if (!origName) return;                    // No target name — skip

        const newTarget = byName[origName];
        if (!newTarget) return;                   // Not found in new hierarchy — skip

        newAg.addTargetedAnimation(ta.animation, newTarget);
      });

      newAg.normalize(tmplAg.from, tmplAg.to);
      newAg.stop();
      newAg.reset();
      instanceAnims[tmplAg.name.toLowerCase()] = newAg;
    });

    function playAnim(animName, loop = false) {
      const ag = instanceAnims[animName.toLowerCase()];
      if (!ag) return;
      ag.reset();
      ag.start(loop, 1.0);
    }

    function stopAnim(animName) {
      const ag = instanceAnims[animName.toLowerCase()];
      if (ag) { ag.stop(); ag.reset(); }
    }

    function stopAllAnims() {
      Object.values(instanceAnims).forEach(ag => { ag.stop(); ag.reset(); });
    }

    function disposeAnims() {
      Object.values(instanceAnims).forEach(ag => ag.dispose());
    }

    return { root: newRoot, playAnim, stopAnim, stopAllAnims, disposeAnims };
  }

  function isLoaded(key) { return !!_cache[key]; }
  function isReady()     { return _loaded; }

  function dispose() {
    Object.values(_cache).forEach(({ root, animGroups }) => {
      animGroups?.forEach(ag => { try { ag.dispose(); } catch(_){} });
      try { root.dispose(); } catch(_) {}
    });
    Object.keys(_cache).forEach(k => delete _cache[k]);
    _loaded = false;
  }

  return { load, clone, isLoaded, isReady, dispose };
})();
