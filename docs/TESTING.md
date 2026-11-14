# Testing

## Automated suite

The automated suite uses Vitest. Run npm ci, then npm run check:syntax, npm run typecheck:core, npm run lint:core and npm test. Tests live in tests/*.test.js. The shared configuration is in vite.config.js; discovery excludes node_modules, scripts/ and js/backups/.

## Syntax check

The syntax check runs Node.js parsing over JavaScript files in js/, tests/, and tools/, plus the root Vite config. It skips node_modules, dist, js/backups and scripts/ because those contain dependencies, generated output, historical backups or archived copies.

## Incremental linting

The ESLint flat config currently checks 47 selected production modules and 35 regression-test files across core runtime helpers, renderer modules, Map Editor modules, Cutscene runtime, map metadata, and supporting code. Run `npm run lint:core`; this is an incremental subset, not a whole-project lint. Expand it file-by-file after reviewing legacy globals, browser APIs and older patterns rather than turning on strict rules across the whole repository in one step.

## Dependency security audit

Run `npm run audit:deps` to print the package names, severities, advisory summaries, and available fixes reported by the npm registry. The CI workflow currently treats this report as informational (`continue-on-error`); the latest confirmed run reports zero vulnerabilities. Do not run `npm audit fix` blindly or accept major dependency changes without testing the application.

## Incremental type-checking

The `typecheck:core` command uses a pinned TypeScript compiler and currently checks fourteen selected core modules listed in `jsconfig.typecheck.json`. It remains a deliberately narrow check—not a claim that the entire JavaScript codebase is typed. Expand the file list only as modules gain accurate JSDoc and their external dependencies can be described without hiding real errors.

## Performance capture

Use the built-in profiler when frame time degrades during gameplay:

1. Press F3 to start a capture.
2. Reproduce the slowdown for a short, representative period.
3. Press F3 again to stop the capture.
4. Press F5 to download the JSON report. F4 also prints and copies a text summary.

Version 1.4.6 adds capture-only timing for simulation phases, Sniper targeting, animation lookup, the common firing pipeline, direct target damage, Shrapnel, ricochet/bounce handling, support updates, and selected-tower UI refresh. It also records Sniper event counts and placed tower loadouts. The `hotspots.timingMs` measurements are inclusive, so nested timings overlap; compare them to identify the costly substage rather than summing them.

## Test production behavior

A good regression test imports the actual function/class from js/ and verifies its observable result. Mock audio, rendering or local storage only when needed to isolate behavior.

Avoid tests that duplicate the implementation only inside the test file and then assert that the duplicate works. Such tests can pass while production code is broken.

## DOM-dependent modules

Some tests use jsdom. Follow nearby tests when a module expects window, document, Image or local storage. moduleLoad.test.js imports game modules in a DOM environment to detect import-order and circular-dependency problems.

## Browser test page

tests.html is explicitly labelled as a manual/legacy browser harness. It runs the older js/tests/tests.js checks, is separate from npm test, and does not represent Vitest coverage.

## What to test

- Simulation clock and high-speed behavior.
- ObjectPool identity/release rules, active-list synchronization, and SimulationLoop removal during projectile/particle iteration.
- Projectile hits, pierce, collision immunity and special projectile types.
- Simulation stability under high entity counts and accelerated game speed; capture profiler data when frame time degrades.
- Tower upgrades, damage, support buffs and abilities.
- Bloon HP, splitting, regrow and damage interactions.
- Economy and save/load.
- Map Editor document validation, JSON import/apply, saved custom-map loading, and save behavior; cover malformed geometry and keep legacy single-path map compatibility. Also test MapEditorState camera/dirty-state transitions, MapEditorInput hitbox wheel-resizing/canvas zoom/reference scaling, and MapRenderCore/MapEditorRenderer path visibility/curves, water strokes, object hitboxes, and background previews.
- Cutscene document normalization (including unique non-empty actor IDs), interpolation and playback.
- Production projectile swept-collision resolution, including large targets, collision immunity, camo detection, and hit-tracking exceptions.
- Map metadata tier lookups, sprite-key naming, and projectile subtype flags.
- Rendering asset keys and first-load behavior where practical.

Latest verified CI run 43642844236 passes npm ci, the dependency audit report (zero vulnerabilities), syntax scanning (234 files), the fourteen-module core type-check, ESLint (46 production modules and 34 tests), Vitest (61 files / 568 tests), and the production build. The build output contains all five configured HTML entry points. Browser verification is still required for gameplay/UI changes.
