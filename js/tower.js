import { RANGE_SCALE } from './config.js';
import { TowerStats, Upgrades, TowerRegistry } from './towers/index.js';
import { HeroStats, HeroRegistry } from './heroes/index.js';
import { Utils, drawImageCentered, drawShadow } from './utils.js';
import { AudioEngine } from './audio.js';
import { GameEngine } from './engine.js';
import Assets from './assets.js';
import { Names } from './names.js';
import { Projectile } from './projectile.js';
import { DamageType, createDmgType } from './damageTypes.js';

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
    }

    getActiveAssets() {
        let baseAsset = Assets.get(`tower_${this.type}_base`);
        let armAsset = Assets.get(`tower_${this.type}_arm`);
        
        // PRO FIX: Reverted to 45 to fix massive monkey sizes.
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
        const stats = TowerStats[type];
        let targetSize = stats?.drawSize || 45;
        
        const asset = Assets.get(`tower_${type}_base`);
        if (asset && asset.loaded) {
            ctx.save(); ctx.translate(x, y);
            drawImageCentered(ctx, asset, targetSize); 
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

    update(dt) {
        this.cooldown -= dt;
        if (this.abilityCooldown > 0) this.abilityCooldown -= dt;
        if (this.ability2Cooldown > 0) this.ability2Cooldown -= dt;
        if (this.ability3Cooldown > 0) this.ability3Cooldown -= dt; 
        if (this.abilityActiveTime > 0) this.abilityActiveTime -= dt;
        if (this.fanClubBuffTimer > 0) this.fanClubBuffTimer -= dt;
        if (this.overclockTimer > 0) this.overclockTimer -= dt; 
        
        for (let i = this.hitscans.length - 1; i >= 0; i--) { this.hitscans[i].life -= dt; if (this.hitscans[i].life <= 0) this.hitscans.splice(i, 1); }
        this.animTimer += dt;
        if (this.animTimer > 0.2) { this.animTimer = 0; this.animFrame++; }

        if (this.attackPointTimer > 0) {
            this.attackPointTimer -= dt;
            if (this.attackPointTimer <= 0) {
                if (this.pendingTarget && this.pendingTarget.alive) this.fire(this.pendingTarget);
                this.pendingTarget = null;
                this.attackPointTimer = 0;
            }
        }

        if (this.attackAnimActive) {
            let frameDuration = 0.03; 
            this.attackAnimTimer += dt;
            if (this.attackAnimTimer > frameDuration) {
                this.attackAnimTimer = 0;
                this.attackAnimFrame++;
                let prefix = `${this.attackPrefix}attack_${this.isFullAnim ? 'full_' : ''}`;
                let nextAsset = Assets.get(`${prefix}${this.attackAnimFrame}`);
                // PRO FIX: Only stop animation if the file is truly missing (isError), not just still downloading
                if (!nextAsset || nextAsset.isError) {
                    this.attackAnimActive = false;
                    this.attackAnimFrame = 0;
                }
            }
        }

        const behavior = TowerRegistry[this.type];
        if (behavior && behavior.update) { behavior.update(this, dt); return; }
        const heroBehavior = HeroRegistry[this.type];
        if (heroBehavior && heroBehavior.update) { heroBehavior.update(this, dt); }
        this.acquireAndFire(dt);
    }

    acquireAndFire(dt) {
        if (this.isHollowCharging) return; 
        if (this.stats.fireRate <= 0) return; 
        let target = null; 
        let bestVal = (this.targetingMode === 'First' || this.targetingMode === 'Strong') ? -Infinity : Infinity;
        
        let scale = (typeof RANGE_SCALE === 'number') ? RANGE_SCALE : 3.0;
        let baseRange = (typeof this.stats.range === 'number') ? this.stats.range : 100;
        let buffMult = (typeof this.buffedRange === 'number') ? this.buffedRange : 0;
        let effRange = baseRange === 9999 ? 9999 : baseRange * scale * (1 + buffMult);
        
        const candidates = baseRange === 9999 ? GameEngine.enemies : GameEngine.enemyGrid.query(this.x, this.y, effRange);
        const seen = new Set();
        
        for (let e of candidates) {
            if (seen.has(e)) continue; seen.add(e);
            if (!e.alive) continue;
            if (e.isCamo && !this.stats.canSeeCamo && !this.buffedCamo) continue; 
            if (this.type === 'glue' && e.data.isMoab) continue; 
            const dist = Utils.distance(this.x, this.y, e.x, e.y);
            if (baseRange !== 9999 && dist > effRange) continue;
            if (this.stats.minRange && dist < (this.stats.minRange * scale)) continue; 

            if (baseRange !== 9999 && GameEngine.map && GameEngine.map.props.length > 0) {
                if (!this._losBlockers) {
                    this._losBlockers = GameEngine.map.props.filter(p => p.type === 'tree' || p.type === 'rock');
                }
                if (this._losBlockers.length > 0) {
                    let hasLoS = true;
                    for (let p of this._losBlockers) {
                        if (Utils.distToSegment(p.x, p.y, this.x, this.y, e.x, e.y) < 18) { hasLoS = false; break; }
                    }
                    if (!hasLoS) continue;
                }
            }

            let val; 
            if (this.targetingMode === 'First' || this.targetingMode === 'Last') val = e.distanceTraveled; 
            else if (this.targetingMode === 'Strong') val = e.data.rbe; 
            else if (this.targetingMode === 'Close') val = dist;
            
            let isBetter = false;
            if (this.targetingMode === 'First' || this.targetingMode === 'Strong') {
                if (val > bestVal) isBetter = true;
                if (this.targetingMode === 'Strong' && val === bestVal && target && e.distanceTraveled > target.distanceTraveled) isBetter = true;
            } else if (this.targetingMode === 'Last' || this.targetingMode === 'Close') {
                if (val < bestVal) isBetter = true;
            }
            if (isBetter) { bestVal = val; target = e; }
        }
        
        if (target) { 
            if (!this.stats.isStaticRotation) {
                this.angle = Utils.angle(this.x, this.y, target.x, target.y); 
            }
            if (this.cooldown <= 0 && this.attackPointTimer <= 0) { 
                let effFireRate = this.fanClubBuffTimer > 0 ? (this.fanClubType === 'plasma' ? 0.03 : 0.06) : this.stats.fireRate;
                if (this.overclockTimer > 0) effFireRate *= 0.6;
                if (this.ultraboostStacks > 0) effFireRate *= (1 - 0.066 * this.ultraboostStacks);
                if (this.abilityActiveTime > 0) effFireRate /= (this.stats.rapidShotMult || 3); 
                this.triggerAttack(target); 
                this.cooldown = effFireRate / (1 + this.buffedFireRate); 
            } 
        }
    }

    triggerAttack(target) {
        let animAsset = null;
        let isFullAnim = false;
        let prefix = `tower_${this.type}_`;

        let bestTier = 0, bestPath = 0;
        for (let p = 1; p <= 3; p++) {
            if (this.upgrades[p-1] > bestTier) { 
                bestTier = this.upgrades[p-1]; 
                bestPath = p; 
            }
        }

        if (bestTier > 0) {
            let upgPrefix = `tower_${this.type}_p${bestPath}_t${bestTier}_`;
            let upgFull = Assets.get(`${upgPrefix}attack_full_0`);
            let upgArm = Assets.get(`${upgPrefix}attack_0`);
            if (upgFull && upgFull.loaded) { prefix = upgPrefix; isFullAnim = true; animAsset = upgFull; }
            else if (upgArm && upgArm.loaded) { prefix = upgPrefix; isFullAnim = false; animAsset = upgArm; }
        }

        if (!animAsset) {
            let baseFull = Assets.get(`${prefix}attack_full_0`);
            let baseArm = Assets.get(`${prefix}attack_0`);
            if (baseFull && baseFull.loaded) { isFullAnim = true; animAsset = baseFull; }
            else if (baseArm && baseArm.loaded) { isFullAnim = false; animAsset = baseArm; }
        }

       // PRO FIX: Only skip animation if the file is truly missing (isError)
        if (!animAsset || animAsset.isError) {
            this.fire(target);
            return;
        }

        this.attackAnimActive = true;
        this.attackAnimFrame = 0;
        this.attackAnimTimer = 0;
        this.isFullAnim = isFullAnim;
        this.attackPrefix = prefix;
        
        let frameDuration = 0.03; 
        let throwFrame = 4; 
        let windupTime = frameDuration * throwFrame; 
        
        let effFireRate = this.stats.fireRate / (1 + this.buffedFireRate);
        if (this.fanClubBuffTimer > 0) effFireRate = this.fanClubType === 'plasma' ? 0.03 : 0.06;
        if (this.abilityActiveTime > 0) effFireRate /= (this.stats.rapidShotMult || 3);
        if (windupTime >= effFireRate) {
            windupTime = effFireRate * 0.5; 
        }
        
        this.attackPointTimer = windupTime;
        this.pendingTarget = target;
    }

    fire(target) {
        if (target && !target.alive) return; 
        AudioEngine.playSfx('shoot'); 
        
        let damage = this.stats.damage + (this.buffedDmg || 0); 
        let dmgTypeStr = this.stats.dmgType;
        let canHitLead = this.stats.canHitLead || this.buffedLead;
        let isCrit = this.stats.critChance && Math.random() < this.stats.critChance;
        if (isCrit) damage = this.stats.critDmg;
        if (dmgTypeStr === 'heavy') { canHitLead = true; }
        if (this.fanClubBuffTimer > 0) {
            damage = this.fanClubType === 'plasma' ? 4 : 2;
            dmgTypeStr = this.fanClubType === 'plasma' ? 'plasma' : 'sharp';
            canHitLead = true;
        }
        let projType = this.stats.projectileType || 'dart';
        let pierce = this.stats.pierce + (this.buffedPierce || 0);
        
        let baseDmgType = DamageType.NONE;
        if (dmgTypeStr === 'sharp') baseDmgType = DamageType.SHARP;
        else if (dmgTypeStr === 'explosion') baseDmgType = DamageType.EXPLOSION;
        else if (dmgTypeStr === 'ice') baseDmgType = DamageType.ICE;
        else if (dmgTypeStr === 'plasma') baseDmgType = DamageType.PLASMA;
        else if (dmgTypeStr === 'energy') baseDmgType = DamageType.ENERGY;
        else if (dmgTypeStr === 'fire') baseDmgType = DamageType.FIRE;
        else if (dmgTypeStr === 'magic') baseDmgType = DamageType.MAGIC;
        else if (dmgTypeStr === 'acid') baseDmgType = DamageType.ACID;
        else if (dmgTypeStr === 'heavy') baseDmgType = DamageType.HEAVY;

        let dmgType = createDmgType(baseDmgType, {
            canHitLead: canHitLead,
            moabDmg: this.stats.moabDmg || 0,
            fortifiedDmg: this.stats.fortifiedDmg || 0
        });
        
        let effects = {};
        if (this.stats.applyPin) effects.pin = true;
        if (this.stats.applyFoam) effects.foam = true;
        
        if (TowerRegistry[this.type] && TowerRegistry[this.type].fire) {
            TowerRegistry[this.type].fire(this, target, damage, dmgType, isCrit, effects);
        } else if (HeroRegistry[this.type] && HeroRegistry[this.type].fire) {
            HeroRegistry[this.type].fire(this, target, damage, dmgType, isCrit, effects);
        } else if (this.stats.isHero) {
            GameEngine.projectiles.push(new Projectile(this.x, this.y, damage, target, projType, this.stats.projectileSpeed, pierce, this.stats.lifespan, null, effects, 0, this, dmgType));
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
        if (this.stats.fireRate < 0.05) this.stats.fireRate = 0.05; 
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