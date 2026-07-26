// js/engine.js
import { Config, Difficulties, HeroStats } from './config.js';
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
import { Renderer } from './renderer.js';
import { CutsceneManager } from './cutscene.js';
import { MKEffects } from './monkeyKnowledgeEffects.js';

// FIX: Import the extracted modules
import EngineInput from './engineInput.js';
import GameSession from './gameSession.js';
import SimulationLoop from './simulationLoop.js';

const MAX_SUBSTEPS = 10;
const FIXED_TIMESTEP = 0.016;
const FPS_UPDATE_INTERVAL = 1000;
const HANG_THRESHOLD_MS = 500; 

export const GameEngine = {
    canvas: null,
    ctx: null,
    lastTime: 0,
    bgInterval: null,
    ui: UI,
    _rafId: null,
    fpsEl: null,
    
    get config() { return Config; }, 
    
    enemies: [],
    towers: [],
    explosions: [],
    enemyGrid: new SpatialGrid(80),
    towerGrid: new SpatialGrid(80), 
    
    projectilePool: new ObjectPool(() => new Projectile(), (p) => { p.alive = false; p.active = false; }, 200),
    particlePool: new ObjectPool(() => new Particle(), (p) => { p.life = 0; p.active = false; }, 200),
    enemyPool: new ObjectPool(() => new Enemy(), (e) => { e.alive = false; }, 200), 
    
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
    
    difficulty: null,
    hero: null,
    sandboxFortified: false,
    selectedHero: 'quincy',
    
    imfDebt: 0,
    acidPools: [],
    menuClickables: [],
    updateShopPrices: null,

    // FIX: Beast Handler Merge State
    isMergingBeast: false,
    mergeSourceTower: null,

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
        
        this.runInBackground = Config.data.runInBackground;
        this.canvas = document.getElementById('gameCanvas'); 
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = Config.data.smoothingEnabled;
        if (Config.data.smoothingEnabled) this.ctx.imageSmoothingQuality = 'high';
        
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
            if (!this._rafId && this.gameState !== 'gameover') {
                this.lastTime = performance.now();
                this._rafId = requestAnimationFrame(this._boundLoop);
            }
        }
    },

    getCost(baseCost) { return Math.floor(baseCost * (this.difficulty ? this.difficulty.costMod : 1.0)); },

    addCash(rawAmount) {
        if (rawAmount <= 0) return;
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

    startGame(isSandbox = false) {
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
        this.acidPools.length = 0; this.menuClickables.length = 0;
        this.projectilePool.clear(); this.particlePool.clear();
        if (!isSandbox && !diff.noSelling) {
            if (Config.data.unlocks.extraStartingLives) this.lives += 10;
            if (Config.data.unlocks.extraStartingCash) this.cash += 200;
        }

        const mk = Config.data.mkActive === false ? {} : (Config.data.monkeyKnowledge || {});
        if (!isSandbox) {
            this.manaShield = 0;
            this.maxManaShield = 0;
            this.leakedThisRound = false;
            this.globalXpMult = 1.0;
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
        this.tier5Bought = {};
        this.speedState = 0; this.timeScale = 1;
        this.freeDartMonkeyClaimed = false; 
        UI.updateWaveSpeedBtn(this.speedState);
        CutsceneManager.reset(); 
        this.updateUI();
    },

    pauseGame() { if (this.gameState !== 'playing') return; this.gameState = 'paused'; UI.showPause(); },
    resumeGame() { if (this.gameState !== 'paused') return; this.gameState = 'playing'; UI.hidePause(); },
    toggleMenus(menuId) { UI.toggleMenus(menuId); },

    spawnPopEffect(x, y, color) {
        if (this.particlePool.active.length > 400) return;
        if (this.enemies.length > 600 && Math.random() > 0.2) return;
        const p = this.particlePool.get(); p.init(x, y, color);
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
                    this.gameState = 'gameover';
                    try { 
                        UI.toggleMenus('game-over-menu'); 
                        document.getElementById('go-wave-stat').innerText = `Game Crash: ${err.message}.`; 
                    } catch(e) {
                        console.error("UI also crashed during game over:", e);
                    }
                }
                UI.updateAbilityBar(this); this.updateUI();
            }
            if (this.gameState !== 'gameover') {
                try { Renderer.render(this, rawDt); } 
                catch (err) {
                    console.error("FATAL RENDER ERROR:", err); this.gameState = 'gameover';
                    try { 
                        UI.toggleMenus('game-over-menu'); 
                        document.getElementById('go-wave-stat').innerText = `Render Crash: ${err.message}.`; 
                    } catch(e) {
                        console.error("UI also crashed during render game over:", e);
                    }
                }
            }
        } catch (fatalError) {
            console.error("FATAL LOOP ERROR (This caused the freeze):", fatalError);
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
        if (this.difficulty && this.difficulty.isPostChimps && CutsceneManager.state === 'idle') {
            let damagedMoab = this.enemies.find(e => e.alive && e.data.isMoab && e.hp < e._maxHp);
            if (damagedMoab) CutsceneManager.trigger(damagedMoab);
        }
        if (CutsceneManager.update(dt)) { return; }
        
        const prevWaveActive = this.waveManager.waveActive;
        
        this.waveManager.update(dt); this._updateAcidPools(dt);
        const prevLives = this.lives; this._updateEnemies(dt);
        if (this.lives < prevLives) { this.leakFlash = 0.3; AudioEngine.playSfx('leak'); this.leakedThisRound = true; }
        this.enemyGrid.clear();
        for (const e of this.enemies) this.enemyGrid.insert(e);
        this._updateTowers(dt); this._updateEconomy(dt); this._updateProjectiles(dt);
        this._updateExplosions(dt); this._updateParticles(dt);
        
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
};

// FIX: Mix in the extracted modules
Object.assign(GameEngine, EngineInput);
Object.assign(GameEngine, GameSession);
Object.assign(GameEngine, SimulationLoop);