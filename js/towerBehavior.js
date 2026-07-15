// towerBehavior.js
import { RANGE_SCALE } from './config.js';
import { GLOBAL_SCALE } from './constants.js';
import { TowerRegistry, Upgrades } from './towers/index.js';
import { HeroRegistry } from './heroes/index.js';
import { getBehavior } from './registry.js';
import { Utils } from './utils.js';
import { AudioEngine } from './audio.js';
import Assets from './assets.js';
import { DamageType, createDmgType, resolveDmgType } from './damageTypes.js';

// PRO FIX: Safe fallback to prevent NaN crashes if import fails
const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

const MIN_FIRE_RATE = 0.01;
const ANIM_FRAME_DURATION = 0.03;
const ATTACK_THROW_FRAME = 4;

export function getEffectiveCooldown(tower) {
    if (tower.fanClubBuffTimer > 0) return 0.06;
    if (tower.isMonster) return 0.03;

    let finalCooldown = tower._baseCooldown * tower._cooldownMult;

    if (tower.overclockTimer > 0) finalCooldown *= 0.6;
    if (tower.ultraboostStacks > 0) finalCooldown *= (1 - 0.066 * tower.ultraboostStacks);
    if (tower.abilityActiveTime > 0) finalCooldown /= (tower.stats.rapidShotMult || 3);
    if (tower.alchBuff) finalCooldown /= (1 + tower.alchBuff.speed);
    
    // PRO FIX: Elite Defender speed scaling
    if (tower.eliteDefenderSpeedMod) finalCooldown *= tower.eliteDefenderSpeedMod;

    return finalCooldown < MIN_FIRE_RATE ? MIN_FIRE_RATE : finalCooldown;
}

export function update(tower, dt, engine) {
    _updateTimers(tower, dt, engine);
    _updateAnimations(tower, dt);
    _runCustomBehaviors(tower, dt, engine);

    if (tower.stats.fireRate > 0 || tower.stats.baseCooldown > 0) {
        _acquireAndFire(tower, dt, engine);
    }
}

function _updateTimers(tower, dt, engine) {
    tower.cooldown -= dt;
    if (tower.abilityCooldown > 0) tower.abilityCooldown -= dt;
    if (tower.ability2Cooldown > 0) tower.ability2Cooldown -= dt;
    if (tower.ability3Cooldown > 0) tower.ability3Cooldown -= dt; 
    if (tower.abilityActiveTime > 0) tower.abilityActiveTime -= dt;
    if (tower.fanClubBuffTimer > 0) tower.fanClubBuffTimer -= dt;
    if (tower.overclockTimer > 0) tower.overclockTimer -= dt; 
    
    if (tower.alchBuff && !tower.alchBuff.isPerm) {
        tower.alchBuff.timer -= dt;
        if (tower.alchBuff.timer <= 0 || tower.alchBuff.shotsLeft <= 0) tower.alchBuff = null;
    }
    
    if (tower.alchDip && !tower.alchDip.isPerm) {
        tower.alchDip.timer -= dt;
        if (tower.alchDip.timer <= 0 || tower.alchDip.shotsLeft <= 0) tower.alchDip = null;
    }
    
    for (let i = tower.hitscans.length - 1; i >= 0; i--) { 
        tower.hitscans[i].life -= dt; 
        if (tower.hitscans[i].life <= 0) tower.hitscans.splice(i, 1); 
    }
    
    tower.animTimer += dt;
    if (tower.animTimer > 0.2) { 
        tower.animTimer = 0; 
        tower.animFrame++; 
    }

    if (tower.attackPointTimer > 0) {
        tower.attackPointTimer -= dt;
        if (tower.attackPointTimer <= 0) {
            if (tower.pendingTarget && tower.pendingTarget.alive) {
                fire(tower, tower.pendingTarget, engine);
            }
            tower.pendingTarget = null;
            tower.attackPointTimer = 0;
        }
    }
}

function _updateAnimations(tower, dt) {
    if (!tower.attackAnimActive) return;
    
    tower.attackAnimTimer += dt;
    if (tower.attackAnimTimer <= ANIM_FRAME_DURATION) return;
    
    tower.attackAnimTimer = 0;
    tower.attackAnimFrame++;
    
    const prefix = `${tower.attackPrefix}attack_${tower.isFullAnim ? 'full_' : ''}`;
    const nextAsset = Assets.get(`${prefix}${tower.attackAnimFrame}`);
    
    if (!nextAsset || !nextAsset.loaded) {
        tower.attackAnimActive = false;
        tower.attackAnimFrame = 0;
    }
}

function _runCustomBehaviors(tower, dt, engine) {
    const behavior = getBehavior(tower.type);
    if (behavior && behavior.update) {
        behavior.update(tower, dt, engine);
    }
}

function _acquireAndFire(tower, dt, engine) {
    if (tower.isHollowCharging) return; 
    
    // PRO FIX: Spike Factory passive firing logic
    if (tower.type === 'spike') {
        // Only fire if a round is active and cooldown is ready
        if (engine.waveManager.waveActive && tower.cooldown <= 0 && tower.attackPointTimer <= 0) {
            const effFireRate = getEffectiveCooldown(tower);
            // Call fire directly to bypass animation wind-up which breaks with null targets
            fire(tower, null, engine);
            tower.cooldown = effFireRate / (1 + tower.buffedFireRate);
        }
        return;
    }

    const target = _findTarget(tower, engine);
    if (!target) return;
    
    if (!tower.stats.isStaticRotation) {
        tower.angle = Utils.angle(tower.x, tower.y, target.x, target.y); 
    }
    
    if (tower.cooldown <= 0 && tower.attackPointTimer <= 0) { 
        const effFireRate = getEffectiveCooldown(tower);
        _triggerAttack(tower, target, effFireRate, engine); 
    } 
}

function _findTarget(tower, engine) {
    const scale = typeof RANGE_SCALE === 'number' ? RANGE_SCALE : 3.0;
    const baseRange = typeof tower.stats.range === 'number' ? tower.stats.range : 100;
    const buffMult = typeof tower.buffedRange === 'number' ? tower.buffedRange : 0;
    const alchRange = tower.alchBuff ? tower.alchBuff.range : 0;
    
    // PRO FIX: Apply global scale to effective range
    const effRange = baseRange === 9999 ? 9999 : baseRange * scale * (1 + buffMult + alchRange) * GS;
    const candidates = baseRange === 9999 ? engine.enemies : engine.enemyGrid.query(tower.x, tower.y, effRange);
    
    // PRO FIX: Elite Targeting Logic
    let currentTargeting = tower.targetingMode;
    if (currentTargeting === 'Elite') {
        // ISSUE 5 FIX: Read cached leaking status from engine instead of scanning array
        currentTargeting = engine.hasLeakingEnemy ? 'First' : 'Strong';
    }

    // ISSUE 6 FIX: Track top 3 targets ignoring LOS, then check LOS only on them
    let t1 = null, v1 = (currentTargeting === 'First' || currentTargeting === 'Strong') ? -Infinity : Infinity;
    let t2 = null, v2 = v1;
    let t3 = null, v3 = v1;

    const isBetter = (newVal, oldVal) => {
        if (currentTargeting === 'First' || currentTargeting === 'Strong') return newVal > oldVal;
        return newVal < oldVal;
    };

    for (const e of candidates) {
        if (!e.alive) continue;
        if (e.isCamo && !tower.stats.canSeeCamo && !tower.buffedCamo) continue; 
        if (tower.type === 'glue' && e.data.isMoab) continue; 
        
        const dist = Utils.distance(tower.x, tower.y, e.x, e.y);
        if (baseRange !== 9999 && dist > effRange) continue;
        // PRO FIX: Apply global scale to minRange
        if (tower.stats.minRange && dist < (tower.stats.minRange * scale * GS)) continue; 

        // NOTE: LOS check removed from loop body for performance profiling optimization
        const val = _getTargetValue(tower, e, dist, currentTargeting);
        
        if (isBetter(val, v1)) {
            t3 = t2; v3 = v2;
            t2 = t1; v2 = v1;
            t1 = e; v1 = val;
        } else if (isBetter(val, v2)) {
            t3 = t2; v3 = v2;
            t2 = e; v2 = val;
        } else if (isBetter(val, v3)) {
            t3 = e; v3 = val;
        }
    }
    
    // ISSUE 6 FIX: Run LOS check only on the top 3 evaluated candidates
    if (t1) {
        if (_hasLineOfSight(tower, t1, engine)) return t1;
        if (t2 && _hasLineOfSight(tower, t2, engine)) return t2;
        if (t3 && _hasLineOfSight(tower, t3, engine)) return t3;
    }
    
    return null;
}

function _getTargetValue(tower, enemy, dist, targetingMode) {
    if (targetingMode === 'First' || targetingMode === 'Last') return enemy.distanceTraveled; 
    if (targetingMode === 'Strong') return enemy.data.rbe; 
    return dist; // Close
}

function _isBetterTarget(tower, val, bestVal, currentTarget, e, targetingMode) {
    // NOTE: Kept for compatibility/inheritance API, unused in optimized _findTarget
    if (targetingMode === 'First' || targetingMode === 'Strong') {
        if (val > bestVal) return true;
        if (val === bestVal && currentTarget && e.distanceTraveled > currentTarget.distanceTraveled) return true;
    } else if (targetingMode === 'Last' || targetingMode === 'Close') {
        if (val < bestVal) return true;
    }
    return false;
}

function _hasLineOfSight(tower, e, engine) {
    if (tower.stats.range === 9999 || !engine.map || engine.map.props.length === 0) return true;
    
    if (!tower._losBlockers) {
        tower._losBlockers = engine.map.props.filter(p => p.type === 'tree' || p.type === 'rock');
    }
    
    if (tower._losBlockers.length === 0) return true;
    
    for (const p of tower._losBlockers) {
        if (Utils.distToSegment(p.x, p.y, tower.x, tower.y, e.x, e.y) < 18) {
            return false;
        }
    }
    
    return true;
}

function _triggerAttack(tower, target, effFireRate, engine) {
    const animAsset = _getAnimationAsset(tower);
    
    if (!animAsset || !animAsset.loaded) {
        fire(tower, target, engine);
        tower.cooldown = effFireRate / (1 + tower.buffedFireRate);
        return;
    }

    tower.attackAnimActive = true;
    tower.attackAnimFrame = 0;
    tower.attackAnimTimer = 0;
    
    const windupTime = ANIM_FRAME_DURATION * ATTACK_THROW_FRAME;
    const finalWindupTime = windupTime >= effFireRate ? effFireRate * 0.5 : windupTime;
    
    tower.attackPointTimer = finalWindupTime;
    tower.pendingTarget = target;
    tower.cooldown = effFireRate / (1 + tower.buffedFireRate); 
}

function _getAnimationAsset(tower) {
    let prefix = `tower_${tower.type}_`;
    let isFullAnim = false;
    let animAsset = null;

    let bestTier = 0, bestPath = 0;
    for (let p = 1; p <= 3; p++) {
        if (tower.upgrades[p-1] > bestTier) { 
            bestTier = tower.upgrades[p-1]; 
            bestPath = p; 
        }
    }

    if (bestTier > 0) {
        const upgPrefix = `tower_${tower.type}_p${bestPath}_t${bestTier}_`;
        const upgFull = Assets.get(`${upgPrefix}attack_full_0`);
        const upgArm = Assets.get(`${upgPrefix}attack_0`);
        if (upgFull && upgFull.loaded) { prefix = upgPrefix; isFullAnim = true; animAsset = upgFull; }
        else if (upgArm && upgArm.loaded) { prefix = upgPrefix; isFullAnim = false; animAsset = upgArm; }
    }

    if (!animAsset) {
        const baseFull = Assets.get(`${prefix}attack_full_0`);
        const baseArm = Assets.get(`${prefix}attack_0`);
        if (baseFull && baseFull.loaded) { isFullAnim = true; animAsset = baseFull; }
        else if (baseArm && baseArm.loaded) { isFullAnim = false; animAsset = baseArm; }
    }

    if (animAsset) {
        tower.isFullAnim = isFullAnim;
        tower.attackPrefix = prefix;
    }
    
    return animAsset;
}

export function fire(tower, target, engine) {
    if (target && !target.alive) return; 
    AudioEngine.playSfx('shoot'); 
    
    const damage = _calculateDamage(tower);
    const dmgTypeStr = tower.stats.dmgType;
    const canHitLead = _canHitLead(tower);
    const isCrit = _isCriticalHit(tower);
    const projType = tower.stats.projectileType || 'dart';
    const pierce = _calculatePierce(tower);
    const dmgType = _createDamageType(dmgTypeStr, canHitLead, tower);
    const effects = _gatherEffects(tower);
    
    _decrementBuffs(tower);
    _delegateFire(tower, target, damage, dmgType, isCrit, effects, projType, pierce, engine);
}

function _calculateDamage(tower) {
    let damage = tower.stats.damage + (tower.buffedDmg || 0) + (tower.alchBuff ? tower.alchBuff.dmg : 0); 
    let isCrit = tower.stats.critChance && Math.random() < tower.stats.critChance;
    if (isCrit) damage = tower.stats.critDmg;
    // PRO FIX: Removed the 'heavy' dmgType override that was causing undefined damage for Snipers
    return damage;
}

function _canHitLead(tower) {
    let canHitLead = tower.stats.canHitLead || tower.buffedLead || (tower.alchDip ? true : false);
    if (tower.stats.dmgType === 'heavy') canHitLead = true;
    if (tower.fanClubBuffTimer > 0) canHitLead = true;
    return canHitLead;
}

function _isCriticalHit(tower) {
    return tower.stats.critChance && Math.random() < tower.stats.critChance;
}

function _calculatePierce(tower) {
    return tower.stats.pierce + (tower.buffedPierce || 0) + (tower.alchBuff ? tower.alchBuff.pierce : 0);
}

function _createDamageType(dmgTypeStr, canHitLead, tower) {
    let baseDmgType = dmgTypeStr === 'glue' ? DamageType.SHARP : resolveDmgType(dmgTypeStr);
    return createDmgType(baseDmgType, {
        canHitLead: canHitLead,
        moabDmg: tower.stats.moabDmg || 0,
        fortifiedDmg: tower.stats.fortifiedDmg || 0
    });
}

function _gatherEffects(tower) {
    const effects = {};
    if (tower.stats.applyPin) effects.pin = true;
    if (tower.stats.applyFoam) effects.foam = true;
    if (tower.alchDip) effects.alchDip = true; 
    return effects;
}

function _decrementBuffs(tower) {
    if (tower.alchBuff && !tower.alchBuff.isPerm) tower.alchBuff.shotsLeft--;
    if (tower.alchDip && !tower.alchDip.isPerm) tower.alchDip.shotsLeft--;
}

function _delegateFire(tower, target, damage, dmgType, isCrit, effects, projType, pierce, engine) {
    const behavior = getBehavior(tower.type);
    if (behavior && behavior.fire) {
        behavior.fire(tower, target, damage, dmgType, isCrit, effects, engine);
    } else {
        const p = engine.projectilePool.get();
        p.init(tower.x, tower.y, damage, target, projType, tower.stats.projectileSpeed, pierce, tower.stats.lifespan, null, effects, 0, tower, dmgType);
    }
}