// js/uiWriteThrottle.js
//
// [REGRESSION GUARD | local v1.4.3 sniper-lag fix — the owner-reported bug]
// This module IS the v1.4.3 fix for "Sniper 0-0-5 lags the game when shooting the
// Knight". Every HUD write that can churn at hit rate must go through it.
// Pinned by tests/v143fixes.test.js — DO NOT DELETE OR BYPASS.
//
// DOM-write throttle for the per-frame HUD paths (v1.4.3).
//
// Root cause of the owner's "Sniper 0-0-5 lags the game when it shoots the
// Knight" report: the SIMULATION is cheap (bench: ~0.011ms/tick with the
// Elite Defender firing at the boss every tick — see worklog Task 37), but
// several HUD strings change at HIT RATE. "Dmg Dealt: N" ticks up on every
// shot, the boss HP-bar number ticks down on every hit, cash/lives tick with
// every pop/leak. Each of those changes forces a DOM text write (parse +
// layout invalidation) or, for the Pixi boss bar, a full Text re-raster +
// GPU texture re-upload — EVERY FRAME while a fast-firing tower is shooting.
//
// Fix: route those writes through one helper that (a) skips identical values
// outright and (b) for rapidly-changing counters, coalesces updates to a
// fixed rate (10-20Hz) that reads identically to a human. The underlying
// game state is never involved — this only affects how often the DISPLAY
// repaints.
//
// Trailing-edge flush: skipped writes schedule a deferred flush of the final
// value one window later. This matters for elements that are only written
// on CHANGE (cash, lives — engine.updateUI gates the calls behind
// lastCash/lastLives): without it, a change that landed inside a throttle
// window and then stopped changing would leave the display stale forever.
// For per-frame-refreshed elements (counters, boss bar) the flush usually
// gets superseded by the next frame's direct write and never fires.
//
// Usage:
//   writeThrottled(el, str)            — write only when the string changed
//   writeThrottled(el, str, 100)       — + at most once per 100ms (10Hz)
//   writeThrottled(el, html, 100, 'innerHTML') — same, for innerHTML nodes
//   writeStyleThrottled(el, 'width', v, 100)   — same, for style properties
//
// Per-element state lives on the element itself (`_wt`, `_wtp`), so a node
// that is ever replaced (innerHTML rebuilds elsewhere) simply starts fresh.
// All state is display-only: nothing in the game logic reads these nodes.

const WT_STATE = '_wt';      // { value, at } — last value actually written
const WT_PENDING = '_wtp';   // { timer, value } — trailing flush of a skipped value

function _cancelPending(el) {
    const p = el[WT_PENDING];
    if (p) {
        clearTimeout(p.timer);
        el[WT_PENDING] = null;
    }
}

function _throttledWrite(el, target, prop, value, minMs) {
    const now = performance.now();
    const s = el[WT_STATE];

    // Already showing exactly this: never rewrite it. Without this the
    // per-frame panel refresh re-parses identical strings 60x/s. A pending
    // flush of an older value must also die, or it would later overwrite
    // this (now correct) display with a stale number.
    if (s && s.value === value) {
        _cancelPending(el);
        return false;
    }

    // Rapidly-changing counter (damage dealt / boss HP / cash): coalesce.
    // The final value always lands via the trailing flush below.
    if (s && minMs > 0 && (now - s.at) < minMs) {
        _cancelPending(el);
        const wait = Math.max(1, minMs - (now - s.at) + 1);
        el[WT_PENDING] = {
            value,
            timer: setTimeout(() => {
                el[WT_PENDING] = null;
                el[WT_STATE] = { value, at: performance.now() };
                target[prop] = value;
            }, wait),
        };
        return false;
    }

    // Window elapsed (or no throttle): write now. Any pending flush is
    // redundant now — cancel it so it can't clobber this newer value.
    _cancelPending(el);
    el[WT_STATE] = { value, at: now };
    target[prop] = value;
    return true;
}

/**
 * Write `value` to `el[prop]`, but only when it actually changed, and — if
 * `minMs > 0` — never more often than once per `minMs` window (a skipped
 * change flushes at the end of the window, so the display can never end up
 * permanently stale).
 *
 * @param {Element|null} el    owning element (also holds the cache state)
 * @param {string} value       text/html to display
 * @param {number} [minMs=0]  minimum ms between real changes (0 = change-detect only)
 * @param {'innerText'|'innerHTML'} [prop='innerText']
 * @returns {boolean} true when the DOM was actually written
 */
export function writeThrottled(el, value, minMs = 0, prop = 'innerText') {
    if (!el) return false;
    return _throttledWrite(el, el, prop, value, minMs);
}

/**
 * Style-property variant (widths, backgroundImage, ...) — same semantics, for
 * assignments where the string is computed each frame and usually unchanged
 * (e.g. XP-bar widths). Values that legitimately animate every frame (ability
 * cooldown fill heights) should NOT use this — they are cheap transforms, not
 * layout-triggering text.
 */
export function writeStyleThrottled(el, prop, value, minMs = 0) {
    if (!el) return false;
    return _throttledWrite(el, el.style, prop, value, minMs);
}
