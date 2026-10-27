import { describe, it, expect, vi } from 'vitest';

// Regression tests for: Churchill's shells (and all pure-blast weapons) dealt
// ZERO damage to the Roaring Knight boss, while Bomb Shooter appeared to work
// only via its Frag Bombs (sharp fragments bypass the blast MOAB gate).
//
// Root cause: DamageType.EXPLOSION lacked canHitMoab, and the blast loop in
// projectileHitResolution.js skips every enemy with data.isMoab unless
// bombDmgType.canHitMoab is set. Nothing in the game granted it to towers.

// 1. Mock heavy modules (same pattern as damage.test.js)
vi.mock('../js/engineRef.js', () => ({
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

vi.mock('../js/data.js', () => ({
  EnemyTypes: {
    // Knight-like boss: flagged MOAB-class, no lead coating, no type immunities
    knight: { name: 'Black Knight', color: 'gray', nextTier: null, isMoab: true, maxHp: 60000 },
    // DDT: MOAB-class AND immune to explosions via blocksDamageType
    ddt: {
      name: 'DDT', color: 'black', nextTier: null, isMoab: true, isDDT: true, isLead: true, maxHp: 400,
      blocksDamageType: (d) => d.isExplosion || (d.isSharp && !d.canHitLead)
    }
  }
}));

import EnemyDamage from '../js/enemyDamage.js';
import { DamageType, resolveDmgType, createDmgType } from '../js/damageTypes.js';
import { EnemyTypes } from '../js/data.js';

function makeMockEnemy(tierKey, hp) {
  const enemy = {
    tier: tierKey,
    data: { ...EnemyTypes[tierKey] },
    hp: hp,
    alive: true,
    isFortified: false,
    isCamo: false,
    isFrozen: false,
    dipped: false,
    brittle: false,
    leadStripped: false,
    distanceTraveled: 100,
    knockbackCd: 0,
    giveCash: vi.fn(),
    payLayers: vi.fn(),
    _applyTier(t) { this.tier = t; this.data = { ...EnemyTypes[t] }; },
    spawnChildren: vi.fn(),
    applySlow: vi.fn(),
    _spawnIceShards: vi.fn(),
    _updateSpriteCache: vi.fn()
  };
  Object.assign(enemy, EnemyDamage);
  return enemy;
}

describe('Explosions vs MOAB-class enemies (Knight boss regression)', () => {
  it('EXPLOSION damage type inherently carries canHitMoab', () => {
    expect(DamageType.EXPLOSION.canHitMoab).toBe(true);
  });

  it("towers with dmgType 'explosion' get canHitMoab through resolveDmgType (Churchill's stats path)", () => {
    // Churchill stats: dmgType: 'explosion' -> _createDamageType -> createDmgType
    const dt = createDmgType(resolveDmgType('explosion'), { canHitLead: true });
    expect(dt.canHitMoab).toBe(true);
  });

  it('canHitMoab is an additive ability flag: mods cannot remove it', () => {
    const dt = createDmgType(DamageType.EXPLOSION, { canHitMoab: false });
    expect(dt.canHitMoab).toBe(true);
  });

  it('a Knight-style MOAB boss takes blast damage instead of returning -1 (immune)', () => {
    const knight = makeMockEnemy('knight', 60000);
    // This is exactly what the blast loop passes: e.takeDamage(expDmg, bombDmgType, ...)
    const dealt = knight.takeDamage(50, createDmgType(DamageType.EXPLOSION, {}), {});
    expect(dealt).toBe(50);
    expect(knight.hp).toBe(59950);
    expect(knight.alive).toBe(true);
  });

  it('DDTs are still immune to explosions despite canHitMoab (blocksDamageType predicate)', () => {
    const ddt = makeMockEnemy('ddt', 400);
    const dealt = ddt.takeDamage(50, DamageType.EXPLOSION, {});
    expect(dealt).toBe(-1);
    expect(ddt.hp).toBe(400);
    expect(ddt.alive).toBe(true);
  });

  it('acid-stripped DDT loses explosion immunity (lead coating stripped)', () => {
    const ddt = makeMockEnemy('ddt', 400);
    ddt.leadStripped = true;
    const dealt = ddt.takeDamage(50, DamageType.EXPLOSION, {});
    // blocksDamageType immunity is bypassed for lead-stripped DDTs; blast lands
    expect(dealt).toBe(50);
  });
});
