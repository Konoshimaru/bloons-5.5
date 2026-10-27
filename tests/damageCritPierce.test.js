import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Lightweight mocks: towerBehavior only imports these at module level.
// registry is mocked to return null so _delegateFire uses the GENERIC
// projectile path, which lets us capture the exact damage/isCrit/pierce
// values computed by fire().
vi.mock('../js/audio.js', () => ({
  AudioEngine: { playSfx: vi.fn() }
}));

vi.mock('../js/assets.js', () => ({
  default: {}
}));

vi.mock('../js/registry.js', () => ({
  getBehavior: () => null
}));

vi.mock('../js/towers/index.js', () => ({
  TowerRegistry: {},
  Upgrades: {}
}));

vi.mock('../js/heroes/index.js', () => ({
  HeroRegistry: {},
  HeroStats: {}
}));

import { fire } from '../js/towerBehavior.js';

// Every pool.get() returns a projectile whose init() records its arguments,
// so we can assert on the exact values the firing pipeline produced.
let shots;
function makeEngine() {
  shots = [];
  return {
    projectilePool: {
      get: () => ({ init: (...args) => shots.push(args) })
    }
  };
}

function makeTower(stats, extra = {}) {
  return {
    type: 'test_tower',
    x: 100,
    y: 100,
    stats: { projectileSpeed: 300, lifespan: 1, ...stats },
    activeBuffs: [],
    ...extra
  };
}

const aliveTarget = { alive: true };

// init(x, y, damage, target, type, speed, pierce, lifespan, ...)
const dmgOf = (i) => shots[i][2];
const pierceOf = (i) => shots[i][6];
const isCritOf = (i) => shots[i][13];

describe('Damage roll pipeline (towerBehavior.fire)', () => {
  beforeEach(() => { makeEngine(); });

  describe('Guaranteed crit cycle (critEvery)', () => {
    it('crits exactly every Nth shot with critDmg (BTD6 Sharp Shooter style)', () => {
      const tower = makeTower({ damage: 1, critDmg: 12, critEvery: 8, pierce: 1, dmgType: 'sharp' });
      const engine = makeEngine();

      for (let i = 1; i <= 16; i++) fire(tower, aliveTarget, engine);

      expect(shots).toHaveLength(16);
      for (let i = 0; i < 16; i++) {
        const shotNumber = i + 1;
        if (shotNumber % 8 === 0) {
          expect(dmgOf(i), `shot ${shotNumber} should crit`).toBe(12);
          expect(isCritOf(i)).toBe(true);
        } else {
          expect(dmgOf(i), `shot ${shotNumber} should be normal`).toBe(1);
          expect(isCritOf(i)).toBe(false);
        }
      }
    });

    it('cycles independently per counter (continues across many shots)', () => {
      const tower = makeTower({ damage: 2, critDmg: 50, critEvery: 5, pierce: 1, dmgType: 'sharp' });
      const engine = makeEngine();

      for (let i = 0; i < 25; i++) fire(tower, aliveTarget, engine);

      const critShots = shots.reduce((acc, s, idx) => (s[13] ? [...acc, idx + 1] : acc), []);
      expect(critShots).toEqual([5, 10, 15, 20, 25]);
    });
  });

  describe('Random crit chance (critChance)', () => {
    afterEach(() => vi.restoreAllMocks());

    it('crits when the roll is under critChance', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1); // 0.1 < 0.5 -> crit
      const tower = makeTower({ damage: 1, critDmg: 20, critChance: 0.5, pierce: 1, dmgType: 'sharp' });
      const engine = makeEngine();

      fire(tower, aliveTarget, engine);
      expect(dmgOf(0)).toBe(20);
      expect(isCritOf(0)).toBe(true);
    });

    it('does not crit when the roll is over critChance', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9); // 0.9 >= 0.5 -> no crit
      const tower = makeTower({ damage: 1, critDmg: 20, critChance: 0.5, pierce: 1, dmgType: 'sharp' });
      const engine = makeEngine();

      fire(tower, aliveTarget, engine);
      expect(dmgOf(0)).toBe(1);
      expect(isCritOf(0)).toBe(false);
    });

    it('never crits when critChance is not set', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.0);
      const tower = makeTower({ damage: 3, pierce: 1, dmgType: 'sharp' });
      const engine = makeEngine();

      fire(tower, aliveTarget, engine);
      expect(dmgOf(0)).toBe(3);
      expect(isCritOf(0)).toBe(false);
    });
  });

  describe('Damage composition', () => {
    it('adds buffedDmg and alchBuff dmg on top of base damage', () => {
      const tower = makeTower(
        { damage: 2, pierce: 1, dmgType: 'sharp' },
        { buffedDmg: 1, alchBuff: { dmg: 3, pierce: 0, shotsLeft: 5 } }
      );
      const engine = makeEngine();

      fire(tower, aliveTarget, engine);
      expect(dmgOf(0)).toBe(6); // 2 base + 1 buff + 3 alch
    });

    it('crit replaces damage entirely with critDmg (no additive stacking)', () => {
      const tower = makeTower(
        { damage: 2, critDmg: 30, critEvery: 1, pierce: 1, dmgType: 'sharp' },
        { buffedDmg: 5 }
      );
      const engine = makeEngine();

      fire(tower, aliveTarget, engine);
      expect(dmgOf(0)).toBe(30);
    });
  });

  describe('Pierce composition', () => {
    it('sums stats.pierce + buffedPierce + alchBuff.pierce', () => {
      const tower = makeTower(
        { damage: 1, pierce: 2, dmgType: 'sharp' },
        { buffedPierce: 1, alchBuff: { dmg: 0, pierce: 1, shotsLeft: 5 } }
      );
      const engine = makeEngine();

      fire(tower, aliveTarget, engine);
      expect(pierceOf(0)).toBe(4);
    });

    it('adds pierce from active buffs', () => {
      const tower = makeTower(
        { damage: 1, pierce: 2, dmgType: 'sharp' },
        { activeBuffs: [{ id: 'x', data: { pierce: 2 } }, { id: 'y', data: { pierce: 1 } }] }
      );
      const engine = makeEngine();

      fire(tower, aliveTarget, engine);
      expect(pierceOf(0)).toBe(5);
    });
  });

  describe('Buff consumption', () => {
    it('decrements non-permanent alch buff shots on each fire', () => {
      const alchBuff = { dmg: 2, pierce: 1, shotsLeft: 3 };
      const tower = makeTower(
        { damage: 1, pierce: 1, dmgType: 'sharp' },
        { alchBuff }
      );
      const engine = makeEngine();

      fire(tower, aliveTarget, engine);
      fire(tower, aliveTarget, engine);
      expect(alchBuff.shotsLeft).toBe(1);
    });

    it('does not decrement permanent alch buffs', () => {
      const alchBuff = { dmg: 2, pierce: 1, shotsLeft: 3, isPerm: true };
      const tower = makeTower(
        { damage: 1, pierce: 1, dmgType: 'sharp' },
        { alchBuff }
      );
      const engine = makeEngine();

      fire(tower, aliveTarget, engine);
      expect(alchBuff.shotsLeft).toBe(3);
    });
  });

  it('fires nothing when the target is already dead', () => {
    const tower = makeTower({ damage: 1, pierce: 1, dmgType: 'sharp' });
    const engine = makeEngine();

    fire(tower, { alive: false }, engine);
    expect(shots).toHaveLength(0);
  });
});
