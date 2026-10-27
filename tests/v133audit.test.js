// @vitest-environment jsdom
// v1.3.3 audit-fix wave: sandbox saveGame guard (C-6), rAF restart guarantee
// (C-5), and the regrow revival (C-2: regenTimer NaN, canonical regrow chart,
// child ceiling inheritance).
import { describe, it, expect, beforeAll, vi } from 'vitest';

vi.mock('../js/audio.js', () => ({ AudioEngine: { playSfx: vi.fn(), pause: vi.fn(), playMusic: vi.fn(), playGameMusic: vi.fn() } }));
vi.mock('../js/assets.js', () => ({
    default: { get: () => null, preloadCracks: vi.fn() },
}));
vi.mock('../js/pixiSetup.js', () => ({ initPixi: vi.fn(async () => null) }));
// C-5 startGame test: the real GameMap needs a canvas; a bare paths stub is
// all the success path touches (map.paths[0].segments[0]).
vi.mock('../js/map.js', () => ({
    GameMap: class {
        constructor() { this.paths = [{ segments: [{ p1: { x: 0, y: 0 } }] }]; }
        getNearestPathPoint() { return null; }
    },
}));

import { Enemy } from '../js/enemy.js';
import { EnemyTypes } from '../js/data.js';

const FAKE_MAP = { paths: [{ segments: [{ p1: { x: 0, y: 0 } }] }] };

function freshEnemy(tier, { regen = false, maxTier } = {}) {
    const e = new Enemy();
    e.init(tier, FAKE_MAP, false, regen, maxTier ?? tier, false, 1.0, 0, false);
    return e;
}

describe('v1.3.3 C-2: regenTimer initialization', () => {
    it('init() zeroes regenTimer so the accumulator is a number, not NaN', () => {
        const e = freshEnemy(2, { regen: true });
        expect(e.regenTimer).toBe(0);
        e._updateRegen(0.5);
        expect(e.regenTimer).toBe(0.5);
    });

    it('a regen bloon below its ceiling actually regrows after REGEN_INTERVAL', () => {
        const e = freshEnemy(2, { regen: true, maxTier: 5 });
        e.tier = 1; // popped down to red
        e._updateRegen(2.1); // > REGEN_INTERVAL (2.0)
        expect(e.tier).toBe(2); // red -> blue, was impossible pre-fix (NaN gate)
    });

    it('non-regen bloons never regrow, regen bloons at their ceiling never climb', () => {
        const plain = freshEnemy(3, { regen: false, maxTier: 9 });
        plain.tier = 1;
        plain._updateRegen(5);
        expect(plain.tier).toBe(1);

        const capped = freshEnemy(9, { regen: true, maxTier: 9 });
        capped._updateRegen(10);
        expect(capped.tier).toBe(9);
    });
});

describe('v1.3.3 C-2: canonical regrow chart', () => {
    it('zebra skips the purple side branch and lands on rainbow', () => {
        const e = freshEnemy(11, { regen: true, maxTier: 12 }); // ceramic ceiling
        e.tier = 9; // zebra child of the ceramic's rainbow
        e._updateRegen(2.1);
        expect(e.tier).toBe(11); // was 10 (purple) under the old tier+1 climb
    });

    it('a black child regrows through white/lead/zebra in chart order', () => {
        const e = freshEnemy(11, { regen: true, maxTier: 12 });
        e.tier = 6; // black
        e._updateRegen(2.1);
        expect(e.tier).toBe(7); // black -> white
        e._updateRegen(2.1);
        expect(e.tier).toBe(8); // white -> lead
        e._updateRegen(2.1);
        expect(e.tier).toBe(9); // lead -> zebra
    });

    it('a rainbow-lineage black regrows black -> zebra (chart, not tier+1=white)', () => {
        // black sits at depth 5, zebra at 8: one chart step skips white/lead? No:
        // the chart is red->blue->green->yellow->pink->black->white->lead->zebra,
        // so a black regens one layer at a time - this case pins the ORDER.
        const e = freshEnemy(11, { regen: true, maxTier: 11 });
        e.tier = 6;
        e._updateRegen(2.1);
        expect(e.tier).toBe(7);
        e._updateRegen(2.1);
        expect(e.tier).toBe(8);
        e._updateRegen(2.1);
        expect(e.tier).toBe(9);
        e._updateRegen(2.1);
        expect(e.tier).toBe(11); // zebra -> rainbow (skipping purple)
        e._updateRegen(2.1);
        expect(e.tier).toBe(11); // ceiling reached, stays
    });

    it('a wave regen ZOMG never climbs to BAD; a BAD-lineage ZOMG child does', () => {
        const waveZomg = freshEnemy(15, { regen: true, maxTier: 15 });
        waveZomg._updateRegen(10);
        expect(waveZomg.tier).toBe(15);

        const child = freshEnemy(15, { regen: true, maxTier: 17 }); // BAD's ZOMG child
        child._updateRegen(2.1);
        expect(child.tier).toBe(17);
    });

    it('side-branch ceilings never overshoot: purple-lineage pinks top out at zebra', () => {
        const e = freshEnemy(10, { regen: true, maxTier: 10 }); // wave regen purple
        e.tier = 5; // purple's pink child (inherited ceiling 10)
        e._updateRegen(2.1);
        expect(e.tier).toBe(6); // pink -> black
        for (let i = 0; i < 6; i++) e._updateRegen(2.1);
        expect(e.tier).toBe(9); // stops at zebra: rainbow (9) > purple ceiling (8.5)
    });

    it('non-bloon tiers (knight 99) are simply inert', () => {
        const e = freshEnemy(99, { regen: true, maxTier: 99 });
        e._updateRegen(10);
        expect(e.tier).toBe(99);
    });
});

describe('v1.3.3 C-2: spawnChildren inherits the regen ceiling', () => {
    it('children of a regen ceramic carry maxTier=ceramic, not their own tier', () => {
        const parent = freshEnemy(12, { regen: true, maxTier: 12 }); // ceramic
        const spawned = [];
        const fakeEngine = {
            enemyPool: { get: () => new Enemy() },
            enemies: [],
            spawnPopEffect: vi.fn(),
            addCash: vi.fn(),
            log: vi.fn(),
        };
        // spawnChildren reads the engineRef singleton; patch just this test.
        return import('../js/engineRef.js').then(({ GameEngine }) => {
            const backup = { pool: GameEngine.enemyPool, enemies: GameEngine.enemies };
            GameEngine.enemyPool = fakeEngine.enemyPool;
            GameEngine.enemies = fakeEngine.enemies;
            try {
                parent.spawnChildren(true, 0, {});
                expect(fakeEngine.enemies.length).toBe(2); // ceramic -> 2 rainbows
                for (const c of fakeEngine.enemies) {
                    expect(c.tier).toBe(11);
                    expect(c.isRegen).toBe(true);
                    expect(c.maxTier).toBe(12); // was 11 pre-fix: regen dead-ends at rainbow
                }
            } finally {
                GameEngine.enemyPool = backup.pool;
                GameEngine.enemies = backup.enemies;
            }
        });
    });
});

describe('v1.3.3 C-6: sandbox never becomes the Continue save', () => {
    it('saveGame() early-returns in sandbox and leaves savedRun untouched', async () => {
        const { GameEngine: G } = await import('../js/engineRef.js');
        const { default: GameSession } = await import('../js/gameSession.js');
        const { Config } = await import('../js/config.js');
        Config.load();
        Object.assign(G, GameSession); // engine.js mixes GameSession in the same way
        const before = Config.data.savedRun;
        G.gameState = 'playing';
        G.waveManager = { currentWave: 3 };
        G.towers = [];
        // Sandbox session with god-mode numbers: must NOT touch the save slot.
        G.isSandbox = true;
        G.lives = 999999;
        G.cash = 10000000;
        G.saveGame();
        expect(Config.data.savedRun).toBe(before);
        // Normal mode still persists (pre-fix, the sandbox numbers landed here).
        G.isSandbox = false;
        G.saveGame();
        expect(Config.data.savedRun).not.toBe(before);
        expect(Config.data.savedRun.wave).toBe(3);
        expect(Config.data.savedRun.lives).toBe(999999);
        Config.data.savedRun = before;
        Config.save();
    });
});

describe('v1.3.3 pooled-flag sweep', () => {
    it('enemy init() purges stale Skywarden combo state from the pool', () => {
        const e = freshEnemy(3, { regen: false });
        e._skyC_wind = { hits: 3, reset: 1 };
        e._skyC_storm = { hits: 2, reset: 1, stage2Done: true };
        e._skyC_ice = { hits: 2, reset: 1, blastDone: true };
        e.init(3, FAKE_MAP, false, false, 3, false, 1.0, 0, false); // pooled reuse
        expect(e._skyC_wind).toBeNull();
        expect(e._skyC_storm).toBeNull();
        expect(e._skyC_ice).toBeNull();
    });

    it('startGame() resets per-run singleton caches in BOTH modes', async () => {
        const { GameEngine: G } = await import('../js/engineRef.js');
        await import('../js/engine.js'); // populates the singleton's methods
        const { UI } = await import('../js/ui.js');
        Object.assign(UI, {
            log: vi.fn(), updateLives: vi.fn(), updateCash: vi.fn(), updateWave: vi.fn(),
            updateMetaStats: vi.fn(), toggleMenus: vi.fn(), updateWaveSpeedBtn: vi.fn(),
        });
        // Leftovers from a previous normal run on the singleton.
        G.manaShield = 25; G.maxManaShield = 25; G.leakedThisRound = true;
        G.globalXpMult = 1.08; G._postChimpsMoab = { alive: false };
        G.gameState = 'menu'; G.currentMap = 0; G.isSandbox = true;
        G._rafId = null; G.bgInterval = null;
        G._boundLoop = function () {}; // restartLoop schedules this via jsdom rAF
        G.startGame(true);
        expect(G.manaShield).toBe(0);
        expect(G.maxManaShield).toBe(0);
        expect(G.leakedThisRound).toBe(false);
        expect(G.globalXpMult).toBe(1.0);
        expect(G._postChimpsMoab).toBeNull();
    });
});

describe('v1.3.3 C-5: the render loop always comes back', () => {
    it('the visible branch reschedules rAF even in the gameover state', async () => {
        const { GameEngine: G } = await import('../js/engineRef.js');
        await import('../js/engine.js');
        const scheduled = [];
        G._boundLoop = function () {};
        const realRAF = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = (fn) => { scheduled.push(fn); return scheduled.length; };
        try {
            G._rafId = null;
            G.bgInterval = null;
            G.gameState = 'gameover'; // the old guard refused here -> dead page
            G._handleVisibilityChange();
            expect(scheduled.length).toBe(1); // rAF rescheduled
        } finally {
            globalThis.requestAnimationFrame = realRAF;
        }
    });

    it('startGame() restarts the loop as a belt-and-braces guarantee', async () => {
        const { GameEngine: G } = await import('../js/engineRef.js');
        const { UI } = await import('../js/ui.js');
        Object.assign(UI, {
            log: vi.fn(), updateLives: vi.fn(), updateCash: vi.fn(), updateWave: vi.fn(),
            updateMetaStats: vi.fn(), toggleMenus: vi.fn(), updateWaveSpeedBtn: vi.fn(),
        });
        G.gameState = 'menu';
        G.currentMap = 0;
        G.isSandbox = true;
        const scheduled = [];
        G._boundLoop = function () {};
        const realRAF = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = (fn) => { scheduled.push(fn); return scheduled.length; };
        try {
            G._rafId = null; G.bgInterval = null;
            G.startGame(true);
            expect(G.gameState).toBe('playing');
            expect(scheduled.length).toBeGreaterThan(0); // loop guaranteed live
        } finally {
            globalThis.requestAnimationFrame = realRAF;
        }
    });
});
