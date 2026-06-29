import { GameEngine } from '../engine.js';

export default {
    stats: { 
        name: "Boomerang Monkey", cost: 315, range: 32, 
        baseCooldown: 1.0, fireRate: 1.0, 
        damage: 1, projectileSpeed: 500, pierce: 50, lifespan: 1.5, 
        desc: "Throws a boomerang in a perfect arc. High pierce.", 
        dmgType: 'sharp', hitRadius: 18 
    },
    upgrades: { 
        1: [
            {name:"Multitarget",cost:300,stat:"pierce",amount:10,desc:"Pops 10 extra bloons."},
            {name:"Glaive",cost:500,stat:"pierce",amount:20,desc:"Pops 20 extra bloons."},
            {name:"Glaive Lord",cost:2000,stat:"damage",amount:2,desc:"Deals 2 extra damage."},
            {name:"Bloontonium Glaive",cost:4000,stat:"pierce",amount:50,desc:"Pops 50 extra bloons."},
            {name:"Glaive Dominius",cost:25000,stat:"damage",amount:10,desc:"Colossal damage."}
        ], 
        2: [
            {name:"Faster Throw",cost:300,desc:"Throws faster.", cooldownMult: 0.8},
            {name:"Longer Range",cost:250,stat:"range",amount:40,desc:"Increases range."},
            {name:"Epic Range",cost:800,stat:"range",amount:60,desc:"Huge range increase."},
            {name:"Turbo Charge",cost:1500,desc:"Extreme attack speed.", cooldownMult: 0.5},
            {name:"Lightspeed Throw",cost:10000,desc:"Maximum attack speed.", cooldownMult: 0.7}
        ], 
        3: [
            {name:"Lead Glaive",cost:600,stat:"canHitLead",amount:true,desc:"Can pop Lead bloons."},
            {name:"Camo Glaive",cost:500,stat:"canSeeCamo",amount:true,desc:"Can detect Camo bloons."},
            {name:"Explosive Glaive",cost:3000,stat:"damage",amount:3,desc:"Deals massive damage."},
            {name:"Viral Glaive",cost:5000,stat:"pierce",amount:100,desc:"Pops 100 extra bloons."},
            {name:"Omega Glaive",cost:30000,stat:"damage",amount:15,desc:"Omega damage."}
        ]
    },
    fire(tower, target, damage, dmgType) {
        let p = GameEngine.projectilePool.get();
        p.init(tower.x, tower.y, damage, target, 'boomerang', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, null, 0, tower, dmgType);
    }
};