import { GameEngine } from '../engine.js';
import { Projectile } from '../projectile.js';

export default {
    stats: { name: "Wizard Monkey", cost: 600, range: 35, fireRate: 0.85, damage: 1, projectileSpeed: 700, pierce: 1, lifespan: 0.6, desc: "Hurls arcane bolts of magic. Strong upgrade paths into AoE and summons.", dmgType: 'magic', projectileType: 'wizard_bolt', hitRadius: 18 },
    upgrades: {
        1: [
            {name:"Arcane Blast",cost:400,stat:"damage",amount:1,desc:"+1 damage."},
            {name:"Fireball",cost:600,stat:"dmgType",amount:'fire',desc:"Throws fireballs that deal AoE.", extraMods: {explosionRadius: 25, explosionDamage: 1}},
            {name:"Dragon's Breath",cost:1800,stat:"fireRate",amount:-0.2,desc:"Breathes fire constantly.", extraMods: {pierce: 5}},
            {name:"Wall of Fire",cost:4000,stat:"isAbility",amount:true,desc:"Ability: Creates a wall of fire."},
            {name:"Archmage",cost:28000,stat:"damage",amount:10,desc:"Colossal magic damage.", extraMods: {pierce: 50}}
        ],
        2: [
            {name:"Shimmer",cost:300,stat:"canSeeCamo",amount:true,desc:"Can detect Camo bloons."},
            {name:"Necromancer",cost:800,stat:"projectileCount",amount:1,desc:"Throws 2 magic bolts."},
            {name:"Undead Army",cost:2000,stat:"projectileCount",amount:1,desc:"Throws 3 magic bolts."},
            {name:"Prince of Darkness",cost:6000,stat:"damage",amount:5,desc:"Deals 5 extra damage."},
            {name:"Lich God",cost:30000,stat:"damage",amount:15,desc:"Godlike magic damage."}
        ],
        3: [
            {name:"Longer Range",cost:300,stat:"range",amount:30,desc:"Increases range."},
            {name:"Thunder Wand",cost:500,stat:"fireRate",amount:-0.2,desc:"Attacks faster.", extraMods: {damage: 1}},
            {name:"MOAB Zap",cost:1500,stat:"damage",amount:3,desc:"Deals 3 extra damage."},
            {name:"Paragon of Hope",cost:4000,stat:"damage",amount:5,desc:"Deals 5 extra damage."},
            {name:"Overload",cost:25000,stat:"damage",amount:20,desc:"Massive damage.", extraMods: {fireRate: -0.2}}
        ]
    },
    fire(tower, target, damage, dmgType) {
        let count = tower.stats.projectileCount || 1;
        for(let i=0; i<count; i++) {
            GameEngine.projectiles.push(new Projectile(tower.x, tower.y, damage, target, 'wizard_bolt', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, null, 5 * (i - (count-1)/2), tower, dmgType));
        }
    }
};