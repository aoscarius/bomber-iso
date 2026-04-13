# 3D Models Folder

Place your `.glb` files here. The game loads them automatically on startup.
If a file is missing, the game falls back to procedural BabylonJS geometry — no errors.

## Required files (optional — add when ready)

| File | Object | Size in Blender (BU) | Pivot |
|------|--------|----------------------|-------|
| `player.glb` | Player character | 0.65 × 1.4 × 0.65 | Bottom center (feet) |
| `wall.glb` | Solid wall block | 2 × 2.5 × 2 | Bottom center |
| `portal_wall.glb` | Portal-capable wall | 2 × 2.5 × 2 | Bottom center |
| `floor.glb` | Floor slab | 2 × 0.5 × 2 | Bottom center |
| `cube.glb` | Weighted Storage Cube | 1.1 × 1.1 × 1.1 | Bottom center |
| `door.glb` | Door panel | 2 × 2.5 × 0.2 | Bottom center |
| `button.glb` | Pressure plate | 1.0 dia × 0.12 h | Bottom center |
| `exit.glb` | Exit platform | 2 × 0.15 × 2 | Bottom center |
| `hazard.glb` | Hazard tile | 2 × 0.1 × 2 | Bottom center |
| `emitter.glb` | Laser emitter | ~1 × 1 × 1 | Bottom center |
| `receiver.glb` | Laser receiver | ~1 × 1 × 1 | Bottom center |

## Blender export settings

1. File → Export → glTF 2.0 (.glb)
2. ✓ Apply Modifiers
3. ✓ +Y Up (BabylonJS uses Y as up axis)
4. Format: **glTF Binary (.glb)** — embeds textures
5. Scale: 1 Blender unit = 1 BabylonJS unit

## Free model sources

- **kenney.nl** — CC0, low-poly game assets, great quality
- **quaternius.com** — CC0, clean low-poly
- **poly.pizza** — CC0
- **sketchfab.com** — check license per model (need CC-BY or CC0)

## Integrating with the renderer

The renderer (`src/game/renderer.js`) can be patched to use models:

```js
// In _buildWall(), replace CreateBox with:
const mesh = AssetLoader.clone(CONSTANTS.TILE.WALL, `wall_${gx}_${gz}`) 
  || BABYLON.MeshBuilder.CreateBox(...); // fallback
mesh.position = pos.clone();
```
