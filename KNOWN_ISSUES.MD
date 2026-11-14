# Known Issues and Technical Debt

Development tools and editors are intentional parts of this repository. They are not candidates for removal simply because they are not player-facing gameplay.

## Recently addressed on fix/fixed-timestep

- [x] Variable simulation step size: the engine now uses a 60 Hz fixed-step clock with a bounded accumulator and per-frame work limit.
- [x] Projectile tunnelling between update positions: moving projectiles now test their swept segment against enemy circles.
- [x] Unsafe saved-run restoration: save data is validated before changing engine state, and restoration stops if map initialization fails.
- [x] Continue flow restarting a fresh game after loading a save: the UI starts the save-loading path once, without a second fresh session afterwards.
- [x] Explosive damage not reaching MOAB-class targets: EXPLOSION damage now carries canHitMoab while DDT-specific immunity remains in effect.
- [x] Explosive overlap ignored large enemy hitboxes: blast checks now include the target enemy radius.
- [x] Knight front sprite alias missing from the editor library: the fallback sprite index now includes the single canonical alias entry.
- [x] Stale tower interface documentation: js/towers/TOWER_INTERFACE.md now describes registry-based behavior lookup rather than prototype mixins.
- [x] Contributor documentation and CI checks have been added on this branch.

GitHub Actions run 43598895661 completed successfully: all 36 Vitest files (412 tests) passed and the Vite production build completed. Browser gameplay checks are still required before merging.

## Active technical debt

- [ ] Renderer initialization failure: GameEngine.init() currently resolves rendererReady with null when Pixi initialization fails; the game may continue without the world renderer. Add a visible fatal state or supported fallback.
- [ ] Renderer frame errors: the main loop logs Pixi render failures and continues. Decide which errors should stop gameplay and surface a clear diagnostic.
- [ ] GameEngine singleton and mixins: engine.js combines core state with EngineInput, GameSession and SimulationLoop via Object.assign(). Refactor incrementally with explicit ownership; do not replace working systems in one rewrite.
- [ ] Main controller composition: js/main.js composes menu and game controllers with Object.assign(); make ownership and public methods easier to trace.
- [ ] Large editor/rendering modules: split files only where a clear responsibility boundary exists. Preserve the Cutscene Editor and other development tools.
- [ ] Legacy browser test harness: tests.html runs js/tests/tests.js, which includes hand-written simulations. Label it as a manual/legacy smoke harness and prefer Vitest tests that exercise production functions.
- [ ] Automated checks: GitHub Actions runs npm ci, npm test and npm run build, but linting and static type checking are not configured yet.
- [ ] Package licensing: package.json declares ISC, but there is no root LICENSE file. Confirm the intended source-code license and separately review game art, audio, fonts and other asset rights before adding a blanket license file.
- [ ] Windows helper scripts: jogar.bat runs npm ci on every launch; update scripts stage all files and push to hard-coded branches. Improve them with checks and safer staging.
- [ ] Import/style cleanup: run a configured linter before removing suspected unused imports; some imports may be intentionally loaded for side effects.

## Follow-up verification

- [ ] Run npm ci, npm test and npm run build.
- [ ] Browser-test 1x, 10x and 20x speed, including low-FPS conditions.
- [ ] Confirm fast projectiles hit enemies along their path and preserve pierce/ricochet behavior.
- [ ] Test valid, invalid and legacy saved runs using the Continue button.
- [ ] Verify the Pixi renderer failure path and all editor entry points in dev and production builds.
