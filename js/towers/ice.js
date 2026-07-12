// ice.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { RANGE_SCALE } from '../config.js';
import { createDmgType, DamageType } from '../damageTypes.js';

export default {
    stats: { 
        name: "Ice Monkey", cost: 400, range: 20, 
        baseCooldown: 2.16, fireRate: 2.16, 
        damage: 0, pierce: 40, projectileSpeed: 0, 
        lifespan: 0.1, desc: "Freezes nearby bloons in a radial burst.", 
        dmgType: 'ice', projectileType: 'ice', hitRadius: 18, 
        isStaticRotation: true,
        freezeDuration: 1.5
    },
    upgrades: {
        1: [
            {name:"Permafrost", cost:150, desc:"Frozen bloons move 50% slower even after thawing.", extraMods:{permafrost: true}},
            {name:"Cold Snap", cost:350, stat:"canHitLead", amount:true, desc:"Can freeze Lead and detect Camo.", extraMods:{canSeeCamo: true}},
            {name:"Ice Shards", cost:1500, stat:"iceShards", amount:true, desc:"Frozen bloons erupt into 3 shards when popped."},
            {name:"Embrittlement", cost:2300, stat:"embrittlement", amount:true, desc:"Can hit MOABs. Targets take +1 damage and lose Camo/Regrow/Lead.", extraMods:{canHitMoab: true}},
            {name:"Super Brittle", cost:28000, stat:"superBrittle", amount:true, desc:"+5 damage taken. Heavy structural damage to all except BAD."}
        ],
        2: [
            {name:"Enhanced Freeze", cost:200, desc:"Attacks faster and freezes longer.", cooldownMult: 0.81, extraMods:{freezeDuration: 2.0}},
            {name:"Deep Freeze", cost:450, stat:"pierce", amount:5, desc:"+5 pierce. Freeze penetrates 2 layers.", extraMods:{deepFreeze: true}},
            {name:"Arctic Wind", cost:2800, stat:"arcticWind", amount:true, desc:"Passive 50% slow aura. Can freeze water for towers."},
            {name:"Snowstorm", cost:3800, stat:"isAbility", amount:true, desc:"Ability: Freeze all non-MOAB bloons for 6s.", extraMods:{unlocksAbility:true, abilityName:"Snowstorm", abilityCd:30}},
            {name:"Absolute Zero", cost:19200, stat:"absoluteZero", amount:true, desc:"Longer freeze. Immobilizes small MOABs. Buffs all Ice Monkeys."}
        ],
        3: [
            {name:"Larger Radius", cost:150, stat:"range", amount:3, desc:"+15% range."},
            {name:"Re-Freeze", cost:225, stat:"reFreeze", amount:true, desc:"Can re-freeze already frozen bloons."},
            {name:"Cryo Cannon", cost:2250, stat:"cryoCannon", amount:true, desc:"Shoots targeted ice bombs. 1.2s cooldown.", cooldownMult: 0.556, extraMods:{isStaticRotation: false, projectileSpeed: 500, projectileType: 'ice_bomb'}},
            {name:"Icicles", cost:2750, stat:"icicles", amount:true, desc:"Frozen bloons grow icicles that damage passing bloons."},
            {name:"Icicle Impale", cost:30000, stat:"icicleImpale", amount:true, desc:"Massive MOAB damage. Freezes them (except BAD).", extraMods:{projectileType: 'icicle', projectileSpeed: 1500}}
        ]
    },
    
    updateSupport(tower, dt) {
        // Absolute Zero global buff: all Ice Monkeys attack faster
        if (tower.stats.absoluteZero) {
            for (let t of GameEngine.towers) {
                if (t && t.type === 'ice' && t !== tower) {
                    t.buffedFireRate = Math.max(t.buffedFireRate, 0.5);
                }
            }
        }
    },
    
    update(tower, dt) {
        // Arctic Wind passive aura
        if (tower.stats.arcticWind) {
            const auraRange = tower.stats.range * RANGE_SCALE;
            const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, auraRange);
            for (let e of nearby) {
                if (!e.alive) continue;
                if (Utils.distance(tower.x, tower.y, e.x, e.y) < auraRange) {
                    // Skip immune types unless Cold Snap
                    if (e.data.isWhite || e.data.isZebra) continue;
                    if (e.data.isLead && !tower.stats.canHitLead) continue;
                    if (e.isCamo && !tower.stats.canSeeCamo) continue;
                    if (e.data.isMoab && !tower.stats.embrittlement) continue;
                    
                    if (tower.stats.reFreeze) {
                        // Re-Freeze synergy: keep them frozen
                        e.applySlow(0.0, 0.1, true);
                    } else {
                        // Just slow
                        e.applySlow(0.5, 0.1, false);
                    }
                    
                    // Permafrost in aura
                    if (tower.stats.permafrost) {
                        e.permafrostSlow = 0.5;
                    }
                }
            }
        }
        
        // Icicles passive: frozen bloons damage nearby unfrozen bloons
        if (tower.stats.icicles) {
            tower._icicleTick = (tower._icicleTick || 0) - dt;
            if (tower._icicleTick <= 0) {
                tower._icicleTick = 0.3; // Check every 0.3s
                const range = tower.stats.range * RANGE_SCALE;
                const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, range);
                for (let e of nearby) {
                    if (!e.alive || !e.isFrozen) continue;
                    if (Utils.distance(tower.x, tower.y, e.x, e.y) > range) continue;
                    
                    // Damage nearby unfrozen bloons
                    const icicleRange = 35;
                    const passersby = GameEngine.enemyGrid.query(e.x, e.y, icicleRange);
                    for (let p of passersby) {
                        if (!p.alive || p.isFrozen) continue;
                        if (Utils.distance(e.x, e.y, p.x, p.y) < icicleRange) {
                            p.takeDamage(1, { isSharp: true, canHitLead: true });
                            p.applySlow(0.5, 0.5, false);
                        }
                    }
                }
            }
        }
    },
    
    fire(tower, target, damage, dmgType, isCrit, effects) {
        // Icicle Impale (Tier 5 Path 3): Fast, heavy MOAB-damaging projectile
        if (tower.stats.icicleImpale) {
            let p = GameEngine.projectilePool.get();
            let impaleDmgType = createDmgType(DamageType.ICE, { moabDmg: 30, canHitLead: true });
            let impaleEffects = { 
                freeze: true, 
                freezeDuration: 2.0,
                permafrost: tower.stats.permafrost || false,
                embrittlement: tower.stats.embrittlement || false,
                superBrittle: tower.stats.superBrittle || false,
                freezeDurationStat: tower.stats.freezeDuration || 1.5
            };
            p.init(tower.x, tower.y, damage, target, 'icicle', 1500, tower.stats.pierce, 0.8, null, impaleEffects, 0, tower, impaleDmgType);
            return;
        }
        
        // Cryo Cannon (Tier 3+ Path 3): Targeted ice bomb projectile
        if (tower.stats.cryoCannon) {
            let p = GameEngine.projectilePool.get();
            let bombEffects = { 
                isExplosive: true, 
                explosionRadius: 40, 
                explosionDamage: damage, 
                explosionPierce: 20,
                freeze: true, 
                freezeDuration: tower.stats.freezeDuration || 1.5,
                permafrost: tower.stats.permafrost || false,
                embrittlement: tower.stats.embrittlement || false,
                superBrittle: tower.stats.superBrittle || false,
                iceShards: tower.stats.iceShards || false,
                deepFreeze: tower.stats.deepFreeze || false,
                canHitMoab: tower.stats.embrittlement || false,
                canSeeCamo: tower.stats.canSeeCamo || false,
                canHitLead: tower.stats.canHitLead || false,
                reFreeze: tower.stats.reFreeze || false
            };
            p.init(tower.x, tower.y, damage, target, 'ice_bomb', 500, 1, 0.5, null, bombEffects, 0, tower, dmgType);
            return;
        }
        
        // Base: Radial AoE pulse
        let expRadius = tower.stats.range * RANGE_SCALE; 
        GameEngine.explosions.push({ x: tower.x, y: tower.y, radius: 0, maxRadius: expRadius, life: 0.2, maxLife: 0.2, color: '#1abc9c' });
        const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, expRadius);
        let hits = 0;
        
        for (let e of nearby) {
            if (hits >= tower.stats.pierce) break;
            if (!e.alive) continue;
            
            // Immunity checks
            if (e.data.isWhite || e.data.isZebra) continue;
            if (e.data.isLead && !tower.stats.canHitLead) continue;
            if (e.isCamo && !tower.stats.canSeeCamo) continue;
            
            // MOAB handling
            if (e.data.isMoab) {
                if (tower.stats.superBrittle) {
                    if (e.data.isBAD) continue; // BAD immune to Super Brittle damage
                    e.brittle = true;
                    e.brittleBonus = 5;
                    e.brittleTimer = 4.0;
                    e.isCamo = false;
                    e.takeDamage(10, { isExplosion: true, canHitLead: true });
                    tower.damageDealt += 10;
                } else if (tower.stats.embrittlement) {
                    e.brittle = true;
                    e.brittleBonus = 1;
                    e.brittleTimer = 4.0;
                    e.isCamo = false;
                }
                // MOABs don't get frozen by the pulse (only Icicle Impale can freeze MOABs)
                continue;
            }
            
            // Re-Freeze check: skip already frozen bloons unless Re-Freeze is unlocked
            if (e.isFrozen && !tower.stats.reFreeze) continue;
            
            if (Utils.distance(tower.x, tower.y, e.x, e.y) < expRadius) {
                let freezeDur = tower.stats.freezeDuration || 1.5;
                
                // Apply freeze
                e.applySlow(0.0, freezeDur, true);
                
                // Permafrost: persistent slow after thawing
                if (tower.stats.permafrost) {
                    e.permafrostSlow = 0.5;
                }
                
                // Deep Freeze: penetrate layers
                if (tower.stats.deepFreeze) {
                    e.deepFreezeLayers = 2;
                }
                
                // Embrittlement debuff on regular bloons
                if (tower.stats.superBrittle) {
                    e.brittle = true;
                    e.brittleBonus = 5;
                    e.brittleTimer = 4.0;
                    e.isCamo = false;
                    // Heavy damage to regular bloons too
                    let dmg = e.takeDamage(5, { isExplosion: true, canHitLead: true });
                    if (!isNaN(dmg) && dmg !== -1) tower.damageDealt += dmg;
                } else if (tower.stats.embrittlement) {
                    e.brittle = true;
                    e.brittleBonus = 1;
                    e.brittleTimer = 4.0;
                    e.isCamo = false;
                }
                
                hits++;
            }
        }
    },
    
    ability(tower, engine) {
        let isAbsolute = tower.stats.absoluteZero || false;
        let duration = isAbsolute ? 8.0 : 6.0;
        
        engine.log(isAbsolute ? "Absolute Zero!" : "Snowstorm!");
        for (let e of engine.enemies) {
            if (!e.alive) continue;
            if (e.data.isBAD) continue; // BADs are always immune
            
            if (e.data.isMoab) {
                if (isAbsolute) {
                    // Absolute Zero: freeze small MOABs (MOAB, BFB), slow big ones
                    if (e.tier <= 14) { // MOAB and BFB
                        e.applySlow(0.0, duration, true);
                    } else {
                        e.applySlow(0.3, duration, false); // ZOMG, DDT: severe slow
                    }
                } else {
                    // Snowstorm: severely slow MOABs
                    e.applySlow(0.3, duration, false);
                }
            } else {
                // Regular bloons: full freeze
                e.applySlow(0.0, duration, true);
            }
        }
        engine.explosions.push({ x: 640, y: 360, radius: 0, maxRadius: 1280, life: 0.8, maxLife: 0.8, color: '#1abc9c' });
    }
};