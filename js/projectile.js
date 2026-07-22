// js/projectile.js
import { TowerStats } from './towers/index.js';
import { EnemyTypes } from './data.js';
import { Utils, drawImageCentered } from './utils.js';
import { GameEngine } from './engine.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GLOBAL_SCALE } from './constants.js';
import Assets from './assets.js';
import { Names } from './names.js';
import { ProjectileDrawers } from './projectileDrawers.js';
import ProjectileHitResolution from './projectileHitResolution.js';

const MORTAR_ARC_HEIGHT = 150;
const SEEKING_TURN_SPEED = 12;
const SPIKE_FRICTION = 0.9;
const OFFSCREEN_PADDING = 50;

export class Projectile {
    constructor() {
        this.active = false;
        this.hitEnemies = new Set();
        this.reset();
    }

    init(x, y, damage, target, type, speed, pierce, lifespan, fixedAngle = null, effects = null, angleOffset = 0, tower = null, dmgType = {}, isCrit = false) {
        this.x = x;
        this.y = y;
        this.startX = x;
        this.startY = y;
        
        this.damage = damage;
        this.target = target;
        this.type = type;
        this.speed = speed;
        this.pierce = pierce;
        this.life = lifespan;
        this.maxLife = lifespan;
        
        const baseAngle = fixedAngle !== null ? fixedAngle : (target ? Utils.angle(this.x, this.y, target.x, target.y) : 0);
        this.angle = baseAngle + (angleOffset * Math.PI / 180);
        
        this.radius = this._getRadius(type);
        this.alive = true;
        this.active = true;
        this.effects = effects;
        this.hitEnemies.clear();
        this.tower = tower;
        this.dmgType = dmgType;
        
        this.bonusCeramic = tower ? tower.stats.bonusCeramic : 0;
        this.isCrit = isCrit;
        this.hasSplit = false;
        this.t = 0;
        this.targetTower = null;
        this.buffType = null;
        this.targetX = 0;
        this.targetY = 0;
        
        if (type === 'boomerang' && target) {
            this._initBoomerang(target);
        } else if (type === 'mortar_shell' && target) {
            this._initMortar(target, lifespan);
        }
    }

    _initBoomerang(target) {
        this.targetX = target.x;
        this.targetY = target.y;
        this.mx = (this.startX + this.targetX) / 2;
        this.my = (this.startY + this.targetY) / 2;
        let dx = this.targetX - this.mx;
        let dy = this.targetY - this.my;
        this.r = Math.hypot(dx, dy);
        if (this.r < 10) this.r = 10;
        let targetAng = Math.atan2(dy, dx);
        this.startAng = targetAng + Math.PI;
        this.curveDir = Math.random() < 0.5 ? 1 : -1;
        this.t = 0;
        this.lifespan = 1.5;
        this.life = 1.5;
    }

    _initMortar(target, lifespan) {
        this.targetX = target.x;
        this.targetY = target.y;
        this.arcTime = lifespan;
        this.life = this.arcTime;
        this.maxLife = this.arcTime;
    }

    _getRadius(type) {
        if (type === 'bomb') return 8;
        if (type === 'spike' || type === 'spike_opult' || type === 'juggernaut' || type === 'ultra_juggernaut') return 10;
        return 5;
    }

    reset() {
        this.alive = false;
        this.active = false;
        this.x = 0;
        this.y = 0;
        this.angle = 0;
        this.speed = 0;
        this.target = null;
        this.tower = null;
        this.effects = null;
        this.hitEnemies.clear();
    }

    update(dt) {
        switch (this.type) {
            case 'buff_potion': this._updateBuffPotion(dt); return;
            case 'shrink_potion': this._updateShrinkPotion(dt); return;
            case 'mortar_shell': this._updateMortarShell(dt); return;
            case 'boomerang': this._updateBoomerang(dt); break;
            case 'spike': this._updateSpike(dt); break;
            case 'spike_opult':
            case 'juggernaut':
            case 'ultra_juggernaut':
                if (this.tower && this.tower.type === 'spike') {
                    this._updateSpike(dt);
                } else {
                    this._updateStandard(dt);
                }
                break;
            default: this._updateStandard(dt); break;
        }

        if (this._isOffscreen()) {
            this.alive = false;
            return;
        }

        this._checkCollisions();
    }

    _updateBuffPotion(dt) {
        if (!this.targetTower) {
            this.alive = false;
            return;
        }

        this.angle = Utils.angle(this.x, this.y, this.targetTower.x, this.targetTower.y);
        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;

        if (Utils.withinRange(this.x, this.y, this.targetTower.x, this.targetTower.y, 10)) {
            if (this.buffType === 'brew') {
                this.targetTower.alchBuff = {
                    timer: this.tower.stats.brewTimer || 5,
                    shotsLeft: this.tower.stats.brewShots || 25,
                    dmg: this.tower.stats.brewDmg || 1,
                    range: this.tower.stats.brewRange || 0.1,
                    speed: this.tower.stats.brewSpeed || 0.1,
                    pierce: this.tower.stats.brewPierce || 2,
                    isPerm: this.tower.stats.isPermBrew || false
                };
            } else {
                this.targetTower.alchDip = {
                    timer: 10,
                    shotsLeft: this.tower.stats.brewShots ? this.tower.stats.brewShots : 10,
                    isPerm: this.tower.stats.isPermBrew || false
                };
            }
            this.alive = false;
        }
    }

    _updateShrinkPotion(dt) {
        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;

        if (Utils.withinRange(this.x, this.y, this.targetX, this.targetY, 10)) {
            const nearby = GameEngine.enemyGrid.query(this.x, this.y, 100);
            let hits = 0;
            for (const e of nearby) {
                if (!e.alive || e.data.isBAD) continue;
                if (hits >= this.pierce) break;
                
                const wasMoab = e.data.isMoab;
                e.tier = 1;
                e.data = { ...EnemyTypes[1], speed: EnemyTypes[1].speed * (GameEngine.difficulty ? GameEngine.difficulty.speedMod : 1.0) };
                e.hp = 1;
                e.alive = true;
                hits += wasMoab ? 10 : 1;
            }
            GameEngine.explosions.push({ x: this.x, y: this.y, radius: 0, maxRadius: 100, life: 0.5, maxLife: 0.5, color: '#9b59b6' });
            this.alive = false;
        }
    }

    _updateMortarShell(dt) {
        this.life -= dt;
        this.t = 1 - (this.life / this.maxLife);
        if (this.t >= 1) {
            this.alive = false;
            this.hit(null);
            return;
        }
        this.x = Utils.lerp(this.startX, this.targetX, this.t);
        this.y = Utils.lerp(this.startY, this.targetY, this.t);
    }

    _updateBoomerang(dt) {
        let prevT = this.t;
        this.t += dt / this.lifespan;
        if (this.t >= 1) {
            this.alive = false;
            return;
        }
        if (prevT < 0.5 && this.t >= 0.5) {
            this.hitEnemies.clear();
        }
        let currentAngle = this.startAng + this.t * Math.PI * 2 * this.curveDir;
        this.x = this.mx + this.r * Math.cos(currentAngle);
        this.y = this.my + this.r * Math.sin(currentAngle);
        this.angle += 0.3;
    }

    _updateSpike(dt) {
        if (this.targetX !== 0 || this.targetY !== 0) {
            let distSq = Utils.distanceSq(this.x, this.y, this.targetX, this.targetY);
            if (distSq < 25) {
                this.x = this.targetX;
                this.y = this.targetY;
                this.targetX = 0;
                this.targetY = 0;
                this.speed = 0;
                this.vx = 0;
                this.vy = 0;
            } else {
                let dist = Math.sqrt(distSq);
                this.vx = ((this.targetX - this.x) / dist) * this.speed;
                this.vy = ((this.targetY - this.y) / dist) * this.speed;
                this.x += this.vx * dt;
                this.y += this.vy * dt;
            }
        } else {
            this.x += Math.cos(this.angle) * this.speed * dt;
            this.y += Math.sin(this.angle) * this.speed * dt;
            this.speed *= SPIKE_FRICTION;
        }
        
        this.life -= dt;
        if (this.life <= 0) {
            this.alive = false;
        }
    }

    _updateStandard(dt) {
        if (this.type === 'ninja' && this.tower && this.tower.stats.seeking) {
            this._updateSeeking(dt);
        }

        if (this.target && this.target.alive && this._isHomingType()) {
            this.angle = Utils.angle(this.x, this.y, this.target.x, this.target.y);
        } else if (this.target && !this.target.alive && this._isHomingType()) {
            this.target = null;
        }

        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;

        this.life -= dt;
        if (this.life <= 0) {
            this.alive = false;
        }
    }

    _isHomingType() {
        // FIX: Added super_dart, laser, plasma, sun_ball, dark_blade to nonHomingTypes
        // so they don't overwrite the angle offset (arc spread) every frame.
        const nonHomingTypes = ['tack', 'dart', 'ninja', 'nail', 'potion', 'spike_opult', 'juggernaut', 'ultra_juggernaut', 'arrow', 'fire', 'super_dart', 'laser', 'plasma', 'sun_ball', 'dark_blade'];
        return !nonHomingTypes.includes(this.type);
    }

    _updateSeeking(dt) {
        if (!this.target || !this.target.alive) {
            this._findSeekingTarget();
        }
        if (!this.target || !this.target.alive) return;

        const targetAngle = Utils.angle(this.x, this.y, this.target.x, this.target.y);
        let diff = targetAngle - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const turnSpeed = SEEKING_TURN_SPEED * dt;
        if (Math.abs(diff) < turnSpeed) {
            this.angle = targetAngle;
        } else {
            this.angle += Math.sign(diff) * turnSpeed;
        }
    }

    _findSeekingTarget() {
        const nearby = GameEngine.enemyGrid.query(this.x, this.y, 250);
        let bestDistSq = 250 * 250;
        for (const e of nearby) {
            if (!e.alive) continue;
            const dSq = Utils.distanceSq(this.x, this.y, e.x, e.y);
            if (dSq < bestDistSq) {
                bestDistSq = dSq;
                this.target = e;
            }
        }
    }

    _isOffscreen() {
        return this.x < -OFFSCREEN_PADDING || this.x > CANVAS_WIDTH + OFFSCREEN_PADDING || this.y < -OFFSCREEN_PADDING || this.y > CANVAS_HEIGHT + OFFSCREEN_PADDING;
    }

    draw(ctx) {
        if (this.type === 'mortar_shell') {
            const yOffset = -4 * MORTAR_ARC_HEIGHT * this.t * (1 - this.t);
            ctx.save();
            ctx.translate(this.x, this.y + yOffset);
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
            const targetSize = this._getDrawSize();
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            drawImageCentered(ctx, asset, targetSize);
            ctx.restore();
            return;
        }
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        const drawer = ProjectileDrawers[this.type] || ProjectileDrawers.dart;
        drawer(ctx, this);
        ctx.restore();
    }

    _getDrawSize() {
        switch (this.type) {
            case 'bomb': return 22;
            case 'spike':
            case 'spike_opult': return 20;
            case 'juggernaut':
            case 'ultra_juggernaut': return 24;
            case 'arrow':
            case 'fire': return 30;
            case 'ninja': return 20;
            case 'flash_bomb': return 24;
            case 'sticky_bomb': return 20;
            case 'ice_bomb': return 20;
            case 'icicle': return 24;
            default: return 18;
        }
    }
}

Object.assign(Projectile.prototype, ProjectileHitResolution);