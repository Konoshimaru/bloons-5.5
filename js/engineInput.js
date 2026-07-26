// js/engineInput.js
import { Config, CANVAS_WIDTH, CANVAS_HEIGHT } from './config.js';
import { TowerStats, Upgrades } from './towers/index.js';
import { HeroStats } from './heroes/index.js';
import { getBehavior } from './registry.js';
import { Utils } from './utils.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { Tower } from './tower.js';
import { Hero } from './hero.js';
import { GLOBAL_SCALE } from './constants.js';
import { applyBossEffects } from './input.js';
import { MKEffects } from './monkeyKnowledgeEffects.js';

const MAX_SPEED_NORMAL = 3;
const MAX_SPEED_EXTREME = 6;
const SPEED_MULTIPLIERS = [1, 1, 2, 3, 5, 10, 20];

export default {
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

    handleCanvasClick(e) {
        const boss = this.enemies.find(en => en.tier === 99);
        if (boss && boss.freezeMouse) {
            return; 
        }

        const rect = (window.InputManager && window.InputManager.canvasRect) ? window.InputManager.canvasRect : this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const rawX = (e.clientX - rect.left) * scaleX;
        const rawY = (e.clientY - rect.top) * scaleY;

        const adj = applyBossEffects(rawX, rawY);
        const x = adj.x;
        const y = adj.y;

        // FIX: Intercept click to place Mermonkey Totem
        if (this.selectedPlacedTower && this.selectedPlacedTower.isPlacingTotem) {
            if (x < CANVAS_WIDTH && y < CANVAS_HEIGHT) {
                this.selectedPlacedTower.totemX = x;
                this.selectedPlacedTower.totemY = y;
                this.selectedPlacedTower.isPlacingTotem = false;
                this.log("Totem placed!");
            }
            return; // Prevent placing towers or deselecting
        }

        if (this.gameState === 'menu') {
            for (let i = this.menuClickables.length - 1; i >= 0; i--) {
                let item = this.menuClickables[i];
                if (Utils.withinRange(x, y, item.x, item.y, item.r + 10)) {
                    this.menuClickables.splice(i, 1);
                    Config.data.monkeyMoney += 1; Config.save();
                    UI.updateMetaStats(); this.log("You caught a banana! +1 Monkey Money"); return;
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
            
            this._monkeyCityFreeDart = false; 
            
            for (const eff of MKEffects.towerPlacement) {
                if (!mk[eff.id] && !eff.alwaysActive) continue;
                if (eff.type && !eff.type.includes(this.selectedTowerType)) continue;
                if (eff.condition && !eff.condition(this, this.selectedTowerType)) continue;
                if (eff.action) cost = eff.action(cost);
            }

            if (this.selectedTowerType === 'dart' && !this.isSandbox && this.difficulty && !this.difficulty.noSelling) {
                const hasMonkeyCity = this.towers.some(t => t && t.type === 'village' && t.upgrades[2] >= 4);
                if (hasMonkeyCity && !this.freeDartMonkeyClaimed) {
                    cost = 0;
                    this._monkeyCityFreeDart = true;
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
            if (newTower.type === 'village') newTower.targetingMode = 'First';
            this.towers.push(newTower); this.cash -= cost; AudioEngine.playSfx('place');
            
            if (this._monkeyCityFreeDart) {
                this.freeDartMonkeyClaimed = true;
                this._monkeyCityFreeDart = false;
                this.log("Monkey City: Free Dart Monkey placed!");
            }
            
            this.updateUI(); this.log("Tower placed!"); this.deselectAll(); 
            
            if (this.updateShopPrices) this.updateShopPrices();
            return; 
        }
        this.deselectAll();
    },

    cycleTargeting(direction = 1, arm = 1) {
        if (!this.selectedPlacedTower) return;
        const t = this.selectedPlacedTower;
        let modes = ['First', 'Last', 'Strong', 'Close'];
        if (t.stats.unlocksElite) { modes.push('Elite'); }
        if (t.type === 'spike') { modes = t.stats.smartSpikes ? ['Normal', 'Close', 'Smart'] : ['Normal']; }
        if (t.type === 'village') { 
            if (t.upgrades[0] < 5) return; 
            modes = ['First', 'Last', 'Strong', 'Close']; 
        }
        
        const modeKey = arm === 2 ? 'targetingMode2' : 'targetingMode';
        let currentMode = t[modeKey] || 'First';
        
        let idx = modes.indexOf(currentMode);
        if (idx === -1) idx = 0; 
        idx = (idx + direction + modes.length) % modes.length; 
        t[modeKey] = modes[idx];
        
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
        
        for (const eff of MKEffects.abilityCooldown) {
            if (!mk[eff.id]) continue;
            if (eff.hero && !t.stats.isHero) continue;
            if (eff.condition && !eff.condition(t, slot)) continue;
            if (eff.stat === 'cdMult') cdMult *= eff.amount;
        }

        if (t.abilityCdMult) cdMult *= t.abilityCdMult;

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
    }
};