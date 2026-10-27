// @vitest-environment jsdom
// Paragon Wave-1 flow suite (plan ch.8: "Sacrifice sweep", "Creation gate",
// "Buff immunity", "Persistence"). Uses the REAL modules (same recipe as
// moduleLoad.test.js: jsdom + the real import chain) and populates the
// engineRef singleton by hand - exactly what engine.js does at runtime.
import { describe, it, expect, beforeAll, vi } from 'vitest';

import { GameEngine as G } from '../js/engineRef.js';
// Load the real engine module first: it populates the singleton with the real
// methods under test (addTowerXp, PARAGON_XP_TYPES, ...). beforeAll then
// overrides only the run-state fields for isolation.
import '../js/engine.js';
import { Config } from '../js/config.js';
import { UI } from '../js/ui.js';
import GameSession from '../js/gameSession.js';
import { Tower } from '../js/tower.js';
import { Projectile } from '../js/projectile.js';
import { ProjectileTypeConfig } from '../js/projectileTypeConfig.js';
import { GAME_AREA_WIDTH } from '../js/constants.js';
import { TowerRegistry } from '../js/towers/index.js';
import { createApexParagon, applyApexStats } from '../js/towers/paragon_dart.js';
import { canOfferParagon, computePower, degreeFromPower, apexStats, PARAGON_POWER_RULES } from '../js/paragonPower.js';
import { getSellValue } from '../js/towerEconomy.js';

const CFG = PARAGON_POWER_RULES.dart;

function dartT5(x, y, upgrades, totalSpent, damageDealt) {
    const t = new Tower(x, y, 'dart');
    t.upgrades = [...upgrades];
    t.totalSpent = totalSpent;
    t.damageDealt = damageDealt;
    return t;
}

beforeAll(() => {
    Config.load();
    // Stub the UI surface the touched code paths call into.
    Object.assign(UI, {
        log: vi.fn(), updateLives: vi.fn(), updateCash: vi.fn(), updateWave: vi.fn(),
        refreshSelectedTower: vi.fn(), updateMetaStats: vi.fn(), toggleMenus: vi.fn(),
        showUpgradeUI: vi.fn(), hideUpgradePanel: vi.fn(), showPause: vi.fn(), hidePause: vi.fn(),
        updateWaveSpeedBtn: vi.fn(),
    });
    // Populate the engineRef singleton the way engine.js does (config/ui are
    // getter-defined by engine.js and already point at the real modules).
    Object.assign(G, {
        gameState: 'playing',
        currentMap: 0,
        lives: 100,
        cash: 1000000,
        difficulty: { costMod: 1.0, name: 'Medium' },
        isSandbox: false,
        towers: [],
        enemies: [],
        tier5Bought: {},
        towerXpSession: {},
        selectedPlacedTower: null,
        waveManager: { currentWave: 10, waveActive: false },
        getCost: (c) => Math.floor(c * 1.0),
        spawnPopEffect: vi.fn(),
        log: vi.fn(),
        updateUI: vi.fn(),
        deselectAll: vi.fn(),
        updateShopPrices: null,
    });
    // Mix the GameSession methods in (engine.js does Object.assign too).
    Object.assign(G, GameSession);
    G.startGame = vi.fn(); // loadGame calls this.startGame(false)
});

describe('creation flow: three T5s -> real paragon (BTD6 rules, v1.3.2)', () => {
    it('offers the paragon in a real game with three T5s even without the XP mastery unlock', () => {
        G.towers = []; G.tier5Bought = { 'dart-1': true, 'dart-2': true, 'dart-3': true };
        Config.data.paragonUnlocks = {};
        const source = dartT5(100, 100, [0, 0, 5], 21600, 0);
        G.towers.push(source);
        const offer = canOfferParagon(G, source, 'dart');
        expect(offer.checklist.xpUnlocked).toBe(false); // mastery milestone unmet...
        expect(offer.offered).toBe(true);               // ...but it no longer gates creation
    });

    it('withholds the card when a Tier 5 is missing (nothing consumed)', () => {
        G.towers = []; G.tier5Bought = { 'dart-1': true, 'dart-2': true };
        Config.data.paragonUnlocks = { dart: true };
        const source = dartT5(100, 100, [0, 0, 5], 21600, 0);
        G.towers.push(source);
        const offer = canOfferParagon(G, source, 'dart');
        expect(offer.checklist.threeT5s).toBe(false);
        expect(offer.offered).toBe(false);
        expect(createApexParagon(source, G)).toBe(false);
        expect(G.towers).toHaveLength(1); // nothing was consumed
    });

    it('sweeps every dart, computes power from the sacrifices and spawns the right degree', () => {
        Config.data.paragonUnlocks = { dart: true };
        G.towers = [
            dartT5(100, 100, [0, 0, 5], 21600, 50000),  // source (Crossbow Master + t1)
            dartT5(130, 100, [0, 5, 0], 45000, 30000),  // PMFC
            dartT5(160, 100, [5, 0, 0], 15000, 20000),  // Ultra-Juggernaut
            dartT5(190, 100, [0, 1, 0], 1200, 0),
            dartT5(220, 100, [0, 0, 1], 800, 0),
            new Tower(250, 250, 'village'),             // other types are untouched
        ];
        G.tier5Bought = { 'dart-1': true, 'dart-2': true, 'dart-3': true };
        G.cash = 1000000;

        const source = G.towers[0];
        expect(createApexParagon(source, G)).toBe(true);

        // Charged the difficulty-scaled price.
        expect(G.cash).toBe(1000000 - 150000);
        // Every dart consumed, other types kept.
        expect(G.towers.filter(t => t.type === 'dart')).toHaveLength(0);
        expect(G.towers.some(t => t.type === 'village')).toBe(true);
        // Exactly one paragon spawned at the source's position.
        const paragons = G.towers.filter(t => t.type === 'paragon_dart');
        expect(paragons).toHaveLength(1);
        const p = paragons[0];
        expect(p.isParagon).toBe(true);
        expect(p.x).toBe(100); expect(p.y).toBe(100);

        // Power: cash pool = the two non-T5 darts (2,000); 14 non-T5 tiers;
        // 100,000 pops across the pool (T5s included).
        const expected = computePower({
            towers: [
                { totalSpent: 21600, upgrades: [0, 0, 5], damageDealt: 50000 },
                { totalSpent: 45000, upgrades: [0, 5, 0], damageDealt: 30000 },
                { totalSpent: 15000, upgrades: [5, 0, 0], damageDealt: 20000 },
                { totalSpent: 1200, upgrades: [0, 1, 0], damageDealt: 0 },
                { totalSpent: 800, upgrades: [0, 0, 1], damageDealt: 0 },
            ],
            totems: 0,
        });
        expect(p.powerBreakdown.total).toBeCloseTo(expected.total, 6);
        const wantDegree = degreeFromPower(expected.total);
        expect(p.paragonDegree).toBe(wantDegree);
        expect(p.paragonDegree).toBeGreaterThan(1);
        expect(p.paragonDegree).toBeLessThanOrEqual(100);

        // Per-degree stats actually applied.
        const want = apexStats(p.paragonDegree);
        expect(p.stats.damage).toBe(want.damage);
        expect(p.stats.pierce).toBe(want.pierce);
        expect(p.stats.baseCooldown).toBe(want.interval);
        expect(p.stats.ceramicDmg).toBe(want.ceramicDmg);

        // v1.4.1 sell rule: 70% of everything paid - the source T5's cash +
        // the paragon's charged base price (no investment was entered here).
        expect(p.totalSpent).toBe(21600 + CFG.baseCost);
        expect(getSellValue(p, G)).toBe(Math.floor((21600 + CFG.baseCost) * 0.7));

        // The exclusivity ledger resets so new T5s can be built.
        expect(G.tier5Bought['dart-1']).toBe(false);
        expect(G.tier5Bought['dart-2']).toBe(false);
        expect(G.tier5Bought['dart-3']).toBe(false);
        // The new paragon is selected for the player.
        expect(G.selectedPlacedTower).toBe(p);
    });

    it('refuses a second paragon while one exists', () => {
        const source = dartT5(300, 300, [0, 0, 5], 21600, 0);
        const offer = canOfferParagon(G, source, 'dart');
        expect(offer.checklist.noneExists).toBe(false);
        expect(offer.offered).toBe(false);
        expect(createApexParagon(source, G)).toBe(false);
        expect(G.towers.filter(t => t.type === 'paragon_dart')).toHaveLength(1);
    });

    it('sandbox follows the same rule since v1.4.0: no free offering without the Tier 5s', () => {
        G.isSandbox = true;
        Config.data.paragonUnlocks = {};
        const saved = G.towers;
        G.towers = G.towers.filter(t => t.type !== 'paragon_dart'); // clear the existing one
        const base = new Tower(400, 400, 'dart'); // any tier - the source tier no longer matters

        G.tier5Bought = { 'dart-1': true, 'dart-2': true, 'dart-3': true };
        const withT5s = canOfferParagon(G, base, 'dart');
        expect(withT5s.sandbox).toBe(true);
        expect(withT5s.eligible).toBe(true);
        expect(withT5s.offered).toBe(true); // same rule as a normal game

        G.tier5Bought = {};
        const noT5s = canOfferParagon(G, base, 'dart');
        expect(noT5s.eligible).toBe(false);
        expect(noT5s.offered).toBe(false); // sandbox no longer bypasses the T5 gate

        G.towers = saved;
        G.isSandbox = false;
    });
});

describe('buff immunity: paragons accept no external buffs or sacrifices', () => {
    it('Sun Temple sacrifice never consumes a paragon', () => {
        const temple = { type: 'super', x: 0, y: 0, stats: { range: 50, isHero: false }, upgrades: [4, 0, 0], totalSpent: 100000 };
        const dart = new Tower(30, 0, 'dart');
        dart.totalSpent = 5000;
        const paragon = { type: 'paragon_dart', isParagon: true, x: 10, y: 0, stats: { isHero: false }, upgrades: [0, 0, 0], totalSpent: 99999 };
        G.towers = [temple, dart, paragon];
        G.selectedPlacedTower = null;

        TowerRegistry.super._performSacrifice(temple, false);

        expect(G.towers.some(t => t === dart)).toBe(false);       // dart consumed
        expect(G.towers.some(t => t === paragon)).toBe(true);     // paragon untouched
    });

    it('village auras skip paragons but still buff regular towers', () => {
        const village = { type: 'village', x: 0, y: 0, stats: { range: 50, category: 'Support', fireRateBuff: 0 }, upgrades: [5, 0, 0], _villageBuffTimer: 0 };
        const dart = new Tower(20, 0, 'dart');
        const paragon = { type: 'paragon_dart', isParagon: true, x: 30, y: 0, stats: { category: 'Primary' }, upgrades: [0, 0, 0] };
        G.towers = [village, dart, paragon];
        G.towerGrid = { query: () => [village, dart, paragon], clear: vi.fn(), insert: vi.fn() };
        G.config.data.mkActive = true; G.config.data.monkeyKnowledge = {};

        TowerRegistry.village.updateSupport(village, 0.016);

        expect(dart.buffedPierce).toBeGreaterThan(0);   // regular tower buffed
        expect(paragon.buffedPierce || 0).toBe(0);      // paragon skipped
        expect(paragon.freeTier1 || false).toBe(false); // no free upgrades either
    });

    it('Overclock cannot target a paragon', () => {
        const eng = { type: 'engineer', x: 0, y: 0, stats: { range: 50 }, upgrades: [0, 4, 0], overclockUsesThisRound: 0 };
        const regular = new Tower(20, 0, 'dart'); regular.totalSpent = 5000;
        const paragon = { type: 'paragon_dart', isParagon: true, x: 25, y: 0, stats: {}, upgrades: [0, 0, 0], totalSpent: 999999 };
        G.towers = [regular, paragon];
        G.waveManager = { currentWave: 1, waveActive: true };
        G.log = vi.fn();

        TowerRegistry.engineer.ability(eng, G);

        expect(regular.overclockTimer).toBe(60);        // regular tower chosen
        expect(paragon.overclockTimer || 0).toBe(0);    // paragon never targeted
    });
});

describe('persistence: paragon degree + T5 ledger survive save/load', () => {
    it('saveGame stores paragon fields; loadGame restores degree, stats and totalSpent', () => {
        // Self-contained field: a degree-42 paragon + a fresh T5 dart.
        const p = new Tower(700, 700, 'paragon_dart');
        p.isParagon = true;
        p.paragonBaseType = 'dart';
        applyApexStats(p, 42);
        p.powerBreakdown = computePower({ towers: [], totems: 0 });
        p.totalSpent = 21600;
        const t5 = dartT5(500, 500, [2, 0, 5], 22590, 0);
        G.towers = [p, t5];
        G.tier5Bought = {};
        G.gameState = 'playing';
        G.cash = 12345;

        G.saveGame();
        const saved = Config.data.savedRun;
        const savedParagon = saved.towers.find(t => t.isParagon);
        expect(savedParagon).toBeTruthy();
        expect(savedParagon.paragonDegree).toBe(p.paragonDegree);
        expect(savedParagon.totalSpent).toBe(p.totalSpent);

        // Wipe and restore.
        G.towers = [];
        G.tier5Bought = {};
        expect(G.loadGame()).toBe(true);

        const restored = G.towers.find(t => t.type === 'paragon_dart');
        expect(restored).toBeTruthy();
        expect(restored.isParagon).toBe(true);
        expect(restored.paragonDegree).toBe(p.paragonDegree);
        expect(restored.totalSpent).toBe(p.totalSpent);
        expect(restored.stats.damage).toBe(apexStats(p.paragonDegree).damage);
        expect(G.cash).toBe(12345);

        // P0 repair 1: totalSpent replayed from upgrade costs on regular towers.
        const loadedT5 = G.towers.find(t => t.type === 'dart' && t.upgrades[2] === 5);
        expect(loadedT5).toBeTruthy();
        expect(loadedT5.totalSpent).toBeGreaterThan(200);
        // P0 repair 2: tier5Bought re-marked from restored towers.
        expect(G.tier5Bought['dart-3']).toBe(true);
    });
});

describe('tower XP: 1 XP per popped layer, meta-persisted, sandbox-exempt', () => {
    it('credits the base type (paragons map back, sentries map to their parent)', () => {
        G.isSandbox = false;
        G.towerXpSession = {};
        G.addTowerXp('dart', 5);
        G.addTowerXp('paragon_dart', 3);
        G.addTowerXp('sentry', 2);                    // not in the set -> dropped
        const sentryLike = { type: 'sentry', parentTower: { type: 'engineer', stats: {} } };
        // The enemy-side resolver maps sentries via parentTower:
        const base = sentryLike.parentTower || sentryLike;
        G.addTowerXp(base.type, 4);
        expect(G.towerXpSession).toEqual({ dart: 8, engineer: 4 });
    });

    it('never accrues in sandbox and never for heroes', () => {
        G.isSandbox = true; G.towerXpSession = {};
        G.addTowerXp('dart', 100);
        G.addTowerXp('quincy', 100);
        expect(G.towerXpSession).toEqual({});
        G.isSandbox = false;
    });

    it('flushes into Config.data.towerXp and persists', () => {
        G.towerXpSession = { dart: 123.9, boomerang: 1 };
        G.flushTowerXp();
        expect(Config.data.towerXp.dart).toBe(123);
        expect(Config.data.towerXp.boomerang).toBe(1);
        expect(G.towerXpSession).toEqual({});
    });

    it('flush-cadence helper (used by the live loop every frame) reports pending XP', () => {
        G.towerXpSession = {};
        expect(G._hasTowerXpPending()).toBe(false);
        G.addTowerXp('dart', 5);
        expect(G._hasTowerXpPending()).toBe(true);
        G.flushTowerXp();
        expect(G._hasTowerXpPending()).toBe(false);
    });

    it('the MONKEYS-menu mastery milestone is tracked at 500,000 XP (informational since v1.3.2)', () => {
        expect(CFG.xpToUnlock).toBe(500000);
        const eng = { isSandbox: false, cash: 1e9, tier5Bought: { 'dart-1': true, 'dart-2': true, 'dart-3': true }, towers: [], getCost: (c) => c, config: Config };
        // The XP flag is reported in the checklist either way...
        Config.data.paragonUnlocks = { dart: true };
        let offer = canOfferParagon(eng, { type: 'dart', upgrades: [0, 0, 5] }, 'dart');
        expect(offer.checklist.xpUnlocked).toBe(true);
        expect(offer.offered).toBe(true);
        // ...but it no longer gates the in-game creation (BTD6 rules).
        Config.data.paragonUnlocks = { dart: false };
        offer = canOfferParagon(eng, { type: 'dart', upgrades: [0, 0, 5] }, 'dart');
        expect(offer.checklist.xpUnlocked).toBe(false);
        expect(offer.offered).toBe(true);
    });
});

describe('APM projectile rules: two-moment split, mini inheritance, screen-edge explosion', () => {
    function mkBall(tower) {
        const p = new Projectile();
        p.init(0, 0, 15, null, 'apex_ball', 620, 200, 2.5, 0, {}, 0, tower, {});
        return p;
    }
    function mkEnemy() {
        return { alive: true, x: 0, y: 0, radius: 10, data: { radius: 10, isCeramic: false }, takeDamage: vi.fn(() => 15) };
    }
    function mkTower() {
        const t = new Tower(0, 0, 'paragon_dart');
        t.isParagon = true;
        applyApexStats(t, 1);
        return t;
    }
    function stubPool() {
        const pool = { get: vi.fn(() => new Projectile()), active: [], removeAt: vi.fn(), clear: vi.fn() };
        G.projectilePool = pool;
        G.enemyGrid = { query: () => [] };
        return pool;
    }

    it('splits into 6 damage-inheriting minis at HALF pierce, ball keeps flying', () => {
        const tower = mkTower();
        const pool = stubPool();
        const ball = mkBall(tower);
        for (let i = 0; i < 100; i++) {
            pool.get.mockClear();
            ball.hit(mkEnemy());
            if (i < 99) expect(ball.alive).toBe(true);
        }
        // 100 hits consumed = half of the 200 budget -> the first split fired.
        expect(ball.alive).toBe(true);
        expect(ball.hasSplitHalf).toBe(true);
        expect(pool.get).toHaveBeenCalledTimes(6);
        const mini = pool.get.mock.results[pool.get.mock.results.length - 1].value;
        // Minis are apex_mini with the parent's damage.
        expect(mini.type).toBe('apex_mini');
        expect(mini.damage).toBe(ball.damage);
        expect(mini.pierce).toBe(8);
    });

    it('splits AGAIN at pierce exhaustion and the ball dies', () => {
        const tower = mkTower();
        const pool = stubPool();
        const ball = mkBall(tower);
        for (let i = 0; i < 200; i++) ball.hit(mkEnemy());
        expect(ball.pierce).toBe(0);
        expect(ball.alive).toBe(false);
        // Two splits total: half-pierce + exhaustion = 12 minis.
        expect(pool.get).toHaveBeenCalledTimes(12);
    });

    it('minis never re-split (no cascade)', () => {
        const tower = mkTower();
        const pool = stubPool();
        // No apexSplit on the mini config: the splitter only fires for apex_ball.
        expect(ProjectileTypeConfig['apex_ball'].apexSplit).toBe(true);
        expect(ProjectileTypeConfig['apex_mini'] || {}).toEqual({});
        const mini = new Projectile();
        mini.init(0, 0, 15, null, 'apex_mini', 500, 8, 0.75, 0, {}, 0, tower, {});
        for (let i = 0; i < 8; i++) mini.hit(mkEnemy());
        expect(mini.pierce).toBe(0);
        expect(mini.alive).toBe(false);
        expect(pool.get).not.toHaveBeenCalled();
    });

    it('explodes at the screen edge', () => {
        const tower = mkTower();
        stubPool();
        G.explosions = [];
        const ball = mkBall(tower);
        ball.x = GAME_AREA_WIDTH + 100;
        ball.y = 180;
        ball.update(0.016);
        expect(ball.alive).toBe(false);
        expect(G.explosions.length).toBe(1);
    });
});
