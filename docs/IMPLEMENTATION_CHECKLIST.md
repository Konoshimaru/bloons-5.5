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
- [ ] Keep the Cutscene Editor as a development tool; split its timeline, editor state, rendering, and import/export only if the boundaries make maintenance easier.
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
- [x] Add a dependency-free syntax scanner that parsed all 215 source/test/tool files successfully in CI.
- [x] Re-run and confirm CI after renderer recovery, guarded composition, factory registration, and the large-target collision broadphase: 45 test files and 466 tests passed; all 215 syntax-checked files passed; the eight-module core type-check passed; ESLint passed on 13 production modules and 11 test files; npm audit reported zero advisories; production build passed.
- [x] Replace the copied undo/redo, curve-subdivision, and Ice Monkey test simulations with Vitest tests against `js/mapEditorHistory.js`, `GameMap`, and the real Ice Monkey/Enemy behavior; remove those duplicate simulations from `js/tests/tests.js`.
- [x] Label `tests.html` explicitly as a manual/legacy browser harness, separate from Vitest.
- [x] Add ESLint 10.15.0 and @eslint/js 10.0.1 with a flat config for the initial core helper modules and their regression tests; `npm run lint:core` passes in CI.
- [x] Expand the ESLint allowlist to 13 production modules and 11 associated regression-test files, including damage types, status effects, spatial grid, MapEditorHistory, the DOM write throttle, and Map Editor document validation/I/O; the CI lint step passes.
- [ ] Continue expanding ESLint coverage across the remaining `js/`, tests, and development tools incrementally, fixing findings without blanket disables.
- [ ] Choose and configure a formatter, then format incrementally without unrelated churn.
- [x] Add an initial TypeScript check (`typecheck:core`) for isolated, dependency-free helpers, using a pinned compiler and a separate `jsconfig.typecheck.json`.
- [x] Run the expanded type-check in CI successfully for eight selected core modules.
- [ ] Expand type-check coverage gradually as JSDoc and dependency boundaries are improved; do not treat the initial subset as a whole-project type check.
- [ ] Add Map Editor document validation and I/O regression tests for malformed paths, waypoints, curves, hitboxes, water strokes, and background metadata; retain support for legacy single-path documents.\n- [ ] Expand tests for save migration and renderer error paths where practical.

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

- [x] Confirm CI run 43606704054 is green on commit `3dd2a609666b4c2118eec49f98fb6d008b5ed936`: zero npm advisories, 215 syntax-checked files, eight type-checked modules, 13 ESLint production modules plus 11 test files, 45 Vitest files (466 tests), and production build.
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
