import { describe, expect, it } from 'vitest';
import {
    canAttemptDraw,
    isCriticalDrawMethod,
    recordDrawFailure,
    MAX_OPTIONAL_DRAW_FAILURES
} from '../js/webgl/renderFailurePolicy.js';

describe('Pixi draw failure policy', () => {
    it('allows methods with no prior failure state', () => {
        expect(canAttemptDraw(null, 1)).toBe(true);
    });

    it('waits until the scheduled retry frame', () => {
        const first = recordDrawFailure(null, 10);
        expect(first.retryAtFrame).toBe(40);
        expect(canAttemptDraw(first, 39)).toBe(false);
        expect(canAttemptDraw(first, 40)).toBe(true);
    });

    it('uses a longer retry delay after a second failure', () => {
        const first = recordDrawFailure(null, 10);
        const second = recordDrawFailure(first, 40);
        expect(second.failures).toBe(2);
        expect(second.retryAtFrame).toBe(160);
        expect(canAttemptDraw(second, 159)).toBe(false);
        expect(canAttemptDraw(second, 160)).toBe(true);
    });

    it('disables an optional draw method after repeated failures', () => {
        let state = recordDrawFailure(null, 1);
        state = recordDrawFailure(state, state.retryAtFrame);
        state = recordDrawFailure(state, state.retryAtFrame);
        expect(state.failures).toBe(MAX_OPTIONAL_DRAW_FAILURES);
        expect(state.disabled).toBe(true);
        expect(canAttemptDraw(state, 1_000_000)).toBe(false);
    });

    it('resets the retry state after a successful draw (caller removes its state)', () => {
        const failed = recordDrawFailure(null, 5);
        expect(canAttemptDraw(failed, 5)).toBe(false);
        expect(canAttemptDraw(null, 5)).toBe(true);
    });

    it('classifies core gameplay passes as fatal', () => {
        for (const method of [
            '_drawBackground',
            '_drawTowers',
            '_drawEnemies',
            '_drawProjectiles',
            '_compositeWorld'
        ]) {
            expect(isCriticalDrawMethod(method)).toBe(true);
        }
    });

    it('keeps presentation-only passes recoverable', () => {
        for (const method of [
            '_drawMainMenuScenery',
            '_drawAcidPools',
            '_drawExplosions',
            '_drawSelectedRange',
            '_drawBuffIcons',
            '_drawCutsceneBalls'
        ]) {
            expect(isCriticalDrawMethod(method)).toBe(false);
        }
    });
});
