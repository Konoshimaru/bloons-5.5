// sub.js
// Defines the Sub tower and its underwater attacks.

import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

const _subScratchA = [];
const _subScratchB = [];

export default {
    stats: { 
        name: "Monkey Sub", cost: 325, range: 42, fireRate: 0.75, damage: 1, pierce: 2, 
        projectileSpeed: 600, 
        projectileCount: 1,
        lifespan: 1.5, desc: "Shoots homing darts. Must be placed in water.", 
        dmgType: 'sharp', projectileType: 'dart', hitRadius: 12, 
        waterOnly: true, category: 'Military' 
    },
    upgrades: {
        1: [
            {name:"Longer Range", cost:130, stat:"range", amount:10, desc:"Increases attack range."},
            {name:"Advanced Intel", cost:500, stat:"range", amount:40, desc:"Allows long range targeting of Bloons in radius of your other towers."},
            {name:"Submerge and Support", cost:700, desc:"Adds Submerge targeting option that permanently reveals Camo Bloons in its radius.", extraMods:{isAbility: true, abilityName: "Submerge", abilityCd: 1}},
            {name:"Bloontonium Reactor", cost:2400, desc:"Submerge to detect Camo, pop Bloons and reduce ability cooldowns of nearby water-based Monkeys by 15%.", extraMods:{isAbility: true, abilityName: "Submerge", abilityCd: 1}},
            {name:"Energizer", cost:28000, stat:"range", amount:10, desc:"Reduces ability cooldowns everywhere by 20% and by 40% for Water based Monkeys. While in radius, Heroes earn XP 50% faster.", extraMods:{isAbility: true, abilityName: "Submerge", abilityCd: 1}}
        ],
        2: [
            {name:"Barbed Darts", cost:450, stat:"pierce", amount:3, desc:"Sub's darts can pop an additional 3 Bloons."},
            {name:"Heat-tipped Darts", cost:300, stat:"dmgType", amount:'shatter', desc:"Heat tipped darts allow the Monkey Sub to pop Frozen and Lead Bloons."},
            {name:"Ballistic Missile", cost:1350, desc:"Fires missiles at targets within range. Missiles fly over walls and deal extra damage to MOABs and Ceramics."},
            {name:"First Strike Capability", cost:13000, desc:"First Strike Ability: A devastating missile strike targeting the largest Bloon on screen, plus splash damage.", extraMods:{isAbility: true, abilityName: "First Strike", abilityCd: 40}},
            {name:"Pre-emptive Strike", cost:29000, desc:"Automatically triggers a powerful missile attack whenever MOAB-Class Bloon spawns from the Bloon entrance."}
        ],
        3: [
            {name:"Twin Guns", cost:450, stat:"projectileCount", amount:1, desc:"Added twin gun doubles attack speed."},
            {name:"Airburst Darts", cost:1000, stat:"pierce", amount:3, desc:"Airburst darts split into 3 on impact for massive popping power."},
            {name:"Triple Guns", cost:1100, stat:"projectileCount", amount:1, desc:"Adds a third gun for even faster firing."},
            {name:"Armor Piercing Darts", cost:2500, stat:"damage", amount:1, desc:"Special AP darts gain increased damage and popping power, plus additional damage to Fortified and MOAB class Bloons.", extraMods:{moabDmg: 2, fortifiedDmg: 2}},
            {name:"Sub Commander", cost:25000, stat:"damage", amount:2, desc:"Adds extra pierce and damage to Commander and all Subs in its radius.", extraMods:{pierce: 5}}
        ]
    },
    
    update(tower, dt, engine) {
        // 1. Submerge Logic (Path 1 T3+)
        if (tower.upgrades[0] >= 3 && tower.isSubmerged) {
            const effRange = Utils.getEffectiveRange(tower, engine);
            
            // T3: Reveal Camo (Grant buffedCamo to nearby towers)
            for (const t of engine.towers) {
                if (t && Utils.distanceSq(tower.x, tower.y, t.x, t.y) < effRange * effRange) {
                    t.buffedCamo = true;
                    t.addBuff('sub_reveal', 'Reveal Camo', 0.5, 1, { type: 'sub_reveal' }, false);
                }
            }
            
            // T4: Pop Bloons in radius & reduce water cooldowns
            if (tower.upgrades[0] >= 4) {
                const nearby = engine.enemyGrid.query(tower.x, tower.y, effRange, _subScratchA);
                for (const e of nearby) {
                    if (e.alive && Utils.withinRange(tower.x, tower.y, e.x, e.y, effRange)) {
                        e.takeDamage(1 * dt, {isSharp: true, canHitLead: true}, {}, tower);
                    }
                }
                for (const t of engine.towers) {
                    if (t && t.stats.waterOnly && Utils.distanceSq(tower.x, tower.y, t.x, t.y) < effRange * effRange) {
                        t.abilityCdMult = Math.min(t.abilityCdMult || 1.0, 0.85);
                    }
                }
            }
            
            // T5: Energizer (Global cooldown reduction, Water 40%, Hero XP +50%)
            if (tower.upgrades[0] >= 5) {
                for (const t of engine.towers) {
                    if (!t) continue;
                    if (t.stats.waterOnly) {
                        t.abilityCdMult = Math.min(t.abilityCdMult || 1.0, 0.60);
                    } else {
                        t.abilityCdMult = Math.min(t.abilityCdMult || 1.0, 0.80);
                    }
                }
                if (engine.hero) engine.hero.heroXpMult = Math.max(engine.hero.heroXpMult || 1.0, 1.5);
            }
            
            // Prevent firing standard darts while submerged
            tower.cooldown = 999;
        }

        // 2. Ballistic Missile Auto-Fire (Path 2 T3+)
        if (tower.upgrades[1] >= 3 && !tower.isSubmerged) {
            tower.missileCooldown = (tower.missileCooldown || 0) - dt;
            if (tower.missileCooldown <= 0) {
                let target = null;
                let bestVal = -Infinity;
                const nearby = engine.enemyGrid.query(tower.x, tower.y, Utils.getEffectiveRange(tower, engine), _subScratchB);
                for (const e of nearby) {
                    if (!e || !e.alive) continue;
                    if (e.data.isMoab || e.data.isCeramic) {
                        if (e.data.rbe > bestVal) {
                            bestVal = e.data.rbe;
                            target = e;
                        }
                    }
                }
                if (target) {
                    tower.missileCooldown = 2.0;
                    let p = engine.projectilePool.get();
                    p.init(tower.x, tower.y, 2, target, 'bomb', 500, 20, 3.0, null, {isExplosive: true, explosionRadius: 30, explosionDamage: 2, canHitLead: true}, 0, tower, {isExplosion: true, canHitLead: true});
                }
            }
        }

        // 3. Pre-emptive Strike (Path 2 T5)
        if (tower.upgrades[1] >= 5) {
            let spawnTarget = null;
            for (const e of engine.enemies) {
                if (e && e.alive && e.data.isMoab && e.distanceTraveled < 50) {
                    spawnTarget = e;
                    break;
                }
            }
            if (spawnTarget && (tower.preemptiveCd === undefined || tower.preemptiveCd <= 0)) {
                tower.preemptiveCd = 1.0; // 1 second internal cooldown to prevent spamming one spawn
                let p = engine.projectilePool.get();
                p.init(tower.x, tower.y, 10, spawnTarget, 'bomb', 800, 50, 5.0, null, {isExplosive: true, explosionRadius: 60, explosionDamage: 10, canHitLead: true}, 0, tower, {isExplosion: true, canHitLead: true});
            }
            if (tower.preemptiveCd > 0) tower.preemptiveCd -= dt;
        }

        // 4. Sub Commander Buff (Path 3 T5)
        if (tower.upgrades[2] >= 5) {
            const effRange = Utils.getEffectiveRange(tower, engine);
            for (const t of engine.towers) {
                if (t && t.type === 'sub' && t !== tower && Utils.distanceSq(tower.x, tower.y, t.x, t.y) < effRange * effRange) {
                    t.addBuff('sub_commander', 'Sub Commander', 0.5, 1, { type: 'sub_commander' }, false);
                    t.buffedDmg = Math.max(t.buffedDmg || 0, 2);
                    t.buffedPierce = Math.max(t.buffedPierce || 0, 5);
                }
            }
        }
    },
    
    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        // Don't fire standard darts if submerged
        if (tower.isSubmerged) return;
        
        let count = tower.stats.projectileCount || 1;
        let spreadAngle = count > 1 ? 10 : 0;
        for (let i = 0; i < count; i++) {
            let offset = count > 1 ? (spreadAngle * (i - (count - 1) / 2)) : 0;
            let p = engine.projectilePool.get();
            // Darts have seeking enabled via projectile.js if effects.homing is true. 
            // We'll just use the standard dart type; the engine's _updateSeeking will handle the homing if we pass it.
            // Wait, the standard dart doesn't seek unless it's a ninja. Let's make it seek manually by passing a homing effect.
            p.init(tower.x, tower.y, damage, target, tower.stats.projectileType, tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, {homing: true}, offset, tower, dmgType, isCrit);
        }
    },
    
    ability(tower, engine) {
        // Submerge Toggle
        if (tower.stats.abilityName === "Submerge") {
            tower.isSubmerged = !tower.isSubmerged;
            if (tower.isSubmerged) {
                engine.log("Submerging...");
            } else {
                engine.log("Surfacing...");
                tower.cooldown = 0; // Reset attack cooldown immediately on surfacing
            }
            tower.abilityCooldown = 1.0; // Short cooldown so you can't spam it, but can toggle easily
        }
        
        // First Strike Capability
        if (tower.stats.abilityName === "First Strike") {
            engine.log("First Strike!");
            let target = null;
            let maxHp = 0;
            for (const e of engine.enemies) {
                if (!e || !e.alive) continue;
                if (e.hp > maxHp) {
                    maxHp = e.hp;
                    target = e;
                }
            }
            if (target) {
                // Fire a massive, fast missile that deals 1000 direct damage + 500 splash
                let p = engine.projectilePool.get();
                p.init(tower.x, tower.y, 1000, target, 'bomb', 1000, 100, 5.0, null, {isExplosive: true, explosionRadius: 100, explosionDamage: 500, canHitLead: true}, 0, tower, {isExplosion: true, canHitLead: true});
            }
        }
    }
};
