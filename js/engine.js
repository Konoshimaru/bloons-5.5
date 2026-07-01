import { Config, Difficulties, HeroStats, TargetingModes } from './config.js';
import { TowerStats, Upgrades, TowerRegistry } from './towers/index.js';
import { HeroRegistry } from './heroes/index.js';
import { Maps, Waves } from './data.js';
import { Utils, drawImageCentered } from './utils.js';
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

export const GameEngine = {
    canvas: null, ctx: null, lastTime: 0, bgInterval: null, ui: UI, _rafId: null,
    enemies: [], towers: [], explosions: [],
    projectilePool: new ObjectPool(() => new Projectile(), (p) => { p.alive = false; p.active = false; }, 200),
    particlePool: new ObjectPool(() => new Particle(), (p) => { p.life = 0; p.active = false; }, 200),
    enemyGrid: new SpatialGrid(80),
    lives: 100, cash: 650, selectedTowerType: null, selectedPlacedTower: null,
    mouse: { x: 0, y: 0 }, timeScale: 1, gameState: 'menu', currentMap: 0, runInBackground: false, lastMenu: 'main-menu', speedState: 0,
    maps: Maps, waveManager: new WaveManager(), tier5Bought: {}, flavorText: "", flavorTimer: 0, isSandbox: false, 
    lastCash: -1, lastLives: -1, frames: 0, fps: 0, lastFpsUpdate: 0, 
    difficulty: null, hero: null, sandboxFortified: false, selectedHero: 'quincy',
    imfDebt: 0, acidPools: [],

    init() {
        Config.load();
        if (!Array.isArray(Config.data.customMaps)) Config.data.customMaps = [];
        if (!Config.data.selectedHero) Config.data.selectedHero = 'quincy';
        this.selectedHero = Config.data.selectedHero;
        this.currentMap = Config.data.currentMap;
        if (isNaN(this.currentMap) || this.currentMap < 0 || this.currentMap >= Maps.length) {
            this.currentMap = 0; Config.data.currentMap = 0; Config.save();
        }
        this.runInBackground = Config.data.runInBackground;
        this.canvas = document.getElementById('gameCanvas'); 
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = Config.data.smoothingEnabled;
        if (Config.data.smoothingEnabled) this.ctx.imageSmoothingQuality = 'high';
        this.waveManager.autoWaveEnabled = Config.data.autoStart;
        Assets.preloadCracks(); 
        document.getElementById('fps-display').style.display = Config.data.showFps ? 'block' : 'none';
        
        document.addEventListener("visibilitychange", () => { 
            if (document.hidden) { 
                this.saveGame(); // Auto-save when tab is hidden
                if (this.runInBackground && this.gameState === 'playing' && !this.bgInterval) { 
                    this.bgInterval = setInterval(() => this.loop(performance.now()), 16); 
                } 
            } else { 
                if (this.bgInterval) { clearInterval(this.bgInterval); this.bgInterval = null; } 
            } 
        });
        
        this._boundLoop = this.loop.bind(this);
        if (this._rafId) cancelAnimationFrame(this._rafId);
        this._rafId = requestAnimationFrame(this._boundLoop);
    },

    getCost(baseCost) { return Math.floor(baseCost * (this.difficulty ? this.difficulty.costMod : 1.0)); },

    addCash(rawAmount) {
        if (rawAmount <= 0) return;
        if (this.imfDebt > 0) {
            let tax = Math.floor(rawAmount * 0.5);
            if (tax >= this.imfDebt) { rawAmount -= this.imfDebt; this.imfDebt = 0; } 
            else { rawAmount -= tax; this.imfDebt -= tax; }
        }
        this.cash += rawAmount;
        this.updateUI();
    },

    handleWaveSpeedClick() {
        if (!this.waveManager.waveActive) {
            if (this.speedState === 0) { this.waveManager.startWave(); this.speedState = 1; this.timeScale = 1; }
            else {
                if (this.speedState === 1) this.speedState = 2;
                else if (this.speedState === 2) this.speedState = 3;
                else if (this.speedState === 3) this.speedState = 1;
                this.timeScale = this.speedState;
            }
        } else {
            if (this.speedState === 0) this.speedState = 1;
            else if (this.speedState === 1) this.speedState = 2;
            else if (this.speedState === 2) this.speedState = 3;
            else if (this.speedState === 3) this.speedState = 1;
            this.timeScale = this.speedState;
        }
        UI.updateWaveSpeedBtn(this.speedState);
    },

    startGame(isSandbox = false) { 
        this.isSandbox = isSandbox;
        this.map = new GameMap(this.currentMap); this.gameState = 'playing'; 
        const diff = isSandbox ? Difficulties.medium : Difficulties[Config.data.currentDifficulty];
        this.difficulty = diff;
        this.lives = isSandbox ? 999999 : diff.lives; 
        this.cash = isSandbox ? 10000000 : diff.cash; 
        this.imfDebt = 0; 
        this.towers = []; this.enemies = []; 
        this.projectilePool.clear(); 
        this.particlePool.clear();   
        this.explosions = []; 
        this.acidPools = []; 
        this.hero = null; 
        this.waveManager = new WaveManager(); 
        this.waveManager.autoWaveEnabled = Config.data.autoStart; 
        this.waveManager.currentWave = diff.startRound - 1; 
        this.tier5Bought = {}; 
        this.speedState = 0; this.timeScale = 1; UI.updateWaveSpeedBtn(this.speedState); this.updateUI(); 
    },

    skipWave(amount) {
        this.waveManager.clearField();
        const floorWave = this.difficulty ? this.difficulty.startRound : 1;
        if (amount > 0) { this.waveManager.startWave(); } 
        else if (amount < 0) {
            if (this.waveManager.currentWave <= floorWave) { this.log("Already at the first wave!"); this.waveManager.currentWave = floorWave - 1; this.waveManager.startWave(); return; }
            this.waveManager.currentWave -= 2; 
            if (this.waveManager.currentWave < floorWave - 1) this.waveManager.currentWave = floorWave - 1;
            this.waveManager.startWave();
        }
        this.updateUI();
    },
    
    // PRO FEATURE: Meta-Game Saving & Loading
    saveGame() {
        if (this.gameState !== 'playing' && this.gameState !== 'paused') return;
        
        const state = {
            mapIndex: this.currentMap,
            difficulty: this.difficulty.name,
            lives: this.lives,
            cash: this.cash,
            wave: this.waveManager.currentWave,
            towers: this.towers.map(t => ({
                x: t.x, y: t.y, type: t.type, 
                upgrades: [...t.upgrades], 
                targeting: t.targetingMode,
                heroLevel: t.level ? t.level : 0
            }))
        };
        Config.data.savedRun = state;
        Config.save();
    },

    loadGame() {
        if (!Config.data.savedRun) return false;
        const state = Config.data.savedRun;
        
        this.currentMap = state.mapIndex;
        Config.data.currentDifficulty = state.difficulty.toLowerCase();
        
        this.startGame(false); 
        
        this.lives = state.lives;
        this.cash = state.cash;
        this.waveManager.currentWave = state.wave - 1; 
        
        for (let tData of state.towers) {
            let t;
            const stats = TowerStats[tData.type] || HeroStats[tData.type];
            if (stats.isHero) {
                t = new Hero(tData.x, tData.y, tData.type);
                this.hero = t;
            } else {
                t = new Tower(tData.x, tData.y, tData.type);
            }
            t.upgrades = [...tData.upgrades];
            t.targetingMode = tData.targeting;
            t.applyUpgradesForLoad(); 
            
            if (t.stats.isHero && tData.heroLevel > 1) {
                while(t.level < tData.heroLevel) {
                    t.levelUp();
                }
            }
            
            this.towers.push(t);
        }
        
        this.updateUI();
        return true;
    },

    abandonRun() {
        Config.data.savedRun = null;
        Config.save();
        this.gameState = 'menu';
        UI.toggleMenus('main-menu');
        UI.updateMetaStats();
    },

    giveRewards() {
        const wavesSurvived = this.waveManager.currentWave;
        const xpEarned = wavesSurvived * 15;
        const mmEarned = Math.floor(wavesSurvived / 3) + 5;
        
        Config.data.playerXP += xpEarned;
        Config.data.monkeyMoney += mmEarned;
        
        while (Config.data.playerXP >= Config.data.playerXPToNext) {
            Config.data.playerXP -= Config.data.playerXPToNext;
            Config.data.playerLevel++;
            Config.data.playerXPToNext = Math.floor(Config.data.playerXPToNext * 1.25);
        }
        
        Config.data.savedRun = null; 
        Config.save();
        
        const rewardsEl = document.getElementById('go-rewards');
        if (rewardsEl) {
            rewardsEl.innerHTML = `+${xpEarned} XP<br>+${mmEarned} Monkey Money`;
        }
    },
    
    pauseGame() { if (this.gameState !== 'playing') return; this.gameState = 'paused'; UI.showPause(); },
    resumeGame() { if (this.gameState !== 'paused') return; this.gameState = 'playing'; UI.hidePause(); },
    toggleMenus(menuId) { UI.toggleMenus(menuId); },
    
    handleCanvasClick(e) {
        if (this.gameState !== 'playing') return; 
        const rect = this.canvas.getBoundingClientRect(); const scaleX = this.canvas.width / rect.width; const scaleY = this.canvas.height / rect.height; const x = (e.clientX - rect.left) * scaleX, y = (e.clientY - rect.top) * scaleY;
        
        if (this.hero && this.hero.isHollowCharging) {
            this.hero.isHollowCharging = false;
            this.hero.hollowProjectile = { x: this.hero.x, y: this.hero.y, angle: Utils.angle(this.hero.x, this.hero.y, x, y), hitEnemies: new Set() };
            return; 
        }

        let clickedTower = null; 
        for (let t of this.towers) { if (t && Utils.distance(x, y, t.x, t.y) < (t.hitRadius + 5)) { clickedTower = t; break; } }
        if (clickedTower) {
            this.deselectAll(); this.selectedPlacedTower = clickedTower; UI.showUpgradeUI(this.selectedPlacedTower, this); return; 
        }
        if (this.selectedTowerType) { 
            const stats = TowerStats[this.selectedTowerType] || HeroStats[this.selectedTowerType];
            const cost = this.getCost(stats.cost);
            if (this.cash >= cost) { 
                let isOverlapping = false; let placementRadius = stats.hitRadius || 18;
                for (let t of this.towers) { if (t && Utils.distance(x, y, t.x, t.y) < (t.hitRadius + placementRadius)) { isOverlapping = true; break; } }
                if (!isOverlapping) {
                    let canPlace = false;
                    if (stats.waterOnly) { for (let p of this.map.props) { if (p.type === 'pond' && Utils.distance(x, y, p.x, p.y) < 25) canPlace = true; } } 
                    else { if (!this.map.isOnPath(x, y) && !this.map.isOnProp(x, y) && y < 600 && x < 720) canPlace = true; }
                    if (canPlace) {
                        if (stats.isHero && this.hero) { this.log("You can only place one Hero per game!"); return; }
                        let newTower = stats.isHero ? new Hero(x, y, this.selectedTowerType) : new Tower(x, y, this.selectedTowerType);
                        if (stats.isHero) this.hero = newTower;
                        this.towers.push(newTower); 
                        this.cash -= cost; AudioEngine.playSfx('place'); this.updateUI(); this.log("Tower placed!"); 
                        this.deselectAll();
                    } else { this.log(stats.waterOnly ? "Must be placed on water!" : "Cannot place here!"); }
                } else { this.log("Cannot place on top of another monkey!"); }
            } else { this.log("Not enough cash!"); } 
        }
    },

    cycleTargeting() { if (!this.selectedPlacedTower) return; const t = this.selectedPlacedTower; let idx = TargetingModes.indexOf(t.targetingMode); idx = (idx + 1) % TargetingModes.length; t.targetingMode = TargetingModes[idx]; UI.showUpgradeUI(this.selectedPlacedTower, this); },
    
    handleUpgrade(path) { 
        if (!this.selectedPlacedTower) return; const t = this.selectedPlacedTower; const tier = t.upgrades[path - 1]; const upgradeData = Upgrades[t.type][path][tier]; 
        if (!upgradeData) { this.log("Max upgrades reached!"); return; } 
        if (!t.canUpgrade(path)) { this.log("Upgrade locked by crosspath or global limit!"); return; }
        let cost = this.getCost(upgradeData.cost);
        if (this.cash < cost) { this.log("Not enough cash!"); return; } 
        t.upgrade(path); UI.showUpgradeUI(this.selectedPlacedTower, this); 
    },

    buyHeroLevel() {
        if (this.selectedPlacedTower && this.selectedPlacedTower.stats.isHero) {
            this.selectedPlacedTower.buyLevel(); UI.showUpgradeUI(this.selectedPlacedTower, this);
        }
    },

    activateAbility(slot = 1, t = null) {
        if (!t) t = this.selectedPlacedTower;
        if (!t) return;
        const behavior = TowerRegistry[t.type] || HeroRegistry[t.type];
        if (!behavior) return;

        if (slot === 1 && t.stats.isAbility && t.abilityCooldown <= 0 && behavior.ability) {
            behavior.ability(t, this);
            t.abilityCooldown = t.stats.isHero ? (t.stats.rapidShotMult ? t.stats.rapidShotCd || 60 : 40) : (t.stats.abilityCd || 45);
            return;
        }
        if (slot === 2 && t.stats.isAbility2 && t.ability2Cooldown <= 0 && behavior.ability2) {
            behavior.ability2(t, this);
            t.ability2Cooldown = t.stats.isHero ? (t.stats.stormCd || 70) : 60;
            return;
        }
        if (slot === 3 && t.stats.isAbility3 && t.ability3Cooldown <= 0 && behavior.ability3) {
            behavior.ability3(t, this);
            t.ability3Cooldown = t.stats.isHero ? 120 : 60;
            return;
        }
    },
    
    sellTower() { 
        if (!this.selectedPlacedTower) return; 
        if (this.difficulty && this.difficulty.noSelling) { this.log("Cannot sell in CHIMPS mode!"); return; }
        if (this.selectedPlacedTower.stats.isHero) { this.hero = null; }
        this.selectedPlacedTower.sell(); const idx = this.towers.indexOf(this.selectedPlacedTower); if (idx > -1) this.towers.splice(idx, 1); this.deselectAll(); 
    },
    deselectAll() { this.selectedTowerType = null; this.selectedPlacedTower = null; UI.hideUpgradePanel(); },
    
    spawnPopEffect(x, y, color) { 
        if (this.particlePool.active.length > 400) return; 
        if (this.enemies.length > 600 && Math.random() > 0.2) return; 
        let p = this.particlePool.get();
        p.init(x, y, color);
    },
    log(msg) { UI.log(msg); },
    
    updateUI() {
        if (this.lastLives !== this.lives) { UI.updateLives(this.lives); this.lastLives = this.lives; }
        if (this.lastCash !== this.cash) { UI.updateCash(this.cash, this); this.lastCash = this.cash; }
        UI.updateWave(this.waveManager.currentWave);
    },

    loop(timestamp) { 
        try {
            const rawDt = (timestamp - this.lastTime) / 1000; 
            this.lastTime = timestamp; this.frames++;
            if (timestamp > this.lastFpsUpdate + 1000) {
                this.fps = this.frames; this.lastFpsUpdate = timestamp; this.frames = 0;
                const fpsEl = document.getElementById('fps-display'); if (fpsEl) fpsEl.innerText = `${this.fps} FPS`;
            }
            if (this.gameState === 'playing') { 
                const targetDt = Math.min(rawDt, 0.1) * this.timeScale; 
                const steps = Math.ceil(targetDt / 0.016); const stepDt = targetDt / steps; 
                for (let i = 0; i < steps; i++) this.update(stepDt); 
            } 
            Renderer.render(this); 
            if (!document.hidden) {
                if (this._rafId) cancelAnimationFrame(this._rafId);
                this._rafId = requestAnimationFrame(this._boundLoop); 
            }
        } catch (err) {
            console.error("FATAL GAME LOOP ERROR:", err);
            this.gameState = 'gameover'; UI.toggleMenus('game-over-menu');
            document.getElementById('go-wave-stat').innerText = `Game Crash: ${err.message}.`;
        }
    },
    
    update(dt) { 
        if (this.projectilePool.active.length > 1500) this.projectilePool.removeAt(0);
        if (this.particlePool.active.length > 400) this.particlePool.removeAt(0);
        if (this.explosions.length > 100) this.explosions.splice(0, this.explosions.length - 100);

        this.waveManager.update(dt); 
        
        if (this.acidPools) {
            for (let i = this.acidPools.length - 1; i >= 0; i--) {
                let pool = this.acidPools[i];
                pool.life -= dt; pool.tick -= dt;
                if (pool.life <= 0) { this.acidPools.splice(i, 1); continue; }
                if (pool.tick <= 0) {
                    pool.tick = 1.0;
                    const nearby = this.enemyGrid.query(pool.x, pool.y, pool.radius);
                    for (let e of nearby) {
                        if (e.alive && Utils.distance(pool.x, pool.y, e.x, e.y) < pool.radius) e.takeDamage(pool.dmg, { isAcid: true, canHitLead: true });
                    }
                }
            }
        }
        
        for (let i = this.enemies.length - 1; i >= 0; i--) { 
            let e = this.enemies[i];
            if (e) {
                e.update(dt); 
                if (!e.alive) { let last = this.enemies.pop(); if (i < this.enemies.length) { this.enemies[i] = last; } }
            }
        } 
        this.enemyGrid.clear();
        for (const e of this.enemies) this.enemyGrid.insert(e);
        
        for (let t of this.towers) { if (t) { t.buffedRange = 0; t.buffedFireRate = 0; t.buffedCamo = false; t.buffedLead = false; t.discount = 0; t.buffedDmg = 0; t.buffedPierce = 0; } }
        this.towers.forEach(t => { if (!t) return; const behavior = TowerRegistry[t.type]; if (behavior && behavior.updateSupport) behavior.updateSupport(t, dt); });
        this.towers.forEach(t => { if (t) t.update(dt); }); 
        
        if (this.mouse.x !== undefined) {
            for (let t of this.towers) {
                if (t && t.bananas) {
                    for (let i = t.bananas.length - 1; i >= 0; i--) {
                        let b = t.bananas[i];
                        if (b.progress >= 1) { 
                            let dist = Utils.distance(this.mouse.x, this.mouse.y, b.x, b.y);
                            let range = t.stats.collectionRange || 40;
                            if (dist < range) {
                                let speed = 500 * dt;
                                let dx = this.mouse.x - b.x; let dy = this.mouse.y - b.y;
                                let d = Math.hypot(dx, dy) || 1;
                                b.x += (dx / d) * speed; b.y += (dy / d) * speed;
                                if (d < 15) {
                                    this.addCash(b.value); 
                                    t.cashGenerated = (t.cashGenerated || 0) + b.value;
                                    AudioEngine.playSfx('cash'); t.bananas.splice(i, 1);
                                }
                            }
                        }
                    }
                }
            }
        }
        
        let activeProjectiles = this.projectilePool.active;
        for (let i = activeProjectiles.length - 1; i >= 0; i--) { 
            let p = activeProjectiles[i];
            if (p) {
                p.update(dt); 
                if (!p.alive) this.projectilePool.removeAt(i); 
            }
        } 

        for (let i = this.explosions.length - 1; i >= 0; i--) { 
            let exp = this.explosions[i]; 
            if (exp) {
                exp.life -= dt; if (exp.maxLife > 0) { exp.radius = (1 - exp.life / exp.maxLife) * (exp.maxRadius || 0); }
                if (exp.life <= 0) { let last = this.explosions.pop(); if (i < this.explosions.length) { this.explosions[i] = last; } } 
            }
        } 

        let activeParticles = this.particlePool.active;
        for (let i = activeParticles.length - 1; i >= 0; i--) { 
            let pt = activeParticles[i];
            if (pt) {
                pt.update(dt); 
                if (pt.life <= 0) this.particlePool.removeAt(i); 
            }
        } 

        UI.updateAbilityBar(this);
        this.updateUI();
        if (this.lives <= 0) { 
            AudioEngine.pause(); this.gameState = 'gameover'; 
            this.giveRewards(); // PRO FEATURE: Give Meta rewards!
            UI.toggleMenus('game-over-menu'); 
            document.getElementById('go-wave-stat').innerText = `You survived to Wave ${this.waveManager.currentWave}`; 
        } 
    }
};