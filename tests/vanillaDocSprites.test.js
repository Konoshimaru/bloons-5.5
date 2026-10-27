// tests/vanillaDocSprites.test.js
// Regression: the cutscene editor draws actors by resolving every sprite ref
// (actor base + per-key overrides) through js/spriteIndex.js. The vanilla
// intro referenced 'enemy_knight_front' — a real Assets key used by the game —
// that was MISSING from the index, so the editor silently rendered nothing
// for the whole front-facing section of the imported intro.
import { describe, it, expect } from 'vitest';
import { buildVanillaIntroDoc, sampleScene } from '../js/cutsceneRuntime.js';
import { SPRITE_LIBRARY, findEntry } from '../js/spriteIndex.js';

describe('vanilla intro doc ↔ sprite library', () => {
    it('every sprite the doc can show resolves in the sprite index', () => {
        const doc = buildVanillaIntroDoc();
        const refs = new Set();
        for (const a of doc.actors) {
            if (a.sprite) refs.add(a.sprite);
            for (const k of a.keys) if (k.sprite) refs.add(k.sprite);
        }
        expect(refs.size).toBeGreaterThan(0);
        for (const ref of refs) {
            expect(findEntry(ref), `sprite ref "${ref}" missing from sprite index`).not.toBeNull();
        }
    });

    it('every sampled frame across the full timeline resolves (30fps sweep)', () => {
        const doc = buildVanillaIntroDoc();
        const lastKey = Math.max(...doc.actors.flatMap(a => a.keys.map(k => k.t)));
        const dur = Math.max(doc.duration, lastKey);
        for (let t = 0; t <= dur + 1e-9; t += 1 / 30) {
            for (const st of sampleScene(doc, t)) {
                expect(findEntry(st.sprite), `t=${t.toFixed(3)} sprite "${st.sprite}"`).not.toBeNull();
            }
        }
    });

    it('enemy_knight_front alias maps to the real knight_front.png', () => {
        const e = findEntry('enemy_knight_front');
        expect(e).not.toBeNull();
        expect(e.url).toBe('sprites/sheets/enemies/knight_front.png');
        // design size (fw/fh) so the editor previews it at back-frame scale
        expect(e.fw).toBeGreaterThan(0);
        expect(e.fh).toBeGreaterThan(0);
        expect(SPRITE_LIBRARY.filter(x => x.key === 'enemy_knight_front').length).toBe(1);
    });
});
