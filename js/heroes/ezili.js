// js/heroes/ezili.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

export default {
    stats: { 
        name: "Ezili", cost: 750, range: 45, fireRate: 1.1, damage: 1, projectileSpeed: 600, pierce: 1, 
        lifespan: 0.5, desc: "Curses Bloons with a damage over time effect.", 
        dmgType: 'normal', projectileType: 'arrow', hitRadius: 18, isHero: true, maxLevel: 20, scale: 1.3,
        isAbility: false, 
        isAbility2: false,
        abilityCd: 40, abilityName: "Heart of Protection",
        ability2Cd: 60, ability2Name: "MOAB Hex",
        dotDmg: 1, dotDur: 3.0, hexDmg: 0.1,
        abilities: [
            { lvl: 3, name: "Heart of Protection", desc: "Creates a shield that blocks Bloon leaks." },
            { lvl: 6, name: "MOAB Hex", desc: "Hexes the strongest Bloon, dealing massive damage over time." }
        ]
    },
    xpTable: [180, 460, 1000, 1860, 3280, 5180, 8320, 9380, 13620, 16380, 14400, 16650, 14940, 16380, 17820, 19260, 20700, 16470, 17280],
    levels: {
        1: [], 2: [{ stat: "pierce", amount: 1 }], 
        3: [{ stat: "isAbility", amount: true }], 
        4: [{ stat: "range", amount: 5 }], 
        5: [{ stat: "dotDmg", amount: 1 }], 
        6: [{ stat: "isAbility2", amount: true }], 
        7: [{ stat: "pierce", amount: 1 }], 
        8: [{ stat: "damage", amount: 1 }], 
        9: [{ stat: "range", amount: 5 }], 
        10: [{ stat: "dotDmg", amount: 1 }], 
        11: [{ stat: "pierce", amount: 1 }], 
        12: [{ stat: "fireRate", amount: -0.2 }], 
        13: [{ stat: "damage", amount: 1 }], 
        14: [{ stat: "range", amount: 5 }], 
        15: [{ stat: "dotDmg", amount: 1 }], 
        16: [{ stat: "fireRate", amount: -0.2 }], 
        17: [{ stat: "damage", amount: 1 }], 
        18: [{ stat: "pierce", amount: 1 }], 
        19: [{ stat: "range", amount: 5 }], 
        20: [{ stat: "dotDmg", amount: 2 }, { stat: "hexDmg", amount: 0.9 }] // Lvl 20 Hex instakills
    },
    update(tower, dt) {
        if (tower.totemTimer !== undefined && tower.totemTimer > 0) {
            tower.totemTimer -= dt;
            if (tower.totemTimer > 0) {
                for (let t of GameEngine.towers) {
                    if (t && !t.isMinion) {
                        t.buffedCamo = true;
                        t.buffedLead = true;
                        t.buffedPierce = Math.max(t.buffedPierce || 0, 2);
                    }
                }
            }
        }
    },
    draw(ctx, tower, isPreview) {
        tower.drawBaseTower(ctx, isPreview);
    },
    ability(tower, engine) {
        engine.log("Ezili: Heart of Protection!");
        // Buffs all towers on screen with camo/lead/pierce
        for (let t of engine.towers) {
            if (t && !t.isMinion) {
                t.addBuff('ezili_totem', 'Totem', 15.0, 1, { type: 'ezili' });
            }
        }
        tower.totemTimer = 15.0;
    },
    ability2(tower, engine) {
        engine.log("Ezili: MOAB Hex!");
        let target = null; let bestHp = 0;
        for (let e of engine.enemies) {
            if (!e.alive || !e.data.isMoab || e.data.isBAD) continue; 
            if (e.hp > bestHp) { bestHp = e.hp; target = e; }
        }
        if (target) {
            // At lvl 20, hex deals 100% max HP damage. Otherwise 10%.
            let hexDmg = target._maxHp * tower.stats.hexDmg;
            target.takeDamage(hexDmg, { isExplosion: true, canHitLead: true });
        }
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        let p = GameEngine.projectilePool.get();
        let pEffects = { ...effects, dot: tower.stats.dotDmg, moabDot: tower.stats.dotDmg };
        p.init(tower.x, tower.y, damage, target, 'arrow', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, pEffects, 0, tower, dmgType);
    }
};