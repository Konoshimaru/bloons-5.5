# Game Loop and Time

## Frame lifecycle

The main browser loop is GameEngine.loop(timestamp) in js/engine.js.

1. Calculate elapsed wall-clock time since the previous frame.
2. Update the FPS counter.
3. When playing, pass elapsed time, speed scale and the saved accumulator to advanceFixedStepClock().
4. Run zero or more simulation updates, each with the same fixed dt.
5. Update UI/profiling information.
6. Render the current state through PixiJS when the renderer is ready.
7. Schedule the next animation frame (or configured background interval).

## Fixed simulation step

js/fixedStepClock.js defines:

- FIXED_TIMESTEP_SECONDS = 1 / 60.
- MAX_FRAME_DELTA_SECONDS = 0.1, so a suspended tab does not inject an arbitrarily large interval.
- MAX_SUBSTEPS_PER_FRAME = 64, limiting work in one render frame.
- A bounded accumulator, preventing an overloaded game from building an unlimited catch-up queue.

Game speed is applied to elapsed time entering the accumulator. It increases the number of fixed simulation steps, not the dt passed to entities.

If the simulation cannot keep up, work is carried forward up to the accumulator cap. Time beyond that cap is discarded to avoid a permanent catch-up spiral. At extreme speed and insufficient performance, simulation time can fall behind wall-clock time; this is a stability trade-off.

The accumulator is cleared when the loop restarts, the tab resumes or the game is not actively playing.

## Simulation update order

GameEngine.update(dt) calls the simulation passes. The current sequence includes limits/session timers, boss/cutscene checks, the wave manager and acid pools, enemy movement/leak detection, enemy spatial-grid rebuild, tower support and tower updates, beasts/sentries, projectiles/effects, then round/economy/UI checks.

Some passes are delegated to methods mixed into the engine from js/simulationLoop.js. Check the actual call sequence before changing update order; targeting, buffs, damage and rendering depend on it.

## Rules for simulation code

- Use the supplied dt; do not assume one update equals one rendered frame.
- Do not multiply individual entity timers by timeScale; the clock already applies it.
- Keep render interpolation separate from authoritative simulation state unless introduced deliberately.
- Add tests for fixed-step accumulation, high-speed operation and frame gaps.
- Test browser behavior at 1x and extreme speed after timing changes.
