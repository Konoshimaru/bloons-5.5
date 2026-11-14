import { describe, expect, it } from 'vitest';
import { MapEditor } from '../js/mapEditor.js';

describe('MapEditor module composition', () => {
    it('attaches renderer, input, I/O and history methods without replacing core methods', () => {
        expect(MapEditor.init).toBeTypeOf('function');
        expect(MapEditor.draw).toBeTypeOf('function');
        expect(MapEditor._drawEditorOverlays).toBeTypeOf('function');
        expect(MapEditor.getMousePos).toBeTypeOf('function');
        expect(MapEditor.handleWheel).toBeTypeOf('function');
        expect(MapEditor.saveMap).toBeTypeOf('function');
        expect(MapEditor.loadMap).toBeTypeOf('function');
        expect(MapEditor.pushUndo).toBeTypeOf('function');
        expect(MapEditor.undo).toBeTypeOf('function');
        expect(MapEditor.redo).toBeTypeOf('function');
    });
});
