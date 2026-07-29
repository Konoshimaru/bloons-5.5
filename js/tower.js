// js/tower.js
import { TowerStats, Upgrades, TowerRegistry } from './towers/index.js';
import { HeroStats, HeroRegistry } from './heroes/index.js';
import { GameEngine } from './engine.js'; 
import { Utils } from './utils.js';
import Assets from './assets.js';
import * as TowerBehavior from './towerBehavior.js';
import { GLOBAL_SCALE } from './constants.js';
import { RANGE_SCALE } from './config.js'; 
import { getBehavior } from './registry.js'; 
import { MKEffects } from './monkeyKnowledgeEffects.js';

// FIX: Import the extracted modules
import TowerRenderer from './towerRenderer.js';
import TowerEconomy from './towerEconomy.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

const DEFAULT_HIT_RADIUS = 18;
const MIN_FIRE_RATE = 0.05;

export class Tower {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        
        this.stats = { ...(TowerStats[type] || HeroStats[type]) };
        
        this._initializeState();
        this._recalculateStats();
    }

    _initializeState() {
        this.cooldown = 0;
        this.angle = -Math.PI / 2;
        this.upgrades = [0, 0, 0];
        this.hitscans = [];
        this.bananas = [];
        this.targetingMode = 'First';
        this.targetingMode2 = 'Last'; // FIX: Default second arm to Last for Robo Monkey
        
        this.stats.canSeeCamo = this.stats.canSeeCamo || false;
        this.stats.canHitLead = this.stats.canHitLead || false;
        
        this.bananasSpawnedThisWave = 0;
        this.lastWave = 0;
        this.bananaTimer = 0;
        this.damageDealt = 0;
        this.cashGenerated = 0;
        this.totalSpent = (TowerStats[this.type] || HeroStats[this.type]).cost;
        this.bankBalance = 0;
        
        this.buffedRange = 0;
        this.buffedFireRate = 0;
        this.buffedCamo = false;
        this.buffedLead = false;
        this.buffedDmg = 0;
        this.buffedPierce = 0;
        this.discount = 0;
        
        this.abilityCooldown = 0;
        this.fanClubBuffTimer = 0;
        this.fanClubType = null;
        this.animTimer = 0;
        this.animFrame = 0;
        this.hitRadius = (this.stats.hitRadius || DEFAULT_HIT_RADIUS) * GS;
        this._losBlockers = null;
        
        // FIX: Footprint system initialization
        this.blocksPlacement = this.stats.blocksPlacement !== false;
        
        this.attackAnimActive = false;
        this.attackAnimFrame = 0;
        this.attackAnimTimer = 0;
        this.attackPointTimer = 0;
        this.pendingTarget = null;
        this.isFullAnim = false;
        this.attackPrefix = `tower_${this.type}_`;
        
        this.sentries = [];
        this.sentryCooldown = 0;
        this.overclockTimer = 0;
        this.ultraboostStacks = 0;
        this.activeTrap = null;
        
        this.abilityActiveTime = 0;
        this.ability2Cooldown = 0;
        this.ability3Cooldown = 0;
        this.alchBuff = null;
        this.alchDip = null;
        
        this._nightGlowGradient = null;
        this._nightGlowRadius = 0;
        this._nightGlowX = 0;
        this._nightGlowY = 0;

        this.activeBuffs = [];

        // FIX: Beast Handler Minion System properties
        this.isMinion = false;
        this.parentTower = null;
        this.beastPower = 0;
        this.maxBeastPower = 0;
        this.beastTier = 0;
        this.beastPath = -1;
        this.activeBeast = null;

        // FIX: Apply base MK effects generically
        const mk = GameEngine.config.data.mkActive === false ? {} : (GameEngine.config.data.monkeyKnowledge || {});
        this._applyMKEffects(mk, MKEffects.base, GameEngine);
    }

    addBuff(id, name, duration, stacks = 1, data = {}, addStacks = true) {
        let existingBuff = this.activeBuffs.find(b => b.id === id);
        if (existingBuff) {
            if (addStacks) existingBuff.stacks += stacks;
            existingBuff.duration = Math.max(existingBuff.duration, duration);
            if (existingBuff.data.type !== data.type) {
                existingBuff.data = data;
            }
        } else {
            this.activeBuffs.push({ id, name, duration, stacks, data });
        }
    }

    update(dt, engine) {
        TowerBehavior.update(this, dt, engine);
    }

    _recalculateStats() {
        this._baseCooldown = this.stats.baseCooldown || this.stats.fireRate;
        this._cooldownMult = 1.0;
        
        for (let p = 0; p < 3; p++) {
            const tier = this.upgrades[p];
            for (let t = 0; t < tier; t++) {
                const upgradeData = Upgrades[this.type][p + 1][t];
                if (upgradeData && upgradeData.cooldownMult) {
                    this._cooldownMult *= upgradeData.cooldownMult;
                }
            }
        }

        // FIX: Apply cooldown and tier MK effects generically
        const mk = GameEngine.config.data.mkActive === false ? {} : (GameEngine.config.data.monkeyKnowledge || {});
        this._applyMKEffects(mk, MKEffects.cooldown, GameEngine);
        this._applyMKEffects(mk, MKEffects.tier, GameEngine);
    }

    // FIX: Generic MK application loop
    _applyMKEffects(mk, effectList, engine) {
        for (const eff of effectList) {
            if (!mk[eff.id]) continue;
            // Check if it applies to this tower type or if it's a hero perk and this is a hero
            if (eff.type && !eff.type.includes(this.type) && !(this.stats.isHero && eff.hero)) continue;
            if (eff.condition && !eff.condition(this, engine)) continue;

            if (eff.action) {
                eff.action(this);
            } else if (eff.stat) {
                if (eff.mode === 'mult') {
                    this.stats[eff.stat] = (this.stats[eff.stat] || 1) * eff.amount;
                } else if (typeof eff.amount === 'number') {
                    this.stats[eff.stat] = (this.stats[eff.stat] || 0) + eff.amount;
                } else {
                    this.stats[eff.stat] = eff.amount;
                }
            }
        }
    }

    _applyUpgradeStats(upgradeData) {
        if (!upgradeData) return;
        if (upgradeData.stat) {
            if (typeof upgradeData.amount === 'number') {
                this.stats[upgradeData.stat] = (this.stats[upgradeData.stat] || 0) + upgradeData.amount;
            } else {
                this.stats[upgradeData.stat] = upgradeData.amount;
            }
        }
        
        // FIX: Prevent extraMods from buffing the Beast Handler itself. Beast Handler stats are handled in beast.js.
        if (upgradeData.extraMods && this.type !== 'beast') {
            for (const key in upgradeData.extraMods) {
                const val = upgradeData.extraMods[key];
                if (key === 'scale') this.stats.scale = val;
                else if (key === 'unlocksAbility') { this.stats.isAbility = true; this.abilityCooldown = (this.stats.abilityCd || 45) * (2 / 3); }
                else if (key === 'abilityName') this.stats.abilityName = val;
                else if (key === 'abilityCd') this.stats.abilityCd = val;
                else if (typeof val === 'number') this.stats[key] = (this.stats[key] || 0) + val;
                else this.stats[key] = val;
            }
            if (upgradeData.extraMods.scale) {
                this.hitRadius = (TowerStats[this.type].hitRadius || DEFAULT_HIT_RADIUS) * upgradeData.extraMods.scale * GS;
            }
            // FIX: Allow dynamic footprint changes (e.g. Sun Temple)
            if (upgradeData.extraMods.footprint) {
                this.stats.footprint = upgradeData.extraMods.footprint;
            }
        }
    }

    applyUpgradesForLoad() {
        for (let p = 1; p <= 3; p++) {
            for (let tier = 0; tier < this.upgrades[p - 1]; tier++) {
                this._applyUpgradeStats(Upgrades[this.type][p][tier]);
            }
        }
        this._postUpgradeHook(3);
        this._recalculateStats();
    }

    _postUpgradeHook(path) {
        const behavior = getBehavior(this.type);
        if (behavior && behavior.postUpgrade) {
            behavior.postUpgrade(this, path);
        }

        if (this.type === 'engineer' && this.upgrades[2] === 5 && this.activeTrap) {
            this.activeTrap.maxRbe = this.stats.trapRbe;
            this.activeTrap.moab = this.stats.trapMoab;
        }
    }

    getActiveAssets() {
        let baseAsset = Assets.get(`tower_${this.type}_base`);
        let armAsset = Assets.get(`tower_${this.type}_arm`);
        const targetSize = (this.stats.drawSize || (45 * (this.stats.scale || 1.0))) * GS;
        let isCustomBase = false;

        let bestTier = 0, bestPath = 0;
        for (let p = 1; p <= 3; p++) {
            if (this.upgrades[p - 1] > bestTier) { bestTier = this.upgrades[p - 1]; bestPath = p; }
        }

        if (bestTier > 0) {
            const upgPrefix = `tower_${this.type}_p${bestPath}_t${bestTier}_`;
            const upgBase = Assets.get(`${upgPrefix}base`);
            const upgArm = Assets.get(`${upgPrefix}arm`);
            if (upgBase && upgBase.loaded) { baseAsset = upgBase; armAsset = null; isCustomBase = true; }
            if (upgArm && upgArm.loaded) armAsset = upgArm;
        }
        return { baseAsset, armAsset, targetSize, isCustomBase };
    }
}

// FIX: Merge extracted modules
Object.assign(Tower.prototype, TowerRenderer);
Object.assign(Tower.prototype, TowerEconomy);
Tower.drawPreview = TowerRenderer.drawPreview;