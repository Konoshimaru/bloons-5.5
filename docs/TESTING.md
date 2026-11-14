# Testing

## Automated suite

The automated suite uses Vitest. Run npm ci, then npm run check:syntax, npm run typecheck:core, npm run lint:core and npm test. Tests live in tests/*.test.js. The shared configuration is in vite.config.js; discovery excludes node_modules, scripts/ and js/backups/.

## Syntax check

The syntax check runs Node.js parsing over JavaScript files in js/, tests/, and tools/, plus the root Vite config. It skips node_modules, dist, js/backups and scripts/ because those contain dependencies, generated output, historical backups or archived copies.

## Incremental linting

The initial ESLint flat config is intentionally limited to the fixed-step clock, collision geometry, saved-run validation, engine composition, tower factory, renderer failure policy and the tests that exercise those helpers. Run `npm run lint:core`. This is a starting scope; expand it file-by-file after reviewing legacy globals, browser APIs and older patterns rather than turning on strict rules across the whole repository in one step.

## Dependency security audit

Run `npm run audit:deps` to print the package names, severities, advisory summaries, and available fixes reported by the npm registry. The CI workflow currently treats this report as informational while the existing high-severity advisory is investigated; do not run `npm audit fix` blindly or accept major dependency changes without testing the application.

## Incremental type-checking

The initial `typecheck:core` command uses a pinned TypeScript compiler and checks a small set of dependency-free helpers listed in `jsconfig.typecheck.json`. It is an initial, deliberately narrow check—not a claim that the entire JavaScript codebase is typed. Expand the file list only as modules gain accurate JSDoc and their external dependencies can be described without hiding real errors.

## Test production behavior

A good regression test imports the actual function/class from js/ and verifies its observable result. Mock audio, rendering or local storage only when needed to isolate behavior.

Avoid tests that duplicate the implementation only inside the test file and then assert that the duplicate works. Such tests can pass while production code is broken.

## DOM-dependent modules

Some tests use jsdom. Follow nearby tests when a module expects window, document, Image or local storage. moduleLoad.test.js imports game modules in a DOM environment to detect import-order and circular-dependency problems.

## Browser test page

tests.html runs the older js/tests/tests.js harness. It is separate from npm test and should be treated as a manual/legacy smoke page. Its results do not represent Vitest coverage.

## What to test

- Simulation clock and high-speed behavior.
- Projectile hits, pierce, collision immunity and special projectile types.
- Tower upgrades, damage, support buffs and abilities.
- Bloon HP, splitting, regrow and damage interactions.
- Economy and save/load.
- Custom maps and map editor round-trip.
- Cutscene document normalization, interpolation and playback.
- Rendering asset keys and first-load behavior where practical.

GitHub Actions runs npm ci, the dependency audit report, syntax scanning, the core type-check, `npm run lint:core`, npm test and npm run build. Browser verification is still required for gameplay/UI changes.
