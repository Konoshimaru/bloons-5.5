// tower.js
// Defines the shared tower class and its upgrade logic.

import { TowerStats, Upgrades, TowerRegistry } from './towers/index.js';
import { HeroStats, HeroRegistry } from './heroes/index.js';
import { getBehavior } from './registry.js';
import { drawImageCentered, drawShadow } from './utils.js';
import Assets from './assets.js';
import { Names } from './names.js';
import { SpriteConfig } from './spriteConfig.js'; // Import custom offsets
import * as TowerBehavior from './towerBehavior.js';

const FARM_VILLAGE_TYPES = new Set(['farm', 'village']);
const DEFAULT_HIT_RADIUS = 18;
const SHADOW_SCALE = 22;
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
        this.hitRadius = this.stats.hitRadius || DEFAULT_HIT_RADIUS;
        this._losBlockers = null;
        
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

        if (upgradeData.extraMods) {
            for (const key in upgradeData.extraMods) {
                const val = upgradeData.extraMods[key];
                if (key === 'scale') {
                    this.stats.scale = val;
                } else if (key === 'unlocksAbility') {
                    this.stats.isAbility = true;
                    const cd = this.stats.abilityCd || 45;
                    this.abilityCooldown = cd * (2 / 3);
                } else if (key === 'abilityName') {
                    this.stats.abilityName = val;
                } else if (key === 'abilityCd') {
                    this.stats.abilityCd = val;
                } else if (typeof val === 'number') {
                    this.stats[key] = (this.stats[key] || 0) + val;
                } else {
                    this.stats[key] = val;
                }
            }
            if (upgradeData.extraMods.scale) {
                this.hitRadius = (TowerStats[this.type].hitRadius || DEFAULT_HIT_RADIUS) * upgradeData.extraMods.scale;
            }
        }
    }

    applyUpgradesForLoad() {
        for (let p = 1; p <= 3; p++) {
            for (let tier = 0; tier < this.upgrades[p - 1]; tier++) {
                const upgradeData = Upgrades[this.type][p][tier];
                this._applyUpgradeStats(upgradeData);
            }
        }
        this._postUpgradeHook(3);
        this._recalculateStats();
    }

    _postUpgradeHook(path) {
        if (this.type === 'engineer' && this.upgrades[2] === 5 && this.activeTrap) {
            this.activeTrap.maxRbe = this.stats.trapRbe;
            this.activeTrap.moab = this.stats.trapMoab;
        }
    }

    getActiveAssets() {
        let baseAsset = Assets.get(`tower_${this.type}_base`);
        let armAsset = Assets.get(`tower_${this.type}_arm`);
        const targetSize = this.stats.drawSize || (45 * (this.stats.scale || 1.0));
        let isCustomBase = false;

        let bestTier = 0, bestPath = 0;
        for (let p = 1; p <= 3; p++) {
            if (this.upgrades[p - 1] > bestTier) {
                bestTier = this.upgrades[p - 1];
                bestPath = p;
            }
        }

        if (bestTier > 0) {
            const upgPrefix = `tower_${this.type}_p${bestPath}_t${bestTier}_`;
            const upgBase = Assets.get(`${upgPrefix}base`);
            const upgArm = Assets.get(`${upgPrefix}arm`);
            if (upgBase && upgBase.loaded) {
                baseAsset = upgBase;
                armAsset = null;
                isCustomBase = true;
            }
            if (upgArm && upgArm.loaded) {
                armAsset = upgArm;
            }
        }

        return { baseAsset, armAsset, targetSize, isCustomBase };
    }

    static drawPreview(ctx, x, y, type) {
        const asset = Assets.get(`tower_${type}_base`);
        if (asset && asset.loaded) {
            ctx.save();
            ctx.translate(x, y);
            drawImageCentered(ctx, asset, 45);
            ctx.restore();
        } else {
            ctx.fillStyle = '#795548';
            ctx.beginPath();
            ctx.arc(x, y, 15, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#D7BCA3';
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#795548';
            ctx.beginPath();
            ctx.arc(x - 12, y - 8, 5, 0, Math.PI * 2);
            ctx.arc(x + 12, y - 8, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    canUpgrade(path, engine) {
        const tier = this.upgrades[path - 1];
        if (tier >= 5) return false;
        
        const pathsStarted = this.upgrades.filter(u => u > 0).length;
        if (tier === 0 && pathsStarted >= 2) return false;
        
        for (let i = 0; i < 3; i++) {
            if (i !== path - 1 && this.upgrades[i] >= 3 && tier >= 2) return false;
        }
        
        if (tier === 4 && engine.tier5Bought?.[`${this.type}-${path}`]) return false;
        
        return true;
    }

    upgrade(path, engine) {
        const tier = this.upgrades[path - 1];
        const upgradeData = Upgrades[this.type][path][tier];
        if (!upgradeData) return false;

        let cost = engine.getCost(upgradeData.cost);
        if (this.discount > 0) cost = Math.floor(cost * (1 - this.discount));
        
        if (engine.cash < cost || !this.canUpgrade(path, engine)) return false;

        engine.cash -= cost;
        this.totalSpent += cost;
        this.upgrades[path - 1]++;
        
        this._applyUpgradeStats(upgradeData);
        this._recalculateStats();

        this._postUpgradeHook(path);

        if (this.stats.fireRate < MIN_FIRE_RATE && !this.stats.baseCooldown) {
            this.stats.fireRate = MIN_FIRE_RATE;
        }
        
        if (tier === 4) {
            engine.tier5Bought[`${this.type}-${path}`] = true;
        }

        engine.updateUI();
        return true;
    }

    sell(engine) {
        let resaleRate = 0.70;
        if (this.type === 'farm' && this.upgrades[2] >= 2) resaleRate = 0.80;
        
        engine.cash += Math.floor(this.totalSpent * resaleRate);
        
        for (let i = 0; i < 3; i++) {
            if (this.upgrades[i] === 5) {
                engine.tier5Bought[`${this.type}-${i + 1}`] = false;
            }
        }
        
        engine.updateUI();
    }

    draw(ctx, isPreview = false) {
        if (!isPreview) {
            drawShadow(ctx, this.x, this.y, SHADOW_SCALE * (this.stats.scale || 1.0));
        }
        
        this._drawHitscans(ctx);
        this._drawBananas(ctx);

        const behavior = getBehavior(this.type);
        if (behavior && behavior.draw) {
            behavior.draw(ctx, this, isPreview);
            return;
        }

        this._drawBaseTower(ctx, isPreview);
    }

    drawBaseTower(ctx, isPreview = false) {
        this._drawBaseTower(ctx, isPreview);
    }

    _drawHitscans(ctx) {
        for (const h of this.hitscans) {
            ctx.globalAlpha = h.life / 0.1;
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(h.x1, h.y1);
            ctx.lineTo(h.x2, h.y2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }

    _drawBananas(ctx) {
        const bananaAsset = Assets.get(Names.getBanana());
        for (const b of this.bananas) {
            ctx.globalAlpha = Math.min(1, b.life / 2);
            if (bananaAsset && bananaAsset.loaded) {
                const s = b.isCrate ? 40 : 25;
                ctx.drawImage(bananaAsset, b.x - s / 2, (b.y - b.arc) - s / 2, s, s);
            } else {
                ctx.fillStyle = '#f1c40f';
                ctx.beginPath();
                ctx.arc(b.x, b.y - b.arc, 4, Math.PI * 0.2, Math.PI * 1.2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
    }

    _drawBaseTower(ctx, isPreview = false) {
        if (FARM_VILLAGE_TYPES.has(this.type)) {
            this._drawFarmOrVillage(ctx);
            return;
        }

        const { baseAsset, armAsset, targetSize, isCustomBase } = this.getActiveAssets();
        const isStatic = this.stats.isStaticRotation || false;
        
        if (this._drawFullBodyAnimation(ctx, isStatic, targetSize, isCustomBase)) return;

        let activeArmAsset = armAsset;
        if (this.attackAnimActive && !this.isFullAnim) {
            const animAsset = Assets.get(`${this.attackPrefix}attack_${this.attackAnimFrame}`);
            if (animAsset && animAsset.loaded) {
                activeArmAsset = animAsset;
            }
        }

        if (baseAsset && baseAsset.loaded) {
            this._drawSprite(ctx, baseAsset, armAsset, activeArmAsset, targetSize, isStatic, isCustomBase);
            return;
        }

        this._drawFallbackSprite(ctx, isStatic);
    }

    // PRO FIX: Centralized asset drawing with config overrides
    // If a config exists for this asset, size becomes 45 * config.scale. Otherwise, it uses defaultSize.
    _drawAsset(ctx, asset, type, key, defaultSize) {
        if (!asset || !asset.loaded) return;
        const off = SpriteConfig[type]?.[key] || { x: 0, y: 0, scale: 1 };
        const size = SpriteConfig[type]?.[key] ? (45 * (off.scale || 1)) : defaultSize;
        
        const maxDim = Math.max(asset.width, asset.height);
        if (maxDim === 0) return;
        const scale = size / maxDim;
        const w = asset.width * scale;
        const h = asset.height * scale;
        
        ctx.drawImage(asset, -w / 2 + (off.x || 0), -h / 2 + (off.y || 0), w, h);
    }

    _drawFullBodyAnimation(ctx, isStatic, targetSize, isCustomBase) {
        if (!this.attackAnimActive || !this.isFullAnim) return false;
        
        const animAsset = Assets.get(`${this.attackPrefix}attack_full_${this.attackAnimFrame}`);
        if (!animAsset || !animAsset.loaded) return false;

        ctx.save();
        ctx.translate(this.x, this.y);
        if (!isStatic) ctx.rotate(this.angle + Math.PI / 2);
        
        this._drawAsset(ctx, animAsset, this.type, `attack_full_${this.attackAnimFrame}`, targetSize);
        
        ctx.restore();

        if (!isCustomBase) {
            ctx.save();
            ctx.translate(this.x, this.y);
            if (!isStatic) ctx.rotate(this.angle + Math.PI / 2);
            for (let p = 1; p <= 3; p++) {
                const t = this.upgrades[p - 1];
                if (t > 0) {
                    const ovAsset = Assets.get(`tower_${this.type}_p${p}_t${t}`);
                    if (ovAsset && ovAsset.loaded) {
                        const overlayId = `${this.type}_p${p}_t${t}`;
                        this._drawAsset(ctx, ovAsset, overlayId, "base", targetSize);
                    }
                }
            }
            ctx.restore();
        }
        return true;
    }

    _drawSprite(ctx, baseAsset, armAsset, activeArmAsset, targetSize, isStatic, isCustomBase) {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (!isStatic) ctx.rotate(this.angle + Math.PI / 2);
        
        if (armAsset && activeArmAsset && activeArmAsset.loaded) {
            let key = this.attackAnimFrame === 0 ? "arm" : `attack_${this.attackAnimFrame}`;
            this._drawAsset(ctx, activeArmAsset, this.type, key, targetSize);
        }
        
        if (!isCustomBase) {
            for (let p = 1; p <= 3; p++) {
                const t = this.upgrades[p - 1];
                if (t > 0) {
                    const ovAsset = Assets.get(`tower_${this.type}_p${p}_t${t}_a`);
                    if (ovAsset && ovAsset.loaded) {
                        const overlayId = `${this.type}_p${p}_t${t}`;
                        this._drawAsset(ctx, ovAsset, overlayId, "base", targetSize);
                    }
                }
            }
        }
        
        this._drawAsset(ctx, baseAsset, this.type, "base", targetSize);
        
        if (!isCustomBase) {
            for (let p = 1; p <= 3; p++) {
                const t = this.upgrades[p - 1];
                if (t > 0) {
                    const ovAsset = Assets.get(`tower_${this.type}_p${p}_t${t}`);
                    if (ovAsset && ovAsset.loaded) {
                        const overlayId = `${this.type}_p${p}_t${t}`;
                        this._drawAsset(ctx, ovAsset, overlayId, "base", targetSize);
                    }
                }
            }
        }
        ctx.restore();
    }

    _drawFarmOrVillage(ctx) {
        const asset = Assets.get(`tower_${this.type}_base`);
        
        if (this.type === 'village') {
            ctx.fillStyle = 'rgba(155, 89, 182, 0.1)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.stats.range, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(155, 89, 182, 0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.stats.range, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (asset && asset.loaded) {
            ctx.save();
            ctx.translate(this.x, this.y);
            drawImageCentered(ctx, asset, 45);
            for (let p = 1; p <= 3; p++) {
                const t = this.upgrades[p - 1];
                if (t > 0) {
                    const ovAsset = Assets.get(`tower_${this.type}_p${p}_t${t}`);
                    if (ovAsset && ovAsset.loaded) {
                        drawImageCentered(ctx, ovAsset, 45);
                    }
                }
            }
            ctx.restore();
        } else {
            if (this.type === 'farm') {
                ctx.fillStyle = '#8b6b3f';
                ctx.fillRect(this.x - 12, this.y - 2, 24, 16);
                ctx.fillStyle = '#795548';
                ctx.beginPath();
                ctx.moveTo(this.x - 14, this.y - 2);
                ctx.lineTo(this.x, this.y - 14);
                ctx.lineTo(this.x + 14, this.y - 2);
                ctx.fill();
                ctx.fillStyle = '#27ae60';
                ctx.beginPath();
                ctx.arc(this.x + 15, this.y - 10, 12, 0, Math.PI * 2);
                ctx.fill();
                if (this.stats.isBank) {
                    ctx.fillStyle = '#f1c40f';
                    ctx.font = '10px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('$', this.x, this.y + 10);
                }
            }
            if (this.type === 'village') {
                ctx.fillStyle = '#8e44ad';
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - 15);
                ctx.lineTo(this.x + 15, this.y + 10);
                ctx.lineTo(this.x - 15, this.y + 10);
                ctx.fill();
                ctx.fillStyle = '#f1c40f';
                ctx.beginPath();
                ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    _drawFallbackSprite(ctx, isStatic) {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (!isStatic) ctx.rotate(this.angle);
        
        const scale = this.stats.scale || 1.0;
        ctx.fillStyle = '#795548';
        ctx.beginPath();
        ctx.arc(0, 0, 15 * scale, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#D7BCA3';
        ctx.beginPath();
        ctx.arc(0, 0, 10 * scale, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#795548';
        ctx.beginPath();
        ctx.arc(-12, -8, 5, 0, Math.PI * 2);
        ctx.arc(12, -8, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}