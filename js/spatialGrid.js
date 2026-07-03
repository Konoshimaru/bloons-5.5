const HASH_OFFSET = 32768; // Prevents negative keys for coordinates within +/- 32k
const HASH_MULTIPLIER = 65536;

export class SpatialGrid {
    constructor(cellSize = 80) {
        this.cellSize = cellSize;
        this.cells = new Map();
    }

    _getKey(cx, cy) {
        // Numeric keys are significantly faster to hash and compare in V8 than strings
        return (cx + HASH_OFFSET) * HASH_MULTIPLIER + (cy + HASH_OFFSET);
    }

    clear() {
        this.cells.clear();
    }

    insert(entity) {
        const cx = Math.floor(entity.x / this.cellSize);
        const cy = Math.floor(entity.y / this.cellSize);
        const key = this._getKey(cx, cy);
        
        let bucket = this.cells.get(key);
        if (!bucket) {
            bucket = [];
            this.cells.set(key, bucket);
        }
        bucket.push(entity);
    }

    query(x, y, radius) {
        const result = [];
        const r = Math.ceil(radius / this.cellSize) + 1;
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        
        for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
                const key = this._getKey(cx + dx, cy + dy);
                const bucket = this.cells.get(key);
                
                if (bucket) {
                    const len = bucket.length;
                    for (let i = 0; i < len; i++) {
                        result.push(bucket[i]);
                    }
                }
            }
        }
        return result;
    }

    queryAll() {
        const result = [];
        for (const bucket of this.cells.values()) {
            const len = bucket.length;
            for (let i = 0; i < len; i++) {
                result.push(bucket[i]);
            }
        }
        return result;
    }
}