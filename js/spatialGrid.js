export class SpatialGrid {
    constructor(cellSize = 80) {
        this.cellSize = cellSize;
        this.cells = new Map();
    }
    _key(x, y) {
        return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    }
    clear() { this.cells.clear(); }
    insert(entity) {
        const key = this._key(entity.x, entity.y);
        let bucket = this.cells.get(key);
        if (!bucket) { bucket = []; this.cells.set(key, bucket); }
        bucket.push(entity);
    }
    query(x, y, radius) {
        const result = [];
        const r = Math.ceil(radius / this.cellSize) + 1;
        const cx = Math.floor(x / this.cellSize), cy = Math.floor(y / this.cellSize);
        for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
                const bucket = this.cells.get(`${cx + dx},${cy + dy}`);
                if (bucket) {
                    for (let i = 0; i < bucket.length; i++) result.push(bucket[i]);
                }
            }
        }
        return result;
    }
    queryAll() {
        const result = [];
        for (const bucket of this.cells.values()) {
            for (let i = 0; i < bucket.length; i++) result.push(bucket[i]);
        }
        return result;
    }
}