// Coalesces high-frequency, display-only DOM writes.
// Repeated values are skipped; rapid changes are combined into a trailing
// flush so change-only fields still display the final value after updates stop.
// State is stored on each element and never feeds back into game simulation.

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
