// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PixiRenderer } from '../js/webgl/pixiRenderer.js';
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


describe('PixiRenderer safe draw integration', () => {
    let renderer;

    beforeEach(() => {
        renderer = Object.create(PixiRenderer);
        renderer._drawMethodStates = new Map();
        renderer._renderFrame = 10;
        renderer._hideDisabledDrawLayer = vi.fn();
    });

    it('schedules optional-pass retries and respects the retry frame', () => {
        const draw = vi.fn(() => { throw new Error('temporary draw failure'); });
        renderer._drawOptionalPanel = draw;

        expect(PixiRenderer._safeDraw.call(renderer, '_drawOptionalPanel')).toBe(false);
        expect(renderer._drawMethodStates.get('_drawOptionalPanel')).toEqual({
            failures: 1,
            disabled: false,
            retryAtFrame: 40,
        });
        expect(draw).toHaveBeenCalledOnce();

        renderer._renderFrame = 39;
        expect(PixiRenderer._safeDraw.call(renderer, '_drawOptionalPanel')).toBe(false);
        expect(draw).toHaveBeenCalledOnce();

        renderer._renderFrame = 40;
        expect(PixiRenderer._safeDraw.call(renderer, '_drawOptionalPanel')).toBe(false);
        expect(draw).toHaveBeenCalledTimes(2);
        expect(renderer._drawMethodStates.get('_drawOptionalPanel').retryAtFrame).toBe(160);
    });

    it('disables an optional pass and hides its layer after the third failure', () => {
        renderer._drawOptionalPanel = vi.fn(() => { throw new Error('persistent draw failure'); });

        expect(PixiRenderer._safeDraw.call(renderer, '_drawOptionalPanel')).toBe(false);
        renderer._renderFrame = 40;
        expect(PixiRenderer._safeDraw.call(renderer, '_drawOptionalPanel')).toBe(false);
        renderer._renderFrame = 160;
        expect(PixiRenderer._safeDraw.call(renderer, '_drawOptionalPanel')).toBe(false);

        expect(renderer._drawMethodStates.get('_drawOptionalPanel')).toMatchObject({
            failures: MAX_OPTIONAL_DRAW_FAILURES,
            disabled: true,
            retryAtFrame: Number.POSITIVE_INFINITY,
        });
        expect(renderer._hideDisabledDrawLayer).toHaveBeenCalledTimes(1);
        expect(renderer._hideDisabledDrawLayer).toHaveBeenCalledWith('_drawOptionalPanel');
        renderer._renderFrame = 1_000_000;
        expect(PixiRenderer._safeDraw.call(renderer, '_drawOptionalPanel')).toBe(false);
        expect(renderer._drawOptionalPanel).toHaveBeenCalledTimes(3);
    });

    it('removes optional failure state after a successful retry', () => {
        renderer._drawMethodStates.set('_drawOptionalPanel', {
            failures: 1,
            disabled: false,
            retryAtFrame: 40,
        });
        renderer._renderFrame = 40;
        renderer._drawOptionalPanel = vi.fn();

        expect(PixiRenderer._safeDraw.call(renderer, '_drawOptionalPanel')).toBe(true);
        expect(renderer._drawOptionalPanel).toHaveBeenCalledOnce();
        expect(renderer._drawMethodStates.has('_drawOptionalPanel')).toBe(false);
    });

    it('escalates a failed critical pass with its original cause attached', () => {
        const cause = new Error('world draw failed');
        renderer._drawTowers = vi.fn(() => { throw cause; });

        try {
            PixiRenderer._safeDraw.call(renderer, '_drawTowers');
            throw new Error('Expected critical draw failure');
        } catch (error) {
            expect(error.message).toBe('Critical Pixi draw pass _drawTowers failed.');
            expect(error.cause).toBe(cause);
        }
    });
});
