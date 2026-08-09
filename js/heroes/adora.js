// js/heroes/adora.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

export default {
    stats: { 
        name: "Adora", cost: 1000, range: 50, fireRate: 1.4, damage: 2, projectileSpeed: 1000, pierce: 5, 
        lifespan: 0.2, desc: "Fires a piercing beam of holy light.", 
        dmgType: 'energy', projectileType: 'laser', hitRadius: 18, isHero: true, maxLevel: 20, scale: 1.3,
        isAbility: false, 
        isAbility2: false,
        abilityCd: 40, abilityName: "Long Arm of Light",
        ability2Cd: 60, ability2Name: "Blood Sacrifice",
        sacrDmgBonus: 0,
        abilities: [
            { lvl: 3, name: "Long Arm of Light", desc: "Extends light beams to hit all Bloons on screen." },
            { lvl: 7, name: "Blood Sacrifice", desc: "Sacrifices a nearby tower to permanently boost Adora's damage." }
        ]
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
        20: [{ stat: "damage", amount: 5 }, { stat: "canSeeCamo", amount: true }] // Lvl 20 sees camo
    },
    update(tower, dt) {
        if (tower.longarmTimer !== undefined && tower.longarmTimer > 0) {
            tower.longarmTimer -= dt;
            if (tower.longarmTimer > 0) {
                tower.buffedRange = Math.max(tower.buffedRange || 0, 0.25); // 25% range buff
                tower.buffedPierce = Math.max(tower.buffedPierce || 0, 10);
            }
        }
    },
    draw(ctx, tower, isPreview) {
        tower.drawBaseTower(ctx, isPreview);
    },
    ability(tower, engine) {
        engine.log("Adora: Long Arm of Light!");
        tower.addBuff('adora_longarm', 'Long Arm', 15.0, 1, { type: 'adora' });
        tower.longarmTimer = 15.0;
    },
    ability2(tower, engine) {
        engine.log("Adora: Blood Sacrifice!");
        // Sacrifices the most expensive nearby tower
        let target = null; let maxCost = 0;
        const effRange = Utils.getEffectiveRange(tower, engine);
        for (let t of engine.towers) {
            if (t === tower || t.isMinion || t.stats.isHero) continue;
            if (Utils.withinRange(tower.x, tower.y, t.x, t.y, effRange)) {
                if (t.totalSpent > maxCost) { maxCost = t.totalSpent; target = t; }
            }
        }
        if (target) {
            target.alive = false;
            const idx = engine.towers.indexOf(target);
            if (idx > -1) engine.towers.splice(idx, 1);
            
            // Permanently boost Adora's damage
            tower.stats.damage += 5;
            tower.sacrDmgBonus += 5;
            engine.log("Adora's power grows!");
        } else {
            engine.log("No valid towers to sacrifice!");
        }
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        let p = GameEngine.projectilePool.get();
        p.init(tower.x, tower.y, damage, target, 'arrow', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, effects, 0, tower, dmgType);
    }
};