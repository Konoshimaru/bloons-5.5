// js/towers/heli.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants.js';

export default {
    stats: { 
        name: "Heli Pilot", cost: 1500, range: 42, fireRate: 0.57, 
        damage: 1, pierce: 3, projectileSpeed: 500, 
        lifespan: 1.0, desc: "Hovers wherever you direct it. Shoots from twin heavy dart guns.", 
        dmgType: 'sharp', projectileType: 'dart', hitRadius: 12, 
        projectileCount: 2, category: 'Military' 
    },
    upgrades: {
        1: [
            {name:"Quad Darts", cost:800, stat:"projectileCount", amount:2, desc:"Shoots 4 darts per volley instead of 2."},
            {name:"Pursuit", cost:500, desc:"A new targeting option enables Heli to seek and pursue the Bloons automatically.", extraMods:{pursuit: true}},
            {name:"Razor Rotors", cost:1850, desc:"Razor Rotor blades rip up Bloons on contact, including Lead and Frozen.", extraMods:{rotorDmg: 3, rotorRadius: 30}},
            {name:"Apache Dartship", cost:19600, stat:"damage", amount:1, desc:"Adds a large missile array and powerful machine guns.", extraMods:{missileCd: 0.5, missileDmg: 2, cooldownMult: 0.6}},
            {name:"Apache Prime", cost:45000, stat:"damage", amount:5, desc:"The Apache Prime leaves most Bloons wishing they'd never been inflated.", extraMods:{missileDmg: 10, moabDmg: 10, pierce: 5}}
        ],
        2: [
            {name:"Bigger Jets", cost:300, desc:"Powerful jets make Heli move much faster.", extraMods:{heliSpeedMult: 1.5}},
            {name:"IFR", cost:600, stat:"canSeeCamo", amount:true, desc:"Allows Heli Pilot to detect and shoot Camo Bloons."},
            {name:"Downdraft", cost:3500, desc:"Blows Bloons away from the Heli, back toward the entrance.", extraMods:{downdraft: 60}},
            {name:"Support Chinook", cost:9500, desc:"Blows back many more Bloons and gains abilities: Drops lives and cash crates.", extraMods:{isAbility: true, abilityName: "Supply Drop", abilityCd: 40, downdraft: 100}},
            {name:"Special Poperations", cost:30000, stat:"damage", amount:2, desc:"Deploys a powerful special Monkey Marine with a machine gun.", extraMods:{isAbility: true, abilityName: "Supply Drop", abilityCd: 30}}
        ],
        3: [
            {name:"Faster Darts", cost:250, stat:"projectileSpeed", amount:200, desc:"Darts are propelled much faster through the air."},
            {name:"Faster Firing", cost:350, desc:"Faster attack speed for all Heli attacks.", extraMods:{cooldownMult: 0.75}},
            {name:"MOAB Shove", cost:3400, desc:"Can collide with and shove MOAB-class Bloons, reversing or slowing their movement.", extraMods:{moabShove: 40}},
            {name:"Comanche Defense", cost:8500, stat:"damage", amount:1, desc:"Automatically calls in mini Comanches when they're most needed.", extraMods:{comancheCd: 5.0}},
            {name:"Comanche Commander", cost:35000, stat:"damage", amount:4, desc:"Upgraded weapons. Also automatically calls in 3 more Comanches. Permanently.", extraMods:{comanchePerm: true, missileDmg: 2, cooldownMult: 0.5}}
        ]
    },

    update(tower, dt, engine) {
        // 1. Movement: Fly towards mouse cursor
        let targetX = engine.mouse.x;
        let targetY = engine.mouse.y;
        
        // Pursuit Mode (Path 1 T2): Fly towards the strongest bloon instead
        if (tower.stats.pursuit) {
            let bestTarget = null;
            let bestVal = -Infinity;
            for (const e of engine.enemies) {
                if (!e || !e.alive) continue;
                if (e.data.rbe > bestVal) {
                    bestVal = e.data.rbe;
                    bestTarget = e;
                }
            }
            if (bestTarget) {
                targetX = bestTarget.x;
                targetY = bestTarget.y;
            }
        }

        let dx = targetX - tower.x;
        let dy = targetY - tower.y;
        let dist = Math.hypot(dx, dy);
        
        if (dist > 10) {
            let speed = 150 * dt; // Base movement speed
            if (tower.stats.heliSpeedMult) speed *= tower.stats.heliSpeedMult;
            
            tower.x += (dx / dist) * speed;
            tower.y += (dy / dist) * speed;
            
            // Clamp to screen
            tower.x = Math.max(10, Math.min(CANVAS_WIDTH - 10, tower.x));
            tower.y = Math.max(10, Math.min(CANVAS_HEIGHT - 10, tower.y));
        }
        tower.angle = Utils.angle(tower.x, tower.y, targetX, targetY) + Math.PI / 2; // Adjust angle for sprite orientation

        // 2. Razor Rotors (Path 1 T3+)
        if (tower.stats.rotorDmg) {
            const nearby = engine.enemyGrid.query(tower.x, tower.y, tower.stats.rotorRadius);
            for (const e of nearby) {
                if (e && e.alive && Utils.withinRange(tower.x, tower.y, e.x, e.y, tower.stats.rotorRadius)) {
                    e.takeDamage(tower.stats.rotorDmg * dt * 2, {isSharp: true, canHitLead: true}, {}, tower);
                }
            }
        }

        // 3. Downdraft (Path 2 T3+)
        if (tower.stats.downdraft) {
            const nearby = engine.enemyGrid.query(tower.x, tower.y, tower.stats.downdraft);
            for (const e of nearby) {
                if (e && e.alive && Utils.withinRange(tower.x, tower.y, e.x, e.y, tower.stats.downdraft)) {
                    e.distanceTraveled = Math.max(0, e.distanceTraveled - 100 * dt);
                }
            }
        }

        // 4. MOAB Shove (Path 3 T3+)
        if (tower.stats.moabShove) {
            const nearby = engine.enemyGrid.query(tower.x, tower.y, tower.stats.moabShove);
            for (const e of nearby) {
                if (e && e.alive && e.data.isMoab && Utils.withinRange(tower.x, tower.y, e.x, e.y, tower.stats.moabShove)) {
                    e.distanceTraveled = Math.max(0, e.distanceTraveled - 50 * dt);
                }
            }
        }

        // 5. Apache Missiles (Path 1 T4+)
        if (tower.stats.missileCd) {
            tower.missileTimer = (tower.missileTimer || 0) - dt;
            if (tower.missileTimer <= 0) {
                tower.missileTimer = tower.stats.missileCd;
                if (engine.enemies.length > 0) {
                    let target = engine.enemies[Math.floor(Math.random() * engine.enemies.length)];
                    if (target && target.alive) {
                        let p = engine.projectilePool.get();
                        p.init(tower.x, tower.y, tower.stats.missileDmg, target, 'bomb', 600, 20, 2.0, null, {isExplosive: true, explosionRadius: 30, explosionDamage: tower.stats.missileDmg, canHitLead: true}, 0, tower, {isExplosion: true, canHitLead: true});
                    }
                }
            }
        }

        // 6. Comanche Defense / Commander (Path 3 T4+)
        if (tower.stats.comanchePerm) {
            // Permanent Comanches: just fire extra missiles constantly
            tower.comancheTimer = (tower.comancheTimer || 0) - dt;
            if (tower.comancheTimer <= 0) {
                tower.comancheTimer = 0.2;
                if (engine.enemies.length > 0) {
                    let target = engine.enemies[Math.floor(Math.random() * engine.enemies.length)];
                    if (target && target.alive) {
                        let p = engine.projectilePool.get();
                        p.init(tower.x - 30, tower.y, 2, target, 'dart', 700, 5, 1.0, null, {}, 0, tower, {isSharp: true});
                        let p2 = engine.projectilePool.get();
                        p2.init(tower.x + 30, tower.y, 2, target, 'dart', 700, 5, 1.0, null, {}, 0, tower, {isSharp: true});
                    }
                }
            }
        } else if (tower.stats.comancheCd) {
            // Temporary Comanche Defense
            let moabCount = 0;
            for (const e of engine.enemies) { if (e && e.alive && e.data.isMoab) moabCount++; }
            
            if (moabCount > 0) {
                tower.comancheTimer = (tower.comancheTimer || 0) - dt;
                if (tower.comancheTimer <= 0) {
                    tower.comancheTimer = tower.stats.comancheCd;
                    // Spawn a burst of mini-heli darts
                    for (let i=0; i<10; i++) {
                        if (engine.enemies.length > 0) {
                            let target = engine.enemies[Math.floor(Math.random() * engine.enemies.length)];
                            if (target && target.alive) {
                                let p = engine.projectilePool.get();
                                p.init(tower.x, tower.y, 1, target, 'dart', 800, 3, 1.0, null, {}, 0, tower, {isSharp: true});
                            }
                        }
                    }
                }
            }
        }
    },

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        let count = tower.stats.projectileCount || 2;
        let spreadAngle = count > 1 ? 10 : 0;
        for (let i = 0; i < count; i++) {
            let offset = count > 1 ? (spreadAngle * (i - (count - 1) / 2)) : 0;
            let p = engine.projectilePool.get();
            p.init(tower.x, tower.y, damage, target, tower.stats.projectileType, tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, effects, offset, tower, dmgType, isCrit);
        }
    },

    ability(tower, engine) {
        if (tower.stats.abilityName === "Supply Drop") {
            engine.log("Supply Drop!");
            // Drop cash and lives
            engine.addCash(1500);
            engine.lives += 10;
            // Visual crate effect
            engine.spawnPopEffect(tower.x, tower.y - 50, '#f1c40f');
        }
    }
};