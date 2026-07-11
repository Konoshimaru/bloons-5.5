// enemy.js
import { EnemyTypes } from './data.js';
import { drawShadow } from './utils.js';
import { AudioEngine } from './audio.js';
import { GameEngine } from './engine.js';
import Assets from './assets.js';
import { Names } from './names.js';
import { Utils } from './utils.js';

const ENEMY_NAMES = [null, 'red', 'blue', 'green', 'yellow', 'pink', 'black', 'white', 'lead', 'zebra', 'purple', 'rainbow', 'ceramic', 'moab', 'bfb', 'zomg', 'ddt', 'bad'];
const CASH_REWARD_MODIFIER = 0.15;
const REGEN_INTERVAL = 2.0;
const STORM_HIT_INTERVAL = 0.05;
const DOT_TICK_INTERVAL = 1.0;
const SAFETY_LOOP_LIMIT = 100;
const FORTIFIED_LEAD_HP = 3;
const LIVES_LOST_CERAMIC_BASE = 94;
const LIVES_LOST_FORTIFIED_LEAD = 26;

export class Enemy {
    constructor(tier, map, isCamo = false, isRegen = false, maxTier = tier, isFortified = false, hpMod = null) {
        this.tier = tier;
        this.map = map;
        this.isCamo = isCamo;
        this.isRegen = isRegen;
        this.maxTier = maxTier;
        this.isFortified = isFortified;

        this.data = { ...EnemyTypes[tier] };
        const diffSpeedMod = GameEngine.difficulty ? GameEngine.difficulty.speedMod : 1.0;
        this.data.speed *= diffSpeedMod;

        if (hpMod == null) {
            hpMod = GameEngine.difficulty ? (GameEngine.difficulty.hpMod || 1.0) : 1.0;
        }
        this.hpMod = hpMod;

        this.distanceTraveled = 0;
        this.x = map.waypoints[0].x;
        this.y = map.waypoints[0].y;
        this.alive = true;
        this.angle = 0;

        this._initializeStats();
    }

    _initializeStats() {
        this.slowFactor = 1.0;
        this.slowTimer = 0;
        this.isFrozen = false;
        this.dotTimer = 0;
        this.dotDmg = 0;
        this.dotTick = 0;
        this.dipped = false;
        this.stormHitTimer = 0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.gojoSlow = 1.0;
        this.infinityTint = 0;
        this.unstableConcoction = false;
        this.isGoldified = false;
        
        // PRO FIX: Cripple Debuff state
        this.crippled = false;
        this.crippleTimer = 0;

        this._maxHp = this.data.maxHp;
        if (this.isFortified && (this.data.isMoab || this.data.isCeramic)) {
            this._maxHp *= 2;
        }
        if (this.hpMod && this.hpMod !== 1) {
            this._maxHp = Math.max(1, Math.ceil(this._maxHp * this.hpMod));
        }
        this.hp = this._maxHp;
        
        if (this.data.isLead && this.isFortified) {
            this.leadHp = FORTIFIED_LEAD_HP;
        }
    }

    update(dt) {
        this._updateTimers(dt);
        this._updateRegen(dt);
        this._updateMovement(dt);
    }

    _updateTimers(dt) {
        if (this.stormHitTimer > 0) this.stormHitTimer -= dt;
        
        // PRO FIX: Handle Cripple Timer
        if (this.crippleTimer > 0) {
            this.crippleTimer -= dt;
            if (this.crippleTimer <= 0) this.crippled = false;
        }
        
        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            if (this.slowTimer <= 0) {
                this.slowFactor = 1.0;
                this.isFrozen = false;
            }
        }

        if (this.dotTimer > 0) {
            this.dotTimer -= dt;
            this.dotTick += dt;
            if (this.dotTick >= DOT_TICK_INTERVAL) {
                this.dotTick = 0;
                this.takeDamage(this.dotDmg, { isAcid: true, canHitLead: true });
            }
        }
    }

    _updateRegen(dt) {
        if (!this.isRegen || this.tier >= this.maxTier) return;
        this.regenTimer += dt;
        if (this.regenTimer > REGEN_INTERVAL) {
            this.regenTimer = 0;
            this.tier++;
            this.data = { ...EnemyTypes[this.tier] };
            const diffSpeedMod = GameEngine.difficulty ? GameEngine.difficulty.speedMod : 1.0;
            this.data.speed *= diffSpeedMod;
            if (this.data.isMoab) this.hp = this.data.maxHp * (this.isFortified ? 2 : 1);
            if (this.data.isCeramic) this.hp = this.data.maxHp * (this.isFortified ? 2 : 1);
        }
    }

    _updateMovement(dt) {
        this.distanceTraveled += this.data.speed * this.slowFactor * this.gojoSlow * dt;
        const pos = this.map.getPositionAtDistance(this.distanceTraveled);
        this.x = pos.x + this.offsetX;
        this.y = pos.y + this.offsetY;
        this.offsetX *= 0.9;
        this.offsetY *= 0.9;
        
        if (this.tier >= 13 && !pos.finished) {
            const nextPos = this.map.getPositionAtDistance(this.distanceTraveled + 5);
            if (nextPos && !nextPos.finished) {
                this.angle = Utils.angle(pos.x, pos.y, nextPos.x, nextPos.y);
            }
        }
        
        this.gojoSlow = Math.min(1.0, this.gojoSlow + dt * 0.5);
        this.infinityTint = Math.max(0, this.infinityTint - dt * 0.5);
        
        if (pos.finished) {
            this.alive = false;
            const lost = this.getLivesLost();
            if (isFinite(lost)) GameEngine.lives -= lost;
            GameEngine.updateUI();
        }
    }

    getLivesLost() {
        if (this.data.isMoab || this.data.isBAD) {
            let childrenRbe = 0;
            if (this.data.splitsInto) {
                for (const child of this.data.splitsInto) {
                    const childData = EnemyTypes[child.tier];
                    if (childData) childrenRbe += (childData.rbe || 0) * child.count;
                }
            }
            const currentHp = Math.max(0, Math.ceil(this.hp)) || 0;
            return isFinite(currentHp + childrenRbe) ? currentHp + childrenRbe : 0;
        }
        if (this.data.isCeramic) {
            const currentHp = Math.max(0, Math.ceil(this.hp)) || 0;
            return isFinite(LIVES_LOST_CERAMIC_BASE + currentHp) ? LIVES_LOST_CERAMIC_BASE + currentHp : 0;
        }
        if (this.data.isLead && this.isFortified) return LIVES_LOST_FORTIFIED_LEAD;
        const rbe = this.data.rbe || 0;
        return isFinite(rbe) ? rbe : 0;
    }

    applySlow(factor, duration, isIce = true) {
        if (this.data.isBAD) return;
        if (isIce && (this.data.isWhite || this.data.isZebra || this.data.isLead)) return;
        if (factor <= this.slowFactor || this.slowTimer <= 0) {
            this.slowFactor = factor;
            this.slowTimer = duration;
            this.isFrozen = isIce;
        }
    }

    giveCash(canSpawn = true) {
        let childRbeTotal = 0;
        if (this.data.splitsInto) {
            for (const child of this.data.splitsInto) {
                const childData = EnemyTypes[child.tier];
                if (childData) childRbeTotal += (childData.rbe || 0) * child.count;
            }
        }
        const layerCash = Math.max(1, Math.floor((this.data.rbe - childRbeTotal) * CASH_REWARD_MODIFIER));
        GameEngine.addCash(layerCash);
        if (!canSpawn && childRbeTotal > 0) {
            const childCash = Math.max(1, Math.floor(childRbeTotal * CASH_REWARD_MODIFIER));
            GameEngine.addCash(childCash);
        }
    }

    spawnChildren(canSpawn, carryOverDamage = 0, dmgType) {
        if (!canSpawn || !this.data.splitsInto) return;
        const childCount = this.data.splitsInto.length;
        const dmgPerChild = Math.floor(carryOverDamage / childCount);
        let remainder = carryOverDamage % childCount;
        for (const child of this.data.splitsInto) {
            for (let i = 0; i < child.count; i++) {
                const childCamo = child.forceCamo !== undefined ? child.forceCamo : this.isCamo;
                const childRegen = child.forceRegen !== undefined ? child.forceRegen : this.isRegen;
                const c = new Enemy(child.tier, this.map, childCamo, childRegen, child.tier, this.isFortified);
                c.distanceTraveled = Math.max(0, this.distanceTraveled - i * 15);
                if (carryOverDamage > 0) {
                    let dmg = dmgPerChild;
                    if (remainder > 0) { dmg++; remainder--; }
                    if (dmg > 0) c.takeDamage(dmg, dmgType);
                }
                GameEngine.enemies.push(c);
            }
        }
    }

    takeDamage(damage, dmgType, effects) {
        if (this._isImmune(dmgType, effects)) return -1;
        if (isNaN(damage)) damage = 0;
        
        // PRO FIX: Cripple Debuff (+5 damage taken from all sources)
        if (this.crippled) damage += 5;
        
        if (dmgType.moabDmg && this.data.isMoab) damage += (dmgType.moabDmg || 0);
        if (dmgType.fortifiedDmg && this.isFortified) damage += (dmgType.fortifiedDmg || 0);
        if (this.dipped) damage += 1;
        
        if (effects) {
            if (effects.instakill && !this.data.isMoab && !this.data.isBAD) {
                this.alive = false;
                this.giveCash(true);
                GameEngine.spawnPopEffect(this.x, this.y, this.data.color);
                AudioEngine.playSfx('pop');
                return 999;
            }
            if (effects.gold > 0) GameEngine.addCash(effects.gold);
            if (effects.dip) this.dipped = true;
            if (effects.dot > 0) { this.dotDmg = Math.max(this.dotDmg, effects.dot); this.dotTimer = 3.0; }
            if (effects.moabDot > 0 && this.data.isMoab) { this.dotDmg = Math.max(this.dotDmg, effects.moabDot); this.dotTimer = 5.0; }
            if (effects.stripCamo) this.isCamo = false;
            if (effects.knockback) this.distanceTraveled = Math.max(0, this.distanceTraveled - effects.knockback);
            if (effects.stun) this.applySlow(0.0, effects.stun, false);
            if (effects.foam) { this.isCamo = false; this.isRegen = false; }
            if (effects.alchDip) {
                if (this.data.isCeramic || this.data.isMoab) damage += 1;
                if (this.data.isLead && this.isFortified) damage += 1;
            }
            if (effects.stripFortified && !this.data.isMoab) this.isFortified = false;
            if (effects.rubberToGold) this.isGoldified = true;
        }
        
        const canSpawn = GameEngine.enemies.length < 3500;

        if (this.data.isMoab) return this._handleMoabDamage(damage, dmgType, effects, canSpawn);
        if (this.data.isCeramic) return this._handleCeramicDamage(damage, dmgType, effects, canSpawn);
        if (this.data.isLead && this.isFortified) return this._handleFortifiedLeadDamage(damage, dmgType, effects, canSpawn);
        if (this.data.splitsInto) return this._handleSplitDamage(damage, dmgType, effects, canSpawn);
        return this._handleStandardDamage(damage, dmgType, effects);
    }

    _isImmune(dmgType, effects) {
        if (this.data.blocksDamageType && this.data.blocksDamageType(dmgType)) {
            if (this.data.isLead && dmgType.isSharp && !dmgType.canHitLead) {
                AudioEngine.playSfx('lead_hit');
            }
            return true;
        }
        if (this.isFrozen && dmgType.isSharp && !dmgType.canHitLead) {
            AudioEngine.playSfx('frozen_hit');
            return true;
        }
        return false;
    }

    _handleMoabDamage(damage, dmgType, effects, canSpawn) {
        const previousHp = this.hp;
        const dmgDealt = Math.max(0, Math.min(this.hp, damage));
        this.hp -= damage;
        
        if (this.hp <= 0) {
            this.alive = false;
            this.giveCash(canSpawn);
            GameEngine.spawnPopEffect(this.x, this.y, this.data.color);
            AudioEngine.playSfx('moab_destroy');
            
            if (this.unstableConcoction) {
                const expDmg = this.data.maxHp * 0.10;
                GameEngine.explosions.push({ x: this.x, y: this.y, radius: 0, maxRadius: 100, life: 0.5, maxLife: 0.5, color: '#e67e22' });
                const nearby = GameEngine.enemyGrid.query(this.x, this.y, 100);
                for (const e of nearby) {
                    if (e.alive && e !== this) e.takeDamage(expDmg, { isExplosion: true, canHitLead: true });
                }
            }
            if (effects && effects.unstableConcoction) this.unstableConcoction = true;
            
            const carryOver = damage - previousHp;
            this.spawnChildren(canSpawn, carryOver, dmgType);
        } else {
            if (dmgDealt > 0) {
                AudioEngine.playSfx('moab_hit');
            }
        }
        return Math.ceil(dmgDealt);
    }

    _handleCeramicDamage(damage, dmgType, effects, canSpawn) {
        const shellHp = this.hp;
        const dmgDealt = Math.max(0, Math.min(this.hp, damage));
        this.hp -= damage;
        
        if (this.hp <= 0) {
            this.alive = false;
            this.giveCash(canSpawn);
            GameEngine.spawnPopEffect(this.x, this.y, this.data.color);
            AudioEngine.playSfx('pop'); 
            const carryOver = damage - shellHp;
            this.spawnChildren(canSpawn, carryOver, dmgType);
        } else {
            if (dmgDealt > 0) {
                AudioEngine.playSfx('ceramic_hit');
            }
        }
        return Math.ceil(dmgDealt);
    }

    _handleFortifiedLeadDamage(damage, dmgType, effects, canSpawn) {
        this.leadHp -= damage;
        if (this.leadHp > 0) {
            if (damage > 0) AudioEngine.playSfx('pop');
            return 0;
        }
        this.alive = false;
        this.giveCash(canSpawn);
        GameEngine.spawnPopEffect(this.x, this.y, this.data.color);
        AudioEngine.playSfx('pop');
        const carryOver = damage - this.leadHp;
        this.spawnChildren(canSpawn, carryOver, dmgType);
        return 1;
    }

    _handleSplitDamage(damage, dmgType, effects, canSpawn) {
        this.alive = false;
        this.giveCash(canSpawn);
        GameEngine.spawnPopEffect(this.x, this.y, this.data.color);
        AudioEngine.playSfx('pop');
        const carryOver = damage - 1;
        this.spawnChildren(canSpawn, carryOver, dmgType);
        return 1;
    }

    _handleStandardDamage(damage, dmgType, effects) {
        let currentTier = this.tier;
        let remainingDamage = damage;
        let layersPopped = 0;
        let safetyCounter = 0;
        
        while (remainingDamage > 0 && currentTier !== null) {
            remainingDamage -= 1;
            currentTier = EnemyTypes[currentTier].nextTier;
            layersPopped++;
            AudioEngine.playSfx('pop');
            
            if (layersPopped === 1) GameEngine.spawnPopEffect(this.x, this.y, this.data.color);
            
            if (++safetyCounter > SAFETY_LOOP_LIMIT) break;
        }
        
        if (currentTier === null) {
            this.alive = false;
            this.giveCash(true);
        } else {
            this.tier = currentTier;
            this.data = { ...EnemyTypes[currentTier] };
            const diffSpeedMod = GameEngine.difficulty ? GameEngine.difficulty.speedMod : 1.0;
            this.data.speed *= diffSpeedMod;
        }
        return layersPopped;
    }

    draw(ctx) {
        if (GameEngine.enemies.length < 800) drawShadow(ctx, this.x, this.y, this.data.radius);
        const assetKey = Names.getEnemyWithModifiers(this.tier, this.isCamo, this.isRegen);
        let asset = Assets.get(assetKey);
        let usedModifierSprite = (asset && asset.loaded);
        if (!usedModifierSprite) asset = Assets.get(Names.getEnemy(this.tier));

        if (asset && asset.loaded) this._drawSprite(ctx, asset);
        else if (this.data.isMoab) this._drawMoabFallback(ctx);
        else this._drawStandardFallback(ctx);

        // PRO FIX: Stun overlay is correctly checked and drawn
        if (this.slowFactor === 0.0 && this.slowTimer > 0 && !this.isFrozen) {
            this._drawStunOverlay(ctx);
        }
    }

    _drawSprite(ctx, asset) {
        const targetSize = this.data.size || (this.data.radius * 2);
        const maxDim = Math.max(asset.width, asset.height);
        const scale = targetSize / maxDim;
        const w = asset.width * scale;
        const h = asset.height * scale;
        const drawX = this.x + (this.data.spriteOffsetX || 0);
        const drawY = this.y + (this.data.spriteOffsetY || 0);
        
        ctx.save();
        ctx.translate(drawX, drawY);
        if (this.tier >= 13) ctx.rotate(this.angle + Math.PI / 2);
        ctx.drawImage(asset, -w / 2, -h / 2, w, h);
        ctx.restore();
        
        if (this.tier >= 12 && this.hp < this._maxHp) this._drawCracks(ctx, w, h, drawX, drawY);

        if (this.isFrozen) {
            ctx.strokeStyle = 'rgba(26, 188, 156, 0.9)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.data.radius + 3, 0, Math.PI * 2); ctx.stroke();
        } else if (this.slowFactor < 1.0) {
            ctx.strokeStyle = 'rgba(241, 196, 15, 0.7)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.data.radius + 3, 0, Math.PI * 2); ctx.stroke();
        }
        
        if (this.infinityTint > 0) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = this.infinityTint * 0.6;
            ctx.fillStyle = '#a253ff';
            ctx.beginPath(); ctx.arc(this.x, this.y, this.data.radius, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }
    }

    _drawCracks(ctx, w, h, drawX, drawY) {
        const maxHp = this._maxHp;
        const damagePercent = 1 - (this.hp / maxHp);
        const baseName = ENEMY_NAMES[this.tier];
        const maxCracks = Assets.getMaxCracks(baseName);
        
        if (maxCracks <= 0 || damagePercent <= 0) return;
        
        let stage = Math.floor(damagePercent * maxCracks);
        if (damagePercent >= 1.0) stage = maxCracks; 
        if (stage <= 0) return;
        if (stage > maxCracks) stage = maxCracks;
        
        const crackAsset = Assets.get(`${Names.PREFIXES.ENEMY}${baseName}_${stage}`);
        if (!crackAsset || !crackAsset.loaded) return;
        
        ctx.save();
        ctx.translate(drawX, drawY);
        if (this.tier >= 13) ctx.rotate(this.angle + Math.PI / 2);
        ctx.drawImage(crackAsset, -w / 2, -h / 2, w, h);
        ctx.restore();
    }

    _drawMoabFallback(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI / 2);
        ctx.fillStyle = this.data.color;
        ctx.fillRect(-this.data.radius, -this.data.radius * 0.6, this.data.radius * 2, this.data.radius * 1.2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-this.data.radius, -this.data.radius * 0.6, this.data.radius * 2, this.data.radius * 0.3);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(-5, -this.data.radius * 0.6 - 5, 10, 5);
        ctx.restore();
        if (this.isFortified) {
            ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 4;
            ctx.strokeRect(this.x - this.data.radius, this.y - this.data.radius * 0.6, this.data.radius * 2, this.data.radius * 1.2);
        }
    }

    _drawStandardFallback(ctx) {
        ctx.fillStyle = this.data.color;
        if (this.isRegen) {
            const r = this.data.radius;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + r * 0.8);
            ctx.bezierCurveTo(this.x, this.y, this.x - r, this.y, this.x - r, this.y - r * 0.4);
            ctx.bezierCurveTo(this.x - r, this.y - r * 0.8, this.x - r * 0.5, this.y - r, this.x, this.y - r * 0.4);
            ctx.bezierCurveTo(this.x + r * 0.5, this.y - r, this.x + r, this.y - r * 0.8, this.x + r, this.y - r * 0.4);
            ctx.bezierCurveTo(this.x + r, this.y, this.x, this.y, this.x, this.y + r * 0.8);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.data.radius * 0.9, this.data.radius, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        if (this.data.isLead) {
            ctx.fillStyle = '#7f8c8d';
            ctx.beginPath(); ctx.ellipse(this.x, this.y, this.data.radius * 0.9, this.data.radius, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath(); ctx.ellipse(this.x - this.data.radius / 3, this.y - this.data.radius / 3, this.data.radius / 4, this.data.radius / 2, -0.5, 0, Math.PI * 2); ctx.fill();
            if (this.isFortified) {
                ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(this.x, this.y, this.data.radius, 0, Math.PI * 2); ctx.stroke();
            } else {
                ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(this.x, this.y, this.data.radius, 0, Math.PI * 2); ctx.stroke();
            }
        } else if (this.isCamo) {
            ctx.fillStyle = '#5d4037';
            ctx.beginPath(); ctx.arc(this.x - 4, this.y - 2, 4, 0, Math.PI * 2); ctx.arc(this.x + 5, this.y + 3, 5, 0, Math.PI * 2); ctx.fill();
        } else if (this.data.isCeramic) {
            ctx.strokeStyle = '#7f8c8d'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.data.radius, 0, Math.PI * 2); ctx.stroke();
            if (this.isFortified) {
                ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 5;
                ctx.beginPath(); ctx.arc(this.x, this.y, this.data.radius, 0, Math.PI * 2); ctx.stroke();
            }
        }
        if (this.isFrozen) {
            ctx.strokeStyle = 'rgba(26, 188, 156, 0.9)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.data.radius + 3, 0, Math.PI * 2); ctx.stroke();
        } else if (this.slowFactor < 1.0) {
            ctx.strokeStyle = 'rgba(241, 196, 15, 0.7)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.data.radius + 3, 0, Math.PI * 2); ctx.stroke();
        }
    }

    _drawStunOverlay(ctx) {
        const t = performance.now() / 1000;
        const fps = 15;
        const frame = Math.floor(t * fps) % fps;
        let stunAsset = Assets.get(Names.getStunFX(frame));
        if (!stunAsset || !stunAsset.loaded) stunAsset = Assets.get(Names.getStunFX(0));
        if (!stunAsset || !stunAsset.loaded) stunAsset = Assets.get('effect_stun');
        if (stunAsset && stunAsset.loaded) {
            const s = (this.data.size || 40) * 0.8;
            ctx.save();
            ctx.translate(this.x, this.y - this.data.radius * 0.6 - s / 2);
            ctx.rotate(t * 5);
            ctx.drawImage(stunAsset, -s / 2, -s / 2, s, s);
            ctx.restore();
        }
    }
}