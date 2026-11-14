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
- [x] Replace blind `Object.assign()` composition on `GameEngine` with `attachEngineModule()`, which declares module ownership and rejects duplicate property names before mutation.
- [ ] Continue reducing the shared singleton/method-bag design and make module dependencies explicit.
- [ ] Improve the `js/main.js` controller composition and make menu/game controller ownership explicit.
- [ ] Reduce new hidden dependencies on the global `GameEngine`; prefer supplied engine parameters.
- [ ] Review the remaining singleton/engineRef dependency pattern without reintroducing circular imports.
- [ ] Review the mutable late registration in `towerFactory.js`.
- [ ] Split large files only where there is a clear responsibility boundary.
- [ ] Keep the Cutscene Editor as a development tool; split its timeline, editor state, rendering, and import/export only if the boundaries make maintenance easier.
- [ ] Review renderer modules for cohesive responsibilities rather than performing a broad renderer rewrite.

## 3. Tests and automated quality checks

- [x] Add fixed-step clock unit tests.
- [x] Add swept-collision geometry unit tests.
- [x] Add saved-run validation tests.
- [x] Update the Paragon save/load test to model successful engine initialization.
- [x] Add tests for the Pixi optional-draw retry policy and critical-method classification.
- [x] Add a GameEngine composition helper with tests for duplicate names, getter preservation, and no partial application.
- [x] Isolate the GameSession sandbox-save test so it does not pre-populate the shared engine singleton before engine initialization.
- [x] Add a GitHub Actions workflow that runs `npm ci`, `npm test`, and `npm run build` for pushes and pull requests.
- [x] Re-run and confirm CI after the renderer failure-policy change: 37 test files and 419 tests passed; production build passed.
- [ ] Convert hand-written checks in `js/tests/tests.js` into tests of real production functions where applicable.
- [ ] Keep `tests.html` explicitly labelled as a manual/legacy browser harness; it is separate from Vitest.
- [ ] Configure ESLint and fix verified lint findings.
- [ ] Choose and configure a formatter, then format incrementally without unrelated churn.
- [ ] Add an actual type-check command; review `checkJs` and validate it on the project's current JavaScript.
- [ ] Expand tests for save migration, malformed editor documents, and renderer error paths where practical.

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
- [ ] Confirm whether ISC is the intended source-code license before adding a root `LICENSE` file.
- [ ] Review third-party sprite, audio, font, and other asset permissions separately; do not assume the source-code license covers them.
- [ ] Review the package homepage and repository metadata once the project landing page is settled.

## 8. Final acceptance

- [x] Confirm latest CI after renderer policy and documentation updates is green: dependency install, all Vitest tests, and production build.
- [ ] Manually test the Windows batch scripts on Windows.
- [ ] Launch the production build and open all five HTML entry points.
- [ ] Verify the game, Cutscene Editor, Map Editor, Sprite Editor, Bloon Editor, and browser test page still work.
- [ ] Confirm no development tool was removed or accidentally excluded from the build.
- [ ] Inspect the final Git diff for generated files, backups, and unrelated changes.
- [ ] Merge the reviewed work into `test-version` only when the owner is ready.

## Recommended next order

1. Confirm CI for the optional Pixi draw-failure policy.
2. Remove remaining temporary audit/instruction comments.
3. Improve the Windows helper scripts.
4. Configure linting and type checking.
5. Refactor `GameEngine`/controller composition in small steps.
6. Complete browser acceptance tests.
7. Decide the source-code license and asset attribution policy.
