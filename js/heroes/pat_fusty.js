// js/heroes/pat_fusty.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

const _patUpdateScratch = [];
const _patFireScratch = [];

export default {
    stats: { 
        name: "Pat Fusty", cost: 500, range: 27, fireRate: 1.1, damage: 3, projectileSpeed: 0, pierce: 1, 
        lifespan: 0, desc: "Slams Bloons in a short range. Can be placed on land and water.", 
        dmgType: 'normal', projectileType: 'nail', hitRadius: 18, isHero: true, maxLevel: 20, scale: 1.5,
        canPlaceOnWater: true,
        isAbility: false,
        isAbility2: false,
        abilityCd: 45, abilityName: "Rallying Roar",
        ability2Cd: 20, ability2Name: "Big Squeeze",
        ceramicDmg: 2,
        explosionDamage: 2,
        explosionRadius: 8,
        explosionPierce: 10,
        explosionCeramicDmg: 2,
        stunDuration: 0,
        moabStunDuration: 0,
        slapPierce: 8,
        slapRadius: 20,
        squeezeDmg: 9999999,
        squeezeStunDur: 2.2,
        squeezeRange: 60, // Increased from 35 so he can actually reach MOABs
        squeezeDuration: 3.8,
        squeezeCooldown: 5,
        abilities: [
            { lvl: 3, name: "Rallying Roar", desc: "Increases the damage of all nearby towers in Pat Fusty's range for a short time." },
            { lvl: 10, name: "Big Squeeze", desc: "Grabs the strongest MOAB-class Bloon and crushes it to bits over 3.8 seconds. The target is immune to all damage while being crushed. After release, its children are stunned for 2.2 seconds. At level 20, grabs up to 4 bloons and stuns all nearby bloons for 5 seconds." }
        ]
    },
    xpTable: [257, 656, 1425, 2651, 4674, 7382, 11856, 13367, 19409, 23342, 20520, 23726, 21290, 23342, 25394, 27446, 29498, 23470, 24624],
    levels: {
        1: [], 
        2: [{ stat: "explosionRadius", amount: 5 }],
        3: [{ stat: "isAbility", amount: true }],
        4: [{ stat: "fireRate", amount: -0.2 }],
        5: [{ stat: "canSlap", amount: true }],
        6: [{ stat: "explosionRadius", amount: 7 }, { stat: "stunDuration", amount: 0.3 }],
        7: [{ stat: "damage", amount: 1 }, { stat: "explosionDamage", amount: 1 }, { stat: "explosionPierce", amount: 10 }],
        8: [{ stat: "fireRate", amount: -0.15 }],
        9: [{ stat: "range", amount: 3 }],
        10: [{ stat: "isAbility2", amount: true }],
        11: [{ stat: "damage", amount: 1 }, { stat: "explosionDamage", amount: 1 }],
        12: [{ stat: "fireRate", amount: -0.1 }],
        13: [{ stat: "stunDuration", amount: 0.2 }, { stat: "moabStunDuration", amount: 0.2 }],
        14: [{ stat: "canStunMoabs", amount: true }],
        15: [{ stat: "slapPierce", amount: 8 }, { stat: "explosionPierce", amount: 10 }],
        16: [{ stat: "ceramicDmg", amount: 5 }, { stat: "explosionCeramicDmg", amount: 6 }],
        17: [{ stat: "fireRate", amount: -0.1 }],
        18: [{ stat: "explosionPierce", amount: 10 }],
        19: [{ stat: "damage", amount: 5 }, { stat: "explosionDamage", amount: 5 }],
        20: [{ stat: "squeezeDmg", amount: 90 }]
    },
    update(tower, dt) {
        if (tower.attackCount === undefined) tower.attackCount = 0;
        
        if (tower.squeezeActive === undefined) {
            tower.squeezeActive = false;
            tower.squeezeTimer = 0;
            tower.squeezeCooldownTimer = 0;
            tower.squeezeTargets = [];
        }
        
        if (tower.squeezeActive) {
            tower.squeezeTimer -= dt;
            if (tower.squeezeTimer <= 0) {
                for (let target of tower.squeezeTargets) {
                    if (target && target.alive) {
                        // FIX: Remove immunities BEFORE dealing damage!
                        target.untargetable = false;
                        target.collisionImmune = false;
                        target.isSqueezed = false;
                        target.damageImmune = false; 
                        
                        // Deal the 9,999,999 damage to the outer layer
                        target.takeDamage(tower.stats.squeezeDmg, { isExplosion: true, canHitLead: true });
                        
                        // FIX: Apply an AoE stun to catch the children that just spawned
                        Utils.applyAoeDamage(GameEngine, target.x, target.y, 40, 0, {}, tower, { stun: tower.stats.squeezeStunDur }, { maxHits: 100 });
                    } else {
                        // Clean up if it died somehow during squeeze
                        target.untargetable = false;
                        target.collisionImmune = false;
                        target.isSqueezed = false;
                        target.damageImmune = false;
                    }
                }
                tower.squeezeActive = false;
                tower.squeezeTargets = [];
            }
        }
        
        if (tower.squeezeCooldownTimer > 0) {
            tower.squeezeCooldownTimer -= dt;
        }
    },
    draw(ctx, tower, isPreview) {
        tower.drawBaseTower(ctx, isPreview);
    },
    // FIX: Clean up squeeze state if Pat is sold mid-squeeze
    onSell(tower, engine) {
        if (tower.squeezeActive) {
            for (let target of tower.squeezeTargets) {
                if (target && target.alive) {
                    target.untargetable = false;
                    target.collisionImmune = false;
                    target.isSqueezed = false;
                    target.damageImmune = false;
                }
            }
        }
    },
    ability(tower, engine) {
        engine.log("Pat Fusty: Rallying Roar!");
        const effRange = Utils.getEffectiveRange(tower, engine);
        const dmgBuff = tower.level >= 14 ? 3 : (tower.level >= 9 ? 2 : 1);
        const duration = tower.level >= 14 ? 10 : 8;
        
        tower.rallyTimer = duration;
        tower.rallyDmg = dmgBuff;
        
        for (let t of engine.towers) {
            if (t && !t.isMinion && Utils.withinRange(tower.x, tower.y, t.x, t.y, effRange)) {
                t.addBuff('pat_rally', 'Rally', duration, 1, { type: 'pat_rally', amount: dmgBuff });
            }
        }
    },
    // Applies the rally damage buff each frame while Rallying Roar is active.
    // updateSupport() runs before any tower fires (simulationLoop), so the
    // buffedDmg set here is in effect for the whole frame.
    updateSupport(tower, dt) {
        if (!tower.rallyTimer || tower.rallyTimer <= 0) return;
        tower.rallyTimer -= dt;
        const effRange = Utils.getEffectiveRange(tower, GameEngine);
        const dmg = tower.rallyDmg || 1;
        for (let t of GameEngine.towers) {
            if (t && !t.isMinion && Utils.withinRange(tower.x, tower.y, t.x, t.y, effRange)) {
                t.buffedDmg = Math.max(t.buffedDmg || 0, dmg);
            }
        }
    },
    ability2(tower, engine) {
        if (tower.squeezeActive || tower.squeezeCooldownTimer > 0) return;
        
        const effRange = tower.stats.squeezeRange;
        const maxTargets = tower.level >= 20 ? 4 : 1;
        
        let candidates = [];
        for (let e of engine.enemies) {
            if (!e.alive) continue;
            // Correctly detects MOAB-class (MOAB, BFB, ZOMG, DDT) and excludes BAD
            if (!e.data.isMoab || e.data.isBAD) continue;
            if (e.data.isDDT && !tower.stats.canSeeCamo && !tower.buffedCamo) continue;
            
            // FIX: Add the enemy's radius to the range check so huge MOABs are grabbed even if their center is far away
            const eRadius = e.radius || 20;
            if (!Utils.withinRange(tower.x, tower.y, e.x, e.y, effRange + eRadius)) continue;
            
            candidates.push(e);
        }
        
        if (candidates.length === 0) {
            engine.log("No valid MOAB-class bloons in range to squeeze!");
            return;
        }

        candidates.sort((a, b) => b.hp - a.hp);
        let grabbed = candidates.slice(0, maxTargets);
        
        tower.squeezeActive = true;
        tower.squeezeTimer = tower.stats.squeezeDuration;
        tower.squeezeCooldownTimer = tower.stats.squeezeCooldown;
        tower.squeezeTargets = grabbed;
        
        for (let target of grabbed) {
            target.untargetable = true;
            target.damageImmune = true;
            target.collisionImmune = true;
            target.isSqueezed = true; // Freeze movement
        }
        
        if (tower.level >= 20) {
            Utils.applyAoeDamage(engine, tower.x, tower.y, 35, 0, {}, tower, { stun: 5.0 }, { maxHits: 100 });
        }
    },
    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        if (tower.squeezeCooldownTimer > 0) return;
        
        tower.attackCount = (tower.attackCount || 0) + 1;
        
        const isSlap = tower.level >= 5 && tower.attackCount % 5 === 0;
        
        const slamRadius = tower.stats.explosionRadius || 8;
        const slamPierce = tower.stats.explosionPierce || 10;
        const slamDamage = tower.stats.explosionDamage || 2;
        const slamCeramicDmg = tower.stats.explosionCeramicDmg || 2;
        
        engine.explosions.push({ 
            x: target.x, y: target.y, 
            radius: 0, maxRadius: isSlap ? 20 : slamRadius, 
            life: 0.2, maxLife: 0.2, 
            color: isSlap ? '#e67e22' : '#795548' 
        });
        
        let currentEffects = { ...effects };
        
        if (tower.stats.stunDuration > 0) {
            currentEffects.stun = tower.stats.stunDuration;
        }
        
        if (isSlap) {
            // Sustained knockback applied via timer in enemy.js
            const nearby = engine.enemyGrid.query(target.x, target.y, 20, _patUpdateScratch);
            let hits = 0;
            
            for (let e of nearby) {
                if (hits >= (tower.stats.slapPierce || 8)) break;
                if (!e.alive) continue;
                if (e.isCamo && !tower.stats.canSeeCamo && !tower.buffedCamo) continue;
                
                if (Utils.withinRange(target.x, target.y, e.x, e.y, 20)) {
                    if (!e.data.isBAD) {
                        e.patSlapKnockbackTimer = 1.0; // 1 second of sustained backwards movement
                    }
                    
                    const aoeDmg = slamDamage + (e.data.isCeramic ? slamCeramicDmg : 0);
                    e.takeDamage(aoeDmg, dmgType, currentEffects, tower);
                    hits++;
                }
            }
        } else {
            const directDmg = damage + (target.data.isCeramic ? (tower.stats.ceramicDmg || 2) : 0);
            target.takeDamage(directDmg, dmgType, currentEffects, tower);
            
            const aoeDmg = slamDamage;
            const aoeCeramicDmg = slamCeramicDmg;
            
            const nearby = engine.enemyGrid.query(target.x, target.y, slamRadius, _patFireScratch);
            let hits = 0;
            
            for (let e of nearby) {
                if (hits >= slamPierce) break;
                if (!e.alive) continue;
                if (e.isCamo && !tower.stats.canSeeCamo && !tower.buffedCamo) continue;
                
                if (Utils.withinRange(target.x, target.y, e.x, e.y, slamRadius)) {
                    const dmg = aoeDmg + (e.data.isCeramic ? aoeCeramicDmg : 0);
                    e.takeDamage(dmg, dmgType, currentEffects, tower);
                    hits++;
                }
            }
        }
    }
};