import { describe, it, expect, vi } from 'vitest';

vi.mock('../js/engine.js', () => {
  const towers = [];
  return {
    GameEngine: {
      config: { data: { mkActive: true, monkeyKnowledge: {} } },
      nightAlpha: 0,
      towers,
      enemies: [],
      towerGrid: { query: vi.fn(() => []) },
      enemyGrid: { query: vi.fn(() => []) },
      waveManager: { waveActive: false, currentWave: 1 },
      projectilePool: { get: vi.fn(() => ({ init: vi.fn() })) },
      floatingTexts: [],
      spawnPopEffect: vi.fn(),
      addCash: vi.fn(),
      log: vi.fn()
    }
  };
});

vi.mock('../js/towers/index.js', () => ({
  Upgrades: {},
  TowerStats: { alchemist: { cost: 550, range: 45, hitRadius: 18 }, dart: { cost: 200, range: 30, hitRadius: 10 } },
  TowerRegistry: {}
}));

vi.mock('../js/heroes/index.js', () => ({ HeroStats: {}, HeroRegistry: {} }));
vi.mock('../js/registry.js', () => ({ getBehavior: () => null }));
vi.mock('../js/assets.js', () => ({ default: { get: () => null } }));
vi.mock('../js/mobile.js', () => ({ MobileManager: { spriteScale: 1, isActive: false } }));
vi.mock('../js/audio.js', () => ({ AudioEngine: { playSfx: vi.fn() } }));
vi.mock('../js/config.js', () => ({ RANGE_SCALE: 1, Maps: [], Config: { data: {} } }));
vi.mock('../js/data.js', () => ({ EnemyTypes: {} }));
vi.mock('../js/towerEconomy.js', () => ({ default: {} }));

import { GameEngine } from '../js/engine.js';
import { Tower } from '../js/tower.js';
import alchemist from '../js/towers/alchemist.js';

describe('Alchemist behavior', () => {
  it('initializes brew/shrink/monster timers so update() does not NaN-lock', () => {
    const t = new Tower(0, 0, 'alchemist');
    expect(t.brewTimer).toBe(0);
    expect(t.shrinkTimer).toBe(0);
    expect(t.monsterFireTimer).toBe(0);
  });

  it('throws Berserker Brew to a nearby tower once canBrew is bought', () => {
    const alch = new Tower(0, 0, 'alchemist');
    alch.stats.canBrew = true;
    const dart = new Tower(0, 30, 'dart');
    GameEngine.towers.length = 0;
    GameEngine.towers.push(alch, dart);

    alchemist.update(alch, 0.016);

    expect(dart.alchBuff).toBeTruthy();
    expect(dart.activeBuffs.some(b => b.id === 'alch')).toBe(true);
    expect(alch.brewTimer).toBeGreaterThan(0);
  });

  it('keeps retrying (does not NaN-lock) when no buffable tower is in range', () => {
    const alch = new Tower(0, 0, 'alchemist');
    alch.stats.canBrew = true;
    GameEngine.towers.length = 0;
    GameEngine.towers.push(alch);

    alchemist.update(alch, 0.016);

    expect(Number.isNaN(alch.brewTimer)).toBe(false);
    expect(alch.brewTimer).toBeLessThanOrEqual(1.0);
  });
});
