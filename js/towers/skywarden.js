// js/towers/skywarden.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

const _skyEnemyScratch = [];
const _skyTowerScratch = [];
const _skyBlastScratch = [];

const SKY_COMBO_RESET = 2.0;

// --- combo bookkeeping (stored on the enemy, shared between Skywardens) ---
function skyEnsureWatch(tower, e) {
    if (!tower._skyWatch) tower._skyWatch = [];
    if (tower._skyWatch.indexOf(e) === -1) tower._skyWatch.push(e);
}

function skyAgeCombos(tower, dt) {
    const list = tower._skyWatch;
    if (!list) return;
    for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        if (!e || !e.alive) { list.splice(i, 1); continue; }
        let keep = false;
        for (const type of ['wind', 'storm', 'ice']) {
            const c = e['_skyC_' + type];
            if (!c) continue;
            c.reset -= dt;
            if (c.reset <= 0) {
                if (c.hits) { c.blastDone = false; c.shrapT = 0; }
                e['_skyC_' + type] = null;
            } else {
                keep = true;
            }
        }
        if (!keep) list.splice(i, 1);
    }
}

function skyOnHit(tower, e) {
    skyEnsureWatch(tower, e);

    // Wind Combo
    if (tower.stats.windCombo) {
        let c = e._skyC_wind || (e._skyC_wind = { hits: 0, reset: 0 });
        c.hits++;
        c.reset = SKY_COMBO_RESET;
    }

    // Storm Combo
    if (tower.stats.stormCombo) {
        let c = e._skyC_storm || (e._skyC_storm = { hits: 0, reset: 0, stage2Done: false });
        const prev = c.hits;
        c.hits++;
        c.reset = SKY_COMBO_RESET;
        if (prev === 1) c.stage2Done = false;
    }

    // Ice Combo
    if (tower.stats.iceCombo) {
        let c = e._skyC_ice || (e._skyC_ice = { hits: 0, reset: 0, blastDone: false });
        const prev = c.hits;
        c.hits++;
        c.reset = SKY_COMBO_RESET;
        if (prev === 2) c.blastDone = false;
    }

    // Coldchain baseline slow: first bloon hit by each attack
    if (tower.stats.coldSlow) {
        const canSlow = e.data.isMoab ? !!(tower.stats.moabSlow) : true;
        if (canSlow) e.applySlow(tower.stats.coldSlow || 0.25, tower.stats.coldSlowDur || 3, false);
    }

    // Icesplosive tracking (T4+): popping a frozen bloon leaves an icesplosive remain
    if (tower.stats.icesplosive && e.isFrozen) {
        e._skyIcesplode = 3.0;
    }

    // Icebore: +50% pierce for 1s after popping a frozen bloon
    if (tower.stats.icebore && e.isFrozen) {
        tower._iceboreT = 1.0;
    }

    // Winter's Mercy: +1 damage for 6s every 3 frozen bloons popped
    if (tower.stats.frostEmpower && e.isFrozen) {
        tower._frostPopped = (tower._frostPopped || 0) + 1;
        if (tower._frostPopped >= 3) {
            tower._frostPopped = 0;
            tower._frostEmpower = 6.0;
        }
    }
}

function skyAuraCount(t) {
    let n = 0;
    for (const s of GameEngine.towers) {
        if (s && s !== t && s.type === 'skywarden' && s.stats.rangeAura) {
            const r = Utils.getEffectiveRange(s, GameEngine);
            if (Utils.withinRange(s.x, s.y, t.x, t.y, r)) n++;
        }
    }
    return Math.min(5, n);
}

export default {
    stats: {
        name: "Skywarden", cost: 205, range: 48,
        baseCooldown: 0.9, fireRate: 0.9,
        damage: 1, pierce: 4, projectileSpeed: 700,
        lifespan: 0.7, desc: "A storm-blessed archer. Fires arrows that gain attack speed the longer it keeps firing. Cannot pop Frozen or Lead Bloons without upgrades.",
        dmgType: 'sharp', projectileType: 'arrow', hitRadius: 8,
        category: 'Magic',
        skyRampMax: 0.5,
        spread: 7
    },
    upgrades: {
        1: [
            { name: "Aerial Attunement", cost: 110, stat: "range", amount: 10, desc: "Increases attack range. Grants a range bonus to other Monkeys in its radius, stacking up to 5 times.", extraMods: { rangeAura: true } },
            { name: "Zephyr Sense", cost: 215, stat: "canSeeCamo", amount: true, desc: "Detects Camo Bloons and fires with improved accuracy.", extraMods: { spreadMult: 0.4 } },
            { name: "Wind Weaver", cost: 1650, desc: "Bloons hit by its arrows are periodically blown back. Builds a Wind Combo: the more hits a bloon takes, the stronger the wind effects.", extraMods: { windCombo: true } },
            { name: "Galesage", cost: 3300, stat: "damage", amount: 1, desc: "Fires bursts of 3 arrows and suppresses the Camo properties of Camo Bloons in its radius.", extraMods: { burst: 3, burstDelay: 0.15, camoSuppress: true } },
            { name: "Farwind Seer", cost: 19000, stat: "damage", amount: 3, desc: "Arrow damage is greatly increased and scales up with every 5 units of attack range.", extraMods: { rangeDmg: true, rangeDmgEvery: 5, rangeDmgStart: 70 } }
        ],
        2: [
            { name: "Storm's Pulse", cost: 175, stat: "dmgType", amount: 'energy', desc: "Projectiles are faster and now deal Energy damage, popping Frozen Bloons. The attack speed ramp is doubled.", extraMods: { projectileSpeed: 300, doubleRamp: true } },
            { name: "Thundering Arc", cost: 275, desc: "Attacks become arcing bolts of lightning that explode over distance, hitting multiple Bloons and bypassing walls.", extraMods: { mortarArc: true, explosionRadius: 24, arcPierce: 6 } },
            { name: "Galvanic Conduit", cost: 1800, stat: "dmgType", amount: 'plasma', desc: "Deals Plasma damage, popping Lead. Does bonus damage to MOABs and Ceramics. Builds a Lightning Combo with powerful chain effects.", extraMods: { plasma: true, moabDmg: 3, ceramicDmg: 3, stormCombo: true } },
            { name: "Thunder's Decree", cost: 2000, desc: "The Lightning Combo can now stun ZOMGs. Gains Thunder Charge: nearby towers get faster projectiles, extra pierce, and can pop Frozen Bloons.", extraMods: { isAbility: true, abilityName: "Thunder Charge", abilityCd: 45, arcPierce: 2, stormStunZomg: true } },
            { name: "Stormwrath Archon", cost: 35000, desc: "Huge bonuses to MOABs and Ceramics. Combo lightning deals massive damage. Attacks leave lightning rods that repeatedly zap nearby Bloons, and Thunder Charge arcs between the rods.", extraMods: { moabDmg: 6, ceramicDmg: 6, comboLightningDmg: 50, comboStunDmg: 100, lightningRods: true, abilityCd: 30 } }
        ],
        3: [
            { name: "Shatterpoint", cost: 150, desc: "Arrows gain Shatter properties, popping Frozen and Lead Bloons. Increases pierce and accuracy.", extraMods: { dmgType: 'shatter', shatter: true, pierce: 2, spreadMult: 0.25 } },
            { name: "Icebore", cost: 250, desc: "Does bonus damage to Frozen Bloons. Popping a Frozen Bloon boosts pierce for a short time.", extraMods: { frozenBonus: 1, icebore: true } },
            { name: "Coldchain", cost: 1500, desc: "The first Bloon hit by each attack is slowed. Builds an Ice Combo: repeated hits slow nearby Bloons and launch freezing shrapnel.", extraMods: { iceCombo: true, coldSlow: 0.25, coldSlowDur: 3 } },
            { name: "Frozen Verdict", cost: 3900, stat: "damage", amount: 1, desc: "Increased arrow and shrapnel damage. Popping Frozen Bloons leaves icesplosive remains that slow and explode on nearby Bloons.", extraMods: { frozenBonus: 3, shrapnelDmg: 6, icesplosive: true } },
            { name: "Winter's Mercy", cost: 20000, stat: "damage", amount: 2, desc: "Massive damage to Frozen Bloons. Gains damage from the number of Frozen Bloons in range and from popping them.", extraMods: { frozenBonus: 4, shrapnelFrozenBonus: 12, frostEmpower: true } }
        ]
    },

    updateSupport(tower, dt) {
        if (tower.stats.rangeAura) {
            tower._skyAuraTimer = (tower._skyAuraTimer || 0) - dt;
            const refresh = tower._skyAuraTimer <= 0;
            if (refresh) tower._skyAuraTimer = 0.4;
            const effRange = Utils.getEffectiveRange(tower, GameEngine);
            const near = GameEngine.towerGrid.query(tower.x, tower.y, effRange, _skyTowerScratch);
            for (const t of near) {
                if (!t || t === tower) continue;
                if (!Utils.withinRange(tower.x, tower.y, t.x, t.y, effRange)) continue;
                const count = skyAuraCount(t);
                t.buffedRange = Math.max(t.buffedRange || 0, Math.min(0.2, count * 0.04));
                if (refresh) {
                    t.addBuff('skywarden', 'Skywarden Aura', 0.5, 1, { type: 'skywarden' }, false);
                }
            }
        }
    },

    update(tower, dt, engine) {
        const stats = tower.stats;

        // Icesplosives spawned from popped frozen bloons (before combos prune the watch list)
        if (stats.icesplosive && tower._skyWatch) {
            for (const e of tower._skyWatch) {
                if (e && !e.alive && e._skyIcesplode) {
                    const bonus = e.data.isBAD ? 10000 : e.data.isZOMG ? 200 : e.data.isBFB ? 75 : e.data.isDDT ? 50 : e.data.isMoab ? 25 : 0;
                    tower.icesplosives = tower.icesplosives || [];
                    tower.icesplosives.push({
                        x: e.x, y: e.y,
                        life: 2.5 + Math.random() * 1.5, maxLife: 4,
                        dmg: (stats.icesplosiveDmg || 3) + (e.isFrozen ? (stats.icesplosiveFrozenBonus || 3) : 0) + bonus
                    });
                    e._skyIcesplode = 0;
                } else if (e && e.alive) {
                    e._skyIcesplode = (e._skyIcesplode || 0) - dt;
                }
            }
        }

        skyAgeCombos(tower, dt);

        // Attack speed ramp: builds while firing, decays when idle (Druid of Wrath-like)
        tower._skyFiringT = (tower._skyFiringT || 0) - dt;
        if (tower._skyFiringT > 0) {
            tower._skyRamp = Math.min(1, (tower._skyRamp || 0) + dt / 4.5);
        } else {
            tower._skyRamp = Math.max(0, (tower._skyRamp || 0) - dt * 0.8);
        }
        if (tower._skyRamp > 0) {
            const rampMax = stats.doubleRamp ? 1.0 : (stats.skyRampMax || 0.5);
            tower.buffedFireRate = Math.max(tower.buffedFireRate || 0, tower._skyRamp * rampMax);
        }

        // Icebore pierce buff timer
        if (tower._iceboreT > 0) tower._iceboreT -= dt;
        // Winter's Mercy empower timer
        if (tower._frostEmpower > 0) tower._frostEmpower -= dt;

        // Galesage: suppress camo properties of Camo Bloons in radius
        if (stats.camoSuppress) {
            const camoRange = Utils.getEffectiveRange(tower, engine);
            const near = engine.enemyGrid.query(tower.x, tower.y, camoRange, _skyEnemyScratch);
            for (const e of near) {
                if (!e.alive) continue;
                if (!Utils.withinRange(tower.x, tower.y, e.x, e.y, camoRange)) continue;
                if (e._skyCamoSup === undefined) e._skyCamoSup = [];
                if (e._skyCamoSup.indexOf(tower) === -1) {
                    e._skyCamoSup.push(tower);
                    if (e.isCamo) {
                        e._skyWasCamo = true;
                        e.isCamo = false;
                        if (e._updateSpriteCache) e._updateSpriteCache();
                    }
                }
            }
            const sup = tower._skyCamod = tower._skyCamod || [];
            for (let i = sup.length - 1; i >= 0; i--) {
                const e = sup[i];
                if (!e || !e.alive) { sup.splice(i, 1); continue; }
                const idx = e._skyCamoSup ? e._skyCamoSup.indexOf(tower) : -1;
                const stillIn = idx !== -1 && Utils.withinRange(tower.x, tower.y, e.x, e.y, camoRange);
                if (!stillIn) {
                    if (idx !== -1) e._skyCamoSup.splice(idx, 1);
                    if ((e._skyCamoSup || []).length === 0) {
                        e.isCamo = !!e._skyWasCamo;
                        e._skyWasCamo = false;
                        if (e._updateSpriteCache) e._updateSpriteCache();
                    }
                    sup.splice(i, 1);
                }
            }
            for (const e of near) {
                if (!e.alive) continue;
                if (!Utils.withinRange(tower.x, tower.y, e.x, e.y, camoRange)) continue;
                if (e._skyCamoSup && e._skyCamoSup.indexOf(tower) !== -1 && sup.indexOf(e) === -1) sup.push(e);
            }
        }

        // Wind Combo: periodic blowback + vortex
        if (stats.windCombo && tower._skyWatch) {
            for (const e of tower._skyWatch) {
                if (!e || !e.alive) continue;
                const c = e._skyC_wind;
                if (!c || c.hits < 1) continue;
                e._skyWindTick = (e._skyWindTick || 0.6) - dt;
                if (e._skyWindTick <= 0) {
                    e._skyWindTick = 0.6;
                    if (!e.data.isMoab) e.distanceTraveled = Math.max(0, e.distanceTraveled - 14);
                }
                if (c.hits >= 3) {
                    e._skyVortexT = (e._skyVortexT || 0) - dt;
                    if (e._skyVortexT <= 0) {
                        e._skyVortexT = 1.0;
                        const vortexRange = 34;
                        const near = engine.enemyGrid.query(e.x, e.y, vortexRange, _skyEnemyScratch);
                        let n = 0;
                        for (const b of near) {
                            if (n >= 4) break;
                            if (!b.alive || b === e) continue;
                            if (!Utils.withinRange(e.x, e.y, b.x, b.y, vortexRange)) continue;
                            if (!b.data.isMoab) b.distanceTraveled = Math.max(0, b.distanceTraveled - 12);
                            n++;
                        }
                    }
                }
            }
        }

        // Storm Combo: lightning bolt, attract, enhanced attacks
        if (stats.stormCombo && tower._skyWatch) {
            for (const e of tower._skyWatch) {
                if (!e || !e.alive) continue;
                const c = e._skyC_storm;
                if (!c) continue;
                if (c.hits >= 3) e._skyStormEnhance = Math.max(e._skyStormEnhance || 0, 4.0);
                else e._skyStormEnhance = Math.max(0, (e._skyStormEnhance || 0) - dt);
                if (c.hits >= 2 && !c.stage2Done) {
                    c.stage2Done = true;
                    const boltDmg = (stats.comboLightningDmg || 5) + (e.isFrozen ? 4 : 0);
                    Utils.applyAoeDamage(GameEngine, e.x, e.y, 26, boltDmg, { isEnergy: true, canHitLead: true }, tower, {}, { maxHits: 4 });
                    const near = engine.enemyGrid.query(e.x, e.y, 60, _skyBlastScratch);
                    let best = null, bestD = Infinity;
                    for (const b of near) {
                        if (!b.alive || b === e) continue;
                        const d = Utils.distanceSq(e.x, e.y, b.x, b.y);
                        if (d < bestD) { bestD = d; best = b; }
                    }
                    if (best) best.takeDamage(boltDmg, { isEnergy: true, canHitLead: true }, {}, tower);
                }
            }
        }

        // Ice Combo: slow blast + freezing shrapnel
        if (stats.iceCombo && tower._skyWatch) {
            for (const e of tower._skyWatch) {
                if (!e || !e.alive) continue;
                const c = e._skyC_ice;
                if (!c) continue;
                const slow = stats.coldSlow || 0.25;
                const dur = stats.coldSlowDur || 3;
                if (c.hits >= 2 && !c.blastDone) {
                    c.blastDone = true;
                    const blastRange = 8;
                    const near = engine.enemyGrid.query(e.x, e.y, blastRange, _skyBlastScratch);
                    for (const b of near) {
                        if (!b.alive) continue;
                        if (!Utils.withinRange(e.x, e.y, b.x, b.y, blastRange)) continue;
                        const canSlow = b.data.isMoab ? !!(stats.moabSlow) : true;
                        if (canSlow) b.applySlow(slow, dur, false);
                    }
                }
                if (c.hits >= 3) {
                    c.shrapT = (c.shrapT || 0) - dt;
                    if (c.shrapT <= 0) {
                        c.shrapT = 1.5;
                        for (let i = 0; i < 5; i++) {
                            const ang = (i / 5) * Math.PI * 2 + Math.random() * 0.5;
                            let sdmg = stats.shrapnelDmg || 3;
                            if (e.isFrozen) sdmg += stats.shrapnelFrozenBonus || 0;
                            const p = engine.projectilePool.get();
                            p.init(e.x, e.y, sdmg, null, 'tack', 300, 3, 0.4, ang, { freeze: true, freezeDuration: 1.5 }, 0, tower, { isSharp: true, canHitLead: true });
                        }
                    }
                }
            }
        }

        // Icesplosive update: slow aura + expiry explosion
        if (tower.icesplosives && tower.icesplosives.length) {
            for (let i = tower.icesplosives.length - 1; i >= 0; i--) {
                const s = tower.icesplosives[i];
                s.life -= dt;
                if (s.life <= 0) {
                    tower.icesplosives.splice(i, 1);
                    GameEngine.explosions.push({ x: s.x, y: s.y, radius: 0, maxRadius: 20, life: 0.3, maxLife: 0.3, color: '#a3e4ff' });
                    const near = engine.enemyGrid.query(s.x, s.y, 20, _skyEnemyScratch);
                    let n = 0;
                    for (const e of near) {
                        if (n >= 3) break;
                        if (!e.alive) continue;
                        if (!Utils.withinRange(s.x, s.y, e.x, e.y, 20)) continue;
                        let dmg = s.dmg;
                        if (e.isFrozen) dmg += stats.icesplosiveFrozenBonus || 3;
                        const dealt = e.takeDamage(dmg, { isIce: true, canHitLead: true }, {}, tower);
                        if (dealt === -1) continue;
                        if (!e.data.isMoab) e.applySlow(0.0, 1.5, true);
                        n++;
                    }
                    continue;
                }
                const near = engine.enemyGrid.query(s.x, s.y, 22, _skyEnemyScratch);
                let n = 0;
                for (const e of near) {
                    if (n >= 6) break;
                    if (!e.alive) continue;
                    if (!Utils.withinRange(s.x, s.y, e.x, e.y, 22)) continue;
                    e.applySlow(0.5, 3.0, false);
                    n++;
                }
            }
        }

        // Thunder Charge active buff
        if (tower.thunderActive > 0) {
            tower.thunderActive -= dt;
            const chargeRange = Utils.getEffectiveRange(tower, engine) + 60;
            const near = engine.towerGrid.query(tower.x, tower.y, chargeRange, _skyTowerScratch);
            for (const t of near) {
                if (!t) continue;
                if (!Utils.withinRange(tower.x, tower.y, t.x, t.y, chargeRange)) continue;
                t.addBuff('thunder_charge', 'Thunder Charge', 0.5, 1, { type: 'thunder_charge' }, false);
                t.buffedProjSpeed = Math.max(t.buffedProjSpeed || 1.0, 1.6);
                t.buffedFireRate = Math.max(t.buffedFireRate || 0, 0.2);
                t.buffedPierce = Math.max(t.buffedPierce || 0, 2);
                t.buffedLead = true;
            }
            tower.buffedFireRate = Math.max(tower.buffedFireRate || 0, 0.2);
            tower.buffedLead = true;
        }

        // Lightning rods (Stormwrath Archon)
        if (stats.lightningRods) {
            tower._rodTick = (tower._rodTick || 0) - dt;
            if (tower._rodTick <= 0) {
                tower._rodTick = 0.5;
                if (tower._skyWatch) {
                    for (const e of tower._skyWatch) {
                        if (!e || !e.alive) continue;
                        const rods = tower.rodList || (tower.rodList = []);
                        let far = true;
                        for (const r of rods) {
                            if (Utils.distanceSq(e.x, e.y, r.x, r.y) < 100) { far = false; break; }
                        }
                        if (far && rods.length < 12) rods.push({ x: e.x, y: e.y, life: 12 });
                    }
                }
            }
            const rods = tower.rodList;
            if (rods && rods.length) {
                for (let i = rods.length - 1; i >= 0; i--) {
                    const r = rods[i];
                    r.life -= dt;
                    if (r.life <= 0) { rods.splice(i, 1); continue; }
                    const isCharged = tower.thunderActive > 0;
                    const zapRange = isCharged ? 60 : 26;
                    const maxHits = isCharged ? 50 : 5;
                    const key = isCharged ? '_czap' : '_pzap';
                    const cd = isCharged ? 0.25 : 0.5;
                    r[key] = (r[key] || 0) - dt;
                    if (r[key] <= 0) {
                        r[key] = cd;
                        const near = engine.enemyGrid.query(r.x, r.y, zapRange, _skyEnemyScratch);
                        let n = 0;
                        for (const e of near) {
                            if (n >= maxHits) break;
                            if (!e.alive) continue;
                            if (!Utils.withinRange(r.x, r.y, e.x, e.y, zapRange)) continue;
                            e.takeDamage(stats.comboLightningDmg || 40, { isEnergy: true, canHitLead: true }, {}, tower);
                            n++;
                        }
                    }
                }
            }
        }

        // Galesage burst queue
        if (tower._skyBurstQ && tower._skyBurstQ.length) {
            const q = tower._skyBurstQ;
            const speed = stats.projectileSpeed;
            const lifespan = stats.lifespan;
            const pierce = tower._iceboreT > 0 ? Math.ceil(stats.pierce * 1.5) : stats.pierce;
            for (let i = q.length - 1; i >= 0; i--) {
                const entry = q[i];
                entry.delay -= dt;
                if (entry.delay > 0) continue;
                const tgt = entry.target;
                const dmg = entry.dmg;
                const dmgType = entry.dmgType;
                q.splice(i, 1);
                if (!tgt || !tgt.alive) continue;
                const spread = (stats.spread || 6) * (stats.spreadMult || 1);
                const angle = (Math.random() - 0.5) * spread;
                const p = engine.projectilePool.get();
                p.init(tower.x, tower.y, dmg, tgt, stats.projectileType, speed, pierce, lifespan, null, { onHit: (e) => skyOnHit(tower, e) }, angle, tower, dmgType);
            }
        }
    },

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        const stats = tower.stats;
        let finalDmg = damage;
        const pEffects = { ...effects };

        // Farwind Seer: +1 damage per 5 units of range beyond 70
        if (stats.rangeDmg) {
            const effRange = Utils.getEffectiveRange(tower, engine);
            const start = stats.rangeDmgStart || 70;
            if (effRange >= start) {
                finalDmg += Math.floor((effRange - start) / (stats.rangeDmgEvery || 5));
            }
        }

        // Winter's Mercy: +1 damage per 3 Frozen Bloons in range (cap +8), +1 while empowered
        if (stats.frostEmpower) {
            const effRange = Utils.getEffectiveRange(tower, engine);
            const near = engine.enemyGrid.query(tower.x, tower.y, effRange, _skyEnemyScratch);
            let frozen = 0;
            for (const e of near) {
                if (e.alive && e.isFrozen) frozen++;
            }
            finalDmg += Math.min(8, Math.floor(frozen / 3));
            if ((tower._frostEmpower || 0) > 0) finalDmg += 1;
        }

        // Frozen bonus damage (Ice path)
        if (stats.frozenBonus && target.isFrozen) finalDmg += stats.frozenBonus;

        // Galvanic Conduit: +damage to Ceramic
        if (stats.ceramicDmg && target.data.isCeramic) finalDmg += stats.ceramicDmg;

        // Storm Combo enhancement: +comboStunDmg and stun on enhanced attacks
        if (target._skyStormEnhance > 0) {
            finalDmg += (stats.comboStunDmg || 10);
            const canStun = target.data.isZOMG ? !!(stats.stormStunZomg) : true;
            if (canStun) pEffects.stun = target.data.isMoab ? 1 : 3;
        }

        pEffects.onHit = (e) => skyOnHit(tower, e);

        const pierce = tower._iceboreT > 0 ? Math.ceil(stats.pierce * 1.5) : stats.pierce;
        const spread = (stats.spread || 6) * (stats.spreadMult || 1);
        const angle = (Math.random() - 0.5) * spread;

        // Thundering Arc: mortar-style exploding bolt
        if (stats.mortarArc) {
            const arcPierce = (stats.arcPierce || 6) + ((tower.upgrades[1] || 0) >= 4 ? 2 : 0);
            const p = engine.projectilePool.get();
            p.init(tower.x, tower.y, finalDmg, target, stats.projectileType, stats.projectileSpeed, 1, stats.lifespan, null, {
                isExplosive: true,
                explosionRadius: stats.explosionRadius || 24,
                explosionDamage: finalDmg,
                explosionPierce: arcPierce,
                canHitLead: true,
                onHit: pEffects.onHit
            }, 0, tower, { isExplosion: true, canHitLead: true, moabDmg: stats.moabDmg || 0 }, isCrit);
            tower._skyFiringT = stats.baseCooldown || 0.9;
            return;
        }

        // Standard arrow
        const p = engine.projectilePool.get();
        p.init(tower.x, tower.y, finalDmg, target, stats.projectileType, stats.projectileSpeed, pierce, stats.lifespan, null, pEffects, angle, tower, dmgType, isCrit);

        // Wind Combo stage 2: subsequent wind shots produce 2 extra arrows (no secondary effects)
        if (stats.windCombo && target._skyC_wind && target._skyC_wind.hits >= 2) {
            for (let i = 0; i < 2; i++) {
                const p2 = engine.projectilePool.get();
                const a2 = (Math.random() - 0.5) * spread;
                p2.init(tower.x, tower.y, finalDmg, target, stats.projectileType, stats.projectileSpeed, pierce, stats.lifespan, null, {}, a2, tower, dmgType, isCrit);
            }
        }

        // Galesage: enqueue burst arrows
        if ((stats.burst || 0) > 1) {
            tower._skyBurstQ = tower._skyBurstQ || [];
            for (let i = 1; i < stats.burst; i++) {
                tower._skyBurstQ.push({ delay: i * (stats.burstDelay || 0.15), target, dmg: finalDmg, dmgType });
            }
        }

        tower._skyFiringT = stats.baseCooldown || 0.9;
    },

    ability(tower, engine) {
        if (tower.stats.abilityName === "Thunder Charge") {
            engine.log("Thunder Charge!");
            tower.thunderActive = 15.0;
            tower.thunderTimer = 0;
        }
    },

    draw(ctx, tower, isPreview) {
        if (!isPreview) {
            if (tower.icesplosives) {
                for (const s of tower.icesplosives) {
                    ctx.globalAlpha = Math.min(1, s.life / s.maxLife) * 0.6;
                    const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 22);
                    grad.addColorStop(0, 'rgba(163, 228, 255, 0.8)');
                    grad.addColorStop(1, 'rgba(116, 194, 255, 0)');
                    ctx.fillStyle = grad;
                    ctx.beginPath(); ctx.arc(s.x, s.y, 22, 0, Math.PI * 2); ctx.fill();
                    ctx.globalAlpha = 1;
                }
            }
            if (tower.rodList) {
                for (const r of tower.rodList) {
                    ctx.globalAlpha = Math.min(1, r.life / 12) * 0.8;
                    ctx.strokeStyle = '#4fc3f7';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(r.x - 4, r.y - 6); ctx.lineTo(r.x + 1, r.y + 2); ctx.lineTo(r.x - 3, r.y + 5);
                    ctx.moveTo(r.x + 4, r.y - 6); ctx.lineTo(r.x - 1, r.y + 2); ctx.lineTo(r.x + 3, r.y + 5);
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }
            if (tower.thunderActive > 0) {
                ctx.globalAlpha = 0.3 + 0.2 * Math.sin(performance.now() / 80);
                ctx.strokeStyle = '#4fc3f7';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(tower.x, tower.y, 30, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        }
        tower.drawBaseTower(ctx, isPreview);
    }
};
