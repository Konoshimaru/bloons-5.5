// pool.js
// Provides object pooling for reusable gameplay entities.

export class ObjectPool {
    #factory;
    #reset;
    #pool = [];
    #active = [];

    constructor(factory, resetFn, initialSize = 100) {
        if (typeof factory !== 'function') {
            throw new Error("ObjectPool requires a factory function.");
        }
        this.#factory = factory;
        this.#reset = resetFn;
        
        for (let i = 0; i < initialSize; i++) {
            this.#pool.push(this.#factory());
        }
    }

    get() {
        // Reuse an inactive object when possible so the game does not churn through allocations.
        const obj = this.#pool.pop() ?? this.#factory();
        this.#active.push(obj);
        return obj;
    }

    release(obj) {
        // Reset the object before returning it to the pool so it can be reused safely.
        if (this.#reset) {
            this.#reset(obj);
        }
        this.#pool.push(obj);
    }

    removeAt(index) {
        if (index < 0 || index >= this.#active.length) return;
        
        const obj = this.#active[index];
        const last = this.#active.pop();
        
        if (index < this.#active.length) {
            this.#active[index] = last;
        }
        
        this.release(obj);
    }

    clear() {
        while (this.#active.length > 0) {
            this.release(this.#active.pop());
        }
    }

    get active() {
        return this.#active;
    }

    get size() {
        return this.#active.length;
    }
}
