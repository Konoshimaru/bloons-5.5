import { EnemyTypes } from './data.js';
import { AudioEngine } from './audio.js';
import { GameEngine } from './engine.js';
import Assets from './assets.js';
import { Names } from './names.js';
import { Utils } from './utils.js';

export class Enemy {
    constructor(tier, map, isCamo = false, isRegen = false, maxTier = tier, isFortified = false) { 
        this.tier = tier; 
        const diffSpeedMod = GameEngine.difficulty ? GameEngine.difficulty.speedMod : 1.0;
        this.data = { ...EnemyTypes[tier], speed: EnemyTypes[tier].speed * diffSpeedMod }; 
        this.map = map; this.distanceTraveled = 0; this.x = map.waypoints[0].x; this.y = map.waypoints[0].y; 
        this.alive = true; this.slowFactor = 1.0; this.slowTimer = 0; this.isFrozen = false; this.isCamo = isCamo; this.isRegen = isRegen; this.maxTier = maxTier; this.regenTimer = 0;
        this.isFortified = isFortified;
        if (this.data.isMoab) this.hp = this.data.maxHp * (this.isFortified ? 2 : 1);
        if (this.data.isCeramic) this.hp = this.data.maxHp * (this.isFortified ? 2 : 1);
        if (this.data.isLead && this.isFortified) this.leadHp = 3; 
        
        this.dotTimer = 0; this.dotDmg = 0; this.dotTick = 0; this.dipped = false;
        this.stormHitTimer = 0;
        this.offsetX = 0; this.offsetY = 0; 
        this.gojoSlow = 1.0; 
        this.infinityTint = 0; 
        this.angle = 0; 
    }
    update(dt) { 
        if (this.stormHitTimer > 0) this.stormHitTimer -= dt;
        if (this.slowTimer > 0) { 
            this.slowTimer -= dt; 
            if (this.slowTimer <= 0) { this.slowFactor = 1.0; this.isFrozen = false; } 
        } 
        
        if (this.dotTimer > 0) {
            this.dotTimer -= dt;
            this.dotTick += dt;
            if (this.dotTick >= 1.0) {
                this.dotTick = 0;
                this.takeDamage(this.dotDmg, { isAcid: true, canHitLead: true });
            }
        }

        if (this.isRegen && this.tier < this.maxTier) { 
            this.regenTimer += dt; 
            if (this.regenTimer > 2.0) { 
                this.regenTimer = 0; this.tier++; 
                this.data = { ...EnemyTypes[this.tier], speed: EnemyTypes[this.tier].speed * (GameEngine.difficulty ? GameEngine.difficulty.speedMod : 1.0) }; 
                if (this.data.isMoab) this.hp = this.data.maxHp * (this.isFortified ? 2 : 1); 
                if (this.data.isCeramic) this.hp = this.data.maxHp * (this.isFortified ? 2 : 1); 
            } 
        }
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
            let lost = this.getLivesLost();
            if (isFinite(lost)) GameEngine.lives -= lost; 
            GameEngine.updateUI(); 
        } 
    }

    getLivesLost() {
        let lives = 0;
        if (this.data.isMoab || this.data.isBAD) {
            let childrenRbe = 0;
            if (this.data.splitsInto) {
                for (let child of this.data.splitsInto) {
                    let childData = EnemyTypes[child.tier];
                    if (childData) childrenRbe += (childData.rbe || 0) * child.count;
                }
            }
            lives = (Math.max(0, Math.ceil(this.hp)) || 0) + childrenRbe;
        } else if (this.data.isCeramic) {
            lives = 94 + (Math.max(0, Math.ceil(this.hp)) || 0);
        } else if (this.data.isLead && this.isFortified) {
            lives = 26;
        } else {
            lives = this.data.rbe || 0;
        }
        return isFinite(lives) ? lives : 0; 
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
            for(let child of this.data.splitsInto) {
                let childData = EnemyTypes[child.tier];
                if (childData) childRbeTotal += (childData.rbe || 0) * child.count;
            }
        }
        let layerCash = Math.max(1, Math.floor((this.data.rbe - childRbeTotal) * 0.15));
        GameEngine.addCash(layerCash);
        if (!canSpawn && childRbeTotal > 0) {
            GameEngine.addCash(Math.max(1, Math.floor(childRbeTotal * 0.15)));
        }
    }

    spawnChildren(canSpawn, carryOverDamage = 0, dmgType) {
        if (!canSpawn) return; 
        
        if (this.data.splitsInto) {
            let children = [];
            for(let child of this.data.splitsInto) {
                for(let i=0; i<child.count; i++) {
                    const childCamo = child.forceCamo !== undefined ? child.forceCamo : this.isCamo;
                    const childRegen = child.forceRegen !== undefined ? child.forceRegen : this.isRegen;
                    let c = new Enemy(child.tier, this.map, childCamo, childRegen, child.tier, this.isFortified);
                    c.distanceTraveled = Math.max(0, this.distanceTraveled - i * 15); 
                    children.push(c);
                }
            }
            
            if (carryOverDamage > 0 && children.length > 0) {
                let dmgPerChild = Math.floor(carryOverDamage / children.length);
                let remainder = carryOverDamage % children.length;
                for (let c of children) {
                    let dmg = dmgPerChild + (remainder > 0 ? 1 : 0);
                    if (remainder > 0) remainder--;
                    if (dmg > 0) c.takeDamage(dmg, dmgType); 
                }
            }
            
            for (let c of children) {
                if (c.alive) GameEngine.enemies.push(c);
            }
        }
    }
    
    takeDamage(damage, dmgType, effects) {
        if (this.data.blocksDamageType && this.data.blocksDamageType(dmgType)) {
            if (this.data.isLead && dmgType.isSharp) AudioEngine.playSfx('lead_hit');
            return -1; 
        }
        if (this.isFrozen && dmgType.isSharp) {
            AudioEngine.playSfx('frozen_hit');
            return -1; 
        } 
        
        if (isNaN(damage)) damage = 0; 
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
            
            // PRO FIX: Ninja Monkey Effects
            if (effects.stripCamo) this.isCamo = false; // Counter-Espionage
            if (effects.knockback) this.distanceTraveled = Math.max(0, this.distanceTraveled - effects.knockback); // Distraction
            if (effects.stun) this.applySlow(0.0, effects.stun, false); // Flash Bomb stun
        }
        
        const canSpawn = GameEngine.enemies.length < 3500;

        if (this.data.isMoab) {
            let moabHp = this.hp;
            let dmgDealt = Math.max(0, Math.min(this.hp, damage)); 
            this.hp -= damage;
            if (this.hp <= 0) {
                this.alive = false;
                this.giveCash(canSpawn);
                GameEngine.spawnPopEffect(this.x, this.y, this.data.color);
                AudioEngine.playSfx('moab_destroy'); 
                let carryOver = damage - moabHp;
                this.spawnChildren(canSpawn, carryOver, dmgType);
            } else {
                if (dmgDealt > 0) AudioEngine.playSfx('moab_hit'); 
            }
            return Math.ceil(dmgDealt);
        }

        if (this.data.isCeramic) {
            let shellHp = this.hp;
            let dmgDealt = Math.max(0, Math.min(this.hp, damage)); 
            this.hp -= damage;
            if (this.hp <= 0) {
                this.alive = false;
                this.giveCash(canSpawn);
                GameEngine.spawnPopEffect(this.x, this.y, this.data.color);
                AudioEngine.playSfx('pop');
                let carryOver = damage - shellHp;
                this.spawnChildren(canSpawn, carryOver, dmgType);
            } else {
                if (dmgDealt > 0) AudioEngine.playSfx('ceramic_hit'); 
            }
            return Math.ceil(dmgDealt);
        }

        if (this.data.isLead && this.isFortified) {
            let leadHp = this.leadHp;
            this.leadHp -= damage;
            if (this.leadHp > 0) {
                if (damage > 0) AudioEngine.playSfx('pop'); 
                return 0;
            } else {
                this.alive = false;
                this.giveCash(canSpawn);
                GameEngine.spawnPopEffect(this.x, this.y, this.data.color);
                AudioEngine.playSfx('pop');
                let carryOver = damage - leadHp;
                this.spawnChildren(canSpawn, carryOver, dmgType);
                return 1;
            }
        }

        if (this.data.splitsInto) {
            this.alive = false;
            this.giveCash(canSpawn);
            GameEngine.spawnPopEffect(this.x, this.y, this.data.color); 
            AudioEngine.playSfx('pop'); 
            let carryOver = damage - 1; 
            this.spawnChildren(canSpawn, carryOver, dmgType);
            return 1;
        }

        // Standard Layer Peeling (Pink -> Red)
        let currentTier = this.tier, remainingDamage = damage, layersPopped = 0;
        let safetyCounter = 0;
        while (remainingDamage > 0 && currentTier !== null) { 
            remainingDamage -= 1; 
            currentTier = EnemyTypes[currentTier].nextTier; 
            layersPopped++; 
            
            // PRO FIX: Play pop sound AND spawn pop effect when a layer goes down!
            if (currentTier !== null) {
                AudioEngine.playSfx('pop');
                GameEngine.spawnPopEffect(this.x, this.y, this.data.color);
            }
            
            if (++safetyCounter > 100) { 
                console.error("CRASH PREVENTED: Bloon damage while-loop infinite loop!");
                break; 
            }
        }
        if (currentTier === null) { 
            this.alive = false; 
            this.giveCash(true); 
            GameEngine.spawnPopEffect(this.x, this.y, this.data.color); 
            AudioEngine.playSfx('pop'); 
        }
        else { 
            this.tier = currentTier; 
            this.data = { ...EnemyTypes[currentTier], speed: EnemyTypes[currentTier].speed * (GameEngine.difficulty ? GameEngine.difficulty.speedMod : 1.0) }; 
        }
        return layersPopped;
    }
    
    draw(ctx) {
        const enemyNames = [null, 'red', 'blue', 'green', 'yellow', 'pink', 'black', 'white', 'lead', 'zebra', 'purple', 'rainbow', 'ceramic', 'moab', 'bfb', 'zomg', 'ddt', 'bad'];
        const baseName = enemyNames[this.tier];
        
        let assetKey = Names.getEnemyWithModifiers(this.tier, this.isCamo, this.isRegen);
        let asset = Assets.get(assetKey);
        let usedModifierSprite = (asset && asset.loaded);
        
        if (!usedModifierSprite) {
            assetKey = Names.getEnemy(this.tier);
            asset = Assets.get(assetKey);
        }

        if (asset && asset.loaded) {
            let targetSize = this.data.size || (this.data.radius * 2); 
            let maxDim = Math.max(asset.width, asset.height);
            let scale = targetSize / maxDim;
            let w = asset.width * scale;
            let h = asset.height * scale;
            
            let drawX = this.x + (this.data.spriteOffsetX || 0);
            let drawY = this.y + (this.data.spriteOffsetY || 0);
            
            ctx.save();
            ctx.translate(drawX, drawY);
            if (this.tier >= 13) ctx.rotate(this.angle + Math.PI / 2); 
            ctx.drawImage(asset, -w/2, -h/2, w, h);
            ctx.restore();
            
            if (this.tier >= 12 && this.hp < this.data.maxHp * (this.isFortified ? 2 : 1)) {
                let maxHp = this.data.maxHp * (this.isFortified ? 2 : 1);
                let damagePercent = 1 - (this.hp / maxHp);
                let maxCracks = Assets.getMaxCracks(baseName);
                if (maxCracks > 0) {
                    let stage = 0;
                    if (damagePercent > 0.75) stage = 3;
                    else if (damagePercent > 0.50) stage = 2;
                    else if (damagePercent > 0.25) stage = 1;
                    if (stage > 0 && stage <= maxCracks) {
                        const crackAsset = Assets.get(`enemy_${baseName}_${stage}`);
                        if (crackAsset && crackAsset.loaded) {
                            ctx.save();
                            ctx.translate(drawX, drawY);
                            if (this.tier >= 13) ctx.rotate(this.angle + Math.PI / 2);
                            ctx.drawImage(crackAsset, -w/2, -h/2, w, h);
                            ctx.restore();
                        }
                    }
                }
            }
            
            if (!usedModifierSprite) {
                if (this.isCamo) { ctx.fillStyle = '#5d4037'; ctx.beginPath(); ctx.arc(this.x - 4, this.y - 2, 4, 0, Math.PI*2); ctx.arc(this.x + 5, this.y + 3, 5, 0, Math.PI*2); ctx.fill(); }
                if (this.isFortified) { ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(this.x, this.y, this.data.radius, 0, Math.PI * 2); ctx.stroke(); }
            }
            if (this.isFrozen) { ctx.strokeStyle = 'rgba(26, 188, 156, 0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(this.x, this.y, this.data.radius + 3, 0, Math.PI * 2); ctx.stroke(); }
            else if (this.slowFactor < 1.0) { ctx.strokeStyle = 'rgba(241, 196, 15, 0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.x, this.y, this.data.radius + 3, 0, Math.PI * 2); ctx.stroke(); }
            if (this.infinityTint > 0) {
                ctx.globalCompositeOperation = 'source-atop';
                ctx.globalAlpha = this.infinityTint * 0.6; 
                ctx.fillStyle = '#a253ff'; 
                ctx.beginPath(); ctx.arc(this.x, this.y, this.data.radius, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = 'source-over';
            }

            // Stun FX Animation
            if (this.slowFactor === 0.0 && this.slowTimer > 0 && !this.isFrozen) {
                let t = performance.now() / 1000;
                let fps = 15; 
                let frame = Math.floor(t * fps) % 15; 
                let asset = Assets.get(Names.getStunFX(frame));
                if (!asset || !asset.loaded) asset = Assets.get(Names.getStunFX(0));
                if (!asset || !asset.loaded) asset = Assets.get(`effect_stun`);
                if (asset && asset.loaded) {
                    let s = (this.data.size || 40) * 0.8;
                    ctx.save();
                    ctx.translate(this.x, this.y - this.data.radius - s/2);
                    ctx.rotate(t * 5); 
                    ctx.drawImage(asset, -s/2, -s/2, s, s);
                    ctx.restore();
                }
            }
            return; 
        }
        
        if (this.data.isMoab) {
            ctx.save(); 
            ctx.translate(this.x, this.y); 
            ctx.rotate(this.angle + Math.PI / 2); 
            ctx.fillStyle = this.data.color; ctx.fillRect(-this.data.radius, -this.data.radius * 0.6, this.data.radius * 2, this.data.radius * 1.2);
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-this.data.radius, -this.data.radius * 0.6, this.data.radius * 2, this.data.radius * 0.3); 
            ctx.fillStyle = '#e74c3c'; ctx.fillRect(-5, -this.data.radius * 0.6 - 5, 10, 5);
            ctx.restore();
            if (this.isFortified) { ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 4; ctx.strokeRect(this.x - this.data.radius, this.y - this.data.radius * 0.6, this.data.radius * 2, this.data.radius * 1.2); }
            return;
        }
        ctx.fillStyle = this.data.color;
        if (this.isRegen) {
            let r = this.data.radius;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + r * 0.8);
            ctx.bezierCurveTo(this.x, this.y, this.x - r, this.y, this.x - r, this.y - r * 0.4);
            ctx.bezierCurveTo(this.x - r, this.y - r * 0.8, this.x - r * 0.5, this.y - r, this.x, this.y - r * 0.4);
            ctx.bezierCurveTo(this.x + r * 0.5, this.y - r, this.x + r, this.y - r * 0.8, this.x + r, this.y - r * 0.4);
            ctx.bezierCurveTo(this.x + r, this.y, this.x, this.y, this.x, this.y + r * 0.8);
            ctx.fill();
        } else {
            ctx.beginPath(); ctx.ellipse(this.x, this.y, this.data.radius * 0.9, this.data.radius, 0, 0, Math.PI * 2); ctx.fill();
        }
        if (this.data.isLead) {
            ctx.fillStyle = '#7f8c8d'; ctx.beginPath(); ctx.ellipse(this.x, this.y, this.data.radius * 0.9, this.data.radius, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.ellipse(this.x - this.data.radius/3, this.y - this.data.radius/3, this.data.radius/4, this.data.radius/2, -0.5, 0, Math.PI * 2); ctx.fill();
            if (this.isFortified) { ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(this.x, this.y, this.data.radius, 0, Math.PI * 2); ctx.stroke(); }
            else { ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(this.x, this.y, this.data.radius, 0, Math.PI * 2); ctx.stroke(); }
        } else if (this.isCamo) {
            ctx.fillStyle = '#5d4037'; ctx.beginPath(); ctx.arc(this.x - 4, this.y - 2, 4, 0, Math.PI*2); ctx.arc(this.x + 5, this.y + 3, 5, 0, Math.PI*2); ctx.fill();
        } else if (this.data.isCeramic) {
            ctx.strokeStyle = '#7f8c8d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(this.x, this.y, this.data.radius, 0, Math.PI * 2); ctx.stroke();
            if (this.isFortified) { ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(this.x, this.y, this.data.radius, 0, Math.PI * 2); ctx.stroke(); }
        }
        if (this.isFrozen) { ctx.strokeStyle = 'rgba(26, 188, 156, 0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(this.x, this.y, this.data.radius + 3, 0, Math.PI * 2); ctx.stroke(); }
        else if (this.slowFactor < 1.0) { ctx.strokeStyle = 'rgba(241, 196, 15, 0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.x, this.y, this.data.radius + 3, 0, Math.PI * 2); ctx.stroke(); }
    }
}