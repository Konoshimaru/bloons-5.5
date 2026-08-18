// js/heroes/rosalia.js
// Rosalia - Tinkerer
// Dual weapons: laser (straight projectile) and grenade launcher (explosive).
// Every 10th attack per weapon is an Enhanced shot. Passives: Adrenaline Rush
// attack-speed scaling with nearby Bloons. Abilities: Scatter Missile,
// Flight Boost, Kinetic Charge.

import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { AudioEngine } from '../audio.js';

const _rosaliaScratch = [];

export default {
    stats: {
        name: "Rosalia", cost: 875, range: 40, fireRate: 1.0, damage: 3,
        projectileSpeed: 900, pierce: 3, lifespan: 0.8, hitRadius: 18, scale: 1.3,
        desc: "Tinkerer wielding a laser and grenade launcher. Fires enhanced shots and commands missile/drone abilities.",
        dmgType: 'plasma', projectileType: 'dart', isHero: true, maxLevel: 20,
        canSeeCamo: false,
        laserMoabDmg: 0,
        grenadeUnlocked: false, grenadeDmg: 2, grenadeCeramicDmg: 1, grenadePierce: 10, grenadeRadius: 15, grenadeBounce: 0,
        adrenalineMax: 0,
        isAbility: false, isAbility2: false, isAbility3: false,
        abilityName: "Scatter Missile", abilityCd: 45,
        ability2Name: "Flight Boost", ability2Cd: 45,
        ability3Name: "Kinetic Charge", ability3Cd: 75,
        scatterDmg: 5, scatterPierce: 30, scatterDur: 5, scatterMoabDmg: 0
    },
    abilityUnlocks: { 1: 3, 2: 7, 3: 10 },
    xpTable: [257, 656, 1425, 2651, 4674, 7382, 11856, 13367, 19409, 23342, 20520, 23726, 21290, 23342, 25394, 27446, 29498, 23470, 24624],
    levels: {
        1: [],
        2: [{ stat: "grenadeUnlocked", amount: true }],
        3: [],
        4: [{ stat: "adrenalineMax", amount: 0.25 }],
        5: [{ stat: "damage", amount: 2 }, { stat: "pierce", amount: 3 }, { stat: "grenadeBounce", amount: 3 }],
        6: [],
        7: [],
        8: [{ stat: "laserMoabDmg", amount: 5 }, { stat: "grenadeDmg", amount: 1 }],
        9: [{ stat: "scatterDur", amount: 2.5 }],
        10: [],
        11: [{ stat: "adrenalineMax", amount: 0.15 }],
        12: [{ stat: "damage", amount: 5 }, { stat: "laserMoabDmg", amount: 5 }, { stat: "grenadeBounce", amount: 1 }],
        13: [{ stat: "pierce", amount: 4 }, { stat: "laserPlasma", amount: true }, { stat: "grenadeDmg", amount: 1 }, { stat: "grenadeCeramicDmg", amount: 1 }, { stat: "grenadeCluster", amount: 3 }, { stat: "enhancedGrenadeCount", amount: 4 }],
        14: [{ stat: "scatterDmg", amount: 5 }, { stat: "scatterMoabDmg", amount: 5 }],
        15: [{ stat: "laserMoabDmg", amount: 20 }, { stat: "grenadeCeramicDmg", amount: 4 }, { stat: "clusterCeramicDmg", amount: 4 }],
        16: [{ stat: "ability3Cd", amount: -15 }, { stat: "abilityCd", amount: -15 }],
        17: [{ stat: "adrenalineMax", amount: 0.2 }],
        18: [{ stat: "ability2Cd", amount: -10 }],
        19: [{ stat: "damage", amount: 5 }, { stat: "laserMoabDmg", amount: 15 }, { stat: "grenadeCluster", amount: 2 }],
        20: [{ stat: "scatterTriple", amount: true }]
    },
    update(tower, dt) {
        if (tower.flightBoostTimer !== undefined && tower.flightBoostTimer > 0) tower.flightBoostTimer -= dt;
        if (tower.scatterTimer !== undefined && tower.scatterTimer > 0) {
            tower.scatterTimer -= dt;
            tower.scatterTick = (tower.scatterTick || 0) - dt;
            if (tower.scatterTick <= 0) {
                tower.scatterTick = tower.stats.scatterTriple ? 0.0833 : 0.25;
                this._fireScatter(tower);
            }
        }
        if (tower.kinetic) {
            const k = tower.kinetic;
            if (!k.target || !k.target.alive || !k.target.data.isMoab) {
                this._explodeKinetic(tower, k);
                tower.kinetic = null;
            } else {
                k.x = k.target.x;
                k.y = k.target.y;
                k.timer -= dt;
                if (k.timer <= 0) {
                    this._explodeKinetic(tower, k);
                    tower.kinetic = null;
                }
            }
        }

        const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, tower.stats.range, _rosaliaScratch);
        let count = 0;
        for (const e of nearby) {
            if (e.alive && Utils.withinRange(tower.x, tower.y, e.x, e.y, tower.stats.range)) count++;
        }
        const max = tower.stats.adrenalineMax || 0;
        if (max > 0) {
            tower.buffedFireRate = Math.max(tower.buffedFireRate || 0, Math.min(max, count / 2 * 0.01 + (tower.flightBoostTimer > 0 ? 0.3 : 0)));
        } else if (tower.flightBoostTimer > 0) {
            tower.buffedFireRate = Math.max(tower.buffedFireRate || 0, 0.3);
        }
    },
    _fireScatter(tower) {
        if (!GameEngine.waveManager.waveActive) return;
        let best = null, bestDist = Infinity;
        for (const e of GameEngine.enemies) {
            if (!e.alive) continue;
            const d = Utils.distance(tower.x, tower.y, e.x, e.y);
            if (d < bestDist) { bestDist = d; best = e; }
        }
        if (!best) return;
        const dmg = tower.stats.scatterDmg || 5;
        const moabDmg = tower.stats.scatterMoabDmg || 0;
        const dmgType = { isExplosion: true, canHitLead: true };
        const nearby = GameEngine.enemyGrid.query(best.x, best.y, 35, _rosaliaScratch);
        let hits = 0;
        for (const e of nearby) {
            if (!e.alive || hits >= (tower.stats.scatterPierce || 30)) continue;
            if (!Utils.withinRange(best.x, best.y, e.x, e.y, 35)) continue;
            let d = dmg;
            if (e.data.isMoab) d += moabDmg;
            const fx = {};
            if (!e.data.isMoab) fx.stun = 1;
            e.takeDamage(d, dmgType, fx, tower);
            hits++;
        }
        GameEngine.explosions.push({ x: best.x, y: best.y, radius: 0, maxRadius: 18, life: 0.3, maxLife: 0.3, color: '#e67e22' });
    },
    _explodeKinetic(tower, k) {
        const nearby = GameEngine.enemyGrid.query(k.x, k.y, 50, _rosaliaScratch);
        let hits = 0;
        for (const e of nearby) {
            if (!e.alive || hits >= 500) continue;
            if (Utils.withinRange(k.x, k.y, e.x, e.y, 50)) {
                e.takeDamage(k.dmg, { isExplosion: true, canHitLead: true }, {}, tower);
                hits++;
            }
        }
        GameEngine.explosions.push({ x: k.x, y: k.y, radius: 0, maxRadius: 50, life: 0.5, maxLife: 0.5, color: '#f39c12' });
        AudioEngine.playSfx('moab_destroy');
    },
    draw(ctx, tower, isPreview) {
        if (!isPreview && tower.kinetic && tower.kinetic.target && tower.kinetic.target.alive) {
            const t = tower.kinetic.target;
            ctx.strokeStyle = '#f39c12';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.arc(t.x, t.y, 18, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
        }
        tower.drawBaseTower(ctx, isPreview);
    },
    ability(tower, engine) {
        tower.scatterTimer = tower.stats.scatterDur || 5;
        tower.scatterTick = 0;
        engine.log("Rosalia: Scatter Missile!");
    },
    ability2(tower, engine) {
        tower.flightBoostTimer = 20;
        tower.addBuff('flight_boost', 'Flight Boost', 20, 1, { type: 'flight_boost' }, false);
        engine.log("Rosalia: Flight Boost!");
    },
    ability3(tower, engine) {
        let best = null, bestVal = -Infinity;
        for (const e of GameEngine.enemies) {
            if (!e.alive || !e.data.isMoab) continue;
            if (e.data.rbe > bestVal) { bestVal = e.data.rbe; best = e; }
        }
        if (best) {
            tower.kinetic = { target: best, x: best.x, y: best.y, timer: 10, dmg: tower.level >= 20 ? 4000 : 1500 };
        } else {
            engine.log("Rosalia: No MOAB to target for Kinetic Charge.");
            return;
        }
        engine.log("Rosalia: Kinetic Charge!");
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        if (!target) return;
        if (tower.laserShots === undefined) tower.laserShots = 0;
        if (tower.grenadeShots === undefined) tower.grenadeShots = 0;

        tower.laserShots++;
        let laserDmg = damage;
        if (tower.stats.laserMoabDmg && target.data.isMoab) laserDmg += tower.stats.laserMoabDmg;
        const isEnhanced = tower.laserShots % 10 === 0;
        const laserPierce = isEnhanced ? 12 : tower.stats.pierce;
        const laserDmgType = { ...dmgType, canHitLead: true };
        const eff = { ...effects };
        if (isEnhanced) {
            laserDmg = 25;
            eff.dot = 3;
            eff.dotTimer = 1.0; // enhanced laser burn ticks once per second
            if (target.rosaliaShocked) laserDmg += 25;
            target.rosaliaShocked = true;
            eff.knockback = 10;
        }
        const p = GameEngine.projectilePool.get();
        p.init(tower.x, tower.y, laserDmg, target, 'dart', tower.stats.projectileSpeed, laserPierce, tower.stats.lifespan, null, eff, 0, tower, laserDmgType);
        p.isCrit = isCrit;

        if (tower.stats.grenadeUnlocked) {
            tower.grenadeShots++;
            const gIsEnhanced = tower.grenadeShots % 10 === 0;
            const count = gIsEnhanced ? (tower.stats.enhancedGrenadeCount || 3) : 1;
            for (let i = 0; i < count; i++) {
                const spread = count === 1 ? 0 : (i - (count - 1) / 2) * 15;
                const gp = GameEngine.projectilePool.get();
                let gDmg = tower.stats.grenadeDmg || 2;
                const gEff = {
                    isExplosive: true,
                    explosionRadius: tower.stats.grenadeRadius || 15,
                    explosionDamage: gDmg,
                    explosionPierce: tower.stats.grenadePierce || 10,
                    canHitLead: true,
                    ceramicDmg: tower.stats.grenadeCeramicDmg || 1
                };
                if (tower.stats.grenadeCluster) {
                    gEff.clusterCount = tower.stats.grenadeCluster;
                    gEff.clusterDamage = gDmg;
                    gEff.clusterCeramicDmg = tower.stats.clusterCeramicDmg || 0;
                }
                gp.init(tower.x, tower.y, gDmg, target, 'bomb', tower.stats.projectileSpeed * 0.7, tower.stats.grenadePierce || 10, 1.0, null, gEff, spread, tower, { isExplosion: true, canHitLead: true });
                gp.isCrit = isCrit;
            }
        }
    }
};
