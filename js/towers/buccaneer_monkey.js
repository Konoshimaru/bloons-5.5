// buccaneer_monkey.js
// Defines the Buccaneer Monkey tower and its ship-based attacks.

import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

export default {
    stats: { 
        name: "Monkey Buccaneer", cost: 400, range: 40, fireRate: 1.0, 
        damage: 1, pierce: 4, projectileSpeed: 600, lifespan: 1.0, 
        desc: "Fires darts from both sides. Must be placed on water.", 
        dmgType: 'sharp', projectileType: 'dart', hitRadius: 12, 
        waterOnly: true, category: 'Military',
        projectileCount: 1 // Base 1, Double Shot makes it 2
    },
    upgrades: {
        1: [
            {name:"Faster Shooting", cost:275, desc:"All weapons on board shoot faster.", extraMods:{cooldownMult: 0.75}},
            {name:"Double Shot", cost:425, stat:"projectileCount", amount:1, desc:"Increases ship weapons fired."},
            {name:"Destroyer", cost:3350, desc:"Attacks super duper fast!", extraMods:{cooldownMult: 0.33}},
            {name:"Aircraft Carrier", cost:8000, stat:"damage", amount:2, desc:"Launches waves of fighter planes and missiles.", extraMods:{pierce: 10}},
            {name:"Carrier Flagship", cost:26000, stat:"damage", amount:5, desc:"Buff water/aces attack speed. Extra damage.", extraMods:{pierce: 10, range: 10}}
        ],
        2: [
            {name:"Grape Shot", cost:550, desc:"Adds a spray of 5 sharpened grapes.", extraMods:{grapeCount: 5}},
            {name:"Hot Shot", cost:500, stat:"dmgType", amount:'fire', desc:"Burning hot grape shot can pop Lead Bloons and set Bloons on fire."},
            {name:"Cannon Ship", cost:900, desc:"Adds a powerful cannon that shoots out powerful bombs.", extraMods:{isCannon: true}},
            {name:"Monkey Pirates", cost:3900, stat:"damage", amount:3, desc:"Adds 2 cannons. MOAB Takedown Ability.", extraMods:{isAbility: true, abilityName: "MOAB Takedown", abilityCd: 40, cannonCount: 3}},
            {name:"Pirate Lord", cost:27000, stat:"damage", amount:10, desc:"Greatly improved power. Multiple grappling hooks.", extraMods:{isAbility: true, abilityName: "MOAB Takedown 2", abilityCd: 20, cannonCount: 5}}
        ],
        3: [
            {name:"Long Range", cost:200, stat:"range", amount:15, desc:"Much longer range, projectiles fly faster and pierce more.", extraMods:{projectileSpeed: 200, pierce: 2}},
            {name:"Crow's Nest", cost:350, stat:"canSeeCamo", amount:true, desc:"Allows the ship to hit Camo Bloons."},
            {name:"Merchantman", cost:2400, desc:"Generates cash each round. Deals more damage when over 10k cash.", extraMods:{income: 300}},
            {name:"Favored Trades", cost:5500, desc:"Generates lots of money. Deals more damage when over 50k cash.", extraMods:{income: 800}},
            {name:"Trade Empire", cost:23000, desc:"Generates more cash. Grants up to 20 Merchantmen bonus damage.", extraMods:{income: 1500}}
        ]
    },
    
    update(tower, dt, engine) {
        // 1. Passive Income Generation (Path 3 T3+)
        if (tower.stats.income) {
            tower.incomeTimer = (tower.incomeTimer || 0) - dt;
            if (tower.incomeTimer <= 0) {
                tower.incomeTimer = 15.0; // Payout every 15 seconds
                engine.addCash(Math.floor(tower.stats.income / 2)); // Halved to balance per-second vs per-round
            }
        }

        // 2. Carrier Flagship Buff (Path 1 T5)
        if (tower.upgrades[0] >= 5) {
            const range = Utils.getEffectiveRange(tower, engine);
            for (const t of engine.towers) {
                if (t && (t.stats.waterOnly || t.type === 'ace') && Utils.distanceSq(tower.x, tower.y, t.x, t.y) < range * range) {
                    t.addBuff('flagship', 'Carrier Flagship', 0.5, 1, { type: 'flagship' }, false);
                    t.buffedFireRate = Math.max(t.buffedFireRate || 0, 0.15); // +15% attack speed
                }
            }
        }

        // 3. Merchantman Damage Boost (Path 3 T3+)
        if (tower.upgrades[2] >= 3) {
            let bonus = 0;
            if (engine.cash > 10000) bonus += 2;
            if (engine.cash > 50000) bonus += 4;
            tower.buffedDmg = Math.max(tower.buffedDmg || 0, bonus);
        }
    },

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        let count = tower.stats.projectileCount || 1;
        let grapeCount = tower.stats.grapeCount || 0;
        let isCannon = tower.stats.isCannon;
        let cannons = tower.stats.cannonCount || 1; // Default 1 if Cannon Ship is bought
        
        // Left Cannon Darts (Main target)
        for (let i = 0; i < count; i++) {
            let offset = i * -15; // Slight spread for Double Shot
            let p = engine.projectilePool.get();
            p.init(tower.x, tower.y, damage, target, 'dart', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, effects, offset, tower, dmgType, isCrit);
        }

        // Right Cannon Dart (Always fires at +15 degree offset to simulate second barrel)
        let p2 = engine.projectilePool.get();
        p2.init(tower.x, tower.y, damage, target, 'dart', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, effects, 15, tower, dmgType, isCrit);

        // Grape Shot (Path 2 T1+)
        if (grapeCount > 0) {
            let gDmgType = tower.upgrades[1] >= 2 ? 'fire' : 'sharp'; // Hot Shot makes them fire
            for (let i = 0; i < grapeCount; i++) {
                let offset = -20 + (40 / (grapeCount - 1)) * i;
                let p = engine.projectilePool.get();
                p.init(tower.x, tower.y, damage, target, 'tack', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, effects, offset, tower, gDmgType, isCrit);
            }
        }

        // Cannons (Path 2 T3+)
        if (isCannon) {
            for (let i = 0; i < cannons; i++) {
                let offset = -10 * (i + 1);
                let p = engine.projectilePool.get();
                p.init(tower.x, tower.y, damage + 2, target, 'bomb', 500, 20, 2.0, null, {isExplosive: true, explosionRadius: 40, explosionDamage: damage + 2, canHitLead: true}, offset, tower, {isExplosion: true, canHitLead: true});
            }
        }

        // Aircraft Carrier / Flagship Simulated Planes (High pierce, fast darts)
        if (tower.upgrades[0] >= 4) {
            let p = engine.projectilePool.get();
            p.init(tower.x, tower.y, damage, target, 'dart', 1000, 20, 1.5, null, effects, 0, tower, dmgType, isCrit);
        }
    },

    ability(tower, engine) {
        if (tower.stats.abilityName === "MOAB Takedown" || tower.stats.abilityName === "MOAB Takedown 2") {
            engine.log("MOAB Takedown!");
            let target = null;
            let maxHp = 0;
            
            // Find the strongest MOAB-class bloon
            for (const e of engine.enemies) {
                if (!e || !e.alive) continue;
                if (e.data.isMoab && e.hp > maxHp) {
                    maxHp = e.hp;
                    target = e;
                }
            }
            
            if (target) {
                // Instakill it and grant plunder cash
                target.takeDamage(99999, {isExplosion: true, canHitLead: true}, {}, tower);
                let plunderCash = tower.stats.abilityName === "MOAB Takedown 2" ? 1500 : 750;
                engine.addCash(plunderCash);
                engine.spawnPopEffect(target.x, target.y, '#f1c40f');
                engine.explosions.push({ x: target.x, y: target.y, radius: 0, maxRadius: 100, life: 0.5, maxLife: 0.5, color: '#e67e22' });
            }
        }
    }
};
