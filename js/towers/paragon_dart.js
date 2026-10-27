// js/towers/paragon_dart.js
// ============================================================================
// APEX PLASMA MASTER - Wave 1 Paragon (Dart Monkey)
// ============================================================================
// Behavior object + creation flow, per the Task 24 implementation plan
// (chapters 5/6). Pure degree math lives in js/paragonPower.js.
//
// Identity (BTD6-faithful):
//   - Created from a Tier 5 Dart Monkey when all three dart T5s exist on the
//     map at once; transforms the source and consumes EVERY dart on the map.
//   - $150,000 Medium (difficulty-scaled through engine.getCost).
//   - No activated ability. Native camo detection. Normal damage (pops
//     everything, including Lead and Frozen).
//   - Buff rules: immune to ALL external buffs (village auras, shinobi,
//     alchemist brew/dip, Overclock, Sun Temple support aura) and can never be
//     sacrificed; monkey knowledge and enemy debuffs still apply.
//   - Sell value (v1.4.1): paragons are sellable by the player. totalSpent
//     carries everything paid for the paragon itself - the source T5's value
//     + the charged base price + the Degree investment - so the standard 70%
//     resale applies to the whole outlay. The OTHER consumed darts stay
//     absorbed (BTD6 sacrifice rule).
//
// Attack: 3 plasma Ultra-Juggernaut balls per volley in a straight spread.
// Each ball splits into 6 mini-juggernauts at exactly two moments - when half
// its pierce is consumed and again when it runs out - and the minis inherit
// the parent ball's damage. The ball explodes when it reaches the screen edge.
//
// Placeholder art: zero-asset strategy - the WebGL renderer draws the dart's
// Crossbow Master base with a gold tint + additive glow (renderTowers.js); the
// tint path is bypassed automatically once real sprites exist under the
// reserved keys (tower_paragon_dart_base/_arm).
// ============================================================================

import { towerFactory } from '../towerFactory.js';
import { canOfferParagon, computePower, degreeFromPower, apexStats, PARAGON_POWER_RULES } from '../paragonPower.js';

const APM_CFG = PARAGON_POWER_RULES.dart;

const behavior = {
    stats: {
        name: "Apex Plasma Master", cost: 150000, range: 85,
        baseCooldown: 0.4, fireRate: 0.4,
        damage: 15, pierce: 200, projectileSpeed: 620,
        lifespan: 2.5, desc: "Fill the area with Bloon shredding plasma juggernaut balls, leaving nothing behind...",
        dmgType: 'normal', projectileType: 'apex_ball', hitRadius: 18,
        canSeeCamo: true, projectileCount: 3,
        category: 'Primary',
    },
    // Registry tolerance (farmer precedent): no upgrade arrays - the paragon
    // is created at its final degree and never upgrades. The empty arrays keep
    // the upgrade panel and stat recalculation safe.
    upgrades: { 1: [], 2: [], 3: [] },
    isParagon: true,

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        // Normal damage semantics: dmgType {} bypasses every class immunity
        // (Lead, Frozen, Purple) exactly like the wiki's "Normal" type.
        const ballDmgType = { bossDmg: tower.stats.bossDmg || 0 };
        const ballEffects = { ceramicDmg: tower.stats.ceramicDmg || 0 };
        const count = 3;
        const spread = 12;
        for (let i = 0; i < count; i++) {
            const offset = spread * (i - (count - 1) / 2);
            const p = engine.projectilePool.get();
            p.init(tower.x, tower.y, tower.stats.damage, target, 'apex_ball',
                tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan,
                null, ballEffects, offset, tower, ballDmgType, false);
        }
    },

    // The panel shows the degree badge + power breakdown instead of upgrades.
    getCounterText(tower) {
        return `Degree ${tower.paragonDegree || 1} | Dmg: ${Math.round(tower.damageDealt) || 0}`;
    },
};

// ---------------------------------------------------------------------------
// Per-degree stat application (wiki anchor table via paragonPower.apexStats).
// ---------------------------------------------------------------------------
export function applyApexStats(tower, degree) {
    const s = apexStats(degree);
    tower.paragonDegree = s.degree;
    tower.stats.damage = s.damage;
    tower.stats.ceramicDmg = s.ceramicDmg;
    tower.stats.bossDmg = s.bossDmg;
    tower.stats.eliteBossDmg = s.eliteBossDmg;
    tower.stats.pierce = s.pierce;
    tower.stats.baseCooldown = s.interval;
    tower.stats.fireRate = s.interval;
    tower.degreeInfo = s;
    return s;
}

// ---------------------------------------------------------------------------
// Creation flow, end to end (plan chapter 5):
// gate check -> charge -> sacrifice sweep -> power -> degree -> spawn.
//
// v1.4.0: `extraCash` is the BTD6-style degree investment entered in the
// pre-purchase menu. It is charged ON TOP of the base cost and converted to
// power at the same $7,500-per-power rate as sacrificed cash, filling the
// remaining room in the cash-power cap. The power breakdown stores it so the
// panel can show the investment separately.
// ---------------------------------------------------------------------------
export function createApexParagon(sourceTower, engine, extraCash = 0) {
    const offer = canOfferParagon(engine, sourceTower, 'dart');
    if (!offer.offered) { engine.log("Paragon requirements not met!"); return false; }

    const cfg = offer.cfg || APM_CFG;
    const extra = Math.max(0, Math.floor(Number(extraCash) || 0));
    if (engine.cash < offer.cost + extra) { engine.log("Not enough cash for the Paragon!"); return false; }

    // Charge first, then freeze the source while the sweep runs.
    engine.cash -= offer.cost + extra;

    // Sacrifice sweep (Sun Temple template, super.js): every dart-type tower
    // on the map is consumed - the source included (any tier since v1.4.0).
    // Heroes, minions and existing paragons are never candidates.
    const pool = engine.towers.filter(t => t && t.type === 'dart' && !t.stats.isHero && !t.isMinion && !t.isParagon);
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
    const power = computePower({ towers: records, totems: 0 });
    const extraPower = Math.min(extra / cfg.cashPerPower, Math.max(0, cfg.cashPowerCap - power.cashPower));
    power.extraCash = extra;
    power.extraPower = extraPower;
    power.total += extraPower;
    const degree = degreeFromPower(power.total);

    // Spawn the paragon at the source's position, keeping its targeting.
    const paragon = towerFactory.create(sourceTower.x, sourceTower.y, 'paragon_dart');
    paragon.isParagon = true;
    paragon.paragonBaseType = 'dart';
    applyApexStats(paragon, degree);
    paragon.powerBreakdown = power;
    // v1.4.1 sellable-paragon pricing: totalSpent = everything the player paid
    // for THIS paragon (source Tier 5's value + charged base + investment), so
    // getSellValue's standard 70% rate refunds a fair share of the outlay.
    paragon.totalSpent = (sourceTower.totalSpent ?? cfg.baseCost) + offer.cost + extra;
    paragon.targetingMode = sourceTower.targetingMode || 'First';
    engine.towers.push(paragon);

    // The consumed Tier 5s no longer exist, so the exclusivity ledger resets
    // (new T5s can be built toward a second paragon once this one is gone).
    engine.tier5Bought['dart-1'] = false;
    engine.tier5Bought['dart-2'] = false;
    engine.tier5Bought['dart-3'] = false;

    engine.selectedPlacedTower = paragon;
    engine.spawnPopEffect(sourceTower.x, sourceTower.y, '#ffd700');
    const investNote = extra > 0 ? ` + $${extra.toLocaleString('en-US')} invested` : '';
    engine.log(`APEX PLASMA MASTER created - Degree ${degree}! (Power ${Math.round(power.total)}${investNote})`);
    return true;
}

export { canOfferParagon, PARAGON_POWER_RULES };
export default behavior;
