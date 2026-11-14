# Coding Standards

These are practical guidelines for the existing JavaScript codebase, not a mandate for a whole-project rewrite.

## Structure

- Prefer modules with one clear responsibility.
- Keep tower/hero definitions in their registries and runtime mechanics in shared behavior modules.
- Keep Pixi rendering code in js/webgl/.
- Keep editor-only UI and editing state inside the relevant tool modules.
- Refactor large files incrementally when a stable responsibility boundary is visible.

## Dependencies and state

- Prefer explicit function arguments over new singleton/global dependencies.
- Use existing engine parameters in hooks and helpers where available.
- Avoid circular imports; understand engineRef.js before changing engine dependencies.
- Do not mutate shared definition data to store a placed entity's runtime state.

## Functions and naming

- Use descriptive names and keep functions focused.
- Avoid hidden side effects and broad mutations.
- Match local formatting until a formatter is adopted.

## Comments and errors

- Explain non-obvious invariants and ordering constraints.
- Prefer regression tests for behavior that must not change.
- Remove temporary instructions, audit notes and comments that merely repeat the code.
- Validate external/persisted data at boundaries.
- Do not silently swallow failures that leave the game in a broken state.

## Changes and review

- One conceptual change per commit.
- Include regression tests for bug fixes.
- Avoid unrelated formatting churn.
- Review generated files and assets before committing.
- Run tests and build before asking for review.


## Engine module composition

Subsystem methods are attached to the shared engine through `attachEngineModule()` in `js/engineComposition.js`. Declare module ownership there and do not reintroduce plain `Object.assign(GameEngine, module)` calls: duplicate property names must be detected before any mutation.
