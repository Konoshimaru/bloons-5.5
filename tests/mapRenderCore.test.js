import { describe, expect, it, vi } from 'vitest';
import { MapRenderCore } from '../js/mapRenderCore.js';

function createContext() {
    const methods = [
        'beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'stroke',
        'arc', 'save', 'restore', 'translate', 'fillRect', 'strokeRect', 'fill'
    ];
    return Object.fromEntries(methods.map(name => [name, vi.fn()]));
}

describe('MapRenderCore production drawing helpers', () => {
    it('draws visible path segments and skips hidden paths by default', () => {
        const ctx = createContext();
        const paths = [
            { waypoints: [{ x: 0, y: 0 }, { x: 50, y: 0 }] },
            { visible: false, waypoints: [{ x: 0, y: 10 }, { x: 50, y: 10 }] },
            { waypoints: [{ x: 1, y: 1 }] }
        ];

        MapRenderCore.drawPaths(ctx, paths);

        expect(ctx.stroke).toHaveBeenCalledTimes(2);
        expect(ctx.lineTo).toHaveBeenCalledTimes(2);
        expect(ctx.lineWidth).toBeUndefined();
    });

    it('can draw hidden paths when the caller explicitly ignores visibility', () => {
        const ctx = createContext();
        const paths = [{
            visible: false,
            width: 30,
            waypoints: [
                { x: 0, y: 0 },
                { x: 50, y: 20, curve: { cx: 25, cy: 10 } }
            ]
        }];

        MapRenderCore.drawPaths(ctx, paths, true);

        expect(ctx.stroke).toHaveBeenCalledTimes(2);
        expect(ctx.quadraticCurveTo).toHaveBeenCalledTimes(2);
    });

    it('draws a one-point water brush as a round dab', () => {
        const ctx = createContext();

        MapRenderCore.drawWater(ctx, [{
            thickness: 20,
            color: '#123456',
            points: [{ x: 12, y: 34 }]
        }]);

        expect(ctx.arc).toHaveBeenCalledWith(12, 34, 10, 0, Math.PI * 2);
        expect(ctx.stroke).toHaveBeenCalledOnce();
    });

    it('renders circular and boxed object hitboxes', () => {
        const ctx = createContext();

        MapRenderCore.drawProps(ctx, [
            { shape: 'circle', x: 10, y: 20, r: 12 },
            { shape: 'box', x: 30, y: 40, w: 20, h: 30 }
        ]);

        expect(ctx.save).toHaveBeenCalledTimes(2);
        expect(ctx.translate).toHaveBeenNthCalledWith(1, 10, 20);
        expect(ctx.arc).toHaveBeenCalledWith(0, 0, 12, 0, Math.PI * 2);
        expect(ctx.fillRect).toHaveBeenCalledWith(-10, -15, 20, 30);
        expect(ctx.strokeRect).toHaveBeenCalledWith(-10, -15, 20, 30);
        expect(ctx.restore).toHaveBeenCalledTimes(2);
    });
});
