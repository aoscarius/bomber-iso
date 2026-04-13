# BOMBER ISO

**Isometric Bomber** built on the portal-iso engine — BabylonJS, pure JS, zero build tools.

Play live by serving the folder (any static HTTP server) or opening `index.html` via a local server (required for asset loading).

Run a local static server and open `http://localhost:8080`.

```
python3 -m http.server 8080
```

---

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | WASD / Arrow keys | D-pad |
| Place bomb | SPACE or X | 💣 button |
| Toggle minimap | M | — |
| Retry level | F1 | — |
| Menu | ESC | — |
| Zoom | Mouse wheel | Pinch |
| Orbit camera | Settings → Orbit Camera | — |
| AR mode | ◈ button (Chrome Android / Safari iOS) | — |

---

## Gameplay

- **Blow up all enemies** — the exit portal appears when the last enemy dies.
- **Soft blocks** (brown cubes) can be destroyed by bombs. Some hide power-ups or the exit.
- **Chain explosions** — if a blast reaches another bomb, it detonates immediately.
- **Don't trap yourself** — your own blast will kill you.

### Power-ups

| Icon | Effect |
|---|---|
| 💣 (orange) | +1 max bombs on field |
| 🔥 (blue) | +1 blast range |
| ⚡ (green) | +1 movement speed |

---

## Project structure

```
bomber-iso/
├── index.html              # Entry point — porta-iso HTML, surgical patches applied
├── levels/
│   ├── levels.json         # Manifest — ordered list of level files
│   ├── level_1.js … level_5.js
├── assets/
│   └── models/             # Optional GLB files; procedural fallback if absent
│       ├── player.glb
│       ├── enemy.glb
│       ├── bomb.glb
│       ├── wall.glb
│       ├── floor.glb
│       ├── soft_wall.glb
│       ├── exit.glb
│       ├── upgrade_bomb.glb
│       ├── upgrade_range.glb
│       └── upgrade_speed.glb
└── src/
    ├── utils/
    │   ├── constants.js    ★ MODIFIED — Bomber tile IDs & colours
    │   ├── eventBus.js     ✓ unchanged
    │   ├── i18n.js         ✓ unchanged
    │   └── themes.js       ✓ unchanged
    ├── game/
    │   ├── levels.js       ✓ unchanged (LevelLoader + findPlayerStart)
    │   ├── tileTypes.js    ★ MODIFIED — Bomber tile metadata
    │   ├── assetLoader.js  ★ MODIFIED — GLB map updated for Bomber models
    │   ├── renderer.js     ★ MODIFIED — bomb/explosion/enemy/soft meshes; GLB infra kept
    │   ├── physics.js      ★ MODIFIED — single-layer, isWalkable, isBlastPassable
    │   ├── player.js       ★ MODIFIED — SPACE=bomb, power-up stats; all input machinery kept
    │   ├── audio.js        ★ MODIFIED — porta-iso sounds + bombPlace/explosion/upgrade/enemyDie
    │   ├── particles.js    ★ FIXED+MODIFIED — particleTexture bug fixed; bomb effects added
    │   ├── gameLogic.js    ★ MODIFIED — Bomber loop (bomb/enemy/powerup/exit reveal)
    │   ├── bombManager.js  ★ NEW — bomb placement, countdown, chain explosions
    │   ├── enemyManager.js ★ NEW — AI: random/chase/smart types, bomb avoidance
    │   ├── minimap.js      ✓ MODIFIED
    │   ├── audio.js        ★ MODIFIED
    │   ├── amica.js        ✓ unchanged
    │   └── arManager.js    ✓ unchanged
    ├── editor/
    │   └── levelEditor.js  ✓ MODIFIED (works with new tileTypes, but removed all unused part)
    └── ui/
        ├── uiManager.js    ✓ unchanged
        ├── styles.css      ✓ unchanged
        ├── ar.css          ✓ unchanged
        ├── dialogue.css    ✓ unchanged
        ├── dialoguePanel.js ✓ unchanged
        ├── dialogueScript.js ✓ unchanged
        └── splashScreen.js ✓ unchanged
```

---

## Level format

Same as porta-iso — one JS file per level, pushed into `LEVELS[]`:

```js
LEVELS.push({
  id: 1,
  name: { en: 'STAGE 01', it: 'STADIO 01' },
  hint: { en: 'Hint text shown in HUD', it: '...' },
  amica: { en: 'AMICA intro line', it: '...' },
  width: 13, height: 11,

  // Items hidden under soft blocks (revealed when block is destroyed)
  hidden: [
    { x: 11, z: 9, type: 4 },   // EXIT (tile 4)
    { x: 5,  z: 5, type: 9 },   // UPGRADE_RANGE (tile 9)
  ],

  grid: [
    // 0=floor  2=wall  3=player  4=exit
    // 5=soft   8=+bomb  9=+range  10=+speed  11=enemy
    [2,2,2,...],
    ...
  ],
});
```

Add new levels to `levels/levels.json` to include them in rotation.

---

## Adding 3D models

Place GLB files in `assets/models/`. The renderer uses them automatically via `AssetLoader`; missing files fall back to procedural BabylonJS geometry.

Expected files: `player.glb`, `enemy.glb`, `bomb.glb`, `wall.glb`, `floor.glb`, `soft_wall.glb`, `exit.glb`, `upgrade_bomb.glb`, `upgrade_range.glb`, `upgrade_speed.glb`.

---

## AR mode

Requires HTTPS + Chrome on Android or Safari 15+ on iOS. On Meta Quest, the ◈ button appears automatically. The entire AR infrastructure (arManager.js, ar.css, WebXR dom-overlay) is carried over unchanged from porta-iso.

---

## Localisation

Supported languages: **English** (`en`) and **Italian** (`it`).

All strings live in `src/utils/i18n.js`: UI labels, AMICA lines, level names, hints, and dialogue scripts. To add a new language:

1. Add `{ code: 'xx', label: 'LANGUAGE NAME' }` to `I18n.SUPPORTED`  
2. Add an `xx` key to every `{ en: '...', it: '...' }` map in the file  
3. The language picker in Settings appears automatically

---

## Browser Compatibility

| Browser | Notes |
|---------|-------|
| Chrome 90+ | Full support, including WebXR AR on Android |
| Firefox 88+ | Full support (no WebXR AR) |
| Safari 15+ | Full support, WebXR AR on iOS |
| Edge 90+ | Full support |

> **TTS:** `window.speechSynthesis` is used for AMICA voice. If no voice is installed, the floating subtitle still displays — speech is optional.

---

## Credits

- **Engine:** [BabylonJS](https://www.babylonjs.com/) (CDN — no install required)
- **Fonts:** [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono) · [Rajdhani](https://fonts.google.com/specimen/Rajdhani) via Google Fonts
- **Concept:** Fan project inspired by Bomberman — not affiliated with or endorsed by Hudson Soft
Corporation
