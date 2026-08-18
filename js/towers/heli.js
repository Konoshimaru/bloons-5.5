// js/towers/heli.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants.js';
import { Sentry } from '../sentryEntity.js';

const _heliBladesScratch = [];
const _heliDowndraftScratch = [];
const _heliShoveScratch = [];

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
            {name:"Apache Dartship", cost:19600, desc:"Adds a large missile array and powerful machine guns.", extraMods:{missileCd: 1.0, missileDmg: 2, cooldownMult: 0.75}},
            {name:"Apache Prime", cost:45000, stat:"damage", amount:1, desc:"The Apache Prime leaves most Bloons wishing they'd never been inflated.", extraMods:{missileDmg: 2, moabDmg: 15, pierce: 5}}
        ],
        2: [
            {name:"Bigger Jets", cost:300, desc:"Powerful jets make Heli move much faster.", extraMods:{heliSpeedMult: 1.5}},
            {name:"IFR", cost:600, stat:"canSeeCamo", amount:true, desc:"Allows Heli Pilot to detect and shoot Camo Bloons."},
            {name:"Downdraft", cost:3500, desc:"Blows Bloons away from the Heli, back toward the entrance.", extraMods:{downdraft: 60}},
            {name:"Support Chinook", cost:9500, desc:"Blows back many more Bloons and gains abilities: Drops lives and cash crates.", extraMods:{isAbility: true, abilityName: "Supply Drop", abilityCd: 90, downdraft: 100}},
            {name:"Special Poperations", cost:30000, stat:"damage", amount:1, desc:"Deploys a powerful special Monkey Marine with a machine gun.", extraMods:{isAbility: true, abilityName: "Deploy Marine", abilityCd: 25}}
        ],
        3: [
            {name:"Faster Darts", cost:250, stat:"projectileSpeed", amount:200, desc:"Darts are propelled much faster through the air."},
            {name:"Faster Firing", cost:350, desc:"Faster attack speed for all Heli attacks.", extraMods:{cooldownMult: 0.75}},
            {name:"MOAB Shove", cost:3400, desc:"Can collide with and shove MOAB-class Bloons, reversing or slowing their movement.", extraMods:{moabShove: 40}},
            {name:"Comanche Defense", cost:8500, stat:"damage", amount:1, desc:"Automatically calls in mini Comanches when they're most needed.", extraMods:{comancheCd: 5.0}},
            {name:"Comanche Commander", cost:35000, stat:"damage", amount:1, desc:"Upgraded weapons. Also automatically calls in 3 more Comanches. Permanently.", extraMods:{comanchePerm: true, missileDmg: 2, cooldownMult: 0.5}}
        ]
    },

    update(tower, dt, engine) {
        // 1. Movement: Fly towards mouse cursor
        let targetX = engine.mouse.x;
        let targetY = engine.mouse.y;
        
        // Pursuit Mode (Path 1 T2): Fly towards the strongest bloon instead.
        // Strongest-bloon scan is global so the grid can't help, but it doesn't
        // need to run every frame — refresh the fly-to point ~3x/sec.
        if (tower.stats.pursuit) {
            tower._pursuitTimer = (tower._pursuitTimer || 0) - dt;
            if (tower._pursuitTimer <= 0) {
                tower._pursuitTimer = 0.3;
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
                    tower._pursuitX = bestTarget.x;
                    tower._pursuitY = bestTarget.y;
                } else {
                    tower._pursuitX = undefined;
                }
            }
            if (tower._pursuitX !== undefined) {
                targetX = tower._pursuitX;
                targetY = tower._pursuitY;
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
            const nearby = engine.enemyGrid.query(tower.x, tower.y, tower.stats.rotorRadius, _heliBladesScratch);
            for (const e of nearby) {
                if (e && e.alive && Utils.withinRange(tower.x, tower.y, e.x, e.y, tower.stats.rotorRadius)) {
                    e.takeDamage(tower.stats.rotorDmg * dt * 2, {isSharp: true, canHitLead: true}, {}, tower);
                }
            }
        }

        // 3. Downdraft (Path 2 T3+)
        if (tower.stats.downdraft) {
            const nearby = engine.enemyGrid.query(tower.x, tower.y, tower.stats.downdraft, _heliDowndraftScratch);
            for (const e of nearby) {
                if (e && e.alive && Utils.withinRange(tower.x, tower.y, e.x, e.y, tower.stats.downdraft)) {
                    e.distanceTraveled = Math.max(0, e.distanceTraveled - 100 * dt);
                }
            }
        }

        // 4. MOAB Shove (Path 3 T3+)
        if (tower.stats.moabShove) {
            const nearby = engine.enemyGrid.query(tower.x, tower.y, tower.stats.moabShove, _heliShoveScratch);
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
                        p.init(tower.x, tower.y, tower.stats.missileDmg, target, 'bomb', 600, 40, 2.0, null, {isExplosive: true, explosionRadius: 30, explosionDamage: tower.stats.missileDmg, canHitLead: true}, 0, tower, {isExplosion: true, canHitLead: true, moabDmg: tower.stats.moabDmg || 0});
                    }
                }
            }
        }

        // 6. Apache Machine Gun (Path 1 T4+)
        if (tower.upgrades[0] >= 4) {
            tower._apacheMgTimer = (tower._apacheMgTimer || 0) - dt;
            if (tower._apacheMgTimer <= 0) {
                tower._apacheMgTimer = 0.05; // ~20 shots/sec like the real Apache
                let target = null, bestDistSq = Infinity;
                const mgRange = Utils.getEffectiveRange(tower, engine) + 40;
                const nearby = engine.enemyGrid.query(tower.x, tower.y, mgRange, _heliBladesScratch);
                for (const e of nearby) {
                    if (!e || !e.alive) continue;
                    const dsq = Utils.distanceSq(tower.x, tower.y, e.x, e.y);
                    if (dsq < bestDistSq) { bestDistSq = dsq; target = e; }
                }
                if (target) {
                    const mgDmg = tower.upgrades[0] >= 5 ? 5 : 1;
                    const mgPierce = tower.upgrades[0] >= 5 ? 11 : 7;
                    let p = engine.projectilePool.get();
                    p.init(tower.x, tower.y, mgDmg, target, 'dart', 1000, mgPierce, 0.35, null, {}, 0, tower, { isSharp: true, canHitLead: true });
                }
            }
        }

        // 7. Comanche Defense / Commander (Path 3 T4+)
        if (tower.stats.comanchePerm || tower.stats.comancheCd) {
            // Mini-Comanche slots: 3 permanent for Commander, 2 temporary for
            // Defense while MOABs are on screen. Each orbits the Heli and fires darts.
            if (!tower._comanches) tower._comanches = [];
            let want = tower.stats.comanchePerm ? 3 : 0;
            if (!tower.stats.comanchePerm && tower.stats.comancheCd) {
                tower._comancheCountTimer = (tower._comancheCountTimer || 0) - dt;
                if (tower._comancheCountTimer <= 0) {
                    tower._comancheCountTimer = 0.3;
                    let moabCount = 0;
                    for (const e of engine.enemies) { if (e && e.alive && e.data.isMoab) moabCount++; }
                    tower._comancheMoabCount = moabCount;
                }
                if (tower._comancheMoabCount > 0) want += 2;
            }
            while (tower._comanches.length < want) {
                tower._comanches.push({ angle: Math.random() * Math.PI * 2, fireTimer: Math.random() * 0.5 });
            }
            if (tower._comanches.length > want) tower._comanches.length = want;

            for (const mc of tower._comanches) {
                mc.angle += dt * 2.0;
                const mx = tower.x + Math.cos(mc.angle) * 40;
                const my = tower.y + Math.sin(mc.angle) * 40;
                mc.fireTimer = (mc.fireTimer || 0) - dt;
                if (mc.fireTimer <= 0) {
                    mc.fireTimer = 0.5;
                    let target = null, bestDistSq = Infinity;
                    const nearby = engine.enemyGrid.query(mx, my, 55, _heliDowndraftScratch);
                    for (const e of nearby) {
                        if (!e || !e.alive) continue;
                        const dsq = Utils.distanceSq(mx, my, e.x, e.y);
                        if (dsq < bestDistSq) { bestDistSq = dsq; target = e; }
                    }
                    if (target) {
                        let p = engine.projectilePool.get();
                        p.init(mx, my, 1, target, 'dart', 700, 3, 0.8, null, {}, 0, tower, { isSharp: true });
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

    onSell(tower, engine) {
        if (tower.marine) {
            tower.marine.alive = false;
            const idx = engine.sentries.indexOf(tower.marine);
            if (idx > -1) engine.sentries.splice(idx, 1);
        }
    },

    ability(tower, engine) {
        if (tower.stats.abilityName === "Supply Drop") {
            engine.log("Supply Drop!");
            // Drop cash and lives
            engine.addCash(1500);
            engine.lives += 1;
            // Visual crate effect
            engine.spawnPopEffect(tower.x, tower.y - 50, '#f1c40f');
        }

        if (tower.stats.abilityName === "Deploy Marine") {
            // Despawn any existing marine, then deploy a new one at the cursor
            if (tower.marine && tower.marine.alive) {
                tower.marine.alive = false;
                const idx = engine.sentries.indexOf(tower.marine);
                if (idx > -1) engine.sentries.splice(idx, 1);
            }

            let mx = engine.mouse.x;
            let my = engine.mouse.y;
            if (!engine.map.isOnPath(mx, my) && !engine.map.isOnProp(mx, my) && !engine.map.isInWater(mx, my)) {
                // valid placement at cursor
            } else {
                mx = tower.x;
                my = tower.y;
            }

            const marine = new Sentry(mx, my, {
                name: "Monkey Marine",
                range: 55,
                damage: 6,
                pierce: 20,
                fireRate: 0.05,
                dmgType: 'sharp',
                projCount: 1,
                projSpeed: 700,
                projLifespan: 0.5,
                color: '#27ae60',
                life: 30
            }, tower);

            tower.marine = marine;
            engine.sentries.push(marine);
            engine.log("Monkey Marine deployed!");
            engine.spawnPopEffect(mx, my - 30, '#27ae60');
        }
    }
};
