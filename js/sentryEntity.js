// js/sentryEntity.js
import { GameEngine } from './engine.js';
import { Utils, drawShadow } from './utils.js';
import { createDmgType, resolveDmgType } from './damageTypes.js';
import { GLOBAL_SCALE } from './constants.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

const _sentryExpScratch = [];
const _sentryCandidatesScratch = [];

export class Sentry {
    constructor(x, y, config, parentTower) {
        this.x = x;
        this.y = y;
        this.type = 'sentry'; 
        this.isMinion = true;
        this.parentTower = parentTower; 
        this.hitRadius = 10 * GS; 
        this.buffedRange = 0; 
        this.targetingMode = 'First'; 
        this.canChangeTargeting = true;

        this._baseCooldown = config.fireRate;
        this._cooldownMult = 1.0;

        this.stats = {
            name: config.name || "Sentry Gun",
            range: config.range,
            damage: config.damage,
            pierce: config.pierce,
            fireRate: config.fireRate,
            dmgType: config.dmgType,
            projCount: config.projCount || 1,
            projSpeed: config.projSpeed || 520,
            projLifespan: config.projLifespan || 0.25,
            effects: config.effects || {},
            explode: config.explode || false,
            explosionDamage: config.explosionDamage || 5,
            explosionPierce: config.explosionPierce || 100,
            explosionRadius: config.explosionRadius || 40,
            ceramicDmg: config.ceramicDmg || 0,
            moabDmg: config.moabDmg || 0,
            color: config.color
        };

        this.maxLife = 25;
        this.life = this.maxLife;
        this.cooldown = 0;
        this.alive = true;

        this.damageDealt = 0;
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
        
        this.life -= dt;
        if (this.life <= 0) {
            if (this.stats.explode) {
                const expR = this.stats.explosionRadius * GS; 
                const expDmg = this.stats.explosionDamage;
                const expPierce = this.stats.explosionPierce;
                engine.explosions.push({ x: this.x, y: this.y, radius: 0, maxRadius: expR, life: 0.3, maxLife: 0.3, color: '#9b59b6' });
                const nearby = engine.enemyGrid.query(this.x, this.y, expR, _sentryExpScratch);
                let hits = 0;
                for (let e of nearby) {
                    if (hits >= expPierce) break;
                    if (Utils.withinRange(this.x, this.y, e.x, e.y, expR)) {
                        e.takeDamage(expDmg, { isPlasma: true, canHitLead: true });
                        hits++;
                    }
                }
            }
            this.alive = false;
            return;
        }

        this.cooldown -= dt;
        if (this.cooldown <= 0) {
            const target = this._findTarget(engine);
            if (target) {
                const parent = this.parentTower;
                const canHitLead = this.stats.effects.canHitLead || (parent && (parent.stats.canHitLead || parent.buffedLead || parent.alchDip)) || false;
                const canHitMoab = this.stats.effects.canHitMoab;
                let sDmgType = createDmgType(resolveDmgType(this.stats.dmgType), {
                    moabDmg: (parent && parent.stats.moabDmg || 0) + (this.stats.moabDmg || 0),
                    fortifiedDmg: (parent && parent.stats.fortifiedDmg) || 0,
                    ceramicDmg: this.stats.ceramicDmg || 0,
                    canHitLead: canHitLead,
                    canHitMoab: canHitMoab
                });
                
                let count = this.stats.projCount || 1;
                for(let j=0; j<count; j++) {
                    let p = engine.projectilePool.get();
                    let projType = this.stats.dmgType === 'plasma' ? 'super' : (this.stats.effects.isExplosive ? 'bomb' : 'nail');
                    p.init(this.x, this.y, this.stats.damage, target, projType, this.stats.projSpeed, this.stats.pierce, this.stats.projLifespan, null, this.stats.effects, 5 * (j - (count-1)/2), this, sDmgType);
                }
                this.cooldown = this.stats.fireRate;
            }
        }
    }

    _findTarget(engine) {
        const effRange = Utils.getEffectiveRange(this, engine);
        const candidates = engine.enemyGrid.query(this.x, this.y, effRange, _sentryCandidatesScratch);
        
        let currentTargeting = this.targetingMode || 'First';
        let bestTarget = null;
        let bestVal = (currentTargeting === 'First' || currentTargeting === 'Strong') ? -Infinity : Infinity;
        
        const isBetter = (newVal, oldVal) => {
            if (currentTargeting === 'First' || currentTargeting === 'Strong') return newVal > oldVal;
            return newVal < oldVal;
        };

        for (const e of candidates) { 
            if (!e.alive) continue; 
            if (this.stats.effects.canHitMoab === false && e.data.isMoab) continue; 
            
            const distSq = Utils.distanceSq(this.x, this.y, e.x, e.y);
            const eRad = e.radius || 10;
            
            const effRangeWithRad = effRange + eRad;
            if (distSq > effRangeWithRad * effRangeWithRad) continue;
            
            let val = 0;
            if (currentTargeting === 'First' || currentTargeting === 'Last') val = e.distanceTraveled;
            else if (currentTargeting === 'Strong') val = e.data.rbe;
            else val = Math.sqrt(distSq); // Close
            
            if (isBetter(val, bestVal)) {
                bestVal = val;
                bestTarget = e;
            }
        }
        return bestTarget;
    }

    draw(ctx) {
        drawShadow(ctx, this.x, this.y, 15 * GS);
        ctx.fillStyle = this.stats.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 8 * GS, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#34495e';
        ctx.fillRect(this.x-3 * GS, this.y-15 * GS, 6 * GS, 8 * GS);
    }
}
