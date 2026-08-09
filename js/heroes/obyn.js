// js/heroes/obyn.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

const _trapScratch = [];
const _buffTowerScratch = [];

export default {
    stats: { 
        name: "Obyn Greenfoot", cost: 750, range: 40, fireRate: 1.35, damage: 2, projectileSpeed: 350, pierce: 1, 
        lifespan: 1.0, desc: "Commands a spirit wolf. Buffs Magic monkeys in range.", 
        dmgType: 'normal', projectileType: 'wolf', hitRadius: 18, isHero: true, maxLevel: 20, scale: 1.3,
        isAbility: false, 
        isAbility2: false,
        abilityCd: 35, abilityName: "Brambles",
        ability2Cd: 60, ability2Name: "Wall of Trees",
        magicDmgBuff: 0, magicPierceBuff: 0,
        abilities: [
            { lvl: 4, name: "Brambles", desc: "Places brambles on the track that pop Bloons." },
            { lvl: 8, name: "Wall of Trees", desc: "Creates vines that damage Bloons and grant lives." }
        ]
    },
    xpTable: [180, 460, 1000, 1860, 3280, 5180, 8320, 9380, 13620, 16380, 14400, 16650, 14940, 16380, 17820, 19260, 20700, 16470, 17280],
    levels: {
        1: [], 2: [{ stat: "magicDmgBuff", amount: 1 }, { stat: "magicPierceBuff", amount: 1 }], 
        3: [{ stat: "range", amount: 5 }], 
        4: [{ stat: "isAbility", amount: true }], 
        5: [{ stat: "damage", amount: 1 }], 
        6: [{ stat: "magicDmgBuff", amount: 1 }, { stat: "magicPierceBuff", amount: 1 }], 
        7: [{ stat: "range", amount: 5 }], 
        8: [{ stat: "isAbility2", amount: true }], 
        9: [{ stat: "damage", amount: 1 }], 
        10: [{ stat: "pierce", amount: 1 }], 
        11: [{ stat: "range", amount: 5 }], 
        12: [{ stat: "magicDmgBuff", amount: 1 }, { stat: "magicPierceBuff", amount: 1 }], 
        13: [{ stat: "damage", amount: 1 }], 
        14: [{ stat: "pierce", amount: 1 }], 
        15: [{ stat: "range", amount: 5 }], 
        16: [{ stat: "magicDmgBuff", amount: 1 }, { stat: "magicPierceBuff", amount: 1 }], 
        17: [{ stat: "damage", amount: 1 }], 
        18: [{ stat: "pierce", amount: 1 }], 
        19: [{ stat: "range", amount: 5 }], 
        20: [{ stat: "damage", amount: 2 }]
    },
    update(tower, dt, engine) {
        // Obyn buffs Magic towers in range
        const effRange = Utils.getEffectiveRange(tower, engine);
        const nearbyTowers = GameEngine.towerGrid.query(tower.x, tower.y, effRange, _buffTowerScratch);
        for (let t of nearbyTowers) {
            if (t === tower) continue;
            if (Utils.withinRange(tower.x, tower.y, t.x, t.y, effRange)) {
                if (t.stats.category === 'Magic') {
                    t.addBuff('obyn_magic', 'Magic Buff', 0.5, 1, { type: 'obyn_magic' }, false);
                    t.buffedDmg = Math.max(t.buffedDmg, tower.stats.magicDmgBuff);
                    t.buffedPierce = Math.max(t.buffedPierce, tower.stats.magicPierceBuff);
                }
            }
        }

        // Handle Brambles/Tree Trap
        if (tower.activeTrap) {
            const trap = tower.activeTrap; 
            const nearby = GameEngine.enemyGrid.query(trap.x, trap.y, trap.radius, _trapScratch);
            for (let e of nearby) {
                if (!e.alive) continue;
                if (Utils.withinRange(trap.x, trap.y, e.x, e.y, trap.radius + e.data.radius)) {
                    if (!e.data.isMoab || trap.moab) { 
                        if (trap.rbe + e.data.rbe <= trap.maxRbe) { 
                            trap.rbe += e.data.rbe; e.alive = false; GameEngine.spawnPopEffect(e.x, e.y, e.data.color); 
                        } else { 
                            trap.rbe = trap.maxRbe; 
                        } 
                    }
                }
            }
            if (trap.rbe >= trap.maxRbe) {
                GameEngine.addCash(trap.rbe); 
                tower.activeTrap = null;
            }
        }
    },
    draw(ctx, tower, isPreview) {
        if (tower.activeTrap) { 
            let trap = tower.activeTrap; 
            ctx.fillStyle = trap.rbe >= trap.maxRbe ? '#27ae60' : '#2ecc71'; 
            ctx.beginPath(); ctx.arc(trap.x, trap.y, trap.radius, 0, Math.PI * 2); ctx.fill(); 
        }
        tower.drawBaseTower(ctx, isPreview);
    },
    ability(tower, engine) {
        engine.log("Obyn: Brambles!");
        let pt = engine.map.getNearestPathPoint(tower.x, tower.y);
        tower.activeTrap = { x: pt.x, y: pt.y, rbe: 0, maxRbe: 50, moab: false, radius: 15 };
    },
    ability2(tower, engine) {
        engine.log("Obyn: Wall of Trees!");
        let pt = engine.map.getNearestPathPoint(tower.x, tower.y);
        tower.activeTrap = { x: pt.x, y: pt.y, rbe: 0, maxRbe: 1000, moab: false, radius: 30 };
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        let p = GameEngine.projectilePool.get();
        p.init(tower.x, tower.y, damage, target, 'arrow', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, effects, 0, tower, dmgType);
    }
};