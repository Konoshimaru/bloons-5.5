// js/heroes/benjamin.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

export default {
    stats: { 
        name: "Benjamin", cost: 1200, range: 0, fireRate: 0, damage: 0, projectileSpeed: 0, pierce: 0, 
        lifespan: 0, desc: "Doesn't attack. Generates cash and hacks Bloons.", 
        dmgType: 'none', projectileType: 'none', hitRadius: 18, isHero: true, maxLevel: 20, scale: 1.3,
        isAbility: false, 
        isAbility2: false,
        abilityCd: 20, abilityName: "Biohack",
        ability2Cd: 60, ability2Name: "Symlink Funding",
        passiveCash: 50,
        abilities: [
            { lvl: 3, name: "Biohack", desc: "Buffs all towers on screen for a short time." },
            { lvl: 5, name: "Symlink Funding", desc: "Trojan: Damages all bloons on screen and grants cash." }
        ]
    },
    xpTable: [180, 460, 1000, 1860, 3280, 5180, 8320, 9380, 13620, 16380, 14400, 16650, 14940, 16380, 17820, 19260, 20700, 16470, 17280],
    levels: {
        1: [], 2: [{ stat: "passiveCash", amount: 50 }], 
        3: [{ stat: "isAbility", amount: true }], 
        4: [{ stat: "passiveCash", amount: 50 }], 
        5: [{ stat: "range", amount: 20 }, { stat: "isAbility2", amount: true }], // Lvl 5 Trojan
        6: [{ stat: "passiveCash", amount: 100 }], 
        7: [{ stat: "fireRate", amount: 1.0 }], // Skims cash faster
        8: [{ stat: "passiveCash", amount: 100 }], 
        9: [{ stat: "range", amount: 10 }], 
        10: [{ stat: "passiveCash", amount: 150 }], 
        11: [{ stat: "fireRate", amount: -0.2 }], 
        12: [{ stat: "passiveCash", amount: 150 }], 
        13: [{ stat: "range", amount: 10 }], 
        14: [{ stat: "passiveCash", amount: 200 }], 
        15: [{ stat: "fireRate", amount: -0.2 }], 
        16: [{ stat: "passiveCash", amount: 200 }], 
        17: [{ stat: "range", amount: 10 }], 
        18: [{ stat: "passiveCash", amount: 250 }], 
        19: [{ stat: "fireRate", amount: -0.2 }], 
        20: [{ stat: "passiveCash", amount: 500 }]
    },
    update(tower, dt, engine) {
        // Skims cash every 6 seconds
        tower.cashTimer = (tower.cashTimer || 0) - dt;
        if (tower.cashTimer <= 0) {
            tower.cashTimer = 6.0;
            engine.addCash(tower.stats.passiveCash);
            tower.cashGenerated = (tower.cashGenerated || 0) + tower.stats.passiveCash;
        }
    },
    draw(ctx, tower, isPreview) {
        tower.drawBaseTower(ctx, isPreview);
    },
    ability(tower, engine) {
        engine.log("Benjamin: Biohack!");
        // Buffs all towers on screen for a short time
        for (let t of engine.towers) {
            if (t && !t.isMinion) {
                t.overclockTimer = 8; // Reuses Overclock buff
            }
        }
    },
    ability2(tower, engine) {
        engine.log("Benjamin: Symlink Funding!");
        // Trojan: Damages all bloons on screen and grants cash
        let cashGained = 0;
        for (let e of engine.enemies) {
            if (!e.alive) continue;
            let dmg = 50;
            if (e.data.isMoab) dmg = 500;
            if (e.data.isBAD) dmg = 0; // BADs immune
            
            let actualDmg = e.takeDamage(dmg, { isExplosion: true, canHitLead: true });
            if (actualDmg > 0) cashGained += Math.floor(actualDmg * 0.5);
        }
        engine.addCash(cashGained);
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        // Benjamin doesn't fire
    }
};