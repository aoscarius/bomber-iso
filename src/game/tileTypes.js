// ============================================================
// tileTypes.js — Tile type definitions (Bomber ISO)
// Same structure as porta-iso; portal/laser tiles replaced.
// ============================================================

const TileTypes = {
  0: { id:0, name:'EMPTY',         solid:false, walkable:false, color:null,                        editorLabel:'░ EMPTY',       editorColor:'#0a0a0c' },
  1: { id:1, name:'FLOOR',         solid:false, walkable:true,  color:CONSTANTS.COLOR_FLOOR,        editorLabel:'▪ FLOOR',       editorColor:'#1e1e28' },
  2: { id:2, name:'WALL',          solid:true,  walkable:false, color:CONSTANTS.COLOR_WALL,         editorLabel:'█ WALL',        editorColor:'#2a2a38' },
  3: { id:3, name:'PLAYER',        solid:false, walkable:true,  color:CONSTANTS.COLOR_PLAYER,       editorLabel:'◈ PLAYER',      editorColor:'#e8d080', unique:true },
  4: { id:4, name:'EXIT',          solid:false, walkable:true,  color:CONSTANTS.COLOR_EXIT,         editorLabel:'⊡ EXIT',        editorColor:'#00ff88', unique:true },
  5: { id:5, name:'SOFT',          solid:true,  walkable:false, color:CONSTANTS.COLOR_SOFT_WALL,    editorLabel:'▦ SOFT BLOCK',  editorColor:'#5a3a1a' },
  6: { id:6, name:'BOMB',          solid:false, walkable:false, color:CONSTANTS.COLOR_BOMB,         editorLabel:'💣 BOMB',       editorColor:'#111111' },
  7: { id:7, name:'EXPLOSION',     solid:false, walkable:true,  color:CONSTANTS.COLOR_EXPLOSION,    editorLabel:'🔥 EXPLOSION',  editorColor:'#ff4400' },
  8: { id:8, name:'UPGRADE_BOMB',  solid:false, walkable:true,  color:CONSTANTS.COLOR_UPGRADE_BOMB, editorLabel:'💣+ BOMB UP',   editorColor:'#ff6a00' },
  9: { id:9, name:'UPGRADE_RANGE', solid:false, walkable:true,  color:CONSTANTS.COLOR_UPGRADE_RANGE,editorLabel:'🔥+ RANGE UP', editorColor:'#0099ff' },
 10: { id:10,name:'UPGRADE_SPEED', solid:false, walkable:true,  color:CONSTANTS.COLOR_UPGRADE_SPEED,editorLabel:'⚡ SPEED UP',  editorColor:'#00ff88' },
 11: { id:11,name:'ENEMY',         solid:false, walkable:true,  color:CONSTANTS.COLOR_ENEMY,        editorLabel:'👾 ENEMY',      editorColor:'#d04040' },
};

function isSolid(tileId)    { return TileTypes[tileId]?.solid    ?? true;  }
function isMovable(tileId)  { return TileTypes[tileId]?.movable  ?? false; }
function isPortalable()     { return false; }
