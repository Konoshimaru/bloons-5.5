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
  Upgrades: { ace: { 1: [], 2: [], 3: [] } },
  TowerStats: { ace: { cost: 800, range: 22, hitRadius: 18, fireRate: 1.68, baseCooldown: 1.68, damage: 1, pierce: 5, projectileSpeed: 300, lifespan: 1.4, projectileCount: 8, fireWithoutTarget: true, dmgType: 'sharp', projectileType: 'dart' } },
  TowerRegistry: {}
}));

vi.mock('../js/heroes/index.js', () => ({ HeroStats: {}, HeroRegistry: {} }));
vi.mock('../js/registry.js', async () => {
  const ace = (await import('../js/towers/ace.js')).default;
  return { getBehavior: (t) => (t === 'ace' ? ace : null) };
});
vi.mock('../js/assets.js', () => ({
  default: {
    get: (key) => (key && key.includes('attack') ? { loaded: true } : null)
  }
}));
vi.mock('../js/mobile.js', () => ({ MobileManager: { spriteScale: 1, isActive: false } }));
vi.mock('../js/audio.js', () => ({ AudioEngine: { playSfx: vi.fn() } }));
vi.mock('../js/config.js', () => ({ RANGE_SCALE: 1, Maps: [], Config: { data: {} } }));
vi.mock('../js/data.js', () => ({ EnemyTypes: {} }));

import { Tower } from '../js/tower.js';
import ace from '../js/towers/ace.js';

function makeEnemy(id, dist, x, y, opts = {}) {
  return { id, alive: true, isCamo: false, distanceTraveled: dist, x, y, data: {}, ...opts };
}

function makeEngine() {
  const fired = [];
  const pool = {
    get() {
      return { init(...args) { fired.push(args); } };
    }
  };
  return {
    enemies: [],
    projectilePool: pool,
    fired,
    enemyGrid: { query: () => [] },
    map: { getNearestPathPoint() { return null; } },
    explosions: [],
    waveManager: { waveActive: true }
  };
}

describe('Ace repro', () => {
  it('machine gun fires on first tick and keeps firing with cache', () => {
    const t = new Tower(0, 0, 'ace');
    t.stats.machineGunCd = 0.06;
    t.stats.isSpectre = true;
    const engine = makeEngine();
    engine.enemies.push(makeEnemy('a', 100, 50, 50), makeEnemy('b', 200, 60, 60));

    // First tick: machineGunTimer starts undefined -> (undefined||0)-dt = -dt <= 0 -> fire
    ace.update(t, 0.016, engine);
    expect(engine.fired.length).toBe(2); // dart + bomb

    // Tick machineGunTimer every 0.016 until it hits 0 again (~0.06s = 4 ticks)
    for (let i = 0; i < 4; i++) {
      ace.update(t, 0.016, engine);
    }
    // Second activation should fire at cached 'b' (furthest progress)
    expect(engine.fired.length).toBeGreaterThan(2);

    // A few more ticks with cache still alive -> should keep firing
    const firedBefore = engine.fired.length;
    for (let i = 0; i < 4; i++) {
      ace.update(t, 0.016, engine);
    }
    expect(engine.fired.length).toBeGreaterThan(firedBefore);
  });

  it('fires the base dart volley (non-homing) regardless of target cache', () => {
    const t = new Tower(0, 0, 'ace');
    const engine = makeEngine();
    engine.enemies.push(makeEnemy('a', 100, 50, 50));
    t.cooldown = 0;
    t.stats.fireWithoutTarget = true;

    // ace.fire() is invoked by the generic tower path; call behavior.fire directly
    let called = 0;
    const realGet = engine.projectilePool.get;
    engine.projectilePool.get = () => ({ init(...args) { called++; } });
    ace.fire(t, null, 1, 'sharp', false, {}, engine);
    expect(called).toBe(t.stats.projectileCount || 8);
  });

  it('full Tower.update flow keeps the base ace firing volleys across ticks', () => {
    const t = new Tower(0, 0, 'ace');
    const engine = makeEngine();
    engine.enemies.push(makeEnemy('a', 100, 50, 50));
    engine.waveManager.waveActive = true;

    t.stats.fireWithoutTarget = true;
    t.stats.fireRate = 0.95;
    t.stats.baseCooldown = 0.95;

    for (let i = 0; i < 120; i++) { // ~2s
      t.update(0.016, engine);
      if (engine.fired.length > 50) break;
    }
    expect(engine.fired.length).toBeGreaterThan(8);
  });

  it('full Tower.update flow keeps Spectre machine gun firing', () => {
    const t = new Tower(0, 0, 'ace');
    const engine = makeEngine();
    engine.enemies.push(makeEnemy('a', 100, 50, 50), makeEnemy('b', 200, 60, 60));
    engine.waveManager.waveActive = true;

    t.stats.machineGunCd = 0.06;
    t.stats.isSpectre = true;

    for (let i = 0; i < 120; i++) { // ~2s
      t.update(0.016, engine);
      if (engine.fired.length > 50) break;
    }
    expect(engine.fired.length).toBeGreaterThan(30);
  });

  it('machine gun re-acquires immediately when the cached target dies (no silent gap)', () => {
    const t = new Tower(0, 0, 'ace');
    t.stats.machineGunCd = 0.06;
    t.stats.isSpectre = true;
    const engine = makeEngine();
    const e1 = makeEnemy('a', 100, 50, 50);
    const e2 = makeEnemy('b', 200, 60, 60);
    e1._spawnId = 1;
    e2._spawnId = 2;
    engine.enemies.push(e1, e2);

    // First activation: scan, cache 'b' (furthest), fire.
    ace.update(t, 0.016, engine);
    expect(engine.fired.length).toBe(2);

    // Next activation within the window: uses cached 'b'.
    for (let i = 0; i < 4; i++) ace.update(t, 0.016, engine);
    expect(engine.fired.length).toBe(4);

    // Cached target 'b' dies -> the very next activation must re-scan and fire
    // at 'a' instead of staying silent until the throttle window expires.
    e2.alive = false;
    const before = engine.fired.length;
    for (let i = 0; i < 4; i++) ace.update(t, 0.016, engine);
    expect(engine.fired.length).toBeGreaterThan(before);
  });

  it('does not re-scan on every shot while idle (fruitless scans stay throttled)', () => {
    const t = new Tower(0, 0, 'ace');
    t.stats.machineGunCd = 0.06;
    t.stats.isSpectre = true;
    const engine = makeEngine();
    let scans = 0;
    const origEnemies = engine.enemies;
    Object.defineProperty(engine, 'enemies', {
      get() { scans++; return origEnemies; }
    });

    for (let i = 0; i < 60; i++) { // ~1s, no enemies -> should scan only ~2-3 times
      ace.update(t, 0.016, engine);
    }
    expect(scans).toBeLessThan(15);
    expect(engine.fired.length).toBe(0);
  });

  it('full Tower.update flow keeps Neva-Miss homing volley firing', () => {
    const t = new Tower(0, 0, 'ace');
    const engine = makeEngine();
    engine.enemies.push(makeEnemy('a', 100, 50, 50));
    engine.waveManager.waveActive = true;

    t.stats.homing = true;
    t.stats.fireWithoutTarget = true;
    t.stats.fireRate = 0.95;
    t.stats.baseCooldown = 0.95;

    for (let i = 0; i < 120; i++) {
      t.update(0.016, engine);
      if (engine.fired.length > 50) break;
    }
    expect(engine.fired.length).toBeGreaterThan(8);
  });
});