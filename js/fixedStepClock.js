// js/fixedStepClock.js
// Keeps simulation updates at one consistent duration regardless of render FPS.
export const FIXED_TIMESTEP_SECONDS = 0.016;
export const MAX_FRAME_DELTA_SECONDS = 0.1;

// At 20x speed, a 60 FPS frame needs about 21 simulation steps.
// The extra room handles ordinary frame-time variation. If a frame needs more,
// the remaining simulation time is carried forward instead of stretching dt.
export const MAX_SUBSTEPS_PER_FRAME = 32;

const TIME_EPSILON = 1e-10;

/**
 * Converts elapsed wall-clock time into a bounded number of fixed simulation steps.
 *
 * The accumulator is measured in simulation seconds, so timeScale is applied
 * when elapsed time enters the clock. Any work beyond the per-frame step limit
 * stays in the accumulator and can be processed by later frames.
 */
export function advanceFixedStepClock({
    elapsedSeconds = 0,
    timeScale = 1,
    accumulatorSeconds = 0
} = {}) {
    const frameDeltaSeconds = Number.isFinite(elapsedSeconds)
        ? Math.min(Math.max(elapsedSeconds, 0), MAX_FRAME_DELTA_SECONDS)
        : 0;

    const safeTimeScale = Number.isFinite(timeScale)
        ? Math.max(timeScale, 0)
        : 1;

    const previousAccumulator = Number.isFinite(accumulatorSeconds)
        ? Math.max(accumulatorSeconds, 0)
        : 0;

    const requestedSimulationTime = frameDeltaSeconds * safeTimeScale;
    const safeSimulationTime = Number.isFinite(requestedSimulationTime)
        ? requestedSimulationTime
        : 0;

    const accumulatedTime = previousAccumulator + safeSimulationTime;
    const availableSteps = Math.floor(
        (accumulatedTime + TIME_EPSILON) / FIXED_TIMESTEP_SECONDS
    );
    const steps = Math.min(availableSteps, MAX_SUBSTEPS_PER_FRAME);

    let nextAccumulator = accumulatedTime - steps * FIXED_TIMESTEP_SECONDS;
    if (nextAccumulator < TIME_EPSILON) nextAccumulator = 0;

    return {
        steps,
        stepDt: FIXED_TIMESTEP_SECONDS,
        accumulatorSeconds: nextAccumulator,
        frameDeltaSeconds
    };
}
