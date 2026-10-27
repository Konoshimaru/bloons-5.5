// js/paragonPower.js
// ============================================================================
// PARAGON POWER ENGINE - Wave 1 (Apex Plasma Master)
// ============================================================================
// Pure, dependency-free module: every function takes data in and returns an
// answer out, so the whole degree engine is unit-testable without stubbing the
// game engine (implementation plan chapter 5). Behavior/UI code lives in
// js/towers/paragon_dart.js; this file only owns NUMBERS and CURVES.
//
// Sources (Bloons wiki, cross-checked during the Task 24 planning audit):
//   - Cash invested:   $7,500 per 1 power, cap 60,000 (=$450,000 of sacrifices).
//     The three cheapest Tier-5 darts in the sacrifice pool are the "entry
//     ticket": their cash is EXCLUDED from cash power (their pops still count).
//   - Upgrade tiers:   100 power per non-T5 upgrade tier, cap 10,000.
//   - Extra Tier 5s:   6,000 power per T5 beyond the required three, cap 50,000.
//   - Pops:            180 pops per 1 power, cap 90,000 (= 16.2M pops).
//   - Power Totems:    2,000 each, unbounded (Geraldo item - deferred to the
//     Geraldo wave per the owner's Wave-1 decision; the rate is kept here as
//     data so nothing needs to change when it ships).
//
// Degree curve: the wiki's closed-form cubic does not reproduce the wiki's own
// published breakpoints (P(80) evaluates to ~123M, not 120,115), so the
// published anchors are the authoritative curve and are interpolated
// monotonically between (plan chapter 3). Re-verifying the closed form stays a
// standing task; degreeFromPower() is the single function boundary to swap.
// ============================================================================

// ---------------------------------------------------------------------------
// Per-paragon configuration. Wave 2+ paragons add their own block here; the
// engine reads everything from this table.
//
// v1.4.1 Wave 2 - GLAIVE DOMINUS (Boomerang Monkey). Pricing mirrors BTD6's
// relative costs: bloonswiki lists Apex Plasma Master at $162,000 Medium and
// Glaive Dominus at $405,000 Medium (2.5x), and this game ships APM at
// $150,000, so the Dominus lands at $375,000. Every OTHER paragon rule is
// universal in BTD6 (same $7,500-per-power cash rate, same caps), so the
// degree curve and power constants are shared with the dart.
// ---------------------------------------------------------------------------
export const PARAGON_POWER_RULES = {
    dart: {
        key: 'dart',
        paragonType: 'paragon_dart',
        name: 'Apex Plasma Master',
        baseCost: 150000,            // Medium; engine.getCost() applies difficulty
        requiredT5s: 3,
        cashPerPower: 7500,
        cashPowerCap: 60000,
        powerPerUpgradeTier: 100,
        upgradePowerCap: 10000,
        powerPerExtraT5: 6000,
        extraT5PowerCap: 50000,
        popsPerPower: 180,
        popsPowerCap: 90000,
        powerPerTotem: 2000,
        xpToUnlock: 500000,          // BTD6 tower-XP gate (main menu unlock)
    },
    boomerang: {
        key: 'boomerang',
        paragonType: 'paragon_boomerang',
        name: 'Glaive Dominus',
        baseCost: 375000,            // Medium = APM $150k x BTD6's 2.5x ratio (wiki $162k -> $405k)
        requiredT5s: 3,
        cashPerPower: 7500,
        cashPowerCap: 60000,
        powerPerUpgradeTier: 100,
        upgradePowerCap: 10000,
        powerPerExtraT5: 6000,
        extraT5PowerCap: 50000,
        popsPerPower: 180,
        popsPowerCap: 90000,
        powerPerTotem: 2000,
        xpToUnlock: 500000,
    },
};

// ---------------------------------------------------------------------------
// Degree curve anchors: [degree, power required]. Degree 1 costs nothing.
// D100 is exactly 200,000 and is reserved for totem / co-op inflated runs;
// a single player tops out around 160,000 power = Degree 91 (wiki).
// ---------------------------------------------------------------------------
export const DEGREE_ANCHORS = [
    [1, 0],
    [20, 11032],
    [40, 31360],
    [60, 66387],
    [80, 120115],
    [91, 162991],
    [100, 200000],
];

const _lastAnchorIdx = DEGREE_ANCHORS.length - 1;

// Power required to reach a given degree (monotone piecewise-linear through
// the published anchors). Degree below 1 clamps to 1's requirement (0).
export function powerRequiredForDegree(degree) {
    const d = Math.max(1, Math.min(100, Math.floor(degree)));
    if (d >= DEGREE_ANCHORS[_lastAnchorIdx][0]) return DEGREE_ANCHORS[_lastAnchorIdx][1];
    for (let i = 1; i < DEGREE_ANCHORS.length; i++) {
        const [d1, p1] = DEGREE_ANCHORS[i - 1];
        const [d2, p2] = DEGREE_ANCHORS[i];
        if (d <= d2) {
            const t = (d - d1) / (d2 - d1);
            return p1 + (p2 - p1) * t;
        }
    }
    return DEGREE_ANCHORS[_lastAnchorIdx][1];
}

// Invert the curve: the highest degree whose requirement the power satisfies.
// Degree 1 is free, so any power (even 0) yields at least degree 1.
// Walks the anchor segments upward; the first segment whose UPPER anchor the
// power has not yet reached is the segment the power lives in.
export function degreeFromPower(power) {
    const p = Math.max(0, Number(power) || 0);
    if (p >= DEGREE_ANCHORS[_lastAnchorIdx][1]) return 100;
    for (let i = 1; i < DEGREE_ANCHORS.length; i++) {
        const [d1, p1] = DEGREE_ANCHORS[i - 1];
        const [d2, p2] = DEGREE_ANCHORS[i];
        if (p < p2) {
            const t = (p - p1) / (p2 - p1);
            const d = d1 + (d2 - d1) * t;
            return Math.max(1, Math.min(d2, Math.floor(d + 1e-9)));
        }
    }
    return 100;
}

// ---------------------------------------------------------------------------
// Apex Plasma Master per-degree stat anchors (wiki table, "per ball").
// Damage values are TOTAL damage against that class; the behavior layer turns
// them into (damage, ceramicDmg, bossDmg) bonuses. Boss/Elite Boss columns
// apply to Boss bloons only (no such entity class in Wave 1 yet - the Elite
// column is stored for the future boss-event wave, exactly as published).
// D100 is not published on the wiki; it is extrapolated from the D80->D91
// slope and flagged for re-verification (plan chapter 6).
// ---------------------------------------------------------------------------
export const APM_STAT_ANCHORS = {
    1:    { interval: 0.4000, dmg: 15.00, ceramic: 105.00, boss: 95.00,  elite: 190.00,  pierce: 200.0 },
    20:   { interval: 0.3058, dmg: 18.85, ceramic: 125.95, boss: 142.56, elite: 285.13,  pierce: 239.9 },
    40:   { interval: 0.2775, dmg: 23.85, ceramic: 148.95, boss: 202.58, elite: 405.15,  pierce: 281.9 },
    60:   { interval: 0.2592, dmg: 28.85, ceramic: 171.95, boss: 273.09, elite: 546.18,  pierce: 323.9 },
    80:   { interval: 0.2456, dmg: 33.85, ceramic: 194.95, boss: 354.10, elite: 708.20,  pierce: 365.9 },
    91:   { interval: 0.2389, dmg: 37.65, ceramic: 209.55, boss: 380.90, elite: 761.80,  pierce: 391.1 },
    // EXTRAPOLATED (not wiki-published): same slope as D80->D91, interval floored.
    100:  { interval: 0.2389, dmg: 40.76, ceramic: 221.50, boss: 402.83, elite: 805.65,  pierce: 411.72 },
};

const _APM_DEGREES = Object.keys(APM_STAT_ANCHORS).map(Number).sort((a, b) => a - b);

function _interpStat(degree, field) {
    const d = Math.max(1, Math.min(100, degree));
    if (APM_STAT_ANCHORS[d] !== undefined) return APM_STAT_ANCHORS[d][field];
    for (let i = 1; i < _APM_DEGREES.length; i++) {
        const d1 = _APM_DEGREES[i - 1], d2 = _APM_DEGREES[i];
        if (d <= d2) {
            const a = APM_STAT_ANCHORS[d1][field], b = APM_STAT_ANCHORS[d2][field];
            return a + (b - a) * ((d - d1) / (d2 - d1));
        }
    }
    return APM_STAT_ANCHORS[100][field];
}

const _round2 = (v) => Math.round(v * 100) / 100;
const _round4 = (v) => Math.round(v * 10000) / 10000;

// Per-degree stat block for the Apex Plasma Master. `ceramicDmg`/`bossDmg`
// are BONUS values on top of the base damage (the fan game's damage pipeline
// adds them on class matches), so they are stored as (total - base).
export function apexStats(degree) {
    const base = _interpStat(degree, 'dmg');
    return {
        degree: Math.max(1, Math.min(100, Math.floor(degree))),
        interval: Math.max(0.2389, _round4(_interpStat(degree, 'interval'))),
        damage: _round2(base),
        ceramicDmg: _round2(_interpStat(degree, 'ceramic') - base),
        bossDmg: _round2(_interpStat(degree, 'boss') - base),
        eliteBossDmg: _round2(_interpStat(degree, 'elite') - base),
        pierce: Math.round(_interpStat(degree, 'pierce')),
    };
}

// ---------------------------------------------------------------------------
// Glaive Dominus per-degree stat anchors (v1.4.2 - REAL WIKI POWER).
// Sources: bloons.fandom.com + bloonswiki.com "Glaive Dominus" stat tables.
//   - Glaive (main attack): Degrees 1/20/40 are wiki-exact - damage 25 ->
//     30.75 -> 37.75, boss TOTAL 75 -> 90.25 -> 107.25, pierce 60 -> 72.9 ->
//     86.9, cooldown 0.04s -> 0.03058s -> 0.02775s. v1.4.1 shipped this at a
//     0.4s cadence (10x slower) which is why the Dominus felt weak.
//   - Glaive Ring (orbital): D1 damage 42 with +20 Ceramic / +20 MOAB /
//     +150 Boss bonuses, 200 pierce, 0.1s tick (fandom D1 row). D20/40 ring
//     ceramic + MOAB bonuses follow bloonswiki; the ring BOSS bonus column on
//     bloonswiki contradicts fandom's D1 total (192), so it is derived from
//     fandom's D1 +150 scaled by the ring damage growth instead.
//   - MOAB Press (anti-MOAB glaive + explosion): wiki D1 1 dmg + 20 MOAB,
//     pierce 300, every 3s; explosion 2500 (+4000 boss) at D1, 2976/3478 and
//     +4760/+5560 at D20/40. Shred DoT 750/s for 15s, Burn 500/s for 4s.
//   - Elite-boss column = 2x boss (fandom's D1 ratio for every attack).
//   - Degrees 60/80/91/100 extend the D20->D40 slopes (same extrapolation
//     honesty as the APM D100 note; intervals floored at 0.02 / 0.05).
// ---------------------------------------------------------------------------
export const GD_STAT_ANCHORS = {
    1:    { interval: 0.0400,  dmg: 25.00, boss: 75.00,  elite: 150.00, pierce: 60.0,
            orbDmg: 42.00,  orbCer: 20.00,  orbMoab: 20.00,  orbBoss: 150.00, orbPierce: 200.0, orbInterval: 0.1000,
            pressDmg: 1.00,  pressMoab: 20.00,  expl: 2500, explBoss: 4000, shred: 750.0,  burn: 500.0 },
    20:   { interval: 0.03058, dmg: 30.75, boss: 90.25,  elite: 180.50, pierce: 72.9,
            orbDmg: 50.98,  orbCer: 23.80,  orbMoab: 178.50, orbBoss: 182.07, orbPierce: 239.9, orbInterval: 0.07644,
            pressDmg: 2.19,  pressMoab: 22.61,  expl: 2976, explBoss: 4760, shred: 893.5, burn: 596.0 },
    40:   { interval: 0.02775, dmg: 37.75, boss: 107.25, elite: 214.50, pierce: 86.9,
            orbDmg: 61.38,  orbCer: 27.80,  orbMoab: 208.50, orbBoss: 219.21, orbPierce: 281.9, orbInterval: 0.06937,
            pressDmg: 4.39,  pressMoab: 26.41,  expl: 3478, explBoss: 5560, shred: 1046.0, burn: 698.0 },
    // EXTRAPOLATED from the D20->D40 slopes (see note above).
    60:   { interval: 0.02492, dmg: 44.75, boss: 124.25, elite: 248.50, pierce: 100.9,
            orbDmg: 71.78,  orbCer: 31.80,  orbMoab: 238.50, orbBoss: 256.35, orbPierce: 323.9, orbInterval: 0.06230,
            pressDmg: 6.59,  pressMoab: 30.21,  expl: 3980, explBoss: 6360, shred: 1198.5, burn: 800.0 },
    80:   { interval: 0.02209, dmg: 51.75, boss: 141.25, elite: 282.50, pierce: 114.9,
            orbDmg: 82.18,  orbCer: 35.80,  orbMoab: 268.50, orbBoss: 293.49, orbPierce: 365.9, orbInterval: 0.05523,
            pressDmg: 8.79,  pressMoab: 34.01,  expl: 4482, explBoss: 7160, shred: 1351.0, burn: 902.0 },
    91:   { interval: 0.02054, dmg: 55.60, boss: 150.58, elite: 301.15, pierce: 120.4,
            orbDmg: 86.94,  orbCer: 37.98,  orbMoab: 285.08, orbBoss: 313.72, orbPierce: 391.7, orbInterval: 0.05136,
            pressDmg: 9.80,  pressMoab: 36.10,  expl: 4657, explBoss: 7420, shred: 1434.4, burn: 957.7 },
    100:  { interval: 0.0200,  dmg: 58.75, boss: 158.25, elite: 316.50, pierce: 128.9,
            orbDmg: 92.58,  orbCer: 39.80,  orbMoab: 298.50, orbBoss: 330.63, orbPierce: 407.9, orbInterval: 0.0500,
            pressDmg: 10.99, pressMoab: 37.81,  expl: 4984, explBoss: 7960, shred: 1504.0, burn: 1004.0 },
};

const _GD_DEGREES = Object.keys(GD_STAT_ANCHORS).map(Number).sort((a, b) => a - b);

function _interpGdStat(degree, field) {
    const d = Math.max(1, Math.min(100, degree));
    if (GD_STAT_ANCHORS[d] !== undefined) return GD_STAT_ANCHORS[d][field];
    for (let i = 1; i < _GD_DEGREES.length; i++) {
        const d1 = _GD_DEGREES[i - 1], d2 = _GD_DEGREES[i];
        if (d <= d2) {
            const a = GD_STAT_ANCHORS[d1][field], b = GD_STAT_ANCHORS[d2][field];
            return a + (b - a) * ((d - d1) / (d2 - d1));
        }
    }
    return GD_STAT_ANCHORS[100][field];
}

// Per-degree stat block for the Glaive Dominus (v1.4.2 real wiki power).
// Same bonus convention as apexStats: glaive `boss`/`elite` anchors are TOTAL
// values stored as (total - base) bonuses for the damage pipeline. The ring
// bonuses are ring-specific flat additions; the MOAB-Press kit carries its own
// damage, explosion, Shred and Burn numbers read by the behavior layer.
export function glaiveStats(degree) {
    const base = _interpGdStat(degree, 'dmg');
    const boss = _interpGdStat(degree, 'boss');
    const elite = _interpGdStat(degree, 'elite');
    return {
        degree: Math.max(1, Math.min(100, Math.floor(degree))),
        // Main glaive: one glaive per attack at the wiki's hypersonic cadence.
        interval: Math.max(0.02, _round4(_interpGdStat(degree, 'interval'))),
        damage: _round2(base),
        bossDmg: _round2(boss - base),
        eliteBossDmg: _round2(elite - base),
        pierce: Math.round(_interpGdStat(degree, 'pierce')),
        // Glaive Ring (Glaive Lord heritage): 3 orbiting glaives.
        orbitalDamage: _round2(_interpGdStat(degree, 'orbDmg')),
        orbitalPierce: Math.round(_interpGdStat(degree, 'orbPierce')),
        orbitalInterval: Math.max(0.05, _round4(_interpGdStat(degree, 'orbInterval'))),
        orbitalCeramicDmg: _round2(_interpGdStat(degree, 'orbCer')),
        orbitalMoabDmg: _round2(_interpGdStat(degree, 'orbMoab')),
        orbitalBossDmg: _round2(_interpGdStat(degree, 'orbBoss')),
        // MOAB Press (MOAB Domination heritage): anti-MOAB glaive + explosion.
        pressDmg: _round2(_interpGdStat(degree, 'pressDmg')),
        pressMoabDmg: _round2(_interpGdStat(degree, 'pressMoab')),
        pressInterval: 3,
        pressPierce: 300,
        explosionDamage: Math.round(_interpGdStat(degree, 'expl')),
        explosionBossDmg: Math.round(_interpGdStat(degree, 'explBoss')),
        // Shred on the glaive's first hit; Burn from the Press explosion.
        shredDps: Math.round(_interpGdStat(degree, 'shred')),
        shredDuration: 15,
        burnDps: Math.round(_interpGdStat(degree, 'burn')),
        burnDuration: 4,
    };
}

// ---------------------------------------------------------------------------
// Power calculation. `sacrifice` = {
//   towers: [{ totalSpent, upgrades: [n,n,n], damageDealt }],  // every dart consumed
//   totems: Number                                             // Geraldo items (Wave: Geraldo)
// }
// Returns a full breakdown for the UI tooltip plus the total power.
// ---------------------------------------------------------------------------
export function computePower(sacrifice, paragonKey = 'dart') {
    const cfg = PARAGON_POWER_RULES[paragonKey];
    if (!cfg) return null;
    const towers = (sacrifice && sacrifice.towers) || [];
    const totems = Math.max(0, Math.floor((sacrifice && sacrifice.totems) || 0));

    // Cash pool: every sacrificed tower contributes totalSpent, EXCEPT the
    // three cheapest Tier-5 towers in the pool (the entry ticket).
    const t5s = towers.filter(t => (t.upgrades || []).some(u => u >= 5));
    const nonT5s = towers.filter(t => !(t.upgrades || []).some(u => u >= 5));
    const t5ByCash = [...t5s].sort((a, b) => (a.totalSpent || 0) - (b.totalSpent || 0));
    const excluded = new Set(t5ByCash.slice(0, cfg.requiredT5s));
    let cashPool = 0;
    for (const t of towers) if (!excluded.has(t)) cashPool += (t.totalSpent || 0);
    const cashPower = Math.min(cfg.cashPowerCap, cashPool / cfg.cashPerPower);

    // Upgrade tiers: every purchased tier below 5 counts (a tier-5 path still
    // has four non-T5 tiers on it).
    let upgradeTiers = 0;
    for (const t of towers) {
        const ups = t.upgrades || [0, 0, 0];
        for (const tier of ups) upgradeTiers += Math.min(tier || 0, 4);
    }
    const upgradePower = Math.min(cfg.upgradePowerCap, upgradeTiers * cfg.powerPerUpgradeTier);

    // Extra Tier 5s beyond the required three.
    const extraT5s = Math.max(0, t5s.length - cfg.requiredT5s);
    const extraT5Power = Math.min(cfg.extraT5PowerCap, extraT5s * cfg.powerPerExtraT5);

    // Pops: every dart pop counts, including the entry-ticket T5s.
    let pops = 0;
    for (const t of towers) pops += (t.damageDealt || 0);
    const popsPower = Math.min(cfg.popsPowerCap, pops / cfg.popsPerPower);

    const totemPower = totems * cfg.powerPerTotem;

    return {
        cashPool, cashPower,
        upgradeTiers, upgradePower,
        extraT5s, extraT5Power,
        pops, popsPower,
        totems, totemPower,
        total: cashPower + upgradePower + extraT5Power + popsPower + totemPower,
    };
}

// ---------------------------------------------------------------------------
// Creation gate helper. `engine` needs: isSandbox, tier5Bought, towers,
// config.data (paragonUnlocks). Returns an offer object with a checklist the
// upgrade card renders directly.
//
// v1.3.2: the 500,000-XP mastery unlock no longer gates in-game creation
// (BTD6 has no such gate). The XP track lives on as the MONKEYS-menu mastery
// milestone (paragonUnlocks flag), still reported in the checklist.
//
// v1.4.0 (BTD6 purchase flow): ONE rule everywhere, sandbox included - the
// Paragon button appears only once ALL three Tier 5s of the type are owned,
// and then ANY tower of that type can buy it (in BTD6 selecting any Dart
// Monkey shows the Paragon upgrade once the T5s exist). The old sandbox
// free-offer bypass and the "selected tower must be a Tier 5" rule are gone.
//   eligible = all three T5s + no paragon of the type on the field
//              -> the purple buttons SHOW (affordability not required)
//   offered  = eligible + cash >= cost
//              -> the purchase can actually complete
// ---------------------------------------------------------------------------
export function canOfferParagon(engine, sourceTower, paragonKey = 'dart') {
    const cfg = PARAGON_POWER_RULES[paragonKey];
    if (!cfg || !sourceTower) return { offered: false, eligible: false, reason: 'unknown' };

    const checklist = {
        sandbox: !!engine.isSandbox, // informational only - sandbox follows the same rule (v1.4.0)
        xpUnlocked: false,   // MONKEYS-menu mastery milestone (informational)
        threeT5s: false,     // all three tier5Bought flags for this type
        noneExists: false,   // only one paragon of a type may exist at a time
        affordable: false,
    };

    checklist.noneExists = !engine.towers.some(t => t && t.type === cfg.paragonType);
    const cost = engine.getCost ? engine.getCost(cfg.baseCost) : cfg.baseCost;
    checklist.affordable = (engine.cash || 0) >= cost;

    checklist.xpUnlocked = !!(engine.config && engine.config.data &&
        engine.config.data.paragonUnlocks && engine.config.data.paragonUnlocks[paragonKey]);
    const tb = engine.tier5Bought || {};
    checklist.threeT5s = !!(tb[`${paragonKey}-1`] && tb[`${paragonKey}-2`] && tb[`${paragonKey}-3`]);

    const eligible = checklist.noneExists && checklist.threeT5s;
    return {
        offered: eligible && checklist.affordable,
        eligible,
        sandbox: checklist.sandbox,
        cost,
        checklist,
        cfg,
    };
}
