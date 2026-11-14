/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../js/loadingMinigame.js', () => ({
    LoadingMinigame: {
        start: vi.fn(),
        stop: vi.fn(),
    },
}));

import { LoadGate } from '../js/loadGate.js';

let groupNumber = 0;
const nextGroup = () => `load-gate-test-${++groupNumber}`;

function deferred() {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
}

describe('LoadGate', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('rejects invalid registrations and unknown groups', () => {
        expect(() => LoadGate.register('', { load: vi.fn() })).toThrow(/non-empty string name/);
        expect(() => LoadGate.register(nextGroup(), {})).toThrow(/load\(ctx, onProgress\)/);
        expect(() => LoadGate.prefetch(nextGroup())).toThrow(/unregistered load group/);
    });

    it('deduplicates concurrent prefetches for the same group and key', async () => {
        const group = nextGroup();
        const pending = deferred();
        const load = vi.fn(() => pending.promise);
        LoadGate.register(group, { load });

        const first = LoadGate.prefetch(group);
        const second = LoadGate.prefetch(group);

        expect(second).toBe(first);
        expect(load).toHaveBeenCalledTimes(1);

        pending.resolve();
        await first.promise;
        expect(first.done).toBe(true);
        expect(first.progress).toBe(1);
    });

    it('normalizes progress reports to finite values between zero and one', async () => {
        const group = nextGroup();
        const pending = deferred();
        let reportProgress;
        LoadGate.register(group, {
            load: async (_ctx, onProgress) => {
                reportProgress = onProgress;
                await pending.promise;
            },
        });

        const run = LoadGate.prefetch(group);
        expect(run.progress).toBe(0);

        reportProgress(Number.NaN);
        expect(run.progress).toBe(0);
        reportProgress(-0.5);
        expect(run.progress).toBe(0);
        reportProgress(0.42);
        expect(run.progress).toBe(0.42);
        reportProgress(4);
        expect(run.progress).toBe(1);
        reportProgress(Number.POSITIVE_INFINITY);
        expect(run.progress).toBe(0);

        pending.resolve();
        await run.promise;
        expect(run.progress).toBe(1);
    });

    it('does not leak the loading-screen user count when the screen element is absent', async () => {
        const firstGroup = nextGroup();
        const firstLoad = deferred();
        LoadGate.register(firstGroup, {
            key: (ctx) => ctx,
            load: () => firstLoad.promise,
        });

        const firstEnsure = LoadGate.ensure(firstGroup, { ctx: 'without-screen' });
        await vi.advanceTimersByTimeAsync(150);
        expect(document.getElementById('loading-screen')).toBeNull();
        firstLoad.resolve();
        await firstEnsure;

        document.body.innerHTML = `
            <div id="loading-screen" class="hidden"></div>
            <div id="loading-status"></div>
            <div id="loading-bar-fill"></div>
            <canvas id="loading-minigame"></canvas>
            <button id="minigame-close"></button>
        `;

        const secondGroup = nextGroup();
        const secondLoad = deferred();
        LoadGate.register(secondGroup, { load: () => secondLoad.promise });
        const onScreen = vi.fn();
        const secondEnsure = LoadGate.ensure(secondGroup, { onScreen });

        await vi.advanceTimersByTimeAsync(150);
        const screen = document.getElementById('loading-screen');
        expect(screen.classList.contains('hidden')).toBe(false);
        expect(onScreen).toHaveBeenCalledTimes(1);

        secondLoad.resolve();
        await vi.advanceTimersByTimeAsync(700);
        await secondEnsure;
        expect(screen.classList.contains('fade-out')).toBe(true);

        await vi.advanceTimersByTimeAsync(320);
        expect(screen.classList.contains('hidden')).toBe(true);
    });
});
