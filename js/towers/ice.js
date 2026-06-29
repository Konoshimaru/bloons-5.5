// js/towers/ice.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js'; // PRO FIX: Added missing import to prevent crash

export default {
    stats: { 
        name: "Ice Monkey", cost: 500, range: 35, 
        baseCooldown: 1.2, fireRate: 1.2, 
        damage: 0, pierce: 10, projectileSpeed: 0, 
        lifespan: 0.1, desc: "Freezes nearby bloons.", 
        dmgType: 'ice', projectileType: 'ice', hitRadius: 18, 
        isStaticRotation: true 
    },
    upgrades: {
        1: [
            {name:"Permafrost", cost:300, stat:"slowFactor", amount:0.4, desc:"Frozen bloons move slower after thawing."},
            {name:"Deep Freeze", cost:400, stat:"damage", amount:1, desc:"Deals 1 damage and freezes for longer."},
            {name:"Metal Freeze", cost:600, stat:"canHitLead", amount:true, desc:"Can freeze Lead bloons."},
            {name:"Embrittlement", cost:2500, stat:"damage", amount:1, desc:"Frozen bloons take extra damage from sharp sources."},
            {name:"Absolute Zero", cost:25000, stat:"isAbility", amount:true, desc:"Ability: Freezes all bloons on screen.", extraMods:{unlocksAbility:true, abilityName:"Abs Zero", abilityCd:60}}
        ],
        2: [
            // Converted to multiplicative cooldown
            {name:"Faster Thaw", cost:300, desc:"Attacks faster.", cooldownMult: 0.85},
            {name:"Snap Freeze", cost:500, stat:"damage", amount:1, desc:"Freezes and deals 1 damage."},
            {name:"Arctic Wind", cost:800, stat:"range", amount:40, desc:"Greatly increases range."},
            {name:"Snowstorm", cost:2500, stat:"isAbility", amount:true, desc:"Ability: Freezes all bloons on screen.", extraMods:{unlocksAbility:true, abilityName:"Blizzard", abilityCd:60}},
            {name:"Icicles", cost:12000, stat:"damage", amount:2, desc:"Shoots icicles that deal heavy damage."}
        ],
        3: [
            {name:"Cold Snap", cost:400, stat:"canHitLead", amount:true, desc:"Can freeze Lead bloons."},
            {name:"Frost Aura", cost:600, stat:"range", amount:20, desc:"Damages bloons in range over time."},
            {name:"Re-Freezer", cost:2000, stat:"slowDuration", amount:2, desc:"Freezes for longer."},
            // Converted to multiplicative cooldown
            {name:"Cryo Cannon", cost:5000, desc:"Shoots a continuous beam of ice.", cooldownMult: 0.5},
            {name:"Super Freeze", cost:30000, stat:"slowFactor", amount:0.1, desc:"Freezes bloons almost completely solid."}
        ]
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        // Ice monkey hits everything in range instantly
        let expRadius = tower.stats.range * 3.0; 
        GameEngine.explosions.push({ x: tower.x, y: tower.y, radius: 0, maxRadius: expRadius, life: 0.2, maxLife: 0.2, color: '#1abc9c' });
        const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, expRadius);
        for (let e of nearby) {
            if (!e.alive) continue;
            if (Utils.distance(tower.x, tower.y, e.x, e.y) < expRadius) {
                e.takeDamage(damage, dmgType, { slow: tower.stats.slowFactor || 0.5, slowDuration: tower.stats.slowDuration || 2.0 });
            }
        }
    },
    ability(tower, engine) {
        engine.log("Absolute Zero!");
        for (let e of engine.enemies) {
            if (!e.alive) continue;
            e.applySlow(0.0, 4.0, true);
        }
    }
};