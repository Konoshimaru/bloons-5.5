// js/towers/paragon_boomerang.js
// ============================================================================
// GLAIVE DOMINUS - Wave 2 Paragon (Boomerang Monkey), v1.4.1 / v1.4.2
// ============================================================================
// Behavior object + creation flow, mirroring the Wave 1 Apex Plasma Master
// (js/towers/paragon_dart.js). Pure degree math lives in js/paragonPower.js
// (GD_STAT_ANCHORS / glaiveStats).
//
// Identity (BTD6-faithful where the fan game allows):
//   - Created from a Boomerang Monkey when all three boomerang T5s exist on
//     the map at once (Glaive Lord, Perma Charge, MOAB Domination); transforms
//     the source and consumes EVERY boomerang on the map.
//   - $375,000 Medium (engine.getCost() applies difficulty). Pricing mirrors
//     BTD6's APM:GD ratio (wiki $162k -> $405k) on top of the game's $150k APM.
//   - Native camo detection. Normal damage (pops everything, incl. Lead/Frozen).
//   - Buff rules: immune to ALL external buffs, can never be sacrificed
//     (same as the APM). GIVES the Primary buff (below), never receives it.
//   - Sell value (v1.4.1): paragons are sellable by the player. totalSpent
//     carries everything paid for the paragon itself - the source T5's value
//     + the charged base price + the Degree investment - so the standard 70%
//     resale applies to the whole outlay. The OTHER consumed boomerangs stay
//     absorbed (BTD6 sacrifice rule).
//
// v1.4.2 - REAL WIKI POWER (owner: "glaive dominus is weak, get his real
// wiki power"). The full Bloons-wiki kit, per-degree via paragonPower:
//   1. Main attack: ONE glaive per attack at the wiki's hypersonic 0.04s
//      cadence (D1), 25 damage +50 boss, 60 pierce, ricocheting with
//      aggressive seeking (ricochet 50 / range 300). The FIRST target hit is
//      Shredded: a damage-over-time of 750/s for 15s (D1) - applied to the
//      acquired target at fire time, which is the first bloon the glaive
//      meets in practice.
//   2. Glaive Ring (Glaive Lord heritage): 3 permanent orbiting glaives,
//      each ticking every 0.1s (D1) with 42 damage, +20 Ceramic / +20 MOAB /
//      +150 Boss bonuses and 200 pierce.
//   3. MOAB Press (MOAB Domination heritage): every 3s, the nearest
//      MOAB-class bloon within 100px is pressed - knocked back and hit for
//      1 + 20 MOAB (D1) - then the press EXPLODES: 2500 damage (+4000 boss,
//      D1) in an area, and the survivors Burn for 500/s over 4s.
//   4. Primary buff (wiki v36.0): every OTHER Primary monkey on screen -
//      paragons included - attacks 11.1% faster (0.9x cooldown). Implemented
//      as a self-expiring aura timer (gdBuffTimer, towerBehavior.js) so the
//      buff dies with the Dominus instead of going stale.
//   5. Overcharge ability (45s cooldown): 10 stacks of a 0.9x-cooldown
//      attack-speed boost, one stack lost every 3s (~30s of overdrive, up to
//      +187% attack speed at full stacks) - driven through the shared
//      abilityActiveTime/rapidShotMult system so it cleans itself up.
//
// Placeholder art: zero-asset strategy like the APM - renderTowers.js draws
// the boomerang's Tier-5 base with a gold tint + additive glow; the tint path
// is bypassed automatically once real sprites exist under the reserved keys
// (tower_paragon_boomerang_base etc.).
// ============================================================================

import { spawnExplosion } from '../combat.js';
import { towerFactory } from '../towerFactory.js';
import { canOfferParagon, computePower, degreeFromPower, glaiveStats, PARAGON_POWER_RULES } from '../paragonPower.js';
import { Utils } from '../utils.js';

const _gdOrbitScratch = [];
const _gdPressScratch = [];

const GD_CFG = PARAGON_POWER_RULES.boomerang;

// Primary-buff aura: refreshed every tick while the Dominus lives; expires on
// its own within half a second of the paragon disappearing (sold / cleared).
const GD_BUFF_REFRESH = 0.5;
// MOAB Press reach + explosion radius (game units; wiki range 100).
const GD_PRESS_RANGE = 100;
const GD_PRESS_EXPLOSION_RADIUS = 55;

const behavior = {
    stats: {
        name: "Glaive Dominus", cost: 375000, range: 90,
        baseCooldown: 0.04, fireRate: 0.04,
        damage: 25, pierce: 60, projectileSpeed: 620,
        lifespan: 2.0, desc: "Hurls hypersonic ricocheting glaives that Shred their first target, guarded by three orbiting blades and a crushing MOAB Press.",
        dmgType: 'normal', projectileType: 'boomerang', hitRadius: 20,
        canSeeCamo: true, projectileCount: 1,
        category: 'Primary',
        // Overcharge (wiki): 10 stacks x 0.9x cooldown, a stack every 3s, 45s cd.
        isAbility: true, abilityName: 'Overcharge', abilityCd: 45,
    },
    // Registry tolerance (paragon_dart precedent): no upgrade arrays - the
    // paragon is created at its final degree and never upgrades. The empty
    // arrays keep the upgrade panel and stat recalculation safe.
    upgrades: { 1: [], 2: [], 3: [] },
    isParagon: true,

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        // Normal damage semantics: the dmgType object carries the boss bonus
        // (enemyDamage applies dmgType.bossDmg on boss-class bloons) while
        // bypassing every class immunity, exactly like the APM's ballDmgType.
        const glaiveDmgType = {
            bossDmg: tower.stats.bossDmg || 0,
        };
        // Glaive Ricochet heritage: the glaive seeks new targets across the
        // whole field after each hit (ricochet 50 / range 300).
        const glaiveEffects = {
            ricochet: 50,
            ricochetRange: 300,
        };
        // Shred (wiki): the first bloon the glaive hits takes a heavy
        // damage-over-time. The acquired target IS that first hit in
        // practice; set the DoT slot directly (same fields enemyDamage's
        // effects.dot path writes) so no resolver changes are needed.
        if (target && target.alive) {
            const shred = tower.stats.shredDps || 0;
            if (shred > 0) {
                target.dotDmg = Math.max(target.dotDmg || 0, shred);
                target.dotTimer = tower.stats.shredDuration || 15;
                target.dotTickInterval = 1;
            }
        }
        const p = engine.projectilePool.get();
        p.init(tower.x, tower.y, tower.stats.damage, target, 'boomerang',
            tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan,
            null, glaiveEffects, 0, tower, glaiveDmgType, false);
    },

    update(tower, dt, engine) {
        // --- Glaive Ring: 3 permanent orbiting plasma glaives (Glaive Lord
        // heritage), each ticking on its own cooldown with the ring's class
        // bonuses (ceramic / MOAB / boss per the wiki table).
        if (!tower.orbitGlaives) {
            tower.orbitGlaiveAngle = 0;
            tower.orbitGlaives = [
                { angle: 0, radius: 46, tick: 0 },
                { angle: Math.PI * 2 / 3, radius: 46, tick: 0 },
                { angle: Math.PI * 4 / 3, radius: 46, tick: 0 }
            ];
        }
        tower.orbitGlaiveAngle += dt * 3.5;
        const orbDmg = tower.stats.orbitalDamage || 42;
        const orbInterval = Math.max(0.05, tower.stats.orbitalInterval || 0.1);
        const orbDmgType = {
            isSharp: false, canHitLead: true,
            moabDmg: tower.stats.orbitalMoabDmg || 0,
            bossDmg: tower.stats.orbitalBossDmg || 0,
        };
        const orbEffects = { ceramicDmg: tower.stats.orbitalCeramicDmg || 0 };
        for (const g of tower.orbitGlaives) {
            g.tick -= dt;
            if (g.tick <= 0) {
                g.tick = orbInterval;
                const gx = tower.x + Math.cos(tower.orbitGlaiveAngle + g.angle) * g.radius;
                const gy = tower.y + Math.sin(tower.orbitGlaiveAngle + g.angle) * g.radius;
                const nearby = engine.enemyGrid.query(gx, gy, 28, _gdOrbitScratch);
                for (const e of nearby) {
                    if (!e.alive) continue;
                    if (Utils.withinRange(gx, gy, e.x, e.y, 28)) {
                        // Normal-damage orbit: pops every class, bonuses fold in.
                        e.takeDamage(orbDmg, orbDmgType, orbEffects, tower);
                    }
                }
            }
        }

        // --- MOAB Press (MOAB Domination heritage): every 3s the nearest
        // MOAB-class bloon in reach is pressed backwards and detonates.
        tower.pressTimer = (tower.pressTimer || 0) - dt;
        if (tower.pressTimer <= 0) {
            tower.pressTimer = tower.stats.pressInterval || 3;
            const pressed = _findPressTarget(tower, engine);
            if (pressed) {
                _doPress(tower, pressed, engine);
            }
        }

        // --- Primary buff (wiki v36.0): every OTHER Primary monkey - other
        // paragons included - attacks 11.1% faster while the Dominus lives.
        // Self-expiring timer (towerBehavior decays it; getEffectiveCooldown
        // applies the 0.9x), so a sold/destroyed Dominus can't leave the
        // buff stuck on.
        for (const t of engine.towers) {
            if (!t || t === tower || !t.stats || t.isMinion) continue;
            if (t.stats.category === 'Primary') t.gdBuffTimer = GD_BUFF_REFRESH;
        }

        // --- Overcharge: stacks decay one every 3s; each stack is a 0.9x
        // cooldown multiplier. Driven through the shared rapidShot system
        // (towerBehavior zeroes rapidShotMult when abilityActiveTime runs
        // out, so the boost always cleans itself up).
        if (tower.overchargeStacks > 0) {
            tower.overchargeTick = (tower.overchargeTick || 0) - dt;
            if (tower.overchargeTick <= 0 && tower.overchargeStacks > 1) {
                tower.overchargeStacks--;
                tower.overchargeTick = 3;
            }
            tower.abilityActiveTime = 0.3; // refreshed while stacks remain
            tower.rapidShotMult = 1 / Math.pow(0.9, tower.overchargeStacks);
        }
    },

    // The panel shows the degree badge + power breakdown instead of upgrades.
    getCounterText(tower) {
        return `Degree ${tower.paragonDegree || 1} | Dmg: ${Math.round(tower.damageDealt) || 0}`;
    },

    // Overcharge (wiki): cannot be started while stacks remain - naturally
    // satisfied because the 45s ability cooldown outlasts the 30s stacks, but
    // guarded anyway. Stacks/decay live in update().
    ability(tower, engine) {
        if ((tower.overchargeStacks || 0) > 0) {
            engine.log("Overcharge is still running!");
            return;
        }
        tower.overchargeStacks = 10;
        tower.overchargeTick = 3;
        tower.abilityActiveTime = 0.3;
        tower.rapidShotMult = 1 / Math.pow(0.9, 10);
        engine.log("OVERCHARGE: the Dominus enters overdrive!");
    },

    // Canvas fallback draw: purple orbital glaives behind the base tower
    // (boomerang_monkey.draw precedent).
    draw(ctx, tower, isPreview) {
        if (!isPreview && tower.orbitGlaives) {
            for (const g of tower.orbitGlaives) {
                const gx = tower.x + Math.cos(tower.orbitGlaiveAngle + g.angle) * g.radius;
                const gy = tower.y + Math.sin(tower.orbitGlaiveAngle + g.angle) * g.radius;
                ctx.save();
                ctx.translate(gx, gy);
                ctx.rotate(tower.orbitGlaiveAngle + g.angle);
                ctx.fillStyle = '#c39bd3';
                ctx.fillRect(-12, -3.5, 24, 7);
                ctx.fillStyle = '#8e44ad';
                ctx.fillRect(-3.5, -12, 7, 24);
                ctx.restore();
            }
        }
        tower.drawBaseTower(ctx, isPreview);
    }
};

// Nearest MOAB-class bloon within press reach (BADs included - the wiki's
// anti-MOAB glaives target all blimps; BADs simply ignore the knockback).
function _findPressTarget(tower, engine) {
    const nearby = engine.enemyGrid.query(tower.x, tower.y, GD_PRESS_RANGE, _gdPressScratch);
    let best = null;
    let bestDistSq = GD_PRESS_RANGE * GD_PRESS_RANGE;
    for (const e of nearby) {
        if (!e || !e.alive || !e.data || !e.data.isMoab) continue;
        const dx = e.x - tower.x, dy = e.y - tower.y;
        const dSq = dx * dx + dy * dy;
        if (dSq <= bestDistSq) {
            bestDistSq = dSq;
            best = e;
        }
    }
    return best;
}

// The press itself: knockback + anti-MOAB hit on the blimp, then the
// explosion (AoE + Burn on the survivors).
function _doPress(tower, target, engine) {
    // Contact hit: 1 + 20 MOAB (D1) with MOAB-Domination knockback (50; the
    // engine applies the x0.2 MOAB scale and BAD immunity itself).
    target.takeDamage(tower.stats.pressDmg || 1, {
        isSharp: false, canHitLead: true,
        moabDmg: tower.stats.pressMoabDmg || 0,
        bossDmg: tower.stats.bossDmg || 0,
    }, { knockback: 50 }, tower);

    // Explosion: 2500 (+4000 boss) in an area (D1), Burning survivors for
    // 500/s over 4s. Wiki damage type is NORMAL (pops black/zebra/purple),
    // so no isExplosive flag here; the burn rides the AoE effects bag -
    // enemyDamage's effects.dot path applies it per hit bloon.
    spawnExplosion(engine, target.x, target.y, GD_PRESS_EXPLOSION_RADIUS, 0.45, '#f39c12');
    Utils.applyAoeDamage(engine, target.x, target.y, GD_PRESS_EXPLOSION_RADIUS,
        tower.stats.explosionDamage || 2500,
        { isSharp: false, canHitLead: true, bossDmg: tower.stats.explosionBossDmg || 0 },
        tower,
        { dot: tower.stats.burnDps || 0, dotTimer: 1, dotDuration: tower.stats.burnDuration || 4 },
        { canSeeCamo: true, maxHits: tower.stats.pressPierce || 300 });
}

// ---------------------------------------------------------------------------
// Per-degree stat application (anchors via paragonPower.glaiveStats).
// ---------------------------------------------------------------------------
export function applyGlaiveStats(tower, degree) {
    const s = glaiveStats(degree);
    tower.paragonDegree = s.degree;
    tower.stats.damage = s.damage;
    tower.stats.bossDmg = s.bossDmg;
    tower.stats.eliteBossDmg = s.eliteBossDmg;
    tower.stats.pierce = s.pierce;
    tower.stats.baseCooldown = s.interval;
    tower.stats.fireRate = s.interval;
    // Glaive Ring (orbit) kit.
    tower.stats.orbitalDamage = s.orbitalDamage;
    tower.stats.orbitalPierce = s.orbitalPierce;
    tower.stats.orbitalInterval = s.orbitalInterval;
    tower.stats.orbitalCeramicDmg = s.orbitalCeramicDmg;
    tower.stats.orbitalMoabDmg = s.orbitalMoabDmg;
    tower.stats.orbitalBossDmg = s.orbitalBossDmg;
    // MOAB Press kit.
    tower.stats.pressDmg = s.pressDmg;
    tower.stats.pressMoabDmg = s.pressMoabDmg;
    tower.stats.pressInterval = s.pressInterval;
    tower.stats.pressPierce = s.pressPierce;
    tower.stats.explosionDamage = s.explosionDamage;
    tower.stats.explosionBossDmg = s.explosionBossDmg;
    tower.stats.shredDps = s.shredDps;
    tower.stats.shredDuration = s.shredDuration;
    tower.stats.burnDps = s.burnDps;
    tower.stats.burnDuration = s.burnDuration;
    tower.degreeInfo = s;
    return s;
}

// ---------------------------------------------------------------------------
// Creation flow, end to end (paragon_dart template):
// gate check -> charge -> sacrifice sweep -> power -> degree -> spawn.
//
// `extraCash` is the BTD6-style degree investment entered in the pre-purchase
// menu ($7,500 per power, capped by the cash-power cap's remaining room).
// ---------------------------------------------------------------------------
export function createGlaiveDominus(sourceTower, engine, extraCash = 0) {
    const offer = canOfferParagon(engine, sourceTower, 'boomerang');
    if (!offer.offered) { engine.log("Paragon requirements not met!"); return false; }

    const cfg = offer.cfg || GD_CFG;
    const extra = Math.max(0, Math.floor(Number(extraCash) || 0));
    if (engine.cash < offer.cost + extra) { engine.log("Not enough cash for the Paragon!"); return false; }

    // Charge first, then freeze the source while the sweep runs.
    engine.cash -= offer.cost + extra;

    // Sacrifice sweep: every boomerang-type tower on the map is consumed -
    // the source included (any tier since v1.4.0). Heroes, minions and
    // existing paragons are never candidates.
    const pool = engine.towers.filter(t => t && t.type === 'boomerang' && !t.stats.isHero && !t.isMinion && !t.isParagon);
    const records = pool.map(t => ({
        totalSpent: t.totalSpent || 0,
        upgrades: [...(t.upgrades || [0, 0, 0])],
        damageDealt: t.damageDealt || 0,
    }));

    for (const t of pool) {
        const idx = engine.towers.indexOf(t);
        if (idx > -1) engine.towers.splice(idx, 1);
        if (engine.selectedPlacedTower === t) engine.selectedPlacedTower = null;
        engine.spawnPopEffect(t.x, t.y, '#f1c40f');
    }

    // Power -> degree. The menu investment joins the cash pool (capped at the
    // same cash-power cap, filling whatever room the sacrifices left).
    const power = computePower({ towers: records, totems: 0 }, 'boomerang');
    const extraPower = Math.min(extra / cfg.cashPerPower, Math.max(0, cfg.cashPowerCap - power.cashPower));
    power.extraCash = extra;
    power.extraPower = extraPower;
    power.total += extraPower;
    const degree = degreeFromPower(power.total);

    // Spawn the paragon at the source's position, keeping its targeting.
    const paragon = towerFactory.create(sourceTower.x, sourceTower.y, 'paragon_boomerang');
    paragon.isParagon = true;
    paragon.paragonBaseType = 'boomerang';
    applyGlaiveStats(paragon, degree);
    paragon.powerBreakdown = power;
    // v1.4.1 sellable-paragon pricing: totalSpent = everything the player paid
    // for THIS paragon (source Tier 5's value + charged base + investment), so
    // getSellValue's standard 70% rate refunds a fair share of the outlay.
    paragon.totalSpent = (sourceTower.totalSpent ?? cfg.baseCost) + offer.cost + extra;
    paragon.targetingMode = sourceTower.targetingMode || 'First';
    engine.towers.push(paragon);

    // The consumed Tier 5s no longer exist, so the exclusivity ledger resets
    // (new T5s can be built toward a second Dominus once this one is gone).
    engine.tier5Bought['boomerang-1'] = false;
    engine.tier5Bought['boomerang-2'] = false;
    engine.tier5Bought['boomerang-3'] = false;

    engine.selectedPlacedTower = paragon;
    engine.spawnPopEffect(sourceTower.x, sourceTower.y, '#ffd700');
    const investNote = extra > 0 ? ` + $${extra.toLocaleString('en-US')} invested` : '';
    engine.log(`GLAIVE DOMINUS created - Degree ${degree}! (Power ${Math.round(power.total)}${investNote})`);
    return true;
}

export { canOfferParagon, PARAGON_POWER_RULES };
export default behavior;
