export const CANVAS_WIDTH = 900;
export const CANVAS_HEIGHT = 600;

/**
 * Calculates the Euclidean distance between two points.
 * Optimized to use multiplication instead of Math.hypot for V8 performance.
 */
export const distance = (x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Linear interpolation between a and b by t.
 */
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Calculates the angle in radians from point 1 to point 2.
 */
export const angle = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);

/**
 * Calculates the shortest distance from a point to a line segment.
 * Optimized to minimize allocations and use multiplication over Math.hypot.
 */
export const distToSegment = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    
    let param = -1;
    if (lenSq !== 0) {
        param = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    }
    
    let xx, yy;
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * dx;
        yy = y1 + param * dy;
    }
    
    const ddx = px - xx;
    const ddy = py - yy;
    return Math.sqrt(ddx * ddx + ddy * ddy);
};

/**
 * Backward-compatible Utils object.
 * Future refactors should import the standalone functions directly for minor V8 optimizations.
 */
export const Utils = {
    distance,
    lerp,
    angle,
    distToSegment
};

/**
 * Draws a fast, flat ellipse shadow.
 */
export function drawShadow(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.3, r * 0.8, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Draws an image centered at the current context origin, scaled to fit within targetSize.
 */
export function drawImageCentered(ctx, asset, targetSize, offsetX = 0, offsetY = 0) {
    if (!asset || !asset.loaded) return;
    
    const maxDim = Math.max(asset.width, asset.height);
    if (maxDim === 0) return;
    
    const scale = targetSize / maxDim;
    const w = asset.width * scale;
    const h = asset.height * scale;
    ctx.drawImage(asset, -w / 2 + offsetX, -h / 2 + offsetY, w, h);
}