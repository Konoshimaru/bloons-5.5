// @vitest-environment jsdom
// ============================================================================
// v1.4.1 "Paragons II - sellable, Knight-proof, and the Glaive Dominus" suite.
//   1. RULES    - PARAGON_POWER_RULES.boomerang exists (Glaive Dominus, $375k,
//                 universal power constants) and the boomerang paragon tower
//                 is registered with the paragon registry contract.
//   2. STATS    - glaiveStats anchors: v1.4.2 REAL WIKI POWER - hypersonic
//                 glaive cadence, class-bonus orbital ring, MOAB Press
//                 explosion, Shred/Burn DoTs at every degree.
//   3. CREATION - real engine flow: three boomerang T5 flags unlock the gate,
//                 createGlaiveDominus consumes every boomerang, applies glaive
//                 stats, resets the boomerang ledger, prices totalSpent as
//                 source + base + investment (the v1.4.1 sell rule).
//   4. SELL     - the created Dominus sells through the standard economy
//                 (70% of everything paid) and via engineInput.sellTower.
//   5. MENU     - the pre-purchase dialog dispatches to the boomerang creator
//                 (PARAGON_CREATORS), so the full BTD6 flow works for both.
//   6. KNIGHT   - the Black Knight's Sword Strike can never SELL a paragon:
//                 even a guaranteed roll stuns it instead; a normal low-tier
//                 tower still gets sold (control).
// Engine recipe identical to v140paragon.test.js; the knight block reuses the
// knightAttackChoreo.test.js pattern (bare object + KnightAttacks mixin, audio
// mocked).
// ============================================================================
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

vi.mock('../js/audio.js', () => ({
    AudioEngine: { playSfx: vi.fn() },
}));

import { GameEngine as G } from '../js/engineRef.js';
import '../js/engine.js';
import { Config } from '../js/config.js';
import { UI } from '../js/ui.js';
import { Tower } from '../js/tower.js';
import { PARAGON_POWER_RULES, computePower, degreeFromPower, glaiveStats } from '../js/paragonPower.js';
import { canOfferParagon, createGlaiveDominus } from '../js/towers/paragon_boomerang.js';
import { ParagonMenu } from '../js/paragonMenu.js';
import { TowerRegistry, TOWER_CATEGORIES, Upgrades } from '../js/towers/index.js';
import KnightAttacks from '../js/bosses/knightAttacks.js';

const CFG = PARAGON_POWER_RULES.boomerang;

function boomerang(x, y, upgrades, totalSpent, damageDealt) {
    const t = new Tower(x, y, 'boomerang');
    t.upgrades = [...upgrades];
    t.totalSpent = totalSpent;
    t.damageDealt = damageDealt;
    return t;
}

// --- DOM fixture for the pre-purchase menu (ids from index.html) -------------
function buildMenuFixture() {
    const mk = (id, tag = 'div') => {
        let n = document.getElementById(id);
        if (!n) { n = document.createElement(tag); n.id = id; document.body.appendChild(n); }
        return n;
    };
    const menu = mk('paragon-buy-menu');
    menu.className = 'overlay hidden';
    mk('paragon-buy-close', 'button');
    mk('paragon-buy-title');
    mk('paragon-buy-sub');
    mk('paragon-buy-power');
    mk('paragon-buy-degree');
    mk('paragon-invest', 'input').value = '0';
    mk('paragon-invest-readout');
    mk('paragon-inv-10k', 'button');
    mk('paragon-inv-50k', 'button');
    mk('paragon-inv-max', 'button');
    mk('paragon-invest-hint');
    mk('paragon-buy-total');
    mk('paragon-buy-confirm', 'button');
    mk('paragon-buy-cancel', 'button');
    return menu;
}

beforeAll(() => {
    Config.load();
    buildMenuFixture();
    Object.assign(UI, {
        log: vi.fn(), updateLives: vi.fn(), updateCash: vi.fn(), updateWave: vi.fn(),
        refreshSelectedTower: vi.fn(), updateMetaStats: vi.fn(),
        showUpgradeUI: vi.fn(), hideUpgradePanel: vi.fn(), showPause: vi.fn(), hidePause: vi.fn(),
        updateWaveSpeedBtn: vi.fn(),
    });
    Object.assign(G, {
        gameState: 'playing',
        currentMap: 0,
        lives: 100,
        cash: 10000000,
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
});

// ---------------------------------------------------------------------------
// 1. RULES + REGISTRY
// ---------------------------------------------------------------------------
describe('v1.4.1 rules: the Glaive Dominus exists as a full paragon type', () => {
    it('PARAGON_POWER_RULES.boomerang mirrors the dart engine with BTD6-relative pricing', () => {
        expect(CFG).toBeTruthy();
        expect(CFG.key).toBe('boomerang');
        expect(CFG.paragonType).toBe('paragon_boomerang');
        expect(CFG.name).toBe('Glaive Dominus');
        expect(CFG.baseCost).toBe(375000); // APM $150k x BTD6's 2.5x wiki ratio
        expect(CFG.requiredT5s).toBe(3);
        // Universal paragon constants (BTD6 keeps one set of power rules).
        const dart = PARAGON_POWER_RULES.dart;
        expect(CFG.cashPerPower).toBe(dart.cashPerPower);
        expect(CFG.cashPowerCap).toBe(dart.cashPowerCap);
        expect(CFG.powerPerExtraT5).toBe(dart.powerPerExtraT5);
        expect(CFG.popsPerPower).toBe(dart.popsPerPower);
    });

    it('the boomerang paragon tower is registered like the dart one', () => {
        const behavior = TowerRegistry.paragon_boomerang;
        expect(behavior).toBeTruthy();
        expect(behavior.isParagon).toBe(true);
        expect(behavior.stats.name).toBe('Glaive Dominus');
        expect(behavior.stats.category).toBe('Primary');
        expect(TOWER_CATEGORIES.paragon_boomerang).toBe('Primary');
        expect(Upgrades.paragon_boomerang[1]).toEqual([]); // never upgrades
        expect(computePower({ towers: [], totems: 0 }, 'boomerang').total).toBe(0);
        expect(degreeFromPower(0)).toBe(1); // shared curve still answers
    });
});

// ---------------------------------------------------------------------------
// 2. STATS
// ---------------------------------------------------------------------------
describe('v1.4.2 stats: glaiveStats anchors (real wiki power)', () => {
    it('degree 1 matches the wiki tables and carries the full kit', () => {
        const s = glaiveStats(1);
        expect(s.degree).toBe(1);
        // Main glaive: 25 dmg, +50 boss (75 total), 60 pierce, 0.04s cadence.
        expect(s.damage).toBe(25);
        expect(s.pierce).toBe(60);
        expect(s.interval).toBe(0.04);
        expect(s.bossDmg).toBe(50);
        expect(s.eliteBossDmg).toBe(125); // elite = 2x boss total (fandom D1)
        // Glaive Ring: 42 dmg, +20 cer / +20 MOAB / +150 boss, 200 pierce, 0.1s.
        expect(s.orbitalDamage).toBe(42);
        expect(s.orbitalPierce).toBe(200);
        expect(s.orbitalInterval).toBe(0.1);
        expect(s.orbitalCeramicDmg).toBe(20);
        expect(s.orbitalMoabDmg).toBe(20);
        expect(s.orbitalBossDmg).toBe(150);
        // MOAB Press: 1 + 20 MOAB every 3s; explosion 2500 (+4000 boss).
        expect(s.pressDmg).toBe(1);
        expect(s.pressMoabDmg).toBe(20);
        expect(s.pressInterval).toBe(3);
        expect(s.pressPierce).toBe(300);
        expect(s.explosionDamage).toBe(2500);
        expect(s.explosionBossDmg).toBe(4000);
        // Shred 750/s for 15s; Burn 500/s for 4s.
        expect(s.shredDps).toBe(750);
        expect(s.shredDuration).toBe(15);
        expect(s.burnDps).toBe(500);
        expect(s.burnDuration).toBe(4);
    });

    it('degrees 20/40 stay wiki-exact and interpolation is monotonic', () => {
        const d20 = glaiveStats(20);
        expect(d20.damage).toBe(30.75);
        expect(d20.pierce).toBe(73);       // 72.9 rounded
        expect(d20.interval).toBe(0.0306); // 0.03058 rounded to 4 decimals
        expect(d20.orbitalDamage).toBe(50.98);
        expect(d20.orbitalMoabDmg).toBe(178.5);
        const d40 = glaiveStats(40);
        expect(d40.damage).toBe(37.75);
        expect(d40.pierce).toBe(87);       // 86.9 rounded
        expect(d40.interval).toBe(0.0278); // 0.02775 rounded
        expect(d40.orbitalDamage).toBe(61.38);
        expect(d40.explosionDamage).toBe(3478);
        const d30 = glaiveStats(30);
        expect(d30.damage).toBeGreaterThan(d20.damage);
        expect(d30.damage).toBeLessThan(d40.damage);
        expect(glaiveStats(100).degree).toBe(100);
    });
});

// ---------------------------------------------------------------------------
// 3. CREATION (real engine flow)
// ---------------------------------------------------------------------------
describe('v1.4.1 creation: all three boomerang T5s unlock the Glaive Dominus', () => {
    it('the gate is per-type: boomerang flags required, dart flags do not help', () => {
        const tower = boomerang(100, 100, [0, 0, 0], 5000, 0);
        const eng = {
            isSandbox: false,
            tier5Bought: { 'dart-1': true, 'dart-2': true, 'dart-3': true }, // wrong type
            towers: [tower], cash: 10000000, getCost: (c) => c, config: Config,
        };
        expect(canOfferParagon(eng, tower, 'boomerang').eligible).toBe(false);
        eng.tier5Bought = { 'boomerang-1': true, 'boomerang-2': true, 'boomerang-3': true };
        expect(canOfferParagon(eng, tower, 'boomerang').eligible).toBe(true);
    });

    it('createGlaiveDominus consumes every boomerang and spawns the paragon', () => {
        const src = boomerang(100, 100, [5, 0, 0], 40000, 1234);
        const other = boomerang(150, 150, [2, 1, 0], 3000, 50);
        G.towers = [src, other];
        G.tier5Bought = { 'boomerang-1': true, 'boomerang-2': true, 'boomerang-3': true };
        G.cash = 10000000;
        G.selectedPlacedTower = src;
        G.log.mockClear();

        expect(createGlaiveDominus(src, G, 0)).toBe(true);

        const paragon = G.towers.find(t => t && t.type === 'paragon_boomerang');
        expect(paragon).toBeTruthy();
        expect(G.towers.filter(t => t && t.type === 'boomerang').length).toBe(0); // sweep
        expect(G.cash).toBe(10000000 - CFG.baseCost);                             // charged
        expect(paragon.paragonBaseType).toBe('boomerang');
        // Deterministic: pool = 0.4 cash + 700 upgrade (7 tiers) + 7.13 pops
        // ~= 707.5 power -> past the degree-2 step (580.6) under the D20 anchor.
        expect(paragon.paragonDegree).toBe(2);
        // Degree 2 interpolates off the D1 anchor: 42 + (50.98 - 42) / 19.
        expect(paragon.stats.orbitalDamage).toBe(42.47);
        // v1.4.2 kit wiring: press + DoTs + Overcharge ability registration.
        expect(paragon.stats.pressInterval).toBe(3);
        expect(paragon.stats.shredDps).toBe(758);        // degree-2 interpolation: 750 + 143.5/19
        expect(paragon.stats.isAbility).toBe(true);
        expect(paragon.stats.abilityName).toBe('Overcharge');
        expect(paragon.stats.abilityCd).toBe(45);
        // v1.4.1 sell pricing: source T5 value + charged base + 0 investment.
        expect(paragon.totalSpent).toBe(40000 + CFG.baseCost);
        expect(G.tier5Bought['boomerang-1']).toBe(false);                         // ledger reset
        expect(G.tier5Bought['boomerang-2']).toBe(false);
        expect(G.tier5Bought['boomerang-3']).toBe(false);
        expect(G.selectedPlacedTower).toBe(paragon);
        expect(G.log).toHaveBeenCalledWith(expect.stringContaining('GLAIVE DOMINUS'));
    });

    it('extra investment raises the degree and joins totalSpent', () => {
        const src = boomerang(100, 100, [0, 0, 0], 0, 0);
        G.towers = [src];
        G.tier5Bought = { 'boomerang-1': true, 'boomerang-2': true, 'boomerang-3': true };
        G.cash = 10000000;

        // $7,500 per power: with a bare field the degree comes from the
        // investment alone. 581 power clears the degree-2 step (580.6) while
        // staying inside the 10M wallet (375k base + ~4.36M investment).
        const extra = 581 * CFG.cashPerPower;
        expect(createGlaiveDominus(src, G, extra)).toBe(true);

        const paragon = G.towers.find(t => t && t.type === 'paragon_boomerang');
        expect(G.cash).toBe(10000000 - CFG.baseCost - extra);
        expect(paragon.powerBreakdown.extraCash).toBe(extra);
        expect(paragon.powerBreakdown.extraPower).toBe(extra / CFG.cashPerPower);
        expect(paragon.totalSpent).toBe(CFG.baseCost + extra); // no source value
        expect(paragon.paragonDegree).toBe(2);
    });
});

// ---------------------------------------------------------------------------
// 4. SELL (the point of the wave)
// ---------------------------------------------------------------------------
describe('v1.4.1 sell: the Glaive Dominus is player-sellable', () => {
    it('a created Dominus pays 70% of everything paid, through the engine flow', () => {
        const src = boomerang(100, 100, [0, 0, 0], 10000, 0);
        G.towers = [src];
        G.tier5Bought = { 'boomerang-1': true, 'boomerang-2': true, 'boomerang-3': true };
        G.cash = 10000000;
        createGlaiveDominus(src, G, 0);

        const paragon = G.towers.find(t => t && t.type === 'paragon_boomerang');
        const expected = Math.floor(paragon.totalSpent * 0.7);
        const cashBefore = G.cash;
        paragon.sell(G);
        expect(G.cash).toBe(cashBefore + expected);
    });

    it('engineInput.sellTower removes and pays out a selected paragon', () => {
        const paragon = new Tower(0, 0, 'paragon_boomerang');
        paragon.isParagon = true;
        paragon.totalSpent = 415000;
        G.towers = [paragon];
        G.selectedPlacedTower = paragon;
        G.deselectAll.mockClear();
        const cashBefore = G.cash;
        G.sellTower();
        expect(G.towers.length).toBe(0);
        expect(G.cash).toBe(cashBefore + Math.floor(415000 * 0.7));
        expect(G.deselectAll).toHaveBeenCalled();
        G.selectedPlacedTower = null;
    });
});

// ---------------------------------------------------------------------------
// 5. MENU (the creator dispatch is type-aware)
// ---------------------------------------------------------------------------
describe('v1.4.1 menu: the pre-purchase dialog buys the boomerang paragon', () => {
    it('open -> confirm runs createGlaiveDominus via PARAGON_CREATORS', () => {
        // v1.4.2: T5 sources only (the menu refuses non-T5 monkeys).
        const src = boomerang(100, 100, [5, 0, 0], 0, 0);
        G.towers = [src];
        G.tier5Bought = { 'boomerang-1': true, 'boomerang-2': true, 'boomerang-3': true };
        G.cash = 10000000;
        G.gameState = 'playing';
        G.selectedPlacedTower = src;
        G.log.mockClear();

        const menu = document.getElementById('paragon-buy-menu');
        ParagonMenu.open(G, src);
        expect(menu.classList.contains('hidden')).toBe(false);
        expect(document.getElementById('paragon-buy-title').innerText).toBe('GLAIVE DOMINUS');

        ParagonMenu.confirm();
        expect(menu.classList.contains('hidden')).toBe(true);
        expect(G.towers.some(t => t && t.type === 'paragon_boomerang')).toBe(true);
        expect(G.cash).toBe(10000000 - CFG.baseCost);
    });
});

// ---------------------------------------------------------------------------
// 6. KNIGHT (the clarification: the BOSS can't sell them, the player can)
// ---------------------------------------------------------------------------
describe('v1.4.1 knight: the Sword Strike can never sell a paragon', () => {
    const knightSrc = readFileSync(join(ROOT, 'js', 'bosses', 'knightAttacks.js'), 'utf8');

    function makeKnight() {
        return Object.assign({}, KnightAttacks);
    }

    beforeEach(() => {
        G.towers = [];
        G.cash = 50000;
        G.selectedPlacedTower = null;
        G.log.mockClear();
        vi.spyOn(Math, 'random').mockReturnValue(0); // guaranteed sell roll
    });

    afterEach(() => { vi.restoreAllMocks(); });

    it('source: the sell branch is guarded by the paragon exemption', () => {
        expect(knightSrc).toMatch(/!isHighTier && !isHero && !isParagon && Math\.random\(\) < 0\.5/);
    });

    it('a paragon hit by the Sword Strike is stunned, never sold', () => {
        const k = makeKnight();
        const paragon = { upgrades: [0, 0, 0], stats: { name: 'Glaive Dominus' }, isParagon: true, totalSpent: 415000 };
        G.towers = [paragon];
        k._hitTower(paragon);
        expect(G.towers).toEqual([paragon]);            // still on the field
        expect(G.cash).toBe(50000);                     // no cash-out
        expect(paragon.stunTimer).toBe(8.0);            // stunned like a high-tier
        expect(G.log).toHaveBeenCalledWith(expect.stringContaining('was stunned!'));
        expect(G.log).not.toHaveBeenCalledWith(expect.stringContaining('was sold!'));
    });

    it('control: a normal low-tier tower is still sold by the same strike', () => {
        const k = makeKnight();
        const dart = { upgrades: [1, 0, 0], stats: { name: 'Dart Monkey' }, totalSpent: 1000 };
        G.towers = [dart];
        k._hitTower(dart);
        expect(G.towers.length).toBe(0);
        expect(G.cash).toBe(50000 + Math.floor(1000 * 0.5));
        expect(G.log).toHaveBeenCalledWith(expect.stringContaining('was sold!'));
    });
});

// ---------------------------------------------------------------------------
// 7. WIRING (source-level pins for the type-generic paths)
// ---------------------------------------------------------------------------
describe('v1.4.1 wiring: save/restore, renderer, menu dispatch, menu text', () => {
    const sessionSrc = readFileSync(join(ROOT, 'js', 'gameSession.js'), 'utf8');
    const renderSrc = readFileSync(join(ROOT, 'js', 'webgl', 'renderTowers.js'), 'utf8');
    const menuSrc = readFileSync(join(ROOT, 'js', 'paragonMenu.js'), 'utf8');
    const controllerSrc = readFileSync(join(ROOT, 'js', 'menuController.js'), 'utf8');
    const boomerangSrc = readFileSync(join(ROOT, 'js', 'towers', 'paragon_boomerang.js'), 'utf8');

    it('gameSession saves and restores the paragon base type', () => {
        expect(sessionSrc).toContain('data.paragonBaseType = t.paragonBaseType');
        expect(sessionSrc).toContain('PARAGON_STAT_APPLIERS');
        expect(sessionSrc).toContain("import { applyGlaiveStats } from './towers/paragon_boomerang.js'");
    });

    it('renderTowers derives placeholder keys from paragonBaseType (dart keys unchanged)', () => {
        expect(renderSrc).toContain('tower.paragonBaseType || \'dart\'');
        expect(renderSrc).toContain('`tower_paragon_${baseType}_base`');
    });

    it('paragonMenu dispatches both creators', () => {
        expect(menuSrc).toContain('dart: createApexParagon');
        expect(menuSrc).toContain('boomerang: createGlaiveDominus');
    });

    it('MONKEYS-menu text reflects the v1.4.2 purchase rule (Tier 5s only)', () => {
        expect(controllerSrc).toContain('own all 3 Tier 5s, then any Tier 5 of these monkeys can buy it');
        expect(controllerSrc).not.toContain('a selected Tier 5 + cash');
    });

    it('the Dominus creation follows the paragon_dart template (gate, ledger, pricing)', () => {
        expect(boomerangSrc).toContain("canOfferParagon(engine, sourceTower, 'boomerang')");
        expect(boomerangSrc).toContain("engine.tier5Bought['boomerang-1'] = false");
        expect(boomerangSrc).toContain("(sourceTower.totalSpent ?? cfg.baseCost) + offer.cost + extra");
        expect(boomerangSrc).toContain("t.type === 'boomerang' && !t.stats.isHero && !t.isMinion && !t.isParagon");
    });
});
