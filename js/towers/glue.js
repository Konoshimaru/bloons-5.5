// js/towers/glue.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

export default {
    stats: { 
        name: "Glue Gunner", cost: 225, range: 46, 
        baseCooldown: 1.0, fireRate: 1.0, 
        damage: 0, pierce: 1, projectileSpeed: 600, lifespan: 0.5, 
        slow: 0.5, slowDuration: 11, 
        desc: "Shoots a blob of sticky glue that slows Bloons down by 50%.", 
        dmgType: 'glue', projectileType: 'glue', hitRadius: 18,
        category: 'Primary' 
    },
    upgrades: {
        1: [
            {name:"Glue Soak", cost:200, desc:"Glue soaks through all layers of Bloon.", extraMods:{soak: true}},
            {name:"Corrosive Glue", cost:300, stat:"damage", amount:1, desc:"Glued Bloons pop one layer every few seconds.", extraMods:{dot: 1, dotTimer: 2.0}},
            {name:"Bloon Dissolver", cost:2000, stat:"pierce", amount:1, desc:"Glues one additional Bloon and melts two layers every second.", extraMods:{dot: 2, dotTimer: 1.0}},
            {name:"Bloon Liquefier", cost:5000, stat:"pierce", amount:1, desc:"Does 10 pops every second.", extraMods:{dot: 10, dotTimer: 1.0}},
            {name:"The Bloon Solver", cost:22500, stat:"damage", amount:40, desc:"Bloons a problem? Here's the solution.", extraMods:{dot: 40, dotTimer: 0.5, moabDmg: 40}}
        ], 
        2: [
            {name:"Bigger Globs", cost:100, stat:"pierce", amount:1, desc:"Can coat 2 Bloons per shot."},
            {name:"Glue Splatter", cost:970, desc:"Splatters glue across up to 5 Bloons per shot.", extraMods:{isExplosive: true, explosionRadius: 15, explosionDamage: 0, explosionPierce: 5}},
            {name:"Glue Hose", cost:1950, desc:"Shoots glue 3x as fast and in a wider area!", extraMods:{cooldownMult: 0.33, explosionPierce: 6}},
            {name:"Glue Strike", cost:4000, desc:"Ability: Glues all Bloons on screen, causing them to take more damage.", extraMods:{isAbility: true, abilityName: "Glue Strike", abilityCd: 30}},
            {name:"Glue Storm", cost:16000, desc:"Ability: Pelts the whole screen with glue for 20 seconds.", extraMods:{isAbility: true, abilityName: "Glue Storm", abilityCd: 40}}
        ], 
        3: [
            {name:"Stickier Glue", cost:280, stat:"slowDuration", amount:12, desc:"Makes glue effect last much longer."},
            {name:"Stronger Glue", cost:400, stat:"slow", amount:-0.15, desc:"Slows down Bloons even more."}, // 0.5 -> 0.35
            {name:"MOAB Glue", cost:3600, desc:"Improved glue formula allows it to stick to MOAB-Class Bloons.", extraMods:{canHitMoab: true, moabSlow: 0.75}},
            {name:"Relentless Glue", cost:4000, desc:"When a glued Bloon is popped, nearby Bloons are stunned.", extraMods:{stunOnPop: 5}},
            {name:"Super Glue", cost:24000, stat:"slow", amount:-0.35, desc:"Glue so strong it temporarily immobilizes all affected Bloons!", extraMods:{moabSlow: 0.5}} // 0.35 -> 0.0
        ]
    },
    
    update(tower, dt, engine) {
        // Glue Storm Active Effect
        if (tower.glueStormActive > 0) {
            tower.glueStormActive -= dt;
            tower.stormTimer = (tower.stormTimer || 0) - dt;
            if (tower.stormTimer <= 0) {
                tower.stormTimer = 0.1; // Fire 10 times a second
                // Pick a random target on screen
                if (engine.enemies.length > 0) {
                    let target = engine.enemies[Math.floor(Math.random() * engine.enemies.length)];
                    if (target && target.alive) {
                        // Fire a glue projectile from the sky
                        let p = engine.projectilePool.get();
                        let pEffects = { slow: tower.stats.slow, slowDuration: tower.stats.slowDuration };
                        if (tower.stats.dot) { pEffects.dot = tower.stats.dot; pEffects.dotTimer = tower.stats.dotTimer; }
                        p.init(target.x, -20, 0, target, 'glue', 800, 1, 0.5, null, pEffects, 0, tower, { isSharp: true });
                    }
                }
            }
        }
    },

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        let pEffects = { ...effects };
        
        // Apply Path 1 DoT
        if (tower.stats.dot) {
            pEffects.dot = tower.stats.dot;
            pEffects.dotTimer = tower.stats.dotTimer || 1.0;
        }
        
        // Apply Path 3 Slow effects
        pEffects.slow = tower.stats.slow;
        pEffects.slowDuration = tower.stats.slowDuration;
        
        // MOAB Glue (Path 3 T3+)
        if (tower.stats.canHitMoab) {
            pEffects.canHitMoab = true;
            pEffects.moabSlow = tower.stats.moabSlow || 0.75; // MOABs are slowed less
        }
        
        // Relentless Glue (Path 3 T4+)
        if (tower.stats.stunOnPop) {
            pEffects.stunOnPop = tower.stats.stunOnPop;
        }
        
        // Glue Splatter (Path 2 T2+)
        if (tower.stats.isExplosive) {
            pEffects.isExplosive = true;
            pEffects.explosionRadius = tower.stats.explosionRadius;
            pEffects.explosionDamage = 0; // Splatter does no impact damage, just spreads effects
            pEffects.explosionPierce = tower.stats.explosionPierce;
        }
        
        let p = engine.projectilePool.get();
        p.init(tower.x, tower.y, damage, target, 'glue', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, pEffects, 0, tower, dmgType, isCrit);
    },
    
    ability(tower, engine) {
        if (tower.stats.abilityName === "Glue Strike") {
            engine.log("Glue Strike!");
            // Apply glue to all bloons on screen
            let pEffects = { slow: tower.stats.slow, slowDuration: 15 };
            if (tower.stats.dot) { pEffects.dot = tower.stats.dot; pEffects.dotTimer = tower.stats.dotTimer; }
            if (tower.stats.canHitMoab) { pEffects.canHitMoab = true; pEffects.moabSlow = tower.stats.moabSlow; }
            
            Utils.applyAoeDamage(engine, 640, 360, 1500, 0, {isSharp: true, canHitLead: true, canHitMoab: true}, tower, pEffects, {maxHits: 1000});
        }
        
        if (tower.stats.abilityName === "Glue Storm") {
            engine.log("Glue Storm!");
            tower.glueStormActive = 20.0; // 20 seconds of raining glue
            tower.stormTimer = 0;
        }
    }
};