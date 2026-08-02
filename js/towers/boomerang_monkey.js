// js/towers/boomerang_monkey.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

export default {
    stats: { 
        name: "Boomerang Monkey", cost: 315, range: 43, 
        baseCooldown: 1.2, fireRate: 1.2, 
        damage: 1, pierce: 4, projectileSpeed: 600, lifespan: 1.5, 
        desc: "Throws a boomerang in a curved path. Good range and pierce.", 
        dmgType: 'sharp', projectileType: 'boomerang', hitRadius: 18,
        category: 'Primary' 
    },
    upgrades: { 
        1: [
            {name:"Improved Rangs", cost:200, stat:"pierce", amount:4, desc:"Can pop up to 8 Bloons per throw."},
            {name:"Glaives", cost:280, stat:"pierce", amount:12, desc:"Throws glaives instead of boomerangs. Bigger and faster.", extraMods:{projectileSpeed: 100}},
            {name:"Glaive Ricochet", cost:600, desc:"Glaives will bounce from Bloon to Bloon automatically.", extraMods:{ricochet: 10, ricochetRange: 150}},
            {name:"M.O.A.R Glaives", cost:2000, stat:"damage", amount:1, desc:"Greatly enhances ricochet powers.", extraMods:{ricochet: 20, ricochetRange: 200}},
            {name:"Glaive Lord", cost:32500, stat:"damage", amount:4, desc:"Surrounds itself in 3 special glaives. Rips through MOABs.", extraMods:{pierce: 100, moabDmg: 5, ricochet: 50, ricochetRange: 300}}
        ], 
        2: [
            {name:"Faster Throwing", cost:175, desc:"Throws boomerangs faster.", extraMods:{cooldownMult: 0.85}},
            {name:"Faster Rangs", cost:250, desc:"Boomerangs fire and travel faster.", extraMods:{cooldownMult: 0.85, projectileSpeed: 100}},
            {name:"Bionic Boomerang", cost:1250, stat:"moabDmg", amount:2, desc:"Bionic arm throws extremely fast. More MOAB damage.", extraMods:{cooldownMult: 0.6}},
            {name:"Turbo Charge", cost:4200, desc:"Ability: Attack incredibly fast for 10 seconds.", extraMods:{isAbility: true, abilityName: "Turbo Charge", abilityCd: 30}},
            {name:"Perma Charge", cost:35000, desc:"Permanent super fast attack speed.", extraMods:{cooldownMult: 0.4, isAbility: true, abilityName: "Turbo Charge", abilityCd: 20}}
        ], 
        3: [
            {name:"Long Range Rangs", cost:100, stat:"range", amount:10, desc:"Can throw boomerangs further than normal."},
            {name:"Red Hot Rangs", cost:300, stat:"dmgType", amount:'fire', desc:"Pops Frozen and Lead Bloons and does more damage.", extraMods:{damage: 1}},
            {name:"Kylie Boomerang", cost:1300, stat:"pierce", amount:10, desc:"Throws heavy Kylie boomerangs that follow a straight path.", extraMods:{projectileSpeed: 200, lifespan: -0.5}}, // Faster, shorter life to act straighter
            {name:"MOAB Press", cost:2700, stat:"moabDmg", amount:3, desc:"Hits MOABs multiple times and knocks them back.", extraMods:{knockback: 20}},
            {name:"MOAB Domination", cost:50000, stat:"moabDmg", amount:10, desc:"Special knockback kylies trigger more often and do lots of extra damage.", extraMods:{knockback: 50, damage: 5}}
        ]
    },
    
    update(tower, dt, engine) {
        // Turbo Charge Ability active effect
        if (tower.turboActive > 0) {
            tower.turboActive -= dt;
            tower.buffedFireRate = Math.max(tower.buffedFireRate || 0, 5.0); 
        }
        
        // Glaive Lord passive aura (Simulated by massive pierce and ricochet on its normal shots)
        // To keep it simple and performant without custom orbiting entities, we rely on the stats.
    },

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        let pEffects = { ...effects };
        // Apply Path 1 Ricochet effects
        if (tower.stats.ricochet) {
            pEffects.ricochet = tower.stats.ricochet;
            pEffects.ricochetRange = tower.stats.ricochetRange;
        }
        // Apply Path 3 Knockback effects
        if (tower.stats.knockback) {
            pEffects.knockback = tower.stats.knockback;
        }
        
        let p = engine.projectilePool.get();
        // Use standard boomerang type, it handles the curve.
        // If it's a Kylie (Path 3 T3+), we could use a different type, but 'boomerang' with high speed works fine.
        p.init(tower.x, tower.y, damage, target, 'boomerang', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, pEffects, 0, tower, dmgType, isCrit);
    },
    
    ability(tower, engine) {
        if (tower.stats.abilityName === "Turbo Charge") {
            engine.log("Turbo Charge Activated!");
            tower.turboActive = 10.0; // 10 seconds of insane attack speed
        }
    }
};
