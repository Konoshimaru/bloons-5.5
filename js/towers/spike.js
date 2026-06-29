import { GameEngine } from '../engine.js';

export default {
    stats: { 
        name: "Spike Factory", cost: 1000, range: 35, 
        baseCooldown: 3.0, fireRate: 3.0, 
        damage: 1, pierce: 5, projectileSpeed: 0, 
        lifespan: 10.0, desc: "Produces spikes on the track.", 
        dmgType: 'sharp', projectileType: 'spike', hitRadius: 18, 
        isStaticRotation: true 
    },
    upgrades: {
        1: [
            {name:"Faster Production", cost:500, desc:"Produces spikes faster.", cooldownMult: 0.66},
            {name:"Even Faster Production", cost:800, desc:"Produces spikes even faster.", cooldownMult: 0.66},
            {name:"MOAB SHREDR", cost:1500, stat:"moabDmg", amount:4, desc:"Deals 4 extra damage to MOABs."},
            {name:"Spike Storm", cost:4000, stat:"isAbility", amount:true, desc:"Ability: Spikes cover the screen.", extraMods:{unlocksAbility:true, abilityName:"Storm", abilityCd:30}},
            {name:"Carpet of Spikes", cost:25000, stat:"damage", amount:2, desc:"Spikes deal 3 damage."}
        ],
        2: [
            {name:"Bigger Stacks", cost:400, stat:"pierce", amount:5, desc:"Spikes pop 10 bloons."},
            {name:"White Hot Spikes", cost:600, stat:"canHitLead", amount:true, desc:"Can pop Lead bloons."},
            {name:"MOAB SHREDR", cost:1500, stat:"moabDmg", amount:4, desc:"Deals 4 extra damage to MOABs."},
            {name:"Spike Storm", cost:4000, stat:"isAbility", amount:true, desc:"Ability: Spikes cover the screen.", extraMods:{unlocksAbility:true, abilityName:"Storm", abilityCd:30}},
            {name:"Carpet of Spikes", cost:25000, stat:"damage", amount:2, desc:"Spikes deal 3 damage."}
        ],
        3: [
            {name:"Long Reach", cost:300, stat:"range", amount:20, desc:"Increases range."},
            {name:"Smart Spikes", cost:500, stat:"canSeeCamo", amount:true, desc:"Can detect Camo bloons."},
            {name:"Path Finder", cost:1000, stat:"pierce", amount:10, desc:"Spikes pop 20 bloons."},
            {name:"Perma-Spike", cost:5000, stat:"lifespan", amount:20, desc:"Spikes last forever."},
            {name:"Super Carpet", cost:30000, stat:"damage", amount:5, desc:"Spikes deal 6 damage."}
        ]
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        let trackPoint = GameEngine.map.getNearestPathPoint(tower.x, tower.y);
        let p = GameEngine.projectilePool.get();
        p.init(trackPoint.x, trackPoint.y, damage, null, 'spike', 0, tower.stats.pierce, tower.stats.lifespan, Math.PI/2, null, 0, tower, dmgType);
    },
    ability(tower, engine) {
        engine.log("Spike Storm!");
        for(let i=0; i<20; i++) {
            let x = Math.random() * 900;
            let y = Math.random() * 600;
            let p = GameEngine.projectilePool.get();
            p.init(x, y, tower.stats.damage, null, 'spike', 0, tower.stats.pierce, 5.0, Math.PI/2, null, 0, tower, { isSharp: true, canHitLead: true });
        }
    }
};