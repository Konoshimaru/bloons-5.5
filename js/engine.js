// js/engine.js
import { Config, Difficulties, HeroStats, TargetingModes, CANVAS_WIDTH, CANVAS_HEIGHT } from './config.js';
import { TowerStats, Upgrades, TowerRegistry } from './towers/index.js';
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
import { GLOBAL_SCALE } from './constants.js';

const MAX_SUBSTEPS = 10;
const MAX_PROJECTILES = 1500;
const MAX_PARTICLES = 400;
const MAX_EXPLOSIONS = 100;
const MAX_ACID_POOLS = 100;
const FIXED_TIMESTEP = 0.016;
const FPS_UPDATE_INTERVAL = 1000;
const SPEED_MULTIPLIERS = [1, 1, 2, 3, 5, 10, 20];
const MAX_SPEED_NORMAL = 3;
const MAX_SPEED_EXTREME = 6;
const HANG_THRESHOLD_MS = 500; 

export const GameEngine = {
    canvas: null,
    ctx: null,
    lastTime: 0,
    bgInterval: null,
    ui: UI,
    _rafId: null,
    fpsEl: null,
    
    get config() { return Config; }, // Allows tower.js and enemy.js to safely access Config without importing it directly
    
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
            const taxRate = mk['backroom_deals'] ? 0.40 : 0.50;
            const tax = Math.floor(rawAmount * taxRate);
            if (tax >= this.imfDebt) { rawAmount -= this.imfDebt; this.imfDebt = 0; } 
            else { rawAmount -= tax; this.imfDebt -= tax; }
        }
        this.cash += rawAmount;
    },

    handleWaveSpeedClick(direction = 1) {
        const isExtreme = Config.data.extremeSpeedEnabled === true;
        const maxSpeed = isExtreme ? MAX_SPEED_EXTREME : MAX_SPEED_NORMAL;
        if (direction > 0) {
            if (this.waveManager.waveActive || this.speedState > 0) {
                this.speedState++;
                if (this.speedState > maxSpeed) this.speedState = 1;
            } else { this.waveManager.startWave(); this.speedState = 1; }
        } else {
            if (this.speedState > 0) { this.speedState--; if (this.speedState < 1) this.speedState = maxSpeed; }
        }
        this.timeScale = SPEED_MULTIPLIERS[this.speedState] || 1;
        UI.updateWaveSpeedBtn(this.speedState);
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

        // --- MONKEY KNOWLEDGE EFFECTS ---
        const mk = Config.data.mkActive === false ? {} : (Config.data.monkeyKnowledge || {});
        if (!isSandbox) {
            if (mk['more_cash']) this.cash += 200;
            if (mk['bonus_glue']) {
                const t = new Tower(350, 350, 'glue');
                this.towers.push(t);
            }
            
            this.manaShield = 0;
            this.maxManaShield = 0;
            this.leakedThisRound = false;
            if (mk['mana_shield'] && diff.name !== 'Impoppable') {
                this.maxManaShield = 25;
                this.manaShield = 25;
            }

            this.globalXpMult = mk['monkey_education'] ? 1.08 : 1.0;
        }
        // --------------------------------

        this.hero = null;
        this.waveManager = new WaveManager();
        this.waveManager.autoWaveEnabled = Config.data.autoStart;
        this.waveManager.currentWave = diff.startRound - 1;
        this.tier5Bought = {};
        this.speedState = 0; this.timeScale = 1;
        UI.updateWaveSpeedBtn(this.speedState);
        CutsceneManager.reset(); 
        this.updateUI();
    },

    skipWave(amount) {
        this.waveManager.clearField();
        const floorWave = this.difficulty ? this.difficulty.startRound : 1;
        if (amount > 0) { this.waveManager.startWave(); } 
        else if (amount < 0) {
            if (this.waveManager.currentWave <= floorWave) {
                this.log("Already at the first wave!"); this.waveManager.currentWave = floorWave - 1; this.waveManager.startWave(); return;
            }
            this.waveManager.currentWave -= 2;
            if (this.waveManager.currentWave < floorWave - 1) this.waveManager.currentWave = floorWave - 1;
            this.waveManager.startWave();
        }
        this.updateUI();
    },

    saveGame() {
        if (this.gameState !== 'playing' && this.gameState !== 'paused') return;
        const state = { mapIndex: this.currentMap, difficulty: this.difficulty.name, lives: this.lives, cash: this.cash, wave: this.waveManager.currentWave,
            towers: this.towers.map(t => ({ x: t.x, y: t.y, type: t.type, upgrades: [...t.upgrades], targeting: t.targetingMode, heroLevel: t.level || 0 })) };
        Config.data.savedRun = state; Config.save();
    },

    loadGame() {
        if (!Config.data.savedRun) return false;
        const state = Config.data.savedRun;
        this.currentMap = state.mapIndex;
        Config.data.currentDifficulty = state.difficulty.toLowerCase().replace(/\s+/g, '');
        this.startGame(false);
        this.lives = state.lives; this.cash = state.cash;
        this.waveManager.currentWave = state.wave - 1;
        for (const tData of state.towers) {
            const stats = TowerStats[tData.type] || HeroStats[tData.type];
            let t;
            if (stats.isHero) { t = new Hero(tData.x, tData.y, tData.type); this.hero = t; } 
            else { t = new Tower(tData.x, tData.y, tData.type); }
            t.upgrades = [...tData.upgrades]; t.targetingMode = tData.targeting; t.applyUpgradesForLoad();
            if (t.stats.isHero && tData.heroLevel > 1) { while (t.level < tData.heroLevel) t.levelUp(); }
            this.towers.push(t);
        }
        this.updateUI(); return true;
    },

    abandonRun() {
        Config.data.savedRun = null; Config.save(); this.gameState = 'menu'; this.map = null;
        UI.toggleMenus(null); document.getElementById('main-menu-ui').classList.remove('hidden'); UI.updateMetaStats();
    },

    giveRewards() {
        const wavesSurvived = this.waveManager.currentWave;
        const xpEarned = wavesSurvived * 15;
        let mmEarned = Math.floor(wavesSurvived / 3) + 5;
        
        const mk = Config.data.mkActive === false ? {} : (Config.data.monkeyKnowledge || {});
        if (mk['mo_monkey_money']) mmEarned = Math.floor(mmEarned * 1.1);
        
        Config.data.playerXP += xpEarned; Config.data.monkeyMoney += mmEarned;
        
        while (Config.data.playerXP >= Config.data.playerXPToNext) {
            Config.data.playerXP -= Config.data.playerXPToNext; 
            Config.data.playerLevel++;
            Config.data.playerXPToNext = Math.floor(Config.data.playerXPToNext * 1.25);
            if (Config.data.playerLevel > 25) {
                Config.data.knowledgePoints = (Config.data.knowledgePoints || 0) + 1;
            }
        }
        
        Config.data.savedRun = null; Config.save();
        const rewardsEl = document.getElementById('go-rewards');
        if (rewardsEl) rewardsEl.innerHTML = `+${xpEarned} XP<br>+${mmEarned} Monkey Money`;
    },

    pauseGame() { if (this.gameState !== 'playing') return; this.gameState = 'paused'; UI.showPause(); },
    resumeGame() { if (this.gameState !== 'paused') return; this.gameState = 'playing'; UI.hidePause(); },
    toggleMenus(menuId) { UI.toggleMenus(menuId); },

    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (this.gameState === 'menu') {
            for (let i = this.menuClickables.length - 1; i >= 0; i--) {
                let item = this.menuClickables[i];
                if (Utils.withinRange(x, y, item.x, item.y, item.r + 10)) {
                    this.menuClickables.splice(i, 1);
                    Config.data.monkeyMoney += 1; Config.save();
                    UI.updateMetaStats(); UI.log("You caught a banana! +1 Monkey Money"); return;
                }
            }
            return;
        }

        if (this.gameState !== 'playing') return;
        
        if (this.hero && this.hero.isHollowCharging) {
            this.hero.isHollowCharging = false;
            this.hero.hollowProjectile = { x: this.hero.x, y: this.hero.y, angle: Utils.angle(this.hero.x, this.hero.y, x, y), hitEnemies: new Set() };
            return;
        }

        for (const t of this.towers) {
            if (t && Utils.withinRange(x, y, t.x, t.y, t.hitRadius + 5)) {
                if (this.selectedPlacedTower === t) { this.deselectAll(); } 
                else { this.deselectAll(); this.selectedPlacedTower = t; UI.showUpgradeUI(t, this); }
                return;
            }
        }

        if (this.selectedTowerType) {
            const stats = TowerStats[this.selectedTowerType] || HeroStats[this.selectedTowerType];
            let cost = this.getCost(stats.cost);
            const mk = Config.data.mkActive === false ? {} : (Config.data.monkeyKnowledge || {});
            
            if (this.selectedTowerType === 'dart' && Config.data.unlocks.freeFirstDartMonkey && !this.isSandbox && !this.difficulty.noSelling) {
                if (!this.towers.some(t => t.type === 'dart')) { cost = 0; }
            }
            
            if (this.selectedTowerType === 'dart' && mk['bonus_monkey'] && !this.isSandbox && !this.difficulty.noSelling) {
                if (!this.towers.some(t => t.type === 'dart')) { cost = 0; }
            }
            
            const militaryTypes = ['sniper', 'sub', 'buccaneer', 'ace', 'heli', 'mortar', 'dartling'];
            if (militaryTypes.includes(this.selectedTowerType) && mk['military_conscription'] && !this.isSandbox) {
                const hasMilitary = this.towers.some(t => militaryTypes.includes(t.type));
                if (!hasMilitary) {
                    cost = Math.floor(cost * 0.66);
                }
            }

            if (this.selectedTowerType === 'spike' && mk['first_line_of_defense'] && !this.isSandbox) {
                if (!this.towers.some(t => t.type === 'spike')) {
                    cost = Math.max(0, cost - 150);
                }
            }

            if (this.selectedTowerType === 'farm' && mk['farm_subsidy'] && !this.isSandbox) {
                if (!this.towers.some(t => t.type === 'farm')) {
                    cost = Math.max(0, cost - 100);
                }
            }

            if (this.cash < cost) { this.log("Not enough cash!"); return; }

            const placementRadius = (stats.hitRadius || 18) * GLOBAL_SCALE;
            const isOverlapping = this.towers.some(t => t && Utils.withinRange(x, y, t.x, t.y, t.hitRadius + placementRadius));
            if (isOverlapping) { this.log("Cannot place on top of another monkey!"); return; }

            let canPlace = false;
            if (stats.waterOnly) { canPlace = this.map.isInWater(x, y); } 
            else if (stats.canPlaceOnWater) { canPlace = !this.map.isOnPath(x, y) && !this.map.isOnProp(x, y) && y < CANVAS_HEIGHT && x < CANVAS_WIDTH - 300; } 
            else {
                const isOnFrozenWater = this.map.isOnFrozenWater(x, y, this.towers);
                canPlace = !this.map.isOnPath(x, y) && !this.map.isOnProp(x, y) && y < CANVAS_HEIGHT && x < CANVAS_WIDTH - 300 && (!this.map.isInWater(x, y) || isOnFrozenWater);
            }
            if (!canPlace) { this.log(stats.waterOnly ? "Must be placed on water!" : "Cannot place here!"); return; }

            if (stats.isHero && this.hero) { this.log("You can only place one Hero per game!"); return; }

            const newTower = stats.isHero ? new Hero(x, y, this.selectedTowerType) : new Tower(x, y, this.selectedTowerType);
            if (stats.isHero) this.hero = newTower;
            if (newTower.type === 'spike') newTower.targetingMode = 'Normal';
            this.towers.push(newTower); this.cash -= cost; AudioEngine.playSfx('place');
            this.updateUI(); this.log("Tower placed!"); this.deselectAll(); return; 
        }
        this.deselectAll();
    },

    cycleTargeting(direction = 1) {
        if (!this.selectedPlacedTower) return;
        const t = this.selectedPlacedTower;
        let modes = ['First', 'Last', 'Strong', 'Close'];
        if (t.stats.unlocksElite) { modes.push('Elite'); }
        if (t.type === 'spike') { modes = t.stats.smartSpikes ? ['Normal', 'Close', 'Smart'] : ['Normal']; }
        let idx = modes.indexOf(t.targetingMode);
        if (idx === -1) idx = 0; 
        idx = (idx + direction + modes.length) % modes.length; 
        t.targetingMode = modes[idx];
        UI.showUpgradeUI(t, this);
    },

    handleUpgrade(path) {
        if (!this.selectedPlacedTower) return;
        const t = this.selectedPlacedTower;
        if (t.stats.isHero) return; 
        const tier = t.upgrades[path - 1];
        const upgradeData = Upgrades[t.type][path][tier];
        if (!upgradeData) { this.log("Max upgrades reached!"); return; }
        if (!t.canUpgrade(path, this)) { this.log("Upgrade locked by crosspath or global limit!"); return; }
        const cost = this.getCost(upgradeData.cost);
        if (this.cash < cost) { this.log("Not enough cash!"); return; }
        t.upgrade(path, this); UI.showUpgradeUI(t, this);
    },

    buyHeroLevel() {
        if (this.selectedPlacedTower && this.selectedPlacedTower.stats.isHero) {
            this.selectedPlacedTower.buyLevel(this); UI.showUpgradeUI(this.selectedPlacedTower, this);
        }
    },

    activateAbility(slot = 1, t = null) {
        if (!t) t = this.selectedPlacedTower;
        if (!t) return;
        const behavior = getBehavior(t.type);
        if (!behavior) return;

        const mk = Config.data.mkActive === false ? {} : (Config.data.monkeyKnowledge || {});
        let cdMult = 1.0;
        if (mk['global_cooldowns']) cdMult = 0.97;

        // MK: Ability Discipline (Hero Level 10 Ability -10% cd)
        if (t.stats.isHero && mk['ability_discipline'] && slot === 2) cdMult *= 0.90;
        // MK: Ability Mastery (Hero Level 3 Ability -30% cd at Level 20)
        if (t.stats.isHero && mk['ability_mastery'] && slot === 1 && t.level >= 20) cdMult *= 0.70;

        if (slot === 1 && t.stats.isAbility && t.abilityCooldown <= 0 && behavior.ability) {
            behavior.ability(t, this);
            let cd = t.stats.isHero ? (t.stats.rapidShotMult ? t.stats.rapidShotCd || 60 : 40) : (t.stats.abilityCd || 45);
            t.abilityCooldown = cd * cdMult; return;
        }
        if (slot === 2 && t.stats.isAbility2 && t.ability2Cooldown <= 0 && behavior.ability2) {
            behavior.ability2(t, this); 
            let cd = t.stats.isHero ? (t.stats.stormCd || 70) : 60;
            t.ability2Cooldown = cd * cdMult; return;
        }
        if (slot === 3 && t.stats.isAbility3 && t.ability3Cooldown <= 0 && behavior.ability3) {
            behavior.ability3(t, this); 
            let cd = t.stats.isHero ? 120 : 60;
            t.ability3Cooldown = cd * cdMult; return;
        }
    },

    sellTower() {
        if (!this.selectedPlacedTower) return;
        if (this.difficulty && this.difficulty.noSelling) { this.log("Cannot sell in CHIMPS mode!"); return; }
        if (this.selectedPlacedTower.stats.isHero) this.hero = null;
        this.selectedPlacedTower.sell(this);
        const idx = this.towers.indexOf(this.selectedPlacedTower);
        if (idx > -1) this.towers.splice(idx, 1);
        this.deselectAll();
    },

    deselectAll() {
        this.selectedTowerType = null; this.selectedPlacedTower = null;
        UI.hideUpgradePanel();
        const cancelBtn = document.getElementById('cancel-btn');
        if (cancelBtn) cancelBtn.classList.add('hidden');
    },

    spawnPopEffect(x, y, color) {
        if (this.particlePool.active.length > MAX_PARTICLES) return;
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
            const mk = Config.data.mkActive === false ? {} : (Config.data.monkeyKnowledge || {});
            
            if (this.maxManaShield > 0 && !this.leakedThisRound) {
                this.manaShield = this.maxManaShield;
            }
            this.leakedThisRound = false;

            if (mk['healthy_bananas']) {
                let livesToAdd = 0;
                for (const t of this.towers) {
                    if (t && t.type === 'farm' && t.upgrades[2] >= 3) {
                        livesToAdd += (t.upgrades[2] >= 4) ? 3 : 1;
                    }
                }
                if (livesToAdd > 0) {
                    this.lives += livesToAdd;
                    this.log(`Healthy Bananas: +${livesToAdd} lives!`);
                }
            }
        }

        if (this.lives <= 0) {
            AudioEngine.pause(); this.deselectAll(); this.gameState = 'gameover'; this.giveRewards();
            UI.toggleMenus('game-over-menu'); document.getElementById('go-wave-stat').innerText = `You survived to Wave ${this.waveManager.currentWave}`;
        }
    },

    _updateLimitsAndTimers(dt) {
        if (this.projectilePool.active.length > MAX_PROJECTILES) this.projectilePool.removeAt(0);
        if (this.particlePool.active.length > MAX_PARTICLES) this.particlePool.removeAt(0);
        if (this.explosions.length > MAX_EXPLOSIONS) this.explosions.shift();
        if (this.acidPools.length > MAX_ACID_POOLS) this.acidPools.shift();
        if (this.flavorTimer > 0) this.flavorTimer -= dt;
        if (this.leakFlash > 0) this.leakFlash -= dt;
    },

    _updateAcidPools(dt) {
        for (let i = this.acidPools.length - 1; i >= 0; i--) {
            const pool = this.acidPools[i];
            pool.life -= dt; pool.tick -= dt;
            if (pool.life <= 0) { this.acidPools.splice(i, 1); continue; }
            if (pool.tick <= 0) {
                pool.tick = 1.0;
                const nearby = this.enemyGrid.query(pool.x, pool.y, pool.radius);
                for (const e of nearby) {
                    if (e.alive && Utils.withinRange(pool.x, pool.y, e.x, e.y, pool.radius)) {
                        e.takeDamage(pool.dmg, { isAcid: true, canHitLead: true });
                    }
                }
            }
        }
    },

    _updateEnemies(dt) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (!e) continue;
            e.update(dt);
            if (!e.alive) {
                const last = this.enemies.pop();
                if (i < this.enemies.length) { this.enemies[i] = last; }
                this.enemyPool.release(e);
            }
        }
    },

    _updateTowers(dt) {
        for (const t of this.towers) {
            if (!t) continue;
            t.buffedRange = 0; t.buffedFireRate = 0; t.buffedCamo = false; t.buffedLead = false;
            t.discount = 0; t.buffedDmg = 0; t.buffedPierce = 0; t.buffedValueMult = 0;
        }
        this.hasIceShardTower = false; this.hasLeakingEnemy = false;
        if (this.map) {
            const totalLen = this.map.getTotalLength();
            if (totalLen > 0) {
                const leakThreshold = totalLen * 0.75;
                for (const e of this.enemies) { if (e.alive && e.distanceTraveled > leakThreshold) { this.hasLeakingEnemy = true; break; } }
            }
        }
        this.towerGrid.clear();
        for (const t of this.towers) { if (t) this.towerGrid.insert(t); }
        for (const t of this.towers) {
            if (!t) continue;
            const behavior = getBehavior(t.type);
            if (behavior && behavior.updateSupport) { behavior.updateSupport(t, dt); }
            if (t.type === 'ice' && t.upgrades[0] >= 3) { this.hasIceShardTower = true; }
        }
        for (const t of this.towers) { if (t) t.update(dt, this); }
    },

    _updateEconomy(dt) {
        if (this.mouse.x === undefined) return;
        for (const t of this.towers) {
            if (!t || !t.bananas || t.bananas.length === 0) continue;
            for (let i = t.bananas.length - 1; i >= 0; i--) {
                const b = t.bananas[i];
                if (b.progress < 1) continue;
                
                const dx = this.mouse.x - b.x;
                const dy = this.mouse.y - b.y;
                const distSq = dx * dx + dy * dy;
                const range = t.stats.collectionRange || 40;
                
                if (distSq < range * range) {
                    const dist = Math.sqrt(distSq) || 1;
                    const speed = 500 * dt;
                    b.x += (dx / dist) * speed;
                    b.y += (dy / dist) * speed;
                    if (dist < 15) {
                        this.addCash(b.value); t.cashGenerated = (t.cashGenerated || 0) + b.value;
                        AudioEngine.playSfx('cash'); t.bananas.splice(i, 1);
                    }
                }
            }
        }
    },

    _updateProjectiles(dt) {
        const projectiles = this.projectilePool.active;
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            if (!p) continue;
            p.update(dt);
            if (!p.alive) { this.projectilePool.removeAt(i); }
        }
    },

    _updateExplosions(dt) {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            if (!exp) continue;
            exp.life -= dt;
            if (exp.maxLife > 0) { exp.radius = (1 - exp.life / exp.maxLife) * (exp.maxRadius || 0); }
            if (exp.life <= 0) {
                const last = this.explosions.pop();
                if (i < this.explosions.length) { this.explosions[i] = last; }
            }
        }
    },

    _updateParticles(dt) {
        const particles = this.particlePool.active;
        for (let i = particles.length - 1; i >= 0; i--) {
            const pt = particles[i];
            if (!pt) continue;
            pt.update(dt);
            if (pt.life <= 0) { this.particlePool.removeAt(i); }
        }
    }
};