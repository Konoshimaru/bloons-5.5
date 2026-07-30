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
import { applyBossEffects } from './input.js';
import { MKEffects } from './monkeyKnowledgeEffects.js';
import { getSellRate } from './towerEconomy.js'; 
import { GLOBAL_SCALE, GAME_AREA_WIDTH } from './constants.js';

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
        if (boss && boss.freezeMouse) return; 

        const rect = (window.InputManager && window.InputManager.canvasRect) ? window.InputManager.canvasRect : this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const rawX = (e.clientX - rect.left) * scaleX;
        const rawY = (e.clientY - rect.top) * scaleY;
        const adj = applyBossEffects(rawX, rawY);
        const x = adj.x;
        const y = adj.y;

        if (this.placingBeastFor) {
            const tower = this.placingBeastFor;
            this.placingBeastFor = null; 
            if (tower.beast) {
                const dist = Utils.distance(tower.x, tower.y, x, y);
                const effRange = Utils.getEffectiveRange(tower, this);
                if (dist <= effRange) {
                    const isOnWater = this.map.isInWater(x, y);
                    const isOnPath = this.map.isOnPath(x, y);
                    if (tower.beast.terrain === 'land' && (isOnWater || isOnPath)) this.log("Land beasts must be placed on land!");
                    else { tower.beast.x = x; tower.beast.y = y; this.log("Beast placed!"); }
                } else this.log("Placement out of range!");
            }
            return; 
        }

        if (this.isMergingBeast && this.mergeSourceTower) {
            let source = this.mergeSourceTower;
            this.isMergingBeast = false;
            this.mergeSourceTower = null;
            
            let targetTower = null;
            for (const t of this.towers) {
                if (t && Utils.pointInFootprint(x, y, t.x, t.y, Utils.getFootprint(t))) { targetTower = t; break; }
            }
            
            if (targetTower && targetTower !== source && targetTower.type === 'beast' && targetTower.beast) {
                if (targetTower.beast.terrain === source.beast.terrain && targetTower.beast.tier >= source.beast.tier) {
                    
                    if (source.beast.tier === 1) {
                        this.log("Tier 1 beasts cannot be merged!");
                        return;
                    }

                    let powerToTransfer = source.beast.beastPower;
                    let newPower = Math.min(targetTower.beast.data.maxPower, targetTower.beast.beastPower + powerToTransfer);
                    let actualTransferred = newPower - targetTower.beast.beastPower;
                    targetTower.beast.beastPower = newPower;
                    targetTower.beast.recalculateStats();
                    
                    source.beast.alive = false;
                    const bIdx = this.beasts.indexOf(source.beast);
                    if (bIdx > -1) this.beasts.splice(bIdx, 1);
                    source.beast = null;
                    source.hasBeast = false;
                    
                    if (this.selectedPlacedTower === source) this.deselectAll();
                    
                    this.log(`Merged ${actualTransferred} Beast Power!`);
                    this.updateUI();
                } else { this.log("Merge failed: Must target same beast type and equal/higher tier."); }
            } else { this.log("Merge cancelled."); }
            return; 
        }

        if (this.selectedPlacedTower && this.selectedPlacedTower.isPlacingTotem) {
            if (x < CANVAS_WIDTH && y < CANVAS_HEIGHT) {
                this.selectedPlacedTower.totemX = x;
                this.selectedPlacedTower.totemY = y;
                this.selectedPlacedTower.isPlacingTotem = false;
                this.log("Totem placed!");
            }
            return; 
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

        // FIX: Use generic pointInFootprint for selection
        for (const t of this.towers) {
            if (t && Utils.pointInFootprint(x, y, t.x, t.y, Utils.getFootprint(t))) {
                if (this.selectedPlacedTower === t) { this.deselectAll(); } 
                else { this.deselectAll(); this.selectedPlacedTower = t; UI.showUpgradeUI(t, this); }
                return;
            }
        }

        for (const s of this.sentries) {
            if (s && Utils.pointInFootprint(x, y, s.x, s.y, Utils.getFootprint(s))) {
                if (this.selectedPlacedTower === s) { this.deselectAll(); } 
                else { this.deselectAll(); this.selectedPlacedTower = s; UI.showUpgradeUI(s, this); }
                return;
            }
        }

        for (const b of this.beasts) {
            if (b && Utils.pointInFootprint(x, y, b.x, b.y, Utils.getFootprint(b))) {
                if (this.selectedPlacedTower === b) { this.deselectAll(); } 
                else { this.deselectAll(); this.selectedPlacedTower = b; UI.showUpgradeUI(b, this); }
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
                if (hasMonkeyCity && !this.freeDartMonkeyClaimed) { cost = 0; this._monkeyCityFreeDart = true; }
            }
            if (this.cash < cost) { this.log("Not enough cash!"); return; }
            
            // FIX: Use generic intersectsFootprint for placement overlap
            const newFp = Utils.getFootprint({ stats });
            const isOverlapping = this.towers.some(t => {
                if (!t || t.blocksPlacement === false) return false;
                return Utils.intersectsFootprint(x, y, newFp, t.x, t.y, Utils.getFootprint(t));
            });
            if (isOverlapping) { this.log("Cannot place on top of another monkey!"); return; }
            
            let canPlace = false;
            if (stats.waterOnly) { canPlace = this.map.isInWater(x, y); } 
            else if (stats.canPlaceOnWater) { canPlace = !this.map.isOnPath(x, y) && !this.map.isOnProp(x, y) && y < CANVAS_HEIGHT && x < GAME_AREA_WIDTH; } 
            else {
                const isOnFrozenWater = this.map.isOnFrozenWater(x, y, this.towers);
                canPlace = !this.map.isOnPath(x, y) && !this.map.isOnProp(x, y) && y < CANVAS_HEIGHT && x < GAME_AREA_WIDTH && (!this.map.isInWater(x, y) || isOnFrozenWater);
            }
            if (!canPlace) { this.log(stats.waterOnly ? "Must be placed on water!" : "Cannot place here!"); return; }
            if (stats.isHero && this.hero) { this.log("You can only place one Hero per game!"); return; }
            const newTower = stats.isHero ? new Hero(x, y, this.selectedTowerType) : new Tower(x, y, this.selectedTowerType);
            if (stats.isHero) this.hero = newTower;
            if (newTower.type === 'spike') newTower.targetingMode = 'Normal';
            if (newTower.type === 'village') newTower.targetingMode = 'First';
            this.towers.push(newTower); this.cash -= cost; AudioEngine.playSfx('place');
            if (this._monkeyCityFreeDart) { this.freeDartMonkeyClaimed = true; this._monkeyCityFreeDart = false; this.log("Monkey City: Free Dart Monkey placed!"); }
            this.updateUI(); this.log("Tower placed!"); this.deselectAll(); 
            if (this.updateShopPrices) this.updateShopPrices();
            return; 
        }
        this.deselectAll();
    },

    cycleTargeting(direction = 1, arm = 1) {
        if (!this.selectedPlacedTower) return;
        const t = this.selectedPlacedTower;
        if (t.stats.isHero) return;
        if (t.isMinion && t.type !== 'sentry' && t.type !== 'beast') return;
        
        let modes = ['First', 'Last', 'Strong', 'Close'];
        if (t.stats.unlocksElite) { modes.push('Elite'); }
        if (t.type === 'spike') { modes = t.stats.smartSpikes ? ['Normal', 'Close', 'Smart'] : ['Normal']; }
        if (t.type === 'village') { if (t.upgrades[0] < 5) return; modes = ['First', 'Last', 'Strong', 'Close']; }
        
        // FIX: Ace ONLY has flight path targeting options!
        if (t.type === 'ace') { 
            modes = ['Circle', 'Figure Infinite', 'Figure Eight']; 
            if (t.upgrades[2] >= 2) modes.push('Centered Path'); 
            if (!modes.includes(t.targetingMode)) t.targetingMode = 'Circle'; // Force valid mode
        }

        const modeKey = arm === 2 ? 'targetingMode2' : 'targetingMode';
        let currentMode = t[modeKey] || modes[0];
        let idx = modes.indexOf(currentMode);
        if (idx === -1) idx = 0; 
        idx = (idx + direction + modes.length) % modes.length; 
        t[modeKey] = modes[idx];
        UI.showUpgradeUI(t, this);
    },

    handleUpgrade(path) {
        if (!this.selectedPlacedTower) return;
        const t = this.selectedPlacedTower;
        if (t.stats.isHero || t.isMinion) return;
        
        const behavior = getBehavior(t.type);
        // FIX: Let the tower module run pre-upgrade checks (e.g. Beast Handler water check)
        if (behavior?.preUpgrade && !behavior.preUpgrade(t, path, this)) return;
        
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
        
        let actualTower = t;
        // FIX: Let the tower module decide which entity the ability targets (e.g. Beast Handler targets its Beast)
        if (behavior.getAbilityTarget) {
            actualTower = behavior.getAbilityTarget(t, slot) || t;
        }

        const mk = Config.data.mkActive === false ? {} : (Config.data.monkeyKnowledge || {});
        let cdMult = 1.0;
        for (const eff of MKEffects.abilityCooldown) {
            if (!mk[eff.id]) continue;
            if (eff.hero && !t.stats.isHero) continue;
            if (eff.condition && !eff.condition(t, slot)) continue;
            if (eff.stat === 'cdMult') cdMult *= eff.amount;
        }
        if (t.abilityCdMult) cdMult *= t.abilityCdMult;

        if (slot === 1 && actualTower.stats.isAbility && actualTower.abilityCooldown <= 0 && behavior.ability) {
            behavior.ability(actualTower, this);
            let cd = actualTower.stats.abilityCd || 45;
            actualTower.abilityCooldown = cd * cdMult; return;
        }
        if (slot === 2 && actualTower.stats.isAbility2 && actualTower.ability2Cooldown <= 0 && behavior.ability2) {
            behavior.ability2(actualTower, this); 
            let cd = actualTower.stats.isHero ? (actualTower.stats.stormCd || 70) : 60;
            actualTower.ability2Cooldown = cd * cdMult; return;
        }
        if (slot === 3 && actualTower.stats.isAbility3 && actualTower.ability3Cooldown <= 0 && behavior.ability3) {
            behavior.ability3(actualTower, this); 
            let cd = actualTower.stats.isHero ? 120 : 60;
            actualTower.ability3Cooldown = cd * cdMult; return;
        }
    },

    sellTower() {
        if (!this.selectedPlacedTower) return;
        if (this.selectedPlacedTower.isMinion) return;
        if (this.difficulty && this.difficulty.noSelling) { this.log("Cannot sell in CHIMPS mode!"); return; }
        if (this.selectedPlacedTower.stats.isHero) this.hero = null;
        
        const behavior = getBehavior(this.selectedPlacedTower.type);
        // FIX: Let the tower module clean up its sub-entities (e.g. Sentries, Beasts)
        if (behavior?.onSell) behavior.onSell(this.selectedPlacedTower, this);
        
        this.selectedPlacedTower.sell(this);
        const idx = this.towers.indexOf(this.selectedPlacedTower);
        if (idx > -1) this.towers.splice(idx, 1);
        this.deselectAll();
    },

    deselectAll() {
        this.selectedTowerType = null; this.selectedPlacedTower = null;
        this.placingBeastFor = null; this.isMergingBeast = false; this.mergeSourceTower = null;
        UI.hideUpgradePanel();
        const cancelBtn = document.getElementById('cancel-btn');
        if (cancelBtn) cancelBtn.classList.add('hidden');
    }
};