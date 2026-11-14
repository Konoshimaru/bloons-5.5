# Changelog

## [1.4.7] - 2026-11-14

### Fixed
- Global-range target caches retain the next three ranked, line-of-sight-valid candidates. When a Sniper's current bloon is popped, it can advance to a surviving cached candidate instead of immediately rescanning the complete enemy list.
- Cached candidates are still rejected immediately when dead, recycled, hidden, invulnerable, or untargetable; a fresh scan occurs when the shortlist is exhausted.

### Added
- Capture-only timings for Sniper target-cache validation, shared-cache lookup, and full target scanning.
- Profiler counters for candidates visited, shared-cache hits, fallbacks, empty results, and invalidations.
- A two-Sniper regression test covering successive target pops and the one necessary rescan after all three cached candidates are gone.

### Verification note
- The new mitigation targets the hotspot identified in the 2026-11-14 22:01 profiler capture. Browser retesting is still required; this release does not claim the reported FPS spikes are fully resolved.

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
