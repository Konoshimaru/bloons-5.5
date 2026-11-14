import { describe, expect, it } from 'vitest';
import { normalizeMapEditorDocument } from '../js/mapEditorValidation.js';

const validMap = {
    name: 'Test Map',
    paths: [{
        waypoints: [
            { x: 10, y: 20 },
            { x: 40, y: 50, curve: { cx: 25, cy: 30 } }
        ],
        width: 45,
        visible: true
    }],
    props: [{ type: 'hitbox', shape: 'box', x: 80, y: 90, w: 30, h: 40 }],
    waterBrushes: [{
        thickness: 18,
        points: [{ x: 5, y: 6 }, { x: 7, y: 8 }],
        color: '#3498db'
    }],
    image: null,
    imageNight: null,
    imageScale: 1,
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageMaintainRatio: false,
    waterVisible: true,
    propsVisible: true
};

describe('Map Editor document validation', () => {
    it('accepts a valid document and preserves its editor data', () => {
        const result = normalizeMapEditorDocument(validMap);

        expect(result.valid).toBe(true);
        if (!result.valid) return;
        expect(result.mapData).toEqual(validMap);
        expect(result.mapData).not.toBe(validMap);
        expect(result.mapData.paths[0]).not.toBe(validMap.paths[0]);
        expect(result.mapData.paths[0].waypoints[1].curve).not.toBe(validMap.paths[0].waypoints[1].curve);
    });

    it('fills missing optional arrays without mutating the source', () => {
        const source = { name: 'Draft', paths: [{ waypoints: [] }] };
        const result = normalizeMapEditorDocument(source);

        expect(result.valid).toBe(true);
        if (!result.valid) return;
        expect(result.mapData.props).toEqual([]);
        expect(result.mapData.waterBrushes).toEqual([]);
        expect(source).not.toHaveProperty('props');
        expect(source).not.toHaveProperty('waterBrushes');
    });

    it('converts a legacy top-level waypoints array into one path', () => {
        const result = normalizeMapEditorDocument({
            name: 'Legacy',
            waypoints: [{ x: 0, y: 0 }, { x: 100, y: 50 }]
        });

        expect(result.valid).toBe(true);
        if (!result.valid) return;
        expect(result.mapData.paths).toEqual([{
            waypoints: [{ x: 0, y: 0 }, { x: 100, y: 50 }]
        }]);
        expect(result.mapData).not.toHaveProperty('waypoints');
    });

    it('rejects non-object documents and missing path data', () => {
        expect(normalizeMapEditorDocument(null)).toMatchObject({ valid: false });
        expect(normalizeMapEditorDocument([])).toMatchObject({ valid: false });
        expect(normalizeMapEditorDocument({ name: 'No paths' })).toMatchObject({
            valid: false,
            error: expect.stringContaining('paths array')
        });
    });

    it('rejects malformed paths and non-finite waypoint coordinates', () => {
        for (const paths of [
            [null],
            [{ waypoints: null }],
            [{ waypoints: [{ x: 10, y: '20' }] }],
            [{ waypoints: [{ x: Number.NaN, y: 20 }] }],
            [{ waypoints: [{ x: 10, y: Number.POSITIVE_INFINITY }] }]
        ]) {
            expect(normalizeMapEditorDocument({ paths })).toMatchObject({ valid: false });
        }
    });

    it('rejects invalid path width, visibility and curve coordinates', () => {
        for (const path of [
            { waypoints: [], width: 0 },
            { waypoints: [], width: Number.NaN },
            { waypoints: [], visible: 'yes' },
            { waypoints: [{ x: 1, y: 2 }, { x: 3, y: 4, curve: { cx: 5, cy: Number.NaN } }] },
            { waypoints: [{ x: 1, y: 2, curve: { cx: 3, cy: 4 } }, { x: 5, y: 6 }] }
        ]) {
            expect(normalizeMapEditorDocument({ paths: [path] })).toMatchObject({ valid: false });
        }
    });

    it('rejects malformed object hitboxes', () => {
        for (const props of [
            [null],
            [{ x: 1, y: 2, shape: 5 }],
            [{ x: 1, y: 2, shape: 'box', w: -1 }],
            [{ x: Number.NaN, y: 2 }]
        ]) {
            expect(normalizeMapEditorDocument({ paths: [], props })).toMatchObject({ valid: false });
        }
    });

    it('rejects malformed water brush strokes', () => {
        for (const waterBrushes of [
            [null],
            [{ thickness: 10, points: null }],
            [{ thickness: 0, points: [{ x: 1, y: 2 }] }],
            [{ thickness: 10, points: [{ x: 1, y: Number.NaN }] }]
        ]) {
            expect(normalizeMapEditorDocument({ paths: [], waterBrushes })).toMatchObject({ valid: false });
        }
    });

    it('rejects invalid background and visibility settings', () => {
        for (const field of ['imageScale', 'imageOffsetX', 'imageOffsetY']) {
            expect(normalizeMapEditorDocument({ paths: [], [field]: Number.NaN }))
                .toMatchObject({ valid: false });
        }
        expect(normalizeMapEditorDocument({ paths: [], image: 42 })).toMatchObject({ valid: false });
        expect(normalizeMapEditorDocument({ paths: [], waterVisible: 'true' })).toMatchObject({ valid: false });
    });

    it('preserves unknown top-level and nested metadata', () => {
        const source = {
            paths: [{ waypoints: [], futurePathFlag: { enabled: true } }],
            editorVersion: 4
        };
        const result = normalizeMapEditorDocument(source);

        expect(result.valid).toBe(true);
        if (!result.valid) return;
        expect(result.mapData.editorVersion).toBe(4);
        expect(result.mapData.paths[0].futurePathFlag).toEqual({ enabled: true });
    });
});
