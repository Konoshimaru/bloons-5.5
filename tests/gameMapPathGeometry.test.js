import { describe, expect, it } from 'vitest';
import { GameMap } from '../js/map.js';

function buildMap(waypoints) {
    const map = Object.create(GameMap.prototype);
    map.data = { paths: [{ waypoints }] };
    map._initPathfinding();
    return map;
}

describe('GameMap production path geometry', () => {
    it('subdivides a quadratic curve into the real runtime segment count', () => {
        const map = buildMap([
            { x: 0, y: 0 },
            { x: 100, y: 0, curve: { cx: 50, cy: 50 } }
        ]);

        expect(map.paths).toHaveLength(1);
        expect(map.paths[0].segments).toHaveLength(40);
        expect(map.paths[0].totalLength).toBeGreaterThan(100);
        expect(map.paths[0].cumulativeDistances).toHaveLength(41);
    });

    it('keeps straight waypoint pairs as one segment', () => {
        const map = buildMap([
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 50 }
        ]);

        expect(map.paths[0].segments).toHaveLength(2);
        expect(map.paths[0].totalLength).toBeCloseTo(150);
        expect(map.paths[0].cumulativeDistances).toEqual([0, 100, 150]);
    });

    it('samples positions along the generated curved path', () => {
        const map = buildMap([
            { x: 0, y: 0 },
            { x: 100, y: 0, curve: { cx: 50, cy: 50 } }
        ]);
        const midpoint = map.getPositionAtDistance(map.getTotalLength() / 2);

        expect(midpoint.x).toBeCloseTo(50, 0);
        expect(midpoint.y).toBeGreaterThan(20);
        expect(midpoint.y).toBeLessThan(30);
        expect(midpoint.finished).toBe(false);
    });

    it('returns the endpoint as finished when distance reaches path length', () => {
        const map = buildMap([
            { x: 0, y: 0 },
            { x: 100, y: 0, curve: { cx: 50, cy: 50 } }
        ]);
        const endpoint = map.getPositionAtDistance(map.getTotalLength());

        expect(endpoint.x).toBe(100);
        expect(endpoint.y).toBe(0);
        expect(endpoint.finished).toBe(true);
    });
});
