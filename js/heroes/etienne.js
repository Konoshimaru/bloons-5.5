// js/heroes/etienne.js
// Etienne - Drone Operator
// Does not attack directly: commands up to 4 drone sub-towers that fire sharp
// darts. Provides a range buff to nearby towers, camo detection (self + drones
// at L5), and global camo detection for all towers at L8 (UAV).

import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { AudioEngine } from '../audio.js';

export default {
    stats: {
        name: "Etienne", cost: 650, range: 55, fireRate: 0.7, damage: 1,
        projectileSpeed: 250, pierce: 2, lifespan: 1.4, hitRadius: 18, scale: 1.3,
        desc: "Commands drone sub-towers that fire sharp darts. Buffs nearby tower range and grants global camo at level 8.",
        dmgType: 'sharp', projectileType: 'dart', isHero: true, maxLevel: 20,
        canSeeCamo: false,
        droneCount: 1, rangeBuff: 0.1,
        isAbility: false, isAbility2: false,
        abilityName: "Drone Swarm", abilityCd: 80,
        ability2Name: "UCAV", ability2Cd: 90,
        ucavDmg: 2, ucavPierce: 25, ucavDur: 12
    },
    abilityUnlocks: { 1: 3, 2: 10 },
    xpTable: [180, 460, 1000, 1860, 3280, 5180, 8320, 9380, 13620, 16380, 14400, 16650, 14940, 16380, 17820, 19260, 20700, 16470, 17280],
    levels: {
        1: [],
        2: [{ stat: "range", amount: 5 }, { stat: "rangeBuff", amount: 0.1 }],
        3: [],
        4: [{ stat: "pierce", amount: 1 }],
        5: [{ stat: "fireRate", amount: -0.15 }, { stat: "canSeeCamo", amount: true }],
        6: [{ stat: "abilityCd", amount: -25 }],
        7: [{ stat: "droneCount", amount: 1 }],
        8: [{ stat: "uavCamo", amount: true }],
        9: [{ stat: "damage", amount: 1 }],
        10: [],
        11: [{ stat: "droneCount", amount: 1 }],
        12: [{ stat: "pierce", amount: 3 }],
        13: [{ stat: "ability2Cd", amount: -15 }],
        14: [{ stat: "damage", amount: 1 }],
        15: [{ stat: "ucavDmg", amount: 2 }, { stat: "ucavPierce", amount: 5 }, { stat: "ucavDur", amount: 8 }],
        16: [{ stat: "pierce", amount: 3 }, { stat: "range", amount: 20 }, { stat: "abilityCd", amount: -5 }, { stat: "rangeBuff", amount: 0.1 }],
        17: [{ stat: "ucavDmg", amount: 3 }],
        18: [{ stat: "damage", amount: 1 }],
        19: [{ stat: "droneCount", amount: 1 }],
        20: [{ stat: "permaUcav", amount: true }]
    },
    _getDroneCount(tower) {
        let count = tower.stats.droneCount || 1;
        if (tower.droneSwarmTimer !== undefined && tower.droneSwarmTimer > 0) count += 4;
        return count;
    },
    update(tower, dt) {
        if (tower.droneSwarmTimer !== undefined && tower.droneSwarmTimer > 0) tower.droneSwarmTimer -= dt;
        if (tower.ucavTimer !== undefined && tower.ucavTimer > 0) {
            tower.ucavTimer -= dt;
            tower.ucavVolleyTimer = (tower.ucavVolleyTimer || 0) - dt;
            if (tower.ucavVolleyTimer <= 0) {
                tower.ucavVolleyTimer = 0.6;
                this._fireUcavVolley(tower);
            }
        }
        if (tower.droneAngle === undefined) tower.droneAngle = 0;
        tower.droneAngle += dt * 2;

        const rb = tower.stats.rangeBuff || 0;
        for (const t of GameEngine.towers) {
            if (!t || t.isMinion || t === tower) continue;
            if (rb > 0 && Utils.withinRange(tower.x, tower.y, t.x, t.y, tower.stats.range)) {
                t.addBuff('drone_range', 'Drone Range', 0.5, 1, { type: 'drone_range' }, false);
                t.buffedRange = Math.max(t.buffedRange || 0, rb);
            }
            if (tower.stats.uavCamo) t.buffedCamo = true;
        }
    },
    _fireUcavVolley(tower) {
        if (!GameEngine.waveManager.waveActive) return;
        const activeDmg = tower.ucavActiveDmg || (tower.stats.ucavDmg || 2);
        const pierce = tower.stats.ucavPierce || 25;
        let targets = [];
        for (const e of GameEngine.enemies) {
            if (!e.alive) continue;
            targets.push(e);
            if (targets.length >= 10) break;
        }
        if (targets.length === 0) return;
        for (let i = 0; i < 10 && targets.length > 0; i++) {
            const tgt = targets[i % targets.length];
            const p = GameEngine.projectilePool.get();
            p.init(tower.x, tower.y, activeDmg, tgt, 'dart', 900, pierce, 1.5, null,
                { isExplosive: true, explosionRadius: 20, explosionDamage: activeDmg, explosionPierce: pierce, canHitLead: true },
                (Math.random() - 0.5) * 20, tower, { isExplosion: true, canHitLead: true });
        }
        AudioEngine.playSfx('shoot');
    },
    draw(ctx, tower, isPreview) {
        if (!isPreview) {
            const count = this._getDroneCount(tower);
            for (let i = 0; i < count; i++) {
                const a = tower.droneAngle + (i / count) * Math.PI * 2;
                const dx = tower.x + Math.cos(a) * 22;
                const dy = tower.y + Math.sin(a) * 22 - 12;
                ctx.fillStyle = '#95a5a6';
                ctx.beginPath(); ctx.arc(dx, dy, 6, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#3498db';
                ctx.beginPath(); ctx.arc(dx, dy, 3, 0, Math.PI * 2); ctx.fill();
            }
        }
        tower.drawBaseTower(ctx, isPreview);
    },
    ability(tower, engine) {
        tower.droneSwarmTimer = 18.5 + 0.5 * tower.level;
        engine.log("Etienne: Drone Swarm!");
    },
    ability2(tower, engine) {
        const level = tower.level;
        let dmg = 2, pierce = 25, dur = 12;
        if (level >= 15) { dmg = 4; pierce = 30; dur = 20; }
        if (level >= 17) dmg = 7;
        if (tower.stats.permaUcav) { dmg = 2; pierce = 30; dur = 999999; }
        tower.ucavTimer = dur;
        tower.ucavActiveDmg = dmg;
        tower.ucavVolleyTimer = 0;
        engine.log("Etienne: UCAV deployed!");
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        if (!target) return;
        const count = this._getDroneCount(tower);
        const pierce = tower.stats.pierce;
        for (let i = 0; i < count; i++) {
            const a = tower.droneAngle + (i / count) * Math.PI * 2;
            const dx = tower.x + Math.cos(a) * 22;
            const dy = tower.y + Math.sin(a) * 22 - 12;
            const p = GameEngine.projectilePool.get();
            p.init(dx, dy, damage, target, 'dart', tower.stats.projectileSpeed, pierce, tower.stats.lifespan, null, null, 0, tower, dmgType);
            p.isCrit = isCrit;
        }
    }
};
