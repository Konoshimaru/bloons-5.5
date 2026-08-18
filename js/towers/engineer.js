/**
 * SUB-ENTITY PATTERN: LIGHTWEIGHT INLINE ARRAY
 * ============================================
 * The Engineer (and Mermonkey) use a "Lightweight Inline Array" pattern for 
 * their sub-entities (Sentries / Tentacles).
 * 
 * - Lifecycle: Stored as plain objects inside `tower.sentries[]` (or `tower.tentacles[]`).
 * - Updates: Updated manually inside the tower's own `update(dt, engine)` method.
 * - Targeting: Target acquisition is handled inline within the tower's update loop.
 * - Rendering: Drawn manually by the tower's `draw(ctx, tower)` method.
 * 
 * This pattern is best for high-count, short-lived, or highly coupled sub-entities
 * that don't need the full overhead of a standalone class or spatial grid insertion.
 */

// js/towers/engineer.js
import { GameEngine } from '../engine.js';
import { Utils, drawShadow } from '../utils.js';
import { RANGE_SCALE } from '../config.js';
import { createDmgType, resolveDmgType } from '../damageTypes.js';
import { GLOBAL_SCALE } from '../constants.js';
import { Sentry } from '../sentryEntity.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

const _sentryTrapScratch = [];

export default {
    stats: {
        name: "Engineer Monkey", scale:1.2, cost: 350, range: 40, 
        baseCooldown: 0.70, fireRate: 0.70, lifespan: 0.24, 
        damage: 1, pierce: 3, projectileSpeed: 650, 
        desc: "Holds a trusty nail-gun to pop the Bloons. Can upgrade to create its own nail-shooting sentry turrets.",
        dmgType: 'sharp', projectileType: 'nail', hitRadius: 18, maxSentries: 0
    },
    upgrades: {
        1: [
            {name:"Sentry Gun",cost:500,stat:"maxSentries",amount:1,desc:"Creates temporary sentry guns and deploys them close to track anywhere in radius."},
            {name:"Faster Engineering",cost:400,stat:"sentrySpawnMod",amount:0.5,desc:"Increased efficiency allows the Engineer to produce sentries, foam and bloon traps more often."}, 
            {name:"Sprockets",cost:575,desc:"Increases sentry gun and Engineer attack speed.", cooldownMult: 0.5, extraMods: {sentryFireRateMod: 0.5}},
            {name:"Sentry Expert",cost:2500,stat:"maxSentries",amount:3,desc:"Sentries deploy with different damage types based on your need."},
            {name:"Sentry Champion",cost:32000,stat:"maxSentries",amount:-3,desc:"Creates super-powerful but highly unstable sentries.", extraMods: {sentryDmg: 3, sentryPierce: 5, sentryFireRate: 0.06, sentryExplode: true}, cooldownMult: 0.85}
        ],
        2: [
            {name:"Larger Service Area",cost:250,stat:"range",amount:20,desc:"Shoots further and deploys sentries in a much larger area. Sentries have longer range.", extraMods: {sentryRange: 5}},
            {name:"Deconstruction",cost:350,stat:"moabDmg",amount:1,desc:"Nail gun and Sentry shots do extra damage to MOAB-class and Fortified Bloons.", extraMods: {fortifiedDmg: 1}},
            {name:"Cleansing Foam",cost:900,stat:"canHitLead",amount:true,desc:"Sprays foam that removes Camo and Regrow and pops Lead Bloons.", extraMods: {canSeeCamo: true, applyFoam: true, foamPierce: 10}},
            {name:"Overclock",cost:13500,stat:"isAbility",amount:true,desc:"Overclock Ability: Target another tower to supercharge its attack speed for a short time.", extraMods: {abilityCd: 45, abilityName: "Overclock"}, statMods: [{stat: "pierce", amount: 12}, {stat: "projectileSpeed", amount: 550}, {stat: "foamPierce", amount: 4}]},
            {name:"Ultraboost",cost:72000,stat:"isAbility",amount:true,desc:"Ultra-Overclocked Monkeys gain a small but permanent boost every time they are overclocked.", extraMods: {abilityCd: 35, abilityName: "Ultraboost"}, statMods: [{stat: "pierce", amount: 15}, {stat: "foamPierce", amount: 10}]}
        ],
        3: [
            {name:"Oversize Nails",cost:450,stat:"pierce",amount:5,desc:"Massivization allows nails to pop 8 Bloons at once, including frozen. Also increases Foam and Sentry effectiveness.", extraMods: {dmgType: 'shatter'}}, 
            {name:"Pin",cost:220,stat:"applyPin",amount:true,desc:"Pins Bloons in place for a short time when struck."},
            {name:"Double Gun",cost:450,desc:"Two guns for twice the fun.", cooldownMult: 0.5, extraMods: {sentryProjCount: 1}},
            {name:"Bloon Trap",cost:3600,stat:"trapRbe",amount:500,desc:"Bloon trap captures Bloons until full. Select to empty full trap for cash.", extraMods: {trapCooldown: 12, trapRadius: 10}},
            {name:"XXXL Trap",cost:45000,stat:"trapRbe",amount:9500,desc:"Huge Bloon traps can trap some of the largest Bloons in them...", extraMods: {trapMoab: true, trapCooldown: 4.6, trapRadius: 10}}
        ]
    },
    
    onSell(tower, engine) {
        if (tower.sentries) {
            for (let s of tower.sentries) {
                s.alive = false;
                const idx = engine.sentries.indexOf(s);
                if (idx > -1) engine.sentries.splice(idx, 1);
            }
        }
    },

    update(tower, dt, engine) {
        let spawnMod = tower.stats.sentrySpawnMod || 1;
        let sentryFireRateMod = tower.stats.sentryFireRateMod || 1;
        
        // Overclock/Ultraboost may only be used a limited number of times per round.
        if (engine && engine.waveManager) {
            if (!tower._ocWaveOn && engine.waveManager.waveActive) {
                tower._ocWaveOn = true;
                tower.overclockUsesThisRound = 0;
            } else if (tower._ocWaveOn && !engine.waveManager.waveActive) {
                tower._ocWaveOn = false;
            }
        }
        
        if (!tower.sentryCooldown) tower.sentryCooldown = 10;
        if (!tower.sentrySpawnIndex) tower.sentrySpawnIndex = 0;

        // --- SENTRY SPAWNING LOGIC ---
        if (tower.stats.maxSentries > 0 && tower.sentries.length < tower.stats.maxSentries) {
            tower.sentryCooldown -= dt * spawnMod;
            if (tower.sentryCooldown <= 0) {
                let sX = 0, sY = 0;
                let validSpawn = false;
                
                for (let attempt = 0; attempt < 10; attempt++) {
                    let ang = Math.random() * Math.PI * 2; 
                    let dist = Math.random() * tower.stats.range * RANGE_SCALE * 0.8;
                    sX = tower.x + Math.cos(ang) * dist; 
                    sY = tower.y + Math.sin(ang) * dist;
                    
                    if (GameEngine.map.isOnPath(sX, sY) || GameEngine.map.isInWater(sX, sY) || GameEngine.map.isOnProp(sX, sY)) continue;
                    
                    let overlapsTower = false;
                    for (let t of GameEngine.towers) {
                        if (t && Utils.distanceSq(sX, sY, t.x, t.y) < Math.pow(t.hitRadius + 15, 2)) {
                            overlapsTower = true; break;
                        }
                    }
                    if (overlapsTower) continue;
                    
                    let overlapsSentry = false;
                    for (let s of GameEngine.sentries) {
                        if (Utils.distanceSq(sX, sY, s.x, s.y) < Math.pow(30, 2)) {
                            overlapsSentry = true; break;
                        }
                    }
                    if (overlapsSentry) continue;
                    
                    validSpawn = true; break;
                }
                
                if (validSpawn) {
                    tower.sentryCooldown = 10; 
                    const idx = tower.sentrySpawnIndex % 4; 
                    tower.sentrySpawnIndex++;
                    
                    let baseSentryRange = 45;
                    if (tower.upgrades[0] >= 4) baseSentryRange = 50; 
                    let sentryRange = baseSentryRange + (tower.stats.sentryRange || 0);

                    let config = {
                        name: "Sentry Gun",
                        range: sentryRange,
                        damage: 1, pierce: 2, fireRate: 0.95 * sentryFireRateMod,
                        dmgType: 'sharp', projCount: 1, projSpeed: 520, projLifespan: 0.25, color: '#7f8c8d'
                    };

                    if (tower.upgrades[0] === 4) {
                        if (idx === 0) config = { name: "Crushing Sentry", range: sentryRange, damage: 2, pierce: 22, fireRate: 1.2 * sentryFireRateMod, dmgType: 'shatter', projCount: 1, projSpeed: 260, projLifespan: 1.0, ceramicDmg: 4, color: '#7f8c8d' };
                        if (idx === 1) config = { name: "Boom Sentry", range: sentryRange, damage: 1, pierce: 1, fireRate: 1.0 * sentryFireRateMod, dmgType: 'sharp', projCount: 1, projSpeed: 315, projLifespan: 0.6, color: '#e67e22', effects: { isExplosive: true, explosionRadius: 18, explosionDamage: 4, explosionPierce: 30, canHitLead: true } };
                        if (idx === 2) config = { name: "Cold Sentry", range: sentryRange, damage: 1, pierce: 1, fireRate: 1.5 * sentryFireRateMod, dmgType: 'sharp', projCount: 1, projSpeed: 315, projLifespan: 0.6, color: '#1abc9c', effects: { isExplosive: true, explosionRadius: 18, explosionDamage: 1, explosionPierce: 24, freeze: 1.5, permafrost: true, canHitMoab: false } };
                        if (idx === 3) config = { name: "Energy Sentry", range: sentryRange, damage: 2, pierce: 8, fireRate: 0.57 * sentryFireRateMod, dmgType: 'energy', projCount: 1, projSpeed: 490, projLifespan: 0.6, moabDmg: 2, color: '#f1c40f' };
                    }
                    if (tower.upgrades[0] === 5) { 
                        config = { name: "Sentry Champion", range: sentryRange, damage: 3, pierce: 5, fireRate: 0.06 * sentryFireRateMod, dmgType: 'plasma', projCount: 1, projSpeed: 490, projLifespan: 0.6, color: '#9b59b6', explode: true, explosionDamage: 100, explosionPierce: 50, explosionRadius: 50 };
                    }

                    const sentry = new Sentry(sX, sY, config, tower);
                    tower.sentries.push(sentry);
                    GameEngine.sentries.push(sentry);
                } else {
                    tower.sentryCooldown = 0.1; 
                }
            }
        }

        // --- CLEANSING FOAM LOGIC ---
        if (tower.stats.applyFoam) {
            if (!tower.foamCooldown) tower.foamCooldown = 2.0; 
            tower.foamCooldown -= dt;
            if (tower.foamCooldown <= 0) {
                tower.foamCooldown = 2.0;
                for (let i = 0; i < 4; i++) {
                    let ang = (i / 4) * Math.PI * 2 + (tower.foamAngleOffset || 0);
                    let dist = Math.random() * tower.stats.range * RANGE_SCALE * 0.5;
                    let fx = tower.x + Math.cos(ang) * dist;
                    let fy = tower.y + Math.sin(ang) * dist;
                    
                    let pt = GameEngine.map.getNearestPathPoint(fx, fy);
                    GameEngine.acidPools.push({
                        x: pt.x, y: pt.y, radius: 9 * GS, life: 8.5, tick: 0, 
                        isFoam: true, pierce: tower.stats.foamPierce || 10, hitEnemies: new Set()
                    });
                }
                tower.foamAngleOffset = (tower.foamAngleOffset || 0) + 0.5; 
            }
        }

        // --- BLOON TRAP LOGIC ---
        if (tower.stats.trapRbe > 0) {
            if (!tower.trapCooldown) tower.trapCooldown = tower.stats.trapCooldown || 12;
            if (!tower.activeTrap) {
                tower.trapCooldown -= dt;
                if (tower.trapCooldown <= 0) {
                    let point = GameEngine.map.getNearestPathPoint(tower.x, tower.y);
                    tower.activeTrap = { x: point.x, y: point.y, rbe: 0, maxRbe: tower.stats.trapRbe, moab: tower.stats.trapMoab || false, radius: tower.stats.trapRadius || 10 };
                    tower.trapCooldown = tower.stats.trapCooldown || 12;
                }
            } else {
                const trap = tower.activeTrap; 
                const nearby = GameEngine.enemyGrid.query(trap.x, trap.y, trap.radius, _sentryTrapScratch);
                for (let e of nearby) {
                    if (!e.alive || e.isCamo) continue; 
                    if (Utils.withinRange(trap.x, trap.y, e.x, e.y, trap.radius + e.data.radius)) {
                        if (!e.data.isMoab || trap.moab) { 
                            if (trap.rbe + e.data.rbe <= trap.maxRbe) { 
                                trap.rbe += e.data.rbe; e.alive = false; GameEngine.spawnPopEffect(e.x, e.y, e.data.color); 
                            } else { 
                                trap.rbe = trap.maxRbe; 
                            } 
                        }
                    }
                }
                if (trap.rbe >= trap.maxRbe) {
                    GameEngine.addCash(trap.rbe); 
                    tower.activeTrap = null;
                }
            }
        }
    },
    draw(ctx, tower, isPreview) {
        if (tower.activeTrap) { 
            let trap = tower.activeTrap; 
            ctx.fillStyle = trap.rbe >= trap.maxRbe ? '#e74c3c' : '#e67e22'; 
            ctx.fillRect(trap.x - 12 * GS, trap.y - 12 * GS, 24 * GS, 24 * GS); 
            ctx.fillStyle = '#000'; ctx.font = `${10 * GS}px Arial`; ctx.textAlign = 'center'; 
            ctx.fillText(`${trap.rbe}/${trap.maxRbe}`, trap.x, trap.y + 3 * GS); 
        }
        tower.drawBaseTower(ctx, isPreview);
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        let p = GameEngine.projectilePool.get();
        p.init(tower.x, tower.y, damage, target, 'nail', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, effects, 0, tower, dmgType);
    },
    ability(tower, engine) {
        let target = null; let maxCost = 0; 
        let effRange = Utils.getEffectiveRange(tower, engine) * 3.0; 
        for (let ot of engine.towers) { 
            if (ot === tower || ot.type === 'farm' || ot.type === 'village' || ot.isMinion) continue; 
            if (Utils.withinRange(tower.x, tower.y, ot.x, ot.y, effRange)) { 
                if (ot.totalSpent > maxCost) { maxCost = ot.totalSpent; target = ot; } 
            } 
        }
        if (target) {
            if ((tower.overclockUsesThisRound || 0) >= 10) {
                engine.log("Overclock used up this round!");
                return;
            }
            tower.overclockUsesThisRound = (tower.overclockUsesThisRound || 0) + 1;
            // BTD6: duration depends on the target's highest upgrade tier
            // (60s for tier 3 and below, 45s for tier 4, 30s for tier 5).
            if (tower.upgrades[1] === 5) {
                target.overclockTimer = 60; // Ultraboost temporary buff lasts 60s
            } else {
                const topTier = Math.max(ot.upgrades[0], ot.upgrades[1], ot.upgrades[2]);
                target.overclockTimer = topTier >= 5 ? 30 : topTier === 4 ? 45 : 60;
            }
            if (tower.upgrades[1] === 5) {
                target.ultraboostStacks = Math.min(10, (target.ultraboostStacks || 0) + 1);
                engine.log("Ultraboost Activated on " + target.stats.name + "!");
            } else {
                engine.log("Overclock Activated on " + target.stats.name + "!");
            }
        }
        else { engine.log("No valid towers in range for Overclock!"); }
    }
};
