/**
 * SUB-ENTITY PATTERN: FULLY SEPARATE ENTITY
 * =========================================
 * The Beast Handler uses a "Fully Separate Entity" pattern for its minions.
 * Unlike Engineer Sentries or Mermonkey Tentacles which are simple objects 
 * stored in an array on the tower itself, the Beast is a full class instance.
 * 
 * - Lifecycle: Tracked in `GameEngine.beasts[]`, not inside the tower.
 * - Updates: Runs its own `update(dt, engine)` loop via `simulationLoop._updateBeasts()`.
 * - Targeting: Has its own `_findTarget()` and standard targeting modes.
 * - Rendering: Draws itself via `renderer._drawEntities()`.
 * - Data: Imports its stat tables (LAND_BEASTS, etc.) from `beastData.js` 
 *   to avoid circular imports with `towers/beast.js`.
 */
// js/beastEntity.js
import { GameEngine } from './engine.js';
import { Utils } from './utils.js';
import { RANGE_SCALE } from './config.js';
import { GLOBAL_SCALE } from './constants.js';
import { LAND_BEASTS, WATER_BEASTS, AIR_BEASTS } from './beastData.js'; 
import { createDmgType, resolveDmgType } from './damageTypes.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

export class Beast {
    constructor(x, y, terrain, tier, ownerTower) {
        this.x = x;
        this.y = y;
        this.terrain = terrain; 
        this.tier = tier;
        this.ownerTower = ownerTower;
        this.type = 'beast'; 
        this.isMinion = true;
        this.alive = true;
        this.cooldown = 0;
        this.thrashCooldown = 0; 
        this.abilityCooldown = 0;
        this.hitRadius = 14 * GS; 
        this.buffedRange = 0; 
        this.targetingMode = 'First'; 
        this.canChangeTargeting = true;

        this._baseCooldown = 1.0;
        this._cooldownMult = 1.0;

        let dataArray = null;
        if (terrain === 'land') dataArray = LAND_BEASTS;
        else if (terrain === 'water') dataArray = WATER_BEASTS;
        else if (terrain === 'air') dataArray = AIR_BEASTS;

        this.data = dataArray ? dataArray[tier - 1] : null;
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
        
        const dmgRange = this.data.damageRange || 0;
        const bonusDmg = Math.floor(dmgRange * percent);
        const damage = this.data.damage + bonusDmg;
        
        const prcRange = this.data.pierceRange || 0;
        const pierce = this.data.pierce + Math.floor(prcRange * percent);
        
        const rngRange = this.data.rangeRange || 0;
        const range = this.data.range + Math.floor(rngRange * percent);
        
        const cdRange = this.data.cooldownRange || 0;
        const fireRate = this.data.fireRate - (cdRange * percent);
        
        const baseStunDmg = this.data.stunDmg || 0;
        const stunDmg = baseStunDmg + Math.floor(bonusDmg / 3);
        
        this.stats = {
            name: this.data.name,
            range: range,
            damage: damage,
            pierce: pierce,
            fireRate: fireRate,
            dmgType: this.data.dmgType,
            projectileType: 'nail', 
            ceramicDmg: this.data.ceramicDmg || 0,
            stunDmg: stunDmg,
            isAbility: this.data.isAbility || false,
            abilityName: this.data.abilityName,
            abilityCd: this.data.abilityCd,
            isExplosive: this.data.explosionRadius > 0,
            explosionRadius: this.data.explosionRadius || 0,
            knockback: this.data.knockback || 0,
            canHitLead: this.data.canHitLead || false,
            canSeeCamo: this.data.canSeeCamo || false,
            thrashDamage: this.data.thrashDamage || 0,
            thrashFireRate: this.data.thrashFireRate || 0,
            thrashPierce: this.data.thrashPierce || 0,
            thrashRadius: this.data.thrashRadius || 0,
            moabDmg: this.data.moabDmg || 0
        };

        this._baseCooldown = this.stats.fireRate;
    }
    
    drawPortrait(portraitEl) {
        const off = document.createElement('canvas');
        off.width = 110; off.height = 110;
        const offCtx = off.getContext('2d');
        offCtx.translate(55, 65); 
        offCtx.fillStyle = this.stats.color;
        offCtx.beginPath();
        offCtx.arc(0, 0, 30, 0, Math.PI*2); 
        offCtx.fill();
        offCtx.fillStyle = '#34495e';
        offCtx.fillRect(-10, -50, 20, 30); 
        
        portraitEl.style.backgroundImage = `url(${off.toDataURL()})`;
        portraitEl.style.backgroundSize = 'cover';
        portraitEl.style.backgroundPosition = 'center';
    }
    
    getCounterText() {
        return `Dmg Dealt: ${Number(this.damageDealt) || 0}`;
    }

    update(dt, engine) {
        if (!this.alive) return;
        this.cooldown -= dt;
        if (this.thrashCooldown > 0) this.thrashCooldown -= dt;
        if (this.abilityCooldown > 0) this.abilityCooldown -= dt;
        
        if (this.cooldown <= 0) {
            const target = this._findTarget(engine);
            if (target) {
                this._fire(target, engine, false);
                this.cooldown = this.stats.fireRate;
            }
        }
        
        if (this.stats.thrashFireRate > 0 && this.thrashCooldown <= 0) {
            const target = this._findTarget(engine);
            if (target) {
                this._fire(target, engine, true);
                this.thrashCooldown = this.stats.thrashFireRate;
            }
        }
    }

    _findTarget(engine) {
        const effRange = Utils.getEffectiveRange(this, engine);
        const candidates = engine.enemyGrid.query(this.x, this.y, effRange);
        
        let currentTargeting = this.targetingMode || 'First';
        let bestTarget = null;
        let bestVal = (currentTargeting === 'First' || currentTargeting === 'Strong') ? -Infinity : Infinity;
        
        const isBetter = (newVal, oldVal) => {
            if (currentTargeting === 'First' || currentTargeting === 'Strong') return newVal > oldVal;
            return newVal < oldVal;
        };

        for (const e of candidates) { 
            if (!e.alive) continue; 
            if (e.isCamo && !this.stats.canSeeCamo && !this.buffedCamo) continue; 
            
            const distSq = Utils.distanceSq(this.x, this.y, e.x, e.y);
            const eRad = e.radius || 10;
            
            const effRangeWithRad = effRange + eRad;
            if (distSq > effRangeWithRad * effRangeWithRad) continue;
            
            let val = 0;
            if (currentTargeting === 'First' || currentTargeting === 'Last') val = e.distanceTraveled;
            else if (currentTargeting === 'Strong') val = e.data.rbe;
            else val = Math.sqrt(distSq); 
            
            if (isBetter(val, bestVal)) {
                bestVal = val;
                bestTarget = e;
            }
        }
        return bestTarget;
    }

    _fire(target, engine, isThrash) {
        let baseDmgType = resolveDmgType(this.stats.dmgType); 
        let dmgType = createDmgType(baseDmgType, {
            ceramicDmg: this.stats.ceramicDmg || 0,
            moabDmg: (this.ownerTower.stats.moabDmg || 0) + (this.stats.moabDmg || 0),
            fortifiedDmg: this.ownerTower.stats.fortifiedDmg || 0,
            canHitLead: this.stats.canHitLead
        });
        
        let damage = isThrash ? this.stats.thrashDamage : this.stats.damage;
        if (this.stats.stunDmg && target.stunTimer > 0) {
            damage += this.stats.stunDmg;
        }

        let effects = {};
        if (this.stats.knockback > 0) effects.knockback = this.stats.knockback;

        if (this.stats.isExplosive) {
            const expR = (isThrash ? this.stats.thrashRadius : this.stats.explosionRadius) * GS;
            const expPierce = isThrash ? this.stats.thrashPierce : this.stats.pierce;
            
            const expColor = this.terrain === 'water' ? '#3498db' : (this.terrain === 'air' ? '#ecf0f1' : '#e67e22');
            engine.explosions.push({ x: target.x, y: target.y, radius: 0, maxRadius: expR, life: 0.1, maxLife: 0.1, color: expColor });
            Utils.applyAoeDamage(engine, target.x, target.y, expR, damage, dmgType, this, effects, { maxHits: expPierce });
        } else {
            let p = engine.projectilePool.get();
            p.init(this.x, this.y, damage, target, this.stats.projectileType, 600, this.stats.pierce, 0.5, null, effects, 0, this, dmgType);
        }
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
