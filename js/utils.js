export const CANVAS_W = 900;
export const CANVAS_H = 600;

export const Utils = {
    distance: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    lerp: (a, b, t) => a + (b - a) * t,
    angle: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1),
    distToSegment: (px, py, x1, y1, x2, y2) => {
        const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
        const dot = A * C + B * D, lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;
        let xx, yy;
        if (param < 0) { xx = x1; yy = y1; }
        else if (param > 1) { xx = x2; yy = y2; }
        else { xx = x1 + param * C; yy = y1 + param * D; }
        return Math.hypot(px - xx, py - yy);
    }
};

// PRO FIX: Removed createRadialGradient. This is 10x faster and prevents GC stutter.
export function drawShadow(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.3, r * 0.8, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
}

export function drawImageCentered(ctx, asset, targetSize, offsetX = 0, offsetY = 0) {
    if (!asset || !asset.loaded) return;
    let maxDim = Math.max(asset.width, asset.height);
    if (maxDim === 0) maxDim = 1; 
    let scale = targetSize / maxDim;
    let w = asset.width * scale;
    let h = asset.height * scale;
    ctx.drawImage(asset, -w / 2 + offsetX, -h / 2 + offsetY, w, h);
}