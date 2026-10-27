// @vitest-environment jsdom
// ============================================================================
// v1.4.2 "Paragon polish & Dominus rebalance" suite - one describe per owner
// report, all eight fixes:
//   1. FOURTH BUTTON  - the separate paragon "convergence" node is gone.
//   2. T5-ONLY PURPLE - the purple purchase lives on Tier 5 monkeys only.
//   3. LEVEL VEIL      - entering a level never hides the loading minigame.
//   4. COHESIVE FADE  - through() holds at FULL black before clearing; every
//                        menu return fades (game-over/victory included).
//   5. INVEST SLIDER  - the paragon investment is a slider with a live cap.
//   6. PARAGON SPRITE - the placeholder texture keys carry the tower_ prefix
//                        (no more "just a yellow circle").
//   7. KNIGHT TRAIL   - 1.5x denser, 1.5x longer after-images.
//   8. DOMINUS POWER  - the real wiki kit: hypersonic glaives + Shred, ring
//                        class bonuses, MOAB Press explosion + Burn, Primary
//                        aura, Overcharge ability.
// ============================================================================
import { describe, it, expect, beforeAll, vi } from 'vitest';
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
import { PARAGON_POWER_RULES } from '../js/paragonPower.js';
import gdBehavior from '../js/towers/paragon_boomerang.js';
import { ParagonMenu } from '../js/paragonMenu.js';
import { FadeVeil } from '../js/fadeVeil.js';
import { LoadGate } from '../js/loadGate.js';
import { getEffectiveCooldown } from '../js/towerBehavior.js';

const CFG = PARAGON_POWER_RULES.dart;

function dart(x, y, upgrades, totalSpent) {
    const t = new Tower(x, y, 'dart');
    t.upgrades = [...upgrades];
    t.totalSpent = totalSpent;
    return t;
}

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
    const input = mk('paragon-invest', 'input');
    input.type = 'range';
    input.value = '0';
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
// 1. FOURTH BUTTON (owner: "the fourth paragon button should not exist")
// ---------------------------------------------------------------------------
describe('v1.4.2 #1: no fourth paragon button', () => {
    const htmlSrc = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const panelSrc = readFileSync(join(ROOT, 'js', 'uiTowerPanel.js'), 'utf8');
    const dragSrc = readFileSync(join(ROOT, 'js', 'dragManager.js'), 'utf8');

    it('the up-paragon node and the convergence block are gone from the DOM', () => {
        expect(htmlSrc).not.toContain('id="up-paragon"');
        expect(htmlSrc).not.toContain('paragon-convergence');
        expect(htmlSrc).not.toContain('paragon-reqs');
    });

    it('the panel no longer renders a creation card, and nothing binds its clicks', () => {
        expect(panelSrc).not.toContain('_updateParagonCreationCard');
        expect(dragSrc).not.toMatch(/up-paragon[\s\S]{0,80}addEventListener/);
    });

    it('the path cards ARE the purchase (three purple buttons, not four)', () => {
        expect(panelSrc).toContain("card.classList.toggle('paragon-active', !!parTakeover)");
    });
});

// ---------------------------------------------------------------------------
// 2. T5-ONLY PURPLE (owner: "only in valid tier 5 monkeys, not all dart
//    monkeys")
// ---------------------------------------------------------------------------
describe('v1.4.2 #2: purple buttons only on valid Tier 5 monkeys', () => {
    const panelSrc = readFileSync(join(ROOT, 'js', 'uiTowerPanel.js'), 'utf8');

    it('the takeover requires a maxed path on the SELECTED monkey', () => {
        expect(panelSrc).toContain('const isTier5 = (t.upgrades || []).some(u => u >= 5);');
        expect(panelSrc).toContain('if (parCfg && isTier5)');
    });

    it('behavioral: the pre-purchase menu refuses a non-T5 monkey outright', () => {
        G.towers = [dart(100, 100, [2, 0, 0], 5000)];
        G.tier5Bought = { 'dart-1': true, 'dart-2': true, 'dart-3': true };
        G.cash = 10000000;
        G.gameState = 'playing';
        G.log.mockClear();

        const menu = document.getElementById('paragon-buy-menu');
        ParagonMenu.open(G, G.towers[0]);
        expect(menu.classList.contains('hidden')).toBe(true);  // never opened
        expect(G.log).toHaveBeenCalledWith(expect.stringContaining('Only a Tier 5'));
        expect(G.towers.some(t => t && t.type === 'paragon_dart')).toBe(false);
    });

    it('behavioral: a Tier 5 monkey opens the same menu fine', () => {
        G.towers = [dart(100, 100, [5, 0, 0], 40000)];
        G.tier5Bought = { 'dart-1': true, 'dart-2': true, 'dart-3': true };
        G.cash = 10000000;
        G.gameState = 'playing';
        G.selectedPlacedTower = G.towers[0];

        const menu = document.getElementById('paragon-buy-menu');
        ParagonMenu.open(G, G.towers[0]);
        expect(menu.classList.contains('hidden')).toBe(false);
        ParagonMenu.close();
    });
});

// ---------------------------------------------------------------------------
// 3. LEVEL VEIL (owner: "the fade to black when entering a level hides the
//    minigame")
// ---------------------------------------------------------------------------
describe('v1.4.2 #3: level entry never hides the loading minigame', () => {
    const controllerSrc = readFileSync(join(ROOT, 'js', 'gameController.js'), 'utf8');

    it('gameController lifts the veil the moment the loading screen shows', () => {
        expect(controllerSrc).toContain('onScreen: liftVeil');
        expect(controllerSrc).toMatch(/finally\s*\{\s*liftVeil\(\);/);
        // The old bug: the ONLY lift was a final `await FadeVeil.off()` after
        // the whole battle was ready - the loading screen sat behind black.
        expect(controllerSrc).not.toMatch(/await this\._startGameUI\(isSandbox\);[\s\S]{0,120}await FadeVeil\.off\(\)/);
    });

    it('behavioral: LoadGate fires onScreen exactly when the screen shows', async () => {
        vi.useFakeTimers();
        try {
            let fired = 0;
            const onScreen = () => fired++;

            // Fast group: the load resolves before SHOW_DELAY_MS ever fires,
            // so no screen and no callback.
            LoadGate.register('v142fast', { load: async (ctx, onProgress) => { onProgress(1); } });
            await LoadGate.ensure('v142fast', { onScreen });
            expect(fired).toBe(0);

            // Slow group: the load outlives SHOW_DELAY_MS -> screen + callback.
            let release;
            LoadGate.register('v142slow', { load: () => new Promise((r) => { release = r; }) });
            const done = LoadGate.ensure('v142slow', { onScreen });
            await vi.advanceTimersByTimeAsync(200);   // > SHOW_DELAY_MS (150)
            expect(fired).toBe(1);
            release();
            // _wait's MIN_SHOW_MS grace sits on a faked 700ms timer (and
            // performance.now() is frozen) - advance past it or `done` never
            // settles under fake timers.
            await vi.advanceTimersByTimeAsync(800);
            await done;
        } finally {
            vi.useRealTimers();
        }
    });
});

// ---------------------------------------------------------------------------
// 4. COHESIVE FADE (owner: "should be cohesive, there's a point where it's
//    not fully opaque before clearing up")
// ---------------------------------------------------------------------------
describe('v1.4.2 #4: the fade holds at fully black before clearing', () => {
    const veilSrc = readFileSync(join(ROOT, 'js', 'fadeVeil.js'), 'utf8');
    const menuSrc = readFileSync(join(ROOT, 'js', 'menuController.js'), 'utf8');

    it('source: through() has a real hold + generation-serialized phases', () => {
        expect(veilSrc).toContain('HOLD_MS');
        expect(veilSrc).toMatch(/await wait\(HOLD_MS\)/);
        expect(veilSrc).toContain('_generation');
    });

    it('behavioral: fade in -> HOLD fully black -> mid -> clear out', async () => {
        let veil = document.getElementById('fade-veil');
        if (!veil) { veil = document.createElement('div'); veil.id = 'fade-veil'; document.body.appendChild(veil); }
        const order = [];
        vi.useFakeTimers();
        try {
            const p = FadeVeil.through(async () => { order.push('mid'); });
            await vi.advanceTimersByTimeAsync(300);            // VEL_MS 280 + 20 fade-in
            expect(veil.classList.contains('on')).toBe(true); // black...
            expect(order).toEqual([]);                         // ...and HOLDING (not clearing)
            await vi.advanceTimersByTimeAsync(149);            // still inside the hold
            expect(veil.classList.contains('on')).toBe(true);
            await vi.advanceTimersByTimeAsync(2);              // hold elapsed
            expect(order).toEqual(['mid']);                   // swap ran behind full black
            expect(veil.classList.contains('on')).toBe(false);// now clearing
            await vi.advanceTimersByTimeAsync(280);
            await p;
            expect(veil.classList.contains('on')).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it('every menu return fades: game-over and victory go through the veil', () => {
        expect(menuSrc).toContain('_returnToMenu()');
        expect(menuSrc.match(/FadeVeil\.through\(\(\) => this\._returnToMenu\(\)\)/g)?.length).toBe(2);
    });
});

// ---------------------------------------------------------------------------
// 5. INVESTMENT SLIDER (owner: "the money investiment on paragon should be a
//    slider")
// ---------------------------------------------------------------------------
describe('v1.4.2 #5: the investment is a slider', () => {
    const htmlSrc = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const menuSrc = readFileSync(join(ROOT, 'js', 'paragonMenu.js'), 'utf8');
    const cssSrc = readFileSync(join(ROOT, 'css', 'upgradePanel.css'), 'utf8');

    it('markup: a range input with a live readout', () => {
        expect(htmlSrc).toMatch(/<input id="paragon-invest" type="range"/);
        expect(htmlSrc).toContain('id="paragon-invest-readout"');
        expect(cssSrc).toMatch(/#paragon-invest\[type="range"\]/);
    });

    it('behavioral: the slider max tracks the useful cap and the readout follows', () => {
        G.towers = [dart(100, 100, [5, 0, 0], 0)];
        G.tier5Bought = { 'dart-1': true, 'dart-2': true, 'dart-3': true };
        G.cash = 10000000;
        G.gameState = 'playing';
        G.selectedPlacedTower = G.towers[0];

        ParagonMenu.open(G, G.towers[0]);
        const input = document.getElementById('paragon-invest');
        const readout = document.getElementById('paragon-invest-readout');
        // No sacrifices: the cap is the wallet after the base price.
        expect(input.max).toBe('9850000');
        expect(readout.innerText).toBe('$0');

        input.value = '9850000';
        ParagonMenu.refresh();
        expect(readout.innerText).toBe('$9,850,000');
        // jsdom's innerText channel doesn't reflect innerHTML writes - the
        // total is asserted through textContent (worklog lesson from v1.4.0).
        expect(document.getElementById('paragon-buy-total').textContent).toContain('$10,000,000');
        ParagonMenu.close();
    });
});

// ---------------------------------------------------------------------------
// 6. PARAGON SPRITE (owner: "the paragon has lost the dart monkey placeholder
//    sprite?? all paragons are just yellow circles")
// ---------------------------------------------------------------------------
describe('v1.4.2 #6: paragons draw their monkey placeholder sprite again', () => {
    const renderSrc = readFileSync(join(ROOT, 'js', 'webgl', 'renderTowers.js'), 'utf8');

    it('the fallback chain carries the tower_ prefix the atlas actually uses', () => {
        expect(renderSrc).toContain('`tower_${baseType}_p3_t5_base`');
        expect(renderSrc).toContain('`tower_${baseType}_base`');
        // The v1.4.1 bug: unprefixed keys never matched, so nothing rendered.
        expect(renderSrc).not.toContain('`${baseType}_p3_t5_base`');
        expect(renderSrc).not.toContain('`${baseType}_base`');
    });

    it('the placeholder rides the same sprite-config path as a normal tower', () => {
        expect(renderSrc).toMatch(/_updateParagonVisual[\s\S]{0,4000}_applySpriteConfig\(base, tex, configKey, 'base', targetSize\)/);
    });
});

// ---------------------------------------------------------------------------
// 7. KNIGHT TRAIL (owner: "1.5x more trail and it lasts 1.5x times longer")
// ---------------------------------------------------------------------------
describe('v1.4.2 #7: the Black Knight trail is denser and longer', () => {
    const tuningSrc = readFileSync(join(ROOT, 'js', 'tuning.js'), 'utf8');
    const knightSrc = readFileSync(join(ROOT, 'js', 'bosses', 'knight.js'), 'utf8');

    it('tuning: 1.5x denser spawn, 1.5x slower fade, cap raised for the longer wake', () => {
        expect(tuningSrc).toContain('trailInterval: 0.073');       // was 0.11 (~1.5x faster)
        expect(tuningSrc).toContain('trailFadeRate: 1.0');         // was a hardcoded 1.5
        expect(tuningSrc).toContain('trailCap: 34');              // was a hardcoded 15
    });

    it('knight.js reads the fade rate and cap from TUNING', () => {
        expect(knightSrc).toContain('TUNING.bossAnim.trailFadeRate ?? 1.5');
        expect(knightSrc).toContain('TUNING.bossAnim.trailCap ?? 15');
    });
});

// ---------------------------------------------------------------------------
// 8. DOMINUS REAL WIKI POWER (owner: "glaive dominus is weak, get his real
//    wiki power") - anchors themselves are pinned in v141paragon2.test.js.
// ---------------------------------------------------------------------------
describe('v1.4.2 #8: the Glaive Dominus kit, behavioral', () => {
    it('fire(): ONE glaive per attack, Shredding the acquired target', () => {
        const inits = [];
        const engine = { projectilePool: { get: () => ({ init: (...a) => inits.push(a) }) } };
        const tower = {
            x: 10, y: 20,
            stats: { damage: 25, pierce: 60, projectileSpeed: 620, lifespan: 2, bossDmg: 50, shredDps: 750, shredDuration: 15 },
        };
        const target = { alive: true, dotDmg: 0, dotTimer: 0, dotTickInterval: 0 };
        gdBehavior.fire(tower, target, 25, {}, false, {}, engine);

        expect(inits.length).toBe(1);                 // single glaive, wiki cadence
        expect(inits[0][2]).toBe(25);                 // damage
        expect(inits[0][4]).toBe('boomerang');        // type
        expect(inits[0][9].ricochet).toBe(50);        // ricochet seeking rides the effects
        expect(inits[0][12].bossDmg).toBe(50);        // boss bonus rides the dmgType
        // Shred DoT on the first target (750/s for 15s, 1s ticks).
        expect(target.dotDmg).toBe(750);
        expect(target.dotTimer).toBe(15);
        expect(target.dotTickInterval).toBe(1);
    });

    it('update(): the ring strikes with its class bonuses and the press fires', () => {
        const hits = [];
        const moab = {
            alive: true, x: 40, y: 20, data: { isMoab: true },
            takeDamage: (d, dt, eff) => { hits.push({ d, dt, eff }); return d; },
        };
        const engine = {
            towers: [],
            explosions: [],
            enemyGrid: { query: (x, y, r, out) => { out.length = 0; out.push(moab); return out; } },
        };
        const tower = {
            x: 10, y: 20,
            stats: {
                orbitalDamage: 42, orbitalInterval: 0.1, orbitalPierce: 200,
                orbitalCeramicDmg: 20, orbitalMoabDmg: 20, orbitalBossDmg: 150,
                pressInterval: 3, pressDmg: 1, pressMoabDmg: 20, pressPierce: 300,
                explosionDamage: 2500, explosionBossDmg: 4000,
                burnDps: 500, burnDuration: 4, bossDmg: 50,
            },
        };
        gdBehavior.update(tower, 0.016, engine);

        expect(tower.orbitGlaives).toHaveLength(3);   // Glaive Lord heritage
        // Ring hit: 42 damage with the ring's MOAB/boss bonuses + ceramic bonus.
        const ringHit = hits.find(h => h.d === 42);
        expect(ringHit).toBeTruthy();
        expect(ringHit.dt.moabDmg).toBe(20);
        expect(ringHit.dt.bossDmg).toBe(150);
        expect(ringHit.eff.ceramicDmg).toBe(20);
        // MOAB Press fired on the same first tick: contact hit + explosion.
        const pressHit = hits.find(h => h.d === 1);
        expect(pressHit).toBeTruthy();
        expect(pressHit.dt.moabDmg).toBe(20);
        expect(pressHit.eff.knockback).toBe(50);
        expect(engine.explosions.length).toBe(1);    // the press detonation visual
    });

    it('update(): every OTHER Primary monkey gets the aura, others do not', () => {
        const gd = { x: 0, y: 0, stats: { category: 'Primary' }, stats2: 1 };
        const dartTower = { stats: { category: 'Primary' } };
        const wizardTower = { stats: { category: 'Magic' } };
        const engine = {
            towers: [gd, dartTower, wizardTower],
            explosions: [],
            enemyGrid: { query: (x, y, r, out) => { out.length = 0; return out; } },
        };
        gdBehavior.update(gd, 0.016, engine);
        expect(dartTower.gdBuffTimer).toBeGreaterThan(0);   // Primary: buffed
        expect(wizardTower.gdBuffTimer).toBeUndefined();   // Magic: untouched
        expect(gd.gdBuffTimer).toBeUndefined();            // never itself
    });

    it('getEffectiveCooldown applies the 0.9x aura multiplier', () => {
        const base = { _baseCooldown: 0.4, _cooldownMult: 1 };
        expect(getEffectiveCooldown({ ...base })).toBe(0.4);
        expect(getEffectiveCooldown({ ...base, gdBuffTimer: 0.5 })).toBeCloseTo(0.36, 6);
    });

    it('Overcharge: 10 stacks of 0.9x cooldown, decaying one every 3s', () => {
        const engine = { log: vi.fn(), towers: [], explosions: [], enemyGrid: { query: (x, y, r, out) => { out.length = 0; return out; } } };
        const tower = { x: 0, y: 0, stats: {} };
        gdBehavior.ability(tower, engine);
        expect(tower.overchargeStacks).toBe(10);
        expect(tower.rapidShotMult).toBeCloseTo(1 / Math.pow(0.9, 10), 6); // ~2.87x = +187%
        expect(engine.log).toHaveBeenCalledWith(expect.stringContaining('OVERCHARGE'));

        // 3 seconds pass: one stack spent, multiplier recomputed.
        gdBehavior.update(tower, 3.0, engine);
        expect(tower.overchargeStacks).toBe(9);
        expect(tower.rapidShotMult).toBeCloseTo(1 / Math.pow(0.9, 9), 6);
    });
});

// ---------------------------------------------------------------------------
// Version + changelog pin
// ---------------------------------------------------------------------------
describe('v1.4.2 release pin', () => {
    it('the Update Log has the v1.4.2 gold entry (version pin moved to v1.4.5)', () => {
        const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
        expect(pkg.version).toBe('1.4.5');   // moved forward by the v1.4.5 guard wave
        const htmlSrc = readFileSync(join(ROOT, 'index.html'), 'utf8');
        expect(htmlSrc).toContain('v1.4.2 — Paragon polish &amp; the Dominus rebalance');
    });
});
