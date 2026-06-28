import { GameEngine } from '../engine.js';
import { Projectile } from '../projectile.js';

export default {
    stats: { name: "Super Monkey", cost: 2500, range: 63, fireRate: 0.1, damage: 1, projectileSpeed: 1000, pierce: 1, lifespan: 0.5, desc: "Shoots incredibly fast. The ultimate popping machine.", dmgType: 'sharp', hitRadius: 18 },
    upgrades: {
        1: [
            {name:"Laser Vision",cost:2000,stat:"damage",amount:2,desc:"Deals 2 extra damage. Changes damage to Energy.", extraMods: {dmgType: 'energy'}},
            {name:"Plasma",cost:3000,stat:"fireRate",amount:-0.05,desc:"Attacks even faster. Changes damage to Plasma.", extraMods: {dmgType: 'plasma'}},
            {name:"Sun God",cost:5000,stat:"damage",amount:5,desc:"Deals colossal damage. Can pop Lead.", extraMods: {canHitLead: true}},
            {name:"Sun Avatar",cost:10000,stat:"damage",amount:10,desc:"Deals ultimate damage."},
            {name:"Sun Temple",cost:50000,stat:"damage",amount:30,desc:"Godlike damage."}
        ], 
        2: [{name:"Epic Range",cost:1500,stat:"range",amount:50,desc:"Increases range."},{name:"Speedy",cost:2000,stat:"fireRate",amount:-0.05,desc:"Attacks faster."},{name:"Robo Monkey",cost:4000,stat:"pierce",amount:3,desc:"Pierces 3 bloons."},{name:"Cyber Monkey",cost:8000,stat:"range",amount:100,desc:"Huge range increase."},{name:"Tech Terror",cost:30000,stat:"fireRate",amount:-0.05,desc:"Maximum fire rate."}], 
        3: [
            {name:"Camo Vision",cost:1000,stat:"canSeeCamo",amount:true,desc:"Can detect Camo bloons."},
            {name:"Heavy Plasma",cost:2500,stat:"canHitLead",amount:true,desc:"Can pop Lead bloons."},
            {name:"Plasma Blast",cost:5000,stat:"damage",amount:5,desc:"Deals 5 extra damage."},
            {name:"Anti-Bloon",cost:10000,stat:"pierce",amount:10,desc:"Pierces 10 bloons."},
            {name:"True Sun God",cost:100000,stat:"damage",amount:50,desc:"True divine damage."}
        ]
    },
    fire(tower, target, damage, dmgType) {
        let count = tower.stats.projectileCount || 1;
        for(let i=0; i<count; i++) {
            GameEngine.projectiles.push(new Projectile(tower.x, tower.y, damage, target, 'super', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, null, 15 * (i - count/2), tower, dmgType));
        }
    }
};