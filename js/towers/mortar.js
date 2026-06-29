import { GameEngine } from '../engine.js';
import { Projectile } from '../projectile.js';

export default {
    stats: { name: "Mortar Monkey", cost: 750, range: 9999, minRange: 100, fireRate: 2.5, damage: 1, explosionRadius: 40, explosionDamage: 1, arcTime: 1.2, desc: "Lobs explosive shells anywhere on screen. Long reload, auto targeting.", dmgType: 'explosion', canHitLead: true, hitRadius: 18 },
    upgrades: {
        1: [
            {name:"Bigger Blast",cost:400,stat:"explosionRadius",amount:20,desc:"Larger explosion radius."},
            {name:"Bloon Buster",cost:500,stat:"explosionDamage",amount:1,desc:"Deals 1 extra explosion damage."},
            {name:"Heavy Shells",cost:1500,stat:"damage",amount:1,desc:"Direct hits deal extra damage."},
            {name:"Artillery",cost:3000,stat:"fireRate",amount:-0.5,desc:"Reloads faster."},
            {name:"Pop and Awe",cost:25000,stat:"isAbility",amount:true,desc:"Ability: Stuns all bloons on screen!"}
        ],
        2: [
            {name:"Faster Reload",cost:400,stat:"fireRate",amount:-0.5,desc:"Reloads faster."},
            {name:"Longer Range",cost:300,stat:"minRange",amount:-20,desc:"Reduces minimum range."},
            {name:"Burny Stuff",cost:800,stat:"dmgType",amount:'fire',desc:"Shells set bloons on fire."},
            {name:"Signal Flare",cost:2000,stat:"canSeeCamo",amount:true,desc:"Can detect Camo bloons."},
            {name:"Shelling Support",cost:12000,stat:"fireRate",amount:-0.5,desc:"Maximum reload speed."}
        ],
        3: [
            {name:"Accuracy",cost:400,stat:"explosionRadius",amount:10,desc:"Tighter explosion grouping."},
            {name:"Pierce Shot",cost:500,stat:"pierce",amount:5,desc:"Shells pierce through bloons before exploding."},
            {name:"MOAB Mauler",cost:1500,stat:"explosionDamage",amount:2,desc:"Deals 2 extra explosion damage."},
            {name:"MOAB Assassin",cost:3000,stat:"damage",amount:5,desc:"Direct hits deal massive damage."},
            {name:"The Big One",cost:30000,stat:"explosionRadius",amount:50,desc:"Colossal explosion radius."}
        ]
    },
    fire(tower, target, damage, dmgType) {
        if (!target) return;
        GameEngine.projectiles.push(new Projectile(tower.x, tower.y, damage, target, 'mortar_shell', 0, 0, tower.stats.arcTime || 1.2, null, null, 0, tower, dmgType));
    },
        ability(tower, engine) {
        engine.log("Pop and Awe!");
        for (let e of engine.enemies) {
            if (!e.alive) continue;
            e.applySlow(0.0, 3.0, false); // Stun all bloons for 3s
            e.takeDamage(tower.stats.damage * 5, { isExplosion: true, canHitLead: true });
        }
        // Screen flash effect
        engine.explosions.push({ x: 450, y: 300, radius: 0, maxRadius: 900, life: 0.8, maxLife: 0.8, color: '#ffffff' });
    }
};