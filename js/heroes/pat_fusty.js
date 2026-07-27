// js/heroes/pat_fusty.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

export default {
    stats: { 
        name: "Pat Fusty", cost: 500, range: 20, fireRate: 1.2, damage: 1, projectileSpeed: 0, pierce: 10, 
        lifespan: 0.2, desc: "Slams Bloons in a short range.", 
        dmgType: 'normal', projectileType: 'nail', hitRadius: 18, isHero: true, maxLevel: 20, scale: 1.5,
        abilityCd: 30, abilityName: "Rallying Roar",
        ability2Cd: 45, ability2Name: "Big Squeeze",
        squeezeDmg: 10
    },
    xpTable: [180, 460, 1000, 1860, 3280, 5180, 8320, 9380, 13620, 16380, 14400, 16650, 14940, 16380, 17820, 19260, 20700, 16470, 17280],
    levels: {
        1: [], 2: [{ stat: "pierce", amount: 5 }], 
        3: [{ stat: "isAbility", amount: true }], 
        4: [{ stat: "damage", amount: 1 }], 
        5: [{ stat: "range", amount: 5 }], 
        6: [{ stat: "pierce", amount: 5 }], 
        7: [{ stat: "isAbility2", amount: true }], 
        8: [{ stat: "damage", amount: 1 }], 
        9: [{ stat: "range", amount: 5 }], 
        10: [{ stat: "pierce", amount: 10 }], 
        11: [{ stat: "damage", amount: 1 }], 
        12: [{ stat: "fireRate", amount: -0.2 }], 
        13: [{ stat: "damage", amount: 1 }], 
        14: [{ stat: "range", amount: 5 }], 
        15: [{ stat: "damage", amount: 1 }], 
        16: [{ stat: "pierce", amount: 10 }], 
        17: [{ stat: "damage", amount: 1 }], 
        18: [{ stat: "fireRate", amount: -0.2 }], 
        19: [{ stat: "damage", amount: 2 }], 
        20: [{ stat: "squeezeDmg", amount: 90 }]
    },
    update(tower, dt) {
        // Pat doesn't need custom update
    },
    draw(ctx, tower, isPreview) {
        tower.drawBaseTower(ctx, isPreview);
    },
    ability(tower, engine) {
        engine.log("Pat Fusty: Rallying Roar!");
        const effRange = Utils.getEffectiveRange(tower, engine);
        for (let t of engine.towers) {
            if (t && !t.isMinion && Utils.withinRange(tower.x, tower.y, t.x, t.y, effRange)) {
                t.addBuff('pat_rally', 'Rally', 10.0, 1, { type: 'rally' });
                t.buffedFireRate += 0.5; // 50% fire rate buff
            }
        }
    },
    ability2(tower, engine) {
        engine.log("Pat Fusty: Big Squeeze!");
        // Stuns and damages everything on screen
        for (let e of engine.enemies) {
            if (!e.alive) continue;
            let stunDur = 4.0;
            if (e.data.isMoab) stunDur = 2.0;
            if (e.data.isBAD) stunDur = 0;
            e.applySlow(0.0, stunDur, false);
            e.takeDamage(tower.stats.squeezeDmg, { isExplosion: true, canHitLead: true });
        }
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        // Pat uses an AoE slam instead of a projectile
        const expR = 25; 
        engine.explosions.push({ x: target.x, y: target.y, radius: 0, maxRadius: expR, life: 0.2, maxLife: 0.2, color: '#795548' });
        Utils.applyAoeDamage(engine, target.x, target.y, expR, damage, dmgType, tower, effects, { maxHits: tower.stats.pierce });
    }
};