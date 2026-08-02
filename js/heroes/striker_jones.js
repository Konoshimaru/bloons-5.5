// js/heroes/striker_jones.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

export default {
    stats: { 
        name: "Striker Jones", cost: 750, range: 40, fireRate: 1.1, damage: 1, projectileSpeed: 300, pierce: 1, 
        lifespan: 1.0, desc: "Pounds Bloons with explosive shells. Can stun MOAB-class bloons.", 
        dmgType: 'explosion', projectileType: 'bomb', hitRadius: 18, isHero: true, maxLevel: 20, scale: 1.3,
        isAbility: false, 
        isAbility2: false,
        abilityCd: 30, abilityName: "Concussive Shell",
        ability2Cd: 45, ability2Name: "Artillery Barrage",
        stunBonusDmg: 0, moabStunDur: 0.5, barrageDmg: 10, barrageShells: 5,
        abilities: [
            { lvl: 4, name: "Concussive Shell", desc: "Fires a shell that stuns all Bloons in a large radius." },
            { lvl: 10, name: "Artillery Barrage", desc: "Calls in a massive artillery strike across the track." }
        ]
    },
    xpTable: [180, 460, 1000, 1860, 3280, 5180, 8320, 9380, 13620, 16380, 14400, 16650, 14940, 16380, 17820, 19260, 20700, 16470, 17280],
    levels: {
        1: [], 2: [{ stat: "pierce", amount: 1 }, { stat: "damage", amount: 1 }], 
        3: [{ stat: "range", amount: 5 }, { stat: "stunBonusDmg", amount: 1 }], 
        4: [{ stat: "isAbility", amount: true }], 
        5: [{ stat: "damage", amount: 1 }], 
        6: [{ stat: "pierce", amount: 1 }, { stat: "range", amount: 5 }], 
        7: [{ stat: "fireRate", amount: -0.15 }], 
        8: [{ stat: "moabStunDur", amount: 0.5 }], 
        9: [{ stat: "damage", amount: 1 }, { stat: "pierce", amount: 1 }], 
        10: [{ stat: "isAbility2", amount: true }], 
        11: [{ stat: "fireRate", amount: -0.15 }], 
        12: [{ stat: "range", amount: 5 }, { stat: "pierce", amount: 1 }], 
        13: [{ stat: "stunBonusDmg", amount: 1 }, { stat: "damage", amount: 1 }], 
        14: [{ stat: "fireRate", amount: -0.15 }], 
        15: [{ stat: "damage", amount: 1 }, { stat: "moabStunDur", amount: 0.5 }], 
        16: [{ stat: "stunBonusDmg", amount: 1 }, { stat: "fireRate", amount: -0.15 }], 
        17: [{ stat: "range", amount: 5 }, { stat: "pierce", amount: 1 }, { stat: "damage", amount: 1 }], 
        18: [{ stat: "stunBonusDmg", amount: 1 }, { stat: "fireRate", amount: -0.15 }], 
        19: [{ stat: "damage", amount: 1 }, { stat: "moabStunDur", amount: 0.5 }], 
        20: [{ stat: "barrageDmg", amount: 40 }, { stat: "barrageShells", amount: 5 }, { stat: "moabStunDur", amount: 1.5 }]
    },
    update(tower, dt) {
        // Jones doesn't need custom update logic, his stun is applied on hit
    },
    draw(ctx, tower, isPreview) {
        tower.drawBaseTower(ctx, isPreview);
    },
    ability(tower, engine) {
        engine.log("Striker Jones: Concussive Shell!");
        for (let e of engine.enemies) {
            if (!e.alive) continue;
            let stunDur = 1.5;
            if (e.data.isMoab) stunDur = tower.stats.moabStunDur;
            e.applySlow(0.0, stunDur, false);
        }
    },
    ability2(tower, engine) {
        engine.log("Striker Jones: Artillery Barrage!");
        // Stuns everything
        for (let e of engine.enemies) {
            if (!e.alive) continue;
            let stunDur = 3.0;
            if (e.data.isMoab) stunDur = tower.stats.moabStunDur * 2;
            e.applySlow(0.0, stunDur, false);
        }
        // Fires a barrage of shells at the strongest MOAB
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
        // Jones deals bonus damage to stunned bloons
        let actualDmg = damage;
        if (target.stunTimer > 0) actualDmg += tower.stats.stunBonusDmg;
        
        p.init(tower.x, tower.y, actualDmg, target, 'bomb', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, {isExplosive: true, explosionRadius: 30, explosionDamage: actualDmg, explosionPierce: 10}, 0, tower, dmgType);
    }
};