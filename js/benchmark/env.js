// js/benchmark/env.js
// Tiny DOM/format helpers shared across the benchmark modules.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const el = (id) => document.getElementById(id);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Resolve as soon as `fn()` returns truthy, or reject after `timeoutMs`.
export function waitFor(fn, timeoutMs = 10000, interval = 16) {
    return new Promise((resolve, reject) => {
        const t0 = performance.now();
        (function poll() {
            let v = false;
            try { v = fn(); } catch (e) { v = false; }
            if (v) return resolve(v);
            if (performance.now() - t0 > timeoutMs) return reject(new Error('waitFor timeout'));
            setTimeout(poll, interval);
        })();
    });
}

export const fmtMs = (v) => (v == null ? '—' : v.toFixed(2));
export const fmt1 = (v) => (v == null ? '—' : v.toFixed(1));
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const pct = (n, total) => (total ? ((n / total) * 100).toFixed(1) : '0.0');

// Frame-time → traffic-light color used all over the UI.
export function msColor(ms) {
    if (ms == null) return '#666';
    if (ms < 16.7) return '#2ecc71';
    if (ms < 25) return '#f1c40f';
    if (ms < 33.4) return '#e67e22';
    return '#e74c3c';
}

export function fpsColor(fps) {
    if (fps == null) return '#666';
    if (fps >= 55) return '#2ecc71';
    if (fps >= 40) return '#f1c40f';
    if (fps >= 30) return '#e67e22';
    return '#e74c3c';
}

// Escapes a string for use inside innerHTML (results table contains data
// that is always ours, but be defensive).
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
