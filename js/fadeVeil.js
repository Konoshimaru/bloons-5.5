// js/fadeVeil.js
// A global fade-through-black transition (v1.3.6, owner ask: "no transitions,
// no fading to black or anything similar"). One full-screen black veil sits
// over everything; `through(mid)` fades it in, lets `mid()` swap screens
// behind the cover, then fades it back out. Used for title -> main menu,
// menu -> battle and quit -> menu, where before the swap was a hard cut.
//
// Deliberately import-free (DOM + timers only) so any module can use it
// without import cycles. The veil element lives in index.html (#fade-veil),
// its look in css/menus.css.
//
// v1.4.2 COHESION FIX (owner: "the fade to black before the main menu should
// be cohesive, there's a point where it's not fully opaque before clearing
// up"): the old through() went straight from fade-in to fade-out with at
// most one frame at peak opacity - with `ease` curves and a dropped frame the
// black phase never read as fully opaque. Now every through() HOLDS the veil
// at 100% black for HOLD_MS after the fade-in completes and before the
// fade-out starts, and overlapping transitions are serialized with a
// generation counter (a stale off() can never lift a newer fade).

const VEL_MS = 280;   // matches #fade-veil CSS (opacity 0.28s, menus.css)
const HOLD_MS = 150;   // guaranteed full-black plateau between the fades

let _generation = 0;  // serializes overlapping veil operations

function veil() {
    return document.getElementById('fade-veil');
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

export const FadeVeil = {
    get active() { const v = veil(); return !!v && v.classList.contains('on'); },

    // Cover the screen (blocks input while black via pointer-events).
    async on() {
        const v = veil();
        if (!v) return;
        _generation++;
        const gen = _generation;
        v.classList.add('on');
        await wait(VEL_MS + 20);   // let the transition finish before the swap
        return gen;
    },

    // Reveal whatever is underneath.
    async off() {
        const v = veil();
        if (!v) return;
        const gen = ++_generation;
        v.classList.remove('on');
        await wait(VEL_MS);
        return gen;
    },

    // Fade to black, HOLD at full opacity, run the screen swap, fade back in.
    // `mid` may be async; the veil always lifts, even if the swap throws.
    // If a newer veil operation starts mid-way, the older one steps aside
    // (the newer fade owns the element from that point on).
    async through(mid) {
        const gen = await this.on();
        try {
            if (gen !== _generation) return;   // superseded - do not touch
            await wait(HOLD_MS);               // cohesive full-black plateau
            if (gen !== _generation) return;
            await mid();
        } finally {
            if (gen === _generation) await this.off();
        }
    },
};
