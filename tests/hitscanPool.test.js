import { describe, expect, it } from 'vitest';
import {
    addHitscan,
    MAX_RETAINED_HITSCAN_RECORDS,
    updateHitscans
} from '../js/hitscanPool.js';

describe('hitscan record reuse', () => {
    it('recycles expired records and reuses their identity for later shots', () => {
        const tower = { hitscans: [] };
        const first = addHitscan(tower, 1, 2, 3, 4, 0.1);
        addHitscan(tower, 5, 6, 7, 8, 0.2);

        updateHitscans(tower, 0.1);

        expect(tower.hitscans).toHaveLength(1);
        expect(tower.hitscans[0].x1).toBe(5);
        expect(tower._hitscanPool).toContain(first);

        const reused = addHitscan(tower, 9, 10, 11, 12, 0.1);
        expect(reused).toBe(first);
        expect(tower.hitscans[1]).toBe(first);
        expect(reused).toMatchObject({ x1: 9, y1: 10, x2: 11, y2: 12, life: 0.1 });
    });

    it('compacts multiple expired records without skipping live entries', () => {
        const tower = { hitscans: [] };
        addHitscan(tower, 0, 0, 1, 1, 0.01);
        const live = addHitscan(tower, 1, 1, 2, 2, 0.2);
        addHitscan(tower, 2, 2, 3, 3, 0.01);
        addHitscan(tower, 3, 3, 4, 4, 0.01);

        updateHitscans(tower, 0.02);

        expect(tower.hitscans).toEqual([live]);
        expect(tower._hitscanPool).toHaveLength(3);
    });

    it('bounds retained records after a very large burst', () => {
        const tower = { hitscans: [] };
        for (let i = 0; i < 100; i++) addHitscan(tower, i, 0, i + 1, 1, 0.01);

        updateHitscans(tower, 0.02);

        expect(tower.hitscans).toHaveLength(0);
        expect(tower._hitscanPool).toHaveLength(MAX_RETAINED_HITSCAN_RECORDS);
    });
});
