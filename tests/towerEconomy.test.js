import { describe, it, expect, vi } from 'vitest';

// 1. Mock the heavy modules BEFORE importing our code
vi.mock('../js/engine.js', () => ({
  GameEngine: {
    config: { data: { mkActive: true, monkeyKnowledge: {} } },
    difficulty: null,
    waveManager: { currentWave: 1 },
    towers: [],
    enemies: [],
    explosions: [],
    enemyGrid: { query: () => [] },
    projectilePool: { get: () => ({ init: () => {} }) },
    floatingTexts: [],
    spawnPopEffect: vi.fn(),
    addCash: vi.fn(),
    log: vi.fn()
  }
}));

vi.mock('../js/towers/index.js', () => ({
  Upgrades: {},
  TowerStats: {},
  TowerRegistry: {}
}));

// FIX: Mock mobile.js to prevent the `window` error from propagating!
vi.mock('../js/mobile.js', () => ({
  MobileManager: { spriteScale: 1, isActive: false, toggle: vi.fn() }
}));

vi.mock('../js/audio.js', () => ({
  AudioEngine: { playSfx: vi.fn() }
}));

// 2. Import the function we want to test
import { getSellRate } from '../js/towerEconomy.js';
import { MKEffects } from '../js/monkeyKnowledgeEffects.js';

// Helper to create a fake tower and fake engine
function makeMockTower(type = 'dart') {
  return { type, upgrades: [0, 0, 0], stats: {} };
}

function makeMockEngine(activePerks = {}) {
  return {
    config: {
      data: {
        mkActive: true,
        monkeyKnowledge: activePerks
      }
    }
  };
}

describe('Tower Economy - Sell Rates', () => {
  it('should return 70% base sell rate with no MK perks', () => {
    const tower = makeMockTower('dart');
    const engine = makeMockEngine({}); // No perks active
    const rate = getSellRate(tower, engine);
    expect(rate).toBe(0.70);
  });

  it('should return 75% with Better Sell Deals active', () => {
    const tower = makeMockTower('dart');
    const engine = makeMockEngine({ better_sell_deals: true });
    const rate = getSellRate(tower, engine);
    expect(rate).toBe(0.75);
  });

  it('should return 77% for Farms with Flat Pack AND Better Sell Deals active', () => {
    const tower = makeMockTower('farm'); // Farms get special treatment
    const engine = makeMockEngine({ flat_pack: true, better_sell_deals: true });
    const rate = getSellRate(tower, engine);
    expect(rate).toBe(0.77);
  });

  it('should return 72% for Farms with Flat Pack but WITHOUT Better Sell Deals', () => {
    const tower = makeMockTower('farm');
    const engine = makeMockEngine({ flat_pack: true, better_sell_deals: false });
    const rate = getSellRate(tower, engine);
    expect(rate).toBe(0.72);
  });

  it('should return 80% for Farms with Tier 5 upgrade AND Farm Resale MK active', () => {
    const tower = makeMockTower('farm');
    tower.upgrades[2] = 5; // Tier 5 upgrade in path 3
    // We must enable the `farm_resale` perk in the MK data for the effect to trigger!
    const engine = makeMockEngine({ farm_resale: true }); 
    const rate = getSellRate(tower, engine);
    expect(rate).toBe(0.80);
  });
});