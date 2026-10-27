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
// If it isn't, the loading screen appears with a progress bar until it is.
// A gate never blocks forever: loader errors are logged and the gate opens
// anyway (a missing sprite is better than a stuck game).
//
// v1.3.5: the sword-pulling minigame (js/loadingMinigame.js) is back, but
// only for LONG loads — when a screen has been up for
// TUNING.minigame.appearAfterMs the gate fades the canvas in behind the
// status/bar; quick loads never see it. v1.3.4 had deleted the module
// outright, which over-pruned the request ("remove it from the main-menu
// loading screen" meant "stop flashing it on every load").
//
// This module only imports the minigame + tuning — both import-free leaves,
// so it still adds no import cycles; main.js registers the real loaders.

const SHOW_DELAY_MS = 150;   // loads faster than this never show the screen
const MIN_SHOW_MS = 700;     // once shown, stay up long enough to read as a
                             // real screen, not a flash (v1.3.4: was 450)
const FADE_MS = 320;         // loading screen opacity fade in/out (was 280)
                             // (minigame delay lives in TUNING.minigame.appearAfterMs)

import { LoadingMinigame } from './loadingMinigame.js';
import { TUNING } from './tuning.js';

const loaders = new Map();   // group -> { load(ctx, onProgress), key(ctx) }
const runs = new Map();      // "group:key" -> { promise, done, progress, listeners }

let screenUsers = 0;
let screenSetup = false;
let fadeTimer = null;        // a pending fade-out; cancelled if a gate re-shows
let minigameTimer = null;    // pending minigame summon; cancelled on release

function runId(group, ctx) {
    const def = loaders.get(group);
    const key = def && def.key ? def.key(ctx) : '';
    return `${group}:${key}`;
}

function el(id) { return document.getElementById(id); }

// v1.3.5: the minigame is a LONG-LOAD reward, not a fixture. Arm it when the
// screen shows; if the load finishes first, disarm. The canvas fades in via
// the .live class (css/menus.css); LoadingMinigame.start()/stop() are idempotent.
function armMinigame() {
    disarmMinigame();
    const delay = (TUNING.minigame && TUNING.minigame.appearAfterMs) || 1500;
    minigameTimer = setTimeout(() => {
        minigameTimer = null;
        const cv = el('loading-minigame');
        if (cv) cv.classList.add('live');
        try { LoadingMinigame.start(); } catch (e) { console.warn('[loadGate] minigame start failed', e); }
    }, delay);
}

function disarmMinigame() {
    if (minigameTimer) { clearTimeout(minigameTimer); minigameTimer = null; }
    const cv = el('loading-minigame');
    if (cv) cv.classList.remove('live');
    try { LoadingMinigame.stop(); } catch (e) { /* ignore */ }
}

function showScreen(label, run) {
    screenUsers++;
    const screen = el('loading-screen');
    if (!screen) return () => {};
    if (screenUsers === 1) {
        // Cancel any in-flight fade-out from the previous gate, then fade in:
        // start transparent (hidden just removed), force a reflow, release.
        if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
        screen.classList.remove('hidden');
        screen.classList.add('fade-out');
        void screen.offsetWidth;
        screen.classList.remove('fade-out');
        el('minigame-close')?.classList.add('hidden');
        armMinigame();
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
            disarmMinigame();
            // Fade out first, THEN hide - the CSS transition animates the
            // opacity while the screen is still interactive-visible.
            if (screen.classList.contains('hidden')) {
                if (fill) fill.style.width = '0%';
            } else {
                screen.classList.add('fade-out');
                if (fadeTimer) clearTimeout(fadeTimer);
                fadeTimer = setTimeout(() => {
                    fadeTimer = null;
                    screen.classList.add('hidden');
                    screen.classList.remove('fade-out');
                    if (fill) fill.style.width = '0%';
                }, FADE_MS);
            }
        }
    };
}

export const LoadGate = {
    register(group, def) { loaders.set(group, def); },

    // Direct fade helpers for loading screens managed OUTSIDE the gate (e.g.
    // the pre-menu boot sequence in main.js) so every loading screen fades
    // consistently. Idempotent and re-entrancy safe via the shared timer.
    fadeShow(screen) {
        if (!screen) return;
        if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
        screen.classList.remove('hidden');
        screen.classList.add('fade-out');
        void screen.offsetWidth;
        screen.classList.remove('fade-out');
    },
    fadeHide(screen) {
        if (!screen || screen.classList.contains('hidden')) return;
        screen.classList.add('fade-out');
        if (fadeTimer) clearTimeout(fadeTimer);
        fadeTimer = setTimeout(() => {
            fadeTimer = null;
            screen.classList.add('hidden');
            screen.classList.remove('fade-out');
        }, FADE_MS);
    },

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
    // `onScreen` (v1.4.2) fires once, at the moment the loading screen actually
    // appears - used by gameController to lift the fade veil so the progress
    // bar (and the long-load minigame) is never hidden behind black. Loads
    // faster than SHOW_DELAY_MS never show a screen and never fire it.
    async ensureMany(specs, { label = 'Loading...', onScreen = null } = {}) {
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
        try { await this._wait(combined, label, onScreen); }
        finally { parts.forEach(r => r.listeners.delete(update)); }
    },

    // Resolve once the group is loaded, showing the loading screen only if that
    // takes longer than SHOW_DELAY_MS.
    async ensure(group, { ctx, label = 'Loading...', onScreen = null } = {}) {
        const run = this.prefetch(group, ctx);
        if (run.done) return;
        await this._wait(run, label, onScreen);
    },

    async _wait(run, label, onScreen = null) {
        let hide = null;
        let shownAt = 0;
        const timer = setTimeout(() => {
            shownAt = performance.now();
            hide = showScreen(label, run);
            // v1.4.2: the screen is up (and fading in on its own) - tell the
            // caller so it can lift any cover that would hide it.
            if (onScreen) { try { onScreen(); } catch (e) { console.warn('[loadGate] onScreen callback failed', e); } }
        }, SHOW_DELAY_MS);
        await run.promise;
        clearTimeout(timer);
        if (hide) {
            const wait = MIN_SHOW_MS - (performance.now() - shownAt);
            if (wait > 0) await new Promise(r => setTimeout(r, wait));
            hide();
        }
    },
};
