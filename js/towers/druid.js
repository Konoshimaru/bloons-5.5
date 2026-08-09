// js/towers/druid.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

const _druidAuraScratch = [];
const _druidStormScratch = [];
const _druidFireScratch = [];

export default {
    stats: { 
        name: "Druid", cost: 400, range: 35, fireRate: 1.1, 
        damage: 1, pierce: 1, projectileSpeed: 600, 
        lifespan: 0.4, desc: "Creates a blast of thorns. Upgrades channel Jungle, Storm or Wrath.", 
        dmgType: 'sharp', projectileType: 'thorn', hitRadius: 12, 
        projectileCount: 5, category: 'Magic' 
    },
    upgrades: {
        1: [ // Storm Path
            {name:"Hard Thorns", cost:350, stat:"pierce", amount:1, desc:"Hard thorns can pop 2 Bloons each and pop any Bloon type.", extraMods:{canHitLead: true, canHitFrozen: true}},
            {name:"Heart of Thunder", cost:850, desc:"Unleashes regular blasts of forked lightning.", extraMods:{lightningCd: 2.0, lightningDmg: 3}},
            {name:"Druid of the Storm", cost:1700, desc:"Gusts of wind blow Bloons off the track away from the exit.", extraMods:{tornadoCd: 4.0, knockback: 100}},
            {name:"Ball Lightning", cost:4500, stat:"canSeeCamo", amount:true, desc:"Creates powerful balls of lightning that can freeze Bloons.", extraMods:{lightningDmg: 5, freeze: true, freezeDuration: 1.0}},
            {name:"Monarch of Storms", cost:60000, stat:"damage", amount:5, desc:"Relentless barrage of superstorms. Massive damage and blows them away.", extraMods:{lightningCd: 0.5, lightningDmg: 20, knockback: 200, pierce: 5}}
        ],
        2: [ // Jungle Path
            {name:"Thorn Swarm", cost:250, stat:"projectileCount", amount:3, desc:"Shoots 8 thorns per shot instead of 5."},
            {name:"Heart of Oak", cost:350, desc:"Attacks convert Regrow Bloons into normal Bloons.", extraMods:{stripRegen: true}},
            {name:"Druid of the Jungle", cost:1050, desc:"Calls a vine from the ground to entangle and crush Bloons.", extraMods:{vineCd: 3.0, vineDmg: 10}},
            {name:"Jungle's Bounty", cost:4900, desc:"Generates cash and lives at the end of each round. Vine Crush Ability.", extraMods:{isAbility: true, abilityName: "Vine Crush", abilityCd: 20, income: 500}},
            {name:"Spirit of the Forest", cost:35000, desc:"Grows thorned vines along the path that deal constant damage.", extraMods:{income: 1200, vineDmg: 50, vineCd: 1.0}}
        ],
        3: [ // Wrath Path
            {name:"Druidic Reach", cost:100, stat:"range", amount:10, desc:"Increases range by a large amount."},
            {name:"Heart of Vengeance", cost:300, desc:"Gains attack speed for every life lost.", extraMods:{vengeance: true}},
            {name:"Druid of Wrath", cost:600, desc:"Gains attack speed during the round as long as the Druid is attacking Bloons.", extraMods:{wrath: true}},
            {name:"Poplust", cost:2350, desc:"Boosts attack speed and pierce for other Druids in the radius.", extraMods:{poplust: true}},
            {name:"Avatar of Wrath", cost:45000, stat:"damage", amount:5, desc:"The more Bloons there are, the more damage it does!", extraMods:{avatar: true, pierce: 3}}
        ]
    },
    
    update(tower, dt, engine) {
        // 1. Heart of Vengeance (Path 3 T2)
        if (tower.stats.vengeance) {
            if (tower.vengeanceLives === undefined) tower.vengeanceLives = engine.lives;
            if (engine.lives < tower.vengeanceLives) {
                tower.vengeanceStacks = Math.min(50, (tower.vengeanceStacks || 0) + 1);
                tower.vengeanceLives = engine.lives;
            }
            tower.buffedFireRate = Math.max(tower.buffedFireRate || 0, (tower.vengeanceStacks || 0) * 0.01);
        }

        // 2. Druid of Wrath (Path 3 T3)
        if (tower.stats.wrath && engine.waveManager.waveActive) {
            // Ramp up attack speed if there are bloons in range
                const nearby = engine.enemyGrid.query(tower.x, tower.y, Utils.getEffectiveRange(tower, engine), _druidFireScratch);
            if (nearby.length > 0) {
                tower.wrathStacks = Math.min(40, (tower.wrathStacks || 0) + dt * 4); // Ramps up in 10s
            }
            tower.buffedFireRate = Math.max(tower.buffedFireRate || 0, (tower.wrathStacks || 0) * 0.02);
        }

        // 3. Poplust Aura (Path 3 T4)
        if (tower.stats.poplust) {
            const range = Utils.getEffectiveRange(tower, engine);
            for (const t of engine.towers) {
                if (t && t.type === 'druid' && t !== tower && Utils.distanceSq(tower.x, tower.y, t.x, t.y) < range * range) {
                    t.addBuff('poplust', 'Poplust', 0.5, 1, { type: 'poplust' }, false);
                    t.buffedFireRate = Math.max(t.buffedFireRate || 0, 0.15); // +15% atk speed
                    t.buffedPierce = Math.max(t.buffedPierce || 0, 1);
                }
            }
        }

        // 4. Avatar of Wrath (Path 3 T5)
        if (tower.stats.avatar) {
            const range = Utils.getEffectiveRange(tower, engine);
            const nearby = engine.enemyGrid.query(tower.x, tower.y, range, _druidStormScratch);
            let bloonCount = 0;
            for(const e of nearby) { if(e.alive) bloonCount++; }
            // +1 damage for every 5 bloons, up to +20
            tower.buffedDmg = Math.max(tower.buffedDmg || 0, Math.min(20, Math.floor(bloonCount / 5)));
        }

        // 5. Lightning Attack (Path 1 T2+)
        if (tower.stats.lightningCd) {
            tower.lightningTimer = (tower.lightningTimer || 0) - dt;
            if (tower.lightningTimer <= 0) {
                tower.lightningTimer = tower.stats.lightningCd;
                // Fire a homing lightning bolt at a random target
                if (engine.enemies.length > 0) {
                    let target = engine.enemies[Math.floor(Math.random() * engine.enemies.length)];
                    if (target && target.alive) {
                        let p = engine.projectilePool.get();
                        let pEffects = {};
                        if (tower.stats.freeze) { pEffects.freeze = true; pEffects.freezeDuration = tower.stats.freezeDuration; }
                        p.init(tower.x, tower.y - 10, tower.stats.lightningDmg, target, 'wizard_bolt', 1000, 5, 0.5, null, pEffects, 0, tower, { isEnergy: true, canHitLead: true });
                    }
                }
            }
        }

        // 6. Tornado Attack (Path 1 T3+)
        if (tower.stats.tornadoCd) {
            tower.tornadoTimer = (tower.tornadoTimer || 0) - dt;
            if (tower.tornadoTimer <= 0) {
                tower.tornadoTimer = tower.stats.tornadoCd;
                // Fire a tornado that pushes bloons back
                if (engine.enemies.length > 0) {
                    let target = engine.enemies[Math.floor(Math.random() * engine.enemies.length)];
                    if (target && target.alive) {
                        let p = engine.projectilePool.get();
                        p.init(tower.x, tower.y - 10, 0, target, 'bomb', 400, 10, 1.0, null, { isExplosive: true, explosionRadius: 50, explosionDamage: 0, knockback: tower.stats.knockback, canHitLead: true }, 0, tower, { isExplosion: true, canHitLead: true });
                    }
                }
            }
        }

        // 7. Vine Attack (Path 2 T3+)
        if (tower.stats.vineCd) {
            tower.vineTimer = (tower.vineTimer || 0) - dt;
            if (tower.vineTimer <= 0) {
                tower.vineTimer = tower.stats.vineCd;
                // Instantly damage a bloon and leave an acid pool (thorn pile)
                let target = null, bestVal = -Infinity;
            const nearby = engine.enemyGrid.query(tower.x, tower.y, Utils.getEffectiveRange(tower, engine), _druidAuraScratch);
                for (const e of nearby) {
                    if (!e || !e.alive) continue;
                    if (e.distanceTraveled > bestVal) { bestVal = e.distanceTraveled; target = e; }
                }
                if (target) {
                    target.takeDamage(tower.stats.vineDmg, {isSharp: true, canHitLead: true}, {}, tower);
                    GameEngine.acidPools = GameEngine.acidPools || [];
                    GameEngine.acidPools.push({ x: target.x, y: target.y, life: 4.0, maxLife: 4.0, radius: 25, dmg: tower.stats.vineDmg / 4, tick: 0 });
                }
            }
        }

        // 8. Jungle's Bounty Income (Path 2 T4+)
        if (tower.stats.income) {
            tower.incomeTimer = (tower.incomeTimer || 0) - dt;
            if (tower.incomeTimer <= 0) {
                tower.incomeTimer = 15.0; // Payout every 15 seconds
                engine.addCash(Math.floor(tower.stats.income / 2));
                if (tower.upgrades[1] >= 4) engine.lives += 1; // T4+ grants lives
            }
        }
    },

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        let count = tower.stats.projectileCount || 5;
        let spreadAngle = 25; // 25 degree spread for thorns
        let pEffects = { ...effects };
        if (tower.stats.stripRegen) pEffects.foam = true; // Foam strips camo and regen in the engine

        for (let i = 0; i < count; i++) {
            let offset = count > 1 ? (spreadAngle * (i - (count - 1) / 2)) : 0;
            let p = engine.projectilePool.get();
            p.init(tower.x, tower.y, damage, target, 'thorn', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, pEffects, offset, tower, dmgType, isCrit);
        }
    },

    ability(tower, engine) {
        if (tower.stats.abilityName === "Vine Crush") {
            engine.log("Vine Crush!");
            const range = Utils.getEffectiveRange(tower, engine);
            // Grab and crush many bloons at once
            Utils.applyAoeDamage(engine, tower.x, tower.y, range, tower.stats.vineDmg * 2, {isSharp: true, canHitLead: true}, tower, {knockback: 50}, {maxHits: 100});
            engine.explosions.push({ x: tower.x, y: tower.y, radius: 0, maxRadius: range, life: 0.5, maxLife: 0.5, color: '#27ae60' });
        }
    }
};
