import { beforeEach, describe, expect, it } from 'vitest';
import { MapEditorState } from '../js/mapEditorState.js';

describe('MapEditorState production behavior', () => {
    beforeEach(() => {
        MapEditorState.reset();
    });

    it('resets to a valid blank custom-map document', () => {
        expect(MapEditorState.mapData).toMatchObject({
            name: 'New Custom Map',
            paths: [],
            props: [],
            waterBrushes: [],
            waterVisible: true,
            propsVisible: true
        });
        expect(MapEditorState.selectedPath).toBe(-1);
        expect(MapEditorState.selectedPoints).toEqual([]);
        expect(MapEditorState.selectedProps).toEqual([]);
        expect(MapEditorState.isDirty).toBe(false);
    });

    it('converts screen coordinates through the current camera transform', () => {
        MapEditorState.camera = { x: 100, y: 40, zoom: 2 };

        expect(MapEditorState.screenToWorld(300, 140)).toEqual({ x: 100, y: 50 });
    });

    it('tracks dirty and clean editor state', () => {
        MapEditorState.markDirty();
        expect(MapEditorState.isDirty).toBe(true);

        MapEditorState.markClean();
        expect(MapEditorState.isDirty).toBe(false);
    });
});
