import { describe, it, expect, vi } from 'vitest';

// 1. Mock the heavy modules
vi.mock('../js/engine.js', () => ({
  GameEngine: {
    config: { data: { mkActive: true, monkeyKnowledge: {} } },
    difficulty: null,
    waveManager: { currentWave: 1 },
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

vi.mock('../js/audio.js', () => ({
  AudioEngine: { playSfx: vi.fn() }
}));

// 2. Mock the Enemy data so we don't need the real data.js
vi.mock('../js/data.js', () => ({
  EnemyTypes: {
    red: { name: 'Red', color: 'red', nextTier: null, maxHp: 1 },
    blue: { name: 'Blue', color: 'blue', nextTier: 'red', maxHp: 1 },
    lead: { name: 'Lead', color: 'gray', nextTier: null, isLead: true, maxHp: 3 },
    moab: { name: 'MOAB', color: 'blue', nextTier: null, isMoab: true, maxHp: 200 }
  }
}));

// 3. Import the real modules (this will use the mocked data.js)
import EnemyDamage from '../js/enemyDamage.js';
import { EnemyTypes } from '../js/data.js';

// Helper to create a fake enemy that uses our real EnemyDamage logic
function makeMockEnemy(tierKey, hp = 1, isFortified = false, isCamo = false) {
  const enemy = {
    tier: tierKey,
    data: { ...EnemyTypes[tierKey] }, // Copy stats from the imported (mocked) data
    hp: hp,
    alive: true,
    isFortified: isFortified,
    isCamo: isCamo,
    isFrozen: false,
    dipped: false,
    brittle: false,
    leadStripped: false,
    distanceTraveled: 100,
    knockbackCd: 0,
    
    // Mock these methods so they don't crash
    giveCash: vi.fn(),
    spawnChildren: vi.fn(),
    applySlow: vi.fn(),
    _spawnIceShards: vi.fn(),
    _updateSpriteCache: vi.fn()
  };
  
  // Mix in the real damage calculation logic
  Object.assign(enemy, EnemyDamage);
  return enemy;
}

describe('Enemy Damage System', () => {
  describe('Standard Damage & Carry-over', () => {
    it('should pop a Red bloon with 1 damage', () => {
      const enemy = makeMockEnemy('red', 1);
      const dmgDealt = enemy.takeDamage(1, {}, {});
      expect(enemy.alive).toBe(false);
      expect(dmgDealt).toBe(1);
    });

    it('should carry excess damage to the next layer (Blue -> Red)', () => {
      // Blue bloon has 1 HP, splits into Red (1 HP). Total 2 HP needed.
      const enemy = makeMockEnemy('blue', 1);
      const dmgDealt = enemy.takeDamage(5, {}, {}); // Deal 5 damage
      expect(enemy.alive).toBe(false);
      expect(dmgDealt).toBe(2); // Should pop 2 layers (Blue + Red)
    });
  });

  describe('Lead Immunities', () => {
    it('should be immune to Sharp damage without canHitLead', () => {
      const enemy = makeMockEnemy('lead', 3);
      const dmgDealt = enemy.takeDamage(1, { isSharp: true }, {}); // Sharp damage, no canHitLead
      expect(dmgDealt).toBe(-1); // -1 means immune
      expect(enemy.alive).toBe(true); // Still alive
    });

    it('should be immune to Energy damage', () => {
      const enemy = makeMockEnemy('lead', 3);
      const dmgDealt = enemy.takeDamage(1, { isEnergy: true }, {});
      expect(dmgDealt).toBe(-1);
    });

    it('should take damage from Sharp if canHitLead is true', () => {
      const enemy = makeMockEnemy('lead', 3);
      const dmgDealt = enemy.takeDamage(1, { isSharp: true, canHitLead: true }, {});
      expect(dmgDealt).toBeGreaterThan(0);
      // Standard Leads use layers, not HP. Dealing 1 damage should kill it (1 layer).
      expect(enemy.alive).toBe(false);
    });

    it('should take damage from Explosions', () => {
      const enemy = makeMockEnemy('lead', 3);
      const dmgDealt = enemy.takeDamage(1, { isExplosion: true }, {});
      expect(dmgDealt).toBeGreaterThan(0);
      expect(enemy.alive).toBe(false);
    });
  });

  describe('MOAB Damage', () => {
    it('should take damage and survive if HP > damage', () => {
      const enemy = makeMockEnemy('moab', 200);
      const dmgDealt = enemy.takeDamage(50, {}, {});
      expect(enemy.alive).toBe(true);
      expect(enemy.hp).toBe(150);
      expect(dmgDealt).toBe(50);
    });

    it('should die and spawn children if damage >= HP', () => {
      const enemy = makeMockEnemy('moab', 200);
      const dmgDealt = enemy.takeDamage(250, {}, {});
      expect(enemy.alive).toBe(false);
      expect(enemy.hp).toBeLessThanOrEqual(0);
      expect(dmgDealt).toBe(200); // Should only report 200 damage dealt (the max HP)
      expect(enemy.spawnChildren).toHaveBeenCalled(); // Should spawn children
    });
  });
});