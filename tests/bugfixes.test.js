// @vitest-environment jsdom
// Regression tests for bugs reported on test-version.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Config } from '../js/config.js';
import { UIRenderer } from '../js/webgl/renderUI.js';
import { computeLeadAim } from '../js/towerBehavior.js';
import { EnemyTypesData } from '../js/bloons.js';
import { GameEngine as RefEngine } from '../js/engineRef.js';
import geto from '../js/heroes/geto.js';
import engineer from '../js/towers/engineer.js';
import glue from '../js/towers/glue.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../js/constants.js';

describe('debug "Show Hitboxes & Range" toggle', () => {
  const fakeGraphics = () => ({ clears: 0, rings: 0, clear() { this.clears++; this.rings = 0; }, circle() { this.rings++; return { stroke() {} }; } });
  const engine = () => ({
    towers: [{ x: 10, y: 10, hitRadius: 20, stats: { range: 9999 } }],
    enemies: [], sentries: [], beasts: [], explosions: [], projectilePool: { active: [] }
  });

  it('turning it off wipes the rings of towers that were already placed', () => {
    const g = fakeGraphics();
    const ctx = { _hitboxGraphics: g };
    Config.data.showHitboxes = true;
    UIRenderer._drawHitboxes.call(ctx, engine());
    expect(g.rings).toBeGreaterThan(0);                  // tower ring drawn while enabled

    Config.data.showHitboxes = false;
    UIRenderer._drawHitboxes.call(ctx, engine());
    expect(g.rings).toBe(0);                             // ...and gone after disabling (was frozen on screen)
  });

  it('does not redraw / clear every frame while disabled', () => {
    const g = fakeGraphics(); const ctx = { _hitboxGraphics: g };
    Config.data.showHitboxes = false;
    for (let i = 0; i < 5; i++) UIRenderer._drawHitboxes.call(ctx, engine());
    expect(g.clears).toBe(0);
  });
});

describe('tower aim on enemies that do not follow the map path (Black Knight)', () => {
  const tower = { x: 0, y: 0, stats: { projectileSpeed: 500 } };
  const pathEngine = { map: { getTotalLength: () => 1000, getPositionAtDistance: (d) => ({ x: 600 + d, y: 50, finished: false }) } };

  it('leads path enemies along the path (unchanged behaviour)', () => {
    const e = { x: 100, y: 0, data: { speed: 60 }, distanceTraveled: 40, pathIndex: 0 };
    const aim = computeLeadAim(tower, e, pathEngine);
    expect(aim).not.toBeNull();
    expect(aim.y).toBe(50);
  });

  it('aims straight at a boss with followsPath = false instead of at the start of the path', () => {
    const knight = { x: 700, y: 300, data: { speed: 60 }, distanceTraveled: 0, pathIndex: 0, followsPath: false };
    expect(computeLeadAim(tower, knight, pathEngine)).toBeNull();   // null => fire() aims at knight.x / knight.y
  });

  it('a real KnightEnemy opts out of path leading and is skipped as a target while he rolls to a new spot', async () => {
    const { GameEngine } = await import('../js/engineRef.js');
    const path = { segments: [{ p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 } }] };
    GameEngine.map = {
      paths: [path], getTotalLength: () => 1000, isOnPath: () => false, isOnProp: () => false,
      getPositionAtDistance: () => ({ x: 5, y: 5, finished: false })
    };
    GameEngine.waveManager = { currentWave: 1 };
    GameEngine.mouse = { x: 0, y: 0 };
    GameEngine.log = () => {};
    const { KnightEnemy } = await import('../js/bosses/knight.js');
    const knight = new KnightEnemy(700, 300);
    expect(knight.followsPath).toBe(false);
    expect(computeLeadAim({ x: 0, y: 0, stats: { projectileSpeed: 500 } }, knight, GameEngine)).toBeNull();
    knight._reposition();                                  // starts the invulnerable ball-roll
    expect(knight.invulnerable).toBe(true);                // targeting skips `invulnerable` enemies
  });
});

// ---------------------------------------------------------------------------
// Audit report chapter-10 fixes 1-5 (all were verified live-code criticals).
// Each test reproduces the pre-fix failure mode first-hand.
// ---------------------------------------------------------------------------
describe('audit critical fixes (chapter-10 fixes 1-5)', () => {
  beforeAll(async () => {
    await import('../js/engine.js');   // populates the engineRef GameEngine singleton
  });

  it('fix 1 (C-1): a Geto squid no longer throws TypeError inside the squid update loop', () => {
    RefEngine.enemyGrid = { query: () => [] };
    RefEngine.log = () => {};
    const tower = {
      x: 0, y: 0,
      squids: [{ life: 5, x: 100, y: 100, vx: 10, vy: 0, isWorm: false, hitRadius: 10, dmg: 1, pierce: 3, hitEnemies: new Set() }],
    };
    // Pre-fix the loop was `i = len-1; i >= 0; i++` — iteration 2 read squids[len]
    // and crashed on `s.life -= dt`.
    expect(() => geto.update(tower, 0.016)).not.toThrow();
    expect(tower.squids).toHaveLength(1);
    tower.squids[0].life = 0.01;          // expiring squid splices cleanly going backwards
    geto.update(tower, 0.05);
    expect(tower.squids).toHaveLength(0);
  });

  it('fix 2 (C-3): Overclock standard branch scales with the TARGET tier instead of throwing', () => {
    const mk = (targetUpgrades) => {
      const tower = { x: 0, y: 0, type: 'engineer', stats: { range: 100 }, upgrades: [0, 0, 0] };
      const target = { x: 60, y: 0, type: 'dart', totalSpent: 500, upgrades: targetUpgrades, stats: { name: 'Dart Monkey' } };
      return { tower, target, engine: { towers: [tower, target], log: () => {} } };
    };
    const a = mk([2, 4, 0]);   // pre-fix: ReferenceError: ot is not defined
    expect(() => engineer.ability(a.tower, a.engine)).not.toThrow();
    expect(a.target.overclockTimer).toBe(45);        // top tier 4 -> 45s
    const b = mk([0, 0, 0]);
    engineer.ability(b.tower, b.engine);
    expect(b.target.overclockTimer).toBe(60);        // top tier <= 3 -> 60s
    const c = mk([0, 0, 5]);
    engineer.ability(c.tower, c.engine);
    expect(c.target.overclockTimer).toBe(30);        // top tier 5 -> 30s
  });

  it('fix 3 (HIGH): tier 14 reads as BFB and tier 15 as ZOMG for the 7 flag consumers', () => {
    expect(EnemyTypesData[14].isBFB).toBe(true);
    expect(EnemyTypesData[15].isZOMG).toBe(true);
    expect(EnemyTypesData[13].isBFB).toBeUndefined();   // a plain MOAB is not a BFB
    expect(EnemyTypesData[14].isZOMG).toBeUndefined();
    expect(EnemyTypesData[15].isBFB).toBeUndefined();
    expect(EnemyTypesData[16].isDDT).toBe(true);        // neighbouring tiers untouched
    expect(EnemyTypesData[17].isBAD).toBe(true);
  });

  it('fix 4 (HIGH): Glue Storm queries the canvas center instead of NaN', () => {
    const taken = [];
    const enemy = { alive: true, x: 900, y: 600, takeDamage: (...args) => { taken.push(args); return 0; } };
    let center = null;
    const engine = { enemyGrid: { query: (x, y) => { center = [x, y]; return [enemy]; } } };
    const tower = {
      glueStormActive: 1, stormTimer: 0, upgrades: [0, 0, 0],
      stats: { slow: 0.5, slowDuration: 11 }, damageDealt: 0,
    };
    glue.update(tower, 0.016, engine);   // stormTimer goes negative -> one glue pulse
    // Pre-fix: engine.width/height are undefined -> NaN center -> zero hits for 20s.
    expect(center[0]).toBe(CANVAS_WIDTH / 2);
    expect(center[1]).toBe(CANVAS_HEIGHT / 2);
    expect(taken).toHaveLength(1);
    expect(taken[0][2]).toMatchObject({ slow: 0.5, slowDuration: 11, brittleTimer: 11 });
  });

  it('fix 5 (C-4): removeCash subtracts, floors at zero, and ignores junk amounts', () => {
    expect(typeof RefEngine.removeCash).toBe('function');
    RefEngine.cash = 1000;
    RefEngine.removeCash(500);
    expect(RefEngine.cash).toBe(500);
    RefEngine.removeCash(99999);
    expect(RefEngine.cash).toBe(0);   // floors, never negative
    RefEngine.removeCash(-50);
    expect(RefEngine.cash).toBe(0);   // junk amount: no-op
    RefEngine.removeCash(49.9);       // fractional penalties floor
    expect(RefEngine.cash).toBe(0);
  });
});
