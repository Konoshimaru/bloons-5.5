import { GameEngine } from '../engine.js';

export default {
    stats: { 
        name: "Buccaneer Monkey", cost: 500, range: 35, 
        baseCooldown: 1.5, fireRate: 1.5, 
        damage: 1, projectileSpeed: 600, pierce: 2, lifespan: 0.5, 
        desc: "Fires darts from both sides. Must be placed on water.", 
        dmgType: 'sharp', projectileType: 'dart', hitRadius: 18, waterOnly: true 
    },
    upgrades: {
        1: [
            {name:"Faster Boats",cost:400,desc:"Attacks faster.", cooldownMult: 0.8},
            {name:"Longer Range",cost:300,stat:"range",amount:30,desc:"Increases range."},
            {name:"Destroyer",cost:1800,desc:"Extreme attack speed.", cooldownMult: 0.25},
            {name:"Aircraft Carrier",cost:12000,stat:"damage",amount:2,desc:"Deals extra damage.", extraMods: {pierce: 5}},
            {name:"Pirate Lord",cost:30000,stat:"damage",amount:5,desc:"Master of the seas."}
        ],
        2: [
            {name:"Grapeshot",cost:300,stat:"pierce",amount:2,desc:"+2 pierce."},
            {name:"Hot Shot",cost:400,stat:"dmgType",amount:'fire',desc:"Fires hot darts that pop lead."},
            {name:"Cannon Ship",cost:1000,stat:"isExplosive",amount:true,desc:"Fires explosive cannonballs.", extraMods: {explosionRadius: 40, explosionDamage: 1, explosionPierce: 15}},
            {name:"Warship",cost:8000,stat:"damage",amount:3,desc:"Massive damage boost."},
            {name:"Fleet Commander",cost:40000,stat:"damage",amount:10,desc:"Dominates the waters."}
        ],
        3: [
            {name:"Crow's Nest",cost:300,stat:"canSeeCamo",amount:true,desc:"Can detect Camo bloons."},
            {name:"Powerful Darts",cost:400,stat:"pierce",amount:3,desc:"Darts hit 5 bloons."},
            {name:"Long Range Cannons",cost:800,stat:"range",amount:50,desc:"Huge range increase."},
            {name:"Trade Empire",cost:5000,stat:"income",amount:50,desc:"Generates $50 per round."},
            {name:"Merchantmen",cost:30000,stat:"income",amount:200,desc:"Generates $200 per round."}
        ]
    },
    fire(tower, target, damage, dmgType) {
        let p1 = GameEngine.projectilePool.get();
        p1.init(tower.x, tower.y, damage, target, 'dart', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, null, 0, tower, dmgType);
        let p2 = GameEngine.projectilePool.get();
        p2.init(tower.x, tower.y, damage, null, 'dart', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, tower.angle + Math.PI, null, 0, tower, dmgType);
    }
};