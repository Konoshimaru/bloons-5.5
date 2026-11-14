# Known Issues and Technical Debt

Development tools and editors are intentional parts of this repository. They are not candidates for removal simply because they are not player-facing gameplay.

## Recently addressed on fix/fixed-timestep

- [x] Variable simulation step size: the engine now uses a 60 Hz fixed-step clock with a bounded accumulator and per-frame work limit.
- [x] Projectile tunnelling between update positions: moving projectiles now test their swept segment against enemy circles.
- [x] Large bloons missing the collision broadphase: the projectile grid query now includes the largest declared bloon radius, and regression tests cover BAD-sized targets.
- [x] Unsafe saved-run restoration: save data is validated before changing engine state, and restoration stops if map initialization fails.
- [x] Continue flow restarting a fresh game after loading a save: the UI starts the save-loading path once, without a second fresh session afterwards.
- [x] Explosive damage not reaching MOAB-class targets: EXPLOSION damage now carries canHitMoab while DDT-specific immunity remains in effect.
- [x] Explosive overlap ignored large enemy hitboxes: blast checks now include the target enemy radius.
- [x] Knight front sprite alias missing from the editor library: the fallback sprite index now includes the single canonical alias entry.
- [x] Optional Pixi draw-method failures: use bounded retries and disable repeatedly failing optional passes; failures in core world-rendering passes are escalated to the engine.
- [x] Stale tower interface documentation: js/towers/TOWER_INTERFACE.md now describes registry-based behavior lookup rather than prototype mixins.
- [x] Blind controller composition: GameEngine and Main now use attachModuleMethods(), which rejects undeclared duplicate names and requires explicit declarations for intentional selector wrappers.
- [x] Fragile nullable tower factory slot: creation is now exposed through a frozen facade, registration is explicit, and early calls produce a descriptive error.
- [x] Contributor documentation and CI checks have been added on this branch.

GitHub Actions run 43605871724 completed successfully on commit `9ee00448394c7ceda019485e7c1f2f5f847f1e60`: npm audit reported zero vulnerabilities; the syntax scanner passed all 212 files; the expanded core TypeScript check passed for seven modules; ESLint passed on 10 production modules and 8 regression-test files; all 43 Vitest files (448 tests) passed; and the Vite production build completed. The tests cover the fixed-step clock, swept collisions and large-target broadphase, save validation, Pixi failure policy, guarded GameEngine/Main composition, tower factory registration, Map Editor history, GameMap path geometry, and Ice Monkey behavior. Browser gameplay checks and Windows batch-script checks are still required before merging.

## Active technical debt

- [x] Dependency security: Vite 8.1.5 had two high-severity advisories (GHSA-9jrq-w75r-8gcw and GHSA-rq7h-c2jc-7f22). The lockfile now resolves Vite 8.1.7; `npm audit` reports zero vulnerabilities in CI run 43603764539.

- [x] Dependency security: updated Vite from 8.1.5 to 8.1.7 and refreshed the lockfile. GitHub Actions confirmed `npm audit` reports zero vulnerabilities after the change.

- [ ] GameEngine singleton/method-bag architecture: engine.js still attaches EngineInput, GameSession and SimulationLoop methods to one shared object. attachModuleMethods() checks duplicate names and prevents silent overwrites, but the singleton and implicit method dependencies remain. Refactor incrementally; do not replace working systems in one rewrite.
- [ ] Tower factory import-order dependency: towerFactory.create() now fails clearly before registration, but tower.js still needs to register the constructor before a behavior calls it. Keep the current cycle-breaking design until a safe dependency-free alternative exists.
- [ ] Further reduce the shared Main controller method bag only if a clearer sub-object design can be introduced without changing menu behavior.
- [ ] Large editor/rendering modules: split files only where a clear responsibility boundary exists. Preserve the Cutscene Editor and other development tools.
- [ ] Legacy browser test harness: tests.html remains a manual smoke page, separate from Vitest. Its duplicated undo/redo, curve-subdivision, and Ice Monkey simulations have been removed and replaced with production-module Vitest tests; review any remaining manual assertions for gaps.
- [ ] Automated checks: GitHub Actions now runs dependency audit, syntax scanning, a seven-module TypeScript check, and ESLint on 10 production modules plus 8 test files, alongside Vitest and the production build. ESLint and TypeScript coverage still need to expand across the remaining application modules and development tools.
- [ ] Package licensing: package.json declares ISC, but there is no root LICENSE file. Confirm the intended source-code license and separately review game art, audio, fonts and other asset rights before adding a blanket license file.
- [ ] Import/style cleanup: run a configured linter before removing suspected unused imports; some imports may be intentionally loaded for side effects.

## Follow-up verification

- [ ] Run npm ci, npm test and npm run build.
- [ ] Browser-test 1x, 10x and 20x speed, including low-FPS conditions.
- [ ] Confirm fast projectiles hit enemies along their path and preserve pierce/ricochet behavior.
- [ ] Test valid, invalid and legacy saved runs using the Continue button.
- [ ] Verify the Pixi renderer failure path and all editor entry points in dev and production builds.
