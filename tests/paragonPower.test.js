// Paragon degree-engine suite (plan ch.8 "Degree curve" / "Power calculation" /
// "Degree stats"). Pure functions - no engine stubs needed.
import { describe, it, expect } from 'vitest';
import {
  DEGREE_ANCHORS, PARAGON_POWER_RULES,
  powerRequiredForDegree, degreeFromPower,
  computePower, apexStats, canOfferParagon,
} from '../js/paragonPower.js';

describe('degree curve anchors reproduce the published breakpoints', () => {
  it('anchor table holds the wiki values', () => {
    expect(DEGREE_ANCHORS).toEqual([
      [1, 0], [20, 11032], [40, 31360], [60, 66387], [80, 120115], [91, 162991], [100, 200000],
    ]);
  });

  it('powerRequiredForDegree hits every anchor exactly', () => {
    expect(powerRequiredForDegree(1)).toBe(0);
    expect(powerRequiredForDegree(20)).toBe(11032);
    expect(powerRequiredForDegree(40)).toBe(31360);
    expect(powerRequiredForDegree(60)).toBe(66387);
    expect(powerRequiredForDegree(80)).toBe(120115);
    expect(powerRequiredForDegree(91)).toBe(162991);
    expect(powerRequiredForDegree(100)).toBe(200000);
  });

  it('is monotonically nondecreasing across degrees 1-100', () => {
    let prev = -1;
    for (let d = 1; d <= 100; d++) {
      const p = powerRequiredForDegree(d);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it('degreeFromPower inverts the curve (and clamps both ends)', () => {
    expect(degreeFromPower(0)).toBe(1);
    expect(degreeFromPower(-5)).toBe(1);
    expect(degreeFromPower(11032)).toBe(20);
    expect(degreeFromPower(11031)).toBe(19);
    expect(degreeFromPower(162991)).toBe(91);
    expect(degreeFromPower(162990)).toBe(90);
    expect(degreeFromPower(199999)).toBe(99);
    expect(degreeFromPower(200000)).toBe(100);
    expect(degreeFromPower(1e12)).toBe(100);
  });

  it('round-trips every degree through the curve', () => {
    for (let d = 1; d <= 100; d += 3) {
      const p = powerRequiredForDegree(d);
      expect(degreeFromPower(p)).toBe(d);
    }
  });
});

describe('paragon power: the four sources and their caps', () => {
  const cfg = PARAGON_POWER_RULES.dart;

  it('cash power: $7,500 per point from the pool MINUS the three cheapest T5s', () => {
    const sacrifice = {
      towers: [
        { totalSpent: 15000, upgrades: [5, 0, 0], damageDealt: 0 },
        { totalSpent: 21600, upgrades: [0, 0, 5], damageDealt: 0 },
        { totalSpent: 45500, upgrades: [0, 5, 1], damageDealt: 0 },
        { totalSpent: 30000, upgrades: [2, 3, 0], damageDealt: 0 },
        { totalSpent: 12000, upgrades: [0, 0, 0], damageDealt: 0 },
      ],
    };
    const r = computePower(sacrifice);
    // Three cheapest T5s (15,000 / 21,600 / 45,500) are the entry ticket.
    expect(r.cashPool).toBe(30000 + 12000);
    expect(r.cashPower).toBeCloseTo(42000 / 7500, 6);
  });

  it('upgrade power: 100 per non-T5 tier, capped at 10,000', () => {
    const one = computePower({ towers: [{ totalSpent: 200, upgrades: [5, 2, 0], damageDealt: 0 }] });
    expect(one.upgradeTiers).toBe(6); // min(5,4) + 2
    expect(one.upgradePower).toBe(600);
    const many = computePower({ towers: Array.from({ length: 50 }, () => ({ totalSpent: 200, upgrades: [4, 4, 4], damageDealt: 0 })) });
    expect(many.upgradeTiers).toBe(600);
    expect(many.upgradePower).toBe(cfg.upgradePowerCap);
  });

  it('extra T5 power: 6,000 per T5 beyond three, capped at 50,000', () => {
    const t5 = { totalSpent: 15000, upgrades: [5, 0, 0], damageDealt: 0 };
    const three = computePower({ towers: [t5, { ...t5 }, { ...t5 }] });
    expect(three.extraT5s).toBe(0);
    expect(three.extraT5Power).toBe(0);
    const nine = computePower({ towers: Array.from({ length: 9 }, () => ({ ...t5 })) });
    expect(nine.extraT5s).toBe(6);
    expect(nine.extraT5Power).toBe(36000);
    const twelve = computePower({ towers: Array.from({ length: 12 }, () => ({ ...t5 })) });
    expect(twelve.extraT5s).toBe(9);
    expect(twelve.extraT5Power).toBe(cfg.extraT5PowerCap); // 54,000 -> capped
  });

  it('pop power: 180 pops per point (T5s included), capped at 90,000', () => {
    const r = computePower({ towers: [{ totalSpent: 200, upgrades: [0, 0, 0], damageDealt: 18000 }] });
    expect(r.pops).toBe(18000);
    expect(r.popsPower).toBeCloseTo(100, 6);
    const capped = computePower({ towers: [{ totalSpent: 200, upgrades: [0, 0, 0], damageDealt: 50e6 }] });
    expect(capped.popsPower).toBe(cfg.popsPowerCap);
  });

  it('cash power caps at 60,000 ($450,000 of sacrifices)', () => {
    const r = computePower({ towers: [{ totalSpent: 1e9, upgrades: [0, 0, 0], damageDealt: 0 }] });
    expect(r.cashPower).toBe(cfg.cashPowerCap);
  });

  it('totems add unbounded 2,000 each (Geraldo wave, config-only today)', () => {
    const r = computePower({ towers: [], totems: 3 });
    expect(r.totemPower).toBe(6000);
  });

  it('single-player ceiling: even max legal sources stay below Degree 100', () => {
    // Cash cap 60,000 + upgrade cap 10,000 + T5s 9 extra (36,000) + pops cap 90,000 = 196,000.
    // Only exactly 200,000 power reaches Degree 100 (totem / co-op inflated runs).
    const maxPower = 60000 + 10000 + 36000 + 90000;
    expect(degreeFromPower(maxPower)).toBe(99);
    expect(degreeFromPower(196001)).toBe(99);
    expect(degreeFromPower(199999)).toBe(99);
    // A realistic single-player assembly (plan ch.3: ~160k power) lands around D90/91.
    expect(degreeFromPower(160000)).toBe(90);
    expect(degreeFromPower(162991)).toBe(91);
  });
});

describe('Apex Plasma Master per-degree stats', () => {
  it('matches the published D1 anchor (pierce 200 per the MK/Popology reading)', () => {
    const s = apexStats(1);
    expect(s.damage).toBe(15);
    expect(s.ceramicDmg).toBe(90);      // 105 total vs ceramics
    expect(s.bossDmg).toBe(80);         // 95 total vs bosses
    expect(s.eliteBossDmg).toBe(175);   // 190 total vs elite bosses
    expect(s.pierce).toBe(200);
    expect(s.interval).toBe(0.4);
  });

  it('matches the published D20 and D91 anchors', () => {
    const s20 = apexStats(20);
    expect(s20.damage).toBe(18.85);
    expect(s20.ceramicDmg).toBeCloseTo(107.10, 1);
    expect(s20.bossDmg).toBeCloseTo(123.71, 1);
    expect(s20.eliteBossDmg).toBeCloseTo(266.28, 1);
    expect(s20.pierce).toBe(240);       // 239.9
    expect(s20.interval).toBeCloseTo(0.3058, 4);

    const s91 = apexStats(91);
    expect(s91.damage).toBe(37.65);
    expect(s91.ceramicDmg).toBeCloseTo(171.90, 1);
    expect(s91.bossDmg).toBeCloseTo(343.25, 1);
    expect(s91.eliteBossDmg).toBeCloseTo(724.15, 1);
    expect(s91.pierce).toBe(391);
    expect(s91.interval).toBe(0.2389);
  });

  it('interpolates monotonically between anchors and floors the interval', () => {
    const mid = apexStats(50); // halfway between D40 and D60
    expect(mid.damage).toBeCloseTo((23.85 + 28.85) / 2, 2);
    for (let d = 2; d <= 100; d++) {
      expect(apexStats(d).damage).toBeGreaterThanOrEqual(apexStats(d - 1).damage);
      expect(apexStats(d).pierce).toBeGreaterThanOrEqual(apexStats(d - 1).pierce);
      expect(apexStats(d).interval).toBeLessThanOrEqual(apexStats(d - 1).interval + 1e-9);
    }
    expect(apexStats(100).interval).toBe(0.2389);
  });
});

describe('creation gate helper', () => {
  const mkEngine = (over = {}) => ({
    isSandbox: false,
    cash: 200000,
    tier5Bought: { 'dart-1': true, 'dart-2': true, 'dart-3': true },
    towers: [],
    getCost: (c) => c,
    config: { data: { paragonUnlocks: { dart: true } } },
    ...over,
  });
  const t5 = { type: 'dart', upgrades: [0, 0, 5] };

  it('offers the paragon when every requirement holds', () => {
    const offer = canOfferParagon(mkEngine(), t5, 'dart');
    expect(offer.offered).toBe(true);
    expect(offer.cost).toBe(150000);
  });

  it('withholds the paragon when the T5s or the money are missing (XP is informational since v1.3.2)', () => {
    // The 500k-XP mastery milestone no longer gates creation (BTD6 rules).
    const noXp = canOfferParagon(mkEngine({ config: { data: { paragonUnlocks: {} } } }), t5, 'dart');
    expect(noXp.checklist.xpUnlocked).toBe(false);
    expect(noXp.offered).toBe(true); // T5s + money still hold

    const missingT5 = canOfferParagon(mkEngine({ tier5Bought: { 'dart-1': true } }), t5, 'dart');
    expect(missingT5.checklist.threeT5s).toBe(false);
    expect(missingT5.offered).toBe(false);

    const poor = canOfferParagon(mkEngine({ cash: 1000 }), t5, 'dart');
    expect(poor.checklist.affordable).toBe(false);
    expect(poor.offered).toBe(false);
  });

  it('v1.4.0: ANY tower of the type can buy once the Tier 5s exist (source tier is irrelevant)', () => {
    // BTD6: selecting any Dart Monkey shows the Paragon button once the three
    // T5s are owned. The old "source must be a Tier 5" rule is gone.
    const base = canOfferParagon(mkEngine(), { type: 'dart', upgrades: [0, 0, 0] }, 'dart');
    expect(base.eligible).toBe(true);   // purple buttons SHOW
    expect(base.offered).toBe(true);    // and the purchase can complete
    expect(base.checklist.sourceIsT5).toBeUndefined();
  });

  it('sandbox follows the same rule since v1.4.0: all three Tier 5s required', () => {
    const withoutT5s = canOfferParagon(mkEngine({ isSandbox: true, tier5Bought: {}, config: { data: {} } }), { type: 'dart', upgrades: [0, 0, 0] }, 'dart');
    expect(withoutT5s.checklist.sandbox).toBe(true);
    expect(withoutT5s.eligible).toBe(false);
    expect(withoutT5s.offered).toBe(false);

    const withT5s = canOfferParagon(mkEngine({ isSandbox: true, tier5Bought: { 'dart-1': true, 'dart-2': true, 'dart-3': true }, config: { data: {} } }), { type: 'dart', upgrades: [0, 0, 0] }, 'dart');
    expect(withT5s.eligible).toBe(true);
    expect(withT5s.offered).toBe(true);
  });

  it('eligible but unaffordable: the button shows, the purchase does not complete', () => {
    const poor = canOfferParagon(mkEngine({ cash: 1000 }), { type: 'dart', upgrades: [0, 0, 0] }, 'dart');
    expect(poor.eligible).toBe(true);
    expect(poor.offered).toBe(false);
    expect(poor.checklist.affordable).toBe(false);
  });

  it('blocks a second paragon while one exists', () => {
    const eng = mkEngine({ towers: [{ type: 'paragon_dart', isParagon: true }] });
    const offer = canOfferParagon(eng, t5, 'dart');
    expect(offer.checklist.noneExists).toBe(false);
    expect(offer.eligible).toBe(false);
    expect(offer.offered).toBe(false);
  });
});
