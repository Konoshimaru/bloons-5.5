// ice.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { RANGE_SCALE } from '../config.js';
import { createDmgType, DamageType } from '../damageTypes.js';

export default {
    stats: { 
        name: "Ice Monkey", cost: 400, range: 20, 
        baseCooldown: 2.4, fireRate: 2.4, 
        damage: 1, pierce: 40, projectileSpeed: 0, 
        lifespan: 0.1, desc: "Freezes nearby bloons in a radial burst.", 
        dmgType: 'ice', projectileType: 'ice', hitRadius: 18, 
        isStaticRotation: true,
        freezeDuration: 1.5
    },
    upgrades: {
        1: [
            {name:"Permafrost", cost:150, desc:"Frozen bloons move 50% slower even after thawing.", extraMods:{permafrost: true}},
            {name:"Cold Snap", cost:350, stat:"canHitLead", amount:true, desc:"Can freeze Lead and detect Camo.", extraMods:{canSeeCamo: true}},
            {name:"Ice Shards", cost:1500, stat:"iceShards", amount:true, desc:"Frozen bloons erupt into 3 shards. Strips Camo/Regrow.", extraMods:{range: 5}},
{name:"Embrittlement", cost:2300, stat:"embrittlement", amount:true, desc:"Can hit MOABs. Targets take +1 damage. Permanently strips Camo/Regrow/Lead."}, // Removed extraMods
            // PRO FIX: Attacks 100% faster (0.5x cooldown)
            {name:"Super Brittle", cost:28000, stat:"superBrittle", amount:true, desc:"+5 damage taken. 6 shards. Attacked 100% faster.", cooldownMult: 0.5}
        ],
        2: [
            {name:"Enhanced Freeze", cost:200, desc:"Attacks faster and freezes longer.", cooldownMult: 0.75, extraMods:{freezeDuration: 1.75}},
            {name:"Deep Freeze", cost:300, stat:"pierce", amount:5, desc:"+5 pierce. Freeze penetrates 2 layers. 2.2s duration.", extraMods:{deepFreeze: true, freezeDuration: 2.2}},
            {name:"Arctic Wind", cost:2750, stat:"arcticWind", amount:true, desc:"Passive 40% slow aura. Can freeze water for towers.", extraMods:{arcticSlowFactor: 0.6}},
            // PRO FIX: Removed duplicate 'stat' key so range applies correctly
{name:"Snowstorm", cost:4000, stat:"range", amount:10, desc:"Ability: Freeze all non-MOAB bloons for 6s.", extraMods:{unlocksAbility:true, abilityName:"Snowstorm", abilityCd:30}}, // Fixed duplicate key            // PRO FIX: Removed duplicate 'stat' keys so absoluteZero applies correctly
            {name:"Absolute Zero", cost:21000, stat:"absoluteZero", amount:true, desc:"Freezes screen for 10s. Buffs Ice Monkeys +50%.", extraMods:{range: 10}}
        ],
        3: [
            // PRO FIX: +7 range
            {name:"Larger Radius", cost:150, stat:"range", amount:7, desc:"+7 range."},
            {name:"Re-Freeze", cost:200, stat:"reFreeze", amount:true, desc:"Can re-freeze already frozen bloons."},
            // PRO FIX: Range +19, freeze duration 1.2s
            {name:"Cryo Cannon", cost:1900, stat:"cryoCannon", amount:true, desc:"Shoots targeted ice bombs. 1.2s cooldown.", cooldownMult: 0.5, extraMods:{isStaticRotation: false, projectileSpeed: 500, projectileType: 'ice_bomb', range: 19, freezeDuration: 1.2}},
            // PRO FIX: +8 MOAB dmg, 2 base damage, 3 icicle damage
            {name:"Icicles", cost:2750, stat:"icicles", amount:true, desc:"Frozen bloons grow icicles. +8 MOAB dmg.", cooldownMult: 0.66, extraMods:{moabDmg: 8, icicleDmg: 3}},
            // PRO FIX: 50 MOAB damage
            {name:"Icicle Impale", cost:30000, stat:"icicleImpale", amount:true, desc:"Massive MOAB damage (+50). Freezes them (except BAD).", extraMods:{projectileType: 'icicle', projectileSpeed: 1500, moabDmg: 50}}
        ]
    },
    
    updateSupport(tower, dt) {
        if (tower.stats.absoluteZero) {
            for (let t of GameEngine.towers) {
                if (t && t.type === 'ice' && t !== tower) {
                    t.buffedFireRate = Math.max(t.buffedFireRate, 0.10);
                    if (tower.absZeroActiveBuff > 0) {
                        t.buffedFireRate = Math.max(t.buffedFireRate, 0.50);
                    }
                }
            }
            if (tower.absZeroActiveBuff > 0) {
                tower.absZeroActiveBuff -= dt;
            }
        }
    },
    
    update(tower, dt) {
        if (tower.stats.arcticWind) {
            const auraRange = tower.stats.range * RANGE_SCALE;
            const slowFactor = tower.stats.arcticSlowFactor || 0.6;
            const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, auraRange);
            for (let e of nearby) {
                if (!e.alive) continue;
                if (Utils.distance(tower.x, tower.y, e.x, e.y) < auraRange) {
                    if (e.data.isWhite || e.data.isZebra) continue;
                    if (e.data.isLead && !tower.stats.canHitLead) continue;
                    if (e.isCamo && !tower.stats.canSeeCamo) continue;
                    if (e.data.isMoab && !tower.stats.embrittlement) continue;
                    
                    if (tower.stats.reFreeze) {
                        e.applySlow(0.0, 0.1, true);
                    } else {
                        e.applySlow(slowFactor, 0.1, false);
                    }
                    if (tower.stats.permafrost) e.permafrostSlow = 0.5;
                }
            }
        }
        
        if (tower.stats.icicles) {
            tower._icicleTick = (tower._icicleTick || 0) - dt;
            if (tower._icicleTick <= 0) {
                tower._icicleTick = 0.3;
                const range = tower.stats.range * RANGE_SCALE;
                const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, range);
                for (let e of nearby) {
                    if (!e.alive || !e.isFrozen) continue;
                    if (Utils.distance(tower.x, tower.y, e.x, e.y) > range) continue;
                    
                    const icicleRange = 35;
                    const passersby = GameEngine.enemyGrid.query(e.x, e.y, icicleRange);
                    for (let p of passersby) {
                        if (!p.alive || p.isFrozen) continue;
                        if (Utils.distance(e.x, e.y, p.x, p.y) < icicleRange) {
                            p.takeDamage(tower.stats.icicleDmg || 3, { isSharp: true, canHitLead: true });
                            p.applySlow(0.5, 0.5, false);
                        }
                    }
                }
            }
        }
    },
    
    fire(tower, target, damage, dmgType, isCrit, effects) {
        if (tower.stats.icicleImpale) {
            let p = GameEngine.projectilePool.get();
            let impaleDmgType = createDmgType(DamageType.ICE, { moabDmg: tower.stats.moabDmg || 50, canHitLead: true });
            let impaleEffects = { 
                freeze: true, freezeDuration: 2.0,
                permafrost: tower.stats.permafrost || false,
                embrittlement: tower.stats.embrittlement || false,
                superBrittle: tower.stats.superBrittle || false,
                freezeDurationStat: tower.stats.freezeDuration || 1.5
            };
            p.init(tower.x, tower.y, damage, target, 'icicle', 1500, tower.stats.pierce, 0.8, null, impaleEffects, 0, tower, impaleDmgType);
            return;
        }
        
        if (tower.stats.cryoCannon) {
            let p = GameEngine.projectilePool.get();
            let bombEffects = { 
                isExplosive: true, explosionRadius: 20, explosionDamage: damage, explosionPierce: 40,
                freeze: true, freezeDuration: tower.stats.freezeDuration || 1.2,
                permafrost: tower.stats.permafrost || false,
                embrittlement: tower.stats.embrittlement || false,
                superBrittle: tower.stats.superBrittle || false,
                iceShards: tower.stats.iceShards || false,
                deepFreeze: tower.stats.deepFreeze || false,
                canHitMoab: tower.stats.embrittlement || false,
                canSeeCamo: tower.stats.canSeeCamo || false,
                canHitLead: tower.stats.canHitLead || false,
                reFreeze: tower.stats.reFreeze || false,
                moabDmg: tower.stats.moabDmg || 0,
                isCryoBomb: true
            };
            p.init(tower.x, tower.y, damage, target, 'ice_bomb', 500, 1, 0.5, null, bombEffects, 0, tower, dmgType);
            return;
        }
        
        let expRadius = tower.stats.range * RANGE_SCALE; 
        GameEngine.explosions.push({ x: tower.x, y: tower.y, radius: 0, maxRadius: expRadius, life: 0.2, maxLife: 0.2, color: '#1abc9c' });
        const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, expRadius);
        let hits = 0;
        
        for (let e of nearby) {
            if (hits >= tower.stats.pierce) break;
            if (!e.alive) continue;
            
            if (e.data.isWhite || e.data.isZebra) continue;
            if (e.data.isLead && !tower.stats.canHitLead && !tower.stats.embrittlement) continue;
            if (e.isCamo && !tower.stats.canSeeCamo) continue;
            
            if (e.data.isMoab) {
                if (tower.stats.superBrittle) {
                    if (e.data.isBAD) continue;
                    e.brittle = true; e.brittleBonus = 5; e.brittleTimer = 4.0;
                    e.isCamo = false; e.isRegen = false;
                    e.permafrostSlow = 0.75; // 25% slow for MOABs
                    let moabDmg = e.takeDamage(5, { isExplosion: true, canHitLead: true });
                    if (!isNaN(moabDmg) && moabDmg !== -1) tower.damageDealt += moabDmg;
                } else if (tower.stats.embrittlement) {
                    e.brittle = true; e.brittleBonus = 1; e.brittleTimer = 4.0;
                    e.isCamo = false; e.isRegen = false;
                    // Embrittlement temporarily removes Lead properties from DDTs
                    if (e.data.isDDT) e.leadStripped = true;
                } else if (tower.stats.icicles) {
                    // Icicles deal +8 damage to MOABs with the blast
                    let moabDmg = e.takeDamage(tower.stats.moabDmg || 8, { isExplosion: true, canHitLead: true });
                    if (!isNaN(moabDmg) && moabDmg !== -1) tower.damageDealt += moabDmg;
                }
                continue;
            }
            
            if (e.isFrozen && !tower.stats.reFreeze) continue;
            
            if (Utils.distance(tower.x, tower.y, e.x, e.y) < expRadius) {
                let freezeDur = tower.stats.freezeDuration || 1.5;
                if (e.data.isCeramic && tower.upgrades[0] < 3 && tower.upgrades[1] < 3 && tower.upgrades[2] < 3) {
                    freezeDur *= 0.5;
                }
                e.applySlow(0.0, freezeDur, true);
                
                if (tower.stats.iceShards) {
                    e.isCamo = false; e.isRegen = false;
                }
                if (tower.stats.embrittlement) {
                    e.isCamo = false; e.isRegen = false;
                    e.brittle = true; e.brittleBonus = 1; e.brittleTimer = 4.0;
                    if (e.data.isLead) e.leadStripped = true; // Embrittlement removes Lead immunity
                }
                if (tower.stats.superBrittle) {
                    e.isCamo = false; e.isRegen = false;
                    e.brittle = true; e.brittleBonus = 5; e.brittleTimer = 4.0;
                    if (e.data.isLead) e.leadStripped = true;
                    let dmg = e.takeDamage(5, { isExplosion: true, canHitLead: true });
                    if (!isNaN(dmg) && dmg !== -1) tower.damageDealt += dmg;
                } else {
                    let dmg = e.takeDamage(damage, dmgType, effects);
                    if (!isNaN(dmg) && dmg !== -1) tower.damageDealt += dmg;
                }
                
                if (tower.stats.permafrost) e.permafrostSlow = 0.5;
                if (tower.stats.deepFreeze) e.deepFreezeLayers = 2;
                
                hits++;
            }
        }
    },
    
    ability(tower, engine) {
        let isAbsolute = tower.stats.absoluteZero || false;
        let duration = isAbsolute ? 10.0 : 6.0; // Wiki: AZ is 10s
        
        engine.log(isAbsolute ? "Absolute Zero!" : "Snowstorm!");
        
        if (isAbsolute) {
            tower.absZeroActiveBuff = duration;
        }
        
        for (let e of engine.enemies) {
            if (!e.alive) continue;
            if (e.data.isBAD) continue;
            
            if (e.data.isMoab) {
                if (isAbsolute) {
                    e.applySlow(0.0, duration, true); // AZ freezes MOABs
                } else {
                    e.applySlow(0.3, 3.0, false); // Snowstorm slows MOABs for 3s
                }
            } else {
                // Snowstorm freezes White/Zebra/Camo for 3s, others for 6s. AZ freezes all for 10s.
                let isImmuneType = e.data.isWhite || e.data.isZebra || e.isCamo;
                let freezeDur = isAbsolute ? duration : (isImmuneType ? 3.0 : 6.0);
                e.applySlow(0.0, freezeDur, true);
                
                // Soak layers
                if (isAbsolute) e.deepFreezeLayers = 8;
                else e.deepFreezeLayers = 2;
            }
        }
        engine.explosions.push({ x: 640, y: 360, radius: 0, maxRadius: 1280, life: 0.8, maxLife: 0.8, color: '#1abc9c' });
    }
};