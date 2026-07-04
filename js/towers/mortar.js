// js/towers/mortar.js
import { GameEngine } from '../engine.js';

// Mortar tower behavior.
// This tower fires artillery shells that arc toward a target area and explode on impact.
export default {
    stats: { 
        name: "Mortar Monkey", cost: 750, range: 9999, 
        baseCooldown: 2.5, fireRate: 2.5, 
        damage: 2, pierce: 15, projectileSpeed: 400, 
        explosionRadius: 40, explosionDamage: 2, explosionPierce: 15,
        lifespan: 1.0, desc: "Lobs shells at a target area.", 
        dmgType: 'explosion', projectileType: 'mortar_shell', hitRadius: 18, 
        isStaticRotation: true 
    },
    upgrades: {
        1: [
            {name:"Bigger Blast", cost:400, stat:"explosionRadius", amount:20, desc:"Larger explosion radius."},
            {name:"Heavy Shells", cost:800, stat:"explosionDamage", amount:1, desc:"Deals 1 extra explosion damage."},
            {name:"Dragon's Breath", cost:2000, stat:"dmgType", amount:'fire', desc:"Shells burn bloons."},
            {name:"The Big One", cost:10000, stat:"explosionRadius", amount:40, desc:"Massive explosion radius.", extraMods:{explosionDamage: 3}},
            {name:"Pop and Awe", cost:25000, stat:"isAbility", amount:true, desc:"Ability: Stuns all bloons.", extraMods:{unlocksAbility:true, abilityName:"Pop&Awe", abilityCd:60}}
        ],
        2: [
            {name:"Faster Reload", cost:400, desc:"Reloads faster.", cooldownMult: 0.75},
            {name:"Cluster Bombs", cost:800, stat:"explosionDamage", amount:1, desc:"Shells split into smaller bombs."},
            {name:"Heavy Shells", cost:2000, stat:"canHitLead", amount:true, desc:"Can pop Lead bloons."},
            {name:"Signal Flare", cost:4000, stat:"canSeeCamo", amount:true, desc:"Can detect Camo bloons."},
            {name:"Artillery Battery", cost:20000, desc:"Fires 3 times per shot.", cooldownMult: 0.33}
        ],
        3: [
            {name:"Burny Stuff", cost:400, stat:"dmgType", amount:'fire', desc:"Shells burn bloons."},
            {name:"Camo Detection", cost:500, stat:"canSeeCamo", amount:true, desc:"Can detect Camo bloons."},
            {name:"Shrapnel Shot", cost:1500, stat:"explosionPierce", amount:10, desc:"Explosion hits 10 more bloons."},
            {name:"MOAB Assassin", cost:5000, stat:"moabDmg", amount:10, desc:"Deals 10 extra damage to MOABs."},
            {name:"Shell Shock", cost:25000, stat:"explosionDamage", amount:5, desc:"Massive explosion damage."}
        ]
    },
    // The shared tower behavior system already handles targeting, cooldowns, and damage calculation.
    // This method only creates the mortar shell projectile so the shell can travel and explode later.
    fire(tower, target, damage, dmgType, isCrit, effects) {
        let p = GameEngine.projectilePool.get();
        // The mortar uses a projectile object rather than a direct hit because it needs to arc and detonate at range.
        p.init(tower.x, tower.y, damage, target, 'mortar_shell', tower.stats.projectileSpeed, 1, tower.stats.lifespan, null, effects, 0, tower, dmgType);
    },
    ability(tower, engine) {
        // Pop and Awe is a big-screen offensive ability that punishes every bloon currently on the field.
        engine.log("Pop and Awe!");
        for (let e of engine.enemies) {
            if (!e.alive) continue;
            // A hard stop prevents the affected bloons from advancing during the burst.
            e.applySlow(0.0, 3.0, false); 
            // The burst damage uses a scaled-up version of the tower's normal damage for a dramatic payoff.
            e.takeDamage(tower.stats.damage * 5, { isExplosion: true, canHitLead: true });
        }
        // The explosion effect is intentionally huge so players can clearly see the ability trigger.
        engine.explosions.push({ x: 450, y: 300, radius: 0, maxRadius: 900, life: 0.8, maxLife: 0.8, color: '#ffffff' });
    }
};