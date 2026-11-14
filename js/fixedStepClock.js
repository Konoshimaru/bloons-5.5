// js/fixedStepClock.js
// Keeps simulation updates at one consistent duration regardless of render FPS.
export const FIXED_TIMESTEP_SECONDS = 1 / 60;
export const MAX_FRAME_DELTA_SECONDS = 0.1;

// At 20x speed, a 30 FPS frame needs 40 simulation steps. This limit also
// leaves headroom for catching up after a short frame-time spike.
export const MAX_SUBSTEPS_PER_FRAME = 64;

// Never let accumulated simulation debt grow without bound. If the game cannot
// process time as quickly as it arrives, it will run behind rather than enter a
// permanent catch-up spiral or try to perform unlimited work in one frame.
export const MAX_ACCUMULATOR_SECONDS =
    FIXED_TIMESTEP_SECONDS * MAX_SUBSTEPS_PER_FRAME;

const TIME_EPSILON = 1e-10;

/**
 * Converts elapsed wall-clock time into a bounded number of fixed simulation steps.
 *
 * Time scale is applied when elapsed time enters the accumulator. Updates always
 * receive exactly FIXED_TIMESTEP_SECONDS. Work beyond the per-frame step limit
 * is carried forward up to MAX_ACCUMULATOR_SECONDS; any additional backlog is
 * discarded to keep slow frames from creating an ever-growing catch-up queue.
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

    let remainingTime = accumulatedTime - steps * FIXED_TIMESTEP_SECONDS;
    if (remainingTime < TIME_EPSILON) remainingTime = 0;

    const accumulatorSeconds = Math.min(
        remainingTime,
        MAX_ACCUMULATOR_SECONDS
    );

    return {
        steps,
        stepDt: FIXED_TIMESTEP_SECONDS,
        accumulatorSeconds,
        droppedSimulationSeconds: remainingTime - accumulatorSeconds,
        frameDeltaSeconds
    };
}
