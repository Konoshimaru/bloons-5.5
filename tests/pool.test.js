import { describe, expect, it, vi } from 'vitest';
import { ObjectPool } from '../js/pool.js';

describe('ObjectPool', () => {
    it('tracks checked-out objects and removes them when released directly', () => {
        let nextId = 0;
        const reset = vi.fn((obj) => { obj.reset = true; });
        const pool = new ObjectPool(() => ({ id: ++nextId }), reset, 0);

        const obj = pool.get();
        expect(pool.active).toEqual([obj]);
        expect(pool.size).toBe(1);

        pool.release(obj);

        expect(pool.active).toHaveLength(0);
        expect(pool.size).toBe(0);
        expect(reset).toHaveBeenCalledExactlyOnceWith(obj);
        expect(obj.reset).toBe(true);
    });

    it('rejects factories that return non-object values', () => {
        const pool = new ObjectPool(() => null, undefined, 0);

        expect(() => pool.get()).toThrow(/factories must return objects/);
    });

    it('rejects a factory that returns an already checked-out instance', () => {
        const shared = {};
        const pool = new ObjectPool(() => shared, undefined, 0);

        expect(pool.get()).toBe(shared);
        expect(() => pool.get()).toThrow(/fresh object each time/);
        expect(pool.active).toEqual([shared]);
    });

    it('rejects repeated object identities during initial preallocation', () => {
        const shared = {};

        expect(() => new ObjectPool(() => shared, undefined, 2))
            .toThrow(/fresh object each time/);
    });

    it('reuses released instances without retaining them as active', () => {
        const pool = new ObjectPool(() => ({}), undefined, 0);
        const first = pool.get();

        pool.release(first);
        const reused = pool.get();

        expect(reused).toBe(first);
        expect(pool.active).toEqual([first]);
        expect(pool.size).toBe(1);
    });

    it('ignores duplicate releases so an object cannot be checked out twice', () => {
        let nextId = 0;
        const pool = new ObjectPool(() => ({ id: ++nextId }), undefined, 0);
        const first = pool.get();

        pool.release(first);
        pool.release(first);

        const reused = pool.get();
        const fresh = pool.get();

        expect(reused).toBe(first);
        expect(fresh).not.toBe(first);
        expect(new Set(pool.active).size).toBe(pool.active.length);
        expect(pool.size).toBe(2);
    });

    it('swap-removes released objects without disturbing the other active entries', () => {
        const pool = new ObjectPool(() => ({}), undefined, 0);
        const first = pool.get();
        const middle = pool.get();
        const last = pool.get();

        pool.removeAt(1);

        expect(pool.active).toEqual([first, last]);
        expect(pool.size).toBe(2);
        expect(pool.get()).toBe(middle);
        expect(pool.active).toHaveLength(3);
    });

    it('ignores non-integer and out-of-range removal indices', () => {
        const pool = new ObjectPool(() => ({}), undefined, 0);
        const only = pool.get();

        pool.removeAt(Number.NaN);
        pool.removeAt(0.5);
        pool.removeAt(-1);
        pool.removeAt(1);

        expect(pool.active).toEqual([only]);
        expect(pool.size).toBe(1);
    });

    it('clears and returns every active object to the free list', () => {
        const pool = new ObjectPool(() => ({}), undefined, 0);
        const first = pool.get();
        const second = pool.get();

        pool.clear();

        expect(pool.active).toHaveLength(0);
        expect(pool.size).toBe(0);
        expect(new Set([pool.get(), pool.get()])).toEqual(new Set([first, second]));
    });

    it('rejects invalid release values', () => {
        const pool = new ObjectPool(() => ({}), undefined, 0);

        expect(() => pool.release(null)).toThrow(/only release objects/);
        expect(() => pool.release(42)).toThrow(/only release objects/);
    });
});
