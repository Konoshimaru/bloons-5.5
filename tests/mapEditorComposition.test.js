// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
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

    it('defers the JSON undo snapshot until the document passes validation', () => {
        const button = {
            addEventListener: vi.fn()
        };
        vi.stubGlobal('document', {
            querySelectorAll: () => [],
            getElementById: id => id === 'editor-apply-json' ? button : null
        });
        const pushUndo = vi.spyOn(MapEditor, 'pushUndo');
        const applyJSON = vi.spyOn(MapEditor, 'applyJSON').mockImplementation(() => {});

        MapEditor._setupDOMListeners();
        const clickHandler = button.addEventListener.mock.calls
            .find(([eventName]) => eventName === 'click')[1];
        clickHandler();

        expect(applyJSON).toHaveBeenCalledOnce();
        expect(pushUndo).not.toHaveBeenCalled();

        applyJSON.mockRestore();
        pushUndo.mockRestore();
        vi.unstubAllGlobals();
    });
});
