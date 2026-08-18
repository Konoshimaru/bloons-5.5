// js/towers/boomerang_monkey.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

const _boomerOrbitScratch = [];

export default {
    stats: { 
        name: "Boomerang Monkey", cost: 315, range: 43, 
        baseCooldown: 1.2, fireRate: 1.2, 
        damage: 1, pierce: 4, projectileSpeed: 600, lifespan: 1.5, 
        desc: "Throws a boomerang in a curved path. Good range and pierce.", 
        dmgType: 'sharp', projectileType: 'boomerang', hitRadius: 18,
        category: 'Primary' 
    },
    upgrades: { 
        1: [
            {name:"Improved Rangs", cost:200, stat:"pierce", amount:4, desc:"Can pop up to 8 Bloons per throw."},
            {name:"Glaives", cost:280, stat:"pierce", amount:12, desc:"Throws glaives instead of boomerangs. Bigger and faster.", extraMods:{projectileSpeed: 100}},
            {name:"Glaive Ricochet", cost:600, desc:"Glaives will bounce from Bloon to Bloon automatically.", extraMods:{ricochet: 10, ricochetRange: 150}},
            {name:"M.O.A.R Glaives", cost:2000, stat:"damage", amount:1, desc:"Greatly enhances ricochet powers.", extraMods:{ricochet: 20, ricochetRange: 200}},
            {name:"Glaive Lord", cost:32500, stat:"damage", amount:4, desc:"Surrounds itself in 3 special glaives. Rips through MOABs.", extraMods:{pierce: 100, moabDmg: 5, ricochet: 50, ricochetRange: 300}}
        ], 
        2: [
            {name:"Faster Throwing", cost:175, desc:"Throws boomerangs faster.", extraMods:{cooldownMult: 0.85}},
            {name:"Faster Rangs", cost:250, desc:"Boomerangs fire and travel faster.", extraMods:{cooldownMult: 0.85, projectileSpeed: 100}},
            {name:"Bionic Boomerang", cost:1250, stat:"moabDmg", amount:2, desc:"Bionic arm throws extremely fast. More MOAB damage.", extraMods:{cooldownMult: 0.6}},
            {name:"Turbo Charge", cost:4200, desc:"Ability: Attack incredibly fast for 8 seconds with +1 damage.", extraMods:{isAbility: true, abilityName: "Turbo Charge", abilityCd: 30}},
            {name:"Perma Charge", cost:35000, desc:"Turbo Charge is now permanent: super fast attack speed and +1 damage.", extraMods:{cooldownMult: 0.4}}
        ], 
        3: [
            {name:"Long Range Rangs", cost:100, stat:"range", amount:10, desc:"Can throw boomerangs further than normal."},
            {name:"Red Hot Rangs", cost:300, stat:"dmgType", amount:'fire', desc:"Pops Frozen and Lead Bloons and does more damage.", extraMods:{damage: 1}},
            {name:"Kylie Boomerang", cost:1300, stat:"pierce", amount:10, desc:"Throws heavy Kylie boomerangs that follow a straight path.", extraMods:{projectileSpeed: 200, lifespan: -0.5}}, // Faster, shorter life to act straighter
            {name:"MOAB Press", cost:2700, stat:"moabDmg", amount:3, desc:"Hits MOABs multiple times and knocks them back.", extraMods:{knockback: 20}},
            {name:"MOAB Domination", cost:50000, stat:"moabDmg", amount:24, desc:"Special knockback kylies trigger more often and do lots of extra damage.", extraMods:{knockback: 50, damage: 11, pierce: 50}}
        ]
    },
    
    update(tower, dt, engine) {
        // Perma Charge (T5): permanent turbo speed + damage
        if (tower.upgrades[1] === 5) {
            tower.buffedFireRate = Math.max(tower.buffedFireRate || 0, 5.0);
            tower.buffedDmg = Math.max(tower.buffedDmg || 0, 1);
        } else if (tower.turboActive > 0) {
            // Turbo Charge Ability active effect
            tower.turboActive -= dt;
            tower.buffedFireRate = Math.max(tower.buffedFireRate || 0, 5.0);
            tower.buffedDmg = Math.max(tower.buffedDmg || 0, 1);
        }
        
        // Glaive Lord (T5): 3 permanent orbiting glaives that shred anything
        // they touch. Each glaive ticks its own hit cooldown against bloons in
        // its immediate radius.
        if (tower.upgrades[0] === 5) {
            if (!tower.orbitGlaives) {
                tower.orbitGlaiveAngle = 0;
                tower.orbitGlaives = [
                    { angle: 0, radius: 42, tick: 0 },
                    { angle: Math.PI * 2 / 3, radius: 42, tick: 0 },
                    { angle: Math.PI * 4 / 3, radius: 42, tick: 0 }
                ];
            }
            tower.orbitGlaiveAngle += dt * 3;
            const glaiveDmg = tower.stats.damage || 1;
            const glaiveMoab = tower.stats.moabDmg || 0;
            for (const g of tower.orbitGlaives) {
                g.tick -= dt;
                if (g.tick <= 0) {
                    g.tick = 0.2;
                    const gx = tower.x + Math.cos(tower.orbitGlaiveAngle + g.angle) * g.radius;
                    const gy = tower.y + Math.sin(tower.orbitGlaiveAngle + g.angle) * g.radius;
                    const nearby = engine.enemyGrid.query(gx, gy, 26, _boomerOrbitScratch);
                    for (const e of nearby) {
                        if (!e.alive) continue;
                        if (Utils.withinRange(gx, gy, e.x, e.y, 26)) {
                            e.takeDamage(glaiveDmg, { isSharp: true, canHitLead: true, moabDmg: glaiveMoab }, null, tower);
                        }
                    }
                }
            }
        }
    },

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        let pEffects = { ...effects };
        // Apply Path 1 Ricochet effects
        if (tower.stats.ricochet) {
            pEffects.ricochet = tower.stats.ricochet;
            pEffects.ricochetRange = tower.stats.ricochetRange;
        }
        // Apply Path 3 Knockback effects
        if (tower.stats.knockback) {
            pEffects.knockback = tower.stats.knockback;
        }
        
        let p = engine.projectilePool.get();
        // Use standard boomerang type, it handles the curve.
        // If it's a Kylie (Path 3 T3+), we could use a different type, but 'boomerang' with high speed works fine.
        p.init(tower.x, tower.y, damage, target, 'boomerang', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, pEffects, 0, tower, dmgType, isCrit);
    },
    
    ability(tower, engine) {
        if (tower.stats.abilityName === "Turbo Charge") {
            engine.log("Turbo Charge Activated!");
            tower.turboActive = 8.0; // 8 seconds of insane attack speed
        }
    },

    draw(ctx, tower, isPreview) {
        if (!isPreview && tower.upgrades[0] === 5 && tower.orbitGlaives) {
            for (const g of tower.orbitGlaives) {
                const gx = tower.x + Math.cos(tower.orbitGlaiveAngle + g.angle) * g.radius;
                const gy = tower.y + Math.sin(tower.orbitGlaiveAngle + g.angle) * g.radius;
                ctx.save();
                ctx.translate(gx, gy);
                ctx.rotate(tower.orbitGlaiveAngle + g.angle);
                ctx.fillStyle = '#bdc3c7';
                ctx.fillRect(-11, -3, 22, 6);
                ctx.fillStyle = '#95a5a6';
                ctx.fillRect(-3, -11, 6, 22);
                ctx.restore();
            }
        }
        tower.drawBaseTower(ctx, isPreview);
    }
};
