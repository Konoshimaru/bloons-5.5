// js/beastEntity.js
import { GameEngine } from './engine.js';
import { Utils } from './utils.js';
import { RANGE_SCALE } from './config.js';
import { GLOBAL_SCALE } from './constants.js';
import { LAND_BEASTS } from './towers/beast.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

export class Beast {
    constructor(x, y, terrain, tier, ownerTower) {
        this.x = x;
        this.y = y;
        this.terrain = terrain; // 'land', 'water', 'air'
        this.tier = tier;
        this.ownerTower = ownerTower;
        this.alive = true;
        this.cooldown = 0;
        this.angle = 0;
        this.abilityCooldown = 0;
        
        this.data = terrain === 'land' ? LAND_BEASTS[tier - 1] : null;
        this.beastPower = this.data ? this.data.basePower : 1;
        
        this.recalculateStats();
    }

    recalculateStats() {
        if (!this.data) return;
        
        let percent = 0;
        if (this.data.maxPower > this.data.basePower) {
            percent = (this.beastPower - this.data.basePower) / (this.data.maxPower - this.data.basePower);
        }
        percent = Math.max(0, Math.min(1, percent));
        
        // Scale stats based on percent
        this.stats = {
            range: this.data.range + Math.floor((this.data.rangeRange || 0) * percent),
            damage: this.data.damage + Math.floor((this.data.damageRange || 0) * percent),
            pierce: this.data.pierce + Math.floor((this.data.pierceRange || 0) * percent),
            fireRate: this.data.fireRate,
            dmgType: this.data.dmgType,
            projectileType: 'nail',
            ceramicDmg: this.data.ceramicDmg || 0,
            stunDmg: this.data.stunDmg || 0,
            isAbility: this.data.isAbility || false,
            abilityName: this.data.abilityName,
            abilityCd: this.data.abilityCd
        };
    }

    update(dt, engine) {
        if (!this.alive) return;
        this.cooldown -= dt;
        if (this.abilityCooldown > 0) this.abilityCooldown -= dt;
        
        if (this.cooldown <= 0) {
            const target = this._findTarget(engine);
            if (target) {
                this._fire(target, engine);
                this.cooldown = this.stats.fireRate;
            }
        }
    }

    _findTarget(engine) {
        const scale = typeof RANGE_SCALE === 'number' ? RANGE_SCALE : 3.0;
        const effRange = this.stats.range * scale * GS;
        const candidates = engine.enemyGrid.query(this.x, this.y, effRange);
        
        let bestTarget = null;
        let bestDist = Infinity;
        
        for (const e of candidates) {
            if (!e.alive) continue;
            const distSq = Utils.distanceSq(this.x, this.y, e.x, e.y);
            if (distSq < effRange * effRange && distSq < bestDist) {
                bestDist = distSq;
                bestTarget = e;
            }
        }
        return bestTarget;
    }

    _fire(target, engine) {
        let p = engine.projectilePool.get();
        let dmgType = { isSharp: this.stats.dmgType === 'sharp', isNormal: this.stats.dmgType === 'normal' };
        if (this.stats.ceramicDmg) dmgType.ceramicDmg = this.stats.ceramicDmg;
        if (this.stats.stunDmg) dmgType.stunDmg = this.stats.stunDmg;
        
        p.init(this.x, this.y, this.stats.damage, target, this.stats.projectileType, 600, this.stats.pierce, 0.1, null, {}, 0, this.ownerTower, dmgType);
    }

    draw(ctx) {
        ctx.fillStyle = '#8e44ad'; 
        ctx.beginPath();
        ctx.arc(this.x, this.y, 12 * GS, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${10 * GS}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('B', this.x, this.y);
    }
}