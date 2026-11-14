import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../js/ui.js', () => ({
    UI: { log: vi.fn() }
}));
vi.mock('../js/utils.js', () => ({
    Utils: { distToSegment: vi.fn(() => Number.POSITIVE_INFINITY) }
}));

import MapEditorInput from '../js/mapEditorInput.js';
import { MapEditorState } from '../js/mapEditorState.js';

function createInputContext() {
    return {
        ...MapEditorInput,
        isDragging: false,
        canvas: {
            width: 800,
            height: 600,
            getBoundingClientRect: () => ({
                left: 0,
                top: 0,
                width: 800,
                height: 600
            })
        }
    };
}

describe('MapEditorInput mouse wheel behavior', () => {
    let input;

    beforeEach(() => {
        MapEditorState.reset();
        input = createInputContext();
    });

    it('resizes a selected circular hitbox instead of zooming the canvas', () => {
        const circle = { shape: 'circle', x: 30, y: 40, r: 15 };
        MapEditorState.currentTool = 'objects';
        MapEditorState.selectedProps = [circle];
        const event = { deltaY: 1, preventDefault: vi.fn() };

        input.handleWheel(event);

        expect(circle.r).toBe(13);
        expect(MapEditorState.camera.zoom).toBe(1);
        expect(MapEditorState.isDirty).toBe(true);
        expect(event.preventDefault).toHaveBeenCalledOnce();
    });

    it('resizes a selected box hitbox while enforcing the minimum dimensions', () => {
        const box = { shape: 'box', x: 30, y: 40, w: 10, h: 12 };
        MapEditorState.currentTool = 'objects';
        MapEditorState.selectedProps = [box];
        const event = { deltaY: 1, preventDefault: vi.fn() };

        input.handleWheel(event);

        expect(box.w).toBe(10);
        expect(box.h).toBe(10);
        expect(MapEditorState.camera.zoom).toBe(1);
    });

    it('continues to zoom the canvas when no object hitbox is selected', () => {
        MapEditorState.currentTool = 'objects';
        const event = {
            deltaY: -1,
            clientX: 400,
            preventDefault: vi.fn()
        };

        input.handleWheel(event);

        expect(MapEditorState.camera.zoom).toBeCloseTo(1.1);
        expect(MapEditorState.camera.x).toBeCloseTo(-40);
        expect(event.preventDefault).toHaveBeenCalledOnce();
    });

    it('scales the reference image when reference mode is active', () => {
        MapEditorState.currentTool = 'reference';
        MapEditorState.refImage = { width: 100, height: 100 };
        MapEditorState.refScale = 1;
        const event = { deltaY: -1, preventDefault: vi.fn() };

        input.handleWheel(event);

        expect(MapEditorState.refScale).toBeCloseTo(1.1);
        expect(event.preventDefault).toHaveBeenCalledOnce();
    });
});
