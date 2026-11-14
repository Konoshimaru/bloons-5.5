import { describe, expect, it } from 'vitest';
import {
    distanceSqPointToSegment,
    segmentIntersectsCircle
} from '../js/collisionGeometry.js';

describe('projectile swept-collision geometry', () => {
    it('detects a circle crossed between the projectile start and end positions', () => {
        expect(segmentIntersectsCircle(0, 0, 100, 0, 50, 0, 5)).toBe(true);
    });

    it('detects a hit when the circle is near the segment, not only on the centre line', () => {
        expect(segmentIntersectsCircle(0, 0, 100, 0, 50, 7, 8)).toBe(true);
    });

    it('does not report a hit when the circle is outside the swept radius', () => {
        expect(segmentIntersectsCircle(0, 0, 100, 0, 50, 9, 8)).toBe(false);
    });

    it('detects overlap at either endpoint', () => {
        expect(segmentIntersectsCircle(0, 0, 100, 0, -3, 0, 3)).toBe(true);
        expect(segmentIntersectsCircle(0, 0, 100, 0, 103, 0, 3)).toBe(true);
    });

    it('handles a projectile that did not move', () => {
        expect(segmentIntersectsCircle(5, 5, 5, 5, 8, 5, 3)).toBe(true);
        expect(segmentIntersectsCircle(5, 5, 5, 5, 9, 5, 3)).toBe(false);
    });

    it('handles diagonal movement', () => {
        expect(segmentIntersectsCircle(0, 0, 100, 100, 50, 50, 1)).toBe(true);
        expect(segmentIntersectsCircle(0, 0, 100, 100, 50, 60, 5)).toBe(false);
    });

    it('clamps the closest point to the finite segment, not the infinite line', () => {
        expect(distanceSqPointToSegment(10, 0, 0, 0, 5, 0)).toBe(25);
        expect(segmentIntersectsCircle(0, 0, 5, 0, 10, 0, 4)).toBe(false);
    });

    it('handles negative coordinates and rejects invalid coordinates or radii', () => {
        expect(segmentIntersectsCircle(-100, -10, -20, -10, -60, -10, 1)).toBe(true);
        expect(segmentIntersectsCircle(0, 0, 10, 0, Number.NaN, 0, 1)).toBe(false);
        expect(segmentIntersectsCircle(0, 0, 10, 0, 5, 0, Number.NaN)).toBe(false);
    });
});
