import { GameEngine } from '../engine.js';

export default {
    stats: { 
        name: "Super Monkey", cost: 2500, range: 63, 
        baseCooldown: 0.2, fireRate: 0.2, 
        damage: 1, pierce: 1, projectileSpeed: 800, 
        lifespan: 0.5, desc: "Shoots incredibly fast.", 
        dmgType: 'sharp', projectileType: 'super_dart', hitRadius: 18 
    },
    upgrades: {
        1: [
            {name:"Super Range", cost:800, stat:"range", amount:24, desc:"Increases range."},
            {name:"Laser Vision", cost:1500, stat:"dmgType", amount:'energy', desc:"Shoots lasers.", extraMods:{projectileType:'laser'}},
            {name:"Plasma Blasts", cost:3000, stat:"dmgType", amount:'plasma', desc:"Shoots plasma.", extraMods:{projectileType:'plasma', damage:1}},
            {name:"Sun Avatar", cost:15000, stat:"damage", amount:2, desc:"Deals 3 damage per hit."},
            {name:"True Sun God", cost:100000, stat:"damage", amount:5, desc:"Obliterates everything."}
        ],
        2: [
            {name:"Epic Range", cost:1000, stat:"range", amount:40, desc:"Huge range increase."},
            {name:"Robo Monkey", cost:2500, stat:"projectileCount", amount:1, desc:"Shoots 2 darts at once."},
            {name:"Bloontonium Darts", cost:3000, stat:"damage", amount:1, desc:"Deals 2 damage per hit."},
            {name:"Anti-Bloon", cost:20000, stat:"damage", amount:3, desc:"Deals 5 damage per hit."},
            {name:"Legend of the Night", cost:120000, stat:"damage", amount:5, desc:"Deals 10 damage per hit."}
        ],
        3: [
            {name:"Night Vision Goggles", cost:1000, stat:"canSeeCamo", amount:true, desc:"Can detect Camo bloons."},
            {name:"Red Hot Rangs", cost:1200, stat:"dmgType", amount:'fire', desc:"Can pop Lead bloons."},
            {name:"Bionic Boomer", cost:2500, desc:"Attacks faster.", cooldownMult: 0.75},
            {name:"Overclock", cost:8000, stat:"isAbility", amount:true, desc:"Ability: Temporarily attack even faster.", extraMods:{unlocksAbility:true, abilityName:"Boost", abilityCd:30}},
            {name:"Paragon", cost:200000, stat:"damage", amount:10, desc:"The ultimate Super Monkey."}
        ]
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        let count = tower.stats.projectileCount || 1;
        for(let i=0; i<count; i++) {
            let p = GameEngine.projectilePool.get();
            p.init(tower.x, tower.y, damage, target, tower.stats.projectileType, tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, effects, 15 * (i - (count-1)/2), tower, dmgType);
        }
    }
};