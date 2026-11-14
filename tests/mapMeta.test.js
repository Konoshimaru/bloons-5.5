import { describe, expect, it } from 'vitest';
import {
    MAP_TIERS,
    getMapTier,
    getTierInfo,
    getMapThumbUrl,
    getMapFullUrl
} from '../js/mapMeta.js';

describe('map presentation metadata', () => {
    it('exposes the five supported tiers in menu order', () => {
        expect(MAP_TIERS.map(tier => tier.id)).toEqual([
            'beginner', 'intermediate', 'advanced', 'expert', 'custom'
        ]);
        expect(MAP_TIERS.every(tier => tier.label && /^#[0-9a-f]{6}$/i.test(tier.color))).toBe(true);
    });

    it('assigns known built-in maps to their declared tiers', () => {
        expect(getMapTier({ image: 'monkey_meadow' })).toBe('beginner');
        expect(getMapTier({ image: 'AlpineRun' })).toBe('intermediate');
        expect(getMapTier({ image: 'maze' })).toBe('advanced');
        expect(getMapTier({ image: 'bloon_circle' })).toBe('expert');
    });

    it('prioritizes the custom tier and defaults unknown maps to intermediate', () => {
        expect(getMapTier({ image: 'maze' }, true)).toBe('custom');
        expect(getMapTier({ image: 'future-map' })).toBe('intermediate');
        expect(getMapTier(null)).toBe('intermediate');
    });

    it('returns matching tier descriptors and falls back to intermediate', () => {
        expect(getTierInfo('expert')).toMatchObject({
            id: 'expert',
            label: 'Expert'
        });
        expect(getTierInfo('not-a-tier')).toMatchObject({
            id: 'intermediate',
            label: 'Intermediate'
        });
    });

    it('builds preview and full image paths for maps that have an image key', () => {
        const map = { image: 'winter_falls' };
        expect(getMapThumbUrl(map)).toBe('sprites/maps/thumbs/winter_falls.webp');
        expect(getMapFullUrl(map)).toBe('sprites/maps/winter_falls.png');
    });

    it('returns an empty URL when a map image key is absent', () => {
        expect(getMapThumbUrl(null)).toBe('');
        expect(getMapFullUrl({ name: 'No image' })).toBe('');
    });
});
