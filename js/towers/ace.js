// js/towers/ace.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants.js';

export default {
    stats: { 
        name: "Monkey Ace", cost: 800, range: 22, fireRate: 1.68, 
        damage: 1, pierce: 5, projectileSpeed: 300, 
        lifespan: 4.0, desc: "Flies above the ground shooting volleys of high-pierce darts.", 
        // ... rest of stats
        dmgType: 'sharp', projectileType: 'dart', hitRadius: 12, 
        projectileCount: 8, category: 'Military' 
    },
    upgrades: {
        1: [
            {name:"Rapid Fire", cost:450, desc:"Shoots faster than normal.", extraMods:{cooldownMult: 0.7}},
            {name:"Lots More Darts", cost:550, stat:"projectileCount", amount:4, desc:"Shoots 12 darts at a time."},
            {name:"Fighter Plane", cost:1000, stat:"moabDmg", amount:5, desc:"Flies fast and launches anti-MOAB missiles.", extraMods:{missileCd: 1.5, missileDmg: 3}},
            {name:"Operation: Dart Storm", cost:3300, stat:"projectileCount", amount:4, desc:"Shoots 16 darts per volley, and twice as fast.", extraMods:{cooldownMult: 0.5}},
            {name:"Sky Shredder", cost:42500, stat:"damage", amount:4, desc:"The Bloons will wish they had never come.", extraMods:{pierce: 5, cooldownMult: 0.5, missileDmg: 10}}
        ],
        2: [
            {name:"Exploding Pineapple", cost:200, desc:"Drops pineapples to the ground that explode violently after a few seconds.", extraMods:{pineappleCd: 3.0, pineappleDmg: 1}},
            {name:"Spy Plane", cost:350, stat:"canSeeCamo", amount:true, desc:"Allows Monkey Ace to hit Camo Bloons and do more damage to them.", extraMods:{camoDmg: 1}},
            {name:"Bomber Ace", cost:900, desc:"Drops a line of bombs when crossing the Bloon track.", extraMods:{bomberCd: 1.0, bomberDmg: 2}},
            {name:"Ground Zero", cost:16000, stat:"damage", amount:2, desc:"Bomb damage increased. Ground Zero Ability: Drops a huge bomb.", extraMods:{isAbility: true, abilityName: "Ground Zero", abilityCd: 45, pineappleDmg: 5, bomberDmg: 5}},
            {name:"Tsar Bomba", cost:26000, stat:"damage", amount:8, desc:"A very, very large bomb. Someone put a stop to this craziness!", extraMods:{isAbility: true, abilityName: "Ground Zero", abilityCd: 45, pineappleDmg: 10, bomberDmg: 10}}
        ],
        3: [
            {name:"Sharper Darts", cost:500, stat:"pierce", amount:3, desc:"Darts can pop 8 Bloons each."},
            {name:"Centered Path", cost:550, desc:"New central flight path for maximum map coverage.", extraMods:{aceRadius: 200}},
            {name:"Neva-Miss Targeting", cost:2550, desc:"Darts automatically seek out and pop Bloons by themselves.", extraMods:{homing: true}},
            {name:"Spectre", cost:23400, desc:"Rapidly fires darts and bombs, dominating most Bloon types easily.", extraMods:{isSpectre: true, cooldownMult: 0.1, projectileCount: 1, pierce: 1}},
            {name:"Flying Fortress", cost:90000, stat:"damage", amount:4, desc:"This is a BIG plane.", extraMods:{projectileCount: 3, pierce: 10}}
        ]
    },

    update(tower, dt, engine) {
        // 1. Flight Path (Circle around base)
        if (tower.aceAngle === undefined) {
            tower.aceAngle = 0;
            tower.baseX = tower.x;
            tower.baseY = tower.y;
        }
        
        let aceRadius = tower.stats.aceRadius || 80;
        let aceSpeed = 1.5; // Base rotation speed
        tower.aceAngle += aceSpeed * dt;
        
        tower.x = tower.baseX + Math.cos(tower.aceAngle) * aceRadius;
        tower.y = tower.baseY + Math.sin(tower.aceAngle) * aceRadius;
        
        // Keep on screen
        tower.x = Math.max(10, Math.min(CANVAS_WIDTH - 10, tower.x));
        tower.y = Math.max(10, Math.min(CANVAS_HEIGHT - 10, tower.y));
        
        // Plane angle for sprite rotation
        tower.angle = tower.aceAngle + Math.PI / 2;

        // 2. Exploding Pineapple Drop (Path 2 T1+)
        if (tower.stats.pineappleCd) {
            tower.pineappleTimer = (tower.pineappleTimer || 0) - dt;
            if (tower.pineappleTimer <= 0) {
                tower.pineappleTimer = tower.stats.pineappleCd;
                let p = engine.projectilePool.get();
                p.init(tower.x, tower.y, tower.stats.pineappleDmg, null, 'bomb', 100, 1, 1.5, null, {isExplosive: true, explosionRadius: 40, explosionDamage: tower.stats.pineappleDmg, canHitLead: true}, 0, tower, {isExplosion: true, canHitLead: true});
            }
        }

        // 3. Bomber Ace Track Bombs (Path 2 T3+)
        if (tower.stats.bomberCd) {
            tower.bomberTimer = (tower.bomberTimer || 0) - dt;
            if (tower.bomberTimer <= 0) {
                tower.bomberTimer = tower.stats.bomberCd;
                // Drop bomb straight down
                let p = engine.projectilePool.get();
                p.init(tower.x, tower.y, tower.stats.bomberDmg, null, 'bomb', 200, 20, 1.0, Math.PI / 2, {isExplosive: true, explosionRadius: 30, explosionDamage: tower.stats.bomberDmg, canHitLead: true}, 0, tower, {isExplosion: true, canHitLead: true});
            }
        }

        // 4. Fighter Plane Missiles (Path 1 T3+)
        if (tower.stats.missileCd) {
            tower.missileTimer = (tower.missileTimer || 0) - dt;
            if (tower.missileTimer <= 0) {
                tower.missileTimer = tower.stats.missileCd;
                let target = null, bestVal = -Infinity;
                for (const e of engine.enemies) {
                    if (!e || !e.alive || !e.data.isMoab) continue;
                    if (e.data.rbe > bestVal) { bestVal = e.data.rbe; target = e; }
                }
                if (target) {
                    let p = engine.projectilePool.get();
                    // FIX: Added moabDmg to the dmgType object
                    p.init(tower.x, tower.y, tower.stats.missileDmg, target, 'bomb', 600, 5, 2.0, null, {isExplosive: true, explosionRadius: 40, explosionDamage: tower.stats.missileDmg, canHitLead: true}, 0, tower, {isExplosion: true, canHitLead: true, moabDmg: tower.stats.moabDmg || 0});
                }
            }
        }
    },

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        let pEffects = { ...effects };
        if (tower.stats.homing) pEffects.homing = true;
        if (tower.stats.camoDmg) pEffects.camoDmg = tower.stats.camoDmg;

        // Spectre (Path 3 T4): Fires 1 dart and 1 bomb directly at the target
        if (tower.stats.isSpectre) {
            let pDart = engine.projectilePool.get();
            pDart.init(tower.x, tower.y, damage, target, 'dart', 800, 5, 1.0, null, pEffects, 0, tower, dmgType, isCrit);
            
            let pBomb = engine.projectilePool.get();
            pBomb.init(tower.x, tower.y, 2, target, 'bomb', 800, 15, 1.0, null, {isExplosive: true, explosionRadius: 30, explosionDamage: 2, canHitLead: true}, 0, tower, {isExplosion: true, canHitLead: true});
            return;
        }

        // Standard Volley: 360 degree spread
        let count = tower.stats.projectileCount || 8;
        let spread = 360 / count;
        
        for (let i = 0; i < count; i++) {
            let angle = (i * spread) * (Math.PI / 180); // Convert to radians
            let p = engine.projectilePool.get();
            // Angle is absolute, not relative to target
            p.init(tower.x, tower.y, damage, null, 'dart', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, angle, pEffects, 0, tower, dmgType, isCrit);
        }
    },

    ability(tower, engine) {
        if (tower.stats.abilityName === "Ground Zero") {
            engine.log("Ground Zero!");
            let dmg = tower.upgrades[1] >= 5 ? 3500 : 700; // Tsar Bomba does 3500
            Utils.applyAoeDamage(engine, tower.x, tower.y, 1500, dmg, {isExplosion: true, canHitLead: true}, tower, {}, {maxHits: 1000});
            engine.explosions.push({ x: tower.x, y: tower.y, radius: 0, maxRadius: 1500, life: 1.5, maxLife: 1.5, color: '#ffffff' });
        }
    }
};