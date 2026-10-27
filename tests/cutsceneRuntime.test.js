// tests/cutsceneRuntime.test.js
// Pure-logic tests for the cutscene doc format + keyframe sampling shared by
// the editor (cutsceneEditor.js) and the in-game player (cutscenePlayback.js).
import { describe, it, expect } from 'vitest';
import {
    sortKeys, sampleActor, sampleScene, sampleCamera, sceneDuration,
    normalizeDoc, findCameraActor, isKnightActor, buildVanillaIntroDoc,
    EASINGS, CHANNEL_DEFAULTS, VANILLA_INTRO, effectiveMirror, KNIGHT_SCALE,
} from '../js/cutsceneRuntime.js';
import { TUNING } from '../js/tuning.js';

describe('sortKeys', () => {
    it('orders keys ascending by t (in place)', () => {
        const keys = [{ t: 2 }, { t: 0 }, { t: 1 }];
        const out = sortKeys(keys);
        expect(out.map(k => k.t)).toEqual([0, 1, 2]);
        expect(out).toBe(keys);
    });
});

describe('sampleActor', () => {
    it('holds the first key before the track starts', () => {
        const actor = { sprite: 'base', keys: [{ t: 2, x: 100, y: 50 }] };
        expect(sampleActor(actor, 0)).toMatchObject({ x: 100, y: 50, scale: 1, alpha: 1, sprite: 'base' });
    });

    it('holds the last key after the track ends', () => {
        const actor = { keys: [{ t: 0, x: 0 }, { t: 1, x: 300 }] };
        expect(sampleActor(actor, 5).x).toBe(300);
    });

    it('interpolates linearly by default', () => {
        const actor = { keys: [{ t: 0, x: 0, y: 0 }, { t: 2, x: 100, y: 40 }] };
        expect(sampleActor(actor, 1)).toMatchObject({ x: 50, y: 20 });
        expect(sampleActor(actor, 0.5)).toMatchObject({ x: 25, y: 10 });
    });

    it('sparse channels hold their previous value (Blockbench-style)', () => {
        const actor = { keys: [{ t: 0, x: 10, y: 0 }, { t: 1, y: 50 }, { t: 2, y: 100 }] };
        expect(sampleActor(actor, 1.5)).toMatchObject({ x: 10, y: 75 });
    });

    it('applies the outgoing key easing (easeIn vs linear midpoint)', () => {
        const linear = { keys: [{ t: 0, x: 0, easing: 'linear' }, { t: 1, x: 100 }] };
        const easeIn = { keys: [{ t: 0, x: 0, easing: 'easeIn' }, { t: 1, x: 100 }] };
        expect(sampleActor(linear, 0.5).x).toBeCloseTo(50);
        expect(sampleActor(easeIn, 0.5).x).toBeCloseTo(25);
    });

    it('step easing holds the outgoing key until the next one', () => {
        const actor = { keys: [{ t: 0, x: 10, easing: 'step' }, { t: 1, x: 90 }] };
        expect(sampleActor(actor, 0.99).x).toBe(10);
        expect(sampleActor(actor, 1).x).toBe(90);
    });

    it('lerps rotation across the shortest arc', () => {
        const actor = { keys: [{ t: 0, rotation: 350 }, { t: 1, rotation: 10 }] };
        expect(sampleActor(actor, 0.5).rotation).toBeCloseTo(360); // = 350 + 10
    });

    it('uses keyframe sprite override, falling back to the actor base', () => {
        const actor = {
            sprite: 'base',
            keys: [{ t: 0 }, { t: 1, sprite: 'override' }],
        };
        expect(sampleActor(actor, 0.5).sprite).toBe('base');
        expect(sampleActor(actor, 1).sprite).toBe('override');
        expect(sampleActor(actor, 5).sprite).toBe('override'); // holds
    });

    it('sprite does not time-travel before its key (noForwardHold)', () => {
        const actor = { sprite: 'base', keys: [{ t: 2, sprite: 'later' }] };
        expect(sampleActor(actor, 1).sprite).toBe('base');
    });

    it('mirror is discrete and does not time-travel', () => {
        const actor = { keys: [{ t: 0, mirror: false }, { t: 2, mirror: true }] };
        expect(sampleActor(actor, 1).mirror).toBe(false);
        expect(sampleActor(actor, 2).mirror).toBe(true);
    });

    it('alpha clamps 0..1 and scale stays positive after normalize', () => {
        const doc = normalizeDoc({
            duration: 1,
            actors: [{ id: 'a', name: 'a', keys: [{ t: 0, alpha: 5, scale: -3 }] }],
        });
        const k = doc.actors[0].keys[0];
        expect(k.alpha).toBe(1);
        expect(k.scale).toBe(0.01);
    });
});

describe('scene + camera', () => {
    const doc = {
        version: 1, name: 't', duration: 2, useForBossIntro: true,
        actors: [
            { id: 'camera', isCamera: true, name: '🎥 Camera', sprite: null, keys: [{ t: 0, x: 0 }, { t: 1, x: 500 }] },
            { id: 'k1', name: 'knight', sprite: 's', keys: [{ t: 0, x: 5, y: 6 }] },
            { id: 'h', name: 'hidden', sprite: 's2', visible: false, keys: [{ t: 0, x: 1 }] },
        ],
    };

    it('camera actor is found and sampled; never appears in sampleScene', () => {
        expect(findCameraActor(doc).id).toBe('camera');
        expect(sampleCamera(doc, 0.5).x).toBe(250);
        expect(sampleCamera(doc, 5).x).toBe(500); // holds
        const ids = sampleScene(doc, 0).map(s => s.actor.id);
        expect(ids).toEqual(['k1']);
    });

    it('sampleScene filters spriteless and zero-alpha states', () => {
        const d2 = {
            duration: 1,
            actors: [
                { id: 'nosprite', name: 'a', sprite: null, keys: [{ t: 0, x: 1 }] },
                { id: 'faded', name: 'b', sprite: 's', keys: [{ t: 0, alpha: 0 }] },
                { id: 'ok', name: 'c', sprite: 's', keys: [{ t: 0, x: 3 }] },
            ],
        };
        expect(sampleScene(d2, 0.5).map(s => s.actor.id)).toEqual(['ok']);
    });

    it('sceneDuration covers doc.duration and the last key', () => {
        expect(sceneDuration(doc)).toBe(2);
        expect(sceneDuration({ duration: 1, actors: [{ keys: [{ t: 3 }] }] })).toBe(3);
        expect(sceneDuration({ duration: 0, actors: [] })).toBe(0.01);
    });

    it('no camera actor samples to (0,0)', () => {
        expect(sampleCamera({ duration: 1, actors: [] }, 0.5)).toEqual({ x: 0, y: 0 });
    });
});

describe('isKnightActor', () => {
    it('matches name or id, case-insensitive, trimmed; never the camera', () => {
        expect(isKnightActor({ name: 'knight' })).toBe(true);
        expect(isKnightActor({ name: '  Knight ' })).toBe(true);
        expect(isKnightActor({ id: 'knight', name: 'Actor' })).toBe(true);
        expect(isKnightActor({ name: 'knight front' })).toBe(false);
        expect(isKnightActor({})).toBe(false);
        expect(isKnightActor(null)).toBe(false);
        expect(isKnightActor({ isCamera: true, name: 'knight' })).toBe(false);
    });
});

describe('normalizeDoc', () => {
    it('coerces garbage input into a valid empty doc', () => {
        expect(normalizeDoc(null).actors).toEqual([]);
        expect(normalizeDoc('nonsense').name).toBe('Untitled cutscene');
        expect(normalizeDoc({}).duration).toBeGreaterThanOrEqual(0.1);
    });

    it('keeps ids/names, drops invalid keys and unknown easings', () => {
        const doc = normalizeDoc({
            name: 'x', duration: '3.5', useForBossIntro: 1,
            actors: [{
                id: 'knight', name: 'Knight', sprite: 's',
                keys: [
                    { t: '1.25', x: '42', easing: 'easeInOut' },
                    { t: -1, x: 5 },          // dropped (negative)
                    { t: 'abc' },             // dropped (no t)
                    { t: 2, easing: 'nope' }, // easing dropped → linear
                ],
            }],
        });
        expect(doc.duration).toBeCloseTo(3.5);
        expect(doc.useForBossIntro).toBe(true);
        expect(doc.actors[0].keys).toHaveLength(2);
        expect(doc.actors[0].keys[0]).toMatchObject({ t: 1.25, x: 42, easing: 'easeInOut' });
        expect(doc.actors[0].keys[1].easing).toBeUndefined();
    });
});

describe('buildVanillaIntroDoc (authored re-timed reveal)', () => {
    const doc = buildVanillaIntroDoc();
    const BA = TUNING.bossAnim;

    // Recompute the authored schedule the builder derives from tuning
    // (pan + 8fps frame steps + dramatic holds + walk-in) for the sweep test.
    function expectedSchedule() {
        const frames = [];
        let t = BA.phases.pan;
        const holds = BA.knight_back.holds || {};
        for (let i = 1; i <= BA.knight_back.frames; i++) {
            frames.push({ t, sprite: `boss_knight_back_${i}` });
            t += 1 / BA.knight_back.fps + (holds[i] || 0);
        }
        for (let i = 1; i <= BA.equip_sword.frames; i++) {
            frames.push({ t, sprite: `boss_equip_sword_${i}` });
            t += 1 / BA.equip_sword.fps;
        }
        frames.push({ t, sprite: 'enemy_knight_front' });
        return { frames, tReveal: t, tEnd: t + VANILLA_INTRO.walkTime };
    }
    const sched = expectedSchedule();
    const knight = doc.actors[1];
    const keyBySprite = (sprite) => knight.keys.find(k => k.sprite === sprite);

    it('plays the authored 7.275s intro with camera + knight actors', () => {
        expect(doc.duration).toBeCloseTo(7.275, 3);
        expect(doc.duration).toBeCloseTo(sched.tEnd, 3);
        expect(doc.useForBossIntro).toBe(true);
        expect(doc.actors).toHaveLength(2);
        expect(findCameraActor(doc)).toBeTruthy();
        expect(isKnightActor(doc.actors[1])).toBe(true);
    });

    it('lands the two dramatic holds on the authored beats', () => {
        // extra hold after back_3 (roar windup) and back_12 (roar peak)
        expect(keyBySprite('boss_knight_back_4').t).toBeCloseTo(1.833, 3);
        expect(keyBySprite('boss_knight_back_13').t).toBeCloseTo(3.267, 3);
        expect(keyBySprite('boss_equip_sword_1').t).toBeCloseTo(4.142, 3);
        expect(keyBySprite('boss_equip_sword_20').t).toBeCloseTo(6.517, 3);
        // turn to front at the reveal end (x still at the spawn point)
        const front = keyBySprite('enemy_knight_front');
        expect(front.t).toBeCloseTo(6.642, 3);
        expect(front.x).toBe(VANILLA_INTRO.knightX0);
    });

    it('samples the authored frames across a 30fps sweep', () => {
        const dur = sceneDuration(doc);
        let backSeen = 0, eqSeen = 0;
        for (let f = 0; f <= Math.ceil(dur * 30); f++) {
            const t = Math.min(dur, f / 30);
            const s = sampleActor(knight, t);
            // expected discrete frame: last authored frame at/before t
            let exp = 'boss_knight_back_1';
            for (const fr of sched.frames) if (fr.t <= t + 1e-9) exp = fr.sprite;
            if (exp.startsWith('boss_knight_back_')) backSeen++;
            if (exp.startsWith('boss_equip_sword_')) eqSeen++;
            expect(s.sprite).toBe(exp);
        }
        expect(backSeen).toBeGreaterThan(0);
        expect(eqSeen).toBeGreaterThan(0);
    });

    it('camera pans 0→500, holds through the reveal, returns over the walk-in', () => {
        const cam = findCameraActor(doc);
        expect(sampleActor(cam, 0).x).toBe(0);
        expect(sampleActor(cam, BA.phases.pan / 2).x).toBeCloseTo(VANILLA_INTRO.camX / 2, 1);
        expect(sampleActor(cam, BA.phases.pan).x).toBe(VANILLA_INTRO.camX);
        expect(sampleActor(cam, sched.tReveal).x).toBe(VANILLA_INTRO.camX);
        expect(sampleActor(cam, (sched.tReveal + doc.duration) / 2).x)
            .toBeCloseTo(VANILLA_INTRO.camX / 2, 1);
        expect(sampleActor(cam, doc.duration).x).toBe(0);
    });

    it('walk-in: knight slides -400 → 200 during the final 0.633s', () => {
        const tReveal = sched.tReveal;
        expect(sampleActor(knight, tReveal).x).toBe(VANILLA_INTRO.knightX0);
        expect(sampleActor(knight, (tReveal + doc.duration) / 2).x)
            .toBeCloseTo((VANILLA_INTRO.knightX0 + VANILLA_INTRO.knightX1) / 2, 0);
        const fin = sampleActor(knight, doc.duration);
        expect(fin.x).toBe(VANILLA_INTRO.knightX1);
        expect(fin.y).toBe(VANILLA_INTRO.knightY);
        expect(fin.sprite).toBe('enemy_knight_front');
    });

    it('knight key 0 authors game-parity scale (1) and the vanilla mirror flip', () => {
        const first = knight.keys[0];
        // scale 1.0 = the entity renderer's own draw size (native × KNIGHT_SCALE)
        expect(first.scale).toBe(1);
        // the hardcoded render mirrors the knight body unconditionally —
        // the doc authors it so the flip is visible/editable in the editor
        expect(first.mirror).toBe(true);
        // and the flip holds across the whole scene (discrete channel)
        const mid = sampleActor(knight, BA.phases.pan / 2);
        expect(mid.mirrorFound).toBe(true);
        expect(mid.mirror).toBe(true);
        const fin = sampleActor(knight, sceneDuration(doc));
        expect(fin.mirror).toBe(true);
    });
});

describe('knight preview parity (effectiveMirror + mirrorFound)', () => {
    it('mirrorFound is false before the first mirror key and true from it on', () => {
        const actor = { keys: [{ t: 0 }, { t: 1, mirror: false }, { t: 3, mirror: true }] };
        const before = sampleActor(actor, 0.5);
        expect(before.mirrorFound).toBe(false);
        const at = sampleActor(actor, 1);
        expect(at.mirrorFound).toBe(true);
        expect(at.mirror).toBe(false);
        const between = sampleActor(actor, 2);
        expect(between.mirrorFound).toBe(true);   // discrete channel holds
        expect(between.mirror).toBe(false);
        const after = sampleActor(actor, 3.5);
        expect(after.mirror).toBe(true);
    });

    it('non-knight actors draw exactly what they author (default unflipped)', () => {
        expect(effectiveMirror({ mirror: false, mirrorFound: false }, false)).toBe(false);
        expect(effectiveMirror({ mirror: true, mirrorFound: true }, false)).toBe(true);
        expect(effectiveMirror({}, false)).toBe(false);
    });

    it('the knight mirrors by default (game parity) and honors authored overrides', () => {
        // not authored → vanilla unconditional flip
        expect(effectiveMirror({ mirror: false, mirrorFound: false }, true)).toBe(true);
        expect(effectiveMirror({}, true)).toBe(true);
        // authored wins
        expect(effectiveMirror({ mirror: true, mirrorFound: true }, true)).toBe(true);
        expect(effectiveMirror({ mirror: false, mirrorFound: true }, true)).toBe(false);
    });

    it('re-exports the renderer constant the preview math multiplies by', () => {
        expect(KNIGHT_SCALE).toBe(1.65);
    });
});

describe('easings export', () => {
    it('exposes the 8 easings with sane endpoints', () => {
        expect(Object.keys(EASINGS)).toHaveLength(8);
        for (const fn of Object.values(EASINGS)) {
            expect(fn(0)).toBeGreaterThanOrEqual(0);
            expect(fn(1)).toBeLessThanOrEqual(1.2); // easeOutBack overshoots slightly
        }
        expect(CHANNEL_DEFAULTS.x).toBe(0);
    });
});
