// js/towers/ice.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { RANGE_SCALE } from '../config.js';
import { createDmgType, DamageType } from '../damageTypes.js';
import { GLOBAL_SCALE } from '../constants.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

export default {
    stats: {
        name: "Ice Monkey", cost: 400, range: 20,
        baseCooldown: 2.4, fireRate: 2.4,
        damage: 1, pierce: 40, projectileSpeed: 0,
        lifespan: 0.1, desc: "Claps to release a wave of coldness, freezing and popping nearby bloons. Can be placed on water and land. Cannot pop Lead, White, or Zebra bloons without upgrades.",
        dmgType: 'ice', projectileType: 'ice', hitRadius: 18,
        isStaticRotation: true,
        freezeDuration: 1.5,
        canPlaceOnWater: true // Allows placement on water and land
    },
    upgrades: {
        1: [
            {name:"Permafrost", cost:150, desc:"Bloons move slowly even after thawing out.", extraMods:{permafrost: true}},
            {name:"Cold Snap", cost:350, stat:"canHitLead", amount:true, desc:"Can freeze and pop Lead Bloons and Camo Bloons.", extraMods:{canSeeCamo: true}},
            {name:"Ice Shards", cost:1500, stat:"iceShards", amount:true, desc:"Removes Camo and Regrow properties when damaging Bloons. Razor sharp shards fly out when Frozen Bloons pop.", extraMods:{range: 5}},
            {name:"Embrittlement", cost:2300, stat:"embrittlement", amount:true, desc:"Can hit MOAB-class Bloons. All hit Bloons become brittle, take extra damage while frozen, and losing Lead immunity for a short time."},
            {name:"Super Brittle", cost:28000, stat:"superBrittle", amount:true, desc:"Bloons take huge damage while frozen, while Ice Shards rip through Ceramic Bloons like paper!", cooldownMult: 0.5, extraMods: { moabPermafrost: true }} // Attacks 100% faster
        ],
        2: [
            {name:"Enhanced Freeze", cost:200, desc:"Attacks faster and freezes for longer.", cooldownMult: 0.75, extraMods:{freezeDuration: 1.75}},
            {name:"Deep Freeze", cost:300, stat:"pierce", amount:5, desc:"Increases pierce, freezes an extra layer and freeze lasts longer.", extraMods:{deepFreeze: true, freezeDuration: 2.2}},
            {name:"Arctic Wind", cost:2750, stat:"arcticWind", amount:true, desc:"Gains a super cold aura that slows Bloons and freezes water nearby.", extraMods:{arcticSlowFactor: 0.6}}, // 40% slow
            {name:"Snowstorm", cost:4000, stat:"range", amount:10, desc:"Snowstorm Ability: Freezes all regular Bloons on screen, briefly freezes White, Zebra, and Camo, and slows MOAB-class.", extraMods:{unlocksAbility:true, abilityName:"Snowstorm", abilityCd:30}},
            {name:"Absolute Zero", cost:21000, stat:"absoluteZero", amount:true, desc:"Each attack freezes all Bloons everywhere for a short time. Snowstorm freezes all Bloon types for even longer while greatly increasing attack speed of all Ice Monkeys for the duration.", extraMods:{range: 10, pierce: 255, abilityCd: 25}} // Range 30->40, Pierce 45->300, Cd 30->25
        ],
        3: [
            {name:"Larger Radius", cost:150, stat:"range", amount:7, desc:"Larger freeze area."},
            {name:"Re-Freeze", cost:200, stat:"reFreeze", amount:true, desc:"Can re-freeze Bloons that are already frozen."},
            {name:"Cryo Cannon", cost:1900, stat:"cryoCannon", amount:true, desc:"Rapidly shoots smaller ice bombs over longer range.", cooldownMult: 0.5, extraMods:{isStaticRotation: false, projectileSpeed: 500, projectileType: 'ice_bomb', range: 19, freezeDuration: 1.2, explosionRadius: 20, explosionPierce: 40}},
            {name:"Icicles", cost:2750, stat:"icicles", amount:true, desc:"Does bonus damage to MOAB-Class Bloons. Frozen Bloons grow sharp icicles that can pop Bloons that touch them.", cooldownMult: 0.66, extraMods:{moabDmg: 8, icicleDmg: 3, damage: 1}}, // +1 dmg (2 total)
            {name:"Icicle Impale", cost:30000, stat:"icicleImpale", amount:true, desc:"Shoots huge icicle spikes that do huge damage to MOAB-Class Bloons and freezes them.", extraMods:{projectileType: 'icicle', projectileSpeed: 1500, moabDmg: 50}}
        ]
    },
    updateSupport(tower, dt) {
        if (tower.stats.absoluteZero) {
            for (let t of GameEngine.towers) {
                if (t && t.type === 'ice' && t !== tower) {
                    t.buffedFireRate = Math.max(t.buffedFireRate, 0.10);
                    if (tower.absZeroActiveBuff > 0) {
                        t.buffedFireRate = Math.max(t.buffedFireRate, 0.50); // +50% attack speed
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
            const auraRange = tower.stats.range * RANGE_SCALE * GS;
            const slowFactor = tower.stats.arcticSlowFactor || 0.6; // 40% slow
            const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, auraRange);
            for (let e of nearby) {
                if (!e.alive) continue;
                if (Utils.distance(tower.x, tower.y, e.x, e.y) < auraRange) {
                    if (e.data.isWhite || e.data.isZebra) continue;
                    if (e.data.isLead && !tower.stats.canHitLead) continue;
                    if (e.isCamo && !tower.stats.canSeeCamo) continue;
                    if (e.data.isMoab) continue; // Does not slow MOABs
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
                const range = tower.stats.range * RANGE_SCALE * GS;
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
    draw(ctx, tower, isPreview) {
        // Draw ice sheet visual if Arctic Wind is active
        if (!isPreview && tower.stats.arcticWind) {
            ctx.save();
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = '#a3e4ff';
            ctx.strokeStyle = '#74c2ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(tower.x, tower.y, 45 * GS, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
        tower.drawBaseTower(ctx, isPreview);
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
                canHitMoab: tower.stats.embrittlement || tower.stats.icicles || false,
                canSeeCamo: tower.stats.canSeeCamo || false,
                canHitLead: tower.stats.canHitLead || false,
                reFreeze: tower.stats.reFreeze || false,
                moabDmg: tower.stats.moabDmg || 0,
                isCryoBomb: true
            };
            p.init(tower.x, tower.y, damage, target, 'ice_bomb', 500, 1, 0.5, null, bombEffects, 0, tower, dmgType);
            return;
        }
        
        let expRadius = tower.stats.range * RANGE_SCALE * GS;
        GameEngine.explosions.push({ x: tower.x, y: tower.y, radius: 0, maxRadius: expRadius, life: 0.2, maxLife: 0.2, color: '#1abc9c' });
        const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, expRadius);
        let hits = 0;
        
        // Determine layer soak
        const freezeLayers = tower.stats.absoluteZero ? 8 : (tower.stats.deepFreeze ? 4 : 2);
        
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
                    if (e.data.isDDT) e.leadStripped = true;
                } else if (tower.stats.icicles) {
                    // Icicles allows hitting MOABs for +8 damage
                    let moabDmg = e.takeDamage(tower.stats.moabDmg || 8, { isExplosion: true, canHitLead: true });
                    if (!isNaN(moabDmg) && moabDmg !== -1) tower.damageDealt += moabDmg;
                }
                continue;
            }
            
            if (e.isFrozen && !tower.stats.reFreeze) continue;
            if (Utils.distance(tower.x, tower.y, e.x, e.y) < expRadius) {
                let freezeDur = tower.stats.freezeDuration || 1.5;
                // 50% shorter freeze on Ceramics below Tier 3
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
                    if (e.data.isLead) e.leadStripped = true;
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
                if (tower.stats.permafrost) e.permafrostSlow = 0.5; // 50% slow after thawing
                
                e.deepFreezeLayers = freezeLayers;
                
                hits++;
            }
        }
    },
    ability(tower, engine) {
        let isAbsolute = tower.stats.absoluteZero || false;
        let duration = isAbsolute ? 10.0 : 6.0;
        engine.log(isAbsolute ? "Absolute Zero!" : "Snowstorm!");
        if (isAbsolute) {
            tower.absZeroActiveBuff = duration;
        }
        
        const freezeLayers = isAbsolute ? 8 : 2;
        
        for (let e of engine.enemies) {
            if (!e.alive) continue;
            if (e.data.isBAD) continue;
            if (e.data.isMoab) {
                if (isAbsolute) {
                    e.applySlow(0.0, duration, true);
                } else {
                    e.applySlow(0.3, 3.0, false); // Slows MOABs
                }
            } else {
                let isImmuneType = e.data.isWhite || e.data.isZebra || e.isCamo;
                let freezeDur = isAbsolute ? duration : (isImmuneType ? 3.0 : 6.0);
                e.applySlow(0.0, freezeDur, true);
                e.deepFreezeLayers = freezeLayers;
            }
        }
        engine.explosions.push({ x: 640, y: 360, radius: 0, maxRadius: 1280, life: 0.8, maxLife: 0.8, color: '#1abc9c' });
    }
};