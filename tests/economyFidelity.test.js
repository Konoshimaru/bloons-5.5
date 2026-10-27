// Economy fidelity suite (P0 deliverable, paragon plan ch.7): the fan game's
// prices and income curve are compared against the live BTD6 Medium reference
// values. dart/ninja/super are pinned to the dollar; the reference data was
// fetched from the Bloons wiki during the v1.3.0 pass (October 2026 patch).
//
// Run with GEN_ECONOMY_CSV=1 to (re)generate docs/economy_reference.csv from
// the live tower data - the permanent per-tower delta report from the plan.
import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { G } = vi.hoisted(() => {
  const G = {
    config: { data: { mkActive: true, monkeyKnowledge: {} } },
    difficulty: { costMod: 1.0 },
    waveManager: { currentWave: 1 },
    towers: [], enemies: [], explosions: [],
    enemyGrid: { query: () => [] },
    projectilePool: { get: () => ({ init: () => {} }) },
    floatingTexts: [],
    spawnPopEffect: vi.fn(),
    addCash: vi.fn(),
    log: vi.fn(),
    getCost: (c) => Math.floor(c),
    tier5Bought: {},
    isSandbox: false,
  };
  return { G };
});
vi.mock('../js/engineRef.js', () => ({ GameEngine: G }));
vi.mock('../js/audio.js', () => ({ AudioEngine: { playSfx: vi.fn(), pause: vi.fn() } }));
vi.mock('../js/assets.js', () => ({ default: { get: () => null, preloadCracks: vi.fn() } }));
vi.mock('../js/config.js', () => ({ Config: { data: {}, save: vi.fn() }, CANVAS_WIDTH: 1280, CANVAS_HEIGHT: 360, RANGE_SCALE: 3.0 }));
vi.mock('../js/mobile.js', () => ({ MobileManager: { spriteScale: 1, isActive: false, toggle: vi.fn() } }));

import { TowerStats, Upgrades, TowerRegistry, TOWER_CATEGORIES } from '../js/towers/index.js';
import { cashMultForRound } from '../js/btd6Rules.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, '..');

// ---------------------------------------------------------------------------
// Live BTD6 Medium reference (Bloons wiki, fetched 2026-10, current patch).
// [path, [t1..t5]]
// ---------------------------------------------------------------------------
const BTD6_MEDIUM = {
  dart: {
    base: 200,
    paths: {
      1: [140, 200, 320, 1800, 15000],
      2: [100, 190, 450, 7200, 45000],
      3: [90, 200, 575, 2050, 21500],
    },
  },
  ninja: {
    base: 400,
    paths: {
      1: [350, 350, 900, 2750, 35000],
      2: [250, 400, 1200, 5200, 22000],
      3: [300, 450, 2250, 5000, 40000],
    },
  },
  super: {
    base: 2500,
    paths: {
      1: [2000, 2500, 20000, 100000, 500000],
      2: [1500, 1900, 7500, 25000, 70000],
      3: [3000, 1200, 5600, 55555, 165650],
    },
  },
};

describe('income curve is 1:1 with BTD6', () => {
  it('pop tax tiers match the wiki money curve (0.04 tier removed in v1.3.0)', () => {
    const expectAt = { 50: 1.0, 51: 0.5, 60: 0.5, 61: 0.2, 85: 0.2, 86: 0.1, 100: 0.1, 101: 0.05, 120: 0.05, 121: 0.02, 140: 0.02, 141: 0.02, 200: 0.02 };
    for (const [r, m] of Object.entries(expectAt)) {
      expect(cashMultForRound(Number(r)), `round ${r}`).toBe(m);
    }
  });
});

describe('tower prices are 1:1 with the current BTD6 patch (Medium)', () => {
  const diffRows = [];
  for (const [type, ref] of Object.entries(BTD6_MEDIUM)) {
    it(`${type} monkey: base + all 15 upgrade prices match BTD6 exactly`, () => {
      expect(TowerStats[type].cost, `${type} base cost`).toBe(ref.base);
      for (let p = 1; p <= 3; p++) {
        for (let t = 0; t < 5; t++) {
          const fan = Upgrades[type][p][t].cost;
          const btd6 = ref.paths[p][t];
          if (fan !== btd6) diffRows.push(`${type} p${p} t${t + 1} (${Upgrades[type][p][t].name}): fan $${fan} vs BTD6 $${btd6}`);
          expect(fan, `${type} p${p} t${t + 1} ${Upgrades[type][p][t].name}`).toBe(btd6);
        }
      }
      expect(diffRows).toEqual([]);
    });
  }

  it('ninja T5 sum equals the BTD6 $97,000 reference (was $42,000 pre-v1.3.0)', () => {
    const sum = [1, 2, 3].reduce((s, p) => s + Upgrades.ninja[p][4].cost, 0);
    expect(sum).toBe(97000);
  });

  it('dart T5 sum equals the BTD6 $81,500 reference', () => {
    const sum = [1, 2, 3].reduce((s, p) => s + Upgrades.dart[p][4].cost, 0);
    expect(sum).toBe(81500);
  });
});

describe('registry structural invariants', () => {
  it('every regular tower exposes 3 upgrade paths of at most 5 tiers', () => {
    for (const [type, behavior] of Object.entries(TowerRegistry)) {
      if (type.startsWith('paragon_')) continue;
      for (let p = 1; p <= 3; p++) {
        const tree = behavior.upgrades[p];
        expect(Array.isArray(tree), `${type} path ${p}`).toBe(true);
        expect(tree.length, `${type} path ${p}`).toBeLessThanOrEqual(5);
      }
    }
  });

  it('paragon registry entries have empty upgrade arrays and isParagon', () => {
    for (const [type, behavior] of Object.entries(TowerRegistry)) {
      if (!type.startsWith('paragon_')) continue;
      expect(behavior.isParagon).toBe(true);
      for (let p = 1; p <= 3; p++) expect(behavior.upgrades[p]).toEqual([]);
    }
    expect(TowerRegistry.paragon_dart.stats.cost).toBe(150000);
    expect(TOWER_CATEGORIES.paragon_dart).toBe('Primary');
  });
});

// ---------------------------------------------------------------------------
// docs/economy_reference.csv generator (run: GEN_ECONOMY_CSV=1 npx vitest run
// tests/economyFidelity.test.js). Fan values come straight from the live
// registry so the report can never drift from the code.
// ---------------------------------------------------------------------------
describe('economy reference report', () => {
  it('writes docs/economy_reference.csv when GEN_ECONOMY_CSV=1', () => {
    if (process.env.GEN_ECONOMY_CSV !== '1') return;
    const rows = [['tower', 'category', 'path', 'tier', 'upgrade_name', 'fan_cost_medium', 'btd6_medium_ref', 'status']];
    for (const [type, behavior] of Object.entries(TowerRegistry)) {
      const ref = BTD6_MEDIUM[type];
      const cat = TOWER_CATEGORIES[type] || 'Primary';
      rows.push([type, cat, 0, 0, '(base)', behavior.stats.cost, ref ? ref.base : '', ref ? (behavior.stats.cost === ref.base ? 'exact' : 'DIVERGES') : (type.startsWith('paragon_') ? 'n/a' : 'unverified')]);
      for (let p = 1; p <= 3; p++) {
        const tree = behavior.upgrades[p] || [];
        for (let t = 0; t < tree.length; t++) {
          const fan = tree[t].cost;
          const btd6 = ref ? ref.paths[p][t] : '';
          rows.push([type, cat, p, t + 1, tree[t].name, fan, btd6, ref ? (fan === btd6 ? 'exact' : 'DIVERGES') : (type.startsWith('paragon_') ? 'n/a' : 'unverified')]);
        }
      }
    }
    const outDir = path.join(repoRoot, 'docs');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'economy_reference.csv'),
      rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n');
    expect(rows.length).toBeGreaterThan(400);
  });
});
