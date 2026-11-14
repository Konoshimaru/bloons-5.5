# Implementation Checklist — Bloons 5.5

This checklist tracks the audit and the changes on branch `fix/fixed-timestep`.

> **Important distinction:** tools such as the Cutscene Editor, Map Editor, Sprite Editor, Bloon Editor, and browser test page are intentional development infrastructure. They are not automatically player-facing features, but they should remain available and usable. Do not remove them just because they are not part of an ordinary game session.

Legend: `[x]` implemented in this branch; `[ ]` still open; browser/manual verification is called out separately.

## 1. Runtime stability and gameplay bugs

- [x] Replace the variable simulation delta with fixed 60 Hz updates.
- [x] Add an accumulator so uneven render-frame durations are converted into fixed simulation steps.
- [x] Bound per-frame catch-up work and cap accumulated simulation debt.
- [x] Reset accumulated simulation time when leaving gameplay, restarting the loop, or resuming from a hidden tab.
- [x] Prevent fast projectiles from skipping enemies by testing the complete previous-to-current movement segment.
- [x] Size the spatial-grid broadphase query to include the largest declared bloon hitbox (including BAD-size targets), not an arbitrary 40 px padding.
- [x] Resolve a projectile's swept collision before removing it for leaving the screen.
- [x] Include enemy hitbox radius when testing whether an explosion overlaps a target.
- [x] Restore the inherent MOAB damage flag for EXPLOSION damage while keeping DDT-specific immunities.
- [x] Validate saved-run shape, map index, difficulty, economy values, towers, upgrade tiers, heroes, and Paragon fields before applying them.
- [x] Stop save restoration if the selected map fails to initialize.
- [x] Make `startGame()` report success/failure so callers can detect initialization failure.
- [x] Fix the Continue flow so it loads the save once instead of starting a second fresh game afterwards.
- [x] Show a blocking startup error if PixiJS/WebGL initialization fails; do not allow a game to start without its only supported renderer.
- [x] Stop the game and attempt to preserve the current run if the top-level Pixi render call throws.
- [x] Add a bounded recovery policy for optional Pixi draw methods: retry after increasing delays, disable after repeated failures, and escalate critical world-rendering failures.
- [ ] Verify 1x, 10x, and 20x gameplay in a real browser, including low-FPS and tab-resume cases.
- [ ] Verify projectile collision behavior for every special projectile type, including pierce, ricochet, split, explosive, and returning projectiles.
- [ ] Manually test valid, invalid, old-format, and custom-map saves through the actual Continue UI.
- [ ] Test WebGL unavailable/startup failure and simulated render failure in a browser, not only through unit tests.
- [ ] **User-reported bug (2026-11-14):** Sniper Monkey firing causes severe lag/freezes, especially at high attack speed, and can stall/crash the game loop. Profile rapid target reacquisition, Shrapnel projectile bursts/cap enforcement, and hitscan rendering; add production regression/stress tests before marking this resolved.
- [x] Add first automated Sniper firing mitigations: throttle successful target reacquisition to 0.15 simulation seconds while retaining immediate reacquisition for invalid/recycled targets or targeting-mode changes, and trim projectile/particle burst overflow to their configured limits; cover both with production regression tests.

## 2. Architecture and maintainability

- [ ] Reduce the responsibilities held by `js/engine.js` gradually.
- [x] Replace blind `Object.assign()` composition on `GameEngine` with `attachModuleMethods()`, which declares module ownership and rejects duplicate property names before mutation.
- [ ] Continue reducing the shared singleton/method-bag design and make module dependencies explicit.
- [x] Replace `js/main.js` blind `Object.assign()` controller composition with explicit module attachment; document the three intentional selector-wrapper overrides.
- [ ] Further reduce the shared Main controller method bag where clearer sub-objects would improve ownership.
- [ ] Reduce new hidden dependencies on the global `GameEngine`; prefer supplied engine parameters.
- [ ] Review the remaining singleton/engineRef dependency pattern without reintroducing circular imports.
- [x] Encapsulate the mutable tower factory slot behind a registration API with a clear uninitialized error and HMR-compatible re-registration.
- [ ] Remove the remaining module-load-order dependency only if it can be done without reintroducing the tower behavior import cycle.
- [ ] Split large files only where there is a clear responsibility boundary.
- [x] Preserve the Cutscene Editor as a supported development tool and Vite build entry point.
- [ ] Split its timeline, editor state, rendering, and import/export only where the boundaries improve maintainability.
- [ ] Review renderer modules for cohesive responsibilities rather than performing a broad renderer rewrite.

## 3. Tests and automated quality checks

- [x] Add fixed-step clock unit tests.
- [x] Add swept-collision geometry unit tests.
- [x] Add broadphase regression tests proving large bloon targets are returned by the spatial grid before the narrowphase segment test.
- [x] Add saved-run validation tests.
- [x] Update the Paragon save/load test to model successful engine initialization.
- [x] Add tests for the Pixi optional-draw retry policy and critical-method classification.
- [x] Add tests for tower factory initialization, argument forwarding, invalid registration, and HMR re-registration.
- [x] Add a shared module-composition helper with tests for duplicate names, explicitly permitted overrides, getter preservation, and no partial application.
- [x] Isolate the GameSession sandbox-save test so it does not pre-populate the shared engine singleton before engine initialization.
- [x] Add a GitHub Actions workflow that runs `npm ci`, `npm run check:syntax`, `npm test`, and `npm run build` for pushes and pull requests.
- [x] Add a dependency-free syntax scanner that parsed all 224 source/test/tool files successfully in CI.
- [x] Re-run and confirm CI after renderer recovery, guarded composition, factory registration, and the large-target collision broadphase: 57 test files and 537 tests passed; all 227 syntax-checked files passed; the fourteen-module core type-check passed; ESLint passed on 33 production modules and 28 test files; npm audit reported zero advisories; production build passed.
- [x] Replace the copied undo/redo, curve-subdivision, and Ice Monkey test simulations with Vitest tests against `js/mapEditorHistory.js`, `GameMap`, and the real Ice Monkey/Enemy behavior; remove those duplicate simulations from `js/tests/tests.js`.
- [x] Label `tests.html` explicitly as a manual/legacy browser harness, separate from Vitest.
- [x] Add ESLint 10.15.0 and @eslint/js 10.0.1 with a flat config for the initial core helper modules and their regression tests; `npm run lint:core` passes in CI.
- [x] Expand the ESLint allowlist to 33 production modules and 28 associated regression-test files, now including LoadGate, GameMap, Enemy, EnemyDamage, ObjectPool, SimulationLoop, Projectile, Tower, UI, and KnightEnemy plus their regression tests, covering Cutscene runtime, map metadata, naming helpers, projectile configuration/resolution, and Map Editor composition, state, input, renderer, validation/I/O, and drawing modules; the CI lint step passes.
- [ ] Continue expanding ESLint coverage across the remaining `js/`, tests, and development tools incrementally, fixing findings without blanket disables.
- [ ] Choose and configure a formatter, then format incrementally without unrelated churn.
- [x] Add an initial TypeScript check (`typecheck:core`) for isolated, dependency-free helpers, using a pinned compiler and a separate `jsconfig.typecheck.json`.
- [x] Run the expanded type-check in CI successfully for fourteen selected core modules, including MapEditorState, MapRenderCore, Cutscene runtime normalization, map metadata, naming helpers, and projectile configuration.
- [ ] Expand type-check coverage gradually as JSDoc and dependency boundaries are improved; do not treat the initial subset as a whole-project type check.
- [x] Add Map Editor document validation and I/O regression tests for malformed paths, waypoints, curves, hitboxes, water strokes, and background metadata; retain support for legacy single-path documents. Also fix the mouse-wheel priority so selected hitboxes resize rather than triggering canvas zoom, with coverage for circles, boxes, minimum sizes, ordinary zoom, and reference-image scaling.
- [x] Replace Map Editor object-spread composition with guarded module attachment and test the assembled API; apply JSON only after successful validation so invalid documents do not create undo snapshots.
- [x] Ignore malformed first-waypoint curve handles in the Map Editor and reject those documents during normalization.
- [x] Normalize duplicate, blank, and missing Cutscene actor IDs to unique non-empty identifiers; test the shared Cutscene runtime helper.
- [x] Add regression tests against production `ProjectileHitResolution._checkCollisions()` for swept travel, the largest declared enemy hitbox, immunity/camo filters, and projectile hit-tracking exceptions.
- [x] Add production tests for map metadata, asset-key naming helpers, and projectile subtype configuration.
- [x] Expand production GameMap tests for placement-width checks, nearest/ranged path samples, prop hitboxes, water brushes, and frozen-water coverage; protect inclusive range edges from floating-point interpolation noise.
- [x] Add LoadGate production regression tests for registration validation, unknown groups, concurrent prefetch deduplication, loader-failure retry behavior, malformed progress values, and loading-screen reentrancy when the DOM element is absent.
- [ ] Expand tests for save migration and renderer error paths where practical.

## 4. Documentation and contributor onboarding

- [x] Add root `README.md` with setup, commands, project map, tools, tests, and build guidance.
- [x] Add root `CONTRIBUTING.md`.
- [x] Add `docs/ARCHITECTURE.md`.
- [x] Add `docs/GAME_LOOP.md`.
- [x] Add `docs/ADDING_TOWERS.md`.
- [x] Add `docs/ADDING_HEROES.md`.
- [x] Add `docs/ADDING_ENEMIES.md`.
- [x] Add `docs/RENDERING.md`.
- [x] Add `docs/SAVES_AND_CONFIG.md`.
- [x] Add `docs/TESTING.md`.
- [x] Add `docs/CODING_STANDARDS.md`.
- [x] Add `docs/DEVELOPMENT_TOOLS.md`.
- [x] Correct `js/towers/TOWER_INTERFACE.md` to describe the current registry/behavior-hook system.
- [x] Refresh `KNOWN_ISSUES.MD` so it reflects current issues rather than stale file names or an outdated test summary.
- [x] Add this implementation checklist.
- [ ] Ask a new contributor to follow the README and add a small test tower without one-to-one help; update documentation where they get stuck.

## 5. Source cleanup

- [x] Replace owner/patch-specific benchmark and regression-guard comments in `js/uiWriteThrottle.js` with concise descriptions of its display-only throttling invariants.
- [x] Replace version-history, owner-request, and audit-history comments with current behavior notes in the loading flow, transitions, GameEngine session lifecycle, cash penalties, and Enemy regeneration/pooling; preserve the useful invariants.
- [x] Reset Enemy pooled-use combat state (`knockbackCd`, `stunOnPop`, and DoT tick cadence) and add regression coverage proving a recycled bloon cannot inherit those effects.
- [x] Guard the Enemy/EnemyDamage prototype composition against undeclared method collisions and test the production attachment.
- [x] Fix fortified Lead carry-over damage: child bloons now receive only damage beyond the Lead shell's remaining HP; add tests for non-lethal, exact-threshold, and overkill hits.
- [x] Prevent zero or negative damage from popping split bloons; add production EnemyDamage regression tests so status-only/zero-damage hits cannot spawn children.
- [x] Clamp negative damage before enemy-type handlers so a negative hit cannot heal MOAB HP; cover zero and negative damage on the real EnemyDamage implementation.
- [x] Fix ObjectPool release tracking and lifecycle: an object-index map makes active-list swap-removal O(1), direct release removes the object from the active list, duplicate releases are ignored, and `removeAt`/`clear` share the safe path; validate factory outputs and cover the production pool with regression tests.
- [x] Clear the Enemy ObjectPool at the start of every successful new session, alongside projectile and particle pools; cover a leftover active enemy reference in the GameEngine startGame integration test.
- [x] Test the real SimulationLoop projectile/particle pool iteration against ObjectPool: dead entries are removed without skipping survivors, and projectiles spawned during a tick wait until the next simulation step.
- [x] Make `ObjectPool.removeAt()` safely ignore fractional, non-finite, and out-of-range indices rather than passing an undefined entry into `release()`; add a regression test.
- [x] Cover ObjectPool factory contracts: factories must return objects and must create distinct instances, both during lazy allocation and initial preallocation.
- [x] Replace blind `Object.assign()` composition for Projectile/ProjectileHitResolution, Tower/TowerEconomy, UI/uiTowerPanel, and KnightEnemy/KnightAttacks with guarded `attachModuleMethods()` calls; assert their production methods load on the real owners.
- [ ] Review remaining temporary, audit-report, and patch-history comments throughout the codebase.
- [ ] Remove unused imports only after linting confirms they are not side-effect imports.
- [ ] Consolidate duplicate imports from the same module where appropriate.
- [ ] Standardize naming and formatting incrementally.
- [ ] Keep comments focused on invariants, non-obvious behavior, and architectural reasoning.

## 6. Windows scripts and Git workflow

- [x] Update `jogar.bat` to install dependencies only when Vite is missing.
- [x] Review `update.bat` and `update teste.bat`.
- [x] Remove automatic staging; both update scripts require manually staged files and show a staged diff summary.
- [x] Check the current branch, remote, and Git command exit status before pushing.
- [ ] Keep commits small and use descriptive commit messages.

## 7. Package and distribution

- [x] Add a package description and relevant keywords.
- [x] Remove the unused `main: index.js` entry and mark the browser app package as private.
- [x] Upgrade Vite from 8.1.5 to 8.1.7 and refresh package-lock.json; CI confirmed npm audit reports zero vulnerabilities.
- [ ] Confirm whether ISC is the intended source-code license before adding a root `LICENSE` file.
- [ ] Review third-party sprite, audio, font, and other asset permissions separately; do not assume the source-code license covers them.
- [ ] Review the package homepage and repository metadata once the project landing page is settled.

## 8. Final acceptance

- [x] Confirm CI run 43634095968 is green on commit `da81d745c72f18c9693d4a17e63b79c0a416264a`: zero npm advisories, 229 syntax-checked files, fourteen type-checked modules, 34 ESLint production modules plus 29 test files, 58 Vitest files (543 tests), and production build.
- [x] Review Windows batch scripts: `jogar.bat` avoids reinstalling dependencies on every launch; `update.bat` and `update teste.bat` require explicit staging, show the staged diff, verify branch/remote/command status, and ask before pushing.
- [ ] Manually test the Windows batch scripts on Windows.
- [ ] Launch the production build and open all five HTML entry points.
- [ ] Verify the game, Cutscene Editor, Map Editor, Sprite Editor, Bloon Editor, and browser test page still work.
- [ ] Confirm no development tool was removed or accidentally excluded from the build.
- [ ] Inspect the final Git diff for generated files, backups, and unrelated changes.
- [ ] Merge the reviewed work into `test-version` only when the owner is ready.

## Recommended next order

1. Complete browser acceptance tests for the runtime fixes.
2. Review and remove remaining temporary audit/instruction comments.
3. Expand ESLint and type-check coverage beyond the initial core helper modules.
4. Continue reducing the `GameEngine` singleton/method-bag design in small steps.
5. Run browser acceptance tests for gameplay, rendering failures, saves, and every development-tool entry point.
6. Manually test the Windows batch scripts on Windows.
7. Confirm the source-code license and asset attribution policy.
