import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../js/config.js', () => ({
    Config: { data: { customMaps: [] }, save: vi.fn() }
}));
vi.mock('../js/data.js', () => ({ Maps: [] }));

import { Config } from '../js/config.js';
import { Maps } from '../js/data.js';
import MapEditorIO from '../js/mapEditorIO.js';
import { MapEditorState } from '../js/mapEditorState.js';

function createEditorContext() {
    return {
        ...MapEditorIO,
        pushUndo: vi.fn(),
        applyLoadedMapData: vi.fn()
    };
}

function makeValidMap() {
    return {
        name: 'Valid Map',
        id: 'valid-map',
        paths: [{
            waypoints: [{ x: 10, y: 20 }, { x: 50, y: 60 }],
            width: 45
        }]
    };
}

describe('Map Editor I/O validation', () => {
    let editor;
    let textArea;

    beforeEach(() => {
        MapEditorState.reset();
        Config.data.customMaps = [];
        Maps.length = 0;
        editor = createEditorContext();
        textArea = { value: '' };
        vi.stubGlobal('document', {
            getElementById: vi.fn(id => id === 'editor-json-text' ? textArea : null)
        });
        vi.stubGlobal('alert', vi.fn());
        vi.clearAllMocks();
    });

    it('applies valid JSON only after validation and records an undo snapshot', () => {
        const source = makeValidMap();
        textArea.value = JSON.stringify(source);

        editor.applyJSON();

        expect(MapEditorState.mapData).toMatchObject({
            id: 'valid-map',
            paths: source.paths,
            props: [],
            waterBrushes: []
        });
        expect(editor.pushUndo).toHaveBeenCalledOnce();
        expect(editor.applyLoadedMapData).toHaveBeenCalledOnce();
        expect(globalThis.alert).toHaveBeenCalledWith('JSON applied!');
    });

    it('rejects malformed JSON documents without replacing the current map', () => {
        const previousMap = MapEditorState.mapData;
        textArea.value = JSON.stringify({
            paths: [{ waypoints: [{ x: 10, y: Number.NaN }] }]
        });

        editor.applyJSON();

        expect(MapEditorState.mapData).toBe(previousMap);
        expect(editor.pushUndo).not.toHaveBeenCalled();
        expect(editor.applyLoadedMapData).not.toHaveBeenCalled();
        expect(globalThis.alert).toHaveBeenCalledWith(expect.stringContaining('Invalid JSON: Path 1'));
    });

    it('validates file imports before modifying editor state', () => {
        vi.stubGlobal('FileReader', class {
            readAsText(file) {
                this.onload({ target: { result: file.contents } });
            }
        });
        const target = {
            files: [{ contents: JSON.stringify(makeValidMap()) }],
            value: 'map.json'
        };

        editor.importJSON({ target });

        expect(target.value).toBe('');
        expect(MapEditorState.mapData).toMatchObject({ id: 'valid-map', props: [], waterBrushes: [] });
        expect(editor.pushUndo).toHaveBeenCalledOnce();
        expect(editor.applyLoadedMapData).toHaveBeenCalledOnce();
    });

    it('rejects invalid saved custom maps before loading them', () => {
        Config.data.customMaps = [{
            name: 'Broken',
            paths: [{ waypoints: [{ x: 0, y: 'not-a-number' }] }]
        }];
        vi.stubGlobal('prompt', vi.fn(() => 'Broken'));
        const previousMap = MapEditorState.mapData;

        editor.loadMap();

        expect(MapEditorState.mapData).toBe(previousMap);
        expect(editor.pushUndo).not.toHaveBeenCalled();
        expect(editor.applyLoadedMapData).not.toHaveBeenCalled();
        expect(globalThis.alert).toHaveBeenCalledWith(expect.stringContaining('Saved map is invalid'));
    });

    it('does not save malformed editor data', () => {
        MapEditorState.mapData.paths.push({
            waypoints: [{ x: 10, y: Number.POSITIVE_INFINITY }, { x: 20, y: 30 }]
        });
        vi.stubGlobal('document', {
            getElementById: vi.fn(id => id === 'editor-map-name' ? { value: 'Bad Map' } : null)
        });

        editor.saveMap();

        expect(Config.data.customMaps).toHaveLength(0);
        expect(Maps).toHaveLength(0);
        expect(Config.save).not.toHaveBeenCalled();
        expect(globalThis.alert).toHaveBeenCalledWith(expect.stringContaining('Cannot save map'));
    });
});
