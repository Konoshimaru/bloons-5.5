// js/heroes/psi.js
// Psi - Psionic Monkey
// No projectiles: applies "vibration" tick damage to a target anywhere on the
// map. Cannot target certain Bloon classes until later levels. Split the Mind
// adds extra concurrent vibration attacks; Destructive Resonance explodes on
// popped Bloons; Psychic Blast stuns; Psionic Scream vibrates or blows back.

import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { AudioEngine } from '../audio.js';

const _blastScratch = [];

export default {
    stats: {
        name: "Psi", cost: 1000, range: 9999, fireRate: 0, damage: 0,
        hitRadius: 18, scale: 1.3,
        desc: "Psionic monkey with infinite-range psychic vibrations. Destroys Bloons without spawning children.",
        dmgType: 'magic', isHero: true, maxLevel: 20,
        canSeeCamo: true,
        psiTick: 1, tickRate: 0.2, psiCd: 1,
        attacks: 1, splashPierce: 0, splashRadius: 6,
        resonanceDmg: 0, resonancePierce: 10,
        canTargetLead: false, canTargetCeramic: false, canTargetPurple: false,
        canTargetMoab: false, canTargetBfb: false, canTargetDdtZomg: false,
        isAbility: false, isAbility2: false,
        abilityName: "Psychic Blast", abilityCd: 45,
        ability2Name: "Psionic Scream", ability2Cd: 60
    },
    abilityUnlocks: { 1: 3, 2: 10 },
    xpTable: [270, 690, 1500, 2790, 4920, 7770, 12480, 14070, 20430, 24570, 21600, 24975, 22410, 24570, 26730, 28890, 31050, 24705, 25920],
    levels: {
        1: [],
        2: [{ stat: "tickRate", amount: -0.05 }],
        3: [],
        4: [{ stat: "splashPierce", amount: 1 }, { stat: "splashRadius", amount: 6 }],
        5: [{ stat: "psiCd", amount: -0.15 }],
        6: [{ stat: "canTargetLead", amount: true }],
        7: [{ stat: "canTargetCeramic", amount: true }, { stat: "splashPierce", amount: 1 }],
        8: [{ stat: "resonanceDmg", amount: 1 }],
        9: [{ stat: "attacks", amount: 1 }],
        10: [],
        11: [{ stat: "canTargetPurple", amount: true }, { stat: "resonanceHitsPurple", amount: true }],
        12: [{ stat: "blastPulses", amount: 1 }],
        13: [{ stat: "tickRate", amount: -0.05 }, { stat: "splashPierce", amount: 1 }],
        14: [{ stat: "canTargetMoab", amount: true }, { stat: "psiTick", amount: 3 }],
        15: [{ stat: "resonanceDmg", amount: 2 }],
        16: [{ stat: "canTargetBfb", amount: true }, { stat: "tickRate", amount: -0.025 }],
        17: [{ stat: "attacks", amount: 1 }],
        18: [{ stat: "splashPierce", amount: 2 }, { stat: "splashRadius", amount: 9 }],
        19: [{ stat: "resonanceDmg", amount: 7 }],
        20: [{ stat: "canTargetDdtZomg", amount: true }, { stat: "screamAlwaysVibrate", amount: true }]
    },
    _canTarget(e, tower) {
        if (!e.alive) return false;
        if (e.data.isBAD) return false;
        if (e.data.isMoab) {
            if (e.data.isDDT) return !!tower.stats.canTargetDdtZomg;
            if (e.tier === 15) return !!tower.stats.canTargetDdtZomg; // ZOMG
            if (e.tier === 14) return !!tower.stats.canTargetBfb;     // BFB
            return !!tower.stats.canTargetMoab;                        // MOAB
        }
        if (e.data.isCeramic) return !!tower.stats.canTargetCeramic;
        if (e.data.isPurple) return !!tower.stats.canTargetPurple;
        if (e.data.isLead) return !!tower.stats.canTargetLead;
        return true;
    },
    _acquireTarget(tower) {
        const targets = [];
        const candidates = [];
        for (const e of GameEngine.enemies) {
            if (!e.alive || !this._canTarget(e, tower)) continue;
            candidates.push(e);
        }
        if (candidates.length === 0) return;
        const n = tower.stats.attacks || 1;
        for (let i = 0; i < n; i++) {
            let best = null, bestVal = -Infinity;
            const mode = i > 0 ? 'First' : (tower.targetingMode || 'First');
            for (const e of candidates) {
                if (targets.includes(e)) continue;
                let val;
                if (mode === 'First' || mode === 'Last') val = e.distanceTraveled;
                else if (mode === 'Strong') val = e.data.rbe;
                else val = -Utils.distance(tower.x, tower.y, e.x, e.y);
                if (val > bestVal) { bestVal = val; best = e; }
            }
            if (best) targets.push(best);
        }
        tower.psiTargets = targets;
    },
    update(tower, dt) {
        if (tower.psiCdTimer === undefined) tower.psiCdTimer = 0;
        tower.psiCdTimer -= dt;
        if (tower.psiCdTimer <= 0) {
            tower.psiCdTimer = tower.stats.psiCd || 1;
            this._acquireTarget(tower);
        }

        if (tower.psiTickTimer === undefined) tower.psiTickTimer = 0;
        tower.psiTickTimer -= dt;
        if (tower.psiTickTimer <= 0) {
            tower.psiTickTimer = tower.stats.tickRate || 0.2;
            this._applyTick(tower);
        }

        if (tower.blastPulses && tower.blastPulses.length > 0) {
            for (let i = tower.blastPulses.length - 1; i >= 0; i--) {
                tower.blastPulses[i] -= dt;
                if (tower.blastPulses[i] <= 0) {
                    tower.blastPulses.splice(i, 1);
                    this._doBlast(tower);
                }
            }
        }
    },
    _applyTick(tower) {
        const dmgType = { isMagic: true, canHitLead: true };
        if (tower.stats.canTargetPurple) dmgType.canHitPurple = true;
        if (tower.psiTargets) {
            for (const t of tower.psiTargets) {
                if (!t.alive) continue;
                let dmg = tower.stats.psiTick || 1;
                if (t.data.isCeramic && t.isSuperCeramic && tower.level >= 14) dmg = Math.max(1, Math.floor(dmg / 2));
                const dealt = t.takeDamage(dmg, dmgType, {}, tower);
                if (dealt > 0) tower.damageDealt += dealt;
                if (!t.alive && tower.stats.resonanceDmg > 0) this._doResonance(tower, t);

                if (tower.stats.splashPierce > 0) {
                    const splash = GameEngine.enemyGrid.query(t.x, t.y, tower.stats.splashRadius + 20, _blastScratch);
                    let hits = 0;
                    for (const e of splash) {
                        if (!e.alive || e === t || hits >= tower.stats.splashPierce) continue;
                        if (e.data.isMoab) continue;
                        if (Utils.withinRange(t.x, t.y, e.x, e.y, tower.stats.splashRadius)) {
                            if (!this._canTarget(e, tower)) continue;
                            e.takeDamage(dmg, dmgType, {}, tower);
                            hits++;
                        }
                    }
                }
            }
        }
        AudioEngine.playSfx('pop');
    },
    _doResonance(tower, dead) {
        const dmg = tower.stats.resonanceDmg || 1;
        const pierce = tower.stats.resonancePierce || 10;
        const nearby = GameEngine.enemyGrid.query(dead.x, dead.y, 20, _blastScratch);
        let hits = 0;
        for (const e of nearby) {
            if (!e.alive || hits >= pierce) continue;
            if (e.data.isPurple && !tower.stats.resonanceHitsPurple) continue;
            if (Utils.withinRange(dead.x, dead.y, e.x, e.y, 20)) {
                const dmgType = { isMagic: true, canHitLead: true };
                if (tower.stats.resonanceHitsPurple) dmgType.canHitPurple = true;
                e.takeDamage(dmg, dmgType, {}, tower);
                hits++;
            }
        }
    },
    _doBlast(tower) {
        const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, 60, _blastScratch);
        let hits = 0;
        for (const e of nearby) {
            if (!e.alive || hits >= 200) continue;
            if (!Utils.withinRange(tower.x, tower.y, e.x, e.y, 60)) continue;
            const dur = e.data.isMoab ? 1.5 : 6;
            e.applySlow(0.0, dur, false);
            hits++;
        }
        GameEngine.explosions.push({ x: tower.x, y: tower.y, radius: 0, maxRadius: 60, life: 0.5, maxLife: 0.5, color: '#9b59b6' });
    },
    draw(ctx, tower, isPreview) {
        if (!isPreview && tower.psiTargets) {
            const t = tower.psiTargets[0];
            if (t && t.alive) {
                ctx.globalAlpha = 0.4 + 0.3 * Math.sin(performance.now() / 150);
                ctx.strokeStyle = '#9b59b6';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(tower.x, tower.y - 20);
                ctx.lineTo(t.x, t.y);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalAlpha = 1;
            }
        }
        tower.drawBaseTower(ctx, isPreview);
    },
    ability(tower, engine) {
        let pulses = 1 + (tower.stats.blastPulses || 0);
        tower.blastPulses = [];
        for (let i = 0; i < pulses; i++) tower.blastPulses.push(i * 2);
        engine.log("Psi: Psychic Blast!");
    },
    ability2(tower, engine) {
        const onScreen = GameEngine.enemies
            .filter(e => e.alive)
            .sort((a, b) => Utils.distance(tower.x, tower.y, a.x, a.y) - Utils.distance(tower.x, tower.y, b.x, b.y))
            .slice(0, 2000);
        const dmgType = { isMagic: true, canHitLead: true };
        if (tower.stats.canTargetPurple) dmgType.canHitPurple = true;
        for (const e of onScreen) {
            if (!this._canTarget(e, tower)) continue;
            if (tower.stats.screamAlwaysVibrate || Math.random() < 0.5) {
                e.takeDamage(tower.stats.psiTick || 1, dmgType, {}, tower);
            } else {
                const kb = 100 + Math.random() * 150;
                if (e.data.isMoab) {
                    e.distanceTraveled = Math.max(0, e.distanceTraveled - kb * 0.2);
                } else {
                    e.distanceTraveled = Math.max(0, e.distanceTraveled - kb);
                }
            }
        }
        engine.log("Psi: Psionic Scream!");
    }
};
