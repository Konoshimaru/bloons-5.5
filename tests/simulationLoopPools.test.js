// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { ObjectPool } from '../js/pool.js';
import SimulationLoop from '../js/simulationLoop.js';

function createPool({ field, initialValue, stopValue }) {
    return new ObjectPool(
        () => ({
            [field]: initialValue,
            update: vi.fn(function update() {
                this[field] = stopValue;
            }),
        }),
        (item) => {
            item.active = false;
        },
        0
    );
}

describe('SimulationLoop pool integration', () => {
    it('trims projectile and particle burst overflow back to the configured caps', () => {
        const projectiles = Array.from({ length: 1525 }, (_, id) => ({ id }));
        const particles = Array.from({ length: 425 }, (_, id) => ({ id }));
        const engine = {
            projectilePool: {
                active: projectiles,
                removeAt(index) {
                    this.active.splice(index, 1);
                },
            },
            particlePool: {
                active: particles,
                removeAt(index) {
                    this.active.splice(index, 1);
                },
            },
            explosions: [],
            acidPools: [],
            flavorTimer: 0,
            leakFlash: 0,
        };

        SimulationLoop._updateLimitsAndTimers.call(engine, 1 / 60);

        expect(engine.projectilePool.active).toHaveLength(1500);
        expect(engine.particlePool.active).toHaveLength(400);
    });

    it('removes dead projectiles without skipping live entries during reverse traversal', () => {
        const pool = createPool({ field: 'alive', initialValue: true, stopValue: true });
        const first = pool.get();
        const survivor = pool.get();
        const last = pool.get();
        first.update.mockImplementation(() => { first.alive = false; });
        last.update.mockImplementation(() => { last.alive = false; });

        SimulationLoop._updateProjectiles.call({ projectilePool: pool }, 1 / 60);

        expect(first.update).toHaveBeenCalledOnce();
        expect(survivor.update).toHaveBeenCalledOnce();
        expect(last.update).toHaveBeenCalledOnce();
        expect(pool.active).toEqual([survivor]);
        expect(pool.size).toBe(1);
    });

    it('removes expired particles and keeps live particles active', () => {
        const pool = createPool({ field: 'life', initialValue: 1, stopValue: 1 });
        const expired = pool.get();
        const survivor = pool.get();
        expired.update.mockImplementation(() => { expired.life = 0; });
        survivor.update.mockImplementation(() => { survivor.life = 0.5; });

        SimulationLoop._updateParticles.call({ particlePool: pool }, 1 / 60);

        expect(expired.update).toHaveBeenCalledOnce();
        expect(survivor.update).toHaveBeenCalledOnce();
        expect(pool.active).toEqual([survivor]);
        expect(pool.size).toBe(1);
    });

    it('defers projectiles created during an update until the next simulation step', () => {
        const pool = createPool({ field: 'alive', initialValue: true, stopValue: true });
        const parent = pool.get();
        let child;
        parent.update.mockImplementationOnce(() => {
            child = pool.get();
        });

        SimulationLoop._updateProjectiles.call({ projectilePool: pool }, 1 / 60);

        expect(child).toBeDefined();
        expect(child.update).not.toHaveBeenCalled();
        expect(pool.active).toEqual([parent, child]);

        SimulationLoop._updateProjectiles.call({ projectilePool: pool }, 1 / 60);
        expect(child.update).toHaveBeenCalledOnce();
    });
});


describe('SimulationLoop tower update pass', () => {
    it('clears transient buffs and rebuilds the tower grid in one pass', () => {
        const makeTower = () => ({
            type: '__unknown_test_type__',
            upgrades: [0, 0, 0],
            buffedRange: 50,
            buffedFireRate: 2,
            buffedCamo: true,
            buffedLead: true,
            discount: 3,
            buffedDmg: 4,
            buffedPierce: 5,
            buffedValueMult: 6,
            freeTier1: true,
            freeTier2: true,
            buffedProjSpeed: 7,
            abilityCdMult: 8,
            update: vi.fn(),
        });
        const first = makeTower();
        const second = makeTower();
        const towerGrid = { clear: vi.fn(), insert: vi.fn() };
        const engine = {
            towers: [first, null, second],
            towerGrid,
            _globalTargetCache: new Map(),
            _towerUpdateStep: 0,
            hasIceShardTower: false,
            _updatingTowerSupport: false,
        };

        SimulationLoop._updateTowers.call(engine, 1 / 60);

        expect(towerGrid.clear).toHaveBeenCalledOnce();
        expect(towerGrid.insert).toHaveBeenCalledTimes(2);
        expect(towerGrid.insert).toHaveBeenNthCalledWith(1, first);
        expect(towerGrid.insert).toHaveBeenNthCalledWith(2, second);
        for (const tower of [first, second]) {
            expect(tower.buffedRange).toBe(0);
            expect(tower.buffedFireRate).toBe(0);
            expect(tower.buffedCamo).toBe(false);
            expect(tower.buffedLead).toBe(false);
            expect(tower.discount).toBe(0);
            expect(tower.buffedDmg).toBe(0);
            expect(tower.buffedPierce).toBe(0);
            expect(tower.buffedValueMult).toBe(0);
            expect(tower.freeTier1).toBe(false);
            expect(tower.freeTier2).toBe(false);
            expect(tower.buffedProjSpeed).toBe(1);
            expect(tower.abilityCdMult).toBe(1);
            expect(tower.update).toHaveBeenCalledOnce();
        }
        expect(engine._updatingTowerSupport).toBe(false);
        expect(engine._towerUpdateStep).toBe(1);
    });
});
