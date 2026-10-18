// js/loadGate.js
// Staged loading. Instead of one giant up-front loading screen that blocks the
// main menu until every asset is in, each chunk of assets is a named GROUP that
// is (1) prefetched in the background as soon as the page loads, and (2) GATED
// right before the moment it's actually needed:
//
//   boot       audio + knowledge init            -> before the main menu
//   portraits  menu portrait images              -> before Monkeys / Heroes menus
//   game       tower/enemy/effect/boss textures  -> before any map starts
//   map        the chosen map's day/night bg     -> before that map starts
//
// `ensure()` costs nothing when the group is already loaded (no screen flash).
// If it isn't, the loading screen appears with a progress bar and the minigame
// until it is. A gate never blocks forever: loader errors are logged and the
// gate opens anyway (a missing sprite is better than a stuck game).
//
// This module is a deliberate import-free leaf (apart from the minigame) so it
// adds no import cycles; main.js registers the real loaders.
import { LoadingMinigame } from './loadingMinigame.js';

const SHOW_DELAY_MS = 150;   // loads faster than this never show the screen
const MIN_SHOW_MS = 450;     // once shown, stay up long enough not to flicker

const loaders = new Map();   // group -> { load(ctx, onProgress), key(ctx) }
const runs = new Map();      // "group:key" -> { promise, done, progress, listeners }

let screenUsers = 0;
let screenSetup = false;

function runId(group, ctx) {
    const def = loaders.get(group);
    const key = def && def.key ? def.key(ctx) : '';
    return `${group}:${key}`;
}

function el(id) { return document.getElementById(id); }

function showScreen(label, run) {
    screenUsers++;
    const screen = el('loading-screen');
    if (!screen) return () => {};
    if (screenUsers === 1) {
        screen.classList.remove('hidden', 'minigame-only');
        el('minigame-close')?.classList.add('hidden');
        try { LoadingMinigame.start(); } catch (e) { console.warn('[loadGate] minigame start failed', e); }
    }
    const status = el('loading-status');
    const fill = el('loading-bar-fill');
    if (status) status.textContent = label;
    const paint = (p) => { if (fill) fill.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`; };
    paint(run.progress);
    run.listeners.add(paint);
    return () => {
        run.listeners.delete(paint);
        screenUsers--;
        if (screenUsers <= 0) {
            screenUsers = 0;
            try { LoadingMinigame.stop(); } catch (e) { /* ignore */ }
            screen.classList.add('hidden');
            if (fill) fill.style.width = '0%';
        }
    };
}

export const LoadGate = {
    register(group, def) { loaders.set(group, def); },

    // Start (or join) a group's load without showing any UI.
    prefetch(group, ctx) {
        const def = loaders.get(group);
        const id = runId(group, ctx);
        let run = runs.get(id);
        if (run) return run;
        run = { done: false, progress: 0, listeners: new Set(), promise: null };
        const onProgress = (p) => { run.progress = p; run.listeners.forEach(fn => fn(p)); };
        run.promise = (async () => {
            if (!def) return;
            try { await def.load(ctx, onProgress); }
            catch (err) {
                console.error(`[loadGate] "${id}" failed:`, err);
                runs.delete(id);   // let a later gate retry it once
            }
        })().finally(() => { run.done = true; run.progress = 1; run.listeners.forEach(fn => fn(1)); });
        runs.set(id, run);
        return run;
    },

    isReady(group, ctx) {
        const run = runs.get(runId(group, ctx));
        return !!(run && run.done);
    },

    // Several groups behind ONE loading screen (e.g. starting a map needs the
    // gameplay assets AND that map's background). `specs` is [[group, ctx?], ...].
    async ensureMany(specs, { label = 'Loading...' } = {}) {
        const parts = specs.map(([group, ctx]) => this.prefetch(group, ctx));
        if (parts.every(r => r.done)) return;
        const combined = {
            done: false, progress: 0, listeners: new Set(),
            promise: Promise.all(parts.map(r => r.promise)),
        };
        const update = () => {
            combined.progress = parts.reduce((sum, r) => sum + r.progress, 0) / parts.length;
            combined.listeners.forEach(fn => fn(combined.progress));
        };
        parts.forEach(r => r.listeners.add(update));
        try { await this._wait(combined, label); }
        finally { parts.forEach(r => r.listeners.delete(update)); }
    },

    // Resolve once the group is loaded, showing the loading screen only if that
    // takes longer than SHOW_DELAY_MS.
    async ensure(group, { ctx, label = 'Loading...' } = {}) {
        const run = this.prefetch(group, ctx);
        if (run.done) return;
        await this._wait(run, label);
    },

    async _wait(run, label) {
        let hide = null;
        let shownAt = 0;
        const timer = setTimeout(() => { shownAt = performance.now(); hide = showScreen(label, run); }, SHOW_DELAY_MS);
        await run.promise;
        clearTimeout(timer);
        if (hide) {
            const wait = MIN_SHOW_MS - (performance.now() - shownAt);
            if (wait > 0) await new Promise(r => setTimeout(r, wait));
            hide();
        }
    },
};
