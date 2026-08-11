// js/heroes/brickell.js
// Admiral Brickell - Naval Commander
// BTD6-faithful kit: revolver pistol (instant-hit sharp), auto-deploying sea
// mines that home in on nearby Bloons, and three activated abilities
// (Naval Tactics, Blast Chain, Mega Mine).

import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { AudioEngine } from '../audio.js';

const _mineScratch = [];

export default {
    stats: {
        name: "Admiral Brickell", cost: 900, range: 50, fireRate: 0.8, damage: 3,
        projectileSpeed: 9000, pierce: 3, lifespan: 0.15, hitRadius: 18, scale: 1.3,
        desc: "Naval commander whose pistol and auto-deployed sea mines defend the track. Mines explode on nearby Bloons.",
        dmgType: 'sharp', projectileType: 'arrow', isHero: true, maxLevel: 20,
        canSeeCamo: false,
        isAbility: false, isAbility2: false, isAbility3: false,
        abilityName: "Naval Tactics", abilityCd: 50,
        ability2Name: "Blast Chain", ability2Cd: 45,
        ability3Name: "Mega Mine", ability3Cd: 60,
        rapidShotMult: 2,
        mineDeploy: 3.0, mineDmg: 1, minePierce: 20, mineRadius: 20, mineRange: 40,
        navalTacticsDur: 8
    },
    abilityUnlocks: { 1: 3, 2: 7, 3: 10 },
    xpTable: [257, 656, 1425, 2651, 4674, 7382, 11856, 13367, 19409, 23342, 20520, 23726, 21290, 23342, 25394, 27446, 29498, 23470, 24624],
    levels: {
        1: [],
        2: [{ stat: "fireRate", amount: -0.15 }, { stat: "mineDeploy", amount: -0.2 }],
        3: [],
        4: [{ stat: "minePierce", amount: 8 }],
        5: [{ stat: "navalTacticsPierce", amount: 1 }],
        6: [{ stat: "damage", amount: 3 }, { stat: "mineDmg", amount: 1 }],
        7: [{ stat: "range", amount: 8 }, { stat: "mineRange", amount: 8 }, { stat: "canSeeCamo", amount: true }],
        8: [{ stat: "navalTacticsCamo", amount: true }],
        9: [{ stat: "mineDmg", amount: 5 }],
        10: [],
        11: [{ stat: "mineDeploy", amount: -0.3 }],
        12: [{ stat: "damage", amount: 6 }, { stat: "fireRate", amount: -0.3 }, { stat: "mineDmg", amount: 5 }],
        13: [{ stat: "ability3Cd", amount: -10 }],
        14: [{ stat: "navalTacticsDur", amount: 2 }],
        15: [{ stat: "damage", amount: 6 }, { stat: "mineRadius", amount: 10 }, { stat: "mineNormal", amount: true }, { stat: "mineDecamo", amount: true }],
        16: [{ stat: "range", amount: 4 }, { stat: "mineRange", amount: 4 }],
        17: [{ stat: "damage", amount: 22 }, { stat: "mineDmg", amount: 10 }],
        18: [{ stat: "ability3Cd", amount: -10 }],
        19: [{ stat: "navalTacticsGlobal", amount: true }],
        20: [{ stat: "megaMineDmg", amount: 11000 }, { stat: "megaMinePierce", amount: 150 }, { stat: "megaMineStun", amount: 10 }]
    },
    update(tower, dt) {
        if (tower.ability2ActiveTime !== undefined && tower.ability2ActiveTime > 0) tower.ability2ActiveTime -= dt;
        if (tower.mines) {
            for (let i = tower.mines.length - 1; i >= 0; i--) {
                const m = tower.mines[i];
                m.life -= dt;
                if (m.life <= 0) { tower.mines.splice(i, 1); continue; }

                m.reTimer -= dt;
                if (m.reTimer <= 0) {
                    m.reTimer = tower.abilityActiveTime > 0 ? 0.1 : 0.4;
                    const triggerR = tower.abilityActiveTime > 0 ? m.triggerRange * 1.6 : m.triggerRange;
                    const nearby = GameEngine.enemyGrid.query(m.x, m.y, triggerR + 30, _mineScratch);
                    for (const e of nearby) {
                        if (!e.alive) continue;
                        if (e.isCamo && !tower.stats.canSeeCamo) continue;
                        if (m.isMega && !e.data.isMoab) continue;
                        if (Utils.withinRange(m.x, m.y, e.x, e.y, triggerR)) {
                            this._explodeMine(tower, m);
                            tower.mines.splice(i, 1);
                            break;
                        }
                    }
                }
            }
        }

        if (tower.megaMine) {
            const mm = tower.megaMine;
            mm.life -= dt;
            if (mm.life <= 0) {
                tower.megaMine = null;
            } else {
                mm.reTimer -= dt;
                if (mm.reTimer <= 0) {
                    mm.reTimer = 0.2;
                    const nearby = GameEngine.enemyGrid.query(mm.x, mm.y, mm.triggerRange + 30, _mineScratch);
                    for (const e of nearby) {
                        if (!e.alive || !e.data.isMoab) continue;
                        if (Utils.withinRange(mm.x, mm.y, e.x, e.y, mm.triggerRange)) {
                            const dmgType = { isExplosion: true, canHitLead: true };
                            let hits = 0;
                            const targets = GameEngine.enemyGrid.query(mm.x, mm.y, mm.radius, _mineScratch);
                            for (const t of targets) {
                                if (!t.alive || hits >= mm.pierce) continue;
                                if (Utils.withinRange(mm.x, mm.y, t.x, t.y, mm.radius)) {
                                    t.takeDamage(mm.dmg, dmgType, { stun: mm.stun }, tower);
                                    hits++;
                                }
                            }
                            GameEngine.explosions.push({ x: mm.x, y: mm.y, radius: 0, maxRadius: mm.radius, life: 0.5, maxLife: 0.5, color: '#e67e22' });
                            AudioEngine.playSfx('moab_destroy');
                            tower.megaMine = null;
                            break;
                        }
                    }
                }
            }
        }

        if (tower.mineTimer === undefined) tower.mineTimer = 0;
        tower.mineTimer -= dt;
        if (tower.mineTimer <= 0 && GameEngine.waveManager.waveActive) {
            tower.mineTimer = tower.stats.mineDeploy || 3;
            this._placeMine(tower);
        }
    },
    _placeMine(tower) {
        if (!tower.mines) tower.mines = [];
        let best = null, bestDist = Infinity;
        const targets = GameEngine.enemyGrid.query(tower.x, tower.y, tower.stats.range + 60, _mineScratch);
        for (const e of targets) {
            if (!e.alive) continue;
            const d = Utils.distance(tower.x, tower.y, e.x, e.y);
            if (d < bestDist) { bestDist = d; best = e; }
        }
        const cx = best ? best.x : tower.x;
        const cy = best ? best.y : tower.y;
        const ang = Math.random() * Math.PI * 2;
        const off = 10 + Math.random() * 25;
        const x = cx + Math.cos(ang) * off;
        const y = cy + Math.sin(ang) * off;
        if (tower.mines.length > 8) tower.mines.shift();
        tower.mines.push({
            x: x, y: y,
            life: 120, reTimer: 0.4,
            triggerRange: tower.stats.mineRange || 40,
            dmg: tower.stats.mineDmg || 1,
            pierce: tower.stats.minePierce || 20,
            radius: tower.stats.mineRadius || 20,
            normal: !!tower.stats.mineNormal,
            decamo: !!tower.stats.mineDecamo
        });
    },
    _explodeMine(tower, m) {
        const dmgType = m.normal ? { isExplosion: true, canHitLead: true } : { isExplosion: true };
        const effects = {};
        if (m.decamo) effects.stripCamo = true;
        let hits = 0;
        const nearby = GameEngine.enemyGrid.query(m.x, m.y, m.radius, _mineScratch);
        for (const e of nearby) {
            if (!e.alive || hits >= m.pierce) continue;
            if (Utils.withinRange(m.x, m.y, e.x, e.y, m.radius)) {
                e.takeDamage(m.dmg, dmgType, effects, tower);
                hits++;
            }
        }
        GameEngine.explosions.push({ x: m.x, y: m.y, radius: 0, maxRadius: m.radius, life: 0.35, maxLife: 0.35, color: '#3498db' });
        AudioEngine.playSfx('pop');
    },
    draw(ctx, tower, isPreview) {
        if (!isPreview && tower.mines) {
            for (const m of tower.mines) {
                ctx.globalAlpha = Math.min(1, m.life / 3);
                ctx.fillStyle = '#34495e';
                ctx.beginPath(); ctx.arc(m.x, m.y, 7, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#e74c3c';
                ctx.beginPath(); ctx.arc(m.x, m.y, 3.5, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
            }
        }
        if (!isPreview && tower.megaMine) {
            ctx.fillStyle = '#c0392b';
            ctx.beginPath(); ctx.arc(tower.megaMine.x, tower.megaMine.y, 12, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#e67e22'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(tower.megaMine.x, tower.megaMine.y, 16, 0, Math.PI * 2); ctx.stroke();
        }
        tower.drawBaseTower(ctx, isPreview);
    },
    ability(tower, engine) {
        const dur = tower.stats.navalTacticsDur || 8;
        tower.abilityActiveTime = dur;
        tower.addBuff('naval_tactics', 'Naval Tactics', dur, 1, { type: 'naval_tactics' }, false);
        engine.log("Admiral Brickell: Naval Tactics!");
    },
    ability2(tower, engine) {
        tower.ability2ActiveTime = 15;
        engine.log("Admiral Brickell: Blast Chain!");
        if (tower.mines) {
            for (let i = tower.mines.length - 1; i >= 0; i--) {
                this._explodeMine(tower, tower.mines[i]);
            }
            tower.mines.length = 0;
        }
        if (tower.megaMine) {
            const mm = tower.megaMine;
            const dmgType = { isExplosion: true, canHitLead: true };
            let hits = 0;
            const targets = GameEngine.enemyGrid.query(mm.x, mm.y, mm.radius, _mineScratch);
            for (const t of targets) {
                if (!t.alive || hits >= mm.pierce) continue;
                if (Utils.withinRange(mm.x, mm.y, t.x, t.y, mm.radius)) {
                    t.takeDamage(mm.dmg, dmgType, { stun: mm.stun }, tower);
                    hits++;
                }
            }
            GameEngine.explosions.push({ x: mm.x, y: mm.y, radius: 0, maxRadius: mm.radius, life: 0.5, maxLife: 0.5, color: '#e67e22' });
            AudioEngine.playSfx('moab_destroy');
            tower.megaMine = null;
        }
    },
    ability3(tower, engine) {
        let best = null, bestVal = -Infinity;
        for (const e of GameEngine.enemies) {
            if (!e.alive || !e.data.isMoab) continue;
            if (e.data.rbe > bestVal) { bestVal = e.data.rbe; best = e; }
        }
        const x = best ? best.x : tower.x;
        const y = best ? best.y : tower.y;
        tower.megaMine = {
            x: x, y: y,
            life: 150, reTimer: 0.2, triggerRange: 40,
            dmg: tower.stats.megaMineDmg || 4000,
            pierce: tower.stats.megaMinePierce || 100,
            radius: 120,
            stun: tower.stats.megaMineStun || 5
        };
        engine.log("Admiral Brickell: Mega Mine deployed!");
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        if (!target) return;
        const p = GameEngine.projectilePool.get();
        let pierce = tower.stats.pierce;
        const eff = { ...effects };
        if (tower.abilityActiveTime > 0) {
            pierce += tower.stats.navalTacticsPierce || 0;
            if (tower.stats.canSeeCamo && tower.stats.navalTacticsCamo) eff.canSeeCamo = true;
        }
        p.init(tower.x, tower.y, damage, target, 'arrow', tower.stats.projectileSpeed, pierce, tower.stats.lifespan, null, eff, 0, tower, dmgType);
        p.isCrit = isCrit;
    }
};
