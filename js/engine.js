// js/engine.js
import { GameEngine } from './engineRef.js';
import { Config, Difficulties } from './config.js';
import { HeroStats } from './heroes/index.js';
import { TowerStats, TowerRegistry, Upgrades } from './towers/index.js';
import { HeroRegistry } from './heroes/index.js';
import { getBehavior } from './registry.js';
import { Maps, Waves } from './data.js';
import { Utils } from './utils.js';
import { GameMap } from './map.js';
import { Enemy } from './enemy.js';
import { Tower } from './tower.js';
import { Hero } from './hero.js';
import { WaveManager } from './waveManager.js';
import { Projectile } from './projectile.js';
import { Particle } from './particle.js';
import { ObjectPool } from './pool.js';
import { SpatialGrid } from './spatialGrid.js';
import { AudioEngine } from './audio.js';
import Assets from './assets.js';
import { UI } from './ui.js';
import { CutsceneManager } from './cutscene.js';
import { MKEffects } from './monkeyKnowledgeEffects.js';

import EngineInput from './engineInput.js';
import GameSession from './gameSession.js';
import SimulationLoop from './simulationLoop.js';
import { Beast } from './beastEntity.js';
import { Profiler } from './profiler.js'; 

const MAX_SUBSTEPS = 10;
const FIXED_TIMESTEP = 0.016;
const FPS_UPDATE_INTERVAL = 1000;
const HANG_THRESHOLD_MS = 500; 

// Tower types that earn tower XP toward their paragon unlock (registered
// towers only; addTowerXp maps paragon_* pops back onto the base type and
// hero types simply never appear in this set).
const PARAGON_XP_TYPES = new Set(Object.keys(TowerRegistry).filter(k => !k.startsWith('paragon_')));

// Filled in place so the object identity exported by engineRef.js stays the same
// (descriptors are copied, so getters such as `config` keep working).
Object.defineProperties(GameEngine, Object.getOwnPropertyDescriptors({
    canvas: null,
    ctx: null,
    lastTime: 0,
    bgInterval: null,
    ui: UI,
    _rafId: null,
    fpsEl: null,
    
    get config() { return Config; }, 
    
    towers: [],
    enemies: [],
    beasts: [], 
    sentries: [], 
    explosions: [],
    floatingTexts: [], 
    enemyGrid: new SpatialGrid(40),
    towerGrid: new SpatialGrid(80), 
    beastGrid: new SpatialGrid(80), 
    sentryGrid: new SpatialGrid(80), 
    
    projectilePool: new ObjectPool(() => new Projectile(), (p) => { p.alive = false; p.active = false; }, 2000),
    particlePool: new ObjectPool(() => new Particle(), (p) => { p.life = 0; p.active = false; }, 200),
    enemyPool: new ObjectPool(() => new Enemy(), (e) => { e.alive = false; }, 500), 
    
    lives: 100,
    cash: 650,
    manaShield: 0,
    maxManaShield: 0,
    leakedThisRound: false,
    selectedTowerType: null,
    selectedPlacedTower: null,
    mouse: { x: 0, y: 0 },
    timeScale: 1,
    gameState: 'menu',
    currentMap: 0,
    runInBackground: false,
    lastMenu: 'main-menu',
    speedState: 0,
    
    maps: Maps,
    waveManager: new WaveManager(),
    tier5Bought: {},
    flavorText: "",
    flavorTimer: 0,
    isSandbox: false,
    leakFlash: 0,
    
    hasIceShardTower: false, 
    
    lastCash: -1,
    lastLives: -1,
    frames: 0,
    fps: 0,
    lastFpsUpdate: 0,

    // Player XP earned from popping bloons this run, banked and flushed to
    // LevelManager in batches so per-pop adds never touch localStorage.
    sessionXp: 0,
    sessionXpFlushTimer: 0,

    // Per-tower-type XP earned from pops this run (paragon unlock progress).
    // Banked by addTowerXp(), flushed into Config.data.towerXp by
    // GameSession.flushTowerXp() on the same 0.5s cadence as sessionXp.
    towerXpSession: {},
    
    difficulty: null,
    hero: null,
    sandboxFortified: false,
    selectedHero: 'quincy',
    
    imfDebt: 0,
    acidPools: [],
    menuClickables: [],
    updateShopPrices: null,

    isMergingBeast: false,
    mergeSourceTower: null,

    profiler: Profiler,

    init() {
        Config.load();
        if (!Array.isArray(Config.data.customMaps)) Config.data.customMaps = [];
        if (!Config.data.selectedHero) Config.data.selectedHero = 'quincy';
        this.selectedHero = Config.data.selectedHero;
        this.currentMap = Config.data.currentMap;
        
        if (isNaN(this.currentMap) || this.currentMap < 0 || this.currentMap >= Maps.length) {
            this.currentMap = 0; 
            Config.data.currentMap = 0; 
            Config.save();
        }
        
        // RENDERER SELECTION. WebGL (PixiJS) is the only renderer. The legacy
        // Canvas2D renderer was removed entirely. A <canvas> element can only
        // have ONE context type for its lifetime, so we never call
        // getContext('2d'). The WebGL renderer module is dynamically imported
        // so it loads asynchronously. Everything else (game logic, input, UI)
        // is completely untouched by this flag.
        this.runInBackground = Config.data.runInBackground;
        this.canvas = document.getElementById('gameCanvas');
        this.useWebGL = true;
        this._pixiRenderer = null;
        this.rendererName = 'WebGL';

        console.log('[renderer] Loading PixiJS WebGL renderer...');
        // Resolved with the PixiRenderer once init finishes (null on
        // failure), so the loading screen can await the WebGL asset
        // preload before showing the menu.
        this.rendererReady = new Promise((resolve) => {
            import('./webgl/pixiRenderer.js').then(({ PixiRenderer }) => {
                return PixiRenderer.init(this.canvas).then(() => {
                    this._pixiRenderer = PixiRenderer;
                    console.log('[renderer] PixiJS WebGL renderer ready.');
                    resolve(PixiRenderer);
                });
            }).catch(err => {
                console.error('[renderer] Failed to init PixiJS renderer:', err);
                resolve(null);
            });
        });
        
        this.waveManager.autoWaveEnabled = Config.data.autoStart; 
        Assets.preloadCracks(); 
        
        this.fpsEl = document.getElementById('fps-display');
        if (this.fpsEl) this.fpsEl.style.display = Config.data.showFps ? 'block' : 'none';
        
        document.addEventListener("visibilitychange", () => this._handleVisibilityChange());
        
        this._boundLoop = this.loop.bind(this);
        this.restartLoop(); 
    },

    _handleVisibilityChange() {
        if (document.hidden) {
            this.saveGame();
            if (this.runInBackground && this.gameState === 'playing' && !this.bgInterval) {
                if (this._rafId) cancelAnimationFrame(this._rafId);
                this._rafId = null;
                this.bgInterval = setInterval(() => { this.loop(performance.now()); }, 1000 / 60);
            }
        } else {
            if (this.bgInterval) { clearInterval(this.bgInterval); this.bgInterval = null; }
            // Audit C-5 (v1.3.3): reschedule whenever the tab comes back,
            // whatever the run state. The loop itself is safe in the gameover
            // state (it only skips sim+render), and refusing to reschedule
            // here used to leave the page permanently dead after a run ended
            // in a hidden tab (the only recovery was the uncap-FPS checkbox).
            if (!this._rafId) {
                this.lastTime = performance.now();
                this._rafId = requestAnimationFrame(this._boundLoop);
            }
        }
    },

    getCost(baseCost) { return Math.floor(baseCost * (this.difficulty ? this.difficulty.costMod : 1.0)); },

    // Pop income can be fractional (round modifiers of 50%/20%/10%...). Fractions accumulate
    // here so nothing is lost to rounding (the old per-pop floor/max(1) paid $1 for a $0.20 pop,
    // and Half Cash paid nothing for $1 pops).
    addPopCash(amount) {
        const diff = this.difficulty;
        if (diff && typeof diff.incomeMult === 'number') amount *= diff.incomeMult;
        this._popCashFrac = (this._popCashFrac || 0) + amount;
        const whole = Math.floor(this._popCashFrac + 1e-9);
        if (whole > 0) {
            this._popCashFrac -= whole;
            this.addCash(whole, { pop: true, scaled: true });
        }
    },

    addCash(rawAmount, opts = {}) {
        if (rawAmount <= 0) return;
        const diff = this.difficulty;
        if (diff) {
            if (diff.noIncome && !(opts.wave && diff.allowWaveCash) && !opts.pop) return;
            if (typeof diff.incomeMult === 'number' && diff.incomeMult !== 1 && !opts.scaled) {
                rawAmount = Math.floor(rawAmount * diff.incomeMult);
                if (rawAmount <= 0) return;
            }
        }
        if (this.imfDebt > 0) {
            const mk = Config.data.mkActive === false ? {} : (Config.data.monkeyKnowledge || {});
            let taxRate = 0.50;
            for (const eff of MKEffects.economy) {
                if (!mk[eff.id]) continue;
                if (eff.stat === 'imfTaxRate') taxRate = eff.amount;
            }
            const tax = Math.floor(rawAmount * taxRate);
            if (tax >= this.imfDebt) { rawAmount -= this.imfDebt; this.imfDebt = 0; } 
            else { rawAmount -= tax; this.imfDebt -= tax; }
        }
        this.cash += rawAmount;
    },

    // Direct cash PENALTY (boss Cursor Slash etc.). addCash() early-returns on
    // non-positive amounts, so punishments routed through it were silently
    // swallowed (audit C-4). Floors at 0 so cash can never go negative.
    // Every deduction also flashes a red "-$N" over the cash display so the
    // player SEES what the boss took (v1.3.2).
    removeCash(amount) {
        const amt = Math.floor(Math.max(0, amount));
        if (amt <= 0) return;
        this.cash = Math.max(0, this.cash - amt);
        if (UI && typeof UI.showCashDeduction === 'function') UI.showCashDeduction(amt);
    },

    startGame(isSandbox = false) {
        this._popCashFrac = 0;
        this.isSandbox = isSandbox;
        try { this.map = new GameMap(this.currentMap); }
        catch (e) {
            this.log("Error loading map: " + e.message); this.gameState = 'gameover';
            UI.toggleMenus('game-over-menu');
            document.getElementById('go-wave-stat').innerText = `Map Load Error: ${e.message}`; return;
        }
        this.gameState = 'playing';
        const diff = isSandbox ? Difficulties.medium : Difficulties[Config.data.currentDifficulty];
        this.difficulty = diff;
        this.lives = isSandbox ? 999999 : diff.lives;
        this.cash = isSandbox ? 10000000 : diff.cash;
        this.imfDebt = 0;
        this.towers.length = 0; this.enemies.length = 0; this.explosions.length = 0;
        this.floatingTexts.length = 0; 
        this.beasts.length = 0; 
        this.sentries.length = 0; 
        this.acidPools.length = 0; this.menuClickables.length = 0;
        this.projectilePool.clear(); this.particlePool.clear();
        this.sessionXp = 0; this.sessionXpFlushTimer = 0;
        this.towerXpSession = {};
        if (!isSandbox && !diff.noSelling) {
            if (Config.data.unlocks.extraStartingLives) this.lives += 10;
            if (Config.data.unlocks.extraStartingCash) this.cash += 200;
        }

        // Pooled-flag sweep (audit v1.3.3): these reset for BOTH modes - the
        // singleton persists across games, and starting a sandbox run after a
        // normal one used to inherit its mana shield (which then "refilled"
        // every round, free tanking for sandbox experiments).
        this.manaShield = 0;
        this.maxManaShield = 0;
        this.leakedThisRound = false;
        this.globalXpMult = 1.0;

        const mk = Config.data.mkActive === false ? {} : (Config.data.monkeyKnowledge || {});
        if (!isSandbox) {
            for (const eff of MKEffects.gameInit) {
                if (!mk[eff.id]) continue;
                if (eff.condition && !eff.condition(this, diff)) continue;
                if (eff.action) eff.action(this, diff, { Tower });
            }
        }

        this.hero = null;
        this.waveManager = new WaveManager();
        this.waveManager.autoWaveEnabled = Config.data.autoStart;
        this.waveManager.currentWave = diff.startRound - 1;
        // Pooled-flag sweep (audit v1.3.3): the engine is a singleton, so
        // per-run caches must reset on EVERY start, both modes. A stale
        // _postChimpsMoab from the previous run defeated the validity check
        // (a dead pooled enemy reference kept the post-Chimps cutscene
        // pointed at a recycled bloon).
        this._postChimpsMoab = null;
        this.tier5Bought = {};
        this.speedState = 0; this.timeScale = 1;
        this.freeDartMonkeyClaimed = false; 
        UI.updateWaveSpeedBtn(this.speedState);
        CutsceneManager.reset(); 
        // Audit C-5 (v1.3.3): guarantee the render loop is running. If a
        // previous run died in a hidden tab (gameover under the setInterval
        // fallback), the visibility handler's old gameover guard left the
        // page dead and a fresh run would boot into a game that never ticks.
        // restartLoop() cancels any live rAF first, so no double-scheduling.
        this.restartLoop();
        this.updateUI();
    },

    pauseGame() { if (this.gameState !== 'playing') return; this.gameState = 'paused'; UI.showPause(); },
    resumeGame() { if (this.gameState !== 'paused') return; this.gameState = 'playing'; UI.hidePause(); },
    toggleMenus(menuId) { UI.toggleMenus(menuId); },

    resetCutscene() { CutsceneManager.reset(); },

    spawnPopEffect(x, y, color) {
        if (this.particlePool.active.length > 400) return;
        if (this.enemies.length > 600 && Math.random() > 0.2) return;
        const p = this.particlePool.get(); p.init(x, y, color);
    },

    // Banks per-pop player XP (already RBE-scaled by the caller) and flushes
    // it to LevelManager in batches so a busy round doesn't save config per pop.
    // flushSessionXp lives on GameSession (mixed in below) to avoid a circular
    // import between engine.js and levelManager.js.
    addSessionXp(amount) {
        if (!amount || amount <= 0) return;
        this.sessionXp += amount;
        if (this.sessionXp >= 25) this.flushSessionXp();
    },

    // Per-pop tower XP (1 XP per popped layer, BTD6-style) credited to the
    // killer tower's BASE type - paragon pops credit their base tower, sentry
    // pops credit the engineer. Heroes have their own XP (skipped here), and
    // sandbox never touches meta progression. Banked per type and flushed in
    // batches so a busy round doesn't hammer localStorage.
    addTowerXp(towerType, amount) {
        if (!towerType || !amount || amount <= 0) return;
        if (this.isSandbox) return;
        let base = towerType;
        if (base.startsWith('paragon_')) base = base.slice('paragon_'.length);
        if (!PARAGON_XP_TYPES.has(base)) return;
        this.towerXpSession[base] = (this.towerXpSession[base] || 0) + amount;
    },

    // True while any banked tower XP is waiting for its 0.5s flush.
    _hasTowerXpPending() {
        for (const k in this.towerXpSession) {
            if (this.towerXpSession[k] > 0) return true;
        }
        return false;
    },

    log(msg) { UI.log(msg); },

    updateUI() {
        if (this.lastLives !== this.lives) { UI.updateLives(this.lives); this.lastLives = this.lives; }
        if (this.lastCash !== this.cash) { UI.updateCash(this.cash, this); this.lastCash = this.cash; }
        UI.updateWave(this.waveManager.currentWave);
        UI.refreshSelectedTower(this);
    },

    restartLoop() {
        if (this._rafId) cancelAnimationFrame(this._rafId);
        if (this.bgInterval) clearInterval(this.bgInterval);
        this._rafId = null; this.bgInterval = null;
        this.lastTime = performance.now(); 
        this._rafId = requestAnimationFrame(this._boundLoop);
    },

    loop(timestamp) {
        try {
            if (timestamp === undefined || timestamp === null) { timestamp = performance.now(); }
            const rawDt = (timestamp - this.lastTime) / 1000;
            this.lastTime = timestamp;
            this.frames++;
            if (timestamp > this.lastFpsUpdate + FPS_UPDATE_INTERVAL) {
                this.fps = this.frames; this.lastFpsUpdate = timestamp; this.frames = 0;
                if (this.fpsEl) this.fpsEl.innerText = `${this.fps} FPS`;
            }
            if (this.gameState === 'playing') {
                const targetDt = Math.min(rawDt, 0.1) * this.timeScale;
                const steps = Math.max(1, Math.min(Math.ceil(targetDt / FIXED_TIMESTEP), MAX_SUBSTEPS));
                const stepDt = targetDt / steps;
                const updateStartTime = performance.now();
                try {
                    for (let i = 0; i < steps; i++) {
                        this.update(stepDt);
                        if (performance.now() - updateStartTime > HANG_THRESHOLD_MS) { throw new Error("Game Freeze: Infinite loop detected."); }
                    }
                } catch (err) {
                    console.error("FATAL SIMULATION ERROR:", err); 
                    if (import.meta.env.DEV) throw err; // Fail loud in dev mode
                    this.gameState = 'gameover';
                    try { 
                        UI.toggleMenus('game-over-menu'); 
                        document.getElementById('go-wave-stat').innerText = `Game Crash: ${err.message}.`; 
                    } catch(e) {
                        console.error("UI also crashed during game over:", e);
                    }
                }
                UI.updateAbilityBar(this); this.updateUI();
                if (!this._frameMs) this._frameMs = {};
                this._frameMs.sim = performance.now() - updateStartTime;
                this._frameMs.steps = steps;
                // Clamp like targetDt so a hidden/backgrounded tab (huge rawDt)
                // can't poison the profiler's total/fps percentiles with one
                // bogus multi-second sample.
                this._frameMs.total = Math.min(rawDt, 0.1) * 1000;
            }
            if (CutsceneManager.state !== 'idle' && this.gameState !== 'playing' && this.gameState !== 'paused' && this.gameState !== 'levelup') {
                CutsceneManager.reset();
            }
            if (this.gameState !== 'gameover') {
            const renderStartTime = performance.now();
            if (this._pixiRenderer) {
                // FIX: Pass rawDt so the Dev Overlay can calculate FPS
                try { this._pixiRenderer.render(this, rawDt); }
                catch (err) { console.error('[webgl debug] PIXI RENDER ERROR:', err); }
            }
            // else: Pixi still loading, skip this frame's draw silently.
                if (!this._frameMs) this._frameMs = {};
                this._frameMs.render = performance.now() - renderStartTime;
            }
            // Only sample real gameplay frames — menu/pause frames have stale
            // or zero timing and would pollute the profiler's percentiles.
            if (this.gameState === 'playing') Profiler.record(this, this._frameMs);
        } catch (fatalError) {
            console.error("FATAL LOOP ERROR (This caused the freeze):", fatalError);
            if (import.meta.env.DEV) throw fatalError; // Fail loud in dev mode
            this.gameState = 'gameover';
            try {
                UI.toggleMenus('game-over-menu'); 
                document.getElementById('go-wave-stat').innerText = `Fatal Loop Crash: ${fatalError.message}.`;
            } catch(e) {}
        }
        
        if (!this.bgInterval) { this._rafId = requestAnimationFrame(this._boundLoop); }
    },

    update(dt) {
        this._updateLimitsAndTimers(dt);
        if (this.sessionXp > 0 || this._hasTowerXpPending()) {
            this.sessionXpFlushTimer -= dt;
            if (this.sessionXpFlushTimer <= 0) { this.sessionXpFlushTimer = 0.5; this.flushSessionXp(); this.flushTowerXp(); }
        }
        if (this.difficulty && this.difficulty.isPostChimps && CutsceneManager.state === 'idle') {
            // [REGRESSION GUARD | upstream d29d4af "ace fix and performance improvements"]
            // Cached damaged-MOAB lookup — pinned by tests/gitsniperfixes.test.js. DO NOT DELETE.
            // Cache the first damaged MOAB instead of scanning every enemy
            // every frame. Re-find only when the cached target dies, heals
            // back to full, or hasn't been set — the same MOAB would win a
            // fresh scan anyway (damage only accumulates, order is stable).
            let damagedMoab = this._postChimpsMoab;
            if (!damagedMoab || !damagedMoab.alive || !damagedMoab.data?.isMoab || damagedMoab.hp >= damagedMoab._maxHp) {
                damagedMoab = this.enemies.find(e => e.alive && e.data.isMoab && e.hp < e._maxHp);
                this._postChimpsMoab = damagedMoab;
            }
            if (damagedMoab) CutsceneManager.trigger(damagedMoab);
        }
        if (CutsceneManager.update(dt)) { return; }
        
        const prevWaveActive = this.waveManager.waveActive;
        
        this.waveManager.update(dt); this._updateAcidPools(dt);
        const prevLives = this.lives; this._updateEnemies(dt);
        if (this.lives < prevLives) { this.leakFlash = 0.3; AudioEngine.playSfx('leak'); this.leakedThisRound = true; }
        this.enemyGrid.clear();
        for (const e of this.enemies) this.enemyGrid.insert(e);
        
        this._updateTowers(dt); 
        this._updateBeasts(dt); 
        this.beastGrid.clear(); 
        for (const b of this.beasts) this.beastGrid.insert(b); 
        
        this._updateSentries(dt); 
        this.sentryGrid.clear(); 
        for (const s of this.sentries) this.sentryGrid.insert(s); 
        
        this._updateEconomy(dt); this._updateProjectiles(dt);
        this._updateExplosions(dt); this._updateFloatingTexts(dt); this._updateParticles(dt);
        
        if (!this.waveManager.waveActive && prevWaveActive) {
            if (this.maxManaShield > 0 && !this.leakedThisRound) {
                this.manaShield = this.maxManaShield;
            }
            this.leakedThisRound = false;

            let livesToAdd = 0;
            for (const t of this.towers) {
                if (t && t.stats.healthyBananas > 0) {
                    livesToAdd += t.stats.healthyBananas;
                }
            }
            if (livesToAdd > 0) {
                this.lives += livesToAdd;
                this.log(`Healthy Bananas: +${livesToAdd} lives!`);
            }
        }

        if (this.lives <= 0) {
            AudioEngine.pause(); this.deselectAll(); this.gameState = 'gameover'; this.giveRewards();
            UI.toggleMenus('game-over-menu'); document.getElementById('go-wave-stat').innerText = `You survived to Wave ${this.waveManager.currentWave}`;
        }
    }
}));

Object.assign(GameEngine, EngineInput);
Object.assign(GameEngine, GameSession);
Object.assign(GameEngine, SimulationLoop);

// ADD THIS LINE AT THE VERY BOTTOM:
window.GameEngine = GameEngine;

export { GameEngine };
