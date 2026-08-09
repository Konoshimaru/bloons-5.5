// js/heroes/dan_d_monke.js
// Dan D'Monke - Courtly Monkey
// Switches between two forms: Dan D'Monke (melee sword support) and the
// Masqued Macaque (ranged damage with chain lightning). Form switching and five
// abilities map onto the three ability slots (Transformation + form-dependent
// L7 and L10 abilities).

import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { AudioEngine } from '../audio.js';

const _danScratch = [];

export default {
    stats: {
        name: "Dan D'Monke", cost: 650, range: 30, fireRate: 0.5, damage: 1,
        projectileSpeed: 700, pierce: 4, lifespan: 0.2, hitRadius: 18, scale: 1.3,
        desc: "Courtly monkey who transforms between a melee sword form and a ranged chain-lightning form.",
        dmgType: 'sharp', projectileType: 'dart', isHero: true, maxLevel: 20,
        canSeeCamo: false,
        form: 'dan',
        danFireRate: 0.5, danDamage: 1, danPierce: 4, danRange: 30,
        macFireRate: 1.0, macDamage: 2, macPierce: 9, macRange: 34.5,
        chainEvery: 3, chainDmg: 1,
        stompEvery: 20, stompDmg: 20, stompRadius: 34.5,
        blowbackEvery: 4, jabEvery: 3, tauntEvery: 24,
        isAbility: false, isAbility2: false, isAbility3: false,
        abilityName: "Transformation", abilityCd: 20,
        ability2Name: "Reposition", ability2Cd: 30,
        ability3Name: "Rabble Rouser", ability3Cd: 60
    },
    abilityUnlocks: { 1: 3, 2: 7, 3: 10 },
    xpTable: [257, 656, 1425, 2651, 4674, 7382, 11856, 13367, 19409, 23342, 20520, 23726, 21290, 23342, 25394, 27446, 29498, 23470, 24624],
    levels: {
        1: [],
        2: [{ stat: "danPierce", amount: 2 }],
        3: [],
        4: [{ stat: "danDamage", amount: 1 }, { stat: "macDamage", amount: 2 }, { stat: "chainDmg", amount: 1 }, { stat: "netTraps", amount: true }],
        5: [],
        6: [{ stat: "danDamage", amount: 1 }, { stat: "macDamage", amount: 2 }, { stat: "chainDmg", amount: 1 }],
        7: [],
        8: [{ stat: "taunt", amount: true }],
        9: [{ stat: "jabEvery", amount: 3 }, { stat: "fastTransform", amount: true }],
        10: [],
        11: [{ stat: "danRange", amount: 4.5 }, { stat: "danPierce", amount: 2 }, { stat: "macRange", amount: 5.175 }, { stat: "macPierce", amount: 3 }, { stat: "stompRadius", amount: 5.175 }],
        12: [],
        13: [{ stat: "macFireRate", amount: -0.25 }, { stat: "berserkFast", amount: true }],
        14: [],
        15: [{ stat: "danPierce", amount: 2 }, { stat: "macPierce", amount: 3 }],
        16: [{ stat: "danDamage", amount: 1 }, { stat: "macDamage", amount: 3 }, { stat: "chainDmg", amount: 1 }, { stat: "stompDmg", amount: 20 }],
        17: [{ stat: "transformDur", amount: 6 }, { stat: "ability2Cd", amount: -15 }],
        18: [{ stat: "danJab3", amount: true }],
        19: [{ stat: "danDamage", amount: 2 }, { stat: "macDamage", amount: 3 }],
        20: [{ stat: "blowbackDmg", amount: 20 }]
    },
    _syncForm(tower) {
        const mac = tower.form === 'macaque';
        const rateBefore = tower.stats.fireRate;
        tower.stats.fireRate = mac ? (tower.stats.macFireRate || 1.0) : (tower.stats.danFireRate || 0.5);
        tower.stats.damage = mac ? (tower.stats.macDamage || 2) : (tower.stats.danDamage || 1);
        tower.stats.pierce = mac ? (tower.stats.macPierce || 9) : (tower.stats.danPierce || 4);
        tower.stats.range = mac ? (tower.stats.macRange || 34.5) : (tower.stats.danRange || 30);
        tower.stats.canSeeCamo = mac;
        tower.stats.dmgType = mac ? 'normal' : 'sharp';
        tower.stats.ability2Name = mac ? "Volant Strike" : "Reposition";
        tower.stats.ability3Name = mac ? "Berserk Frenzy" : "Rabble Rouser";
        if (rateBefore !== tower.stats.fireRate || tower._lastForm !== tower.form) {
            tower._recalculateStats();
            tower._lastForm = tower.form;
        }
    },
    update(tower, dt) {
        this._syncForm(tower);

        if (tower.attackCount === undefined) tower.attackCount = 0;
        if (tower.transformTimer !== undefined && tower.transformTimer > 0) {
            tower.transformTimer -= dt;
            tower.transformTick = (tower.transformTick || 0) - dt;
            if (tower.transformTick <= 0) {
                tower.transformTick = 0.5;
                this._chainLightning(tower, tower.stats.chainDmg || 1, 3);
            }
        }
        if (tower.berserkTimer !== undefined && tower.berserkTimer > 0) {
            tower.berserkTimer -= dt;
            tower.berserkTick = (tower.berserkTick || 0) - dt;
            if (tower.berserkTick <= 0) {
                tower.berserkTick = tower.stats.berserkFast ? 0.1875 : 0.25;
                const dmg = tower.level >= 19 ? 60 : (tower.level >= 16 ? 45 : 30);
                const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, 45, _danScratch);
                let hits = 0;
                for (const e of nearby) {
                    if (!e.alive || hits >= 18) continue;
                    if (Utils.withinRange(tower.x, tower.y, e.x, e.y, 45)) {
                        e.takeDamage(dmg, { isSharp: true, canHitLead: true }, {}, tower);
                        hits++;
                    }
                }
            }
        }
        if (tower.rabbleTimer !== undefined && tower.rabbleTimer > 0) {
            tower.rabbleTimer -= dt;
            if (tower.rabbleTimer <= 0) {
                if (tower.rabbleTargets) {
                    for (const t of tower.rabbleTargets) {
                        if (t._rabbleDmg) { t.buffedDmg = Math.max(0, (t.buffedDmg || 0) - t._rabbleDmg); t._rabbleDmg = 0; }
                        if (t._rabbleRate) { t.buffedFireRate = Math.max(0, (t.buffedFireRate || 0) - t._rabbleRate); t._rabbleRate = 0; }
                        if (t.activeBuffs) {
                            for (let i = t.activeBuffs.length - 1; i >= 0; i--) {
                                if (t.activeBuffs[i].id === 'rabble') t.activeBuffs.splice(i, 1);
                            }
                        }
                    }
                    tower.rabbleTargets = [];
                }
            } else {
                if (!tower.rabbleTargets) tower.rabbleTargets = [];
                for (const t of GameEngine.towers) {
                    if (!t || t === tower || t.isMinion) continue;
                    if (Utils.withinRange(tower.x, tower.y, t.x, t.y, 60)) {
                        t.addBuff('rabble', 'Rabble Rouser', 0.5, 1, { type: 'rabble' }, false);
                        const dmgBoost = Math.floor((t.stats.damage || 1) * 0.5);
                        if (!t._rabbleDmg) t._rabbleDmg = dmgBoost;
                        t.buffedDmg = Math.max(t.buffedDmg || 0, t._rabbleDmg);
                        if (!t._rabbleRate) t._rabbleRate = 0.17;
                        t.buffedFireRate = Math.max(t.buffedFireRate || 0, t._rabbleRate);
                        if (!tower.rabbleTargets.includes(t)) tower.rabbleTargets.push(t);
                    }
                }
            }
        }
        if (tower.transformTimer !== undefined && tower.transformTimer > 0 && tower.transformTimer <= (tower.stats.transformDur || 12) - 9) {
            // During +33% attack-speed window after the 3s transform lightning
            tower.buffedFireRate = Math.max(tower.buffedFireRate || 0, 0.33);
        }
        if (tower.repositionTimer !== undefined && tower.repositionTimer > 0) {
            tower.repositionTimer -= dt;
            tower.buffedFireRate = Math.max(tower.buffedFireRate || 0, 0.5);
        }

        if (tower.netTimer === undefined) tower.netTimer = 9;
        tower.netTimer -= dt;
        if (tower.stats.netTraps && tower.netTimer <= 0 && GameEngine.waveManager.waveActive) {
            tower.netTimer = 9;
            this._placeNet(tower);
        }
        if (tower.nets) {
            for (let i = tower.nets.length - 1; i >= 0; i--) {
                const n = tower.nets[i];
                n.life -= dt;
                if (n.life <= 0) { tower.nets.splice(i, 1); continue; }
                const nearby = GameEngine.enemyGrid.query(n.x, n.y, 18, _danScratch);
                for (const e of nearby) {
                    if (!e.alive) continue;
                    if (Utils.withinRange(n.x, n.y, e.x, e.y, 18)) {
                        e.applySlow(0.5, 0.5, false);
                    }
                }
            }
        }
    },
    _placeNet(tower) {
        let best = null, bestDist = Infinity;
        for (const e of GameEngine.enemies) {
            if (!e.alive) continue;
            const d = Utils.distance(tower.x, tower.y, e.x, e.y);
            if (d < bestDist && d < tower.stats.range + 30) { bestDist = d; best = e; }
        }
        let x = tower.x, y = tower.y;
        if (best) { x = best.x; y = best.y; }
        if (!tower.nets) tower.nets = [];
        if (tower.nets.length > 4) tower.nets.shift();
        tower.nets.push({ x, y, life: 45 });
    },
    _chainLightning(tower, dmg, maxForks) {
        if (!tower._lastTarget) return;
        const t = tower._lastTarget;
        const nearby = GameEngine.enemyGrid.query(t.x, t.y, 40, _danScratch);
        let forks = 0;
        for (const e of nearby) {
            if (!e.alive || e === t || forks >= maxForks) continue;
            if (Utils.withinRange(t.x, t.y, e.x, e.y, 40)) {
                e.takeDamage(dmg, { isPlasma: true, canHitLead: true }, {}, tower);
                forks++;
            }
        }
    },
    draw(ctx, tower, isPreview) {
        if (!isPreview && tower.form === 'macaque') {
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(tower.x, tower.y, 24, 0, Math.PI * 2); ctx.stroke();
        }
        if (!isPreview && tower.nets) {
            for (const n of tower.nets) {
                ctx.strokeStyle = 'rgba(192,57,43,0.7)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                for (let k = 0; k <= 8; k++) {
                    const a = (k / 8) * Math.PI * 2;
                    const r = 9 * (k % 2 === 0 ? 1 : 0.6);
                    const px = n.x + Math.cos(a) * r;
                    const py = n.y + Math.sin(a) * r;
                    if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.stroke();
            }
        }
        tower.drawBaseTower(ctx, isPreview);
    },
    ability(tower, engine) {
        tower.form = tower.form === 'dan' ? 'macaque' : 'dan';
        tower.transformTimer = tower.stats.transformDur || 12;
        tower.transformTick = 0;
        tower.buffedFireRate = 0;
        engine.log(`Dan D'Monke: Transformed to ${tower.form === 'dan' ? "Dan" : "Masqued Macaque"}!`);
    },
    ability2(tower, engine) {
        if (tower.form === 'macaque') {
            let best = null, bestVal = -Infinity;
            for (const e of GameEngine.enemies) {
                if (!e.alive) continue;
                if (e.data.rbe > bestVal) { bestVal = e.data.rbe; best = e; }
            }
            if (best) {
                const dmg = tower.level >= 16 ? 100 : 75;
                const nearby = GameEngine.enemyGrid.query(best.x, best.y, tower.stats.stompRadius, _danScratch);
                let hits = 0;
                for (const e of nearby) {
                    if (!e.alive || hits >= 35) continue;
                    if (Utils.withinRange(best.x, best.y, e.x, e.y, tower.stats.stompRadius)) {
                        e.takeDamage(dmg, { isNormal: true, canHitLead: true }, { stun: e.data.isMoab ? 3 : 6 }, tower);
                        hits++;
                    }
                }
            }
            engine.log("Dan D'Monke: Volant Strike!");
        } else {
            tower.buffedFireRate = Math.max(tower.buffedFireRate || 0, 0.5);
            tower.repositionTimer = 6;
            tower.addBuff('reposition', 'Reposition', 6, 1, { type: 'reposition' }, false);
            const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, 40, _danScratch);
            for (const e of nearby) {
                if (!e.alive) continue;
                if (Utils.withinRange(tower.x, tower.y, e.x, e.y, 40)) {
                    e.distanceTraveled = Math.max(0, e.distanceTraveled - 40);
                }
            }
            engine.log("Dan D'Monke: Reposition!");
        }
    },
    ability3(tower, engine) {
        if (tower.form === 'macaque') {
            tower.berserkTimer = 12;
            tower.berserkTick = 0;
            engine.log("Dan D'Monke: Berserk Frenzy!");
        } else {
            tower.rabbleTimer = 10;
            tower.rabbleTargets = [];
            engine.log("Dan D'Monke: Rabble Rouser!");
        }
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        if (!target) return;
        tower.attackCount++;
        tower._lastTarget = target;

        if (tower.form === 'dan') {
            let dmg = damage;
            const eff = { ...effects };
            if (tower.attackCount % (tower.stats.blowbackEvery || 4) === 0) {
                if (target.data.isMoab && !target.data.isBAD) {
                    eff.knockback = 5 + Math.random() * 5;
                } else if (!target.data.isLead && target.data.rbe < 100) {
                    eff.knockback = 100 + Math.random() * 100;
                    if (tower.stats.blowbackDmg) dmg += tower.stats.blowbackDmg;
                }
            }
            if (target.danTaunted === tower) dmg += 1;
            if (tower.stats.taunt && tower.attackCount % (tower.stats.tauntEvery || 24) === 0) {
                const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, 60, _danScratch);
                let hits = 0;
                for (const e of nearby) {
                    if (!e.alive || hits >= 45) continue;
                    if (Utils.withinRange(tower.x, tower.y, e.x, e.y, 60)) {
                        e.danTaunted = tower;
                        hits++;
                    }
                }
            }
            const jabs = tower.stats.danJab3 ? (tower.attackCount % 3 === 0 ? 3 : 2)
                : (tower.stats.jabEvery && tower.attackCount % 3 === 0 ? 2 : 1);
            for (let i = 0; i < jabs; i++) {
                const p = GameEngine.projectilePool.get();
                p.init(tower.x, tower.y, dmg, target, 'dart', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, eff, 0, tower, dmgType);
                p.isCrit = isCrit;
            }
        } else {
            const p = GameEngine.projectilePool.get();
            p.init(tower.x, tower.y, damage, target, 'dart', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, null, 0, tower, dmgType);
            p.isCrit = isCrit;

            if (tower.attackCount % (tower.stats.chainEvery || 3) === 0) {
                this._chainLightning(tower, tower.stats.chainDmg || 1, 3);
            }
            if (tower.attackCount % (tower.stats.stompEvery || 20) === 0) {
                const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, tower.stats.stompRadius, _danScratch);
                let hits = 0;
                for (const e of nearby) {
                    if (!e.alive || hits >= 60) continue;
                    if (Utils.withinRange(tower.x, tower.y, e.x, e.y, tower.stats.stompRadius)) {
                        e.takeDamage(tower.stats.stompDmg || 20, { isNormal: true }, {}, tower);
                        e.distanceTraveled = Math.max(0, e.distanceTraveled - 20);
                        hits++;
                    }
                }
            }
        }
    }
};
