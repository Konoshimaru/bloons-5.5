// tests/v143fixes.test.js
// v1.4.3 — "Sniper 0-0-5 lags the game when shooting the Knight".
//
// Root cause (bench-verified): the simulation itself costs ~0.011ms/tick with
// the Elite Defender firing at the boss every tick. The lag came from
// hit-rate-proportional UI work:
//   1. the boss HP bar's Pixi Text (the number changes on EVERY hit ->
//      re-measure + canvas re-raster + GPU texture re-upload every frame),
//   2. the selected-tower panel's DOM writes ("Dmg Dealt" counter, portrait
//      styles, stats line — all written unconditionally every frame, with
//      values churning at shot rate),
//   3. cash/lives displays (rewritten on every pop/leak frame).
//
// This file pins the fix behaviorally: identical values never rewrite,
// hit-rate counters coalesce to 10Hz with a trailing flush so the final
// value always lands, the boss-bar fill still tracks every frame, and the
// sniper-vs-knight simulation path itself is covered by a smoke run.

// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest';

vi.mock('../js/audio.js', () => ({ AudioEngine: { playSfx: vi.fn() } }));
vi.mock('../js/bosses/knightMusic.js', () => ({ getBossMusic: () => ({ paused: true, volume: 1 }) }));

// --- pixi.js mock: enough surface for renderUI.js, with write counting ----
vi.mock('pixi.js', () => {
    class MockText {
        constructor(opts = {}) {
            this._text = opts.text ?? '';
            this.style = opts.style || {};
            this.anchor = { set() {} };
            this.writeCount = 0;
        }
        get text() { return this._text; }
        set text(v) { this._text = v; this.writeCount++; }
        destroy() {}
    }
    class MockGraphics {
        constructor() { this.rectOps = 0; }
        clear() { return this; }
        rect() { this.rectOps++; return this; }
        fill() { return this; }
        moveTo() { return this; }
        lineTo() { return this; }
        stroke() { return this; }
        circle() { return this; }
        destroy() {}
    }
    return {
        Text: MockText,
        Graphics: MockGraphics,
        Sprite: class { constructor() { this.anchor = { set() {} }; } destroy() {} },
        Container: class { addChild() {} addChildAt() {} },
        Texture: { EMPTY: { width: 0, height: 0 } },
        Rectangle: class {},
    };
});
vi.mock('../js/webgl/pixiApp.js', () => ({
    PixiApp: { layer: () => ({ addChild() {}, addChildAt() {} }) },
}));
vi.mock('../js/webgl/pixiAssets.js', () => ({
    PixiAssets: { get: () => null, has: () => false },
}));

import { writeThrottled, writeStyleThrottled } from '../js/uiWriteThrottle.js';
import { UIRenderer } from '../js/webgl/renderUI.js';
import { BossHealthBarHandler } from '../js/BossHealthBarHandler.js';
import { UI } from '../js/ui.js';
import { Config } from '../js/config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The renderer methods are merged onto the PixiRenderer object at runtime
// (that is where _bossBarEntries lives); call them with a matching `this`.
const rendererThis = { _bossBarEntries: new Map(), _frameGen: 0 };

// Element whose innerText/innerHTML/style assignments can be counted.
function makeCountingEl(props = ['innerText']) {
    const el = { style: {} };
    for (const p of props) {
        let v = '';
        el[`${p}Writes`] = 0;
        Object.defineProperty(el, p, {
            configurable: true,
            get: () => v,
            set: (nv) => { v = nv; el[`${p}Writes`]++; },
        });
    }
    return el;
}

// ---------------------------------------------------------------------------
// 1. The throttle helper itself
// ---------------------------------------------------------------------------
describe('v1.4.3 writeThrottled helper', () => {
    it('never rewrites an identical value', () => {
        const el = makeCountingEl();
        expect(writeThrottled(el, 'abc')).toBe(true);
        expect(writeThrottled(el, 'abc')).toBe(false);
        expect(writeThrottled(el, 'abc', 0)).toBe(false);
        expect(el.innerTextWrites).toBe(1);
        expect(el.innerText).toBe('abc');
    });

    it('coalesces a burst of changes into one write + one trailing flush', async () => {
        const el = makeCountingEl();
        writeThrottled(el, '0', 100);
        // 60 hit-rate changes inside one 100ms window (one per frame):
        for (let i = 1; i <= 60; i++) writeThrottled(el, `${i * 6}`, 100);
        expect(el.innerTextWrites).toBe(1);            // only the first landed
        expect(el.innerText).toBe('0');
        await sleep(150);                              // window elapses
        expect(el.innerTextWrites).toBe(2);            // trailing flush landed
        expect(el.innerText).toBe('360');              // with the FINAL value
    });

    it('cancels a pending flush when the value returns to what is displayed', async () => {
        const el = makeCountingEl();
        writeThrottled(el, '100', 100);
        writeThrottled(el, '106', 100);                // skipped, flush pending
        writeThrottled(el, '100', 100);                // back to displayed value
        await sleep(150);
        expect(el.innerTextWrites).toBe(1);            // flush was cancelled
        expect(el.innerText).toBe('100');
    });

    it('a pending flush always lands the final value (display can never go stale)', async () => {
        const el = makeCountingEl();
        writeThrottled(el, '100', 50);
        writeThrottled(el, '106', 50);                 // skipped, flush pending
        await sleep(90);                               // flush fired and landed
        expect(el.innerText).toBe('106');
        expect(el.innerTextWrites).toBe(2);

        // A change whose window is still open also lands via its own flush.
        writeThrottled(el, '200', 50);
        await sleep(120);
        expect(el.innerText).toBe('200');
        expect(el.innerTextWrites).toBe(3);
        expect(el.innerText).toBe('200');              // nothing stale overwrote it
    });

    it('innerHTML variant and style variant share the semantics', async () => {
        const el = makeCountingEl(['innerHTML']);
        writeThrottled(el, '<b>1</b>', 100, 'innerHTML');
        for (let i = 0; i < 30; i++) writeThrottled(el, `<b>${i}</b>`, 100, 'innerHTML');
        expect(el.innerHTMLWrites).toBe(1);
        await sleep(150);
        expect(el.innerHTMLWrites).toBe(2);
        expect(el.innerHTML).toBe('<b>29</b>');

        const sEl = makeCountingEl();
        sEl.style = {};
        const orig = sEl.style;
        let widthWrites = 0;
        Object.defineProperty(orig, 'width', {
            configurable: true,
            get: () => orig._w,
            set: (v) => { orig._w = v; widthWrites++; },
        });
        writeStyleThrottled(sEl, 'width', '10%', 100);
        for (let i = 0; i < 30; i++) writeStyleThrottled(sEl, 'width', `${i}%`, 100);
        expect(widthWrites).toBe(1);
        await sleep(150);
        expect(widthWrites).toBe(2);
        expect(orig._w).toBe('29%');
    });

    it('null elements are safe no-ops', () => {
        expect(writeThrottled(null, 'x')).toBe(false);
        expect(writeStyleThrottled(null, 'width', 'x')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// 2. Boss HP bar: the number coalesces, the fill tracks every frame
// ---------------------------------------------------------------------------
describe('v1.4.3 boss HP bar text throttle', () => {
    it('60 hit-rate frames -> 1 text write, fill redrawn every frame', async () => {
        const boss = { enemy: { hp: 60000, alive: true }, maxHp: 60000, name: 'Black Knight', color: 0xe74c3c };
        BossHealthBarHandler.activeBosses = [boss];
        rendererThis._bossBarEntries.clear();
        const draw = () => UIRenderer._drawBossHealthBar.call(rendererThis, {});

        // 60 frames of Elite Defender fire (one hit per frame, 6 damage).
        for (let i = 1; i <= 60; i++) {
            boss.enemy.hp = 60000 - i * 6;
            draw();
        }

        const entry = rendererThis._bossBarEntries.get(boss);
        expect(entry).toBeTruthy();
        // All 60 frames ran within one 100ms window: only the first write.
        expect(entry.label.writeCount).toBe(1);
        expect(entry.label.text).toBe('Black Knight: 59994 / 60000');   // frame 1's value
        // The bar FILL geometry still rebuilt every single frame.
        expect(entry.graphics.rectOps).toBeGreaterThanOrEqual(60 * 4);

        // Window elapsed: the next frame writes the then-current number.
        await sleep(120);
        boss.enemy.hp = 59500;
        draw();
        expect(entry.label.writeCount).toBe(2);
        expect(entry.label.text).toBe('Black Knight: 59500 / 60000');

        // A frame with an unchanged number never rewrites.
        draw();
        expect(entry.label.writeCount).toBe(2);

        // Death syncs immediately, even inside the window.
        boss.enemy.hp = 0;
        draw();
        expect(entry.label.writeCount).toBe(3);
        expect(entry.label.text).toBe('Black Knight: 0 / 60000');
    });
});

// ---------------------------------------------------------------------------
// 3. Selected-tower panel: DOM churn at shot rate is gone
// ---------------------------------------------------------------------------
describe('v1.4.3 tower panel churn', () => {
    let counters, countersWrites, countersValue, portrait, portraitStyleSets;

    function buildFixture() {
        document.body.innerHTML = `
            <div id="upgrade-sidebar">
                <div id="up-title"></div>
                <div id="up-counters"></div>
                <div id="up-stats" class="hidden"></div>
                <div id="up-portrait"></div>
                <div id="up-targeting-row"><div id="up-target-text"></div></div>
                <div id="paragon-info" class="hidden"></div>
                <div id="up-paragon" class="hidden"></div>
                <div id="paragon-convergence" class="hidden"></div>
                <div id="hero-ui" class="hidden"></div>
                <div id="up-paths">
                    <div id="up-path1"><div class="up-name"></div><div class="cost"></div><div id="tier-boxes-1"></div></div>
                    <div id="up-path2"><div class="up-name"></div><div class="cost"></div><div id="tier-boxes-2"></div></div>
                    <div id="up-path3"><div class="up-name"></div><div class="cost"></div><div id="tier-boxes-3"></div></div>
                </div>
            </div>
            <div id="cash-display"></div>
            <div id="lives-display"></div>
            <div class="tower-card" data-tower="dart">Dart</div>`;
    }

    beforeAll(() => {
        buildFixture();
        Config.data.showTowerStats = false;

        counters = document.getElementById('up-counters');
        countersWrites = 0; countersValue = '';
        Object.defineProperty(counters, 'innerText', {
            configurable: true,
            get: () => countersValue,
            set: (v) => { countersValue = v; countersWrites++; },
        });

        portrait = document.getElementById('up-portrait');
        const realStyle = portrait.style;
        portraitStyleSets = 0;
        const styleProxy = new Proxy(realStyle, {
            set(target, key, value) {
                portraitStyleSets++;
                target[key] = value;
                return true;
            },
        });
        Object.defineProperty(portrait, 'style', { configurable: true, get: () => styleProxy });
    });

    function makeSniper005() {
        return {
            type: 'sniper',
            upgrades: [0, 0, 5],
            stats: { name: 'Sniper Monkey', isHero: false, range: 9999, damage: 6, pierce: 1 },
            damageDealt: 0,
            isMinion: false,
            targetingMode: 'First',
            canUpgrade: () => true,
        };
    }

    it('"Dmg Dealt" counter: 60 shooting frames -> 1 write, final value flushes, then stays quiet', async () => {
        const t = makeSniper005();
        const engine = { getCost: (c) => c, cash: 1000000, selectedPlacedTower: t };

        // 60 frames while the 0-0-5 fires ~1-2 shots per frame.
        for (let i = 1; i <= 60; i++) {
            t.damageDealt = i * 6;
            UI._updateUpgradeCards(t, engine);
        }
        expect(countersWrites).toBe(1);                  // burst coalesced
        expect(countersValue).toBe('Dmg Dealt: 6');

        await sleep(150);                                // trailing flush lands
        expect(countersWrites).toBe(2);
        expect(countersValue).toBe('Dmg Dealt: 360');

        // Idle frames (same value) never rewrite.
        UI._updateUpgradeCards(t, engine);
        UI._updateUpgradeCards(t, engine);
        expect(countersWrites).toBe(2);
    });

    it('portrait styles: written once per path, not per frame', () => {
        const t = makeSniper005();
        const engine = { getCost: (c) => c, cash: 1000000, selectedPlacedTower: t };

        UI._updateUpgradeCards(t, engine);
        const afterFirst = portraitStyleSets;            // the 3 style props of one path change
        expect(afterFirst).toBe(3);
        expect(portrait._lastImgPath).toBe('sprites/portraits/sniper_p3_t5.png');

        for (let i = 0; i < 60; i++) UI._updateUpgradeCards(t, engine);
        expect(portraitStyleSets).toBe(afterFirst);     // no per-frame style churn

        t.upgrades = [0, 0, 4];                          // downgraded -> new portrait
        UI._updateUpgradeCards(t, engine);
        expect(portraitStyleSets).toBe(afterFirst + 3);
        expect(portrait._lastImgPath).toBe('sprites/portraits/sniper_p3_t4.png');
    });

    it('paragon power breakdown innerHTML rebuilds coalesce while popping', async () => {
        const paragonInfo = document.getElementById('paragon-info');
        let htmlWrites = 0, htmlValue = '';
        Object.defineProperty(paragonInfo, 'innerHTML', {
            configurable: true,
            get: () => htmlValue,
            set: (v) => { htmlValue = v; htmlWrites++; },
        });

        const t = {
            type: 'boomerang',
            upgrades: [5, 5, 5],
            isParagon: true,
            paragonDegree: 20,
            stats: { name: 'Glaive Dominus', isHero: false },
            degreeInfo: { interval: 0.04, damage: 25, ceramicDmg: 20, bossDmg: 50, pierce: 60 },
            powerBreakdown: { cashPower: 60000, upgradePower: 10000, extraT5Power: 50000, popsPower: 0, total: 120000 },
            isMinion: false,
            targetingMode: 'First',
        };
        const engine = { getCost: (c) => c, cash: 1000000, selectedPlacedTower: t };

        for (let i = 1; i <= 60; i++) {
            t.powerBreakdown.popsPower = i * 100;        // pops climbing every frame
            UI._updateUpgradeCards(t, engine);
        }
        expect(htmlWrites).toBe(1);
        await sleep(150);
        expect(htmlWrites).toBe(2);
        expect(htmlValue).toContain('Pop Power: 6000 / 90,000');
        expect(htmlValue).toContain('DEGREE 20');
    });

    it('cash display coalesces during mass pops but cards/lives react instantly', async () => {
        const cashEl = document.getElementById('cash-display');
        let cashWrites = 0, cashValue = '';
        Object.defineProperty(cashEl, 'innerText', {
            configurable: true,
            get: () => cashValue,
            set: (v) => { cashValue = v; cashWrites++; },
        });
        UI._towerCardCache = null;                       // re-query the fixture card

        const engine = { getCost: (c) => c, cash: 1000000, selectedPlacedTower: null };
        const card = document.querySelector('.tower-card[data-tower="dart"]');

        for (let i = 1; i <= 60; i++) {
            engine.cash = 1000000 + i;                   // cash ticking every frame
            UI.updateCash(engine.cash, engine);
        }
        expect(cashWrites).toBe(1);
        await sleep(100);                                // 50ms cash window + margin
        expect(cashWrites).toBe(2);
        expect(cashValue).toBe('$1000060');

        // Affordability still flips immediately (classList is never throttled).
        engine.cash = 0;
        UI.updateCash(engine.cash, engine);
        expect(card.classList.contains('disabled')).toBe(true);
        engine.cash = 1000000;
        UI.updateCash(engine.cash, engine);
        expect(card.classList.contains('disabled')).toBe(false);
    });

    it('lives display coalesces but the drop pulse still fires immediately', async () => {
        const livesEl = document.getElementById('lives-display');
        let livesWrites = 0, livesValue = '';
        Object.defineProperty(livesEl, 'innerText', {
            configurable: true,
            get: () => livesValue,
            set: (v) => { livesValue = v; livesWrites++; },
        });

        for (let i = 1; i <= 60; i++) UI.updateLives(150 - i);   // one leak per frame
        expect(livesWrites).toBe(1);
        expect(livesEl.classList.contains('pulse')).toBe(true); // pulse not throttled
        await sleep(150);
        expect(livesWrites).toBe(2);
        expect(livesValue).toBe('Lives: 90');
    });
});

// ---------------------------------------------------------------------------
// 4. The reported scenario itself: sim smoke (no timing asserts — the bench
//    proved 0.011ms/tick; this guards the behavioral contract instead).
// ---------------------------------------------------------------------------
describe('v1.4.3 sniper 0-0-5 vs Black Knight sim smoke', () => {
    it('fires, damages the boss, decays hitscans, no exceptions', async () => {
        const { GameEngine } = await import('../js/engineRef.js');
        const { Tower } = await import('../js/tower.js');
        const { KnightEnemy } = await import('../js/bosses/knight.js');
        const { GameMap } = await import('../js/map.js');
        const { Maps } = await import('../js/data.js');
        const { SpatialGrid } = await import('../js/spatialGrid.js');

        GameEngine.maps = Maps;
        GameMap.prototype._initCache = function () { this.cacheCanvas = null; };
        GameEngine.map = new GameMap(0);
        GameEngine.enemies = [];
        GameEngine.towers = [];
        GameEngine.enemyGrid = new SpatialGrid();
        GameEngine.projectilePool = { active: [] };
        GameEngine.particlePool = { active: [] };
        GameEngine.explosions = [];
        GameEngine.floatingTexts = [];
        GameEngine.mouse = { x: 400, y: 300 };
        GameEngine.log = () => {};
        GameEngine.addCash = () => {};
        GameEngine.spawnPopEffect = () => {};
        GameEngine.updateUI = () => {};
        GameEngine.deselectAll = () => {};
        GameEngine.selectedPlacedTower = null;
        GameEngine.waveManager = { currentWave: 1, waveActive: true };
        GameEngine.config = { data: {} };
        GameEngine.lives = 150;
        GameEngine.cash = 100000;
        GameEngine.nightAlpha = 0;
        GameEngine.difficulty = undefined;
        GameEngine.hasLeakingEnemy = false;

        const knight = new KnightEnemy(200, 300);
        knight.isCinematic = false;
        GameEngine.enemies.push(knight);

        const sniper = new Tower(640, 300, 'sniper');
        sniper.upgrades = [0, 0, 5];
        sniper._recalculateStats();
        sniper.stats.eliteDefender = true;
        sniper.stats.dmgType = 'heavy';
        sniper.targetingMode = 'Strong';
        GameEngine.towers.push(sniper);

        let shots = 0;
        const origTakeDamage = knight.takeDamage.bind(knight);
        knight.takeDamage = (...a) => { shots++; return origTakeDamage(...a); };

        const DT = 1 / 60;
        for (let i = 0; i < 600; i++) {                 // 10 simulated seconds
            knight.update(DT);
            sniper.update(DT, GameEngine);
        }

        expect(shots).toBeGreaterThan(20);              // it really fires fast
        expect(knight.hp).toBeLessThan(60000);          // it really damages him
        expect(knight.hp).toBeGreaterThan(0);           // and doesn't cheese the fight
        expect(sniper.hitscans.length).toBeLessThanOrEqual(5);   // tracers decay
    });
});
