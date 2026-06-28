import { GameEngine } from '../engine.js';
import { Projectile } from '../projectile.js';
import { Utils } from '../utils.js';
import { RANGE_SCALE } from '../config.js';

export default {
    stats: { 
        name: "Gwendolin", cost: 725, range: 38, fireRate: 0.5, damage: 1, pierce: 2, projectileSpeed: 400, 
        lifespan: 0.4, desc: "Blasts Bloons with fire. Cannot hit Purple or Camo.", 
        dmgType: 'fire', projectileType: 'fire', hitRadius: 18, isHero: true, maxLevel: 20, scale: 1.3,
        canHitLead: true, projectileCount:1
    },
    xpTable: [180, 460, 1000, 1860, 3280, 5180, 8320, 9380, 13620, 16380, 14400, 16650, 14940, 16380, 17820, 19260, 20700, 16470, 17280],
    levels: {
        1: [], 
        2: [{ stat: "pierce", amount: 1 }], 
        3: [{ stat: "isAbility", amount: true }], 
        4: [{ stat: "heatItUp", amount: true }], 
        5: [{ stat: "pierce", amount: 1 }], 
        6: [{ stat: "burnDmg", amount: 1 }, { stat: "burnDuration", amount: 3.0 }], 
        7: [{ stat: "heatItUpRange", amount: 5 }, { stat: "cocktailTick", amount: -0.1 }, { stat: "cocktailPierce", amount: 20 }], 
        8: [{ stat: "projectileCount", amount: 1 }], 
        9: [{ stat: "damage", amount: 1 }, { stat: "burnDmg", amount: 1 }], 
        10: [{ stat: "isAbility2", amount: true }], 
        11: [{ stat: "range", amount: 3 }, { stat: "cocktailPierce", amount: 20 }, { stat: "burnDmg", amount: 1 }], 
        12: [{ stat: "fireRate", amount: -0.1 }, { stat: "heatItUpDmg", amount: 7 }, { stat: "burnDmg", amount: 1 }], 
        13: [{ stat: "pierce", amount: 4 }, { stat: "burnDmg", amount: 1 }], 
        14: [{ stat: "cocktailDmg", amount: 1 }, { stat: "cocktailMoabBurn", amount: 5 }, { stat: "burnDmg", amount: 1 }], 
        15: [{ stat: "fireRate", amount: -0.075 }, { stat: "heatItUpDmg", amount: 10 }, { stat: "burnDmg", amount: 1 }], 
        16: [{ stat: "canHitPurple", amount: true }, { stat: "stormDmg", amount: 5 }, { stat: "burnDmg", amount: 1 }], 
        17: [{ stat: "heatItUpDmgBonus", amount: 1 }, { stat: "heatItUpLeadBonus", amount: 2 }, { stat: "burnDmg", amount: 1 }], 
        18: [{ stat: "fireRate", amount: -0.15 }, { stat: "heatItUpDmg", amount: 10 }, { stat: "burnDmg", amount: 1 }], 
        19: [{ stat: "projectileCount", amount: 1 }, { stat: "burnDmg", amount: 1 }], 
        20: [{ stat: "stormDmg", amount: 5 }, { stat: "stormMoabDmg", amount: 30 }, { stat: "cocktailDmg", amount: 3 }, { stat: "burnDmg", amount: 1 }]
    },
    update(tower, dt) {
        // Cocktail of Fire logic
        if (tower.cocktails && tower.cocktails.length > 0) {
            for (let i = tower.cocktails.length - 1; i >= 0; i--) {
                let c = tower.cocktails[i];
                c.life -= dt;
                c.tick -= dt;
                
                if (c.life <= 0) { tower.cocktails.splice(i, 1); continue; }
                
                if (c.tick <= 0) {
                    c.tick = tower.stats.cocktailTick || 0.2;
                    const nearby = GameEngine.enemyGrid.query(c.x, c.y, 60);
                    let hits = 0;
                    for (let e of nearby) {
                        if (hits >= (tower.stats.cocktailPierce || 20)) break;
                        if (!e.alive) continue;
                        if (Utils.distance(c.x, c.y, e.x, e.y) < 60) {
                            let dmg = tower.stats.cocktailDmg || 1;
                            let dmgType = { isFire: true, canHitLead: true, canHitPurple: tower.level >= 16 };
                            e.takeDamage(dmg, dmgType);
                            if (tower.level >= 14 && e.data.isMoab) {
                                e.dotTimer = 10; e.dotDmg = 5;
                            }
                            hits++;
                        }
                    }
                }
            }
        }
    },
    draw(ctx, tower, isPreview) {
        // Draw Cocktail fires
        if (!isPreview && tower.cocktails) {
            for (let c of tower.cocktails) {
                ctx.globalAlpha = Math.min(1, c.life / 2);
                ctx.fillStyle = '#e67e22';
                ctx.beginPath(); ctx.arc(c.x, c.y, 50, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#f1c40f';
                ctx.beginPath(); ctx.arc(c.x, c.y, 30, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
            }
        }
        tower.drawBaseTower(ctx, isPreview);
    },
    ability(tower, engine) {
        let target = null;
        let bestVal = Infinity;
        const effRange = (tower.stats.range || 0) * RANGE_SCALE; // Use the global scale multiplier
        for (let e of engine.enemies) {
            if (!e.alive) continue;
            // Target "Close" within her range
            if (Utils.distance(tower.x, tower.y, e.x, e.y) < effRange) {
                let val = Utils.distance(tower.x, tower.y, e.x, e.y);
                if (val < bestVal) { bestVal = val; target = e; }
            }
        }
        let x = target ? target.x : tower.x;
        let y = target ? target.y : tower.y;
        
        tower.cocktails = tower.cocktails || [];
        tower.cocktails.push({ x, y, life: 12, tick: 0 });
        engine.log("Gwendolin: Cocktail of Fire!");
    },
    ability2(tower, engine) {
        let stormDmg = tower.stats.stormDmg || 5;
        let stormMoabDmg = tower.stats.stormMoabDmg || 20;
        let burnDmg = tower.stats.burnDmg || 1;
        
        for (let e of engine.enemies) {
            if (!e.alive) continue;
            let dmg = e.data.isMoab ? stormMoabDmg : stormDmg;
            let dmgType = { isFire: true, canHitLead: true, canHitPurple: tower.level >= 16 };
            e.takeDamage(dmg, dmgType);
            e.dotTimer = tower.level >= 16 ? 10.4 : 8;
            e.dotDmg = e.data.isMoab ? (tower.level >= 20 ? 30 : 15) : (tower.level >= 16 ? 10 : 2);
        }
        
        // Apply Heat It Up to all towers
        for (let t of engine.towers) {
            if (!t) continue;
            t.heatItUpTimer = 8;
            t.buffedPierce = (t.buffedPierce || 0) + 1;
            if (tower.level >= 17) {
                t.buffedDmg = (t.buffedDmg || 0) + 1;
                t.buffedLead = true;
            }
        }
        
        engine.log("Gwendolin: Firestorm!");
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        let count = tower.stats.projectileCount || 1;
        tower.shotCount = (tower.shotCount || 0) + 1;
        
        // Heat It Up Passive (Every 40 shots)
        if (tower.stats.heatItUp && tower.shotCount % 40 === 0) {
            let hiuRange = (tower.stats.heatItUpRange || 0) + ((tower.stats.range || 0) * RANGE_SCALE);
            for (let e of GameEngine.enemies) {
                if (e.alive && Utils.distance(tower.x, tower.y, e.x, e.y) < hiuRange) {
                    e.takeDamage(tower.stats.heatItUpDmg || 3, { isFire: true, canHitLead: true });
                }
            }
            for (let ot of GameEngine.towers) {
                if (ot && Utils.distance(tower.x, tower.y, ot.x, ot.y) < hiuRange) {
                    ot.heatItUpTimer = 8;
                    ot.buffedPierce = (ot.buffedPierce || 0) + 1;
                    if (tower.level >= 17) {
                        ot.buffedDmg = (ot.buffedDmg || 0) + 1;
                        ot.buffedLead = true;
                    }
                }
            }
        }
        
        // Apply Burn DoT to projectiles
        let burnEffects = { ...effects };
        if (tower.stats.burnDmg) {
            burnEffects.dot = tower.stats.burnDmg;
            burnEffects.dotTimer = tower.stats.burnDuration || 3;
        }
        
        let baseAngle = target ? Utils.angle(tower.x, tower.y, target.x, target.y) : 0;
        
        for(let i=0; i<count; i++) {
            // PRO FIX: Calculate parallel spawn offset
            let offset = count > 1 ? (i - (count-1)/2) * 10 : 0;
            let perpAngle = baseAngle + Math.PI / 2;
            let spawnX = tower.x + Math.cos(perpAngle) * offset;
            let spawnY = tower.y + Math.sin(perpAngle) * offset;
            
            // Fire them all at the exact same angle (parallel)
            let p = new Projectile(spawnX, spawnY, damage, target, 'fire', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, baseAngle, burnEffects, 0, tower, dmgType);
            p.isCrit = isCrit;
            GameEngine.projectiles.push(p);
        }
    }
};