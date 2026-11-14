import { describe, expect, it } from 'vitest';
import { EnemyTypes } from '../js/data.js';
import { GLOBAL_SCALE } from '../js/constants.js';
import { SpatialGrid } from '../js/spatialGrid.js';
import { sweptSegmentQueryRadius, segmentIntersectsCircle } from '../js/collisionGeometry.js';

const MAX_ENEMY_RADIUS = Math.max(
    ...Object.values(EnemyTypes).map(type => (type.radius || 10) * GLOBAL_SCALE)
);

describe('projectile swept-collision broadphase', () => {
    it('sizes the spatial query to include the largest bloon hitbox', () => {
        expect(MAX_ENEMY_RADIUS).toBe(110 * GLOBAL_SCALE);
        const radius = sweptSegmentQueryRadius(0, 0, 100, 0, 5, MAX_ENEMY_RADIUS);
        expect(radius).toBe(50 + 5 + 110 * GLOBAL_SCALE);
    });

    it('finds a BAD-sized target near the end of the swept segment even when its center lies outside the old padding', () => {
        const grid = new SpatialGrid(40);
        const badSizedTarget = { x: -148, y: 0, radius: MAX_ENEMY_RADIUS, alive: true };
        grid.insert(badSizedTarget);

        const searchRadius = sweptSegmentQueryRadius(
            0, 0, 100, 0, 5, MAX_ENEMY_RADIUS
        );
        const candidates = grid.query(50, 0, searchRadius, []);

        expect(candidates).toContain(badSizedTarget);
        expect(segmentIntersectsCircle(
            0, 0, 100, 0, badSizedTarget.x, badSizedTarget.y,
            badSizedTarget.radius + 5
        )).toBe(true);
    });

    it('does not depend on target direction or a non-zero projectile travel distance', () => {
        const radius = sweptSegmentQueryRadius(100, 0, 0, 0, 5, MAX_ENEMY_RADIUS);
        expect(radius).toBe(50 + 5 + MAX_ENEMY_RADIUS);

        const stationaryRadius = sweptSegmentQueryRadius(10, 10, 10, 10, 5, MAX_ENEMY_RADIUS);
        expect(stationaryRadius).toBe(5 + MAX_ENEMY_RADIUS);
    });

    it('clamps negative radii and rejects non-finite coordinates safely', () => {
        expect(sweptSegmentQueryRadius(0, 0, 10, 0, -5, -20)).toBe(5);
        expect(sweptSegmentQueryRadius(Number.NaN, 0, 10, 0, 5, 10)).toBe(0);
    });
});
