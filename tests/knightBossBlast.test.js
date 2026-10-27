// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// End-to-end regression for "explosives can't damage the Roaring Knight":
//
// Bug 1 (fixed earlier): DamageType.EXPLOSION lacked canHitMoab, so the blast
// loop skipped every MOAB-class enemy. Covered by explosionMoabDamage.test.js.
//
// Bug 2 (this file): the blast hit test used plain center distance
// (Utils.withinRange with just explosionRadius), ignoring the enemy's radius.
// The projectile only detonates once it touches the enemy's EDGE (radius + 8),
// so the explosion lands ~45-53px from the Knight's center while the blast
// only reaches 20px (Churchill) / 30px (0-0-0 Bomb Shooter). Result: no bomb,
// mortar, missile or Churchill shell could EVER blast a MOAB/BFB/ZOMG/Knight
// unless the tower was placed nearly on top of it. Small bloons worked because
// their radius (12-20) is smaller than the blast.
//
// These tests drive the REAL tower fire() code, the REAL projectile update
// loop and the REAL KnightEnemy class.

const h = vi.hoisted(() => ({
  engineState: {
    knight: null,
    makeProjectile: null,
    lastProjectile: null
  }
}));

vi.mock('../js/engineRef.js', () => ({
  GameEngine: {
    config: { data: { mkActive: false, monkeyKnowledge: {} } },
    difficulty: null,
    waveManager: { currentWave: 1 },
    enemies: [],
    explosions: [],
    mouse: { x: 0, y: 0 },
    map: { paths: [{ segments: [{ p1: { x: 0, y: 0 } }] }] },
    // Stand-in for the spatial grid: return the current boss if the query
    // circle (padded by its radius, like the real cell padding) reaches it.
    enemyGrid: {
      query(x, y, r, out) {
        const res = out || [];
        res.length = 0;
        const k = h.engineState.knight;
        if (k && k.alive) {
          const dx = k.x - x, dy = k.y - y;
          const reach = r + (k.radius || 0);
          if (dx * dx + dy * dy <= reach * reach) res.push(k);
        }
        return res;
      }
    },
    projectilePool: {
      get() {
        const p = h.engineState.makeProjectile();
        h.engineState.lastProjectile = p;
        return p;
      }
    },
    floatingTexts: [],
    log: vi.fn(),
    addCash: vi.fn(),
    updateUI: vi.fn(),
    spawnPopEffect: vi.fn()
  }
}));

vi.mock('../js/audio.js', () => ({
  AudioEngine: { playSfx: vi.fn() }
}));

import { Projectile } from '../js/projectile.js';
import { GameEngine } from '../js/engineRef.js';
import { KnightEnemy } from '../js/bosses/knight.js';
import { EnemyTypes } from '../js/data.js';
import EnemyDamage from '../js/enemyDamage.js';
import { DamageType, resolveDmgType, createDmgType } from '../js/damageTypes.js';
import bombBehavior from '../js/towers/bomb.js';
import churchillBehavior from '../js/heroes/churchill.js';

// Mirrors towerBehavior._createDamageType('explosion', canHitLead, tower)
// which is what both towers' fire() receive from the real firing pipeline.
function makeTowerDmgType(towerStats) {
  return createDmgType(resolveDmgType('explosion'), {
    canHitLead: !!towerStats.canHitLead,
    moabDmg: towerStats.moabDmg || 0,
    fortifiedDmg: towerStats.fortifiedDmg || 0
  });
}

function spawnKnight() {
  const knight = new KnightEnemy(300, 300);
  // Out of the cinematic intro and ready to take hits (constructor starts
  // him cinematic + idle with a 3s timer).
  knight.isCinematic = false;
  knight.invulnerable = false;
  knight.state = 'idle';
  knight.x = 300;
  knight.y = 300;
  return knight;
}

// Fires a projectile from (tx, ty) at the boss and steps the REAL update loop
// until the shell detonates or runs out of life.
function fireAndDetonate(tower, target, dmgType, effects) {
  const p = h.engineState.lastProjectile;
  expect(p).toBeTruthy();
  let frames = 0;
  while (p.alive && frames < 240) {
    p.update(1 / 60);
    frames++;
  }
  return { projectile: p, frames };
}

describe('Explosive blasts vs the Knight boss (geometry regression)', () => {
  beforeEach(() => {
    h.engineState.knight = null;
    h.engineState.lastProjectile = null;
    h.engineState.makeProjectile = () => new Projectile();
  });

  it('a 0-0-0 Bomb Shooter placed at normal range blasts the Knight', () => {
    const knight = spawnKnight();
    h.engineState.knight = knight;

    const tower = {
      type: 'bomb',
      x: 240, y: 300, // 60px from the Knight's center — a normal placement
      stats: { ...bombBehavior.stats },
      upgrades: [0, 0, 0],
      damageDealt: 0,
      _aim: { x: 300, y: 300 }
    };

    bombBehavior.fire(tower, knight, 1, makeTowerDmgType(tower.stats), false, {}, GameEngine);

    const { projectile } = fireAndDetonate(tower, knight);
    // The shell must have flown out and detonated (not flown offscreen).
    expect(projectile.alive).toBe(false);
    expect(GameEngine.explosions.length).toBeGreaterThan(0);
    // Boss must have taken real blast damage (60000 -> less).
    expect(knight.hp).toBeLessThan(60000);
    expect(knight.hp).toBeGreaterThan(0);
  });

  it("Churchill's shell placed at normal range blasts the Knight", () => {
    const knight = spawnKnight();
    h.engineState.knight = knight;

    const tower = {
      type: 'churchill',
      x: 240, y: 300,
      stats: { ...churchillBehavior.stats },
      damageDealt: 0,
      abilityActiveTime: 0,
      _aim: { x: 300, y: 300 }
    };

    churchillBehavior.fire(tower, knight, 1, makeTowerDmgType(tower.stats), false, {});

    fireAndDetonate(tower, knight);
    expect(GameEngine.explosions.length).toBeGreaterThan(0);
    expect(knight.hp).toBeLessThan(60000);
    expect(knight.hp).toBeGreaterThan(0);
  });

  it('a MOAB bloon (radius 50) is reachable by a 0-0-0 bomb blast too', () => {
    // Same geometry as the Knight fight, but for the everyday MOAB — this is
    // the bug that quietly made MOAB Maulers unable to hit their namesake.
    const moab = makeBloonEnemy(13, 200);
    h.engineState.knight = moab; // reuse the grid stub slot

    const tower = {
      type: 'bomb',
      x: 240, y: 300,
      stats: { ...bombBehavior.stats },
      upgrades: [0, 0, 0],
      damageDealt: 0,
      _aim: { x: 300, y: 300 }
    };

    bombBehavior.fire(tower, moab, 1, makeTowerDmgType(tower.stats), false, {}, GameEngine);
    fireAndDetonate(tower, moab);
    expect(moab.hp).toBeLessThan(200);
  });

  it('blast damage is MOAB-safe by default: a bare {isExplosion} dmgType still gains canHitMoab', () => {
    // Guards fix 1 end-to-end: canHitMoab is an ADDITIVE ability flag baked
    // into DamageType.EXPLOSION, so even a tower that passes a bare
    // { isExplosion: true } object (no canHitMoab) — or a mod trying
    // canHitMoab: false — gets blasts that pop MOAB-class enemies. The old
    // failure mode was the inverse: nothing could ever set it, so every
    // blast skipped every MOAB including the Knight.
    const knight = spawnKnight();
    h.engineState.knight = knight;

    const tower = {
      type: 'bomb',
      x: 240, y: 300,
      stats: { ...bombBehavior.stats },
      upgrades: [0, 0, 0],
      damageDealt: 0,
      _aim: { x: 300, y: 300 }
    };

    bombBehavior.fire(tower, knight, 1, { isExplosion: true, canHitLead: true }, false, {}, GameEngine);
    fireAndDetonate(tower, knight);
    expect(knight.hp).toBeLessThan(60000);
    expect(knight.hp).toBeGreaterThan(0);
  });

  it('a DDT remains explosion-immune even with the radius-aware blast', () => {
    const ddt = makeBloonEnemy(16, 400);
    h.engineState.knight = ddt;

    const tower = {
      type: 'bomb',
      x: 260, y: 300, // close, so only the immunity (not distance) can save it
      stats: { ...bombBehavior.stats },
      upgrades: [0, 0, 0],
      damageDealt: 0,
      _aim: { x: 300, y: 300 }
    };

    bombBehavior.fire(tower, ddt, 1, makeTowerDmgType(tower.stats), false, {}, GameEngine);
    fireAndDetonate(tower, ddt);
    expect(ddt.hp).toBe(400);
  });

  it('small bloons still pop — ceramic range sanity check', () => {
    const ceramic = makeBloonEnemy(12, 10);
    h.engineState.knight = ceramic;

    const tower = {
      type: 'bomb',
      x: 240, y: 300,
      stats: { ...bombBehavior.stats },
      upgrades: [0, 0, 0],
      damageDealt: 0,
      _aim: { x: 300, y: 300 }
    };

    bombBehavior.fire(tower, ceramic, 1, makeTowerDmgType(tower.stats), false, {}, GameEngine);
    fireAndDetonate(tower, ceramic);
    expect(ceramic.hp).toBeLessThan(10);
  });
});

// Minimal live enemy for non-Knight targets: real per-tier data + the real
// shared EnemyDamage mixin, with pooled-enemy callbacks stubbed.
function makeBloonEnemy(tier, hp) {
  const enemy = {
    tier,
    data: { ...EnemyTypes[tier] },
    radius: EnemyTypes[tier].radius,
    hp,
    _maxHp: hp,
    alive: true,
    isCamo: false,
    isFortified: false,
    isFrozen: false,
    dipped: false,
    brittle: false,
    leadStripped: false,
    distanceTraveled: 100,
    knockbackCd: 0,
    x: 300,
    y: 300,
    giveCash: vi.fn(),
    payLayers: vi.fn(),
    spawnChildren: vi.fn(),
    applySlow: vi.fn(),
    _applyTier(t) {
      this.tier = t;
      this.data = { ...EnemyTypes[t] };
      this.radius = EnemyTypes[t].radius;
    },
    _spawnIceShards: vi.fn(),
    _updateSpriteCache: vi.fn()
  };
  Object.assign(enemy, EnemyDamage);
  return enemy;
}
