# Changelog

## [1.4.6] - 2026-11-14

### Added
- Capture-only performance diagnostics for simulation phases and the Sniper update/fire path: targeting, animation lookup, direct target damage, Shrapnel, ricochet/bounce, and support updates.
- Profiler export metadata for placed tower loadouts and the selected tower.
- Regression tests for profiler timings, event counters, and per-frame capture reset.

### Improved
- Repeated `Config.load()` calls replace saved custom maps instead of appending duplicate entries.
- Tower transient-buff reset and tower-grid insertion share one traversal per simulation step.
- Renderer error-path tests exercise the production PixiRenderer recovery method.
- ESLint coverage expanded to 47 selected production modules and 35 regression-test files.

### Known issue
- The reported Sniper firing FPS spikes are still under investigation. This version adds diagnostic visibility; it does not claim the performance issue is fixed.
