// js/towers/sniper.js
import { GameEngine } from '../engine.js';

export default {
    stats: { 
        name: "Sniper Monkey", cost: 350, range: 9999, 
        baseCooldown: 1.2, fireRate: 1.2, 
        damage: 2, pierce: 1, projectileSpeed: 1000, 
        lifespan: 0.2, desc: "Shoots bloons from anywhere on the map.", 
        dmgType: 'sharp', projectileType: 'dart', hitRadius: 18,
        drawSize: 150 
    },
    upgrades: {
        1: [
            {name:"Full Metal Jacket", cost:300, stat:"damage", amount:2, desc:"Deals 2 extra damage."},
            {name:"Point One Seconds", cost:500, desc:"Attacks faster.", cooldownMult: 0.75},
            {name:"Deadly Precision", cost:2000, stat:"damage", amount:5, desc:"Deals massive damage to Ceramics."},
            {name:"Cripple MOAB", cost:5000, stat:"damage", amount:5, desc:"Stuns MOABs on hit.", extraMods:{stun: 1.0}},
            {name:"Supply Drop", cost:20000, stat:"isAbility", amount:true, desc:"Ability: Drops a crate for cash.", extraMods:{unlocksAbility:true, abilityName:"Drop", abilityCd:60}}
        ],
        2: [
            {name:"Night Vision Goggles", cost:300, stat:"canSeeCamo", amount:true, desc:"Can detect Camo bloons."},
            {name:"Shrapnel Shot", cost:500, stat:"pierce", amount:3, desc:"Shrapnel hits extra bloons."},
            {name:"Bouncing Bullet", cost:2000, stat:"pierce", amount:5, desc:"Bullet bounces to other bloons."},
            {name:"Supply Drop", cost:5000, stat:"isAbility", amount:true, desc:"Ability: Drops a crate for cash.", extraMods:{unlocksAbility:true, abilityName:"Drop", abilityCd:60}},
            {name:"Elite Defender", cost:20000, desc:"Attacks incredibly fast.", cooldownMult: 0.3}
        ],
        3: [
            {name:"Fast Firing", cost:300, desc:"Attacks faster.", cooldownMult: 0.75},
            {name:"Large Calibre", cost:500, stat:"damage", amount:3, desc:"Deals 3 extra damage."},
            {name:"Semi-Automatic", cost:2000, desc:"Attacks even faster.", cooldownMult: 0.5},
            {name:"Full Auto Rifle", cost:5000, desc:"Maximum attack speed.", cooldownMult: 0.5},
            {name:"Elite Sniper", cost:20000, stat:"damage", amount:5, desc:"Deals 5 extra damage."}
        ]
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        // PRO FIX: True Hit-scan logic
        // Instantly deal damage to the target
        let actualDmg = target.takeDamage(damage, dmgType, effects);
        tower.damageDealt += actualDmg;
        
        // Add visual hitscan beam (drawn by tower.js)
        tower.hitscans.push({ x1: tower.x, y1: tower.y, x2: target.x, y2: target.y, life: 0.1 });
    },
    ability(tower, engine) {
        engine.addCash(1000);
        engine.log("Supply Drop! +$1000");
    }
};