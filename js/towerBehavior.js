// js/towerBehavior.js
import { RANGE_SCALE } from './config.js';
import { TowerRegistry, Upgrades } from './towers/index.js';
import { HeroRegistry } from './heroes/index.js';
import { Utils } from './utils.js';
import { AudioEngine } from './audio.js';
import { GameEngine } from './engine.js';
import Assets from './assets.js';
import { DamageType, createDmgType } from './damageTypes.js';

// System: Calculates the real attack cooldown using the Multiplicative Engine
export function getEffectiveCooldown(tower) {
    // PRO FIX: Fan Club attacks incredibly fast (0.06s cooldown)
    if (tower.fanClubBuffTimer > 0) return 0.06; 
    if (tower.isMonster) return 0.03; 
    
    let base = tower.stats.baseCooldown || tower.stats.fireRate;
    let mult = 1.0;
    
    for (let p = 0; p < 3; p++) {
        let tier = tower.upgrades[p];
        for (let t = 0; t < tier; t++) {
            let upgradeData = Upgrades[tower.type][p+1][t];
            if (upgradeData && upgradeData.cooldownMult) {
                mult *= upgradeData.cooldownMult;
            }
        }
    }
    
    let finalCooldown = base * mult;
    
    if (tower.overclockTimer > 0) finalCooldown *= 0.6;
    if (tower.ultraboostStacks > 0) finalCooldown *= (1 - 0.066 * tower.ultraboostStacks);
    if (tower.abilityActiveTime > 0) finalCooldown /= (tower.stats.rapidShotMult || 3);
    if (tower.alchBuff) finalCooldown /= (1 + tower.alchBuff.speed);
    
    if (finalCooldown < 0.01) finalCooldown = 0.01;
    return finalCooldown;
}

// System: Main update loop for all towers
export function update(tower, dt) {
    tower.cooldown -= dt;
    if (tower.abilityCooldown > 0) tower.abilityCooldown -= dt;
    if (tower.ability2Cooldown > 0) tower.ability2Cooldown -= dt;
    if (tower.ability3Cooldown > 0) tower.ability3Cooldown -= dt; 
    if (tower.abilityActiveTime > 0) tower.abilityActiveTime -= dt;
    if (tower.fanClubBuffTimer > 0) tower.fanClubBuffTimer -= dt;
    if (tower.overclockTimer > 0) tower.overclockTimer -= dt; 
    
    if (tower.alchBuff) {
        if (!tower.alchBuff.isPerm) {
            tower.alchBuff.timer -= dt;
            if (tower.alchBuff.timer <= 0 || tower.alchBuff.shotsLeft <= 0) tower.alchBuff = null;
        }
    }
    if (tower.alchDip) {
        if (!tower.alchDip.isPerm) {
            tower.alchDip.timer -= dt;
            if (tower.alchDip.timer <= 0 || tower.alchDip.shotsLeft <= 0) tower.alchDip = null;
        }
    }
    
    for (let i = tower.hitscans.length - 1; i >= 0; i--) { 
        tower.hitscans[i].life -= dt; 
        if (tower.hitscans[i].life <= 0) tower.hitscans.splice(i, 1); 
    }
    tower.animTimer += dt;
    if (tower.animTimer > 0.2) { tower.animTimer = 0; tower.animFrame++; }

    if (tower.attackPointTimer > 0) {
        tower.attackPointTimer -= dt;
        if (tower.attackPointTimer <= 0) {
            if (tower.pendingTarget && tower.pendingTarget.alive) fire(tower, tower.pendingTarget);
            tower.pendingTarget = null;
            tower.attackPointTimer = 0;
        }
    }

    if (tower.attackAnimActive) {
        let frameDuration = 0.03; 
        tower.attackAnimTimer += dt;
        if (tower.attackAnimTimer > frameDuration) {
            tower.attackAnimTimer = 0;
            tower.attackAnimFrame++;
            let prefix = `${tower.attackPrefix}attack_${tower.isFullAnim ? 'full_' : ''}`;
            let nextAsset = Assets.get(`${prefix}${tower.attackAnimFrame}`);
            if (!nextAsset || !nextAsset.loaded) {
                tower.attackAnimActive = false;
                tower.attackAnimFrame = 0;
            }
        }
    }

    // Run custom tower behaviors (Farms, Alchemists, Ninjas, etc.)
    const behavior = TowerRegistry[tower.type];
    if (behavior && behavior.update) { behavior.update(tower, dt); }
    
    const heroBehavior = HeroRegistry[tower.type];
    if (heroBehavior && heroBehavior.update) { heroBehavior.update(tower, dt); }
    
    // PRO FIX: Do NOT return early. Run standard targeting for attacking towers.
    if (tower.stats.fireRate > 0 || tower.stats.baseCooldown > 0) {
        acquireAndFire(tower, dt);
    }
}

// System: Targeting Logic
function acquireAndFire(tower, dt) {
    if (tower.isHollowCharging) return; 
    if (tower.stats.fireRate <= 0 && !tower.stats.baseCooldown) return; 
    
    let target = null; 
    let bestVal = (tower.targetingMode === 'First' || tower.targetingMode === 'Strong') ? -Infinity : Infinity;
    
    let scale = (typeof RANGE_SCALE === 'number') ? RANGE_SCALE : 3.0;
    let baseRange = (typeof tower.stats.range === 'number') ? tower.stats.range : 100;
    let buffMult = (typeof tower.buffedRange === 'number') ? tower.buffedRange : 0;
    let effRange = baseRange === 9999 ? 9999 : baseRange * scale * (1 + buffMult + (tower.alchBuff ? tower.alchBuff.range : 0));
    
    const candidates = baseRange === 9999 ? GameEngine.enemies : GameEngine.enemyGrid.query(tower.x, tower.y, effRange);
    const seen = new Set();
    
    for (let e of candidates) {
        if (seen.has(e)) continue; seen.add(e);
        if (!e.alive) continue;
        if (e.isCamo && !tower.stats.canSeeCamo && !tower.buffedCamo) continue; 
        if (tower.type === 'glue' && e.data.isMoab) continue; 
        const dist = Utils.distance(tower.x, tower.y, e.x, e.y);
        if (baseRange !== 9999 && dist > effRange) continue;
        if (tower.stats.minRange && dist < (tower.stats.minRange * scale)) continue; 

        if (baseRange !== 9999 && GameEngine.map && GameEngine.map.props.length > 0) {
            if (!tower._losBlockers) {
                tower._losBlockers = GameEngine.map.props.filter(p => p.type === 'tree' || p.type === 'rock');
            }
            if (tower._losBlockers.length > 0) {
                let hasLoS = true;
                for (let p of tower._losBlockers) {
                    if (Utils.distToSegment(p.x, p.y, tower.x, tower.y, e.x, e.y) < 18) { hasLoS = false; break; }
                }
                if (!hasLoS) continue;
            }
        }

        let val; 
        if (tower.targetingMode === 'First' || tower.targetingMode === 'Last') val = e.distanceTraveled; 
        else if (tower.targetingMode === 'Strong') val = e.data.rbe; 
        else if (tower.targetingMode === 'Close') val = dist;
        
        let isBetter = false;
        if (tower.targetingMode === 'First' || tower.targetingMode === 'Strong') {
            if (val > bestVal) isBetter = true;
            if (tower.targetingMode === 'Strong' && val === bestVal && target && e.distanceTraveled > target.distanceTraveled) isBetter = true;
        } else if (tower.targetingMode === 'Last' || tower.targetingMode === 'Close') {
            if (val < bestVal) isBetter = true;
        }
        if (isBetter) { bestVal = val; target = e; }
    }
    
    if (target) { 
        if (!tower.stats.isStaticRotation) {
            tower.angle = Utils.angle(tower.x, tower.y, target.x, target.y); 
        }
        if (tower.cooldown <= 0 && tower.attackPointTimer <= 0) { 
            let effFireRate = getEffectiveCooldown(tower);
            triggerAttack(tower, target, effFireRate); 
        } 
    }
}

// System: Attack Animation & Windup
function triggerAttack(tower, target, effFireRate) {
    let animAsset = null;
    let isFullAnim = false;
    let prefix = `tower_${tower.type}_`;

    let bestTier = 0, bestPath = 0;
    for (let p = 1; p <= 3; p++) {
        if (tower.upgrades[p-1] > bestTier) { 
            bestTier = tower.upgrades[p-1]; 
            bestPath = p; 
        }
    }

    if (bestTier > 0) {
        let upgPrefix = `tower_${tower.type}_p${bestPath}_t${bestTier}_`;
        let upgFull = Assets.get(`${upgPrefix}attack_full_0`);
        let upgArm = Assets.get(`${upgPrefix}attack_0`);
        if (upgFull && upgFull.loaded) { prefix = upgPrefix; isFullAnim = true; animAsset = upgFull; }
        else if (upgArm && upgArm.loaded) { prefix = upgPrefix; isFullAnim = false; animAsset = upgArm; }
    }

    if (!animAsset) {
        let baseFull = Assets.get(`${prefix}attack_full_0`);
        let baseArm = Assets.get(`${prefix}attack_0`);
        if (baseFull && baseFull.loaded) { isFullAnim = true; animAsset = baseFull; }
        else if (baseArm && baseArm.loaded) { isFullAnim = false; animAsset = baseArm; }
    }

    if (!animAsset || !animAsset.loaded) {
        fire(tower, target);
        tower.cooldown = effFireRate / (1 + tower.buffedFireRate); 
        return;
    }

    tower.attackAnimActive = true;
    tower.attackAnimFrame = 0;
    tower.attackAnimTimer = 0;
    tower.isFullAnim = isFullAnim;
    tower.attackPrefix = prefix;
    
    let frameDuration = 0.03; 
    let throwFrame = 4; 
    let windupTime = frameDuration * throwFrame; 
    
    if (windupTime >= effFireRate) {
        windupTime = effFireRate * 0.5; 
    }
    
    tower.attackPointTimer = windupTime;
    tower.pendingTarget = target;
    tower.cooldown = effFireRate / (1 + tower.buffedFireRate); 
}

// System: Firing Logic
export function fire(tower, target) {
    if (target && !target.alive) return; 
    AudioEngine.playSfx('shoot'); 
    
    let damage = tower.stats.damage + (tower.buffedDmg || 0) + (tower.alchBuff ? tower.alchBuff.dmg : 0); 
    let dmgTypeStr = tower.stats.dmgType;
    let canHitLead = tower.stats.canHitLead || tower.buffedLead;
    if (tower.alchDip) canHitLead = true; 
    
    let isCrit = tower.stats.critChance && Math.random() < tower.stats.critChance;
    if (isCrit) damage = tower.stats.critDmg;
    if (dmgTypeStr === 'heavy') { canHitLead = true; }
    if (tower.fanClubBuffTimer > 0) {
        damage = tower.fanClubType === 'plasma' ? 4 : 2;
        dmgTypeStr = tower.fanClubType === 'plasma' ? 'plasma' : 'sharp';
        canHitLead = true;
    }
    let projType = tower.stats.projectileType || 'dart';
    let pierce = tower.stats.pierce + (tower.buffedPierce || 0) + (tower.alchBuff ? tower.alchBuff.pierce : 0); 
    
    let baseDmgType = DamageType.NONE;
    if (dmgTypeStr === 'sharp' || dmgTypeStr === 'glue') baseDmgType = DamageType.SHARP;
    else if (dmgTypeStr === 'explosion') baseDmgType = DamageType.EXPLOSION;
    else if (dmgTypeStr === 'ice') baseDmgType = DamageType.ICE;
    else if (dmgTypeStr === 'plasma') baseDmgType = DamageType.PLASMA;
    else if (dmgTypeStr === 'energy') baseDmgType = DamageType.ENERGY;
    else if (dmgTypeStr === 'fire') baseDmgType = DamageType.FIRE;
    else if (dmgTypeStr === 'magic') baseDmgType = DamageType.MAGIC;
    else if (dmgTypeStr === 'acid') baseDmgType = DamageType.ACID;
    else if (dmgTypeStr === 'heavy') baseDmgType = DamageType.HEAVY;

    let dmgType = createDmgType(baseDmgType, {
        canHitLead: canHitLead,
        moabDmg: tower.stats.moabDmg || 0,
        fortifiedDmg: tower.stats.fortifiedDmg || 0
    });
    
    let effects = {};
    if (tower.stats.applyPin) effects.pin = true;
    if (tower.stats.applyFoam) effects.foam = true;
    if (tower.alchDip) effects.alchDip = true; 
    
    if (tower.alchBuff && !tower.alchBuff.isPerm) tower.alchBuff.shotsLeft--;
    if (tower.alchDip && !tower.alchDip.isPerm) tower.alchDip.shotsLeft--;
    
    // PRO FIX: Delegate to specific tower OR hero behavior (e.g., Ninja, Dart, Gojo)
    const behavior = TowerRegistry[tower.type] || HeroRegistry[tower.type];
    if (behavior && behavior.fire) {
        behavior.fire(tower, target, damage, dmgType, isCrit, effects);
    } else {
        let p = GameEngine.projectilePool.get();
        p.init(tower.x, tower.y, damage, target, projType, tower.stats.projectileSpeed, pierce, tower.stats.lifespan, null, effects, 0, tower, dmgType);
    }
}