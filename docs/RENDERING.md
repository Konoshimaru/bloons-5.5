# Rendering

## Current renderer

The game uses PixiJS through js/webgl/pixiApp.js and js/webgl/pixiRenderer.js. Smaller renderer responsibilities include renderWorld.js, renderTowers.js, renderEnemies.js, renderProjectiles.js, renderUI.js, renderHeroVFX.js, renderCutscene.js, renderMenu.js and renderBuffIcons.js.

See js/webgl/MIGRATION.md for renderer migration notes.

## Keep rendering separate from simulation

The simulation updates entity state using fixed dt. Renderer modules should read that state and draw it. Avoid putting authoritative damage, targeting, economy or wave logic inside drawing methods.

If a new tower/enemy needs a special effect, find the closest renderer module and extend its existing pattern. Avoid adding another large conditional to a central renderer if the effect can be isolated cleanly.

## Assets

The project uses named sprite references and a generated manifest. Check js/assets.js, js/spriteIndex.js, js/spriteSheets.js and tools/gen-manifest.mjs before introducing a new asset path.

## Error handling

Renderer initialization is asynchronous. The engine currently logs initialization errors and resolves its readiness promise with null; handling this as a visible startup failure remains technical debt. Do not assume a missing renderer is a valid gameplay fallback.

Test first-load assets, upgraded assets, editor views and production builds. Dev-server paths can hide packaging errors that only appear in dist/.
