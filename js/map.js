// map.js
// Builds and queries the map layout, path, and placement restrictions.

import { Utils } from './utils.js';
import { GameEngine } from './engine.js'; // Backward compatibility for index-based lookup
import Assets from './assets.js';

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 600;
const GRID_SIZE = 40;
const PATH_WIDTH = 45;
const PATH_HALF_WIDTH = PATH_WIDTH / 2;
const PLACEMENT_PADDING = 18;
const PROP_RADIUS_SMALL = 15;
const PROP_RADIUS_LARGE = 25;

// GameMap stores the level layout, path, and props that define where enemies can travel and where towers may be placed.
export class GameMap {
    constructor(mapDataOrIndex) {
        const mapData = typeof mapDataOrIndex === 'number' 
            ? GameEngine.maps[mapDataOrIndex] 
            : mapDataOrIndex;

        if (!mapData) {
            throw new Error("Invalid map data provided to GameMap.");
        }

        // Clone the map definition so edits do not mutate the shared template data.
        this.data = JSON.parse(JSON.stringify(mapData)); 
        this.waypoints = this.data.waypoints; 
        this.props = this.data.props || []; 
        
        this._initPathfinding();
        this._initBackground();
        this._initCache();
    }

    _initPathfinding() {
        // The path is split into segments so the engine can quickly calculate enemy movement and placement validity.
        this.segments = [];
        this.cumulativeDistances = [0];
        this.totalLength = 0;

        for (let i = 0; i < this.waypoints.length - 1; i++) {
            const p1 = this.waypoints[i];
            const p2 = this.waypoints[i + 1];
            const dist = Utils.distance(p1.x, p1.y, p2.x, p2.y);
            
            this.segments.push({ p1, p2, dist });
            this.totalLength += dist;
            this.cumulativeDistances.push(this.totalLength);
        }
    }

    _initBackground() {
        this.backgroundImage = null;
        if (this.data.image) {
            this.backgroundImage = Assets.get(`map_${this.data.image}`);
        }
    }

    _initCache() {
        this.cacheCanvas = document.createElement('canvas');
        this.cacheCanvas.width = CANVAS_WIDTH;
        this.cacheCanvas.height = CANVAS_HEIGHT;
        this.drawToCache(this.cacheCanvas.getContext('2d'));
    }

    draw(ctx) {
        if (this.backgroundImage && this.backgroundImage.loaded) {
            ctx.drawImage(this.backgroundImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        } else {
            ctx.drawImage(this.cacheCanvas, 0, 0);
        }
    }

    drawToCache(ctx) {
        ctx.fillStyle = '#8acc4d'; 
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        ctx.strokeStyle = 'rgba(0,0,0,0.05)'; 
        ctx.lineWidth = 1;
        for(let x = 0; x < CANVAS_WIDTH; x += GRID_SIZE) { 
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); ctx.stroke(); 
        }
        for(let y = 0; y < CANVAS_HEIGHT; y += GRID_SIZE) { 
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke(); 
        }
        
        this.props.forEach(p => this._drawProp(ctx, p));
        
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'; 
        ctx.lineWidth = PATH_WIDTH + 8; 
        ctx.lineJoin = 'round'; 
        ctx.lineCap = 'round';
        ctx.beginPath(); 
        ctx.moveTo(this.waypoints[0].x, this.waypoints[0].y + 4);
        for (let i = 1; i < this.waypoints.length; i++) {
            ctx.lineTo(this.waypoints[i].x, this.waypoints[i].y + 4);
        }
        ctx.stroke();
        
        ctx.strokeStyle = '#a8825a'; 
        ctx.lineWidth = PATH_WIDTH;
        ctx.beginPath(); 
        ctx.moveTo(this.waypoints[0].x, this.waypoints[0].y);
        for (let i = 1; i < this.waypoints.length; i++) {
            ctx.lineTo(this.waypoints[i].x, this.waypoints[i].y);
        }
        ctx.stroke();
    }

    _drawProp(ctx, p) {
        if (p.type === 'tree') { 
            ctx.fillStyle = '#6e552f'; 
            ctx.fillRect(p.x - 3, p.y - 5, 6, 15); 
            ctx.fillStyle = '#27ae60'; 
            ctx.beginPath(); 
            ctx.arc(p.x, p.y - 10, 15, 0, Math.PI * 2); 
            ctx.fill(); 
            ctx.fillStyle = '#2ecc71'; 
            ctx.beginPath(); 
            ctx.arc(p.x - 5, p.y - 15, 10, 0, Math.PI * 2); 
            ctx.fill(); 
        }
        else if (p.type === 'bush') { 
            ctx.fillStyle = '#27ae60'; 
            ctx.beginPath(); 
            ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); 
            ctx.arc(p.x + 10, p.y + 2, 10, 0, Math.PI * 2); 
            ctx.fill(); 
        }
        else if (p.type === 'rock') { 
            ctx.fillStyle = '#7f8c8d'; 
            ctx.beginPath(); 
            ctx.moveTo(p.x - 15, p.y); 
            ctx.lineTo(p.x - 5, p.y - 15); 
            ctx.lineTo(p.x + 10, p.y - 10); 
            ctx.lineTo(p.x + 15, p.y); 
            ctx.fill(); 
        }
        else if (p.type === 'pond') { 
            ctx.fillStyle = '#3498db'; 
            ctx.beginPath(); 
            ctx.ellipse(p.x, p.y, 30, 20, 0, 0, Math.PI * 2); 
            ctx.fill(); 
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; 
            ctx.beginPath(); 
            ctx.ellipse(p.x - 5, p.y - 5, 10, 5, 0, 0, Math.PI * 2); 
            ctx.fill(); 
        }
    }

    /**
     * O(log N) binary search for segment index
     */
    _findSegmentIndex(distance) {
        let low = 0;
        let high = this.cumulativeDistances.length - 1;
        let mid = 0;
        
        while (low <= high) {
            mid = Math.floor((low + high) / 2);
            if (distance < this.cumulativeDistances[mid]) {
                high = mid - 1;
            } else if (distance > this.cumulativeDistances[mid]) {
                low = mid + 1;
            } else {
                return mid;
            }
        }
        return Math.max(0, high);
    }

    getTotalLength() {
        return this.totalLength;
    }

    getPositionAtDistance(distance) {
        // This is the core path-following helper. It converts an enemy's traveled distance into its current map position.
        if (distance <= 0) {
            return { x: this.waypoints[0].x, y: this.waypoints[0].y, finished: false };
        }
        if (distance >= this.totalLength) {
            const last = this.waypoints[this.waypoints.length - 1];
            return { x: last.x, y: last.y, finished: true };
        }

        const segIndex = this._findSegmentIndex(distance);
        const seg = this.segments[segIndex];
        const segStartDist = this.cumulativeDistances[segIndex];
        const t = (distance - segStartDist) / seg.dist;

        return {
            x: Utils.lerp(seg.p1.x, seg.p2.x, t),
            y: Utils.lerp(seg.p1.y, seg.p2.y, t),
            finished: false
        };
    }

    isOnPath(x, y) {
        // Towers should not be built directly on the path, so this checks whether a point overlaps the route.
        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            const dist = Utils.distToSegment(x, y, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
            if (dist < PATH_HALF_WIDTH + PLACEMENT_PADDING) return true;
        }
        return false;
    }

    getNearestPathPoint(x, y) {
        let bestPoint = { x: this.waypoints[0].x, y: this.waypoints[0].y };
        let bestDist = Infinity;
        
        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            const A = x - seg.p1.x, B = y - seg.p1.y, C = seg.p2.x - seg.p1.x, D = seg.p2.y - seg.p1.y;
            const dot = A * C + B * D, lenSq = C * C + D * D; 
            let param = -1; 
            if (lenSq !== 0) param = dot / lenSq;
            
            let xx, yy; 
            if (param < 0) { xx = seg.p1.x; yy = seg.p1.y; } 
            else if (param > 1) { xx = seg.p2.x; yy = seg.p2.y; } 
            else { xx = seg.p1.x + param * C; yy = seg.p1.y + param * D; }
            
            const dist = Utils.distance(x, y, xx, yy);
            if (dist < bestDist) { 
                bestDist = dist; 
                bestPoint = { x: xx, y: yy }; 
            }
        }
        return bestPoint;
    }

    isOnProp(x, y) { 
        for (let p of this.props) { 
            const r = p.type === 'pond' ? PROP_RADIUS_LARGE : PROP_RADIUS_SMALL; 
            if (Utils.distance(x, y, p.x, p.y) < r) return true; 
        } 
        return false; 
    }
}
