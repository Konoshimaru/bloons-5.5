import { Utils } from './utils.js';
import { GameEngine } from './engine.js';
import Assets from './assets.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GLOBAL_SCALE } from './constants.js';
import { RANGE_SCALE } from './config.js'; 
import { MapRenderCore } from './mapRenderCore.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

const GRID_SIZE = 40;
const DEFAULT_PATH_WIDTH = 45;
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
        if (!this.data.imageScale) this.data.imageScale = 1.0;
        if (!this.data.imageOffsetX) this.data.imageOffsetX = 0;
        if (!this.data.imageOffsetY) this.data.imageOffsetY = 0;
        if (!this.data.imageMaintainRatio) this.data.imageMaintainRatio = false;

        this._initPathfinding();
        this._initPathSamples(); 
        this._initBackground();
        this._initCache();
    }

    _initPathfinding() {
        this.paths = [];
        for (let p = 0; p < this.data.paths.length; p++) {
            const pathData = this.data.paths[p];
            if (!pathData.width) pathData.width = DEFAULT_PATH_WIDTH;
            const waypoints = pathData.waypoints;
            const segments = [];
            const cumulativeDistances = [0];
            let totalLength = 0;

            for (let i = 0; i < waypoints.length - 1; i++) {
                const p1 = waypoints[i];
                const p2 = waypoints[i+1];
                
                if (p2.curve) {
                    const cp = { x: p2.curve.cx, y: p2.curve.cy };
                    const subdiv = 40; 
                    let prevPt = { x: p1.x, y: p1.y };
                    for (let s = 1; s <= subdiv; s++) {
                        const t = s / subdiv;
                        const x = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * cp.x + t * t * p2.x;
                        const y = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * cp.y + t * t * p2.y;
                        const dist = Utils.distance(prevPt.x, prevPt.y, x, y);
                        if (dist > 0) {
                            segments.push({ p1: prevPt, p2: {x, y}, dist });
                            totalLength += dist;
                            cumulativeDistances.push(totalLength);
                        }
                        prevPt = {x, y};
                    }
                } else {
                    const dist = Utils.distance(p1.x, p1.y, p2.x, p2.y);
                    segments.push({ p1: {x: p1.x, y: p1.y}, p2: {x: p2.x, y: p2.y}, dist });
                    totalLength += dist;
                    cumulativeDistances.push(totalLength);
                }
            }
            this.paths.push({ segments, cumulativeDistances, totalLength, width: pathData.width });
        }
    }

    _initPathSamples() {
        this._pathSamples = [];
        const step = 5; 
        for (let p = 0; p < this.paths.length; p++) {
            const path = this.paths[p];
            for (let i = 0; i < path.segments.length; i++) {
                const seg = path.segments[i];
                const numSteps = Math.max(1, Math.floor(seg.dist / step));
                for (let j = 0; j <= numSteps; j++) {
                    const t = j / numSteps;
                    const px = Utils.lerp(seg.p1.x, seg.p2.x, t);
                    const py = Utils.lerp(seg.p1.y, seg.p2.y, t);
                    const distAlong = (i > 0 ? path.cumulativeDistances[i-1] : 0) + seg.dist * t;
                    this._pathSamples.push({ x: px, y: py, pathIndex: p, distAlong: distAlong });
                }
            }
        }
    }

    _initBackground() {
        this.backgroundImage = null;
        this.nightImage = null; 
        if (this.data.image) {
            this.backgroundImage = Assets.get(`map_${this.data.image}`);
            if (this.data.imageNight) {
                this.nightImage = Assets.get(`map_${this.data.imageNight}`);
            } else {
                this.nightImage = Assets.get(`map_${this.data.image}_night`);
            }
        }
    }

    _initCache() {
        this.cacheCanvas = document.createElement('canvas');
        this.cacheCanvas.width = CANVAS_WIDTH;
        this.cacheCanvas.height = CANVAS_HEIGHT;
        this.drawToCache(this.cacheCanvas.getContext('2d'));
    }

    draw(ctx) {
        const scale = this.data.imageScale || 1;
        const offX = this.data.imageOffsetX || 0;
        const offY = this.data.imageOffsetY || 0;
        let w = CANVAS_WIDTH * scale;
        let h = CANVAS_HEIGHT * scale;
        
        if (this.backgroundImage && this.backgroundImage.loaded) {
            if (this.data.imageMaintainRatio && this.backgroundImage.width > 0) {
                h = w * (this.backgroundImage.height / this.backgroundImage.width);
            }
            ctx.drawImage(this.backgroundImage, offX, offY, w, h);
        } else {
            ctx.fillStyle = '#8acc4d';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }

        if (this.nightImage && this.nightImage.loaded && GameEngine.nightAlpha > 0) {
            ctx.globalAlpha = GameEngine.nightAlpha;
            let nh = h;
            if (this.data.imageMaintainRatio && this.nightImage.width > 0) {
                nh = w * (this.nightImage.height / this.nightImage.width);
            }
            ctx.drawImage(this.nightImage, offX, offY, w, nh);
            ctx.globalAlpha = 1.0;
        }

        ctx.drawImage(this.cacheCanvas, 0, 0);
    }

    drawToCache(ctx) {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        if (this.data.waterVisible !== false) {
            MapRenderCore.drawWater(ctx, this.waterBrushes);
        }

        // Hitboxes are purely for placement logic. We DO NOT draw them during actual gameplay!
        // if (this.data.propsVisible !== false) {
        //     MapRenderCore.drawProps(ctx, this.props);
        // }

        // Hidden paths stay hidden! Removed the 'true' flag.
        MapRenderCore.drawPaths(ctx, this.data.paths);
    }

    _findSegmentIndex(distance, cumulativeDistances) {
        if (isNaN(distance)) return 0; 
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
        const t = seg.dist > 0 ? (distance - segStartDist) / seg.dist : 0;
        return { x: Utils.lerp(seg.p1.x, seg.p2.x, t), y: Utils.lerp(seg.p1.y, seg.p2.y, t), finished: false };
    }

    isOnPath(x, y) {
        for (let p = 0; p < this.paths.length; p++) {
            const pathWidth = (this.data.paths[p] && this.data.paths[p].width) ? this.data.paths[p].width : DEFAULT_PATH_WIDTH;
            const halfWidth = pathWidth / 2;
            for (let i = 0; i < this.paths[p].segments.length; i++) {
                const seg = this.paths[p].segments[i];
                const dist = Utils.distToSegment(x, y, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
                if (dist < halfWidth + PLACEMENT_PADDING) return true;
            }
        }
        return false;
    }

    getNearestPathPoint(x, y) {
        let bestPoint = { x: 0, y: 0 }, bestDistSq = Infinity;
        for (let i = 0; i < this._pathSamples.length; i++) {
            const s = this._pathSamples[i];
            const distSq = Utils.distanceSq(x, y, s.x, s.y);
            if (distSq < bestDistSq) { 
                bestDistSq = distSq; 
                bestPoint = { x: s.x, y: s.y }; 
            }
        }
        return bestPoint;
    }

    getTrackPointsInRange(x, y, radius) {
        const points = [];
        const radiusSq = radius * radius;
        for (let i = 0; i < this._pathSamples.length; i++) {
            const s = this._pathSamples[i];
            const distSq = Utils.distanceSq(x, y, s.x, s.y);
            if (distSq <= radiusSq) {
                points.push({ 
                    x: s.x, 
                    y: s.y, 
                    pathIndex: s.pathIndex, 
                    distAlong: s.distAlong, 
                    distToTower: Math.sqrt(distSq) 
                });
            }
        }
        return points;
    }

    isInWater(x, y) {
        for (let p of this.props) {
            if (!p) continue;
            const isWater = p.type === 'pond' || p.collision === 'water';
            if (isWater) {
                const r = p.r || 30;
                if (Utils.withinRange(x, y, p.x, p.y, r)) return true;
            }
        }
        for (let brush of this.waterBrushes) {
            const r = brush.thickness / 2;
            if (brush.points.length === 1) {
                if (Utils.withinRange(x, y, brush.points[0].x, brush.points[0].y, r)) return true;
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
        if (!this.props) return false;
        for (let p of this.props) {
            if (!p) continue;
            
            if (p.shape === 'box') {
                const w = p.w || 30;
                const h = p.h || 30;
                if (Math.abs(x - p.x) < w / 2 && Math.abs(y - p.y) < h / 2) return true;
            } else {
                const r = p.r || 15; 
                if (Utils.withinRange(x, y, p.x, p.y, r)) return true;
            }
        }
        return false;
    }

    isOnFrozenWater(x, y, towers) {
        if (!this.isInWater(x, y)) return false;
        for (let t of towers) {
            if (t && t.type === 'ice' && t.upgrades[1] >= 3) {
                const range = (t.stats.range || 20) * RANGE_SCALE * GS;
                if (Utils.withinRange(x, y, t.x, t.y, range + 35)) return true;
            }
        }
        return false;
    }
}