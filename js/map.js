// map.js
import { Utils } from './utils.js';
import { GameEngine } from './engine.js';
import Assets from './assets.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';

const GRID_SIZE = 40;
const PATH_WIDTH = 45;
const PATH_HALF_WIDTH = PATH_WIDTH / 2;
const PLACEMENT_PADDING = 18;
const PROP_RADIUS_SMALL = 15;

export class GameMap {
    constructor(mapDataOrIndex) {
        const mapData = typeof mapDataOrIndex === 'number' 
            ? GameEngine.maps[mapDataOrIndex] 
            : mapDataOrIndex;

        if (!mapData) throw new Error("Invalid map data provided to GameMap.");

        this.data = JSON.parse(JSON.stringify(mapData)); 
        this.props = this.data.props || []; 
        this.waterBrushes = this.data.waterBrushes || []; 
        
        if (this.data.waypoints && !this.data.paths) {
            this.data.paths = [{ waypoints: this.data.waypoints }];
            delete this.data.waypoints;
        }
        if (!this.data.paths) this.data.paths = [];

        this._initPathfinding();
        this._initBackground();
        this._initCache();
    }

    _initPathfinding() {
        this.paths = [];
        for (let p = 0; p < this.data.paths.length; p++) {
            const pathData = this.data.paths[p];
            const waypoints = pathData.waypoints;
            const segments = [];
            const cumulativeDistances = [0];
            let totalLength = 0;

            for (let i = 0; i < waypoints.length - 1; i++) {
                const p1 = { x: waypoints[i].x, y: waypoints[i].y };
                const p2 = { x: waypoints[i+1].x, y: waypoints[i+1].y };
                
                if (p2.curve) {
                    const cp = { x: p2.curve.cx, y: p2.curve.cy };
                    const subdiv = 15;
                    let prevPt = p1;
                    for (let s = 1; s <= subdiv; s++) {
                        const t = s / subdiv;
                        const x = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * cp.x + t * t * p2.x;
                        const y = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * cp.y + t * t * p2.y;
                        const dist = Utils.distance(prevPt.x, prevPt.y, x, y);
                        segments.push({ p1: prevPt, p2: {x, y}, dist });
                        totalLength += dist;
                        cumulativeDistances.push(totalLength);
                        prevPt = {x, y};
                    }
                } else {
                    const dist = Utils.distance(p1.x, p1.y, p2.x, p2.y);
                    segments.push({ p1, p2, dist });
                    totalLength += dist;
                    cumulativeDistances.push(totalLength);
                }
            }
            this.paths.push({ segments, cumulativeDistances, totalLength });
        }
    }

    _initBackground() {
        this.backgroundImage = null;
        if (this.data.image) this.backgroundImage = Assets.get(`map_${this.data.image}`);
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
        for(let x = 0; x < CANVAS_WIDTH; x += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); ctx.stroke(); }
        for(let y = 0; y < CANVAS_HEIGHT; y += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke(); }

        for (let brush of this.waterBrushes) {
            if (brush.points.length === 0) continue;
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = brush.thickness;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(brush.points[0].x, brush.points[0].y);
            for (let i = 1; i < brush.points.length; i++) {
                ctx.lineTo(brush.points[i].x, brush.points[i].y);
            }
            if (brush.points.length === 1) {
                ctx.arc(brush.points[0].x, brush.points[0].y, brush.thickness / 2, 0, Math.PI * 2);
            }
            ctx.stroke();
        }

        this.props.forEach(p => this._drawProp(ctx, p));

        for (let p = 0; p < this.data.paths.length; p++) {
            // PRO FIX: Skip drawing the path in-game if it's marked as invisible
            if (this.data.paths[p].visible === false) continue;
            
            const waypoints = this.data.paths[p].waypoints;
            if (waypoints.length < 2) continue;
            
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = PATH_WIDTH + 8;
            ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(waypoints[0].x + this.offsetX, waypoints[0].y + this.offsetY + 4);
            for (let i = 1; i < waypoints.length; i++) {
                const wp = waypoints[i];
                if (wp.curve) ctx.quadraticCurveTo(wp.curve.cx + this.offsetX, wp.curve.cy + this.offsetY, wp.x + this.offsetX, wp.y + this.offsetY + 4);
                else ctx.lineTo(wp.x + this.offsetX, wp.y + this.offsetY + 4);
            }
            ctx.stroke();
            
            ctx.strokeStyle = '#a8825a';
            ctx.lineWidth = PATH_WIDTH;
            ctx.beginPath();
            ctx.moveTo(waypoints[0].x + this.offsetX, waypoints[0].y + this.offsetY);
            for (let i = 1; i < waypoints.length; i++) {
                const wp = waypoints[i];
                if (wp.curve) ctx.quadraticCurveTo(wp.curve.cx + this.offsetX, wp.curve.cy + this.offsetY, wp.x + this.offsetX, wp.y + this.offsetY);
                else ctx.lineTo(wp.x + this.offsetX, wp.y + this.offsetY);
            }
            ctx.stroke();
        }
    }

    _drawProp(ctx, p) {
        const px = p.x;
        const py = p.y;
        if (p.type === 'tree') {
            ctx.fillStyle = '#6e552f'; ctx.fillRect(px - 3, py - 5, 6, 15);
            ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.arc(px, py - 10, 15, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(px - 5, py - 15, 10, 0, Math.PI * 2); ctx.fill();
        } else if (p.type === 'bush') {
            ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.arc(px, py, 12, 0, Math.PI * 2); ctx.arc(px + 10, py + 2, 10, 0, Math.PI * 2); ctx.fill();
        } else if (p.type === 'rock') {
            ctx.fillStyle = '#7f8c8d'; ctx.beginPath(); ctx.moveTo(px - 15, py); ctx.lineTo(px - 5, py - 15); ctx.lineTo(px + 10, py - 10); ctx.lineTo(px + 15, py); ctx.fill();
        } else if (p.type === 'pond') {
            const r = p.r || 30; 
            ctx.fillStyle = '#3498db';
            ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.66, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath(); ctx.ellipse(px - r/3, py - r/4, r/3, r/5, 0, 0, Math.PI * 2); ctx.fill();
        }
    }

    _findSegmentIndex(distance, cumulativeDistances) {
        let low = 0, high = cumulativeDistances.length - 1, mid = 0;
        while (low <= high) {
            mid = Math.floor((low + high) / 2);
            if (distance < cumulativeDistances[mid]) high = mid - 1;
            else if (distance > cumulativeDistances[mid]) low = mid + 1;
            else return mid;
        }
        return Math.max(0, high);
    }

    getTotalLength(pathIndex = 0) {
        if (this.paths[pathIndex]) return this.paths[pathIndex].totalLength;
        return 0;
    }

    getPositionAtDistance(distance, pathIndex = 0) {
        const path = this.paths[pathIndex];
        if (!path || path.segments.length === 0) return { x: 0, y: 0, finished: true };
        if (distance <= 0) return { x: path.segments[0].p1.x, y: path.segments[0].p1.y, finished: false };
        if (distance >= path.totalLength) {
            const last = path.segments[path.segments.length - 1].p2;
            return { x: last.x, y: last.y, finished: true };
        }
        const segIndex = this._findSegmentIndex(distance, path.cumulativeDistances);
        const seg = path.segments[segIndex];
        const segStartDist = path.cumulativeDistances[segIndex];
        const t = (distance - segStartDist) / seg.dist;
        return { x: Utils.lerp(seg.p1.x, seg.p2.x, t), y: Utils.lerp(seg.p1.y, seg.p2.y, t), finished: false };
    }

    isOnPath(x, y) {
        for (let p = 0; p < this.paths.length; p++) {
            for (let i = 0; i < this.paths[p].segments.length; i++) {
                const seg = this.paths[p].segments[i];
                const dist = Utils.distToSegment(x, y, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
                if (dist < PATH_HALF_WIDTH + PLACEMENT_PADDING) return true;
            }
        }
        return false;
    }

    getNearestPathPoint(x, y) {
        let bestPoint = { x: 0, y: 0 }, bestDist = Infinity;
        for (let p = 0; p < this.paths.length; p++) {
            for (let i = 0; i < this.paths[p].segments.length; i++) {
                const seg = this.paths[p].segments[i];
                const A = x - seg.p1.x, B = y - seg.p1.y, C = seg.p2.x - seg.p1.x, D = seg.p2.y - seg.p1.y;
                const dot = A * C + B * D, lenSq = C * C + D * D;
                let param = -1;
                if (lenSq !== 0) param = dot / lenSq;
                let xx, yy;
                if (param < 0) { xx = seg.p1.x; yy = seg.p1.y; } 
                else if (param > 1) { xx = seg.p2.x; yy = seg.p2.y; } 
                else { xx = seg.p1.x + param * C; yy = seg.p1.y + param * D; }
                const dist = Utils.distance(x, y, xx, yy);
                if (dist < bestDist) { bestDist = dist; bestPoint = { x: xx, y: yy }; }
            }
        }
        return bestPoint;
    }

    isInWater(x, y) {
        for (let p of this.props) {
            if (p.type === 'pond') {
                const r = p.r || 30;
                if (Utils.distance(x, y, p.x, p.y) < r) return true;
            }
        }
        for (let brush of this.waterBrushes) {
            const r = brush.thickness / 2;
            if (brush.points.length === 1) {
                if (Utils.distance(x, y, brush.points[0].x, brush.points[0].y) < r) return true;
            } else {
                for (let i = 0; i < brush.points.length - 1; i++) {
                    const p1 = { x: brush.points[i].x, y: brush.points[i].y };
                    const p2 = { x: brush.points[i+1].x, y: brush.points[i+1].y };
                    if (Utils.distToSegment(x, y, p1.x, p1.y, p2.x, p2.y) < r) return true;
                }
            }
        }
        return false;
    }

    isOnProp(x, y) {
        for (let p of this.props) {
            if (p.type === 'pond') continue; 
            const r = p.type === 'pond' ? (p.r || 30) : PROP_RADIUS_SMALL; 
            if (Utils.distance(x, y, p.x, p.y) < r) return true;
        }
        return false;
    }
}