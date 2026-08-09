import { describe, it, expect, vi } from 'vitest';

vi.mock('../js/engine.js', () => {
  const towers = [];
  return {
    GameEngine: {
      config: { data: { mkActive: true, monkeyKnowledge: {} } },
      towerGrid: { query: vi.fn(() => []) },
      waveManager: { waveActive: false, currentWave: 1 },
      towers,
      enemies: [],
      explosions: [],
      enemyGrid: { query: () => [] },
      projectilePool: { get: () => ({ init: () => {} }) },
      floatingTexts: [],
      spawnPopEffect: vi.fn(),
      addCash: vi.fn(),
      log: vi.fn()
    }
  };
});

vi.mock('../js/towers/index.js', () => ({
  Upgrades: {},
  TowerStats: {},
  TowerRegistry: {}
}));

vi.mock('../js/mobile.js', () => ({
  MobileManager: { spriteScale: 1, isActive: false, toggle: vi.fn() }
}));

vi.mock('../js/audio.js', () => ({
  AudioEngine: { playSfx: vi.fn() }
}));

vi.mock('../js/config.js', () => ({
  RANGE_SCALE: 1,
  Maps: [],
  Config: { data: {} }
}));

vi.mock('../js/tower.js', () => ({
  Tower: class Tower {}
}));

import { GameEngine } from '../js/engine.js';
import village from '../js/towers/village.js';

function makeMockTower(type, x, y, upgrades) {
  return {
    type,
    x,
    y,
    upgrades: upgrades || [0, 0, 0],
    stats: { category: 'Primary' },
    activeBuffs: [],
    addBuff(id, name, duration, stacks = 1, data = {}, addStacks = true) {
      const existing = this.activeBuffs.find(b => b.id === id);
      if (existing) {
        if (addStacks) existing.stacks += stacks;
        existing.duration = Math.max(existing.duration, duration);
        if (existing.data.type !== data.type) existing.data = data;
      } else {
        this.activeBuffs.push({ id, name, duration, stacks, data });
      }
    }
  };
}

describe('Village buff application (5-2-0)', () => {
  it('should grant village/jd/ptr/pm/pe/radar buffs to a Primary tower in range', () => {
    const dart = makeMockTower('dart', 20, 0, [0, 0, 0]);
    const villageTower = makeMockTower('village', 0, 0, [5, 2, 0]);
    villageTower.stats.range = 40;
    villageTower.stats.rangeBuff = 0.1;
    villageTower.stats.fireRateBuff = 0.18;

    GameEngine.towerGrid.query = vi.fn(() => [dart]);

    village.updateSupport(villageTower, 0.016);

    const ids = dart.activeBuffs.map(b => b.id);
    expect(ids).toContain('village');
    expect(ids).toContain('jd');
    expect(ids).toContain('ptr');
    expect(ids).toContain('pm');
    expect(ids).toContain('pe');
    expect(ids).toContain('radar');
  });

  it('should NOT grant buffs to a tower out of range', () => {
    const dart = makeMockTower('dart', 500, 0, [0, 0, 0]);
    const villageTower = makeMockTower('village', 0, 0, [5, 2, 0]);
    villageTower.stats.range = 40;
    villageTower.stats.rangeBuff = 0.1;

    GameEngine.towerGrid.query = vi.fn(() => [dart]);

    village.updateSupport(villageTower, 0.016);

    expect(dart.activeBuffs.length).toBe(0);
  });
});
