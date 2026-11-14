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
        parent.update.mockImplementation(() => {
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
