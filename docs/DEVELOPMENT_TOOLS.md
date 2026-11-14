# Development Tools

These tools help create and maintain game content. They are intentional parts of the repository even when they are not ordinary gameplay screens.

## Cutscene Editor

Entry point: cutsceneeditor.html. Implementation: js/cutsceneEditor.js. Shared document/interpolation logic: js/cutsceneRuntime.js. Runtime playback: js/cutscenePlayback.js and js/cutscene.js.

The editor provides a stage preview, actor list, sprite library, key inspector and timeline. It stores its document in browser local storage. The game uses a custom scene for the boss intro only when useForBossIntro is enabled. Keep editor and runtime normalization/sampling logic shared.

## Map Editor

Implementation is split across js/mapEditor.js and state/input/history/rendering/IO modules. It creates custom maps stored in player configuration. Test map save/load round-trips when changing the data format.

## Sprite Editor

Entry point: spriteeditor.html. It edits sprite configuration and uses Vite's /__save-sprite-config development endpoint. The endpoint writes js/spriteConfig.js and rotates backups.

## Bloon Editor

Entry point: blooneditor.html. It edits bloon sprite/configuration data and uses Vite's /__save-bloon-config development endpoint.

## Browser test harness

Entry point: tests.html, importing js/tests/tests.js. This older harness is useful for manual checks but is separate from Vitest.

## Windows helper scripts

- `jogar.bat` installs dependencies only if the Vite package is missing, then starts the development server.
- `update.bat` stages nothing automatically and pushes the currently checked-out branch after manual staging and confirmation.
- `update teste.bat` has the same safety checks but refuses to run unless the current branch is `test-version`.

## Build behavior

The five HTML pages are explicit Vite build inputs in vite.config.js. If an editor page or tool is moved/renamed, update the Vite inputs and verify both dev-server and production output.
