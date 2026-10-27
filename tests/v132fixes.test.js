// @vitest-environment jsdom
// v1.3.2 bug-fix sweep: MK free-monkey freebies (no auto-placed glue gunner,
// independent per-type freebies), sandbox variant portraits, alchemist
// rotation, knight split/trail tuning, and the red cash-punishment feedback.
import { describe, it, expect, beforeAll, vi } from 'vitest';

import { Names } from '../js/names.js';
import { MKEffects } from '../js/monkeyKnowledgeEffects.js';
import alchemist from '../js/towers/alchemist.js';
import glue from '../js/towers/glue.js';
import dart from '../js/towers/dart.js';
import { TUNING } from '../js/tuning.js';
import { GameEngine } from '../js/engineRef.js';
import '../js/engine.js';
import { UI } from '../js/ui.js';

describe('v1.3.2 names: sandbox variant sprite files', () => {
    it('builds camo/regen/both sprite paths matching the in-game texture keys', () => {
        expect(Names.getEnemySpriteFile(1, false, false)).toBe('sprites/enemies/red.png');
        expect(Names.getEnemySpriteFile(1, true, false)).toBe('sprites/enemies/red_camo.png');
        expect(Names.getEnemySpriteFile(1, false, true)).toBe('sprites/enemies/red_regen.png');
        expect(Names.getEnemySpriteFile(1, true, true)).toBe('sprites/enemies/red_regen_camo.png');
        expect(Names.getEnemySpriteFile(17, true, true)).toBe('sprites/enemies/bad_regen_camo.png');
    });

    it('returns null for a non-bloon tier (the knight card keeps its portrait)', () => {
        expect(Names.getEnemySpriteFile(0, false, false)).toBeNull();
        expect(Names.getEnemySpriteFile(99, true, true)).toBeNull();
    });
});

describe('v1.3.2 monkey knowledge: free-monkey freebies', () => {
    const eff = (id) => MKEffects.towerPlacement.find(e => e.id === id);

    it('bonus_glue moved out of gameInit into towerPlacement (no auto-placed glue gunner)', () => {
        expect(MKEffects.gameInit.map(e => e.id)).not.toContain('bonus_glue');
        const g = eff('bonus_glue');
        expect(g).toBeTruthy();
        expect(g.type).toContain('glue');
        expect(g.action(225)).toBe(0); // the freebie zeroes the cost
    });

    it('free glue: only in real games, only before any glue exists (independent freebie)', () => {
        const g = eff('bonus_glue');
        const base = { isSandbox: false, difficulty: { noSelling: false }, towers: [] };
        expect(g.condition({ ...base }, 'glue')).toBe(true);
        expect(g.condition({ ...base, isSandbox: true }, 'glue')).toBe(false);
        expect(g.condition({ ...base, difficulty: { noSelling: true } }, 'glue')).toBe(false);
        expect(g.condition({ ...base, towers: [{ type: 'glue' }] }, 'glue')).toBe(false);
    });

    it('the two freebies are INDEPENDENT: a dart on the field leaves the glue freebie up (and vice versa)', () => {
        const bm = eff('bonus_monkey');
        const g = eff('bonus_glue');
        const base = {
            isSandbox: false, difficulty: { noSelling: false },
            config: { data: { unlocks: { freeFirstDartMonkey: true } } },
        };
        // Free dart placed -> free glue still available...
        expect(g.condition({ ...base, towers: [{ type: 'dart' }] }, 'glue')).toBe(true);
        // ...and free glue placed -> free dart still available.
        expect(bm.condition({ ...base, towers: [{ type: 'glue' }] }, 'dart')).toBe(true);
        // Only the freebie's OWN type being on the field spends it.
        expect(g.condition({ ...base, towers: [{ type: 'glue' }] }, 'glue')).toBe(false);
        expect(bm.condition({ ...base, towers: [{ type: 'dart' }] }, 'dart')).toBe(false);
    });

    it('the free darts (MK + profile unlock) work with the free glue up', () => {
        const bm = eff('bonus_monkey');
        const ufd = eff('unlock_free_dart');
        const base = {
            isSandbox: false, difficulty: { noSelling: false }, towers: [{ type: 'glue' }],
            config: { data: { unlocks: { freeFirstDartMonkey: true } } },
        };
        expect(bm.condition({ ...base }, 'dart')).toBe(true);
        expect(ufd.condition({ ...base }, 'dart')).toBe(true);
    });

    it('all three are flagged as freebies so the placement logs the free monkey', () => {
        expect(eff('bonus_monkey').freebie).toBe(true);
        expect(eff('bonus_glue').freebie).toBe(true);
        expect(eff('unlock_free_dart').freebie).toBe(true);
        // Non-freebie placement effects must NOT be flagged.
        expect(eff('military_conscription').freebie).toBeFalsy();
    });

    it('glue mirrors the dart shop-freebie behavior (Free! tag until used)', () => {
        const engine = {
            isSandbox: false, difficulty: { noSelling: false }, towers: [],
            config: { data: { mkActive: true, monkeyKnowledge: { bonus_glue: true } } },
        };
        expect(glue.getPlacementCostModifier({ cost: 225 }, 225, engine)).toBe(0);
        expect(glue.getPlacementCostModifier({ cost: 225 }, 225, { ...engine, towers: [{ type: 'glue' }] })).toBe(225);
        expect(glue.getPlacementCostModifier({ cost: 225 }, 225, { ...engine, isSandbox: true })).toBe(225);
        // Independence: a dart on the field does not spend the glue freebie.
        expect(glue.getPlacementCostModifier({ cost: 225 }, 225, { ...engine, towers: [{ type: 'dart' }] })).toBe(0);
    });

    it('the dart shop-freebie is unaffected by glue (Monkey City stays independent too)', () => {
        const engine = {
            isSandbox: false, difficulty: { noSelling: false }, towers: [{ type: 'glue' }], freeDartMonkeyClaimed: true,
            config: { data: { mkActive: true, monkeyKnowledge: { bonus_monkey: true }, unlocks: {} } },
        };
        expect(dart.getPlacementCostModifier({ cost: 200 }, 200, engine)).toBe(0);
        // Monkey City dart is NOT affected by the MK glue freebie.
        const cityEngine = {
            ...engine, freeDartMonkeyClaimed: false,
            towers: [{ type: 'village', upgrades: [0, 0, 4] }],
            config: { data: { mkActive: true, monkeyKnowledge: {}, unlocks: {} } },
        };
        expect(dart.getPlacementCostModifier({ cost: 200 }, 200, cityEngine)).toBe(0);
    });
});

describe('v1.3.2 alchemist rotation', () => {
    it('no longer pins the alchemist sprite (isStaticRotation removed)', () => {
        expect(alchemist.stats.isStaticRotation).toBeFalsy();
        // Static towers that SHOULD stay put keep the flag.
    });
});

describe('v1.3.2 knight tuning', () => {
    it('the split screen is shorter (3.5s) and the trail is sparser than 0.045', () => {
        expect(TUNING.bossAnim.splitActive).toBe(3.5);
        expect(TUNING.bossAnim.trailInterval).toBeGreaterThan(0.05);
    });
});

describe('v1.3.2 cash punishment feedback', () => {
    it('removeCash flashes the red deduction on the cash counter', () => {
        const spy = vi.spyOn(UI, 'showCashDeduction').mockImplementation(() => {});
        GameEngine.cash = 900;
        GameEngine.removeCash(300);
        expect(GameEngine.cash).toBe(600);
        expect(spy).toHaveBeenCalledWith(300);
        spy.mockRestore();
    });

    it('junk amounts never subtract and never flash', () => {
        const spy = vi.spyOn(UI, 'showCashDeduction').mockImplementation(() => {});
        GameEngine.cash = 100;
        GameEngine.removeCash(0);
        GameEngine.removeCash(-5);
        expect(GameEngine.cash).toBe(100);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});
