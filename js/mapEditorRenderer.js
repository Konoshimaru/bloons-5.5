import { CANVAS_WIDTH, CANVAS_HEIGHT } from './config.js';

export default {
    drawWaterStroke(ctx, brush) {
        if (!brush || !brush.points || brush.points.length === 0) return;
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = brush.thickness;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(brush.points[0].x, brush.points[0].y);
        for (let i = 1; i < brush.points.length; i++) ctx.lineTo(brush.points[i].x, brush.points[i].y);
        if (brush.points.length === 1) ctx.arc(brush.points[0].x, brush.points[0].y, brush.thickness / 2, 0, Math.PI * 2);
        ctx.stroke();
    },
    
    draw() {
        if (!this.mapData) return;
        const ctx = this.ctx;
        const EDITOR_W = CANVAS_WIDTH; // 1280
        const EDITOR_H = CANVAS_HEIGHT; // 720
        
        // FIX: CLEAR THE CANVAS FIRST to prevent cloning/ghosting when scaling!
        ctx.clearRect(0, 0, EDITOR_W, EDITOR_H);
        
        const scale = this.mapData.imageScale || 1;
        const offX = this.mapData.imageOffsetX || 0;
        const offY = this.mapData.imageOffsetY || 0;
        let w = EDITOR_W * scale;
        let h = EDITOR_H * scale;
        
        if (this.mapData.imageMaintainRatio && this.bgImage && this.bgImage.width > 0) {
            const ratio = this.bgImage.height / this.bgImage.width;
            h = w * ratio;
        }

        const drawDay = !this.previewNight && this.bgImage && this.bgImage.loaded && this.mapData.image;
        const drawNight = (this.previewNight || !drawDay) && this.bgNightImage && this.bgNightImage.loaded && this.mapData.imageNight;

        if (drawDay) {
            ctx.drawImage(this.bgImage, offX, offY, w, h);
        } else if (drawNight) {
            ctx.drawImage(this.bgNightImage, offX, offY, w, h);
        } else {
            ctx.fillStyle = '#8acc4d';
            ctx.fillRect(0, 0, EDITOR_W, EDITOR_H);
        }
        
        if (this.refImage) {
            ctx.globalAlpha = 0.5;
            const rw = this.refImage.width * this.refScale;
            const rh = this.refImage.height * this.refScale;
            ctx.drawImage(this.refImage, this.refX - rw/2, this.refY - rh/2, rw, rh);
            ctx.globalAlpha = 1.0;
        }
        
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        for (let x = 0; x < EDITOR_W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, EDITOR_H); ctx.stroke(); }
        for (let y = 0; y < EDITOR_H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(EDITOR_W, y); ctx.stroke(); }
        
        // --- DRAW IN-GAME SIDEBAR OVERLAY ---
        const SIDEBAR_WIDTH = 300; // The exact width of the in-game shop
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(EDITOR_W - SIDEBAR_WIDTH, 0, SIDEBAR_WIDTH, EDITOR_H);
        
        ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(EDITOR_W - SIDEBAR_WIDTH, 0);
        ctx.lineTo(EDITOR_W - SIDEBAR_WIDTH, EDITOR_H);
        ctx.stroke();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('In-Game UI Sidebar', EDITOR_W - (SIDEBAR_WIDTH / 2), 30);
        ctx.fillText('(Do not place track here)', EDITOR_W - (SIDEBAR_WIDTH / 2), 50);
        ctx.textAlign = 'left';
        // ------------------------------------

        if (this.mapData.waterVisible !== false) {
            if (Array.isArray(this.mapData.waterBrushes)) {
                for (let brush of this.mapData.waterBrushes) this.drawWaterStroke(ctx, brush);
            }
            if (this.currentWaterStroke) this.drawWaterStroke(ctx, this.currentWaterStroke);
        }

        if (this.mapData.propsVisible !== false) {
            if (Array.isArray(this.mapData.props)) {
                for (let p of this.mapData.props) {
                    if (p && p.x !== undefined) this.drawEditorProp(ctx, p);
                }
            }
        }
        
        if (Array.isArray(this.mapData.paths)) {
            for (let p = 0; p < this.mapData.paths.length; p++) {
                const path = this.mapData.paths[p];
                if (!path || !Array.isArray(path.waypoints)) continue;
                const isSelected = p === this.selectedPath;
                
                if (path.visible === false && !isSelected) continue;
                if (path.visible === false) ctx.globalAlpha = 0.3;
                
                ctx.strokeStyle = '#a8825a';
                ctx.lineWidth = path.width || 45; // FIX: Use path's specific width!
                ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                
                if (path.waypoints.length > 0) {
                    ctx.beginPath();
                    ctx.moveTo(path.waypoints[0].x, path.waypoints[0].y);
                    for (let i = 1; i < path.waypoints.length; i++) {
                        const wp = path.waypoints[i];
                        if (!wp) continue;
                        if (wp.curve) ctx.quadraticCurveTo(wp.curve.cx, wp.curve.cy, wp.x, wp.y);
                        else ctx.lineTo(wp.x, wp.y);
                    }
                    ctx.stroke();
                }
                
                for (let i = 0; i < path.waypoints.length; i++) {
                    const wp = path.waypoints[i];
                    if (!wp) continue;
                    if (i === 0) {
                        ctx.fillStyle = '#2ecc70'; 
                        ctx.beginPath();
                        ctx.moveTo(wp.x - 6, wp.y - 15);
                        ctx.lineTo(wp.x + 6, wp.y - 10);
                        ctx.lineTo(wp.x - 6, wp.y - 5);
                        ctx.closePath();
                        ctx.fill();
                        ctx.fillRect(wp.x - 8, wp.y - 15, 2, 15);
                    } else if (i === path.waypoints.length - 1) {
                        ctx.fillStyle = '#e74c3c'; 
                        ctx.beginPath();
                        ctx.moveTo(wp.x - 6, wp.y - 15);
                        ctx.lineTo(wp.x + 6, wp.y - 10);
                        ctx.lineTo(wp.x - 6, wp.y - 5);
                        ctx.closePath();
                        ctx.fill();
                        ctx.fillRect(wp.x - 8, wp.y - 15, 2, 15);
                    }
                    
                    ctx.fillStyle = '#fff';
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(wp.x, wp.y, 8, 0, Math.PI * 2);
                    ctx.fill(); ctx.stroke();
                    
                    if (wp.curve) {
                        ctx.strokeStyle = '#f1c40f';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo((i > 0 && path.waypoints[i-1]) ? path.waypoints[i-1].x : wp.x, (i > 0 && path.waypoints[i-1]) ? path.waypoints[i-1].y : wp.y);
                        ctx.lineTo(wp.curve.cx, wp.curve.cy);
                        ctx.lineTo(wp.x, wp.y);
                        ctx.stroke();
                        
                        ctx.fillStyle = '#f1c40f';
                        ctx.beginPath();
                        ctx.arc(wp.curve.cx, wp.curve.cy, 6, 0, Math.PI * 2);
                        ctx.fill(); ctx.stroke();
                    }
                }
                ctx.globalAlpha = 1.0;
            }
        }
        
        if (this.selectedPoint) {
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.selectedPoint.x, this.selectedPoint.y, 12, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        if (this.selectedProp) {
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 3;
            if (this.selectedProp.shape === 'box') {
                const w = this.selectedProp.w || 30, h = this.selectedProp.h || 30;
                ctx.strokeRect(this.selectedProp.x - w/2, this.selectedProp.y - h/2, w, h);
            } else {
                const r = this.selectedProp.r || 15;
                ctx.beginPath();
                ctx.arc(this.selectedProp.x, this.selectedProp.y, r, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        
        if (this.currentTool === 'water') {
            ctx.strokeStyle = this.waterEraseMode ? '#e74c3c' : '#3498db';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.mouse.x, this.mouse.y, this.waterBrushSize / 2, 0, Math.PI * 2);
            ctx.stroke();
        }
    },
    
    drawEditorProp(ctx, p) {
        ctx.fillStyle = 'rgba(155, 89, 182, 0.2)';
        ctx.strokeStyle = '#9b59b6';
        ctx.lineWidth = 2;
        
        if (p.shape === 'box') {
            const w = p.w || 30, h = p.h || 30;
            ctx.fillRect(p.x - w/2, p.y - h/2, w, h);
            ctx.strokeRect(p.x - w/2, p.y - h/2, w, h);
        } else {
            const r = p.r || 15;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(p.shape === 'box' ? 'Box' : 'Circle', p.x, p.y + 3);
        ctx.textAlign = 'left';
    }
};