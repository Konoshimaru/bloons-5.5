// js/beastEntity.js
import { GameEngine } from './engine.js';
import { Utils } from './utils.js';
import { RANGE_SCALE } from './config.js';
import { GLOBAL_SCALE } from './constants.js';
import { LAND_BEASTS } from './towers/beast.js';
import { createDmgType, resolveDmgType } from './damageTypes.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

export class Beast {
    constructor(x, y, terrain, tier, ownerTower) {
        this.x = x;
        this.y = y;
        this.terrain = terrain; 
        this.tier = tier;
        this.ownerTower = ownerTower;
        this.alive = true;
        this.cooldown = 0;
        this.angle = 0;
        this.abilityCooldown = 0;
        this.buffedRange = 0; // FIX: Required for getEffectiveRange
        
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
        // FIX: Use the exact same helper as towers so range matches perfectly
        const effRange = Utils.getEffectiveRange(this, engine);
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
        
        const baseDmgType = resolveDmgType(this.stats.dmgType); 
        const dmgType = createDmgType(baseDmgType, {
            ceramicDmg: this.stats.ceramicDmg || 0
        });
        
        let damage = this.stats.damage;
        if (this.stats.stunDmg && target.stunTimer > 0) {
            damage += this.stats.stunDmg;
        }
        
        p.init(this.x, this.y, damage, target, this.stats.projectileType, 600, this.stats.pierce, 0.5, null, {}, 0, this.ownerTower, dmgType);
    }

    draw(ctx) {
        const colors = ['#2ecc71', '#27ae60', '#f1c40f', '#e67e22', '#c0392b'];
        const color = colors[(this.tier - 1) % colors.length] || '#8e44ad';
        
        if (this.ownerTower && this.ownerTower.alive) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(this.ownerTower.x, this.ownerTower.y);
            ctx.lineTo(this.x, this.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        ctx.fillStyle = color; 
        ctx.beginPath();
        ctx.arc(this.x, this.y, (10 + this.tier * 2) * GS, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${10 * GS}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`L${this.tier}`, this.x, this.y);
    }
}