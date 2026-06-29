import { TowerStats, Upgrades, TowerRegistry } from './towers/index.js';
import { HeroStats, HeroRegistry } from './heroes/index.js';
import { drawImageCentered, drawShadow } from './utils.js';
import { GameEngine } from './engine.js';
import Assets from './assets.js';
import { Names } from './names.js';
import * as TowerBehavior from './towerBehavior.js'; 

export class Tower {
    constructor(x, y, type) { 
        this.x = x; this.y = y; this.type = type;
        this.stats = { ...(TowerStats[type] || HeroStats[type]) };
        this.cooldown = 0; this.angle = -Math.PI / 2; 
        this.upgrades = [0, 0, 0]; this.hitscans = []; this.bananas = []; this.targetingMode = 'First'; 
        this.stats.canSeeCamo = this.stats.canSeeCamo || false; this.stats.canHitLead = this.stats.canHitLead || false; 
        this.bananasSpawnedThisWave = 0; this.lastWave = 0; this.bananaTimer = 0;
        this.damageDealt = 0; this.cashGenerated = 0;
        this.totalSpent = (TowerStats[type] || HeroStats[type]).cost; 
        this.bankBalance = 0; 
        this.buffedRange = 0; this.buffedFireRate = 0; this.buffedCamo = false; this.buffedLead = false; 
        this.buffedDmg = 0; this.buffedPierce = 0; 
        this.discount = 0; 
        this.abilityCooldown = 0; this.fanClubBuffTimer = 0; this.fanClubType = null;
        this.animTimer = 0; this.animFrame = 0;
        this.hitRadius = this.stats.hitRadius || 18; 
        this._losBlockers = null; 
        
        this.attackAnimActive = false;
        this.attackAnimFrame = 0;
        this.attackAnimTimer = 0;
        this.attackPointTimer = 0;
        this.pendingTarget = null;
        this.isFullAnim = false; 
        this.attackPrefix = `tower_${type}_`;
        
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

    update(dt) {
        TowerBehavior.update(this, dt);
    }

    getActiveAssets() {
        let baseAsset = Assets.get(`tower_${this.type}_base`);
        let armAsset = Assets.get(`tower_${this.type}_arm`);
        let targetSize = this.stats.drawSize || (45 * (this.stats.scale || 1.0));
        let isCustomBase = false;

        let bestTier = 0, bestPath = 0;
        for (let p = 1; p <= 3; p++) {
            if (this.upgrades[p-1] > bestTier) { 
                bestTier = this.upgrades[p-1]; 
                bestPath = p; 
            }
        }

        if (bestTier > 0) {
            let upgBase = Assets.get(`tower_${this.type}_p${bestPath}_t${bestTier}_base`);
            let upgArm = Assets.get(`tower_${this.type}_p${bestPath}_t${bestTier}_arm`);
            if (upgBase && upgBase.loaded) { baseAsset = upgBase; armAsset = null; isCustomBase = true; }
            if (upgArm && upgArm.loaded) { armAsset = upgArm; }
        }

        return { baseAsset, armAsset, targetSize, isCustomBase };
    }

    static drawPreview(ctx, x, y, type) {
        const stats = TowerStats[type];
        let targetSize = stats?.drawSize || 45;
        const asset = Assets.get(`tower_${type}_base`);
        if (asset && asset.loaded) {
            ctx.save(); ctx.translate(x, y);
            drawImageCentered(ctx, asset, targetSize); 
            ctx.restore();
        } else {
            ctx.fillStyle = '#795548'; ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#D7BCA3'; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#795548'; ctx.beginPath(); ctx.arc(x - 12, y - 8, 5, 0, Math.PI * 2); ctx.arc(x + 12, y - 8, 5, 0, Math.PI * 2); ctx.fill();
        }
    }
    
    canUpgrade(path) {
        const tier = this.upgrades[path - 1];
        if (tier >= 5) return false;
        const pathsStarted = this.upgrades.filter(u => u > 0).length;
        const thisPathStarted = tier > 0;
        if (!thisPathStarted && pathsStarted >= 2) return false;
        let lockedByOtherPath = false;
        for(let i=0; i<3; i++) { if (i !== path - 1 && this.upgrades[i] >= 3 && tier >= 2) lockedByOtherPath = true; }
        if (lockedByOtherPath) return false;
        if (tier === 4 && GameEngine.tier5Bought[this.type + '-' + path]) return false;
        return true;
    }

    upgrade(path) { 
        const tier = this.upgrades[path - 1]; const upgradeData = Upgrades[this.type][path][tier]; 
        if (!upgradeData) return false; 
        
        let cost = GameEngine.getCost(upgradeData.cost);
        if (this.discount > 0) cost = Math.floor(cost * (1 - this.discount));        
        if (GameEngine.cash < cost || !this.canUpgrade(path)) return false; 
        GameEngine.cash -= cost; this.totalSpent += cost; 
        this.upgrades[path - 1]++; 
        if (upgradeData.stat) {
            if (typeof upgradeData.amount === 'number') {
                this.stats[upgradeData.stat] = (this.stats[upgradeData.stat] || 0) + upgradeData.amount;
            } else {
                this.stats[upgradeData.stat] = upgradeData.amount; 
            }
        }
        if (upgradeData.extraMods) {
            for (let key in upgradeData.extraMods) {
                let val = upgradeData.extraMods[key];
                if (key === 'scale') { this.stats.scale = val; }
                else if (key === 'unlocksAbility') {
                    this.stats.isAbility = true; 
                    let cd = this.stats.abilityCd || 45;
                    this.abilityCooldown = cd * (2 / 3); 
                }
                else if (key === 'abilityName') { this.stats.abilityName = val; }
                else if (key === 'abilityCd') { this.stats.abilityCd = val; }
                else if (typeof val === 'number') { this.stats[key] = (this.stats[key] || 0) + val; }
                else { this.stats[key] = val; }
            }
            if (upgradeData.extraMods.scale) {
                this.hitRadius = (TowerStats[this.type].hitRadius || 18) * upgradeData.extraMods.scale;
            }
        }
        
        // Engineer XXXL Trap logic
        if (this.type === 'engineer' && path === 3 && this.upgrades[2] === 5) {
            if (this.activeTrap) {
                this.activeTrap.maxRbe = 9500;
                this.activeTrap.moab = true;
            }
        }

        if (this.stats.fireRate < 0.05 && !this.stats.baseCooldown) this.stats.fireRate = 0.05; 
        if (tier === 4) { GameEngine.tier5Bought[this.type + '-' + path] = true; }
        GameEngine.updateUI(); return true; 
    }
    
    sell() { 
        let resaleRate = 0.70; 
        if (this.type === 'farm' && this.upgrades[2] >= 2) resaleRate = 0.80; 
        GameEngine.cash += Math.floor(this.totalSpent * resaleRate); 
        for(let i=0; i<3; i++) { if(this.upgrades[i] === 5) GameEngine.tier5Bought[this.type + '-' + (i+1)] = false; }
        GameEngine.updateUI(); 
    }
    
    draw(ctx, isPreview = false) {
        if (!isPreview) drawShadow(ctx, this.x, this.y, this.hitRadius * 1.2); 
        for (let h of this.hitscans) { ctx.globalAlpha = h.life / 0.1; ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(h.x1, h.y1); ctx.lineTo(h.x2, h.y2); ctx.stroke(); ctx.globalAlpha = 1; }
        
        const bananaAsset = Assets.get(Names.getBanana());
        for(let b of this.bananas) { 
            ctx.globalAlpha = Math.min(1, b.life / 2); 
            if (bananaAsset && bananaAsset.loaded) {
                let s = b.isCrate ? 40 : 25; 
                ctx.drawImage(bananaAsset, b.x - s/2, (b.y - b.arc) - s/2, s, s);
            } else {
                ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(b.x, b.y - b.arc, 4, Math.PI*0.2, Math.PI*1.2); ctx.fill(); 
            }
            ctx.globalAlpha = 1; 
        }

        const behavior = TowerRegistry[this.type];
        if (behavior && behavior.draw) { behavior.draw(ctx, this, isPreview); return; }
        const heroBehavior = HeroRegistry[this.type];
        if (heroBehavior && heroBehavior.draw) { heroBehavior.draw(ctx, this, isPreview); return; }
        this.drawBaseTower(ctx, isPreview);
    }

    drawBaseTower(ctx, isPreview = false) {
        if (this.type === 'farm' || this.type === 'village') {
            const asset = Assets.get(`tower_${this.type}_base`);
            if (this.type === 'village') {
                ctx.fillStyle = 'rgba(155, 89, 182, 0.1)'; ctx.beginPath(); ctx.arc(this.x, this.y, this.stats.range, 0, Math.PI*2); ctx.fill(); 
                ctx.strokeStyle = 'rgba(155, 89, 182, 0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.x, this.y, this.stats.range, 0, Math.PI*2); ctx.stroke();
            }
            if (asset && asset.loaded) {
                ctx.save(); ctx.translate(this.x, this.y);
                drawImageCentered(ctx, asset, 45);
                for (let p=1; p<=3; p++) {
                    let t = this.upgrades[p-1];
                    if (t > 0) {
                        let ovAsset = Assets.get(`tower_${this.type}_p${p}_t${t}`);
                        if (ovAsset && ovAsset.loaded) drawImageCentered(ctx, ovAsset, 45);
                    }
                }
                ctx.restore();
            } else {
                if (this.type === 'farm') { ctx.fillStyle = '#8b6b3f'; ctx.fillRect(this.x-12, this.y-2, 24, 16); ctx.fillStyle = '#795548'; ctx.beginPath(); ctx.moveTo(this.x-14, this.y-2); ctx.lineTo(this.x, this.y-14); ctx.lineTo(this.x+14, this.y-2); ctx.fill(); ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.arc(this.x+15, this.y-10, 12, 0, Math.PI*2); ctx.fill(); if(this.stats.isBank){ ctx.fillStyle = '#f1c40f'; ctx.font = '10px Arial'; ctx.textAlign = 'center'; ctx.fillText('$', this.x, this.y+10); } }
                if (this.type === 'village') { ctx.fillStyle = '#8e44ad'; ctx.beginPath(); ctx.moveTo(this.x, this.y-15); ctx.lineTo(this.x+15, this.y+10); ctx.lineTo(this.x-15, this.y+10); ctx.fill(); ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, Math.PI*2); ctx.fill(); }
            }
            return;
        }

        const { baseAsset, armAsset, targetSize, isCustomBase } = this.getActiveAssets();
        let isStatic = this.stats.isStaticRotation || false;
        
        if (this.attackAnimActive && this.isFullAnim) {
            let animAsset = Assets.get(`${this.attackPrefix}attack_full_${this.attackAnimFrame}`);
            if (animAsset && animAsset.loaded) {
                ctx.save(); ctx.translate(this.x, this.y); 
                if (!isStatic) ctx.rotate(this.angle + Math.PI / 2);
                drawImageCentered(ctx, animAsset, targetSize);
                ctx.restore();
                if (!isCustomBase) {
                    ctx.save(); ctx.translate(this.x, this.y);
                    for (let p=1; p<=3; p++) {
                        let t = this.upgrades[p-1];
                        if (t > 0) {
                            let ovAsset = Assets.get(`tower_${this.type}_p${p}_t${t}`);
                            if (ovAsset && ovAsset.loaded) drawImageCentered(ctx, ovAsset, targetSize);
                        }
                    }
                    ctx.restore();
                }
                return;
            }
        }

        let activeArmAsset = armAsset;
        if (this.attackAnimActive && !this.isFullAnim) {
            let animAsset = Assets.get(`${this.attackPrefix}attack_${this.attackAnimFrame}`);
            if (animAsset && animAsset.loaded) activeArmAsset = animAsset;
        }

        if (baseAsset && baseAsset.loaded) {
            ctx.save(); ctx.translate(this.x, this.y); 
            if (!isStatic) ctx.rotate(this.angle + Math.PI / 2);
            if (armAsset) drawImageCentered(ctx, activeArmAsset, targetSize);
            if (!isCustomBase) {
                for (let p=1; p<=3; p++) {
                    let t = this.upgrades[p-1];
                    if (t > 0) {
                        let ovAsset = Assets.get(`tower_${this.type}_p${p}_t${t}_a`);
                        if (ovAsset && ovAsset.loaded) drawImageCentered(ctx, ovAsset, targetSize);
                    }
                }
            }
            drawImageCentered(ctx, baseAsset, targetSize);
            if (!isCustomBase) {
                for (let p=1; p<=3; p++) {
                    let t = this.upgrades[p-1];
                    if (t > 0) {
                        let ovAsset = Assets.get(`tower_${this.type}_p${p}_t${t}`);
                        if (ovAsset && ovAsset.loaded) drawImageCentered(ctx, ovAsset, targetSize);
                    }
                }
            }
            ctx.restore();
            return;
        }

        ctx.save(); ctx.translate(this.x, this.y); 
        if (!isStatic) ctx.rotate(this.angle);
        ctx.fillStyle = '#795548'; ctx.beginPath(); ctx.arc(0, 0, 15 * (this.stats.scale || 1.0), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#D7BCA3'; ctx.beginPath(); ctx.arc(0, 0, 10 * (this.stats.scale || 1.0), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#795548'; ctx.beginPath(); ctx.arc(-12, -8, 5, 0, Math.PI * 2); ctx.arc(12, -8, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}