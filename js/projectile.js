import { TowerStats } from './towers/index.js';
import { EnemyTypes } from './data.js'; 
import { Utils, CANVAS_W, CANVAS_H, drawImageCentered } from './utils.js';
import { GameEngine } from './engine.js';
import Assets from './assets.js';
import { Names } from './names.js';
import { ProjectileDrawers } from './projectileDrawers.js';
import { DamageType, createDmgType } from './damageTypes.js';

export class Projectile {
    constructor() {
        this.active = false; 
        this.hitEnemies = new Set();
        this.reset();
    }

    init(x, y, damage, target, type, speed, pierce, lifespan, fixedAngle = null, effects = null, angleOffset = 0, tower = null, dmgType = {}) {
        this.x = x; this.y = y; this.startX = x; this.startY = y;
        this.damage = damage; this.target = target; this.type = type; this.speed = speed; this.pierce = pierce; this.life = lifespan; this.maxLife = lifespan;
        
        let baseAngle = fixedAngle !== null ? fixedAngle : (target ? Utils.angle(this.x, this.y, target.x, target.y) : 0);
        this.angle = baseAngle + (angleOffset * Math.PI / 180); 
        
        this.radius = this.type === 'bomb' ? 8 : (this.type === 'spike' ? 10 : 5); 
        this.alive = true; this.active = true; 
        this.effects = effects; 
        this.hitEnemies.clear();
        this.tower = tower; this.dmgType = dmgType;
        this.bonusCeramic = tower ? tower.stats.bonusCeramic : 0;
        this.isCrit = false;
        this.hasSplit = false;
        this.t = 0; 
        this.targetTower = null; 
        this.buffType = null;
        this.targetX = 0; this.targetY = 0;
        
        if (type === 'boomerang' && target) {
            this.targetX = target.x; this.targetY = target.y;
            this.mx = (this.startX + this.targetX) / 2; this.my = (this.startY + this.targetY) / 2;
            let dx = this.targetX - this.mx, dy = this.targetY - this.my;
            this.r = Math.hypot(dx, dy);
            if (this.r < 10) this.r = 10; 
            let targetAng = Math.atan2(dy, dx);
            this.startAng = targetAng + Math.PI;
            this.curveDir = Math.random() < 0.5 ? 1 : -1; 
            this.t = 0; this.lifespan = 1.5; this.life = 1.5;
        }
        
        if (type === 'mortar_shell' && target) {
            this.targetX = target.x; this.targetY = target.y;
            this.arcTime = lifespan; 
            this.life = this.arcTime;
            this.maxLife = this.arcTime;
        }
    }

    reset() {
        this.alive = false; this.active = false;
        this.x = 0; this.y = 0; this.angle = 0; this.speed = 0;
        this.target = null; this.tower = null; this.effects = null;
        this.hitEnemies.clear();
    }
    
    update(dt) {
        // PRO FIX: Lifespan check moved to the very top so ALL projectiles die on time!
        this.life -= dt; 
        if (this.life <= 0) { 
            if (this.type === 'ultra_juggernaut' && !this.hasSplit) this.split(); 
            this.alive = false; return; 
        }

        if (this.type === 'buff_potion') {
            if (this.targetTower) {
                this.angle = Utils.angle(this.x, this.y, this.targetTower.x, this.targetTower.y);
                this.x += Math.cos(this.angle) * this.speed * dt;
                this.y += Math.sin(this.angle) * this.speed * dt;
                if (Utils.distance(this.x, this.y, this.targetTower.x, this.targetTower.y) < 10) {
                    if (this.buffType === 'brew') {
                        this.targetTower.alchBuff = {
                            timer: this.tower.stats.brewTimer || 5, shotsLeft: this.tower.stats.brewShots || 25,
                            dmg: this.tower.stats.brewDmg || 1, range: this.tower.stats.brewRange || 0.1,
                            speed: this.tower.stats.brewSpeed || 0.1, pierce: this.tower.stats.brewPierce || 2,
                            isPerm: this.tower.stats.isPermBrew || false
                        };
                    } else {
                        this.targetTower.alchDip = { timer: 10, shotsLeft: this.tower.stats.brewShots ? this.tower.stats.brewShots : 10, isPerm: this.tower.stats.isPermBrew || false };
                    }
                    this.alive = false;
                }
            } else { this.alive = false; }
            return;
        }
        
        if (this.type === 'shrink_potion') {
            this.x += Math.cos(this.angle) * this.speed * dt;
            this.y += Math.sin(this.angle) * this.speed * dt;
            if (Utils.distance(this.x, this.y, this.targetX, this.targetY) < 10) {
                const nearby = GameEngine.enemyGrid.query(this.x, this.y, 100);
                let hits = 0;
                for (let e of nearby) {
                    if (!e.alive || e.data.isBAD) continue;
                    if (hits >= this.pierce) break;
                    let wasMoab = e.data.isMoab; 
                    e.tier = 1;
                    e.data = { ...EnemyTypes[1], speed: EnemyTypes[1].speed * (GameEngine.difficulty ? GameEngine.difficulty.speedMod : 1.0) };
                    e.hp = 1; e.alive = true; 
                    hits += wasMoab ? 10 : 1; 
                }
                GameEngine.explosions.push({ x: this.x, y: this.y, radius: 0, maxRadius: 100, life: 0.5, maxLife: 0.5, color: '#9b59b6' });
                this.alive = false;
            }
            return;
        }

        if (this.type === 'mortar_shell') {
            this.t = 1 - (this.life / this.maxLife);
            if (this.t >= 1) { this.alive = false; this.hit(null); return; }
            this.x = Utils.lerp(this.startX, this.targetX, this.t);
            this.y = Utils.lerp(this.startY, this.targetY, this.t);
            return; 
        }

        if (this.type === 'ninja' && this.tower && this.tower.stats.seeking) {
            if (!this.target || !this.target.alive) {
                let nearby = GameEngine.enemyGrid.query(this.x, this.y, 250);
                let bestDist = 250;
                for (let e of nearby) {
                    if (!e.alive) continue;
                    let d = Utils.distance(this.x, this.y, e.x, e.y);
                    if (d < bestDist) { bestDist = d; this.target = e; }
                }
            }
            if (this.target && this.target.alive) {
                let targetAngle = Utils.angle(this.x, this.y, this.target.x, this.target.y);
                let diff = targetAngle - this.angle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                let turnSpeed = 12 * dt; 
                if (Math.abs(diff) < turnSpeed) { this.angle = targetAngle; } else { this.angle += Math.sign(diff) * turnSpeed; }
            }
        }

        if (this.type === 'boomerang') {
            let prevT = this.t;
            this.t += dt / this.lifespan;
            if (this.t >= 1) { this.alive = false; return; }
            if (prevT < 0.5 && this.t >= 0.5) this.hitEnemies.clear(); 
            let currentAngle = this.startAng + this.t * Math.PI * 2 * this.curveDir;
            this.x = this.mx + this.r * Math.cos(currentAngle);
            this.y = this.my + this.r * Math.sin(currentAngle);
            this.angle += 0.3; 
        } else if (this.type !== 'spike') { 
            if (this.target && this.target.alive && this.type !== 'tack' && this.type !== 'dart' && this.type !== 'ninja' && this.type !== 'nail' && this.type !== 'potion' && this.type !== 'spike_opult' && this.type !== 'juggernaut' && this.type !== 'ultra_juggernaut' && this.type !== 'arrow' && this.type !== 'fire') {
                this.angle = Utils.angle(this.x, this.y, this.target.x, this.target.y);
            } else if (this.target && !this.target.alive && this.type !== 'tack' && this.type !== 'dart' && this.type !== 'ninja' && this.type !== 'nail' && this.type !== 'potion') {
                this.target = null;
            }
            this.x += Math.cos(this.angle) * this.speed * dt; 
            this.y += Math.sin(this.angle) * this.speed * dt;
        } else {
            this.x += Math.cos(this.angle) * this.speed * dt; 
            this.y += Math.sin(this.angle) * this.speed * dt;
            this.speed *= 0.9; 
        }

        if (this.x < -50 || this.x > CANVAS_W + 50 || this.y < -50 || this.y > CANVAS_H + 50) { this.alive = false; return; }

        const nearby = GameEngine.enemyGrid.query(this.x, this.y, this.radius + 40);
        for (let e of nearby) { 
            if (!e.alive || this.hitEnemies.has(e)) continue; 
            if (e.isCamo && !(this.tower && (this.tower.stats.canSeeCamo || this.tower.buffedCamo))) continue; 
            if (Utils.distance(this.x, this.y, e.x, e.y) < e.data.radius + this.radius) { 
                this.hit(e); this.hitEnemies.add(e); if (!this.alive) break; 
            } 
        }
    }
    
    split() {
        this.hasSplit = true;
        for(let i=0; i<6; i++) {
            let ang = (i / 6) * Math.PI * 2;
            let p = GameEngine.projectilePool.get();
            p.init(this.x, this.y, 2, null, 'juggernaut_sub', 400, 10, 1.0, ang, null, 0, this.tower, this.dmgType);
            p.bonusCeramic = this.bonusCeramic;
        }
    }
    
    hit(enemy) {
        if (this.type === 'bomb' || this.type === 'mortar_shell' || this.type === 'potion' || this.type === 'flash_bomb' || this.type === 'sticky_bomb' || (this.effects && this.effects.isExplosive)) {
            let expRadius = this.effects && this.effects.explosionRadius ? this.effects.explosionRadius : (this.tower ? this.tower.stats.explosionRadius : 60);
            GameEngine.explosions.push({ x: this.x, y: this.y, radius: 0, maxRadius: expRadius, life: 0.3, maxLife: 0.3, color: this.type === 'potion' ? '#9b59b6' : '#e67e22' });
            
            let bombCanHitLead = this.tower ? (this.tower.stats.canHitLead || this.tower.buffedLead) : true;
            let bombDmgType = createDmgType(DamageType.EXPLOSION, {
                isFire: this.dmgType.isFire, isAcid: this.type === 'potion', moabDmg: this.dmgType.moabDmg || 0, 
                fortifiedDmg: this.dmgType.fortifiedDmg || 0, canHitLead: bombCanHitLead
            });

            const nearby = GameEngine.enemyGrid.query(this.x, this.y, expRadius);
            let hits = 0;
            let maxPierce = (this.effects && this.effects.explosionPierce) ? this.effects.explosionPierce : ((this.tower && this.tower.stats.explosionPierce) ? this.tower.stats.explosionPierce : 100);
            
            for (let e of nearby) { 
                if (hits >= maxPierce) break; 
                if (!e.alive) continue;
                if (e.data.blocksDamageType && e.data.blocksDamageType(bombDmgType)) continue; 
                if (e.isCamo && !(this.tower && (this.tower.stats.canSeeCamo || this.tower.buffedCamo))) continue; 
                if (Utils.distance(this.x, this.y, e.x, e.y) < expRadius) { 
                    let expDmg = (this.effects && this.effects.explosionDamage) ? this.effects.explosionDamage : (this.tower ? this.tower.stats.explosionDamage : 2);
                    let dmg = e.takeDamage(expDmg, bombDmgType, this.effects); 
                    if (dmg === -1) continue; 
                    if(this.tower) this.tower.damageDealt += dmg; 
                    hits++;
                } 
            }
            
            if (this.type === 'arrow') { this.pierce--; if (this.pierce <= 0) this.alive = false; } 
            else { this.alive = false; }
        } else {
            let dmg = this.damage;
            if (this.bonusCeramic && enemy.data.isCeramic) dmg += this.bonusCeramic;
            let actualDmg = enemy.takeDamage(dmg, this.dmgType, this.effects); 
            
            if (actualDmg === -1) { this.alive = false; return; }
            if(this.tower) this.tower.damageDealt += actualDmg;
            if (this.effects && this.effects.slow) enemy.applySlow(this.effects.slow, this.effects.slowDuration, this.type === 'ice'); 
            
            if (this.type === 'ninja' && this.target === enemy) { this.target = null; }

            this.pierce--; 
            if (this.pierce <= 0 && this.type !== 'boomerang') {
                if (this.type === 'ultra_juggernaut' && !this.hasSplit) { this.split(); }
                this.alive = false;
            }
        }
    }
    
    draw(ctx) { 
        if (this.type === 'mortar_shell') {
            let arcHeight = 150;
            let yOffset = -4 * arcHeight * this.t * (1 - this.t);
            ctx.save(); ctx.translate(this.x, this.y + yOffset);
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
            ctx.restore(); return;
        }

        const assetKey = Names.getProjectile(this.type);
        const asset = Assets.get(assetKey);
        if (asset && asset.loaded) {
            let targetSize = 18; 
            if (this.type === 'bomb') targetSize = 22;
            if (this.type === 'spike' || this.type === 'spike_opult') targetSize = 20;
            if (this.type === 'juggernaut' || this.type === 'ultra_juggernaut') targetSize = 24;
            if (this.type === 'arrow' || this.type === 'fire') targetSize = 30; 
            if (this.type === 'ninja') targetSize = 20; 
            if (this.type === 'flash_bomb') targetSize = 24; 
            if (this.type === 'sticky_bomb') targetSize = 20; 
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
            drawImageCentered(ctx, asset, targetSize);
            ctx.restore(); return;
        }
        
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle); 
        const drawer = ProjectileDrawers[this.type] || ProjectileDrawers.dart;
        drawer(ctx, this);
        ctx.restore(); 
    }
}