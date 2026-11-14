// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { MAX_ACTIVE_PROJECTILES } from '../js/projectilePoolLimits.js';

describe('Sniper firing workload safeguards', () => {
    it('reuses the real Sniper hitscan record after its visual lifetime expires', async () => {
        const sniper = (await import('../js/towers/sniper.js')).default;
        const { updateHitscans } = await import('../js/hitscanPool.js');
        const target = {
            x: 500,
            y: 300,
            data: { isMoab: false, isCeramic: false },
            isCamo: false,
            takeDamage: vi.fn(() => 2),
        };
        const tower = {
            x: 100,
            y: 100,
            stats: { bounces: 0 },
            upgrades: [0, 0, 0],
            hitscans: [],
            damageDealt: 0,
        };
        const engine = {};

        sniper.fire(tower, target, 2, { canHitLead: false }, false, {}, engine);
        const firstRecord = tower.hitscans[0];
        expect(firstRecord).toMatchObject({ x1: 100, y1: 100, x2: 500, y2: 300, life: 0.1 });

        updateHitscans(tower, 0.1);
        expect(tower.hitscans).toHaveLength(0);
        expect(tower._hitscanPool).toContain(firstRecord);

        sniper.fire(tower, target, 2, { canHitLead: false }, false, {}, engine);
        expect(tower.hitscans[0]).toBe(firstRecord);
        expect(tower.hitscans[0].life).toBe(0.1);
    });

    it('keeps direct hits working but skips Shrapnel allocation at the projectile cap', async () => {
        const sniper = (await import('../js/towers/sniper.js')).default;
        const target = {
            data: { isMoab: false, isCeramic: false },
            isCamo: false,
            takeDamage: vi.fn(() => 2),
        };
        const pool = {
            active: Array.from({ length: MAX_ACTIVE_PROJECTILES }, () => ({})),
            get: vi.fn(),
        };
        const tower = {
            x: 100,
            y: 100,
            stats: { shrapnel: true, shrapnelDmg: 1, shrapnelPierce: 3 },
            upgrades: [0, 0, 0],
            hitscans: [],
            damageDealt: 0,
        };

        sniper.fire(tower, target, 2, { canHitLead: false }, false, {}, { projectilePool: pool });

        expect(target.takeDamage).toHaveBeenCalledOnce();
        expect(tower.damageDealt).toBe(2);
        expect(pool.get).not.toHaveBeenCalled();
    });


    it('reuses the bounce hit-set between fast shots and clears bloon references', async () => {
        const sniper = (await import('../js/towers/sniper.js')).default;
        const makeTarget = (x, y) => ({
            x,
            y,
            alive: true,
            data: { isMoab: false, isCeramic: false },
            isCamo: false,
            takeDamage: vi.fn(() => 2),
        });
        const first = makeTarget(200, 200);
        const second = makeTarget(230, 205);
        const tower = {
            x: 100,
            y: 100,
            stats: { bounces: 1 },
            upgrades: [0, 0, 0],
            hitscans: [],
            damageDealt: 0,
        };
        const engine = { enemyGrid: { query: vi.fn(() => [first, second]) } };

        sniper.fire(tower, first, 2, { canHitLead: false }, false, {}, engine);
        const hitSet = tower._sniperBounceHitSet;
        expect(hitSet).toBeInstanceOf(Set);
        expect(hitSet.size).toBe(0);

        sniper.fire(tower, first, 2, { canHitLead: false }, false, {}, engine);
        expect(tower._sniperBounceHitSet).toBe(hitSet);
        expect(hitSet.size).toBe(0);
        expect(first.takeDamage).toHaveBeenCalledTimes(2);
        expect(second.takeDamage).toHaveBeenCalledTimes(2);
    });

    it('keeps Shrapnel volleys on every successful ricochet', async () => {
        const sniper = (await import('../js/towers/sniper.js')).default;
        const makeTarget = (x, y) => ({
            x,
            y,
            alive: true,
            data: { isMoab: false, isCeramic: false },
            isCamo: false,
            takeDamage: vi.fn(() => 2),
        });
        const first = makeTarget(200, 200);
        const second = makeTarget(230, 205);
        const pool = {
            active: [],
            get: vi.fn(() => {
                const projectile = { init: vi.fn() };
                pool.active.push(projectile);
                return projectile;
            }),
        };
        const tower = {
            x: 100,
            y: 100,
            stats: { shrapnel: true, shrapnelDmg: 1, shrapnelPierce: 3, bounces: 1 },
            upgrades: [0, 0, 0],
            hitscans: [],
            damageDealt: 0,
        };
        const engine = {
            projectilePool: pool,
            enemyGrid: { query: vi.fn(() => [first, second]) },
        };

        sniper.fire(tower, first, 2, { canHitLead: false }, false, {}, engine);

        expect(first.takeDamage).toHaveBeenCalledOnce();
        expect(second.takeDamage).toHaveBeenCalledOnce();
        expect(engine.enemyGrid.query).toHaveBeenCalledOnce();
        expect(tower.hitscans).toHaveLength(2);
        expect(pool.get).toHaveBeenCalledTimes(10);
    });

    it('spawns only the number of Shrapnel projectiles that fit below the shared cap', async () => {
        const sniper = (await import('../js/towers/sniper.js')).default;
        const target = {
            data: { isMoab: false, isCeramic: false },
            isCamo: false,
            takeDamage: vi.fn(() => 2),
        };
        const pool = {
            active: Array.from({ length: MAX_ACTIVE_PROJECTILES - 3 }, () => ({})),
            get: vi.fn(() => {
                const projectile = { init: vi.fn() };
                pool.active.push(projectile);
                return projectile;
            }),
        };
        const tower = {
            x: 100,
            y: 100,
            stats: { shrapnel: true, shrapnelDmg: 1, shrapnelPierce: 3 },
            upgrades: [0, 0, 0],
            hitscans: [],
            damageDealt: 0,
        };

        sniper.fire(tower, target, 2, { canHitLead: false }, false, {}, { projectilePool: pool });

        expect(pool.get).toHaveBeenCalledTimes(3);
        expect(pool.active).toHaveLength(MAX_ACTIVE_PROJECTILES);
        expect(target.takeDamage).toHaveBeenCalledOnce();
    });
});


describe('shared global-range Sniper targeting', () => {
    const makeTarget = (spawnId, { camo = false } = {}) => ({
        alive: true,
        invulnerable: false,
        untargetable: false,
        _spawnId: spawnId,
        x: 500,
        y: 300,
        radius: 10,
        distanceTraveled: 500,
        isCamo: camo,
        tier: 1,
        data: { rbe: 100000, speed: 0, isMoab: false, isCeramic: false },
        takeDamage: vi.fn(() => 2),
    });

    async function setupEngine(enemies) {
        const { GameEngine: G } = await import('../js/engineRef.js');
        const { Tower } = await import('../js/tower.js');
        const SimulationLoop = (await import('../js/simulationLoop.js')).default;

        G.config = { data: { mkActive: false, monkeyKnowledge: {} } };
        G.waveManager = { currentWave: 1, waveActive: true };
        G.hasLeakingEnemy = false;
        G.nightAlpha = 0;
        G.towerGrid = { clear: vi.fn(), insert: vi.fn() };
        G.enemyGrid = { query: vi.fn(() => []) };
        G.enemies = enemies;
        G._globalTargetCache = new Map();

        return { G, Tower, SimulationLoop };
    }

    it('shares one enemy-list ranking across compatible Snipers for 0.15 simulation seconds', async () => {
        let scans = 0;
        let target = makeTarget(1);
        const enemies = {
            [Symbol.iterator]() {
                scans++;
                return [target][Symbol.iterator]();
            },
        };
        const { G, Tower, SimulationLoop } = await setupEngine(enemies);
        const snipers = [new Tower(100, 100, 'sniper'), new Tower(200, 100, 'sniper')];
        G.towers = snipers;

        SimulationLoop._updateTowers.call(G, 1 / 60);
        expect(scans).toBe(1);
        expect(snipers[0]._cachedTarget).toBe(target);
        expect(snipers[1]._cachedTarget).toBe(target);

        // Let both per-tower caches and the shared cache expire. A new full
        // ranking is needed, but only the first Sniper should perform it.
        for (const sniper of snipers) sniper.cooldown = 0;
        SimulationLoop._updateTowers.call(G, 0.16);
        expect(scans).toBe(2);
        expect(snipers[0]._cachedTarget).toBe(target);
        expect(snipers[1]._cachedTarget).toBe(target);

        // Recycling/death invalidates the shared reference immediately.
        const replacement = makeTarget(2);
        target.alive = false;
        target = replacement;
        for (const sniper of snipers) sniper.cooldown = 0;
        SimulationLoop._updateTowers.call(G, 1 / 60);
        expect(scans).toBe(3);
        expect(snipers[0]._cachedTarget).toBe(replacement);
        expect(snipers[1]._cachedTarget).toBe(replacement);
    });

    it('does not share a Camo target with a Sniper that cannot see Camo', async () => {
        let scans = 0;
        const camoTarget = makeTarget(3, { camo: true });
        const enemies = {
            [Symbol.iterator]() {
                scans++;
                return [camoTarget][Symbol.iterator]();
            },
        };
        const { G, Tower, SimulationLoop } = await setupEngine(enemies);
        const hiddenSniper = new Tower(100, 100, 'sniper');
        const camoSniper = new Tower(200, 100, 'sniper');
        camoSniper.stats.canSeeCamo = true;
        G.towers = [hiddenSniper, camoSniper];

        SimulationLoop._updateTowers.call(G, 1 / 60);
        expect(scans).toBe(2);
        expect(hiddenSniper._cachedTarget).toBeNull();
        expect(camoSniper._cachedTarget).toBe(camoTarget);
    });
});

describe('Sniper Shrapnel burst edge cases', () => {
    it('uses a finite centerline angle when only one projectile slot remains', async () => {
        const sniper = (await import('../js/towers/sniper.js')).default;
        const target = {
            x: 300,
            y: 250,
            data: { isMoab: false, isCeramic: false },
            isCamo: false,
            takeDamage: vi.fn(() => 2),
        };
        const pool = {
            active: Array.from({ length: MAX_ACTIVE_PROJECTILES - 1 }, () => ({})),
            get: vi.fn(() => {
                const projectile = { init: vi.fn() };
                pool.active.push(projectile);
                return projectile;
            }),
        };
        const tower = {
            x: 100,
            y: 100,
            stats: { shrapnel: true, shrapnelDmg: 1, shrapnelPierce: 3 },
            upgrades: [0, 0, 0],
            hitscans: [],
            damageDealt: 0,
        };

        sniper.fire(tower, target, 2, { canHitLead: false }, false, {}, { projectilePool: pool });

        expect(pool.get).toHaveBeenCalledOnce();
        const initArgs = pool.active[pool.active.length - 1].init.mock.calls[0];
        expect(Number.isFinite(initArgs[8])).toBe(true);
        expect(initArgs[8]).toBeCloseTo(Math.atan2(target.y - tower.y, target.x - tower.x));
    });
});


describe('Pixi Sniper hitscan batching', () => {
    it('draws all beams of the same fixed-step fade age in one stroke and reuses buckets', async () => {
        const { Graphics } = await import('pixi.js');
        const { PixiApp } = await import('../js/webgl/pixiApp.js');
        const { ProjectilesRenderer } = await import('../js/webgl/renderProjectiles.js');
        const { FIXED_TIMESTEP_SECONDS } = await import('../js/fixedStepClock.js');

        const layer = { addChild: vi.fn() };
        const layerSpy = vi.spyOn(PixiApp, 'layer').mockReturnValue(layer);
        const moveSpy = vi.spyOn(Graphics.prototype, 'moveTo');
        const lineSpy = vi.spyOn(Graphics.prototype, 'lineTo');
        const strokeSpy = vi.spyOn(Graphics.prototype, 'stroke');
        const renderer = Object.create(ProjectilesRenderer);

        const tower = {
            hitscans: [
                { x1: 10, y1: 10, x2: 20, y2: 20, life: 0.1 },
                { x1: 30, y1: 30, x2: 40, y2: 40, life: 0.1 },
                { x1: 50, y1: 50, x2: 60, y2: 60, life: 0.1 - FIXED_TIMESTEP_SECONDS },
            ],
        };

        try {
            renderer._drawHitscans({ towers: [tower] });
            expect(moveSpy).toHaveBeenCalledTimes(3);
            expect(lineSpy).toHaveBeenCalledTimes(3);
            expect(strokeSpy).toHaveBeenCalledTimes(2);
            expect(layer.addChild).toHaveBeenCalledTimes(2);

            // A later frame reuses the already-created graphics bucket.
            tower.hitscans = [tower.hitscans[0]];
            renderer._drawHitscans({ towers: [tower] });
            expect(moveSpy).toHaveBeenCalledTimes(4);
            expect(strokeSpy).toHaveBeenCalledTimes(3);
            expect(layer.addChild).toHaveBeenCalledTimes(2);
        } finally {
            layerSpy.mockRestore();
            moveSpy.mockRestore();
            lineSpy.mockRestore();
            strokeSpy.mockRestore();
        }
    });
});
