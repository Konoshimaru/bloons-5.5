// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { MAX_ACTIVE_PROJECTILES } from '../js/projectilePoolLimits.js';

describe('Sniper firing workload safeguards', () => {
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
