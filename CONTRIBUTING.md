# Contributing

Thank you for helping with Bloons 5.5. This guide helps contributors understand the project before changing it.

## 1. Set up

1. Install Node.js 22 and npm.
2. Clone the repository.
3. Run npm ci.
4. Run npm run dev.
5. Open the local site if Vite did not open it automatically.

The development server uses 127.0.0.1:5500. Keep it running while testing.

## 2. Understand the work

The repository contains three broad kinds of work:

- **Game runtime:** systems required while playing, such as towers, bloons, waves, maps, saves and rendering.
- **Development tools:** editors and utilities that make creating or inspecting content easier.
- **Experiments/prototypes:** work in progress that may later become runtime features.

Do not remove an editor or prototype merely because it is not player-facing. Preserve its workflow and build entry point unless the change specifically concerns it.

## 3. Make a focused change

1. Find the runtime call site and relevant tests.
2. Read the closest existing implementation.
3. Check whether behavior is shared by towers, heroes, bosses or editors.
4. Keep the change small.
5. Avoid unrelated formatting or large rewrites.

For new towers, read docs/ADDING_TOWERS.md. For rendering, read docs/RENDERING.md.

## 4. Tests and verification

Run npm run check:syntax, npm run typecheck:core, npm test and npm run build. Add a Vitest regression test for bug fixes. Tests should exercise production functions whenever possible; avoid reimplementing the behavior only inside the test.

For gameplay changes, test in the browser too. Verify boundary conditions, high speed/low FPS where relevant, and nearby features that could regress.

tests.html is a separate legacy/manual browser harness. Its result is not the result of npm test.

## 5. Git workflow

- Create a branch for one coherent task.
- Use descriptive commits, e.g. Fix projectile swept collision.
- Avoid committing generated backups, local reports, unrelated editor output or personal configuration.
- Review git status, git diff, and git diff --cached before committing.
- Stage only intended files manually; do not use broad staging commands without reviewing their contents.
- On Windows, update.bat pushes the current branch and update teste.bat only accepts test-version. Both scripts refuse to commit when there are no staged changes.
- Open a pull request with a summary, test results and screenshots/logs for UI changes.

## 6. Code conventions

- Match surrounding JavaScript style and use descriptive names.
- Prefer explicit parameters over hidden global dependencies.
- Treat GameEngine as a shared singleton; do not add new global access when the engine is already passed to a function.
- Keep behavior definitions in their registries and rendering work in Pixi modules.
- Document non-obvious invariants, not temporary instructions or patch history.
- Update package.json and package-lock.json when adding dependencies.

## 7. Assets and editor output

Before committing editor-generated changes, check the changed files, confirm generated manifests/thumbnails are intentional, and ensure backups are not accidentally included. Do not assume an asset is freely redistributable merely because it is in the repository.

## 8. Pull request checklist

- [ ] The change has one clear purpose.
- [ ] Tests were added or updated.
- [ ] npm test passes.
- [ ] npm run build passes.
- [ ] Browser verification was done where needed.
- [ ] No unrelated generated files or local settings are included.
- [ ] Documentation was updated when architecture or workflow changed.
