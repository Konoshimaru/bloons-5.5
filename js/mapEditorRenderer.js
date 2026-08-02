// js/mapEditorRenderer.js
import { CANVAS_WIDTH, CANVAS_HEIGHT, GAME_AREA_WIDTH } from './constants.js';
import { MapEditorState } from './mapEditorState.js';
import { MapRenderCore } from './mapRenderCore.js';

export default {
    draw() {
        if (!MapEditorState.mapData) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.save();
        
        ctx.translate(MapEditorState.camera.x, MapEditorState.camera.y);
        ctx.scale(MapEditorState.camera.zoom, MapEditorState.camera.zoom);

        const scale = MapEditorState.mapData.imageScale || 1;
        const offX = MapEditorState.mapData.imageOffsetX || 0;
        const offY = MapEditorState.mapData.imageOffsetY || 0;
        let w = CANVAS_WIDTH * scale;
        let h = CANVAS_HEIGHT * scale;

        const img = MapEditorState.previewNight ? MapEditorState.bgNightImage : MapEditorState.bgImage;
        const imgName = MapEditorState.previewNight ? MapEditorState.mapData.imageNight : MapEditorState.mapData.image;

        if (img && imgName) {
            if (MapEditorState.mapData.imageMaintainRatio && img.width > 0) {
                h = w * (img.height / img.width);
            }
            ctx.drawImage(img, offX, offY, w, h);
        } else {
            ctx.fillStyle = '#8acc4d';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }

        if (MapEditorState.refImage) {
            ctx.globalAlpha = 0.5;
            const rw = MapEditorState.refImage.width * MapEditorState.refScale;
            const rh = MapEditorState.refImage.height * MapEditorState.refScale;
            ctx.drawImage(MapEditorState.refImage, MapEditorState.refX - rw/2, MapEditorState.refY - rh/2, rw, rh);
            ctx.globalAlpha = 1.0;
        }

        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(GAME_AREA_WIDTH, 0, CANVAS_WIDTH - GAME_AREA_WIDTH, CANVAS_HEIGHT);

        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1 / MapEditorState.camera.zoom;
        for (let x = 0; x <= GAME_AREA_WIDTH; x += MapEditorState.gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); ctx.stroke(); }
        for (let y = 0; y <= CANVAS_HEIGHT; y += MapEditorState.gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(GAME_AREA_WIDTH, y); ctx.stroke(); }

        // Draw a black border line at the boundary
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4 / MapEditorState.camera.zoom;
        ctx.beginPath();
        ctx.moveTo(GAME_AREA_WIDTH, 0);
        ctx.lineTo(GAME_AREA_WIDTH, CANVAS_HEIGHT);
        ctx.stroke();

        if (MapEditorState.mapData.waterVisible !== false) {
            MapRenderCore.drawWater(ctx, MapEditorState.mapData.waterBrushes);
            if (MapEditorState.currentWaterStroke) MapRenderCore.drawWater(ctx, [MapEditorState.currentWaterStroke]);
        }
        if (MapEditorState.mapData.propsVisible !== false) MapRenderCore.drawProps(ctx, MapEditorState.mapData.props);
        MapRenderCore.drawPaths(ctx, MapEditorState.mapData.paths);

        this._drawEditorOverlays(ctx);
        ctx.restore();
    },

    _drawEditorOverlays(ctx) {
        if (Array.isArray(MapEditorState.mapData.paths)) {
            for (let p = 0; p < MapEditorState.mapData.paths.length; p++) {
                const path = MapEditorState.mapData.paths[p];
                if (!path || !Array.isArray(path.waypoints)) continue;
                const isSelected = p === MapEditorState.selectedPath;
                if (path.visible === false && !isSelected) continue;
                if (path.visible === false) ctx.globalAlpha = 0.3;
                
                for (let i = 0; i < path.waypoints.length; i++) {
                    const wp = path.waypoints[i];
                    if (i === 0) { ctx.fillStyle = '#2ecc70'; ctx.beginPath(); ctx.moveTo(wp.x - 6, wp.y - 15); ctx.lineTo(wp.x + 6, wp.y - 10); ctx.lineTo(wp.x - 6, wp.y - 5); ctx.closePath(); ctx.fill(); ctx.fillRect(wp.x - 8, wp.y - 15, 2, 15); }
                    else if (i === path.waypoints.length - 1) { ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.moveTo(wp.x - 6, wp.y - 15); ctx.lineTo(wp.x + 6, wp.y - 10); ctx.lineTo(wp.x - 6, wp.y - 5); ctx.closePath(); ctx.fill(); ctx.fillRect(wp.x - 8, wp.y - 15, 2, 15); }
                    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(wp.x, wp.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                    if (wp.curve) {
                        ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.moveTo(path.waypoints[i-1].x, path.waypoints[i-1].y); ctx.lineTo(wp.curve.cx, wp.curve.cy); ctx.lineTo(wp.x, wp.y); ctx.stroke();
                        ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(wp.curve.cx, wp.curve.cy, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                    }
                }
                ctx.globalAlpha = 1.0;
            }
        }

        for (let pt of MapEditorState.selectedPoints) { ctx.strokeStyle = '#3498db'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pt.x, pt.y, 12, 0, Math.PI * 2); ctx.stroke(); }
        for (let prop of MapEditorState.selectedProps) {
            ctx.strokeStyle = '#3498db'; ctx.lineWidth = 3;
            if (prop.shape === 'box') {
                let w = prop.w || 30; let h = prop.h || 30;
                ctx.strokeRect(prop.x - w/2, prop.y - h/2, w, h);
            } else {
                let r = prop.r || 15;
                ctx.beginPath(); ctx.arc(prop.x, prop.y, r, 0, Math.PI * 2); ctx.stroke();
            }
        }

        if (MapEditorState.currentTool === 'water') {
            ctx.strokeStyle = MapEditorState.waterEraseMode ? '#e74c3c' : '#3498db';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(MapEditorState.mouseWorldX, MapEditorState.mouseWorldY, MapEditorState.waterBrushSize / 2, 0, Math.PI * 2); ctx.stroke();
        }
    }
};
