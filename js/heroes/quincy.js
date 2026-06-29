// js/heroes/quincy.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

export default {
    stats: { 
        name: "Quincy", cost: 540, range: 44, fireRate: 0.95, damage: 1, projectileSpeed: 800, pierce: 3, 
        lifespan: 0.5, desc: "Auto-levels via XP. Fires powerful bouncing arrows.", 
        dmgType: 'sharp', projectileType: 'arrow', hitRadius: 18, isHero: true, maxLevel: 20, scale: 1.3,
        rapidShotMult: 3, rapidShotDur: 8, rapidShotCd: 60, 
        stormCd: 70, stormChance: 0.05, stormDmg: 6, stormMoabDmg: 6, stormCeramicDmg: 0
    },
    xpTable: [180, 460, 1000, 1860, 3280, 5180, 8320, 9380, 13620, 16380, 14400, 16650, 14940, 16380, 17820, 19260, 20700, 16470, 17280],
    levels: {
        1: [], 2: [{ stat: "pierce", amount: 1 }], 
        3: [{ stat: "isAbility", amount: true }], 
        4: [{ stat: "range", amount: 6 }], 
        5: [{ stat: "canSeeCamo", amount: true }], 
        6: [{ stat: "projectileCount", amount: 1 }], 
        7: [{ stat: "applyExplosive", amount: true, explosiveEvery: 3 }], 
        8: [{ stat: "moabDmg", amount: 2 }], 
        9: [{ stat: "pierce", amount: 2 }], 
        10: [{ stat: "isAbility2", amount: true }], 
        11: [{ stat: "fireRate", amount: -0.32 }], 
        12: [{ stat: "pierce", amount: 1 }], 
        13: [{ stat: "range", amount: 6 }, { stat: "rapidShotDur", amount: 4 }], 
        14: [{ stat: "moabDmg", amount: 1 }], 
        15: [{ stat: "rapidShotMult", amount: 1 }, { stat: "rapidShotCd", amount: -15 }], 
        16: [{ stat: "fireRate", amount: -0.23 }], 
        17: [{ stat: "explosiveEvery", amount: 2 }, { stat: "lifespan", amount: 0.125 }], 
        18: [{ stat: "fireRate", amount: -0.15 }, { stat: "stormChance", amount: 0.025 }, { stat: "stormCeramicDmg", amount: 18 }, { stat: "stormCd", amount: -15 }], 
        19: [{ stat: "projectileCount", amount: 1 }, { stat: "pierce", amount: 2 }], 
        20: [{ stat: "fireRate", amount: -0.05 }, { stat: "stormChance", amount: 0.025 }, { stat: "stormDmg", amount: 4 }, { stat: "stormMoabDmg", amount: 4 }, { stat: "stormCeramicDmg", amount: 6 }]
    },
    update(tower, dt) {
        if (tower.stormOfArrows && tower.stormOfArrows.active) {
            tower.stormOfArrows.timer -= dt;
            if (tower.stormOfArrows.timer <= 0) tower.stormOfArrows.active = false;
            else {
                const soa = tower.stormOfArrows; const nearby = GameEngine.enemyGrid.query(soa.x, soa.y, soa.radius);
                for (let e of nearby) {
                    if (!e.alive) continue; if (Utils.distance(soa.x, soa.y, e.x, e.y) < soa.radius) {
                        if (e.stormHitTimer > 0) continue;
                        if (Math.random() < soa.chance) {
                            let dmgType = { isSharp: true, canHitLead: true }; let dmg = soa.dmg;
                            if (e.data.isMoab) dmg += soa.moabDmg; if (e.data.isCeramic) dmg += soa.ceramicDmg;
                            let actualDmg = e.takeDamage(dmg, dmgType); tower.damageDealt += actualDmg; e.stormHitTimer = 0.05;
                        }
                    }
                }
            }
        }
    },
    draw(ctx, tower, isPreview) {
        if (!isPreview && tower.stormOfArrows && tower.stormOfArrows.active) {
            const soa = tower.stormOfArrows;
            ctx.globalAlpha = 0.15; ctx.fillStyle = '#9b59b6'; ctx.beginPath(); ctx.arc(soa.x, soa.y, soa.radius, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
            ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2;
            for(let i=0; i<15; i++) { let angle = Math.random() * Math.PI * 2; let r = Math.random() * soa.radius; let x1 = soa.x + Math.cos(angle) * r; let y1 = soa.y + Math.sin(angle) * r; ctx.beginPath(); ctx.moveTo(x1, y1 - 12); ctx.lineTo(x1, y1); ctx.stroke(); }
        }
        tower.drawBaseTower(ctx, isPreview);
    },
    ability(tower, engine) { console.log("Quincy: Rapid Shot Activated!"); tower.abilityActiveTime = tower.stats.rapidShotDur || 8; engine.log("Quincy: Rapid Shot!"); },
    ability2(tower, engine) {
        console.log("Quincy: Storm of Arrows Activated!"); tower.ability2Cooldown = tower.stats.stormCd || 70;
        let target = null; let bestVal = Infinity;
        for (let e of GameEngine.enemies) { if (!e.alive) continue; if (e.distanceTraveled < bestVal) { bestVal = e.distanceTraveled; target = e; } }
        let x = target ? target.x : tower.x; let y = target ? target.y : tower.y;
        
        // PRO FIX: Restored normal BTD6 stats (removed debug 100 dmg)
        tower.stormOfArrows = { 
            active: true, timer: 3, x: x, y: y, radius: 250, 
            chance: tower.stats.stormChance, 
            dmg: tower.stats.stormDmg, 
            moabDmg: tower.stats.stormMoabDmg, 
            ceramicDmg: tower.stats.stormCeramicDmg 
        };
        engine.log("Quincy: Storm of Arrows!");
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        if (tower.abilityActiveTime > 0) console.log(`Firing with Rapid Shot! Fire Rate: ${tower.stats.fireRate / (tower.stats.rapidShotMult || 3)}s`);
        let count = tower.stats.projectileCount || 1; tower.shotCount = (tower.shotCount || 0) + 1;
        let isExplosive = tower.stats.applyExplosive && (tower.shotCount % (tower.stats.explosiveEvery || 3) === 0);
        for(let i=0; i<count; i++) {
            let p = GameEngine.projectilePool.get();
            p.init(tower.x, tower.y, damage, target, 'arrow', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, null, 5 * (i - (count-1)/2), tower, dmgType);
            p.isCrit = isCrit;
            if (isExplosive) { p.effects = p.effects || {}; p.effects.isExplosive = true; p.effects.explosionRadius = 80; p.effects.explosionDamage = 1; p.effects.explosionPierce = 10; }
        }
    }
};