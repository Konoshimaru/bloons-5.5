import { GameEngine } from '../engine.js';

export default {
    stats: { 
        name: "Monkey Sub", cost: 500, range: 35, 
        baseCooldown: 1.0, fireRate: 1.0, 
        damage: 1, pierce: 1, projectileSpeed: 600, 
        lifespan: 0.5, desc: "Shoots darts. Must be placed on water.", 
        dmgType: 'sharp', projectileType: 'dart', hitRadius: 18, waterOnly: true 
    },
    upgrades: {
        1: [
            {name:"Advanced Intel", cost:400, desc:"Attacks faster.", cooldownMult: 0.8},
            {name:"Barbed Darts", cost:500, stat:"pierce", amount:2, desc:"Darts hit 3 bloons."},
            {name:"Armor Piercing Darts", cost:1000, stat:"canHitLead", amount:true, desc:"Can pop Lead bloons."},
            {name:"Submerge", cost:1500, stat:"isAbility", amount:true, desc:"Ability: Submerges to detect Camo.", extraMods:{unlocksAbility:true, abilityName:"Submerge", abilityCd:10}},
            {name:"Energizer", cost:25000, stat:"damage", amount:2, desc:"Deals 3 damage."}
        ],
        2: [
            {name:"Longer Range", cost:300, stat:"range", amount:20, desc:"Increases range."},
            {name:"Twin Guns", cost:500, stat:"projectileCount", amount:1, desc:"Shoots 2 darts at once."},
            {name:"Airburst Darts", cost:1500, stat:"pierce", amount:3, desc:"Darts split into 3."},
            {name:"First Strike", cost:5000, stat:"isAbility", amount:true, desc:"Ability: Massive MOAB damage.", extraMods:{unlocksAbility:true, abilityName:"Strike", abilityCd:50}},
            {name:"Sub Commander", cost:30000, stat:"damage", amount:3, desc:"Deals 4 damage."}
        ],
        3: [
            {name:"Faster Darts", cost:300, desc:"Attacks faster.", cooldownMult: 0.8},
            {name:"Camo Detection", cost:400, stat:"canSeeCamo", amount:true, desc:"Can detect Camo bloons."},
            {name:"Lateral Darts", cost:800, stat:"pierce", amount:2, desc:"Darts hit 3 bloons."},
            {name:"Armor Piercing Darts", cost:1500, stat:"canHitLead", amount:true, desc:"Can pop Lead bloons."},
            {name:"Elite Sub", cost:20000, stat:"damage", amount:2, desc:"Deals 3 damage."}
        ]
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        let p = GameEngine.projectilePool.get();
        p.init(tower.x, tower.y, damage, target, 'dart', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, effects, 0, tower, dmgType);
    },
    ability(tower, engine) {
        engine.log("First Strike Capability!");
        let target = null;
        let bestVal = -Infinity;
        for (let e of engine.enemies) {
            if (!e.alive) continue;
            if (e.data.isMoab && e.hp > bestVal) { bestVal = e.hp; target = e; }
        }
        if (target) {
            target.takeDamage(10000, { isExplosion: true, canHitLead: true });
            engine.explosions.push({ x: target.x, y: target.y, radius: 0, maxRadius: 150, life: 0.5, maxLife: 0.5, color: '#3498db' });
        }
    }
};