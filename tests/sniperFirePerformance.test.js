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
