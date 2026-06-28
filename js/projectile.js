import { TowerStats } from './towers/index.js';
import { Utils, CANVAS_W, CANVAS_H, drawImageCentered } from './utils.js';
import { GameEngine } from './engine.js';
import Assets from './assets.js';
import { Names } from './names.js';
import { ProjectileDrawers } from './projectileDrawers.js';
import { DamageType, createDmgType } from './damageTypes.js';

export class Projectile {
    constructor(x, y, damage, target, type, speed, pierce, lifespan, fixedAngle = null, effects = null, angleOffset = 0, tower = null, dmgType = {}) {
        this.x = x; this.y = y; this.startX = x; this.startY = y;
        this.damage = damage; this.target = target; this.type = type; this.speed = speed; this.pierce = pierce; this.life = lifespan; this.maxLife = lifespan;

        let baseAngle = fixedAngle !== null ? fixedAngle : (target ? Utils.angle(this.x, this.y, target.x, target.y) : 0);
        this.angle = baseAngle + (angleOffset * Math.PI / 180);

        this.radius = this.type === 'bomb' ? 8 : (this.type === 'spike' ? 10 : 5);
        this.alive = true; this.effects = effects; this.hitEnemies = new Set();
        this.tower = tower; this.dmgType = dmgType;
        this.bonusCeramic = tower ? tower.stats.bonusCeramic : 0;
        this.isCrit = false;
        this.hasSplit = false;
        this.t = 0;

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

    update(dt) {
        if (this.type === 'mortar_shell') {
            this.life -= dt;
            this.t = 1 - (this.life / this.maxLife);
            if (this.t >= 1) {
                this.alive = false;
                this.hit(null);
                return;
            }
            this.x = Utils.lerp(this.startX, this.targetX, this.t);
            this.y = Utils.lerp(this.startY, this.targetY, this.t);
            return;
        }

        this.life -= dt;
        if (this.life <= 0) {
            if (this.type === 'ultra_juggernaut' && !this.hasSplit) this.split();
            this.alive = false; return;
        }

        // PRO FIX: Seeking Shuriken logic
        if (this.type === 'ninja' && this.tower && this.tower.stats.seeking && this.target && this.target.alive) {
            this.angle = Utils.angle(this.x, this.y, this.target.x, this.target.y);
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
            } else if (this.target && !this.target.alive && this.type !== 'tack' && this.type !== 'dart' && this.type !== 'nail' && this.type !== 'potion') {
                this.target = null;
            }
            this.x += Math.cos(this.angle) * this.speed * dt;
            this.y += Math.sin(this.angle) * this.speed * dt;
        } else {
            // Spikes just fall
            this.x += Math.cos(this.angle) * this.speed * dt;
            this.y += Math.sin(this.angle) * this.speed * dt;
            this.speed *= 0.9; // Slow down
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
        for (let i = 0; i < 6; i++) {
            let ang = (i / 6) * Math.PI * 2;
            let p = new Projectile(this.x, this.y, 2, null, 'juggernaut_sub', 400, 10, 1.0, ang, null, 0, this.tower, this.dmgType);
            p.bonusCeramic = this.bonusCeramic;
            GameEngine.projectiles.push(p);
        }
    }

    hit(enemy) {
        if (this.type === 'bomb' || this.type === 'mortar_shell' || this.type === 'potion' || this.type === 'flash_bomb' || this.type === 'sticky_bomb' || (this.effects && this.effects.isExplosive)) {
            let expRadius = this.effects && this.effects.explosionRadius ? this.effects.explosionRadius : (this.tower ? this.tower.stats.explosionRadius : 60);
            GameEngine.explosions.push({ x: this.x, y: this.y, radius: 0, maxRadius: expRadius, life: 0.3, maxLife: 0.3, color: this.type === 'potion' ? '#9b59b6' : '#e67e22' });

            let bombCanHitLead = this.tower ? (this.tower.stats.canHitLead || this.tower.buffedLead) : true;
            let bombDmgType = createDmgType(DamageType.EXPLOSION, {
                isFire: this.dmgType.isFire,
                isAcid: this.type === 'potion',
                moabDmg: this.dmgType.moabDmg || 0,
                fortifiedDmg: this.dmgType.fortifiedDmg || 0,
                canHitLead: bombCanHitLead
            });

            const nearby = GameEngine.enemyGrid.query(this.x, this.y, expRadius);
            let hits = 0;
            let maxPierce = (this.tower && this.tower.stats.explosionPierce) ? this.tower.stats.explosionPierce : 100;

            for (let e of nearby) {
                if (hits >= maxPierce) break;
                if (!e.alive) continue;
                if (e.data.blocksDamageType && e.data.blocksDamageType(bombDmgType)) continue;
                if (e.isCamo && !(this.tower && (this.tower.stats.canSeeCamo || this.tower.buffedCamo))) continue;
                if (Utils.distance(this.x, this.y, e.x, e.y) < expRadius) {
                    let expDmg = (this.effects && this.effects.explosionDamage) ? this.effects.explosionDamage : (this.tower ? this.tower.stats.explosionDamage : 2);
                    let dmg = e.takeDamage(expDmg, bombDmgType, this.effects);
                    if (dmg === -1) continue; // Blocked by immunity
                    if (this.tower) this.tower.damageDealt += dmg;
                    hits++;
                }
            }

            if (this.type === 'arrow') {
                this.pierce--;
                if (this.pierce <= 0) this.alive = false;
            } else {
                this.alive = false;
            }
        } else {
            let dmg = this.damage;
            if (this.bonusCeramic && enemy.data.isCeramic) dmg += this.bonusCeramic;
            let actualDmg = enemy.takeDamage(dmg, this.dmgType, this.effects);

            if (actualDmg === -1) {
                this.alive = false;
                return;
            }

            if (this.tower) this.tower.damageDealt += actualDmg;
            if (this.effects && this.effects.slow) enemy.applySlow(this.effects.slow, this.effects.slowDuration, this.type === 'ice');
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
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        const assetKey = Names.getProjectile(this.type);
        const asset = Assets.get(assetKey);
        if (asset && asset.loaded) {
            let targetSize = 18;
            if (this.type === 'bomb') targetSize = 22;
            if (this.type === 'spike' || this.type === 'spike_opult') targetSize = 20;
            if (this.type === 'juggernaut' || this.type === 'ultra_juggernaut') targetSize = 24;
            if (this.type === 'arrow' || this.type === 'fire') targetSize = 30;
            if (this.type === 'ninja') targetSize = 20; // PRO FIX: Ninja size
            if (this.type === 'flash_bomb') targetSize = 24; // PRO FIX: Flash bomb size
            if (this.type === 'sticky_bomb') targetSize = 20; // PRO FIX: Sticky bomb size
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
            drawImageCentered(ctx, asset, targetSize);
            ctx.restore();
            return;
        }

        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        const drawer = ProjectileDrawers[this.type] || ProjectileDrawers.dart;
        drawer(ctx, this);
        ctx.restore();
    }
}