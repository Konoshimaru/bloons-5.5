# Bloons 5.5

Bloons 5.5 is a browser-based tower-defense project built with JavaScript, Vite and PixiJS. The repository also contains development tools used to create, inspect and prepare game content.

> Editors and test pages are intentional development tools. They are not all player-facing screens, but they are part of the project workflow and should be preserved unless a change specifically concerns them.

## Requirements

- Node.js 22 and npm.
- Git, if you are contributing.

## Get started

```sh
git clone https://github.com/Konoshimaru/bloons-5.5.git
cd bloons-5.5
npm ci
npm run dev
```

The Vite server is configured for 127.0.0.1:5500 and opens the browser automatically. Keep the terminal running while working.

## Commands

| Command | Purpose |
| --- | --- |
| npm ci | Install exact dependencies from the lockfile. |
| npm run dev | Start the local development server. |
| npm test | Run the Vitest automated suite. |
| npm run build | Create the production build in dist/. |
| npm run gen:manifest | Regenerate the sprite manifest. |
| npm run gen:thumbs | Regenerate map thumbnails. |

Run npm ci after cloning or changing dependencies, not every time the server starts. On Windows, jogar.bat checks for the Vite installation and skips npm ci when it is already present.

## Project map

| Path | Responsibility |
| --- | --- |
| index.html, js/main.js | Main browser entry and boot sequence. |
| js/engine.js | GameEngine singleton, lifecycle and main update/render loop. |
| js/engineInput.js | Input actions and player commands. |
| js/gameSession.js | Save/load and session restoration. |
| js/simulationLoop.js | Per-step updates for entities and effects. |
| js/towers/, js/heroes/ | Definitions, upgrades and behavior hooks. |
| js/bloons.js, js/waves.js, js/abrWaves.js | Bloon definitions and wave data. |
| js/map.js, js/data.js | Map runtime and shared game data. |
| js/webgl/ | PixiJS renderer and rendering modules. |
| js/bosses/, js/cutscene.js, js/cutscenePlayback.js | Boss behavior and cutscene playback. |
| js/cutsceneEditor.js, cutsceneeditor.html | Cutscene authoring tool. |
| js/mapEditor*.js | Custom map authoring tool. |
| spriteeditor.html, blooneditor.html | Sprite and bloon configuration tools. |
| tests/ | Vitest automated tests. |
| js/tests/, tests.html | Separate browser-based legacy/manual harness. |
| tools/, docs/ | Utilities and technical documentation. |

Vite builds five HTML entry points: the game, Cutscene Editor, Sprite Editor, Bloon Editor and browser test page. Some are development-only tools but remain deliberate build targets.

## Development tools

- **Cutscene Editor:** /cutsceneeditor.html. Authors keyframes and stores the document in browser local storage. A custom scene is used for the boss intro only when useForBossIntro is enabled.
- **Map Editor:** available from in-game menus; saves custom maps in player configuration.
- **Sprite Editor:** /spriteeditor.html. Uses a Vite development endpoint to write sprite configuration and rotate backups.
- **Bloon Editor:** /blooneditor.html. Edits bloon sprite/configuration data through the development server.
- **Browser test harness:** /tests.html runs older manual checks. Use npm test for Vitest.

Check the Git diff carefully after saving editor output or generating assets. The Windows update.bat helper pushes the current branch; update teste.bat is restricted to test-version. Both require you to stage and review files manually before committing.

## Testing

Run npm test and npm run build before submitting changes. Gameplay changes also need browser testing; unit tests cannot prove the complete interaction of assets, input, rendering and timing.

## Contributing

Read CONTRIBUTING.md, the guides in docs/, and docs/IMPLEMENTATION_CHECKLIST.md. Make focused changes, add regression tests and describe how you verified them.

## License and third-party assets

package.json declares ISC, but there is no root LICENSE file. Confirm the intended source-code license and review third-party sprite, music, font and other asset permissions before adding a blanket license.
