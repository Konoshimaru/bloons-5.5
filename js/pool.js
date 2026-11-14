// pool.js
// Provides object pooling for reusable gameplay entities.

export class ObjectPool {
    #factory;
    #reset;
    #pool = [];
    #active = [];
    #pooled = new WeakSet();

    constructor(factory, resetFn, initialSize = 100) {
        if (typeof factory !== 'function') {
            throw new Error("ObjectPool requires a factory function.");
        }
        this.#factory = factory;
        this.#reset = resetFn;

        for (let i = 0; i < initialSize; i++) {
            const obj = this.#factory();
            this.#pool.push(obj);
            this.#pooled.add(obj);
        }
    }

    get() {
        // Reuse an inactive object when possible so the game does not churn through allocations.
        const obj = this.#pool.pop() ?? this.#factory();
        this.#pooled.delete(obj);
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

        // Some gameplay systems release directly after removing their object
        // from a separate game array. Keep the pool's own active list in sync.
        const activeIndex = this.#active.indexOf(obj);
        if (activeIndex !== -1) {
            const last = this.#active.pop();
            if (activeIndex < this.#active.length) {
                this.#active[activeIndex] = last;
            }
        }

        if (this.#reset) {
            this.#reset(obj);
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
