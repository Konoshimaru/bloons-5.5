// js/heroes/corvus.js
// Corvus - Spirit Walker
// Commands a flying Spirit sub-tower that swoops and swipes Bloons anywhere on
// the map. Mana system, Haunt debuff, Spiritual Balance/Attunement passives and
// three activated abilities (Soul Harvest, Spirit Walk, Dark Ritual). The full
// 16-spell Spellbook is approximated - the Spirit's swipe serves as his core
// offense.

import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { AudioEngine } from '../audio.js';

const _corvusScratch = [];

export default {
    stats: {
        name: "Corvus", cost: 1325, range: 40, fireRate: 0, damage: 0,
        hitRadius: 18, scale: 1.3,
        desc: "Spirit walker whose flying Spirit swipes Bloons across the map. Commands mana and the Haunt debuff.",
        dmgType: 'magic', isHero: true, maxLevel: 20,
        canSeeCamo: false,
        spiritDmg: 1, spiritPierce: 4, spiritSpeed: 100,
        spiritMoabDmg: 0,
        manaMax: 800, manaRegen: 2,
        hauntRange: 40, hauntPierce: 4, hauntDmg: 2, hauntRadius: 24,
        isAbility: false, isAbility2: false, isAbility3: false,
        abilityName: "Soul Harvest", abilityCd: 40,
        ability2Name: "Spirit Walk", ability2Cd: 20,
        ability3Name: "Dark Ritual", ability3Cd: 90
    },
    abilityUnlocks: { 1: 3, 2: 7, 3: 10 },
    xpTable: [257, 656, 1425, 2651, 4674, 7382, 11856, 13367, 19409, 23342, 20520, 23726, 21290, 23342, 25394, 27446, 29498, 23470, 24624],
    levels: {
        1: [],
        2: [{ stat: "spiritPierce", amount: 2 }],
        3: [],
        4: [{ stat: "spiritDmg", amount: 1 }],
        5: [],
        6: [{ stat: "spiritDmg", amount: 1 }, { stat: "hauntPierce", amount: 4 }, { stat: "hauntDmg", amount: 2 }],
        7: [],
        8: [{ stat: "spiritualBalance", amount: true }],
        9: [{ stat: "spiritDmg", amount: 2 }, { stat: "spiritMoabDmg", amount: 1 }],
        10: [],
        11: [{ stat: "spiritualAttunement", amount: true }],
        12: [{ stat: "hauntPierce", amount: 8 }, { stat: "hauntDmg", amount: 6 }],
        13: [],
        14: [{ stat: "spiritDmg", amount: 5 }, { stat: "spiritMoabDmg", amount: 4 }],
        15: [],
        16: [{ stat: "spiritDmg", amount: 10 }],
        17: [{ stat: "hauntBonusDmg", amount: 2 }, { stat: "hauntExplosionDmg", amount: 20 }],
        18: [],
        19: [{ stat: "hauntMoab", amount: true }],
        20: [{ stat: "spiritDmg", amount: 20 }, { stat: "spiritMoabDmg", amount: 5 }]
    },
    _eligible(e, tower) {
        if (!e.alive) return false;
        if (e.data.isLead || e.data.isPurple) return false;
        if (e.isCamo && !tower.stats.canSeeCamo) return false;
        return true;
    },
    _manaRatio(tower) {
        return Math.max(0, Math.min(1, tower.mana / (tower.stats.manaMax || 800)));
    },
    _spiritMult(tower) {
        let dmgMult = 1, speedMult = 1;
        if (tower.stats.spiritualAttunement) {
            const r = this._manaRatio(tower);
            speedMult = 1 + 0.2 * r;
            dmgMult = 1 + 1.5 * r;
        }
        return { dmgMult, speedMult };
    },
    update(tower, dt) {
        if (tower.mana === undefined) {
            tower.mana = 0;
            tower.spirit = { x: tower.x, y: tower.y, target: null, cooldown: 0 };
            tower.hauntTimer = 0;
        }

        if (GameEngine.waveManager.waveActive) {
            let regen = tower.stats.manaRegen || 2;
            if (tower.stats.spiritualBalance) {
                const r = this._manaRatio(tower);
                if (tower.mana <= 80) regen *= 3;
                else regen *= 1 + 2 * (1 - Math.min(1, (tower.mana - 80) / 200));
            }
            tower.mana = Math.min(tower.stats.manaMax || 800, tower.mana + regen * dt);
        }

        tower.hauntTimer -= dt;
        if (tower.hauntTimer <= 0) {
            tower.hauntTimer = 3;
            this._applyHaunt(tower);
        }

        const { dmgMult, speedMult } = this._spiritMult(tower);
        const spirit = tower.spirit;
        spirit.cooldown -= dt;
        if (!spirit.target || !spirit.target.alive || !this._eligible(spirit.target, tower)) {
            this._acquireSpiritTarget(tower);
        }
        if (spirit.target) {
            const dx = spirit.target.x - spirit.x;
            const dy = spirit.target.y - spirit.y;
            const dist = Math.hypot(dx, dy);
            const step = (tower.stats.spiritSpeed || 100) * speedMult * dt;
            if (dist > step) {
                spirit.x += (dx / dist) * step;
                spirit.y += (dy / dist) * step;
            } else {
                spirit.x = spirit.target.x;
                spirit.y = spirit.target.y;
                if (spirit.cooldown <= 0) {
                    this._spiritSwipe(tower, dmgMult);
                    spirit.cooldown = 0.6;
                }
            }
        } else {
            const home = Utils.angle(spirit.x, spirit.y, tower.x, tower.y);
            const step = (tower.stats.spiritSpeed || 100) * 0.6 * dt;
            const dx = tower.x - spirit.x, dy = tower.y - spirit.y;
            const dist = Math.hypot(dx, dy);
            if (dist > step) { spirit.x += (dx / dist) * step; spirit.y += (dy / dist) * step; }
        }

        if (tower.darkRitualTimer !== undefined && tower.darkRitualTimer > 0) {
            tower.darkRitualTimer -= dt;
            tower.darkRitualTick = (tower.darkRitualTick || 0) - dt;
            if (tower.darkRitualTick <= 0) {
                tower.darkRitualTick = 0.2;
                const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, 60, _corvusScratch);
                let hits = 0;
                for (const e of nearby) {
                    if (!e.alive || hits >= 100) continue;
                    if (Utils.withinRange(tower.x, tower.y, e.x, e.y, 60)) {
                        e.takeDamage(1, { isPlasma: true, canHitLead: true }, {}, tower);
                        tower.mana = Math.min(tower.stats.manaMax || 800, tower.mana + 1);
                        hits++;
                    }
                }
            }
        }

        for (const e of GameEngine.enemies) {
            if (e.corvusHaunted && e.corvusHaunted === tower && e.alive === false) {
                e.corvusHaunted = null;
                this._hauntExplode(tower, e);
            }
        }
    },
    _acquireSpiritTarget(tower) {
        let best = null, bestVal = -Infinity;
        for (const e of GameEngine.enemies) {
            if (!this._eligible(e, tower)) continue;
            if (e.corvusHaunted) { const d = -Utils.distance(tower.x, tower.y, e.x, e.y); if (d > bestVal) { bestVal = d; best = e; } continue; }
            const val = e.data.isMoab ? e.data.rbe + 10000 : e.data.rbe;
            if (val > bestVal) { bestVal = val; best = e; }
        }
        tower.spirit.target = best;
    },
    _spiritSwipe(tower, dmgMult) {
        const spirit = tower.spirit;
        const baseDmg = (tower.stats.spiritDmg || 1) * dmgMult;
        const nearby = GameEngine.enemyGrid.query(spirit.x, spirit.y, 24, _corvusScratch);
        let hits = 0;
        for (const e of nearby) {
            if (!e.alive || hits >= tower.stats.spiritPierce) continue;
            if (!this._eligible(e, tower)) continue;
            if (Utils.withinRange(spirit.x, spirit.y, e.x, e.y, 24)) {
                let dmg = baseDmg;
                if (e.data.isMoab) dmg += tower.stats.spiritMoabDmg || 0;
                if (e.corvusHaunted === tower) dmg += 1 + (tower.stats.hauntBonusDmg || 0);
                const dealt = e.takeDamage(dmg, { isMagic: true }, {}, tower);
                if (dealt > 0) tower.damageDealt += dealt;
                hits++;
            }
        }
        AudioEngine.playSfx('pop');
        spirit.target = null;
    },
    _applyHaunt(tower) {
        let best = null, bestVal = -Infinity;
        for (const e of GameEngine.enemies) {
            if (!e.alive || !this._eligible(e, tower)) continue;
            if (e.data.isMoab && !tower.stats.hauntMoab) continue;
            if (!Utils.withinRange(tower.x, tower.y, e.x, e.y, tower.stats.hauntRange)) continue;
            if (e.data.rbe > bestVal) { bestVal = e.data.rbe; best = e; }
        }
        if (best) best.corvusHaunted = tower;
    },
    _hauntExplode(tower, e) {
        const dmg = tower.stats.hauntExplosionDmg || (tower.stats.hauntDmg || 2);
        const pierce = tower.stats.hauntPierce || 4;
        const nearby = GameEngine.enemyGrid.query(e.x, e.y, tower.stats.hauntRadius, _corvusScratch);
        let hits = 0;
        for (const t of nearby) {
            if (!t.alive || hits >= pierce) continue;
            if (Utils.withinRange(e.x, e.y, t.x, t.y, tower.stats.hauntRadius)) {
                t.takeDamage(dmg, { isEnergy: true, canHitLead: true }, {}, tower);
                hits++;
            }
        }
        GameEngine.explosions.push({ x: e.x, y: e.y, radius: 0, maxRadius: tower.stats.hauntRadius, life: 0.4, maxLife: 0.4, color: '#8e44ad' });
    },
    draw(ctx, tower, isPreview) {
        if (!isPreview && tower.spirit) {
            const spirit = tower.spirit;
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = '#8e44ad';
            ctx.beginPath(); ctx.arc(spirit.x, spirit.y, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#9b59b6';
            ctx.beginPath(); ctx.arc(spirit.x, spirit.y, 6, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }
        tower.drawBaseTower(ctx, isPreview);
    },
    ability(tower, engine) {
        const level = tower.level;
        const dmg = level >= 11 ? 30 : 20;
        const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, 60, _corvusScratch);
        let hits = 0;
        let restored = 100;
        for (const e of nearby) {
            if (!e.alive || hits >= 20) continue;
            if (!Utils.withinRange(tower.x, tower.y, e.x, e.y, 60)) continue;
            let d = dmg;
            if (level >= 11 && e.data.isCeramic) d += 10;
            e.takeDamage(d, { isEnergy: true, canHitLead: true }, {}, tower);
            restored += 1;
            hits++;
        }
        tower.mana = Math.min(tower.stats.manaMax || 800, tower.mana + restored);
        engine.log("Corvus: Soul Harvest!");
    },
    ability2(tower, engine) {
        let best = null, bestVal = -Infinity;
        for (const e of GameEngine.enemies) {
            if (!e.alive) continue;
            if (e.data.rbe > bestVal) { bestVal = e.data.rbe; best = e; }
        }
        if (best) {
            tower.spirit.x = best.x;
            tower.spirit.y = best.y;
            tower.spirit.target = best;
        }
        engine.log("Corvus: Spirit Walk!");
    },
    ability3(tower, engine) {
        tower.darkRitualTimer = 10;
        tower.darkRitualTick = 0;
        engine.log("Corvus: Dark Ritual!");
    }
};
