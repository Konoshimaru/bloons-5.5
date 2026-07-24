// utils.js
// Holds shared utility functions used across the game.

const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

// PRO FIX: Squared distance helpers to avoid Math.sqrt in hot loops
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

// FIX: Unified effective range calculation to prevent formula drift
function getEffectiveRange(tower, engine, scale = 3.0) {
    const baseRange = typeof tower.stats.range === 'number' ? tower.stats.range : 100;
    const buffMult = typeof tower.buffedRange === 'number' ? tower.buffedRange : 0;
    const alchRange = tower.alchBuff ? tower.alchBuff.range : 0;
    
    const nightMod = 1.0 - (0.5 * (engine.nightAlpha || 0));
    const effRange = baseRange === 9999 ? 9999 : baseRange * scale * (1 + buffMult + alchRange) * nightMod;
    return effRange;
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
// Replaces 15+ copy-pasted loops with a safe, circular, damage-tracking helper.
// FIX: Swapped killerTower and effects in the signature so calls like (engine, x, y, r, dmg, dmgType, tower, {}, {onHit}) align perfectly.
function applyAoeDamage(engine, x, y, radius, damage, dmgType, killerTower = null, effects = {}, options = {}) {
    let totalDmgDealt = 0;
    const nearby = engine.enemyGrid.query(x, y, radius);
    const maxHits = options.maxHits || Infinity;
    let hits = 0;

    for (let i = 0; i < nearby.length; i++) {
        if (hits >= maxHits) break;
        const e = nearby[i];
        if (!e || !e.alive) continue;

        // Camo check
        const canSeeCamo = options.canSeeCamo || (killerTower && (killerTower.stats.canSeeCamo || killerTower.buffedCamo));
        if (e.isCamo && !canSeeCamo) continue;

        // Custom filter (e.g., only MOABs)
        if (options.filter && !options.filter(e)) continue;

        // Circular distance check (spatial grid returns a square bounding box)
        const distSq = distanceSq(x, y, e.x, e.y);
        if (distSq > radius * radius) continue;

        // Apply damage
        const dmg = e.takeDamage(damage, dmgType, effects, killerTower);
        if (!isNaN(dmg) && dmg !== -1) {
            totalDmgDealt += dmg;
            if (killerTower) killerTower.damageDealt += dmg;
            hits++;
            
            // Optional callback for custom effects (slows, knockbacks)
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
    drawShadow,
    deepFreeze,
    drawImageCentered,
    applyAoeDamage
};

// Also export individual functions for cleaner imports where preferred
export { distance, distanceSq, withinRange, lerp, angle, distToSegment, getEffectiveRange, drawShadow, deepFreeze, drawImageCentered, applyAoeDamage };