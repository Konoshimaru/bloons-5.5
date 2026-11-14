// pool.js
// Provides object pooling for reusable gameplay entities.

export class ObjectPool {
    #factory;
    #reset;
    #pool = [];
    #active = [];
    #activeIndices = new Map();
    #pooled = new WeakSet();

    constructor(factory, resetFn, initialSize = 100) {
        if (typeof factory !== 'function') {
            throw new Error("ObjectPool requires a factory function.");
        }
        this.#factory = factory;
        this.#reset = resetFn;

        for (let i = 0; i < initialSize; i++) {
            const obj = this.#createObject();
            this.#pool.push(obj);
            this.#pooled.add(obj);
        }
    }

    #createObject() {
        const obj = this.#factory();
        if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) {
            throw new TypeError("ObjectPool factories must return objects.");
        }
        if (this.#pooled.has(obj) || this.#activeIndices.has(obj)) {
            throw new Error("ObjectPool factories must return a fresh object each time.");
        }
        return obj;
    }

    get() {
        // Reuse an inactive object when possible so the game does not churn through allocations.
        let obj = this.#pool.pop();
        if (obj === undefined) {
            obj = this.#createObject();
        } else {
            this.#pooled.delete(obj);
        }

        this.#activeIndices.set(obj, this.#active.length);
        this.#active.push(obj);
        return obj;
    }

    release(obj) {
        if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) {
            throw new TypeError("ObjectPool can only release objects.");
        }
        // A double release would put the same object in the free list twice,
        // allowing two callers to receive the same instance concurrently.
        if (this.#pooled.has(obj)) return;

        if (this.#reset) {
            this.#reset(obj);
        }

        // Some gameplay systems release directly after removing their object
        // from a separate game array. Keep the pool's own active list in sync.
        // The index map makes this swap-removal O(1), including large bloon waves.
        const activeIndex = this.#activeIndices.get(obj);
        if (activeIndex !== undefined) {
            const last = this.#active.pop();
            this.#activeIndices.delete(obj);
            if (activeIndex < this.#active.length) {
                this.#active[activeIndex] = last;
                this.#activeIndices.set(last, activeIndex);
            }
        }

        this.#pool.push(obj);
        this.#pooled.add(obj);
    }

    removeAt(index) {
        if (index < 0 || index >= this.#active.length) return;

        this.release(this.#active[index]);
    }

    clear() {
        while (this.#active.length > 0) {
            this.release(this.#active[this.#active.length - 1]);
        }
    }

    get active() {
        return this.#active;
    }

    get size() {
        return this.#active.length;
    }
}
