import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CANVAS_HEIGHT, CANVAS_WIDTH, GAME_AREA_WIDTH } from '../js/constants.js';
import { MapEditorState } from '../js/mapEditorState.js';
import MapEditorRenderer from '../js/mapEditorRenderer.js';

function createContext() {
    const methods = [
        'clearRect', 'save', 'restore', 'translate', 'scale', 'fillRect',
        'drawImage', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'arc',
        'fill', 'closePath', 'strokeRect', 'quadraticCurveTo'
    ];
    return Object.fromEntries(methods.map(name => [name, vi.fn()]));
}

describe('MapEditorRenderer production drawing behavior', () => {
    beforeEach(() => {
        MapEditorState.reset();
        MapEditorState.bgImage = null;
        MapEditorState.bgNightImage = null;
        MapEditorState.refImage = null;
        MapEditorState.currentWaterStroke = null;
        MapEditorState.previewNight = false;
        MapEditorState.selectedPoints = [];
        MapEditorState.selectedProps = [];
    });

    it('does not draw before the editor has a map document', () => {
        MapEditorState.mapData = null;
        const ctx = createContext();

        MapEditorRenderer.draw.call({ ...MapEditorRenderer, ctx });

        expect(ctx.clearRect).not.toHaveBeenCalled();
        expect(ctx.save).not.toHaveBeenCalled();
    });

    it('draws the fallback background, play-area boundary and grid', () => {
        const ctx = createContext();

        MapEditorRenderer.draw.call({ ...MapEditorRenderer, ctx });

        expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        expect(ctx.fillRect).toHaveBeenCalledWith(
            GAME_AREA_WIDTH, 0, CANVAS_WIDTH - GAME_AREA_WIDTH, CANVAS_HEIGHT
        );
        expect(ctx.stroke).toHaveBeenCalled();
        expect(ctx.save).toHaveBeenCalledOnce();
        expect(ctx.restore).toHaveBeenCalledOnce();
    });

    it('draws the selected background with aspect ratio and the reference overlay', () => {
        const ctx = createContext();
        const background = { width: 200, height: 100 };
        const reference = { width: 10, height: 20 };
        MapEditorState.mapData.image = 'custom-day';
        MapEditorState.mapData.imageMaintainRatio = true;
        MapEditorState.bgImage = background;
        MapEditorState.refImage = reference;
        MapEditorState.refX = 30;
        MapEditorState.refY = 50;
        MapEditorState.refScale = 2;

        MapEditorRenderer.draw.call({ ...MapEditorRenderer, ctx });

        expect(ctx.drawImage).toHaveBeenCalledTimes(2);
        const backgroundCall = ctx.drawImage.mock.calls[0];
        expect(backgroundCall[0]).toBe(background);
        expect(backgroundCall[4]).toBeCloseTo(backgroundCall[3] / 2);
        expect(ctx.drawImage.mock.calls[1]).toEqual([reference, 20, 30, 20, 40]);
    });

    it('respects hidden water and object layers', () => {
        const ctx = createContext();
        MapEditorState.mapData.waterVisible = false;
        MapEditorState.mapData.propsVisible = false;
        MapEditorState.mapData.waterBrushes = [{
            thickness: 20,
            points: [{ x: 10, y: 10 }]
        }];
        MapEditorState.mapData.props = [{
            type: 'hitbox',
            shape: 'circle',
            x: 20,
            y: 20,
            r: 10
        }];

        MapEditorRenderer.draw.call({ ...MapEditorRenderer, ctx });

        expect(ctx.arc).not.toHaveBeenCalled();
        expect(ctx.drawImage).not.toHaveBeenCalled();
    });
});
