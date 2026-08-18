// js/bloonSpriteConfig.js
// Per-bloon sprite transforms for MOAB-class bloons, edited with
// blooneditor.html. Each part (body / blades / cracks) gets its own
// { x, y, scale } applied ON TOP of the data-level sprite offsets:
//   - x/y   shift the part relative to the bloon's position
//   - scale multiplies the part's target size (1 = keep the default)
// Offsets are in game pixels (already GLOBAL_SCALE-scaled units).
// The canvas path (enemyRenderer.js) does not consume this yet — only the
// WebGL renderers (renderEnemies.js / renderCutscene.js).
export const BloonSpriteConfig = {
    moab: {
        body: { x: 0, y: 0, scale: 1 },
        blades: { x: 0, y: 0, scale: 1 },
        cracks: { x: 0, y: 0, scale: 1 },
    },
    bfb: {
        body: { x: 0, y: 0, scale: 1 },
        blades: { x: 0, y: 0, scale: 1 },
        cracks: { x: 0, y: 0, scale: 1 },
    },
    zomg: {
        body: { x: 0, y: 0, scale: 1 },
        blades: { x: 0, y: 0, scale: 1 },
        cracks: { x: 0, y: 0, scale: 1 },
    },
};