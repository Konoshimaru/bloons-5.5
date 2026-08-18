// js/towers/bomb.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

export default {
    stats: { 
        name: "Bomb Shooter", cost: 375, range: 40, 
        baseCooldown: 1.5, fireRate: 1.5, 
        damage: 1, pierce: 1, projectileSpeed: 180, 
        explosionRadius: 30, explosionDamage: 1, explosionPierce: 22, 
        lifespan: 1.5, canHitLead: true, 
        desc: "Launches a powerful bomb at the Bloons. Slow rate of fire but affects a radius around the explosion.", 
        dmgType: 'explosion', projectileType: 'bomb', hitRadius: 18, 
        category: 'Primary',
        projectileType: 'bomb' 
    },
    upgrades: {
        1: [
            { name: "Bigger Blast", cost: 300, stat: "explosionRadius", amount: 10, desc: "Bigger shells deliver a bigger blast radius.", extraMods:{explosionPierce: 15} },
            { name: "Heavy Bombs", cost: 650, stat:"explosionDamage", amount: 1, desc: "Smash through 2 layers and pop more Bloons.", extraMods:{explosionPierce: 8} },
            { name: "Really Big Bombs", cost: 1100, stat:"explosionDamage", amount: 1, desc: "Huge bombs deal greater damage and knock Bloons back.", extraMods:{explosionRadius: 12, knockback: 30} },
            { name: "Bloon Impact", cost: 2800, stat:"explosionRadius", amount: 10, desc: "Explosions stun Bloons for a short time.", extraMods:{stun: 0.5} },
            { name: "Bloon Crush", cost: 55000, stat:"explosionDamage", amount: 5, desc: "Massive damage and can stun MOAB-Class Bloons.", extraMods:{stun: 1.0} }
        ],
        2: [
            { name: "Faster Reload", cost: 250, desc: "Reloads faster.", extraMods:{cooldownMult: 0.8} }, 
            { name: "Missile Launcher", cost: 400, desc: "Fires missiles, faster fire rate, flight speed, and range.", extraMods:{cooldownMult: 0.8, projectileSpeed: 200, range: 4, projectileType: 'missile'}},
            { name: "MOAB Mauler", cost: 1000, stat:"moabDmg", amount: 10, desc: "MOAB Maulers do much more damage to MOAB-Class Bloons." }, 
            { name: "MOAB Assassin", cost: 3450, stat:"moabDmg", amount: 15, desc: "Assassinate MOAB Ability. Increased MOAB damage.", extraMods:{isAbility: true, abilityName: "Assassinate", abilityCd: 25} }, 
            { name: "MOAB Eliminator", cost: 26000, stat:"moabDmg", amount: 25, desc: "Massive damage to MOABs. Ability deals 6x damage.", extraMods:{isAbility: true, abilityName: "Assassinate 2", abilityCd: 10} }
        ],
        3: [
            { name: "Extra Range", cost: 200, stat:"range", amount: 10, desc: "Increases attack range." }, 
            { name: "Frag Bombs", cost: 300, desc: "Explosions throw out sharp fragments.", extraMods:{fragCount: 6, fragDamage: 1} }, 
            { name: "Cluster Bombs", cost: 700, desc: "Throws out secondary bombs instead of frags.", extraMods:{fragCount: 0, clusterCount: 4, clusterDamage: 1} }, 
            { name: "Recursive Cluster", cost: 2500, desc: "Every second shot sends out more cluster bombs.", extraMods:{clusterCount: 8} }, 
            { name: "Bomb Blitz", cost: 30000, stat:"explosionDamage", amount: 5, desc: "Much more damage. Bloons that leak trigger a massive Bomb Blitz.", extraMods:{bombBlitz: true} }
        ]
    },
    
    update(tower, dt, engine) {
        // Bombardment Ability Active Effect
        if (tower.bombardmentActive > 0) {
            tower.bombardmentActive -= dt;
            tower.buffedFireRate = Math.max(tower.buffedFireRate || 0, 8.0); 
        }
        
        // Bomb Blitz (T5): passive — a bloon leaking through triggers a screen-wide
        // blast. Internal 60s cooldown (BTD6).
        if (tower.stats.bombBlitz) {
            if (tower._lastLives !== undefined && engine.lives < tower._lastLives && (tower.blitzCd || 0) <= 0) {
                tower.blitzCd = 60.0;
                Utils.applyAoeDamage(engine, 640, 360, 1500, 1500, {isExplosion: true, canHitLead: true}, tower, {}, {maxHits: 1000});
                engine.explosions.push({ x: 640, y: 360, radius: 0, maxRadius: 1500, life: 1.0, maxLife: 1.0, color: '#e67e22' });
                engine.log("Bomb Blitz!");
            }
            tower._lastLives = engine.lives;
            if (tower.blitzCd > 0) tower.blitzCd -= dt;
        }
    },

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        let pEffects = { ...effects };
        // Apply custom effects from upgrades
        if (tower.stats.knockback) pEffects.knockback = tower.stats.knockback;
        if (tower.stats.stun) { pEffects.stun = tower.stats.stun; pEffects.stunDuration = tower.stats.stun; }
        if (tower.stats.fragCount) pEffects.fragCount = tower.stats.fragCount;
        if (tower.stats.fragDamage) pEffects.fragDamage = tower.stats.fragDamage;
        if (tower.stats.clusterCount) pEffects.clusterCount = tower.stats.clusterCount;
        if (tower.stats.clusterDamage) pEffects.clusterDamage = tower.stats.clusterDamage;
        
        // Recursive Cluster logic: Every 2nd shot spawns extra clusters
        if (tower.upgrades[2] >= 4) {
            tower.shotCount = (tower.shotCount || 0) + 1;
            if (tower.shotCount % 2 === 0) {
                pEffects.clusterCount = (pEffects.clusterCount || 0) + 4;
            }
        }
        
        let p = engine.projectilePool.get();
        p.init(tower.x, tower.y, damage, target, tower.stats.projectileType || 'bomb', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, pEffects, 0, tower, dmgType, isCrit);
    },
    
    ability(tower, engine) {
        const name = tower.stats.abilityName;
        
        // MOAB Assassin / Eliminator
        if (name === "Assassinate" || name === "Assassinate 2") {
            engine.log(name === "Assassinate 2" ? "MOAB Eliminator!" : "MOAB Assassin!");
            let target = null; let maxHp = 0;
            for (const e of engine.enemies) {
                if (!e || !e.alive || !e.data.isMoab) continue;
                if (e.hp > maxHp) { maxHp = e.hp; target = e; }
            }
            if (target) {
                let dmg = name === "Assassinate 2" ? 4500 : 750;
                target.takeDamage(dmg, {isExplosion: true, canHitLead: true}, {}, tower);
                engine.explosions.push({ x: target.x, y: target.y, radius: 0, maxRadius: 80, life: 0.5, maxLife: 0.5, color: '#e67e22' });
            }
        }
    }
};
