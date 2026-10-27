// @vitest-environment jsdom
// ============================================================================
// v1.4.0 "Paragons, the full BTD6 way" suite.
//   1. GATE     - the Paragon button exists ONLY once all three Tier 5s are
//                 owned, sandbox included; ANY tower of the type can buy.
//   2. TAKEOVER - the three upgrade cards of a TIER 5 monkey turn purple
//                 (CSS) and route their clicks to the pre-purchase menu
//                 (engineInput source); v1.4.2: T5-only + no 4th node.
//   3. MENU     - real open/refresh/confirm flow against a DOM fixture: power
//                 preview, degree readout, extra investment raising the degree
//                 through createApexParagon, Max clamping to the useful cap.
//   4. SELLABLE (v1.4.1, flipped from v1.4.0's permanence) - the player can
//      sell a paragon like any other tower: engineInput.sellTower goes
//      through, the panel shows the Sell button, towerEconomy.sell credits
//      70% of everything paid (totalSpent = source T5 + base + investment).
//      The ONLY thing barred from selling a paragon is the Knight's Sword
//      Strike (behavioral coverage in v141paragon2.test.js).
// Engine recipe identical to paragonFlow.test.js: jsdom + the real import
// chain, engineRef singleton populated by engine.js, run-state overridden in
// beforeAll.
// ============================================================================
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

import { GameEngine as G } from '../js/engineRef.js';
import '../js/engine.js';
import { Config } from '../js/config.js';
import { UI } from '../js/ui.js';
import { Tower } from '../js/tower.js';
import { canOfferParagon, computePower, degreeFromPower, PARAGON_POWER_RULES } from '../js/paragonPower.js';
import { createApexParagon } from '../js/towers/paragon_dart.js';
import { ParagonMenu } from '../js/paragonMenu.js';
import { getSellValue } from '../js/towerEconomy.js';

const CFG = PARAGON_POWER_RULES.dart;

function dart(x, y, upgrades, totalSpent, damageDealt) {
    const t = new Tower(x, y, 'dart');
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
    }); // NOTE: UI.toggleMenus stays REAL - the open/close assertions exercise it.
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
// 1. GATE
// ---------------------------------------------------------------------------
describe('v1.4.0 gate: button only after ALL three T5s, everywhere', () => {
    it('normal game: ineligible until dart-1/2/3 are all owned', () => {
        G.isSandbox = false;
        G.towers = [dart(100, 100, [0, 0, 0], 5000, 0)];
        G.tier5Bought = { 'dart-1': true, 'dart-2': true };
        const offer = canOfferParagon(G, G.towers[0], 'dart');
        expect(offer.eligible).toBe(false);
        expect(offer.offered).toBe(false);

        G.tier5Bought['dart-3'] = true;
        const now = canOfferParagon(G, G.towers[0], 'dart');
        expect(now.eligible).toBe(true);
        expect(now.offered).toBe(true); // cash 10M covers the 150k base
    });

    it('sandbox: same rule - no more free offering without the Tier 5s', () => {
        G.isSandbox = true;
        G.towers = [dart(100, 100, [0, 0, 0], 0, 0)];
        G.tier5Bought = {};
        const without = canOfferParagon(G, G.towers[0], 'dart');
        expect(without.eligible).toBe(false);
        expect(without.offered).toBe(false);

        G.tier5Bought = { 'dart-1': true, 'dart-2': true, 'dart-3': true };
        const withT5s = canOfferParagon(G, G.towers[0], 'dart');
        expect(withT5s.eligible).toBe(true);
        G.isSandbox = false;
    });
});

// ---------------------------------------------------------------------------
// 2. TAKEOVER (purple buttons) - source-level assertions on the panel + input
// ---------------------------------------------------------------------------
describe('v1.4.0 takeover: upgrade cards become the purple Paragon purchase', () => {
    const panelSrc = readFileSync(join(ROOT, 'js', 'uiTowerPanel.js'), 'utf8');
    const inputSrc = readFileSync(join(ROOT, 'js', 'engineInput.js'), 'utf8');
    const dragSrc = readFileSync(join(ROOT, 'js', 'dragManager.js'), 'utf8');
    const cssSrc = readFileSync(join(ROOT, 'css', 'upgradePanel.css'), 'utf8');
    const htmlSrc = readFileSync(join(ROOT, 'index.html'), 'utf8');

    it('panel adds/removes .paragon-active on the three path cards from the offer eligibility', () => {
        expect(panelSrc).toContain("card.classList.toggle('paragon-active', !!parTakeover)");
        expect(panelSrc).toContain('newName = parCfg.name.toUpperCase()');
        expect(panelSrc).toContain('newLocked = !parTakeover.affordable');
    });

    it('v1.4.2: the purple takeover is Tier-5-only, not every monkey of the type', () => {
        expect(panelSrc).toContain('const isTier5 = (t.upgrades || []).some(u => u >= 5);');
        expect(panelSrc).toContain('if (parCfg && isTier5)');
        // engineInput routes upgrade clicks to the menu only for T5s too.
        expect(inputSrc).toMatch(/PARAGON_POWER_RULES\[t\.type\] && \(t\.upgrades \|\| \[\]\)\.some\(u => u >= 5\)/);
    });

    it('v1.4.2: the 4th "convergence" paragon button no longer exists', () => {
        expect(htmlSrc).not.toContain('id="up-paragon"');
        expect(htmlSrc).not.toContain('paragon-convergence');
        expect(panelSrc).not.toContain('_updateParagonCreationCard');
        expect(dragSrc).not.toMatch(/up-paragon[\s\S]{0,80}addEventListener/);
    });

    it('upgrade clicks route to the pre-purchase menu when eligible', () => {
        expect(inputSrc).toContain('ParagonMenu.open(this, t)');
        expect(inputSrc).toMatch(/PARAGON_POWER_RULES\[t\.type\][\s\S]{0,200}canOfferParagon\(this, t, t\.type\)/);
    });

    it('purple CSS + menu styling exist', () => {
        expect(cssSrc).toContain('.up-card.paragon-active');
        expect(cssSrc).toContain('.paragon-buy-confirm');
        expect(cssSrc).toContain('.paragon-buy-degree');
    });

    it('menu markup ships in index.html', () => {
        for (const id of ['paragon-buy-menu', 'paragon-invest', 'paragon-buy-confirm',
                          'paragon-buy-cancel', 'paragon-inv-max', 'paragon-buy-degree']) {
            expect(htmlSrc).toContain(`id="${id}"`);
        }
    });
});

// ---------------------------------------------------------------------------
// 3. MENU + DEGREE INVESTMENT (behavioral, real modules)
// ---------------------------------------------------------------------------
describe('v1.4.0 pre-purchase menu: degree preview and extra investment', () => {
    it('the investment math: $7,500 extra = +1 power, filling the cash-power cap room', () => {
        // One sacrificed dart whose cash alone lands just under the Degree-20
        // anchor (11,032 power). Base -> 19; +$7,500 (+1 power) -> 20.
        const spend = Math.floor(11032 * CFG.cashPerPower) - CFG.cashPerPower; // 82,725,000 -> 11,031 power
        const pv0 = ParagonMenu.preview(
            { towers: [dart(0, 0, [0, 0, 0], spend, 0)] }, CFG, 0);
        expect(Math.round(pv0.power.cashPower)).toBe(11031);
        expect(pv0.degree).toBe(19);

        const pv1 = ParagonMenu.preview(
            { towers: [dart(0, 0, [0, 0, 0], spend, 0)] }, CFG, CFG.cashPerPower);
        expect(pv1.extraPower).toBe(1);
        expect(pv1.degree).toBe(20);
    });

    it('usefulMaxExtra caps at the cash-power room AND the wallet', () => {
        const engine = { cash: 500000, getCost: (c) => c };
        const power = computePower({ towers: [], totems: 0 }); // no sacrifices: cashPower 0
        // Room = 60,000 power * $7,500 = $450M; wallet only allows 500k-150k.
        expect(ParagonMenu.usefulMaxExtra(engine, CFG, power)).toBe(350000);

        const richEngine = { cash: 500000000, getCost: (c) => c };
        expect(ParagonMenu.usefulMaxExtra(richEngine, CFG, power)).toBe(CFG.cashPowerCap * CFG.cashPerPower);
    });

    it('open -> invest -> confirm creates the paragon, charges base + extra, closes the menu', () => {
        // v1.4.2: the source must be a TIER 5 monkey now (menu + purple buttons
        // are T5-only). The source T5's cash is the excluded "entry ticket"
        // (computePower), so the degree money rides a SECOND, non-T5 dart:
        // [5,0,0] adds 400 upgrade power + a 10,631-power cash pool = 11,031
        // total -> Degree 19; +$7,500 (+1 power) -> Degree 20.
        const spend = 10631 * CFG.cashPerPower;
        const src = dart(100, 100, [5, 0, 0], 0, 0);
        const rich = dart(130, 100, [0, 0, 0], spend, 0);
        G.towers = [src, rich];
        G.tier5Bought = { 'dart-1': true, 'dart-2': true, 'dart-3': true };
        G.cash = 10000000;
        G.gameState = 'playing';
        G.selectedPlacedTower = src;
        G.log.mockClear();

        const menu = document.getElementById('paragon-buy-menu');
        ParagonMenu.open(G, src);
        expect(menu.classList.contains('hidden')).toBe(false);
        expect(document.getElementById('paragon-buy-title').innerText).toBe('APEX PLASMA MASTER');
        expect(document.getElementById('paragon-buy-degree').innerText).toBe('DEGREE 19');

        // Move the slider: the readout climbs to Degree 20 live.
        const input = document.getElementById('paragon-invest');
        input.value = String(CFG.cashPerPower);
        ParagonMenu.refresh();
        expect(document.getElementById('paragon-buy-degree').innerText).toBe('DEGREE 20');
        expect(document.getElementById('paragon-buy-confirm').disabled).toBe(false);

        ParagonMenu.confirm();
        expect(menu.classList.contains('hidden')).toBe(true);          // dialog closed
        expect(G.towers.some(t => t && t.type === 'paragon_dart')).toBe(true);
        expect(G.cash).toBe(10000000 - CFG.baseCost - CFG.cashPerPower); // base + investment
        const paragon = G.towers.find(t => t && t.type === 'paragon_dart');
        expect(paragon.paragonDegree).toBe(20);
        expect(paragon.powerBreakdown.extraCash).toBe(CFG.cashPerPower);
        expect(paragon.powerBreakdown.extraPower).toBe(1);
        expect(G.selectedPlacedTower).toBe(paragon);
    });

    it('Max quick-fill never exceeds what still raises the Degree', () => {
        // A non-T5 dart's cash saturates the 60,000 cash-power cap (the T5
        // source is the excluded entry ticket), so the cap has NO room left:
        // no investment can raise the Degree any further.
        // (v1.4.2: the source is a T5 - the menu only opens from one.)
        const spend = CFG.cashPowerCap * CFG.cashPerPower;
        const src = dart(100, 100, [5, 0, 0], 0, 0);
        const rich = dart(130, 100, [0, 0, 0], spend, 0);
        G.towers = [src, rich];
        G.tier5Bought = { 'dart-1': true, 'dart-2': true, 'dart-3': true };
        G.cash = 10000000;

        const pv = ParagonMenu.preview(G, CFG, 0);
        const cap = ParagonMenu.usefulMaxExtra(G, CFG, pv.power);
        // The sacrificed dart maxed the cash pool -> no room left to invest.
        expect(cap).toBe(0);
        ParagonMenu.open(G, src);
        document.getElementById('paragon-inv-max').click();
        expect(document.getElementById('paragon-invest').value).toBe('0');
    });
});

// ---------------------------------------------------------------------------
// 4. SELLABLE (v1.4.1): paragons sell like any other tower
// ---------------------------------------------------------------------------
describe('v1.4.1 sellability: paragons are no longer permanent', () => {
    const inputSrc = readFileSync(join(ROOT, 'js', 'engineInput.js'), 'utf8');
    const panelSrc = readFileSync(join(ROOT, 'js', 'uiTowerPanel.js'), 'utf8');
    const econSrc = readFileSync(join(ROOT, 'js', 'towerEconomy.js'), 'utf8');

    it('sellTower no longer refuses - the paragon is removed and pays out', () => {
        expect(inputSrc).not.toContain('Paragons cannot be sold!');
        const paragon = new Tower(0, 0, 'paragon_dart');
        paragon.isParagon = true;
        paragon.totalSpent = 200000;
        G.towers = [paragon];
        G.selectedPlacedTower = paragon;
        G.deselectAll.mockClear();
        const cashBefore = G.cash;
        G.sellTower();
        expect(G.towers.length).toBe(0);                       // removed from the field
        expect(G.cash).toBe(cashBefore + Math.floor(200000 * 0.7)); // standard 70% resale
        expect(G.deselectAll).toHaveBeenCalled();
        G.selectedPlacedTower = null;
    });

    it('the panel shows the Sell button for paragons; towerEconomy.sell pays out', () => {
        expect(panelSrc).not.toMatch(/t\.isMinion \|\| t\.isParagon/);
        expect(econSrc).toContain('v1.4.1: paragons are NOT permanent');

        // Behavioral: the economy layer credits the sale (v1.4.0 refused here).
        const cashBefore = G.cash;
        const fake = Object.assign(new Tower(0, 0, 'dart'), { isParagon: true, totalSpent: 21600 });
        fake.sell(G);
        expect(G.cash).toBe(cashBefore + Math.floor(21600 * 0.7));
    });

    it('paragons still never upgrade, and normal towers still price normally', () => {
        const paragon = new Tower(0, 0, 'paragon_dart');
        paragon.isParagon = true;
        expect(paragon.canUpgrade(1, G)).toBe(false); // the upgrade lock stays

        const t = new Tower(0, 0, 'dart');
        t.totalSpent = 1000;
        t.isParagon = false;
        expect(getSellValue(t, G)).toBeGreaterThan(0);
    });
});
