// utils.js
// Holds shared utility functions used across the game.

const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

const distanceSq = (x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
};

const withinRange = (x1, y1, x2, y2, r) => distanceSq(x1, y1, x2, y2) <= r * r;

const lerp = (a, b, t) => a + (b - a) * t;

const angle = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);

const distToSegment = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return distance(px, py, x1, y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return distance(px, py, x1 + t * dx, y1 + t * dy);
};

function getEffectiveRange(tower, engine, scale = 3.0) {
    const baseRange = typeof tower.stats.range === 'number' ? tower.stats.range : 100;
    const buffMult = typeof tower.buffedRange === 'number' ? tower.buffedRange : 0;
    const alchRange = tower.alchBuff ? tower.alchBuff.range : 0;
    
    const nightMod = 1.0 - (0.5 * (engine.nightAlpha || 0));
    const effRange = baseRange === 9999 ? 9999 : baseRange * scale * (1 + buffMult + alchRange) * nightMod;
    return effRange;
}

const GS = 1.3; // Assuming GS is 1.3 based on constants.js

function getFootprint(entity) {
    const fp = entity.stats?.footprint || entity.footprint;
    if (fp) {
        if (fp.shape === 'rect') {
            return { shape: 'rect', width: (fp.width || 0) * GS, height: (fp.height || 0) * GS };
        }
        return { shape: 'circle', radius: (fp.radius || 0) * GS };
    }
    // Fallback to hitRadius (which is already scaled by GS in constructors)
    return { shape: 'circle', radius: entity.hitRadius || 18 };
}

function circleRectIntersect(cx, cy, r, rx, ry, rw, rh) {
    const dx = cx - Math.max(rx - rw / 2, Math.min(cx, rx + rw / 2));
    const dy = cy - Math.max(ry - rh / 2, Math.min(cy, ry + rh / 2));
    return (dx * dx + dy * dy) < (r * r);
}

function intersectsFootprint(x1, y1, fp1, x2, y2, fp2) {
    if (fp1.shape === 'circle' && fp2.shape === 'circle') {
        return distanceSq(x1, y1, x2, y2) <= Math.pow(fp1.radius + fp2.radius, 2);
    }
    if (fp1.shape === 'rect' && fp2.shape === 'circle') {
        return circleRectIntersect(x2, y2, fp2.radius, x1, y1, fp1.width, fp1.height);
    }
    if (fp1.shape === 'circle' && fp2.shape === 'rect') {
        return circleRectIntersect(x1, y1, fp1.radius, x2, y2, fp2.width, fp2.height);
    }
    // Rect-Rect
    return Math.abs(x1 - x2) * 2 < (fp1.width + fp2.width) && Math.abs(y1 - y2) * 2 < (fp1.height + fp2.height);
}

function pointInFootprint(px, py, cx, cy, fp, scale = 1.0) {
    if (fp.shape === 'circle') {
        const r = fp.radius * scale;
        return distanceSq(px, py, cx, cy) <= r * r;
    }
    // Add small padding for easier selection of rectangles, apply scale
    const halfW = (fp.width / 2) * scale + 5;
    const halfH = (fp.height / 2) * scale + 5;
    return Math.abs(px - cx) <= halfW && Math.abs(py - cy) <= halfH;
}

function drawShadow(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.8, r, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
}

function deepFreeze(obj) {
    if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
        Object.keys(obj).forEach(key => deepFreeze(obj[key]));
        Object.freeze(obj);
    }
    return obj;
}

function drawImageCentered(ctx, asset, targetSize, offsetX = 0, offsetY = 0) {
    if (!asset || !asset.loaded) return;
    const maxDim = Math.max(asset.width, asset.height);
    if (maxDim === 0) return;
    const scale = targetSize / maxDim;
    const w = asset.width * scale;
    const h = asset.height * scale;
    ctx.drawImage(asset, -w / 2 + offsetX, -h / 2 + offsetY, w, h);
}

// Direction 2: Shared AoE Damage Helper
function applyAoeDamage(engine, x, y, radius, damage, dmgType, killerTower = null, effects = {}, options = {}) {
    let totalDmgDealt = 0;
    const nearby = engine.enemyGrid.query(x, y, radius);
    const maxHits = options.maxHits || Infinity;
    let hits = 0;

    for (let i = 0; i < nearby.length; i++) {
        if (hits >= maxHits) break;
        const e = nearby[i];
        if (!e || !e.alive) continue;

        const canSeeCamo = options.canSeeCamo || (killerTower && (killerTower.stats.canSeeCamo || killerTower.buffedCamo));
        if (e.isCamo && !canSeeCamo) continue;

        if (options.filter && !options.filter(e)) continue;

        const distSq = distanceSq(x, y, e.x, e.y);
        if (distSq > radius * radius) continue;

        const dmg = e.takeDamage(damage, dmgType, effects, killerTower);
        if (!isNaN(dmg) && dmg !== -1) {
            totalDmgDealt += dmg;
            if (killerTower) killerTower.damageDealt += dmg;
            hits++;
            if (options.onHit) options.onHit(e, dmg);
        }
    }
    return totalDmgDealt;
}

// Export the Utils object that the rest of the codebase expects
export const Utils = {
    distance,
    distanceSq,
    withinRange,
    lerp,
    angle,
    distToSegment,
    getEffectiveRange,
    getFootprint,
    intersectsFootprint,
    pointInFootprint,
    drawShadow,
    deepFreeze,
    drawImageCentered,
    applyAoeDamage
};

export { distance, distanceSq, withinRange, lerp, angle, distToSegment, getEffectiveRange, getFootprint, intersectsFootprint, pointInFootprint, drawShadow, deepFreeze, drawImageCentered, applyAoeDamage };
