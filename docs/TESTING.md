# Testing

## Automated suite

The automated suite uses Vitest. Run npm ci, then npm run check:syntax, npm run typecheck:core, npm run lint:core and npm test. Tests live in tests/*.test.js. The shared configuration is in vite.config.js; discovery excludes node_modules, scripts/ and js/backups/.

## Syntax check

The syntax check runs Node.js parsing over JavaScript files in js/, tests/, and tools/, plus the root Vite config. It skips node_modules, dist, js/backups and scripts/ because those contain dependencies, generated output, historical backups or archived copies.

## Incremental linting

The ESLint flat config currently checks 19 production modules: the fixed-step clock, collision geometry, saved-run validation, engine composition, tower factory, damage types, status effects, spatial grid, renderer failure policy, MapEditorHistory, the DOM write throttle, Map Editor document validation and I/O, MapEditorState, MapRenderCore, MapEditorRenderer, MapEditorInput, MapEditor, and the shared Cutscene runtime. It also checks 17 regression-test files for these modules and their related behavior. Run `npm run lint:core`. This remains an incremental subset; expand it file-by-file after reviewing legacy globals, browser APIs and older patterns rather than turning on strict rules across the whole repository in one step.

## Dependency security audit

Run `npm run audit:deps` to print the package names, severities, advisory summaries, and available fixes reported by the npm registry. The CI workflow currently treats this report as informational (`continue-on-error`); the latest confirmed run reports zero vulnerabilities. Do not run `npm audit fix` blindly or accept major dependency changes without testing the application.

## Incremental type-checking

The `typecheck:core` command uses a pinned TypeScript compiler and currently checks eleven selected core modules listed in `jsconfig.typecheck.json`. It remains a deliberately narrow check—not a claim that the entire JavaScript codebase is typed. Expand the file list only as modules gain accurate JSDoc and their external dependencies can be described without hiding real errors.

## Test production behavior

A good regression test imports the actual function/class from js/ and verifies its observable result. Mock audio, rendering or local storage only when needed to isolate behavior.

Avoid tests that duplicate the implementation only inside the test file and then assert that the duplicate works. Such tests can pass while production code is broken.

## DOM-dependent modules

Some tests use jsdom. Follow nearby tests when a module expects window, document, Image or local storage. moduleLoad.test.js imports game modules in a DOM environment to detect import-order and circular-dependency problems.

## Browser test page

tests.html is explicitly labelled as a manual/legacy browser harness. It runs the older js/tests/tests.js checks, is separate from npm test, and does not represent Vitest coverage.

## What to test

- Simulation clock and high-speed behavior.
- Projectile hits, pierce, collision immunity and special projectile types.
- Tower upgrades, damage, support buffs and abilities.
- Bloon HP, splitting, regrow and damage interactions.
- Economy and save/load.
- Map Editor document validation, JSON import/apply, saved custom-map loading, and save behavior; cover malformed geometry and keep legacy single-path map compatibility. Also test MapEditorState camera/dirty-state transitions, MapEditorInput hitbox wheel-resizing/canvas zoom/reference scaling, and MapRenderCore/MapEditorRenderer path visibility/curves, water strokes, object hitboxes, and background previews.
- Cutscene document normalization (including unique non-empty actor IDs), interpolation and playback.
- Rendering asset keys and first-load behavior where practical.

GitHub Actions runs npm ci, the dependency audit report, syntax scanning, the core type-check, `npm run lint:core`, npm test and npm run build. Browser verification is still required for gameplay/UI changes.
