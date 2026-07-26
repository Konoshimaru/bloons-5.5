// js/beastEntity.js
import { GameEngine } from './engine.js';
import { Utils } from './utils.js';
import { RANGE_SCALE } from './config.js';
import { GLOBAL_SCALE } from './constants.js';
import { LAND_BEASTS } from './towers/beast.js';
import { createDmgType, resolveDmgType } from './damageTypes.js'; // FIX: Import standard damage pipeline

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
        // FIX: Use the shared effective range formula (includes Village buffs and Night mode)
        const scale = typeof RANGE_SCALE === 'number' ? RANGE_SCALE : 3.0;
        const baseRange = typeof this.stats.range === 'number' ? this.stats.range : 100;
        const buffMult = typeof this.buffedRange === 'number' ? this.buffedRange : 0; // Village buff
        const alchRange = 0; // Beasts don't inherit alch range currently
        const nightMod = 1.0 - (0.5 * (engine.nightAlpha || 0));
        
        const effRange = baseRange * scale * (1 + buffMult + alchRange) * nightMod * GS;
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
        
        // FIX: Use standard damage type pipeline so immunities (Lead, Purple, Frozen) work correctly
        const baseDmgType = resolveDmgType(this.stats.dmgType); // 'sharp', 'normal', 'shatter', etc.
        const dmgType = createDmgType(baseDmgType, {
            ceramicDmg: this.stats.ceramicDmg || 0
        });
        
        let damage = this.stats.damage;
        
        // FIX: Apply bonus stun damage dynamically if the target is stunned
        if (this.stats.stunDmg && target.stunTimer > 0) {
            damage += this.stats.stunDmg;
        }
        
        p.init(this.x, this.y, damage, target, this.stats.projectileType, 600, this.stats.pierce, 0.1, null, {}, 0, this.ownerTower, dmgType);
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