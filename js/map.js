import { Utils } from './utils.js';
import { GameEngine } from './engine.js';
import Assets from './assets.js';
import { Names } from './names.js';

export class GameMap {
    constructor(mapIndex) { 
        let mapData = GameEngine.maps[mapIndex];
        if (!mapData) {
            console.error("Map data not found for index:", mapIndex, "Defaulting to map 0.");
            mapData = GameEngine.maps[0];
        }

        this.data = JSON.parse(JSON.stringify(mapData)); 
        this.waypoints = this.data.waypoints; 
        this.props = this.data.props || []; 
        this.pathWidth = 45; 
        
        // Check if the map has a custom sprite background
        this.backgroundImage = null;
        if (this.data.image) {
            this.backgroundImage = Assets.get(Names.getMap(this.data.image));
        }
        
        // Vector Cache Fallback
        this.cacheCanvas = document.createElement('canvas');
        this.cacheCanvas.width = 900;
        this.cacheCanvas.height = 600;
        this.drawToCache(this.cacheCanvas.getContext('2d'));
    }
    
    drawToCache(ctx) {
        ctx.fillStyle = '#8acc4d'; ctx.fillRect(0, 0, 900, 600);
        ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.lineWidth = 1;
        for(let x=0; x<900; x+=40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 600); ctx.stroke(); }
        for(let y=0; y<600; y+=40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(900, y); ctx.stroke(); }
        
        this.props.forEach(p => this.drawProp(ctx, p));
        
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = this.pathWidth + 8; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(this.waypoints[0].x, this.waypoints[0].y + 4);
        for (let i = 1; i < this.waypoints.length; i++) ctx.lineTo(this.waypoints[i].x, this.waypoints[i].y + 4);
        ctx.stroke();
        
        ctx.strokeStyle = '#a8825a'; ctx.lineWidth = this.pathWidth;
        ctx.beginPath(); ctx.moveTo(this.waypoints[0].x, this.waypoints[0].y);
        for (let i = 1; i < this.waypoints.length; i++) ctx.lineTo(this.waypoints[i].x, this.waypoints[i].y);
        ctx.stroke();
    }
    
    draw(ctx) {
        // PRO FIX: Draw the BTD6 style background image if it exists
        if (this.backgroundImage && this.backgroundImage.loaded) {
            ctx.drawImage(this.backgroundImage, 0, 0, 900, 600);
        } else {
            // Fallback to vector cache
            ctx.drawImage(this.cacheCanvas, 0, 0);
        }
    }
    
    drawProp(ctx, p) {
        // Kept only for vector fallback cache
        if (p.type === 'tree') { ctx.fillStyle = '#6e552f'; ctx.fillRect(p.x-3, p.y-5, 6, 15); ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.arc(p.x, p.y-10, 15, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(p.x-5, p.y-15, 10, 0, Math.PI*2); ctx.fill(); }
        else if (p.type === 'bush') { ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI*2); ctx.arc(p.x+10, p.y+2, 10, 0, Math.PI*2); ctx.fill(); }
        else if (p.type === 'rock') { ctx.fillStyle = '#7f8c8d'; ctx.beginPath(); ctx.moveTo(p.x-15, p.y); ctx.lineTo(p.x-5, p.y-15); ctx.lineTo(p.x+10, p.y-10); ctx.lineTo(p.x+15, p.y); ctx.fill(); }
        else if (p.type === 'pond') { ctx.fillStyle = '#3498db'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 30, 20, 0, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(p.x-5, p.y-5, 10, 5, 0, 0, Math.PI*2); ctx.fill(); }
    }
    
    getPositionAtDistance(distance) {
        let traveled = 0;
        for (let i = 0; i < this.waypoints.length - 1; i++) {
            const p1 = this.waypoints[i], p2 = this.waypoints[i + 1]; const segLen = Utils.distance(p1.x, p1.y, p2.x, p2.y);
            if (traveled + segLen >= distance) { const t = (distance - traveled) / segLen; return { x: Utils.lerp(p1.x, p2.x, t), y: Utils.lerp(p1.y, p2.y, t), finished: false }; }
            traveled += segLen;
        }
        const last = this.waypoints[this.waypoints.length - 1]; return { x: last.x, y: last.y, finished: true };
    }
    
    isOnPath(x, y) {
        for (let i = 0; i < this.waypoints.length - 1; i++) {
            const p1 = this.waypoints[i], p2 = this.waypoints[i + 1]; const A = x - p1.x, B = y - p1.y, C = p2.x - p1.x, D = p2.y - p1.y;
            const dot = A * C + B * D, lenSq = C * C + D * D; let param = -1; if (lenSq !== 0) param = dot / lenSq;
            let xx, yy; if (param < 0) { xx = p1.x; yy = p1.y; } else if (param > 1) { xx = p2.x; yy = p2.y; } else { xx = p1.x + param * C; yy = p1.y + param * D; }
            if (Utils.distance(x, y, xx, yy) < this.pathWidth / 2 + 18) return true;
        }
        return false;
    }
    
    getNearestPathPoint(x, y) {
        let bestPoint = { x: this.waypoints[0].x, y: this.waypoints[0].y };
        let bestDist = Infinity;
        for (let i = 0; i < this.waypoints.length - 1; i++) {
            const p1 = this.waypoints[i], p2 = this.waypoints[i + 1];
            const A = x - p1.x, B = y - p1.y, C = p2.x - p1.x, D = p2.y - p1.y;
            const dot = A * C + B * D, lenSq = C * C + D * D; let param = -1; if (lenSq !== 0) param = dot / lenSq;
            let xx, yy; 
            if (param < 0) { xx = p1.x; yy = p1.y; } 
            else if (param > 1) { xx = p2.x; yy = p2.y; } 
            else { xx = p1.x + param * C; yy = p1.y + param * D; }
            let dist = Utils.distance(x, y, xx, yy);
            if (dist < bestDist) { bestDist = dist; bestPoint = { x: xx, y: yy }; }
        }
        return bestPoint;
    }
        getTotalLength() {
        if (this._totalLength) return this._totalLength;
        let len = 0;
        for (let i = 0; i < this.waypoints.length - 1; i++) {
            len += Utils.distance(this.waypoints[i].x, this.waypoints[i].y, this.waypoints[i+1].x, this.waypoints[i+1].y);
        }
        this._totalLength = len;
        return len;
    }
    
    isOnProp(x, y) { 
        // We still check props so you can't place towers on rocks/ponds 
        // even if the background image hides them visually
        for(let p of this.props) { 
            const r = p.type === 'pond' ? 25 : 15; 
            if (Utils.distance(x, y, p.x, p.y) < r) return true; 
        } 
        return false; 
    }
}