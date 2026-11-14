import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../js/ui.js', () => ({
    UI: { log: vi.fn() }
}));

import MapEditorHistory from '../js/mapEditorHistory.js';
import { MapEditorState } from '../js/mapEditorState.js';
import { UI } from '../js/ui.js';

function createHistoryContext() {
    return {
        ...MapEditorHistory,
        undoStack: [],
        redoStack: [],
        updatePathDropdown: vi.fn()
    };
}

describe('MapEditorHistory production behavior', () => {
    let editor;

    beforeEach(() => {
        MapEditorState.reset();
        editor = createHistoryContext();
        vi.clearAllMocks();
    });

    it('undo restores the prior map snapshot without sharing mutable references', () => {
        MapEditorState.mapData.paths.push({
            waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }]
        });
        editor.pushUndo();

        MapEditorState.mapData.paths[0].waypoints[0].x = 999;
        MapEditorState.mapData.props.push({ type: 'tree', x: 50, y: 60 });

        editor.undo();

        expect(MapEditorState.mapData.paths[0].waypoints[0].x).toBe(10);
        expect(MapEditorState.mapData.props).toEqual([]);
        expect(editor.redoStack).toHaveLength(1);
        expect(editor.updatePathDropdown).toHaveBeenCalledOnce();
        expect(UI.log).toHaveBeenCalledWith('Undo performed.');
    });

    it('redo restores the state removed by undo', () => {
        editor.pushUndo();
        MapEditorState.mapData.paths.push({
            waypoints: [{ x: 1, y: 1 }, { x: 2, y: 2 }]
        });
        editor.pushUndo();
        MapEditorState.mapData.props.push({ type: 'rock', x: 5, y: 6 });

        editor.undo();
        editor.redo();

        expect(MapEditorState.mapData.paths).toHaveLength(1);
        expect(MapEditorState.mapData.props).toEqual([{ type: 'rock', x: 5, y: 6 }]);
        expect(editor.updatePathDropdown).toHaveBeenCalledTimes(2);
        expect(UI.log).toHaveBeenLastCalledWith('Redo performed.');
    });

    it('a new edit after undo clears the redo history', () => {
        editor.pushUndo();
        MapEditorState.mapData.paths.push({ waypoints: [{ x: 0, y: 0 }, { x: 5, y: 5 }] });
        editor.pushUndo();
        MapEditorState.mapData.props.push({ type: 'tree', x: 10, y: 10 });

        editor.undo();
        expect(editor.redoStack).toHaveLength(1);

        editor.pushUndo();
        MapEditorState.mapData.props.push({ type: 'rock', x: 20, y: 20 });

        expect(editor.redoStack).toHaveLength(0);
    });

    it('keeps the undo history bounded to the 25 most recent snapshots', () => {
        for (let i = 0; i < 30; i++) {
            MapEditorState.mapData.name = `Snapshot ${i}`;
            editor.pushUndo();
        }

        expect(editor.undoStack).toHaveLength(25);
        expect(editor.undoStack[0].name).toBe('Snapshot 5');
        expect(editor.undoStack.at(-1).name).toBe('Snapshot 29');
    });

    it('logs cleanly when there is nothing to undo or redo', () => {
        editor.undo();
        editor.redo();

        expect(UI.log).toHaveBeenNthCalledWith(1, 'Nothing to undo.');
        expect(UI.log).toHaveBeenNthCalledWith(2, 'Nothing to redo.');
        expect(editor.updatePathDropdown).not.toHaveBeenCalled();
    });
});
