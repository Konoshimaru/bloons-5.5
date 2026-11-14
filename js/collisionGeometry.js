// js/collisionGeometry.js
// Small, DOM-free geometry helpers shared by projectile collision code and tests.

/**
 * Returns the squared distance between a point and the closest point on a
 * line segment. A zero-length segment is treated as a point.
 */
export function distanceSqPointToSegment(px, py, x1, y1, x2, y2) {
    const values = [px, py, x1, y1, x2, y2];
    if (!values.every(Number.isFinite)) return Number.POSITIVE_INFINITY;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
        const offsetX = px - x1;
        const offsetY = py - y1;
        return offsetX * offsetX + offsetY * offsetY;
    }

    const projection = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
    const t = Math.min(1, Math.max(0, projection));
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    const offsetX = px - closestX;
    const offsetY = py - closestY;

    return offsetX * offsetX + offsetY * offsetY;
}

/**
 * Tests whether a moving point's segment intersects a circle.
 *
 * The projectile and enemy are treated as circles by expanding the target
 * radius by the projectile radius before calling this helper.
 */
export function segmentIntersectsCircle(x1, y1, x2, y2, circleX, circleY, radius) {
    if (!Number.isFinite(radius)) return false;
    const safeRadius = Math.max(0, radius);
    return distanceSqPointToSegment(
        circleX, circleY, x1, y1, x2, y2
    ) <= safeRadius * safeRadius;
}

/**
 * Returns a broadphase query radius that includes every target circle which
 * could intersect the swept projectile segment. The spatial grid query uses
 * this radius to gather candidate cells; segmentIntersectsCircle remains the
 * precise narrowphase test.
 */
export function sweptSegmentQueryRadius(
    startX, startY, endX, endY, projectileRadius, maxTargetRadius
) {
    const values = [startX, startY, endX, endY, projectileRadius, maxTargetRadius];
    if (!values.every(Number.isFinite)) return 0;

    const segmentLength = Math.hypot(endX - startX, endY - startY);
    return segmentLength / 2
        + Math.max(0, projectileRadius)
        + Math.max(0, maxTargetRadius);
}
