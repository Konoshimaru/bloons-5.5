import { GameEngine } from '../engine.js';
import { Projectile } from '../projectile.js';

export default {
    stats: { name: "Glue Gunner", cost: 225, scale:1.2, range: 36, fireRate: 1.0, damage: 0, projectileSpeed: 600, pierce: 1, lifespan: 0.5, slow: 0.5, slowDuration: 11, desc: "Glues bloons, slowing them down. Doesn't damage.", dmgType: 'glue', hitRadius: 18 },
    upgrades: {
        1: [{name:"Bigger Globs",cost:300,stat:"pierce",amount:2,desc:"Glue hits 2 bloons."},{name:"Corrosive Glue",cost:500,stat:"damage",amount:1,desc:"Glue deals 1 damage over time."},{name:"Acidic Glue",cost:2000,stat:"damage",amount:2,desc:"Deals 2 damage over time."},{name:"Dissolver",cost:4000,stat:"damage",amount:5,desc:"Deals 5 damage over time."},{name:"The Blob",cost:20000,stat:"damage",amount:15,desc:"Colossal damage over time."}], 
        2: [{name:"Faster Squirt",cost:400,stat:"fireRate",amount:-0.2,desc:"Attacks faster."},{name:"Longer Range",cost:300,stat:"range",amount:30,desc:"Increases range."},{name:"Super Range",cost:700,stat:"range",amount:40,desc:"Huge range increase."},{name:"Glue Hose",cost:2500,stat:"fireRate",amount:-0.5,desc:"Extreme attack speed."},{name:"Max Glue",cost:10000,stat:"fireRate",amount:-0.3,desc:"Maximum attack speed."}], 
        3: [{name:"Lead Glue",cost:600,stat:"canHitLead",amount:true,desc:"Can stick to Lead bloons."},{name:"Camo Glue",cost:500,stat:"canSeeCamo",amount:true,desc:"Can detect Camo bloons."},{name:"Mega Glue",cost:3000,stat:"slow",amount:0.3,desc:"Slows bloons even more."},{name:"Sticky Glue",cost:5000,stat:"slowDuration",amount:3,desc:"Glue lasts 3s longer."},{name:"Super Glue",cost:25000,stat:"slow",amount:0.1,desc:"Almost stops bloons entirely."}]
    },
    fire(tower, target, damage, dmgType) {
        GameEngine.projectiles.push(new Projectile(tower.x, tower.y, damage, target, 'glue', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, { slow: tower.stats.slow, slowDuration: tower.stats.slowDuration }, 0, tower, dmgType));
    }
};