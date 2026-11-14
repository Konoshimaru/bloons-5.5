import { describe, expect, it } from 'vitest';
import {
    advanceFixedStepClock,
    FIXED_TIMESTEP_SECONDS,
    MAX_ACCUMULATOR_SECONDS,
    MAX_SUBSTEPS_PER_FRAME
} from '../js/fixedStepClock.js';

describe('advanceFixedStepClock', () => {
    it('keeps fractional frame time until a complete fixed step is available', () => {
        const firstFrame = advanceFixedStepClock({ elapsedSeconds: 0.01 });
        expect(firstFrame.steps).toBe(0);
        expect(firstFrame.accumulatorSeconds).toBeCloseTo(0.01);

        const secondFrame = advanceFixedStepClock({
            elapsedSeconds: 0.01,
            accumulatorSeconds: firstFrame.accumulatorSeconds
        });
        expect(secondFrame.steps).toBe(1);
        expect(secondFrame.stepDt).toBe(FIXED_TIMESTEP_SECONDS);
        expect(secondFrame.accumulatorSeconds).toBeCloseTo(0.02 - FIXED_TIMESTEP_SECONDS);
    });

    it('combines uneven render frames into the correct number of fixed steps', () => {
        const firstFrame = advanceFixedStepClock({ elapsedSeconds: 0.01 });
        const secondFrame = advanceFixedStepClock({
            elapsedSeconds: 0.025,
            accumulatorSeconds: firstFrame.accumulatorSeconds
        });

        expect(secondFrame.steps).toBe(2);
        expect(secondFrame.stepDt).toBe(FIXED_TIMESTEP_SECONDS);
        expect(secondFrame.accumulatorSeconds).toBeCloseTo(0.035 - 2 * FIXED_TIMESTEP_SECONDS);
    });

    it('applies high game speed by scheduling more fixed steps, not by enlarging dt', () => {
        const result = advanceFixedStepClock({
            elapsedSeconds: 1 / 60,
            timeScale: 20
        });

        expect(result.steps).toBe(20);
        expect(result.stepDt).toBe(FIXED_TIMESTEP_SECONDS);
        expect(result.accumulatorSeconds).toBeCloseTo(0);
    });

    it('supports 20x speed at 30 FPS without stretching the simulation timestep', () => {
        const result = advanceFixedStepClock({
            elapsedSeconds: 1 / 30,
            timeScale: 20
        });

        expect(result.steps).toBe(40);
        expect(result.stepDt).toBe(FIXED_TIMESTEP_SECONDS);
        expect(result.accumulatorSeconds).toBeCloseTo(0);
    });

    it('limits work per frame and bounds accumulated catch-up time', () => {
        const firstFrame = advanceFixedStepClock({
            elapsedSeconds: 0.1,
            timeScale: 20
        });
        const secondFrame = advanceFixedStepClock({
            elapsedSeconds: 0.1,
            timeScale: 20,
            accumulatorSeconds: firstFrame.accumulatorSeconds
        });

        expect(firstFrame.steps).toBe(MAX_SUBSTEPS_PER_FRAME);
        expect(firstFrame.accumulatorSeconds).toBeCloseTo(56 * FIXED_TIMESTEP_SECONDS);
        expect(secondFrame.steps).toBe(MAX_SUBSTEPS_PER_FRAME);
        expect(secondFrame.accumulatorSeconds).toBe(MAX_ACCUMULATOR_SECONDS);
        expect(secondFrame.droppedSimulationSeconds).toBeCloseTo(48 * FIXED_TIMESTEP_SECONDS);
    });

    it('clamps long frame gaps to avoid simulating an unbounded tab-resume delay', () => {
        const result = advanceFixedStepClock({ elapsedSeconds: 10 });

        expect(result.frameDeltaSeconds).toBe(0.1);
        expect(result.steps).toBe(6);
        expect(result.accumulatorSeconds).toBeCloseTo(0);
    });

    it('ignores negative or non-finite elapsed time', () => {
        expect(advanceFixedStepClock({ elapsedSeconds: -1 }).steps).toBe(0);
        expect(advanceFixedStepClock({ elapsedSeconds: Number.NaN }).steps).toBe(0);
        expect(advanceFixedStepClock({ elapsedSeconds: Number.POSITIVE_INFINITY }).steps).toBe(0);
    });

    it('treats invalid time scales as 1 and non-positive scales as no simulation time', () => {
        expect(advanceFixedStepClock({
            elapsedSeconds: FIXED_TIMESTEP_SECONDS,
            timeScale: Number.NaN
        }).steps).toBe(1);

        expect(advanceFixedStepClock({
            elapsedSeconds: FIXED_TIMESTEP_SECONDS,
            timeScale: -2
        }).steps).toBe(0);
    });
});
