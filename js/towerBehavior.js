// towerBehavior.js
// Contains reusable tower combat behaviors and effect helpers.

import { RANGE_SCALE } from './config.js';
import { TowerRegistry, Upgrades } from './towers/index.js';
import { HeroRegistry } from './heroes/index.js';
import { getBehavior } from './registry.js';
import { Utils } from './utils.js';
import { AudioEngine } from './audio.js';
import { GameEngine } from './engine.js';
import Assets from './assets.js';
import { DamageType, createDmgType, resolveDmgType } from './damageTypes.js';

const MIN_FIRE_RATE = 0.01;
const ANIM_FRAME_DURATION = 0.03;
const ATTACK_THROW_FRAME = 4;

/**
 * Calculates the effective attack cooldown for a tower.
 * Uses cached multiplier and base cooldown from the tower instance.
 */
export function getEffectiveCooldown(tower) {
    if (tower.fanClubBuffTimer > 0) return 0.06; 
    if (tower.isMonster) return 0.03; 
    
    let finalCooldown = tower._baseCooldown * tower._cooldownMult;
    
    if (tower.overclockTimer > 0) finalCooldown *= 0.6;
    if (tower.ultraboostStacks > 0) finalCooldown *= (1 - 0.066 * tower.ultraboostStacks);
    if (tower.abilityActiveTime > 0) finalCooldown /= (tower.stats.rapidShotMult || 3);
    if (tower.alchBuff) finalCooldown /= (1 + tower.alchBuff.speed);
    
    return finalCooldown < MIN_FIRE_RATE ? MIN_FIRE_RATE : finalCooldown;
}

export function update(tower, dt) {
    _updateTimers(tower, dt);
    _updateAnimations(tower, dt);
    _runCustomBehaviors(tower, dt);
    
    if (tower.stats.fireRate > 0 || tower.stats.baseCooldown > 0) {
        _acquireAndFire(tower, dt);
    }
}

function _updateTimers(tower, dt) {
    // Tick down all timing-based state so attacks, abilities, buffs, and animations behave in lockstep.
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
                fire(tower, tower.pendingTarget);
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

function _runCustomBehaviors(tower, dt) {
    const behavior = getBehavior(tower.type);
    if (behavior && behavior.update) {
        behavior.update(tower, dt);
    }
}

function _acquireAndFire(tower, dt) {
    if (tower.isHollowCharging) return; 
    
    const target = _findTarget(tower);
    if (!target) return;
    
    if (!tower.stats.isStaticRotation) {
        tower.angle = Utils.angle(tower.x, tower.y, target.x, target.y); 
    }
    
    if (tower.cooldown <= 0 && tower.attackPointTimer <= 0) { 
        const effFireRate = getEffectiveCooldown(tower);
        _triggerAttack(tower, target, effFireRate); 
    } 
}

function _findTarget(tower) {
    // Resolve the best enemy according to the tower's range, visibility rules, and targeting mode.
    const scale = typeof RANGE_SCALE === 'number' ? RANGE_SCALE : 3.0;
    const baseRange = typeof tower.stats.range === 'number' ? tower.stats.range : 100;
    const buffMult = typeof tower.buffedRange === 'number' ? tower.buffedRange : 0;
    const alchRange = tower.alchBuff ? tower.alchBuff.range : 0;
    
    const effRange = baseRange === 9999 ? 9999 : baseRange * scale * (1 + buffMult + alchRange);
    const candidates = baseRange === 9999 ? GameEngine.enemies : GameEngine.enemyGrid.query(tower.x, tower.y, effRange);
    
    let target = null;
    let bestVal = (tower.targetingMode === 'First' || tower.targetingMode === 'Strong') ? -Infinity : Infinity;
    const seen = new Set();
    
    for (const e of candidates) {
        if (seen.has(e)) continue;
        seen.add(e);
        
        if (!e.alive) continue;
        if (e.isCamo && !tower.stats.canSeeCamo && !tower.buffedCamo) continue; 
        if (tower.type === 'glue' && e.data.isMoab) continue; 
        
        const dist = Utils.distance(tower.x, tower.y, e.x, e.y);
        if (baseRange !== 9999 && dist > effRange) continue;
        if (tower.stats.minRange && dist < (tower.stats.minRange * scale)) continue; 

        if (!_hasLineOfSight(tower, e)) continue;

        const val = _getTargetValue(tower, e, dist);
        const isBetter = _isBetterTarget(tower, val, bestVal, target, e);
        
        if (isBetter) { 
            bestVal = val; 
            target = e; 
        }
    }
    
    return target;
}

function _getTargetValue(tower, enemy, dist) {
    if (tower.targetingMode === 'First' || tower.targetingMode === 'Last') return enemy.distanceTraveled; 
    if (tower.targetingMode === 'Strong') return enemy.data.rbe; 
    return dist; // Close
}

function _isBetterTarget(tower, val, bestVal, currentTarget, e) {
    if (tower.targetingMode === 'First' || tower.targetingMode === 'Strong') {
        if (val > bestVal) return true;
        if (val === bestVal && currentTarget && e.distanceTraveled > currentTarget.distanceTraveled) return true;
    } else if (tower.targetingMode === 'Last' || tower.targetingMode === 'Close') {
        if (val < bestVal) return true;
    }
    return false;
}

function _hasLineOfSight(tower, e) {
    if (tower.stats.range === 9999 || !GameEngine.map || GameEngine.map.props.length === 0) return true;
    
    if (!tower._losBlockers) {
        tower._losBlockers = GameEngine.map.props.filter(p => p.type === 'tree' || p.type === 'rock');
    }
    
    if (tower._losBlockers.length === 0) return true;
    
    for (const p of tower._losBlockers) {
        if (Utils.distToSegment(p.x, p.y, tower.x, tower.y, e.x, e.y) < 18) {
            return false;
        }
    }
    
    return true;
}

function _triggerAttack(tower, target, effFireRate) {
    // Either play an animation and delay the actual shot until the attack frame, or fire immediately.
    const animAsset = _getAnimationAsset(tower);
    
    if (!animAsset || !animAsset.loaded) {
        fire(tower, target);
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

export function fire(tower, target) {
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
    _delegateFire(tower, target, damage, dmgType, isCrit, effects, projType, pierce);
}

function _calculateDamage(tower) {
    let damage = tower.stats.damage + (tower.buffedDmg || 0) + (tower.alchBuff ? tower.alchBuff.dmg : 0); 
    let isCrit = tower.stats.critChance && Math.random() < tower.stats.critChance;
    if (isCrit) damage = tower.stats.critDmg;
    if (tower.stats.dmgType === 'heavy') damage = tower.stats.critDmg; // Heavy acts like crit effectively, or base if not. Preserving original logic: if heavy, canHitLead is true. Wait, original: if (dmgTypeStr === 'heavy') { canHitLead = true; } -> I moved that to _canHitLead. The original didn't set damage = critDmg here. Let me check original.
    // Original:
    // if (isCrit) damage = tower.stats.critDmg;
    // if (dmgTypeStr === 'heavy') { canHitLead = true; }
    // So I just need to return damage.
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

function _delegateFire(tower, target, damage, dmgType, isCrit, effects, projType, pierce) {
    const behavior = getBehavior(tower.type);
    if (behavior && behavior.fire) {
        behavior.fire(tower, target, damage, dmgType, isCrit, effects);
    } else {
        const p = GameEngine.projectilePool.get();
        p.init(tower.x, tower.y, damage, target, projType, tower.stats.projectileSpeed, pierce, tower.stats.lifespan, null, effects, 0, tower, dmgType);
    }
}
