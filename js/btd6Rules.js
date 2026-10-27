// js/btd6Rules.js
// Pure, engine-independent BTD6 rules (verified against the Bloons wiki: round
// list, Bloon page, Super Ceramic page). Keeping them here (instead of inline in
// enemy.js) makes them unit-testable and gives every caller ONE source of truth.
import { EnemyTypes } from './data.js';

// Bloon speed multiplier by round: +2%/round from round 81, plus additive jumps
// on rounds 101 (+18%), 151 (+40%), 201 (+50%) and 252 (+48%).
export function roundSpeedRamp(round) {
    if (round <= 80) return 1.0;
    let m = 1 + (round - 80) * 0.02;
    if (round >= 101) m += 0.18;
    if (round >= 151) m += 0.40;
    if (round >= 201) m += 0.50;
    if (round >= 252) m += 0.48;
    return m;
}

// MOAB-class health multiplier by round (does not affect lives lost).
export function moabHpRamp(round) {
    if (round <= 80) return 1.0;
    if (round <= 100) return 1.0 + (round - 80) * 0.02;
    if (round <= 124) return 1.4 + (round - 100) * 0.05;
    if (round <= 150) return 2.6 + (round - 124) * 0.15;
    if (round <= 250) return 6.5 + (round - 150) * 0.35;
    if (round <= 300) return 41.5 + (round - 250) * 1.0;
    if (round <= 400) return 91.5 + (round - 300) * 1.5;
    if (round <= 500) return 241.5 + (round - 400) * 2.5;
    return 5 * round - 2008.5;
}

// Stun / freeze / slow duration multiplier. The wiki lists the reduction
// starting on round 150 (NOT round 81): -10% per 50 rounds, capped at -50%.
export function statusDurationFactor(round) {
    if (round < 150) return 1.0;
    if (round < 200) return 0.9;
    if (round < 250) return 0.8;
    if (round < 300) return 0.7;
    if (round < 350) return 0.6;
    return 0.5;
}

// Cash-per-pop multiplier by round. BTD6 curve (Bloons wiki "Money"):
// 1.0 / 0.5 (R51+) / 0.2 (R61+) / 0.1 (R86+) / 0.05 (R101+) / 0.02 (R121+).
// The old intermediate 0.04 tier at R121-140 was the game's ONLY economy
// divergence from BTD6 - removed in v1.3.0 so late-round income is 1:1.
export function cashMultForRound(round) {
    if (round >= 121) return 0.02;
    if (round >= 101) return 0.05;
    if (round >= 86) return 0.10;
    if (round >= 61) return 0.20;
    if (round >= 51) return 0.50;
    return 1.0;
}

// BTD6 pays $1 per LAYER popped (MOAB-class layers also count as 1 each).
// treeLayers(tier) = layers in the whole tree (Red 1, Pink 5, Ceramic 95, MOAB 381, ZOMG 6101).
const _layerCache = new Map();
export function treeLayers(tier) {
    if (_layerCache.has(tier)) return _layerCache.get(tier);
    const d = EnemyTypes[tier];
    let n = 1;
    if (d.splitsInto) for (const c of d.splitsInto) n += c.count * treeLayers(c.tier);
    else if (d.nextTier) n += treeLayers(d.nextTier);
    _layerCache.set(tier, n);
    return n;
}

// Lives lost when a bloon leaks. Up to round 80 this is the bloon's RBE
// (Ceramic 104, MOAB 616, ZOMG 16656, BAD 55760; fortified: Lead 26, Ceramic 114,
// MOAB 856...). From round 81 ceramics are Super Ceramics (65 / 75 fortified),
// which gives MOAB 460/700 and DDT 660/1100 (wiki).
export function leakLives(tier, { round = 1, fortified = false, hpRatio = 1 } = {}) {
    const d = EnemyTypes[tier];
    if (d.isMoab || d.isBAD) {
        const hp = Math.max(0, Math.ceil(d.maxHp * (fortified ? 2 : 1) * hpRatio));
        let kids = 0;
        for (const c of (d.splitsInto || [])) kids += c.count * leakLives(c.tier, { round, fortified, hpRatio: 1 });
        return hp + kids;
    }
    if (d.isCeramic) {
        if (round >= 81) return fortified ? 75 : 65;
        return fortified ? 114 : 104;
    }
    if (d.isLead) return d.rbe + (fortified ? 3 : 0);
    return d.rbe;
}

// From round 81 every non-MOAB-class bloon releases ONE child per layer instead of two
// (wiki: "a Lead releases two Blacks, only one on rounds 81+"; it is also what makes a Super
// Ceramic's remaining layers add up to 8 RBE). Returns the splitsInto to use at that point.
export function singleChildSplit(tier) {
    const d = EnemyTypes[tier];
    if (!d.splitsInto || d.isMoab || d.isBAD) return d.splitsInto;
    if (tier === 9) return [{ tier: 7, count: 1 }];          // Zebra -> White (kept from the old chain)
    return [{ ...d.splitsInto[0], count: 1 }];
}
