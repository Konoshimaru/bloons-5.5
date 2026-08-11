// js/heroes/churchill.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

export default {
    stats: { 
        name: "Captain Churchill", cost: 2000, range: 60, fireRate: 2.0, damage: 1, projectileSpeed: 250, pierce: 5, 
        lifespan: 1.5, desc: "Fires a shell that bounces and pierces. Expensive but powerful.", 
        dmgType: 'explosion', projectileType: 'bomb', hitRadius: 18, isHero: true, maxLevel: 20, scale: 1.3,
        isAbility: false, 
        isAbility2: false,
        abilityCd: 30, abilityName: "Armor Piercing Shells",
        ability2Cd: 60, ability2Name: "MOAB Barrage",
        barrageDmg: 10, barrageShells: 5,
        abilities: [
            { lvl: 4, name: "Armor Piercing Shells", desc: "Fires shells that deal extra damage and pierce more Bloons." },
            { lvl: 10, name: "MOAB Barrage", desc: "Calls in a massive artillery strike across the track." }
        ]
    },
    xpTable: [180, 460, 1000, 1860, 3280, 5180, 8320, 9380, 13620, 16380, 14400, 16650, 14940, 16380, 17820, 19260, 20700, 16470, 17280],
    levels: {
        1: [], 2: [{ stat: "pierce", amount: 5 }, { stat: "damage", amount: 1 }], 
        3: [{ stat: "range", amount: 5 }], 
        4: [{ stat: "isAbility", amount: true }], 
        5: [{ stat: "damage", amount: 1 }], 
        6: [{ stat: "pierce", amount: 5 }], 
        7: [{ stat: "range", amount: 5 }], 
        8: [{ stat: "damage", amount: 1 }], 
        9: [{ stat: "pierce", amount: 5 }], 
        10: [{ stat: "isAbility2", amount: true }], 
        11: [{ stat: "damage", amount: 1 }], 
        12: [{ stat: "range", amount: 5 }], 
        13: [{ stat: "damage", amount: 1 }], 
        14: [{ stat: "pierce", amount: 5 }], 
        15: [{ stat: "damage", amount: 1 }], 
        16: [{ stat: "range", amount: 5 }], 
        17: [{ stat: "damage", amount: 1 }], 
        18: [{ stat: "pierce", amount: 5 }], 
        19: [{ stat: "damage", amount: 1 }], 
        20: [{ stat: "barrageDmg", amount: 40 }, { stat: "barrageShells", amount: 5 }]
    },
    update(tower, dt) {
        // Churchill doesn't need custom update logic
    },
    draw(ctx, tower, isPreview) {
        tower.drawBaseTower(ctx, isPreview);
    },
    ability(tower, engine) {
        engine.log("Churchill: Armor Piercing Shells!");
        tower.abilityActiveTime = 10; // Buffs fire rate and pierce via abilityActiveTime
        tower.addBuff('ap_shells', 'Armor Piercing Shells', 10, 1, { type: 'ap_shells' }, false);
    },
    ability2(tower, engine) {
        engine.log("Churchill: MOAB Barrage!");
        let target = null; let bestHp = 0;
        for (let e of engine.enemies) {
            if (!e.alive || !e.data.isMoab) continue;
            if (e.hp > bestHp) { bestHp = e.hp; target = e; }
        }
        if (target) {
            for (let i = 0; i < tower.stats.barrageShells; i++) {
                let p = engine.projectilePool.get();
                p.init(tower.x, tower.y, tower.stats.barrageDmg, target, 'bomb', 400, 100, 2.0, null, {isExplosive: true, explosionRadius: 40, explosionDamage: tower.stats.barrageDmg, explosionPierce: 50}, 0, tower, {isExplosion: true, canHitLead: true});
            }
        }
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        let p = GameEngine.projectilePool.get();
        let pierce = tower.stats.pierce;
        if (tower.abilityActiveTime > 0) pierce = 999; // Infinite pierce during ability
        
        p.init(tower.x, tower.y, damage, target, 'bomb', tower.stats.projectileSpeed, pierce, tower.stats.lifespan, null, {isExplosive: true, explosionRadius: 20, explosionDamage: damage, explosionPierce: 10}, 0, tower, dmgType);
    }
};