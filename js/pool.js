// js/pool.js
export class ObjectPool {
    constructor(factoryMethod, resetMethod, initialSize = 100) {
        this.factoryMethod = factoryMethod;
        this.resetMethod = resetMethod;
        this.pool = [];
        this.active = []; 
        
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.factoryMethod());
        }
    }

    get() {
        let obj = this.pool.length > 0 ? this.pool.pop() : this.factoryMethod();
        this.active.push(obj);
        return obj;
    }

    release(obj) {
        if (this.resetMethod) this.resetMethod(obj);
        this.pool.push(obj);
    }

    removeAt(index) {
        let obj = this.active[index];
        let last = this.active.pop();
        if (index < this.active.length) {
            this.active[index] = last;
        }
        this.release(obj);
    }

    clear() {
        while (this.active.length > 0) {
            this.release(this.active.pop());
        }
    }
}