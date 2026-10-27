// js/cutsceneRuntime.js
//
// Pure cutscene math shared by the editor (js/cutsceneEditor.js) and the
// in-game player (js/cutscenePlayback.js): the cutscene document format,
// keyframe sampling with per-channel interpolation + easing.
//
// No DOM / Pixi imports here — this module must stay testable in vitest.
// tuning.js / constants.js are pure data leaves, safe for the same reason.
//
// Cutscene document ("cutscene doc") format v1:
// {
//   version: 1,
//   name: 'knight intro',
//   duration: 12,            // seconds (extended to cover the last key)
//   useForBossIntro: false,  // game plays this during the boss reveal when true
//   actors: [{
//     id: 'a1', name: 'Knight', sprite: 'boss_knight_back_1', visible: true,
//     keys: [{ t: 0, x: -400, y: 300, scale: 1.65, rotation: 0, alpha: 1,
//              mirror: false, sprite: null, easing: 'easeInOut' }, ...]
//   },
//   // Optional reserved camera actor: its x/y channels pan the in-game world
//   // camera (CutsceneManager.cameraOffsetX) during playback. Never drawn.
//   { id: 'camera', isCamera: true, name: 'Camera', sprite: null,
//     keys: [{ t: 0, x: 0, easing: 'linear' }, { t: 1.2, x: 500 }] }]
// }
//
// Keyframe semantics:
//  - A key holds a full transform snapshot; any channel left undefined means
//    "hold the previous value" (Blockbench-style sparse channels).
//  - Between key[i] and key[i+1] every defined channel interpolates using
//    key[i].easing (the easing OUT of that key). 'step' holds until the next key.
//  - Before the first key that defines a channel → hold that key's value.
//    After the last one → hold it too.
//
// Knight preview parity (IMPORTANT): the in-game boss is drawn by the entity
// renderer (renderCutscene._drawKnightEffects), NOT by the cutscene layer —
// native frame size × KNIGHT_SCALE, and the art is MIRRORED (the canvas port
// flipped him unconditionally with ctx.scale(-1,1)). So:
//  - scale 1.0 on a "knight" keyframe means "exactly the size the game draws
//    this frame"; the editor multiplies native × KNIGHT_SCALE × scale, and the
//    game multiplies the same texture by KNIGHT_SCALE × previewScale.
//  - the mirror channel is an OVERRIDE: before the first key that defines
//    mirror, the knight previews/applies the game default (mirrored). Once a
//    key defines mirror, that value wins. sampleActor reports whether the
//    channel was actually authored via `mirrorFound`.

export const DOC_VERSION = 1;

// ---------------- easing ----------------

function linear(u) { return u; }
function step() { return 0; } // hold value of the outgoing key until the next one
function easeIn(u) { return u * u; }
function easeOut(u) { return 1 - (1 - u) * (1 - u); }
function easeInOut(u) {
    return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
}
function easeInCubic(u) { return u * u * u; }
function easeOutCubic(u) { return 1 - Math.pow(1 - u, 3); }
function easeOutBack(u) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
}

export const EASINGS = {
    linear, step, easeIn, easeOut, easeInOut, easeInCubic, easeOutCubic, easeOutBack,
};
export const EASING_NAMES = Object.keys(EASINGS);

function easingFn(name) {
    return EASINGS[name] || linear;
}

// Rotation lerps across the shortest arc (350° → 10° goes +20°, not -340°).
function lerpAngle(a, b, u) {
    let d = (b - a) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return a + d * u;
}

// ---------------- key / actor sampling ----------------

/** Sort keys by time (ascending), in place. Returns the array for chaining. */
export function sortKeys(keys) {
    keys.sort((a, b) => a.t - b.t);
    return keys;
}

/**
 * Sample one channel of an actor at time t.
 * keys must be sorted. `match(key)` says whether the key defines the channel.
 * `opts.noForwardHold`: discrete channels (sprite/mirror) must not take the
 * value of a FUTURE key before that key's time — they fall back to the
 * channel default / actor base instead. Numeric channels keep forward-hold
 * so an actor whose first position key is at t=2 doesn't teleport to origin
 * before it.
 * Returns { value, animating } — animating=false means the value is held.
 */
function sampleChannel(keys, t, match, lerp, opts = {}) {
    let prev = null;
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (k.t <= t && match(k)) prev = k;
        if (k.t > t) break;
    }
    if (prev && prev.t === t) return { value: prev, animating: false };

    let next = null;
    for (let i = 0; i < keys.length; i++) {
        if (keys[i].t > t && match(keys[i])) { next = keys[i]; break; }
    }

    if (!prev && !next) return { value: undefined, animating: false };
    if (!prev) {
        if (opts.noForwardHold) return { value: undefined, animating: false };
        return { value: next, animating: false };   // hold first defined value
    }
    if (!next) return { value: prev, animating: false };   // hold last defined value

    const span = next.t - prev.t;
    const u = span > 0 ? (t - prev.t) / span : 1;
    const f = easingFn(prev.easing)(Math.min(1, Math.max(0, u)));
    return { value: { prev, next }, animating: true, f, lerp };
}

const NUMERIC_CHANNELS = ['x', 'y', 'scale', 'rotation', 'alpha'];
const DEFAULTS = {
    x: 0, y: 0, scale: 1, rotation: 0, alpha: 1,
    mirror: false, sprite: null, easing: 'linear',
};

/**
 * Sample an actor's full transform at time t (seconds).
 * Returns { x, y, scale, rotation, alpha, mirror, mirrorFound, sprite } —
 * sprite is the keyframe override if set, else the actor's base sprite.
 * mirrorFound says whether ANY key at/before t defines the mirror channel
 * (before that, mirror holds the channel default and the KNIGHT actor's
 * game-default facing applies — see effectiveMirror below).
 */
export function sampleActor(actor, t) {
    const keys = actor.keys || [];
    const out = {
        x: DEFAULTS.x, y: DEFAULTS.y,
        scale: DEFAULTS.scale, rotation: DEFAULTS.rotation,
        alpha: DEFAULTS.alpha, mirror: DEFAULTS.mirror, mirrorFound: false,
        sprite: actor.sprite || null,
    };
    if (!keys.length) return out;

    for (const ch of NUMERIC_CHANNELS) {
        const s = sampleChannel(keys, t, (k) => typeof k[ch] === 'number', (a, b, f) => a + (b - a) * f);
        if (s.value === undefined) continue;
        if (s.animating) {
            const a = s.value.prev[ch], b = s.value.next[ch];
            out[ch] = ch === 'rotation' ? lerpAngle(a, b, s.f) : s.lerp(a, b, s.f);
        } else {
            out[ch] = s.value[ch];
        }
    }

    const mir = sampleChannel(keys, t, (k) => typeof k.mirror === 'boolean', null, { noForwardHold: true });
    out.mirrorFound = mir.value !== undefined;
    if (mir.value !== undefined) {
        out.mirror = mir.animating ? mir.value.prev.mirror : mir.value.mirror;
    }

    const spr = sampleChannel(keys, t, (k) => typeof k.sprite === 'string' && k.sprite, null, { noForwardHold: true });
    if (spr.value !== undefined) {
        out.sprite = spr.animating ? spr.value.prev.sprite : spr.value.sprite;
    }

    return out;
}

// ---------------- camera ----------------

/** The camera is a reserved actor (isCamera: true) whose x/y channels pan the
 *  in-game world camera during playback. It gets a normal timeline lane in the
 *  editor but never renders a sprite. */
export function findCameraActor(doc) {
    return (doc.actors || []).find(a => a.isCamera) || null;
}

/** Sample the scene camera at t. Returns { x, y } — (0, 0) with no camera. */
export function sampleCamera(doc, t) {
    const cam = findCameraActor(doc);
    if (!cam) return { x: 0, y: 0 };
    const s = sampleActor(cam, t);
    return { x: s.x, y: s.y };
}

/** Duration needed to cover the doc: its duration field vs the last key. */
export function sceneDuration(doc) {
    let last = 0;
    for (const a of doc.actors || []) {
        for (const k of a.keys || []) last = Math.max(last, k.t);
    }
    return Math.max(doc.duration || 0, last, 0.01);
}

/**
 * Sample the whole scene. Returns an array of draw states for visible actors:
 * [{ actor, x, y, scale, rotation, alpha, mirror, mirrorFound, sprite }].
 */
export function sampleScene(doc, t) {
    const out = [];
    for (const actor of doc.actors || []) {
        if (actor.isCamera) continue;   // reserved camera actor never draws
        if (actor.visible === false) continue;
        const s = sampleActor(actor, t);
        if (s.sprite === null) continue; // no sprite anywhere → nothing to draw
        if (s.alpha <= 0) continue;
        out.push({ actor, ...s });
    }
    return out;
}

// ---------------- knight preview parity ----------------
//
// Shared by the editor stage (cutsceneEditor.js) and unit tests so the
// preview, playback and tests all agree on one definition of "how the boss
// is drawn". KNIGHT_SCALE is the same constant the entity renderer uses.

export { KNIGHT_SCALE } from './webgl/rendererConstants.js';

/**
 * Effective facing for a sampled state. Non-knight actors draw exactly what
 * they author (mirror default false). The KNIGHT actor mirrors like the game
 * does unless a keyframe explicitly overrides the facing.
 */
export function effectiveMirror(st, isKnight) {
    if (!isKnight) return !!st.mirror;
    return st.mirrorFound ? !!st.mirror : true;
}

// ---------------- knight handover binding ----------------

/**
 * True when this actor is the reserved "knight" handover actor that drives
 * the real KnightEnemy during playback (see cutscenePlayback.js).
 * Matched case-insensitively on name OR id — hand-authored/imported docs may
 * carry the name in either field (normalizeDoc defaults a missing name to
 * 'Actor', so an actor with id 'knight' must still bind).
 */
export function isKnightActor(actor) {
    if (!actor || actor.isCamera) return false;
    const name = typeof actor.name === 'string' ? actor.name.trim().toLowerCase() : '';
    const id = typeof actor.id === 'string' ? actor.id.trim().toLowerCase() : '';
    return name === 'knight' || id === 'knight';
}

// ---------------- document normalization ----------------

let idCounter = 0;
function makeId() { return `a${Date.now().toString(36)}${(idCounter++).toString(36)}`; }

function num(v, fallback) {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return typeof n === 'number' && isFinite(n) ? n : fallback;
}

/** Coerce arbitrary parsed JSON into a valid cutscene doc (import / load path). */
export function normalizeDoc(raw) {
    const doc = {
        version: DOC_VERSION,
        name: typeof raw?.name === 'string' ? raw.name : 'Untitled cutscene',
        duration: Math.max(0.1, num(raw?.duration, 8)),
        useForBossIntro: !!raw?.useForBossIntro,
        actors: [],
    };
    const actors = Array.isArray(raw?.actors) ? raw.actors : [];
    for (const a of actors) {
        const actor = {
            id: typeof a?.id === 'string' ? a.id : makeId(),
            name: typeof a?.name === 'string' && a.name.trim() ? a.name.trim() : 'Actor',
            sprite: typeof a?.sprite === 'string' ? a.sprite : null,
            visible: a?.visible !== false,
            isCamera: !!a?.isCamera,
            keys: [],
        };
        const keys = Array.isArray(a?.keys) ? a.keys : [];
        for (const k of keys) {
            const t = num(k?.t, null);
            if (t === null || t < 0) continue;
            const key = { t: Math.round(t * 1000) / 1000 };
            for (const ch of NUMERIC_CHANNELS) {
                const v = num(k?.[ch], null);
                if (v !== null) key[ch] = ch === 'alpha'
                    ? Math.min(1, Math.max(0, v))
                    : ch === 'scale'
                        ? Math.max(0.01, v)
                        : v;
            }
            if (typeof k?.mirror === 'boolean') key.mirror = k.mirror;
            if (typeof k?.sprite === 'string' && k.sprite) key.sprite = k.sprite;
            if (typeof k?.easing === 'string' && EASINGS[k.easing]) key.easing = k.easing;
            actor.keys.push(key);
        }
        sortKeys(actor.keys);
        doc.actors.push(actor);
    }
    return doc;
}

export { DEFAULTS as CHANNEL_DEFAULTS };

// ---------------- vanilla knight intro reconstruction ----------------
//
// The hardcoded boss reveal (js/cutscene.js states panning_to_knight →
// knight_revealed → panning_back), rebuilt as an editable cutscene doc.
// Read from LIVE tuning so a rebalance of bossAnim.phases / fps automatically
// flows into the editor's "Import vanilla" button. Kept here (not in the
// editor) so tests can assert parity with the real state machine.

import { TUNING } from './tuning.js';
import { GLOBAL_SCALE } from './constants.js';

export const VANILLA_INTRO = {
    knightX0: -400,  // CutsceneManager spawn: new KnightEnemy(-400, 300)
    knightY: 300,
    knightX1: 200,   // pan-back landing spot (knight.js homeX)
    camX: 500,       // CutsceneManager.cameraTargetX
    walkTime: 0.633, // authored walk-in after the reveal, while the camera pans back
    // Historical note: the boss body is NOT drawn through a data.size fit
    // box — renderCutscene._drawKnightEffects draws knight.sprite at its
    // native frame size × KNIGHT_SCALE (1.65) and mirrors it. Scale 1.0 in
    // the doc therefore means "the exact in-game draw size".
    drawSize: 90,    // KnightEnemy data.size (hitbox/radius bookkeeping only)
    frameW: 122,     // boss_knight_back_*.png native width (art is 122x115)
};

/**
 * Build the vanilla knight reveal as a cutscene doc (useForBossIntro on).
 * This is the user-authored RE-TIMED intro: 8fps frame steps with two
 * dramatic holds (after back_3 and back_12 — TUNING.bossAnim.knight_back.holds),
 * then the turn-to-front + walk-in while the camera pans back. Totals
 * 7.275s. The game plays this whenever no editor scene is saved
 * (cutscene.js: loadCustomDoc() || buildVanillaIntroDoc()).
 */
export function buildVanillaIntroDoc() {
    const BA = TUNING.bossAnim;
    const V = VANILLA_INTRO;
    const pan = BA.phases.pan;
    const holds = BA.knight_back.holds || {};
    const r3 = (v) => Math.round(v * 1000) / 1000;

    const knightKeys = [{
        t: 0, x: V.knightX0, y: V.knightY,
        // scale 1 = the entity renderer's own draw size (native × KNIGHT_SCALE)
        scale: 1,
        // the game mirrors the knight body unconditionally (the ctx.scale(-1,1)
        // port) — author it explicitly so the flip is visible/editable
        mirror: true,
    }];
    let t = pan;
    for (let i = 1; i <= BA.knight_back.frames; i++) {
        knightKeys.push({ t: r3(t), sprite: `boss_knight_back_${i}` });
        t += 1 / BA.knight_back.fps + (holds[i] || 0);
    }
    for (let i = 1; i <= BA.equip_sword.frames; i++) {
        knightKeys.push({ t: r3(t), sprite: `boss_equip_sword_${i}` });
        t += 1 / BA.equip_sword.fps;
    }
    // turn to face the player, then walk in during the camera pan-back
    const tReveal = r3(t);
    knightKeys.push({ t: tReveal, x: V.knightX0, sprite: 'enemy_knight_front', easing: 'linear' });
    const tEnd = r3(tReveal + V.walkTime);
    knightKeys.push({ t: tEnd, x: V.knightX1 });

    const camKeys = [
        { t: 0, x: 0, easing: 'linear' },
        { t: r3(pan), x: V.camX, easing: 'linear' },
        { t: tReveal, x: V.camX, easing: 'linear' },
        { t: tEnd, x: 0, easing: 'linear' },
    ];

    return {
        version: 1,
        name: 'Knight intro (vanilla)',
        duration: tEnd,
        useForBossIntro: true,
        actors: [
            { id: 'camera', isCamera: true, name: '🎥 Camera', sprite: null, visible: true, keys: camKeys },
            { id: 'knight', name: 'knight', sprite: 'boss_knight_back_1', visible: true, keys: knightKeys },
        ],
    };
}
