import { describe, expect, it } from 'vitest';
import {
    advanceFixedStepClock,
    FIXED_TIMESTEP_SECONDS,
    MAX_SUBSTEPS_PER_FRAME
} from '../js/fixedStepClock.js';

describe('advanceFixedStepClock', () => {
    it('uses fixed-size updates when frames are shorter than one simulation step', () => {
        const firstFrame = advanceFixedStepClock({ elapsedSeconds: 0.01 });
        expect(firstFrame.steps).toBe(0);
        expect(firstFrame.accumulatorSeconds).toBeCloseTo(0.01);

        const secondFrame = advanceFixedStepClock({
            elapsedSeconds: 0.01,
            accumulatorSeconds: firstFrame.accumulatorSeconds
        });
        expect(secondFrame.steps).toBe(1);
        expect(secondFrame.stepDt).toBe(FIXED_TIMESTEP_SECONDS);
        expect(secondFrame.accumulatorSeconds).toBeCloseTo(0.004);
    });

    it('combines variable render-frame durations into fixed simulation steps', () => {
        const firstFrame = advanceFixedStepClock({ elapsedSeconds: 0.01 });
        const secondFrame = advanceFixedStepClock({
            elapsedSeconds: 0.022,
            accumulatorSeconds: firstFrame.accumulatorSeconds
        });

        expect(secondFrame.steps).toBe(2);
        expect(secondFrame.stepDt).toBe(FIXED_TIMESTEP_SECONDS);
        expect(secondFrame.accumulatorSeconds).toBeCloseTo(0);
    });

    it('applies high game speed by scheduling more fixed steps, not by enlarging dt', () => {
        const result = advanceFixedStepClock({
            elapsedSeconds: 1 / 60,
            timeScale: 20
        });

        expect(result.steps).toBe(20);
        expect(result.stepDt).toBe(FIXED_TIMESTEP_SECONDS);
        expect(result.accumulatorSeconds).toBeCloseTo((1 / 60) * 20 - 20 * FIXED_TIMESTEP_SECONDS);
    });

    it('carries excess time forward when the per-frame work limit is reached', () => {
        const result = advanceFixedStepClock({
            elapsedSeconds: 0.1,
            timeScale: 20
        });

        expect(result.steps).toBe(MAX_SUBSTEPS_PER_FRAME);
        expect(result.accumulatorSeconds).toBeCloseTo(2 - MAX_SUBSTEPS_PER_FRAME * FIXED_TIMESTEP_SECONDS);
    });

    it('clamps long frame gaps to avoid simulating an unbounded tab-resume delay', () => {
        const result = advanceFixedStepClock({ elapsedSeconds: 10 });

        expect(result.frameDeltaSeconds).toBe(0.1);
        expect(result.steps).toBe(6);
        expect(result.accumulatorSeconds).toBeCloseTo(0.004);
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
