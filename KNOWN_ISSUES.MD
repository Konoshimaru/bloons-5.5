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
- [x] Optional Pixi draw-method failures: use bounded retries and disable repeatedly failing optional passes; failures in core world-rendering passes are escalated to the engine.
- [x] Stale tower interface documentation: js/towers/TOWER_INTERFACE.md now describes registry-based behavior lookup rather than prototype mixins.
- [x] Contributor documentation and CI checks have been added on this branch.

GitHub Actions run 43601229284 completed successfully: all 38 Vitest files (424 tests) passed and the Vite production build completed. This includes the fixed-step clock, swept collisions, save validation, Pixi failure policy, and GameEngine composition guard. Browser gameplay checks and Windows batch-script checks are still required before merging.

## Active technical debt

- [ ] GameEngine singleton/method-bag architecture: engine.js still attaches EngineInput, GameSession and SimulationLoop methods to one shared object. attachEngineModule() now checks duplicate names and prevents silent overwrites, but the singleton and implicit method dependencies remain. Refactor incrementally; do not replace working systems in one rewrite.
- [ ] Main controller composition: js/main.js composes menu and game controllers with Object.assign(); make ownership and public methods easier to trace.
- [ ] Large editor/rendering modules: split files only where a clear responsibility boundary exists. Preserve the Cutscene Editor and other development tools.
- [ ] Legacy browser test harness: tests.html runs js/tests/tests.js, which includes hand-written simulations. Label it as a manual/legacy smoke harness and prefer Vitest tests that exercise production functions.
- [ ] Automated checks: GitHub Actions runs npm ci, npm test and npm run build, but linting and static type checking are not configured yet.
- [ ] Package licensing: package.json declares ISC, but there is no root LICENSE file. Confirm the intended source-code license and separately review game art, audio, fonts and other asset rights before adding a blanket license file.
- [ ] Import/style cleanup: run a configured linter before removing suspected unused imports; some imports may be intentionally loaded for side effects.

## Follow-up verification

- [ ] Run npm ci, npm test and npm run build.
- [ ] Browser-test 1x, 10x and 20x speed, including low-FPS conditions.
- [ ] Confirm fast projectiles hit enemies along their path and preserve pierce/ricochet behavior.
- [ ] Test valid, invalid and legacy saved runs using the Continue button.
- [ ] Verify the Pixi renderer failure path and all editor entry points in dev and production builds.
