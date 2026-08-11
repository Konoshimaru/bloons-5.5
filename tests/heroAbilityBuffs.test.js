import { describe, it, expect, vi } from 'vitest';

vi.mock('../js/engine.js', () => ({
  GameEngine: {
    config: { data: { mkActive: true, monkeyKnowledge: {} } },
    enemies: [],
    enemyGrid: { query: vi.fn(() => []) },
    towers: [],
    projectilePool: { get: vi.fn(() => ({ init: vi.fn() })) },
    log: vi.fn()
  }
}));

vi.mock('../js/towers/index.js', () => ({
  Upgrades: {},
  TowerStats: {
    quincy: { cost: 540, isHero: true },
    churchill: { cost: 1000, isHero: true },
    brickell: { cost: 1200, isHero: true }
  },
  TowerRegistry: {}
}));

vi.mock('../js/heroes/index.js', () => ({
  HeroStats: {},
  HeroRegistry: { quincy: {}, churchill: {}, brickell: {} }
}));

vi.mock('../js/registry.js', () => ({ getBehavior: () => null }));
vi.mock('../js/assets.js', () => ({ default: { get: () => null } }));
vi.mock('../js/mobile.js', () => ({ MobileManager: { spriteScale: 1, isActive: false } }));
vi.mock('../js/audio.js', () => ({ AudioEngine: { playSfx: vi.fn() } }));
vi.mock('../js/config.js', () => ({ RANGE_SCALE: 1, Maps: [], Config: { data: {} } }));
vi.mock('../js/towerRenderer.js', () => ({ default: {} }));
vi.mock('../js/towerEconomy.js', () => ({ default: {} }));

import { Tower } from '../js/tower.js';
import quincy from '../js/heroes/quincy.js';
import churchill from '../js/heroes/churchill.js';
import brickell from '../js/heroes/brickell.js';

describe('Hero ability self-buffs', () => {
  it('Quincy Rapid Shot adds a rapid_shot buff icon on himself', () => {
    const q = new Tower(0, 0, 'quincy');
    q.stats.rapidShotDur = 8;
    quincy.ability(q, { log: () => {} });
    expect(q.abilityActiveTime).toBe(8);
    expect(q.activeBuffs.some(b => b.id === 'rapid_shot' && b.data.type === 'rapid_shot')).toBe(true);
  });

  it('Churchill Armor Piercing Shells adds an ap_shells buff icon on himself', () => {
    const c = new Tower(0, 0, 'churchill');
    churchill.ability(c, { log: () => {} });
    expect(c.abilityActiveTime).toBe(10);
    expect(c.activeBuffs.some(b => b.id === 'ap_shells' && b.data.type === 'ap_shells')).toBe(true);
  });

  it('Brickell Naval Tactics adds a naval_tactics buff icon on himself', () => {
    const b = new Tower(0, 0, 'brickell');
    b.stats.navalTacticsDur = 8;
    brickell.ability(b, { log: () => {} });
    expect(b.abilityActiveTime).toBe(8);
    expect(b.activeBuffs.some(buff => buff.id === 'naval_tactics' && buff.data.type === 'naval_tactics')).toBe(true);
  });
});
