import { describe, expect, it } from 'vitest';
import { GameMap } from '../js/map.js';

function buildMap(waypoints, { width = 45, props = [], waterBrushes = [] } = {}) {
    const map = Object.create(GameMap.prototype);
    map.data = { paths: [{ waypoints, width }], props, waterBrushes };
    map.props = props;
    map.waterBrushes = waterBrushes;
    map._initPathfinding();
    map._initPathSamples();
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

    it('uses path width plus placement padding for placement checks', () => {
        const map = buildMap([
            { x: 0, y: 0 },
            { x: 100, y: 0 }
        ], { width: 20 });

        expect(map.isOnPath(50, 0)).toBe(true);
        expect(map.isOnPath(50, 27)).toBe(true);
        expect(map.isOnPath(50, 29)).toBe(false);
    });

    it('finds nearby real path samples and reports their distances', () => {
        const map = buildMap([
            { x: 0, y: 0 },
            { x: 100, y: 0 }
        ]);

        expect(map.getNearestPathPoint(52, 10)).toEqual({ x: 50, y: 0 });
        expect(map.getTrackPointsInRange(50, 0, 5)).toEqual([
            { x: 45, y: 0, pathIndex: 0, distAlong: 45, distToTower: 5 },
            { x: 50, y: 0, pathIndex: 0, distAlong: 50, distToTower: 0 },
            { x: 55, y: 0, pathIndex: 0, distAlong: 55, distToTower: 5 }
        ]);
    });

    it('checks both prop hitboxes and water brush geometry', () => {
        const map = buildMap([
            { x: 0, y: 0 },
            { x: 100, y: 0 }
        ], {
            props: [
                { type: 'pond', x: 10, y: 10, r: 8 },
                { shape: 'box', x: 50, y: 50, w: 20, h: 10 }
            ],
            waterBrushes: [
                { thickness: 20, points: [{ x: 0, y: 100 }, { x: 100, y: 100 }] },
                { thickness: 12, points: [{ x: 200, y: 100 }] }
            ]
        });

        expect(map.isOnProp(10, 10)).toBe(true);
        expect(map.isOnProp(50, 54)).toBe(true);
        expect(map.isOnProp(50, 56)).toBe(false);
        expect(map.isInWater(10, 10)).toBe(true);
        expect(map.isInWater(50, 100)).toBe(true);
        expect(map.isInWater(200, 100)).toBe(true);
        expect(map.isInWater(50, 130)).toBe(false);
    });

    it('detects ice-tower freezing coverage only on water', () => {
        const map = buildMap([
            { x: 0, y: 0 },
            { x: 100, y: 0 }
        ], {
            props: [{ type: 'pond', x: 50, y: 50, r: 20 }]
        });
        const iceTower = {
            type: 'ice',
            upgrades: [0, 3],
            stats: { range: 80 },
            x: 50,
            y: 50
        };

        expect(map.isOnFrozenWater(50, 50, [iceTower])).toBe(true);
        expect(map.isOnFrozenWater(300, 300, [iceTower])).toBe(false);
        expect(map.isOnFrozenWater(50, 50, [{ ...iceTower, upgrades: [0, 2] }])).toBe(false);
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
