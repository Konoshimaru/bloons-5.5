// tests/customKnightBinding.test.js
//
// Regression tests for the in-game custom boss intro: the doc actor named
// "knight" (name OR id, case-insensitive) must DRIVE the real KnightEnemy —
// never draw a duplicate sprite on the cutscene layer while the real boss
// sits frozen at his spawn point (the "two knights + no translation" bug).
//
// Root cause covered here: CustomCutscene.start() used to call stop()
// internally, which nulled the knight target the game had JUST set, so the
// binding was always dead by the first frame. start() now preserves it, and
// the game also binds after start() — both orders are asserted below.
//
// pixi.js and the app-level PixiApp are mocked: what's under test is the
// binding/sampling logic, not GPU rendering. spriteIndex stays real so the
// vanilla doc's Assets-style sprite refs resolve like they do in-game.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pixi.js', () => {
    class FakeTexture {
        constructor(opts) { this.opts = opts || null; }
        static from(ref) { const t = new FakeTexture(); t.ref = ref; return t; }
    }
    FakeTexture.EMPTY = new FakeTexture();

    class FakeNode {
        constructor() {
            this.children = [];
            this.visible = true;
            this.alpha = 1;
            this.x = 0; this.y = 0;
            this.rotation = 0;
            this.label = '';
            this.anchor = { set() {} };
            this.position = { set(x, y) { this.x = x; this.y = y; } };
            this.scale = { set() {} };
        }
        addChild(...c) { this.children.push(...c); return c[c.length - 1]; }
        destroy() { this.children.length = 0; }
    }
    class FakeSprite extends FakeNode {
        constructor(texture) { super(); this.texture = texture; }
    }
    return {
        Container: FakeNode,
        Sprite: FakeSprite,
        Texture: FakeTexture,
        Rectangle: class { constructor() {} },
    };
});
vi.mock('../js/webgl/pixiApp.js', () => ({ PixiApp: { cutsceneLayer: null } }));

import { CustomCutscene } from '../js/cutscenePlayback.js';
import { isKnightActor, buildVanillaIntroDoc } from '../js/cutsceneRuntime.js';

function fakeKnight() {
    return { x: 0, y: 0, sprite: 'none', alpha: 1 };
}

beforeEach(() => {
    CustomCutscene.stop();
});

describe('knight binding survives start()', () => {
    it('REGRESSION: start() preserves a target bound before it (game flow used to null it)', () => {
        const target = fakeKnight();
        CustomCutscene.setKnightTarget(target);
        CustomCutscene.start(buildVanillaIntroDoc());
        expect(CustomCutscene._knightTarget).toBe(target);
    });

    it('start() → then bind (post-start order) also works', () => {
        const target = fakeKnight();
        CustomCutscene.start(buildVanillaIntroDoc());
        CustomCutscene.setKnightTarget(target);
        CustomCutscene.update(0.5);
        // Vanilla doc holds x=-400, y=300 until the pan-back walk.
        expect(target.x).toBe(-400);
        expect(target.y).toBe(300);
    });
});

describe('bound knight drives the real enemy (no duplicate)', () => {
    it('follows authored keyframes and ends at the handover transform', () => {
        const target = fakeKnight();
        const doc = buildVanillaIntroDoc();
        CustomCutscene.start(doc);
        CustomCutscene.setKnightTarget(target);
        const dur = doc.duration;
        CustomCutscene.update(dur * 0.5);
        expect(target.y).toBe(300);
        expect(typeof target.sprite).toBe('string');
        CustomCutscene.update(dur); // t lands on the final key
        expect(target.x).toBe(200);
        expect(target.sprite).toBe('enemy_knight_front');
        const fin = CustomCutscene.finalKnightState();
        expect(fin).toMatchObject({ x: 200, y: 300, sprite: 'enemy_knight_front' });
    });

    it('authored scale drives the boss (previewScale), 1 = renderer-native size', () => {
        const target = fakeKnight();
        const doc = buildVanillaIntroDoc(); // vanilla key 0: scale 1
        CustomCutscene.start(doc);
        CustomCutscene.setKnightTarget(target);
        CustomCutscene.update(0.016);
        expect(target.previewScale).toBe(1);
        CustomCutscene.update(doc.duration); // handover transform sampled too
        expect(target.previewScale).toBe(1);

        const target2 = fakeKnight();
        const doc2 = {
            version: 1, name: 'scaled', duration: 2, useForBossIntro: false,
            actors: [{ id: 'knight', name: 'knight', sprite: 'enemy_knight_front',
                keys: [{ t: 0, x: 0, y: 0, scale: 1.5 }, { t: 2, x: 10, scale: 0.5 }] }],
        };
        CustomCutscene.start(doc2);
        CustomCutscene.setKnightTarget(target2);
        CustomCutscene.update(0);   // exactly on key 0
        expect(target2.previewScale).toBe(1.5);
        CustomCutscene.update(2);   // exactly on the final key
        expect(target2.previewScale).toBe(0.5);
    });

    it('authored mirror drives the boss facing; unauthored keeps the vanilla flip', () => {
        // Doc WITHOUT mirror keys → spriteMirror stays null → the renderer's
        // always-mirrored vanilla default applies.
        const target = fakeKnight();
        const doc = buildVanillaIntroDoc();
        CustomCutscene.start(doc);
        CustomCutscene.setKnightTarget(target);
        CustomCutscene.update(0.016);
        expect(target.spriteMirror).toBe(true); // vanilla doc authors mirror:true

        const target2 = fakeKnight();
        const doc2 = {
            version: 1, name: 'no mirror', duration: 2, useForBossIntro: false,
            actors: [{ id: 'knight', name: 'knight', sprite: 'boss_knight_back_1',
                keys: [{ t: 0, x: 0, y: 0 }, { t: 1, mirror: false }, { t: 2, mirror: true }] }],
        };
        CustomCutscene.start(doc2);
        CustomCutscene.setKnightTarget(target2);
        CustomCutscene.update(0.5);
        expect(target2.spriteMirror).toBeNull();   // before first mirror key → vanilla default
        CustomCutscene.update(0.5);                // t = 1 → authored false
        expect(target2.spriteMirror).toBe(false);
        CustomCutscene.update(1);                  // t = 2 → authored true
        expect(target2.spriteMirror).toBe(true);
    });

    it('the knight actor never gets a visible duplicate sprite while bound', () => {
        const target = fakeKnight();
        CustomCutscene.start(buildVanillaIntroDoc());
        CustomCutscene.setKnightTarget(target);
        CustomCutscene.update(0.5);
        const spr = CustomCutscene._sprites.get('knight');
        expect(spr).toBeTruthy();              // sprite exists…
        expect(spr.visible).toBe(false);       // …but is suppressed (real boss is drawn by the enemy renderer)
    });

    it('binds by id "knight" even when the name is generic', () => {
        const target = fakeKnight();
        const doc = {
            version: 1, name: 't', duration: 2, useForBossIntro: true,
            actors: [{ id: 'knight', name: 'Actor', sprite: 'boss_knight_back_1', keys: [{ t: 0, x: 42, y: 7 }] }],
        };
        CustomCutscene.start(doc);
        CustomCutscene.setKnightTarget(target);
        CustomCutscene.update(1);
        expect(target.x).toBe(42);
        expect(target.y).toBe(7);
    });

    it('camera channel still samples while the knight is bound', () => {
        const target = fakeKnight();
        CustomCutscene.start(buildVanillaIntroDoc());
        CustomCutscene.setKnightTarget(target);
        CustomCutscene.update(2.0); // pan done (t=1.2) → camera holds 500
        expect(CustomCutscene.cam.x).toBe(500);
    });

    it('stop() clears the binding', () => {
        CustomCutscene.setKnightTarget(fakeKnight());
        CustomCutscene.start(buildVanillaIntroDoc());
        CustomCutscene.stop();
        expect(CustomCutscene._knightTarget).toBeNull();
    });
});

describe('unbound playback (no target) keeps standalone semantics', () => {
    it('a knight-named actor still draws as a plain sprite when nothing is bound', () => {
        const doc = {
            version: 1, name: 't', duration: 2, useForBossIntro: true,
            actors: [{ id: 'k1', name: 'knight', sprite: '/img/knight.png', keys: [{ t: 0, x: 5, y: 6 }] }],
        };
        CustomCutscene.start(doc);
        CustomCutscene.update(0.1);
        const spr = CustomCutscene._sprites.get('k1');
        expect(spr).toBeTruthy();
        expect(spr.visible).toBe(true);
        expect(spr.position.x).toBe(5);
        expect(spr.position.y).toBe(6);
    });
});

describe('finalKnightState fallbacks', () => {
    it('returns null when the doc has no knight actor (vanilla end state path)', () => {
        const doc = {
            version: 1, name: 't', duration: 1, useForBossIntro: true,
            actors: [{ id: 'a1', name: 'smoke', sprite: '/x.png', keys: [{ t: 0, x: 1 }] }],
        };
        CustomCutscene.start(doc);
        expect(CustomCutscene.finalKnightState()).toBeNull();
    });

    it('returns null when the knight actor has no keys', () => {
        const doc = {
            version: 1, name: 't', duration: 1, useForBossIntro: true,
            actors: [{ id: 'knight', name: 'knight', sprite: 's', keys: [] }],
        };
        CustomCutscene.start(doc);
        expect(CustomCutscene.finalKnightState()).toBeNull();
    });
});

describe('isKnightActor matching', () => {
    it('matches name or id, case-insensitive, trimmed', () => {
        expect(isKnightActor({ name: 'knight' })).toBe(true);
        expect(isKnightActor({ name: '  Knight ' })).toBe(true);
        expect(isKnightActor({ name: 'KNIGHT' })).toBe(true);
        expect(isKnightActor({ id: 'knight', name: 'Actor' })).toBe(true);
        expect(isKnightActor({ id: 'KNIGHT' })).toBe(true);
    });

    it('rejects non-knight actors, prefixes, and the camera', () => {
        expect(isKnightActor({ name: 'knight front' })).toBe(false);
        expect(isKnightActor({ name: 'smoke' })).toBe(false);
        expect(isKnightActor({})).toBe(false);
        expect(isKnightActor(null)).toBe(false);
        expect(isKnightActor({ isCamera: true, name: 'knight' })).toBe(false);
    });
});
