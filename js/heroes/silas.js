// js/heroes/silas.js
// Silas - Ice Shaper
// Launches a ricocheting ice orb that seeks Bloons: first contact "rimes" them
// (slows), the next contact freezes and triggers a cold explosion. Arctic Wind
// aura slows nearby Bloons, Ice Walls freeze anything that crosses them, and
// three abilities (Frostbite, Frozen Cascade, Frozen Burial) unleash mass freezes.

import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { AudioEngine } from '../audio.js';

const _silasScratch = [];

export default {
    stats: {
        name: "Silas", cost: 850, range: 55, fireRate: 0, damage: 0,
        hitRadius: 18, scale: 1.3,
        desc: "Ice shaper whose ricocheting orb rimes then freezes Bloons, with an Arctic Wind aura and frozen abilities.",
        dmgType: 'frigid', isHero: true, maxLevel: 20,
        canSeeCamo: true,
        icePierce: 10, orbSpeed: 320, orbLifespan: 2.5, launchCd: 1.4,
        coldDmg: 1, coldPierce: 3, coldRadius: 12,
        rimeSlow: 0.5, freezeDur: 2.5,
        arcticSlow: 0.85,
        iceWallCd: 10,
        frostbiteDmg: 10,
        cascadeDmg: 12, cascadeFrozenBonus: 8,
        burialDmg: 1, burialFrozenBonus: 40,
        isAbility: false, isAbility2: false, isAbility3: false,
        abilityName: "Frostbite", abilityCd: 30,
        ability2Name: "Frozen Cascade", ability2Cd: 60,
        ability3Name: "Frozen Burial", ability3Cd: 90
    },
    abilityUnlocks: { 1: 3, 2: 7, 3: 10 },
    xpTable: [270, 690, 1500, 2790, 4920, 7770, 12480, 14070, 20430, 24570, 21600, 24975, 22410, 24570, 26730, 28890, 31050, 24705, 25920],
    levels: {
        1: [],
        2: [],
        3: [],
        4: [{ stat: "iceWalls", amount: true }],
        5: [],
        6: [],
        7: [{ stat: "arcticMoabSlow", amount: true }],
        8: [],
        9: [{ stat: "frostbiteDmg", amount: 5 }],
        10: [],
        11: [{ stat: "arcticSlow", amount: -0.05 }, { stat: "arcticMoabSlow2", amount: true }],
        12: [{ stat: "coldDmg", amount: 4 }, { stat: "iceWallLife", amount: 5 }],
        13: [],
        14: [],
        15: [{ stat: "frostbiteDur", amount: 4 }, { stat: "frostbiteDmg", amount: 10 }, { stat: "cascadeDmg", amount: 11 }, { stat: "cascadeFrozenBonus", amount: 15 }, { stat: "burialFrozenBonus", amount: 80 }],
        16: [{ stat: "coldDmg", amount: 5 }],
        17: [],
        18: [{ stat: "coldDmg", amount: 10 }, { stat: "arcticSlow", amount: -0.1 }],
        19: [],
        20: [{ stat: "iceWallCd", amount: -3 }, { stat: "frostbiteDmg", amount: 25 }]
    },
    _acquireOrbTarget(tower) {
        let best = null, bestVal = -Infinity;
        const mode = tower.targetingMode || 'First';
        for (const e of GameEngine.enemies) {
            if (!e.alive) continue;
            if (e.data.isLead && !e.leadStripped) continue;
            const d = Utils.distance(tower.x, tower.y, e.x, e.y);
            if (d > tower.stats.range + 20) continue;
            let val = 0;
            if (mode === 'First' || mode === 'Last') val = e.distanceTraveled;
            else if (mode === 'Strong') val = e.data.rbe;
            else val = -d;
            if (val > bestVal) { bestVal = val; best = e; }
        }
        return best;
    },
    update(tower, dt) {
        if (tower.orb === undefined) tower.orb = null;
        if (tower.launchCdTimer === undefined) tower.launchCdTimer = 0;
        if (tower.arcticTimer === undefined) tower.arcticTimer = 0;
        if (tower.wallTimer === undefined) tower.wallTimer = tower.stats.iceWallCd || 10;
        if (tower.walls === undefined) tower.walls = [];

        tower.launchCdTimer -= dt;
        if (tower.orb) {
            const orb = tower.orb;
            orb.life -= dt;
            if (orb.life <= 0) { tower.orb = null; }
            else if (orb.target && orb.target.alive) {
                const dx = orb.target.x - orb.x, dy = orb.target.y - orb.y;
                const dist = Math.hypot(dx, dy);
                const step = (tower.stats.orbSpeed || 320) * dt;
                if (dist <= step || dist < 12) {
                    this._orbHit(tower, orb);
                } else {
                    orb.x += (dx / dist) * step;
                    orb.y += (dy / dist) * step;
                }
            } else {
                tower.orb = null;
            }
        } else if (tower.launchCdTimer <= 0 && GameEngine.waveManager.waveActive) {
            tower.launchCdTimer = tower.stats.launchCd || 1.4;
            const target = this._acquireOrbTarget(tower);
            if (target) {
                tower.orb = { x: tower.x, y: tower.y - 15, target, life: tower.stats.orbLifespan || 2.5, pierceLeft: tower.stats.icePierce || 10 };
            }
        }

        tower.arcticTimer -= dt;
        if (tower.arcticTimer <= 0) {
            tower.arcticTimer = 0.5;
            this._arcticWind(tower);
        }

        tower.wallTimer -= dt;
        if (tower.stats.iceWalls && tower.wallTimer <= 0 && GameEngine.waveManager.waveActive) {
            tower.wallTimer = tower.stats.iceWallCd || 10;
            this._placeWall(tower);
        }

        for (let i = tower.walls.length - 1; i >= 0; i--) {
            const w = tower.walls[i];
            w.life -= dt;
            if (w.life <= 0) { tower.walls.splice(i, 1); continue; }
            const nearby = GameEngine.enemyGrid.query(w.x, w.y, 22, _silasScratch);
            for (const e of nearby) {
                if (!e.alive) continue;
                if (Utils.withinRange(w.x, w.y, e.x, e.y, 22)) {
                    const dur = e.data.isMoab ? 1 : 3;
                    e.applySlow(0.0, dur, true);
                }
            }
        }
    },
    _orbHit(tower, orb) {
        const target = orb.target;
        if (!target.alive) { tower.orb = null; return; }
        const coldDmgType = { isIce: true, canHitLead: true };
        if (target.silasRimed && !target.silasFrozen) {
            target.applySlow(0.0, tower.stats.freezeDur || 2.5, true);
            target.silasFrozen = true;
            const nearby = GameEngine.enemyGrid.query(target.x, target.y, tower.stats.coldRadius, _silasScratch);
            let hits = 0;
            for (const e of nearby) {
                if (!e.alive || hits >= tower.stats.coldPierce) continue;
                if (Utils.withinRange(target.x, target.y, e.x, e.y, tower.stats.coldRadius)) {
                    let dmg = tower.stats.coldDmg || 1;
                    if (e.isFrozen) dmg += 1;
                    e.takeDamage(dmg, coldDmgType, {}, tower);
                    hits++;
                }
            }
            GameEngine.explosions.push({ x: target.x, y: target.y, radius: 0, maxRadius: tower.stats.coldRadius, life: 0.3, maxLife: 0.3, color: '#aee6ff' });
            AudioEngine.playSfx('pop');
        } else if (!target.silasRimed) {
            let factor = tower.stats.rimeSlow || 0.5;
            if (target.data.isMoab && tower.stats.arcticMoabSlow) factor = Math.min(factor, 0.3);
            target.applySlow(factor, tower.stats.freezeDur || 2.5, true);
            target.silasRimed = true;
        }
        orb.pierceLeft--;
        if (orb.pierceLeft <= 0) { tower.orb = null; return; }
        let next = null, bestDist = Infinity;
        for (const e of GameEngine.enemies) {
            if (!e.alive || e === target) continue;
            if (e.data.isLead && !e.leadStripped) continue;
            const d = Utils.distance(orb.x, orb.y, e.x, e.y);
            if (d < bestDist && d < tower.stats.range + 20) { bestDist = d; next = e; }
        }
        orb.target = next || null;
    },
    _arcticWind(tower) {
        const factor = tower.stats.arcticSlow || 0.85;
        const moabFactor = Math.max(0.8, factor + 0.1);
        const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, 30, _silasScratch);
        for (const e of nearby) {
            if (!e.alive) continue;
            if (Utils.withinRange(tower.x, tower.y, e.x, e.y, 30)) {
                e.applySlow(e.data.isMoab ? moabFactor : factor, 0.6, true);
            }
        }
    },
    _placeWall(tower) {
        let best = null, bestDist = Infinity;
        for (const e of GameEngine.enemies) {
            if (!e.alive) continue;
            const d = Utils.distance(tower.x, tower.y, e.x, e.y);
            if (d < bestDist && d < 45) { bestDist = d; best = e; }
        }
        let x = tower.x, y = tower.y;
        if (best) {
            const pos = GameEngine.map.getPositionAtDistance(Math.max(0, best.distanceTraveled - 40), best.pathIndex);
            if (pos && !pos.finished) { x = pos.x; y = pos.y; }
        }
        if (tower.walls.length > 6) tower.walls.shift();
        tower.walls.push({ x, y, life: tower.stats.iceWallLife || 15 });
    },
    draw(ctx, tower, isPreview) {
        if (!isPreview && tower.orb) {
            const orb = tower.orb;
            ctx.fillStyle = '#aee6ff';
            ctx.globalAlpha = 0.9;
            ctx.beginPath(); ctx.arc(orb.x, orb.y, 8, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#ecf0f1';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(orb.x, orb.y, 12, 0, Math.PI * 2); ctx.stroke();
        }
        if (!isPreview && tower.walls) {
            for (const w of tower.walls) {
                ctx.fillStyle = 'rgba(174,230,255,0.7)';
                ctx.fillRect(w.x - 12, w.y - 3, 24, 6);
            }
        }
        tower.drawBaseTower(ctx, isPreview);
    },
    ability(tower, engine) {
        const dmg = tower.stats.frostbiteDmg || 10;
        const dur = tower.stats.frostbiteDur || 8;
        const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, tower.stats.range, _silasScratch);
        for (const e of nearby) {
            if (!e.alive) continue;
            if (Utils.withinRange(tower.x, tower.y, e.x, e.y, tower.stats.range)) {
                e.takeDamage(dmg, { isIce: true, canHitLead: true }, {}, tower);
                e.applySlow(0.0, e.data.isMoab ? Math.min(2, dur / 4) : dur, true);
            }
        }
        engine.log("Silas: Frostbite!");
    },
    ability2(tower, engine) {
        const level = tower.level;
        const dmg = level >= 15 ? (tower.stats.cascadeDmg || 23) : (tower.stats.cascadeDmg || 12);
        const frozenBonus = level >= 15 ? 23 : (tower.stats.cascadeFrozenBonus || 8);
        const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, 40, _silasScratch);
        let hits = 0;
        for (const e of nearby) {
            if (!e.alive || hits >= 45) continue;
            if (Utils.withinRange(tower.x, tower.y, e.x, e.y, 40)) {
                let d = dmg;
                if (e.isFrozen) d += frozenBonus;
                e.takeDamage(d, { isShatter: true, canHitLead: true }, {}, tower);
                if (!e.data.isMoab) e.applySlow(0.0, 9, true);
                hits++;
            }
        }
        GameEngine.explosions.push({ x: tower.x, y: tower.y, radius: 0, maxRadius: 40, life: 0.5, maxLife: 0.5, color: '#aee6ff' });
        engine.log("Silas: Frozen Cascade!");
    },
    ability3(tower, engine) {
        const level = tower.level;
        const dmg = tower.stats.burialDmg || 1;
        const frozenBonus = level >= 15 ? (tower.stats.burialFrozenBonus || 120) : (tower.stats.burialFrozenBonus || 40);
        for (const e of GameEngine.enemies) {
            if (!e.alive) continue;
            let d = dmg;
            if (e.isFrozen) d += frozenBonus;
            e.takeDamage(d, { isIce: true, canHitLead: true }, {}, tower);
            e.applySlow(0.0, e.data.isMoab ? 3 : 6, true);
        }
        for (let p = 0; p < GameEngine.map.paths.length; p++) {
            const totalLen = GameEngine.map.paths[p].totalLength;
            for (let i = 0; i < 5; i++) {
                const pos = GameEngine.map.getPositionAtDistance(totalLen * (i / 5), p);
                if (pos && !pos.finished) {
                    if (tower.walls.length > 6) tower.walls.shift();
                    tower.walls.push({ x: pos.x, y: pos.y, life: tower.stats.iceWallLife || 15 });
                }
            }
        }
        engine.log("Silas: Frozen Burial!");
    }
};
