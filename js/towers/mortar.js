// js/towers/mortar.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

// Mortar tower behavior.
// This tower fires artillery shells that arc toward a target area and explode on impact.
export default {
    stats: { 
        name: "Mortar Monkey", cost: 600, range: 9999, 
        baseCooldown: 2.0, fireRate: 2.0, 
        damage: 2, pierce: 1, projectileSpeed: 400, 
        explosionRadius: 20, explosionDamage: 2, explosionPierce: 25,
        lifespan: 4.0, desc: "Launches an exploding mortar shell to a fixed location anywhere on the screen.", 
        // ... rest of stats
        dmgType: 'explosion', projectileType: 'mortar_shell', hitRadius: 18, 
        isStaticRotation: true, category: 'Military'
    },
    upgrades: {
        1: [
            {name:"Bigger Blast", cost:300, stat:"explosionRadius", amount:10, desc:"Bigger shells deliver a bigger blast radius."},
            {name:"Bloon Buster", cost:500, stat:"explosionDamage", amount:1, desc:"Smash through 3 layers of Bloons at once!"},
            {name:"Shell Shock", cost:825, stat:"explosionDamage", amount:1, desc:"Blast shockwave stuns Bloons at impact and pops bloons in a wider area.", extraMods:{explosionRadius: 10, stun: 0.5}},
            {name:"The Big One", cost:7000, stat:"explosionDamage", amount:8, desc:"Devastating explosions pop 10 layers.", extraMods:{explosionRadius: 20}},
            {name:"The Biggest One", cost:36000, stat:"explosionDamage", amount:20, desc:"Blasts deeply through Bloons and layers over a huge area.", extraMods:{explosionRadius: 30}}
        ],
        2: [
            {name:"Faster Reload", cost:400, desc:"Increases the attack speed of the Mortar.", extraMods:{cooldownMult: 0.8}},
            {name:"Rapid Reload", cost:500, desc:"Even faster reload.", extraMods:{cooldownMult: 0.8}},
            {name:"Heavy Shells", cost:900, stat:"moabDmg", amount:3, desc:"Extra damage to Ceramic, Lead, Fortified, MOABs. Attacks faster.", extraMods:{ceramicDmg: 2, cooldownMult: 0.9}},
            {name:"Artillery Battery", cost:6500, desc:"Bombardment Ability: Unleashes a rapid fire attack. Upgrades to 3 barrels.", extraMods:{isAbility: true, abilityName: "Bombardment", abilityCd: 45}},
            {name:"Pop and Awe", cost:38000, desc:"Permanent rapid attack speed. Ability: rains explosions over the whole screen, damaging and stunning.", extraMods:{isAbility: true, abilityName: "Pop and Awe", abilityCd: 60, cooldownMult: 0.5}}
        ],
        3: [
            {name:"Increased Accuracy", cost:200, stat:"explosionRadius", amount:5, desc:"Makes the shots more accurate."},
            {name:"Burny Stuff", cost:400, desc:"Damaged Bloons are set ablaze momentarily with each hit.", extraMods:{dot: 1, dotTimer: 3.0}},
            {name:"Signal Flare", cost:1100, stat:"canSeeCamo", amount:true, desc:"Camo Bloons popped by flares lose their camouflage permanently.", extraMods:{stripCamo: true}},
            {name:"Shattering Shells", cost:9500, desc:"Shattering shells strip special Bloon properties off all but the biggest bloons.", extraMods:{stripFortified: true, stripCamo: true, stripRegen: true, dot: 5, dotTimer: 1.0}},
            {name:"Blooncineration", cost:40000, desc:"Superhot burny stuff that incinerates MOAB-Class Bloons with ease.", extraMods:{dot: 50, dotTimer: 1.0, moabDot: 50, moabDotTimer: 1.0}}
        ]
    },
    
    update(tower, dt, engine) {
        // Bombardment Ability Active Effect
        if (tower.bombardmentActive > 0) {
            tower.bombardmentActive -= dt;
            tower.buffedFireRate = Math.max(tower.buffedFireRate || 0, 1.0); 
        }
    },

    // The shared tower behavior system already handles targeting, cooldowns, and damage calculation.
    // This method only creates the mortar shell projectile so the shell can travel and explode later.
    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        let pEffects = { ...effects };
        
        // Apply custom effects from upgrades
        if (tower.stats.stun) pEffects.stun = tower.stats.stun;
        if (tower.stats.dot) { pEffects.dot = tower.stats.dot; pEffects.dotTimer = tower.stats.dotTimer || 3.0; }
        if (tower.stats.moabDot) { pEffects.moabDot = tower.stats.moabDot; pEffects.moabDotTimer = tower.stats.moabDotTimer; }
        if (tower.stats.stripCamo) pEffects.stripCamo = true;
        if (tower.stats.stripFortified) pEffects.stripFortified = true;
        if (tower.stats.stripRegen) pEffects.foam = true; // Foam effect strips Camo and Regen in the engine
        
        // Artillery Battery (Path 2 T4+) fires 3 shells per attack
        let shots = tower.upgrades[1] >= 4 ? 3 : 1;
        for (let i = 0; i < shots; i++) {
            let p = engine.projectilePool.get();
            // The mortar uses a projectile object rather than a direct hit because it needs to arc and detonate at range.
            p.init(tower.x, tower.y, damage, target, 'mortar_shell', tower.stats.projectileSpeed, 1, tower.stats.lifespan, null, pEffects, 0, tower, dmgType, isCrit);
        }
    },
    
    ability(tower, engine) {
        // Bombardment Ability
        if (tower.stats.abilityName === "Bombardment") {
            engine.log("Bombardment!");
            tower.bombardmentActive = 4.0; // 4 seconds of insane attack speed
        }
        
        // Pop and Awe Ability
        if (tower.stats.abilityName === "Pop and Awe") {
            engine.log("Pop and Awe!");
            // Rains explosions over the whole screen, damaging and stunning all bloons
            for (const e of engine.enemies) {
                if (!e || !e.alive) continue;
                // Deal heavy damage and stun for 1 second
                e.takeDamage(tower.stats.damage * 3, { isExplosion: true, canHitLead: true }, { stun: 1.0 }, tower);
                // Visual explosion on every bloon
                engine.explosions.push({ x: e.x, y: e.y, radius: 0, maxRadius: 40, life: 0.3, maxLife: 0.3, color: '#e67e22' });
            }
        }
    }
};
