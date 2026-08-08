// spatialGrid.js
// Implements spatial partitioning for efficient targeting and collision checks.

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
        // This prevents array reallocation on the next insert() call
        for (const bucket of this.cells.values()) {
            bucket.length = 0;
        }
    }

    insert(entity) {
        // Bucket entities into a coarse grid so nearby-target queries stay cheap.
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

    query(x, y, radius, out) {
        // Expand the search to a ring of neighboring cells around the requested area.
        // `out` is an optional caller-owned scratch array that is cleared and reused,
        // avoiding a fresh array allocation on every query. When omitted a new array
        // is returned (kept for API compatibility).
        const result = out || [];
        result.length = 0;
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
