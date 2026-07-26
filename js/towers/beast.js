// js/towers/beast.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

export default {
    stats: { 
        name: "Beast Handler", cost: 250, range: 20, fireRate: 1.4, 
        damage: 1, pierce: 1, projectileSpeed: 800, 
        lifespan: 0.4, desc: "Trains land, water or air beasts.", 
        dmgType: 'energy', projectileType: 'beast_attack', hitRadius: 14, 
        explosionRadius: 12, explosionDamage: 1, explosionPierce: 4,
        category: 'Support' 
    },
    upgrades: {
        1: [ // Water Path
            {name:"Piranha", cost:160, stat:"damage", amount:1, desc:"Command a small fish to leap at Bloons.", extraMods:{projectileType: 'beast_water', explosionRadius: 0, explosionDamage: 0, explosionPierce: 1}},
            {name:"Barracuda", cost:810, stat:"damage", amount:2, desc:"Slaps Bloons backwards.", extraMods:{projectileType: 'beast_water', knockback: 20, pierce: 1}},
            {name:"Great White", cost:2010, stat:"damage", amount:6, desc:"Crushes Lead Bloons, dragging them back.", extraMods:{projectileType: 'beast_water', canHitLead: true, knockback: 40, dmgType: 'shatter'}},
            {name:"Orca", cost:12500, stat:"damage", amount:15, desc:"Huge mouth drags bloons into the depths.", extraMods:{projectileType: 'beast_water', knockback: 80, moabDmg: 5}},
            {name:"Megalodon", cost:45000, stat:"damage", amount:60, desc:"Colossal shark with a taste for Bloon.", extraMods:{projectileType: 'beast_water', knockback: 150, moabDmg: 50}}
        ],
        2: [ // Land Path
            {name:"Microraptor", cost:175, stat:"damage", amount:1, desc:"Sharp clawed little dinosaur.", extraMods:{projectileType: 'beast_land', range: -5}},
            {name:"Adasaurus", cost:830, stat:"damage", amount:3, desc:"Sharp teeth tear through Lead.", extraMods:{projectileType: 'beast_land', canHitLead: true, dmgType: 'shatter'}},
            {name:"Velociraptor", cost:2065, stat:"damage", amount:9, desc:"Slashes and chomps, dealing more damage to stunned Bloons.", extraMods:{projectileType: 'beast_land', stun: 0.5}},
            {name:"Tyrannosaurus Rex", cost:9500, stat:"damage", amount:25, desc:"Huge jaw deals a ton of damage. Stomp Ability.", extraMods:{projectileType: 'beast_land', pierce: 2, isAbility: true, abilityName: "T-Rex Stomp", abilityCd: 30}},
            {name:"Giganotosaurus", cost:60000, stat:"damage", amount:100, desc:"Shreds almost any Bloon instantly. Stomp hits whole map.", extraMods:{projectileType: 'beast_land', pierce: 4, isAbility: true, abilityName: "Giganoto Stomp", abilityCd: 30}}
        ],
        3: [ // Air Path
            {name:"Gyrfalcon", cost:190, stat:"range", amount:5, desc:"Grabs and moves Bloons.", extraMods:{projectileType: 'beast_air'}},
            {name:"Horned Owl", cost:860, stat:"canSeeCamo", amount:true, desc:"Strong enough to grab Ceramics. Detects Camo.", extraMods:{projectileType: 'beast_air', damage: 3}},
            {name:"Golden Eagle", cost:2120, stat:"damage", amount:8, desc:"Huge talons grab large numbers of Bloons.", extraMods:{projectileType: 'beast_air', pierce: 3}},
            {name:"Giant Condor", cost:9000, stat:"damage", amount:20, desc:"Can pick up smaller MOAB-Class Bloons.", extraMods:{projectileType: 'beast_air', pierce: 5, moabDmg: 5}},
            {name:"Pouākai", cost:30000, stat:"damage", amount:70, desc:"Legendary bird that can carry off almost any Bloon.", extraMods:{projectileType: 'beast_air', pierce: 9, moabDmg: 20}}
        ]
    },
    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        let pEffects = { ...effects };
        // Apply knockback for water beasts
        if (tower.stats.knockback) pEffects.knockback = tower.stats.knockback;
        // Apply stun for land beasts
        if (tower.stats.stun) pEffects.stun = tower.stats.stun;
        
        let p = engine.projectilePool.get();
        p.init(tower.x, tower.y, damage, target, tower.stats.projectileType, tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, pEffects, 0, tower, dmgType, isCrit);
    },
    ability(tower, engine) {
        // T-Rex Stomp
        if (tower.stats.abilityName === "T-Rex Stomp") {
            engine.log("T-Rex Stomp!");
            Utils.applyAoeDamage(engine, tower.x, tower.y, 150, tower.stats.damage * 2, {isExplosion: true, canHitLead: true}, tower, {stun: 2.0}, {maxHits: 50});
            engine.explosions.push({ x: tower.x, y: tower.y, radius: 0, maxRadius: 150, life: 0.5, maxLife: 0.5, color: '#e67e22' });
        }
        // Giganotosaurus Stomp
        if (tower.stats.abilityName === "Giganoto Stomp") {
            engine.log("Giganotosaurus Stomp!");
            Utils.applyAoeDamage(engine, 640, 360, 1500, tower.stats.damage * 2, {isExplosion: true, canHitLead: true}, tower, {stun: 4.0}, {maxHits: 1000});
            engine.explosions.push({ x: 640, y: 360, radius: 0, maxRadius: 1500, life: 1.0, maxLife: 1.0, color: '#c0392b' });
        }
    }
};