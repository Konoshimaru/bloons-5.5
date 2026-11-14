import { describe, expect, it, vi } from 'vitest';
import { runFixedStepsWithinBudget } from '../js/simulationBudget.js';

describe('fixed-step update budget', () => {
    it('completes every requested step while the work stays inside budget', () => {
        const update = vi.fn();
        let now = 0;
        const result = runFixedStepsWithinBudget(update, 8, 1 / 60, 500, () => now += 10);
        expect(result).toEqual({ completedSteps: 8, skippedSteps: 0 });
        expect(update).toHaveBeenCalledTimes(8);
        expect(update).toHaveBeenCalledWith(1 / 60);
    });
    it('yields the remaining catch-up work instead of throwing a false fatal error', () => {
        const update = vi.fn();
        let now = 0;
        const result = runFixedStepsWithinBudget(update, 64, 1 / 60, 500, () => now += 100);
        expect(result).toEqual({ completedSteps: 6, skippedSteps: 58 });
        expect(update).toHaveBeenCalledTimes(6);
    });
    it('always completes at least one update before yielding', () => {
        const update = vi.fn();
        let now = 0;
        const result = runFixedStepsWithinBudget(update, 10, 1 / 60, 0, () => now += 1);
        expect(result).toEqual({ completedSteps: 1, skippedSteps: 9 });
    });
    it('propagates genuine update errors', () => {
        const update = () => { throw new Error('real simulation failure'); };
        expect(() => runFixedStepsWithinBudget(update, 5, 1 / 60, 500, () => 0))
            .toThrow('real simulation failure');
    });
    it('validates budget and step-count inputs', () => {
        const update = () => {};
        expect(() => runFixedStepsWithinBudget(update, -1, 1 / 60, 500, () => 0)).toThrow(RangeError);
        expect(() => runFixedStepsWithinBudget(update, 1.5, 1 / 60, 500, () => 0)).toThrow(RangeError);
        expect(() => runFixedStepsWithinBudget(update, 1, 0, 500, () => 0)).toThrow(RangeError);
        expect(() => runFixedStepsWithinBudget(update, 1, 1 / 60, -1, () => 0)).toThrow(RangeError);
    });
});
