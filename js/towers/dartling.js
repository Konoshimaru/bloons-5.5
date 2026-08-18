// js/towers/dartling.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

export default {
    stats: { 
        name: "Dartling Gunner", cost: 850, range: 9999, 
        baseCooldown: 0.2, fireRate: 0.2, 
        damage: 1, pierce: 1, projectileSpeed: 700, 
        lifespan: 2.5, desc: "Aims wherever you point. High rate of fire.", 
        // ... rest of stats
        dmgType: 'sharp', projectileType: 'dart', hitRadius: 12,
        spread: 23, // Degrees of random spread
        category: 'Military', manualFire: true
    },
    upgrades: {
        1: [
            {name:"Focused Firing", cost:300, desc:"Increases accuracy of the Dartling Gun.", extraMods:{spread: 10}},
            {name:"Laser Shock", cost:900, desc:"Laser tipped shots shock Bloons into popping again 1 second later.", extraMods:{dot: 1, dotTimer: 1.0}},
            {name:"Laser Cannon", cost:3000, stat:"damage", amount:1, desc:"Rapidly fires much more powerful laser blasts.", extraMods:{cooldownMult: 0.5, dmgType: 'energy', projectileType: 'laser', moabDmg: 5}},
            {name:"Plasma Accelerator", cost:11750, stat:"damage", amount:4, desc:"Concentrates a powerful beam of energy to a single point.", extraMods:{pierce: 5, dmgType: 'plasma', projectileType: 'plasma'}},
            {name:"Ray of Doom", cost:75000, stat:"damage", amount:45, desc:"Creates a solid line of annihilation.", extraMods:{pierce: 100, cooldownMult: 0.5}}
        ],
        2: [
            {name:"Advanced Targeting", cost:250, stat:"canSeeCamo", amount:true, desc:"Allows Dartling Gunner to hit Camo Bloons."},
            {name:"Faster Barrel Spin", cost:950, desc:"Makes gun fire much faster.", extraMods:{cooldownMult: 0.5}},
            {name:"Hydra Rocket Pods", cost:4500, desc:"Shoots depleted bloontonium missiles that trigger multiple explosions.", extraMods:{projectileType: 'bomb', isExplosive: true, explosionRadius: 30, explosionDamage: 1, explosionPierce: 10, cooldownMult: 1.5, canHitLead: true}},
            {name:"Rocket Storm", cost:5000, desc:"Rocket Storm ability: Launches a powerful storm of rockets in a wide cone.", extraMods:{isAbility: true, abilityName: "Rocket Storm", abilityCd: 45}},
            {name:"M.A.D.", cost:65000, stat:"damage", amount:50, desc:"MOAB Assured Destroyer. Mega missiles deal extreme damage to MOAB-class.", extraMods:{cooldownMult: 1.5, moabDmg: 100, explosionRadius: 50, explosionDamage: 50, explosionPierce: 50}}
        ],
        3: [
            {name:"Faster Swivel", cost:150, stat:"range", amount:0, desc:"Barrel can swivel much faster."}, // Visual only in this engine
            {name:"Powerful Darts", cost:1200, stat:"pierce", amount:2, desc:"Darts move faster, can pop frozen Bloons and pop 3 Bloons each.", extraMods:{projectileSpeed: 300}},
            {name:"Buckshot", cost:3000, stat:"projectileCount", amount:4, desc:"Shoots blasts of deadly buckshot instead of darts.", extraMods:{spread: 45, cooldownMult: 1.5, projectileType: 'spike_opult'}},
            {name:"Bloon Area Denial System", cost:12000, stat:"projectileCount", amount:1, desc:"4-barreled auto-cannon that can be set to attack automatically.", extraMods:{cooldownMult: 0.5}},
            {name:"Bloon Exclusion Zone", cost:58000, stat:"damage", amount:4, desc:"Upgraded to 6 barrels and massively increased damage.", extraMods:{projectileCount: 2, pierce: 4, cooldownMult: 0.8}}
        ]
    },

    update(tower, dt, engine) {
        // 1. Force aim at mouse cursor
        if (engine.mouse.x !== undefined) {
            tower.angle = Utils.angle(tower.x, tower.y, engine.mouse.x, engine.mouse.y);
        }

        // 2. Manual Fire Logic (Bypasses standard target finding)
        tower.cooldown -= dt;
        if (tower.cooldown <= 0) {
            let cd = tower.stats.fireRate || tower.stats.baseCooldown;
            if (tower._cooldownMult) cd *= tower._cooldownMult;
            if (tower.buffedFireRate > 0) cd /= (1 + tower.buffedFireRate);
            tower.cooldown = Math.max(0.01, cd);
            
            // Fire at mouse position
            let fakeTarget = { x: engine.mouse.x, y: engine.mouse.y };
            this.fire(tower, fakeTarget, tower.stats.damage, tower.stats.dmgType, false, {}, engine);
        }

        // 3. Rocket Storm Ability Active Effect
        if (tower.rocketStormActive > 0) {
            tower.rocketStormActive -= dt;
            tower.stormTimer = (tower.stormTimer || 0) - dt;
            if (tower.stormTimer <= 0) {
                tower.stormTimer = 0.05; // Fire 20 times a second
                let fakeTarget = { x: engine.mouse.x, y: engine.mouse.y };
                let p = engine.projectilePool.get();
                p.init(tower.x, tower.y, 5, fakeTarget, 'bomb', 600, 10, 2.0, null, {isExplosive: true, explosionRadius: 30, explosionDamage: 5, canHitLead: true}, 0, tower, {isExplosion: true, canHitLead: true, moabDmg: tower.stats.moabDmg || 0});
            }
        }
    },

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        let count = tower.stats.projectileCount || 1;
        let spread = tower.stats.spread || 23;
        let pEffects = { ...effects };
        
        // Apply Laser Shock DoT
        if (tower.stats.dot) { 
            pEffects.dot = tower.stats.dot; 
            pEffects.dotTimer = tower.stats.dotTimer; 
        }
        
        // Apply Hydra Rocket/MAD explosive properties
        if (tower.stats.isExplosive) {
            pEffects.isExplosive = true;
            pEffects.explosionRadius = tower.stats.explosionRadius;
            pEffects.explosionDamage = tower.stats.explosionDamage;
            pEffects.explosionPierce = tower.stats.explosionPierce;
        }

        for (let i = 0; i < count; i++) {
            // Calculate spread offset
            let offset = count > 1 ? (spread * (i - (count - 1) / 2)) : 0;
            offset += (Math.random() - 0.5) * spread; // Add randomness
            
            let p = engine.projectilePool.get();
            p.init(tower.x, tower.y, damage, target, tower.stats.projectileType, tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, pEffects, offset, tower, dmgType, isCrit);
        }
    },

    ability(tower, engine) {
        if (tower.stats.abilityName === "Rocket Storm") {
            engine.log("Rocket Storm!");
            tower.rocketStormActive = 8.0; // 8 seconds of rocket spam
            tower.stormTimer = 0;
        }
    }
};
