// @vitest-environment jsdom
// Regression tests for bugs reported on test-version.
import { describe, it, expect, vi } from 'vitest';
import { Config } from '../js/config.js';
import { UIRenderer } from '../js/webgl/renderUI.js';
import { computeLeadAim } from '../js/towerBehavior.js';

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
