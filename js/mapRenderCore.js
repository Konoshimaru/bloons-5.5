// js/mapRenderCore.js
import { GLOBAL_SCALE } from './constants.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

export const MapRenderCore = {
    drawPaths(ctx, paths, ignoreVisibility = false) {
        if (!paths) return;
        for (let p = 0; p < paths.length; p++) {
            const path = paths[p];
            if (!path || !Array.isArray(path.waypoints)) continue;
            if (!ignoreVisibility && path.visible === false) continue;
            const waypoints = path.waypoints;
            if (waypoints.length < 2) continue;
            const pathWidth = path.width || 45;
            
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = pathWidth + 8;
            ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(waypoints[0].x, waypoints[0].y + 4);
            for (let i = 1; i < waypoints.length; i++) {
                const wp = waypoints[i];
                if (wp.curve) ctx.quadraticCurveTo(wp.curve.cx, wp.curve.cy, wp.x, wp.y + 4);
                else ctx.lineTo(wp.x, wp.y + 4);
            }
            ctx.stroke();
            
            ctx.strokeStyle = '#a8825a';
            ctx.lineWidth = pathWidth;
            ctx.beginPath();
            ctx.moveTo(waypoints[0].x, waypoints[0].y);
            for (let i = 1; i < waypoints.length; i++) {
                const wp = waypoints[i];
                if (wp.curve) ctx.quadraticCurveTo(wp.curve.cx, wp.curve.cy, wp.x, wp.y);
                else ctx.lineTo(wp.x, wp.y);
            }
            ctx.stroke();
        }
    },

    drawWater(ctx, waterBrushes) {
        if (!waterBrushes) return;
        for (let brush of waterBrushes) {
            if (!brush || !brush.points || brush.points.length === 0) continue;
            ctx.strokeStyle = brush.color || '#3498db';
            ctx.lineWidth = brush.thickness;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(brush.points[0].x, brush.points[0].y);
            for (let i = 1; i < brush.points.length; i++) ctx.lineTo(brush.points[i].x, brush.points[i].y);
            if (brush.points.length === 1) ctx.arc(brush.points[0].x, brush.points[0].y, brush.thickness / 2, 0, Math.PI * 2);
            ctx.stroke();
        }
    },

    drawProps(ctx, props) {
        if (!props) return;
        for (let p of props) {
            if (!p) continue;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.fillStyle = 'rgba(155, 89, 182, 0.4)';
            ctx.strokeStyle = '#9b59b6';
            ctx.lineWidth = 2;
            
            if (p.shape === 'box') {
                const w = p.w || 30, h = p.h || 30;
                ctx.fillRect(-w/2, -h/2, w, h);
                ctx.strokeRect(-w/2, -h/2, w, h);
            } else {
                const r = p.r || 15;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            ctx.restore();
        }
    }
};
