// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// audio + mobile must be mocked (real modules touch window/AudioContext in ways
// that break under vitest; same FIX as towerEconomy.test.js).
vi.mock('../js/audio.js', () => ({
  AudioEngine: { playSfx: vi.fn() }
}));

vi.mock('../js/mobile.js', () => ({
  MobileManager: { spriteScale: 1, isActive: false, toggle: vi.fn() },
  isMobile: { any: () => false }
}));

// Importing engine.js populates the REAL GameEngine singleton via Object.assign,
// giving us the real getCost(), while Upgrades/config come from real game data.
import { GameEngine } from '../js/engineRef.js';
import '../js/engine.js';
import { Difficulties, Config } from '../js/config.js';
import TowerEconomy, { getSellValue, getSellRate } from '../js/towerEconomy.js';
import { Upgrades } from '../js/towers/index.js';

function makeTower(type = 'dart', upgrades = [0, 0, 0]) {
  const tower = {
    type,
    upgrades: [...upgrades],
    totalSpent: 0,
    isMinion: false,
    discount: 0,
    stats: {},
    _applyUpgradeStats: vi.fn(),
    _recalculateStats: vi.fn(),
    _postUpgradeHook: vi.fn()
  };
  return Object.assign(tower, TowerEconomy);
}

describe('Upgrade cost scaling (real engine.getCost + real upgrade data)', () => {
  beforeEach(() => {
    Config.data.mkActive = true;
    Config.data.monkeyKnowledge = {};
    GameEngine.difficulty = null;
    GameEngine.tier5Bought = {};
    GameEngine.updateUI = vi.fn(); // stub DOM refresh
  });

  it('engine.getCost applies each difficulty costMod (easy 0.85 / medium 1.0 / hard 1.08)', () => {
    GameEngine.difficulty = Difficulties.easy;
    expect(GameEngine.getCost(1000)).toBe(850);

    GameEngine.difficulty = Difficulties.medium;
    expect(GameEngine.getCost(1000)).toBe(1000);

    GameEngine.difficulty = Difficulties.hard;
    expect(GameEngine.getCost(1000)).toBe(1080);
  });

  it('getCost floors the result', () => {
    GameEngine.difficulty = Difficulties.hard; // 999 * 1.08 = 1078.92
    expect(GameEngine.getCost(999)).toBe(1078);
  });

  it('getCost falls back to 1.0 when no difficulty is set', () => {
    GameEngine.difficulty = null;
    expect(GameEngine.getCost(1000)).toBe(1000);
  });

  it('upgrade() deducts the difficulty-scaled cost and increments the tier', () => {
    const t = makeTower('dart');
    GameEngine.cash = 100000;
    GameEngine.difficulty = Difficulties.medium;

    const C = Upgrades.dart[1][0].cost;
    const ok = t.upgrade(1, GameEngine);

    expect(ok).toBe(true);
    expect(t.upgrades[0]).toBe(1);
    expect(GameEngine.cash).toBe(100000 - C);
    expect(t.totalSpent).toBe(C);
  });

  it('upgrade() on Easy charges 85%', () => {
    const t = makeTower('dart');
    GameEngine.cash = 100000;
    GameEngine.difficulty = Difficulties.easy;

    const C = Math.floor(Upgrades.dart[1][0].cost * 0.85);
    const before = GameEngine.cash;
    expect(t.upgrade(1, GameEngine)).toBe(true);
    expect(GameEngine.cash - before).toBe(-C);
    expect(t.totalSpent).toBe(C);
  });

  it('MK "sub" effect subtracts before difficulty scaling (budget_clusters)', () => {
    Config.data.monkeyKnowledge = { budget_clusters: true };
    const t = makeTower('bomb', [2, 0, 0]); // condition: upgrades[0] === 2
    GameEngine.cash = 1000000;
    GameEngine.difficulty = Difficulties.medium;

    const C = Upgrades.bomb[1][2].cost - 100;
    const before = GameEngine.cash;
    expect(t.upgrade(1, GameEngine)).toBe(true);
    expect(GameEngine.cash - before).toBe(-C);
  });

  it('MK "mult" effect scales cost before difficulty (aeronautic_subsidy)', () => {
    Config.data.monkeyKnowledge = { aeronautic_subsidy: true };
    const t = makeTower('ace', [4, 0, 0]); // condition: upgrades[0] === 4
    GameEngine.cash = 1000000;
    GameEngine.difficulty = Difficulties.medium;

    const C = Math.floor(Upgrades.ace[1][4].cost * 0.9);
    const before = GameEngine.cash;
    expect(t.upgrade(1, GameEngine)).toBe(true);
    expect(GameEngine.cash - before).toBe(-C);
  });

  it('MK cost effects do not apply when mkActive is false', () => {
    Config.data.mkActive = false;
    Config.data.monkeyKnowledge = { budget_clusters: true };
    const t = makeTower('bomb', [2, 0, 0]);
    GameEngine.cash = 1000000;
    GameEngine.difficulty = Difficulties.medium;

    const C = Upgrades.bomb[1][2].cost; // no -100
    const before = GameEngine.cash;
    expect(t.upgrade(1, GameEngine)).toBe(true);
    expect(GameEngine.cash - before).toBe(-C);
  });

  it('tower.discount further reduces the cost after difficulty scaling', () => {
    const t = makeTower('dart');
    t.discount = 0.1; // 10% off (e.g. village discount zone)
    GameEngine.cash = 100000;
    GameEngine.difficulty = Difficulties.medium;

    const C = Math.floor(Math.floor(Upgrades.dart[1][0].cost * 1.0) * 0.9);
    const before = GameEngine.cash;
    expect(t.upgrade(1, GameEngine)).toBe(true);
    expect(GameEngine.cash - before).toBe(-C);
  });

  it('upgrade() fails without enough cash and changes nothing', () => {
    const t = makeTower('dart');
    GameEngine.cash = Upgrades.dart[1][0].cost - 1;
    GameEngine.difficulty = Difficulties.medium;

    expect(t.upgrade(1, GameEngine)).toBe(false);
    expect(t.upgrades[0]).toBe(0);
    expect(t.totalSpent).toBe(0);
  });

  it('consecutive upgrades climb tiers and accumulate totalSpent', () => {
    const t = makeTower('dart');
    GameEngine.cash = 1000000;
    GameEngine.difficulty = Difficulties.medium;

    let spent = 0;
    for (let tier = 0; tier < 5; tier++) {
      expect(t.upgrade(1, GameEngine)).toBe(true);
      spent += Upgrades.dart[1][tier].cost;
    }
    expect(t.upgrades[0]).toBe(5);
    expect(t.totalSpent).toBe(spent);
  });
});

describe('Upgrade eligibility rules (canUpgrade)', () => {
  beforeEach(() => {
    GameEngine.tier5Bought = {};
    GameEngine.difficulty = Difficulties.medium;
  });

  it('blocks upgrading a path already at tier 5', () => {
    const t = makeTower('dart', [5, 0, 0]);
    expect(t.canUpgrade(1, GameEngine)).toBe(false);
  });

  it('blocks starting a third path (BTD6 two-path rule)', () => {
    const t = makeTower('dart', [1, 1, 0]);
    expect(t.canUpgrade(3, GameEngine)).toBe(false);
  });

  it('blocks tier 3+ crosspath when another path already has tier 3 (5-2-0 rule)', () => {
    const t = makeTower('dart', [3, 2, 0]);
    expect(t.canUpgrade(2, GameEngine)).toBe(false);
  });

  it('still allows tier 2 crosspath next to a tier-3 path', () => {
    const t = makeTower('dart', [3, 1, 0]);
    expect(t.canUpgrade(2, GameEngine)).toBe(true);
  });

  it('gates tier 5 behind engine.tier5Bought when no behavior override exists', () => {
    const t = makeTower('dart', [4, 0, 0]);
    GameEngine.tier5Bought['dart-1'] = true;
    expect(t.canUpgrade(1, GameEngine)).toBe(false);
  });

  it('blocks upgrades for minions', () => {
    const t = makeTower('dart');
    t.isMinion = true;
    expect(t.canUpgrade(1, GameEngine)).toBe(false);
  });
});

describe('Sell value & selling', () => {
  beforeEach(() => {
    Config.data.mkActive = true;
    Config.data.monkeyKnowledge = {};
    GameEngine.tier5Bought = {};
    GameEngine.updateUI = vi.fn();
    GameEngine.cash = 0;
  });

  it('getSellValue floors 70% of totalSpent', () => {
    const t = makeTower('dart');
    t.totalSpent = 1001;
    expect(getSellValue(t, GameEngine)).toBe(Math.floor(1001 * 0.70));
  });

  it('sell() adds the sell value to engine cash', () => {
    const t = makeTower('dart');
    t.totalSpent = 1000;
    t.sell(GameEngine);
    expect(GameEngine.cash).toBe(700);
  });

  it('sell() releases the tier-5 flag so it can be bought again', () => {
    const t = makeTower('dart', [5, 0, 0]);
    GameEngine.tier5Bought['dart-1'] = true;
    t.totalSpent = 5000;

    t.sell(GameEngine);

    expect(GameEngine.tier5Bought['dart-1']).toBe(false);
    expect(GameEngine.cash).toBe(3500);
  });

  it('sell rate composition still respects MK perks (75% with better_sell_deals)', () => {
    Config.data.monkeyKnowledge = { better_sell_deals: true };
    const t = makeTower('dart');
    t.totalSpent = 1000;
    expect(getSellRate(t, GameEngine)).toBe(0.75);
    expect(getSellValue(t, GameEngine)).toBe(750);
  });
});
