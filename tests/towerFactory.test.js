import { describe, expect, it, vi } from 'vitest';
import { registerTowerFactory, towerFactory } from '../js/towerFactory.js';

describe('towerFactory registration boundary', () => {
    it('reports a useful error when called before tower.js registers the constructor', () => {
        expect(() => towerFactory.create(10, 20, 'dart'))
            .toThrow(/Tower factory is not initialized/);
    });

    it('requires a function when registering the constructor', () => {
        expect(() => registerTowerFactory(null)).toThrow(/requires a function/);
        expect(() => registerTowerFactory({})).toThrow(/requires a function/);
    });

    it('forwards arguments to the registered constructor', () => {
        const create = vi.fn((x, y, type) => ({ x, y, type }));
        registerTowerFactory(create);

        const result = towerFactory.create(30, 40, 'village');

        expect(create).toHaveBeenCalledWith(30, 40, 'village');
        expect(result).toEqual({ x: 30, y: 40, type: 'village' });
    });

    it('allows re-registration so Vite HMR can replace the constructor', () => {
        registerTowerFactory(() => 'old');
        registerTowerFactory(() => 'new');
        expect(towerFactory.create()).toBe('new');
    });

    it('does not expose a mutable create slot', () => {
        expect(Object.isFrozen(towerFactory)).toBe(true);
        expect(() => { towerFactory.create = () => null; }).toThrow();
    });
});
