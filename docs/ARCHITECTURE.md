# Architecture Overview

This describes the current implementation, not an idealized target architecture.

## Application boot

index.html loads js/main.js. The main module imports CSS, controllers, UI, configuration, audio, the loading gate and GameEngine. On window load it initializes the engine, starts asset preloads, sets up listeners and presents the title/menu flow.

Vite also builds separate HTML entry points for the Cutscene Editor, Sprite Editor, Bloon Editor and browser test harness.

## Main runtime modules

- js/engine.js owns the shared GameEngine object, lifecycle, main loop and top-level update order.
- js/engineRef.js provides shared engine object identity for modules that would otherwise create circular imports.
- js/engineInput.js contains player commands such as placement, upgrades, targeting and abilities.
- js/gameSession.js contains save/load and end-of-run persistence.
- js/simulationLoop.js contains update passes for entities and transient effects.
- These modules attach to the shared GameEngine object through js/engineComposition.js through attachModuleMethods(). The helper preserves property descriptors, rejects duplicate names before mutation, and requires an explicit allowlist for intentional wrapper overrides. This is still a method-bag composition over one singleton, so future refactoring should make ownership/dependencies clearer incrementally rather than through a broad rewrite.

## Entity definitions and behavior

js/towers/index.js and js/heroes/index.js import definition objects and expose registries and derived stat tables. js/registry.js provides getBehavior(type).

Tower is the shared base runtime entity. Hero extends it with XP and level progression. Generic attack/update behavior is in js/towerBehavior.js; specialized hooks live on registered definitions.

Bloon definitions are in js/bloons.js and re-exported by js/data.js. Wave definitions live in js/waves.js and js/abrWaves.js. Maps are data in js/data.js, with runtime path geometry in js/map.js.

## Rendering

PixiJS is the current renderer. js/webgl/pixiRenderer.js initializes the app and combines modules such as renderTowers.js, renderEnemies.js, renderProjectiles.js, renderWorld.js, renderUI.js, renderHeroVFX.js and renderCutscene.js.

Keep simulation decisions out of renderer modules where possible. Rendering should read entity state and draw it, not become a second source of game rules.

## Data and persistence

js/config.js owns persistent player configuration, defaults and schema migrations. Custom maps are added to the runtime map collection during config loading. Saved runs are stored in Config.data.savedRun and restored by js/gameSession.js.

Cutscene authoring uses separate browser local-storage keys for the document and preferences. The editor and runtime share document sampling logic in js/cutsceneRuntime.js.

## Development tools

- cutsceneeditor.html + js/cutsceneEditor.js: author boss cutscene keyframes.
- js/mapEditor*.js: custom map authoring.
- spriteeditor.html: sprite configuration editor.
- blooneditor.html: bloon sprite/config editor.
- tests.html + js/tests/tests.js: older browser test harness.
- tools/: build-time manifest and thumbnail utilities.

These tools are intentional project infrastructure. Keep them usable even when they do not run during ordinary gameplay.
