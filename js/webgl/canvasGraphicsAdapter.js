// js/webgl/canvasGraphicsAdapter.js
//
// A tiny shim implementing the narrow slice of the Canvas2D path API that
// js/projectileDrawers.js actually uses (verified via grep: beginPath,
// moveTo, lineTo, arc, closePath, fill, stroke, fillRect, fillStyle,
// strokeStyle, lineWidth, lineCap, rotate — nothing else).
//
// Why this exists: rewriting ~30 hand-tuned vector shapes into Pixi's native
// Graphics calls by hand is exactly the kind of transcription work that
// silently drops a pixel here or an angle there. This adapter lets the
// *existing, tested* drawer functions run unmodified against a
// PIXI.Graphics instance instead, so visual output stays identical.
//
// Important semantic difference from real Canvas2D: ctx.rotate() in Canvas2D
// mutates the transform matrix, which is baked into the coordinates of every
// subsequent path command immediately. PIXI.Graphics has no equivalent
// "bake rotation into future path points" operation — its .rotation is a
// single whole-object transform. So this adapter tracks an internal
// rotation accumulator and manually rotates every point it's given before
// forwarding to the real Graphics call. This matters for drawers like
// spike_opult/juggernaut that call ctx.rotate() in a loop to place spikes
// around a circle — each spike's absolute position depends on accumulated
// rotation at the time it was drawn, which this reproduces correctly.

import { FillGradient } from 'pixi.js';

// Minimal CanvasGradient-alike so code written against
// ctx.createRadialGradient(...).addColorStop(...) can run unmodified. Wraps
// a real PIXI.FillGradient. NOTE: built from Pixi v8's documented API
// (textureSpace: 'global' uses the same absolute coordinate space as the
// Graphics' own draw calls, matching how ctx.createRadialGradient's x/y/r
// arguments work) but not verified against an actual browser render in this
// environment — flagged the same way as everything else here that couldn't
// be visually confirmed.
class RadialCanvasGradient {
    constructor(x0, y0, r0, x1, y1, r1) {
        this._stops = [];
        this._x0 = x0; this._y0 = y0; this._r0 = r0;
        this._x1 = x1; this._y1 = y1; this._r1 = r1;
    }
    addColorStop(offset, color) {
        this._stops.push({ offset, color });
    }
    toFillGradient() {
        return new FillGradient({
            type: 'radial',
            center: { x: this._x0, y: this._y0 },
            innerRadius: this._r0,
            outerCenter: { x: this._x1, y: this._y1 },
            outerRadius: this._r1,
            colorStops: this._stops,
            textureSpace: 'global'
        });
    }
}

export class CanvasGraphicsAdapter {
    constructor(graphics) {
        this.g = graphics;
        this.fillStyle = '#000000';
        this.strokeStyle = '#000000';
        this.lineWidth = 1;
        this.lineCap = 'butt';
        this.globalAlpha = 1;
        this._rot = 0;
        this._cos = 1;
        this._sin = 0;
    }

    _tf(x, y) {
        return [x * this._cos - y * this._sin, x * this._sin + y * this._cos];
    }

    rotate(angle) {
        this._rot += angle;
        this._cos = Math.cos(this._rot);
        this._sin = Math.sin(this._rot);
    }

    beginPath() {
        // No-op: Pixi's GraphicsContext implicitly starts a new subpath on
        // the next moveTo(), which is the only thing beginPath() precedes
        // in every drawer in projectileDrawers.js.
    }

    moveTo(x, y) {
        const [tx, ty] = this._tf(x, y);
        this.g.moveTo(tx, ty);
    }

    lineTo(x, y) {
        const [tx, ty] = this._tf(x, y);
        this.g.lineTo(tx, ty);
    }

    arc(x, y, radius, startAngle, endAngle, counterclockwise = false) {
        const [tx, ty] = this._tf(x, y);
        // Radius is unaffected by rotation (uniform scale); angles shift by
        // the accumulated rotation same as the transformed center did.
        this.g.arc(tx, ty, radius, startAngle + this._rot, endAngle + this._rot, counterclockwise);
    }

    closePath() {
        this.g.closePath();
    }

    createRadialGradient(x0, y0, r0, x1, y1, r1) {
        return new RadialCanvasGradient(x0, y0, r0, x1, y1, r1);
    }

    fill() {
        if (this.fillStyle instanceof RadialCanvasGradient) {
            // Best-effort: Pixi's general FillStyle object supports
            // { fill, alpha } alongside { color, alpha } — not verified
            // in-browser here, so this falls back to a solid mid-stop
            // color at globalAlpha if anything throws, rather than crash.
            try {
                this.g.fill({ fill: this.fillStyle.toFillGradient(), alpha: this.globalAlpha });
                return;
            } catch (e) {
                const mid = this.fillStyle._stops[0]?.color || this.fillStyle._stops[this.fillStyle._stops.length - 1]?.color || '#ffffff';
                this.g.fill({ color: mid, alpha: this.globalAlpha });
                return;
            }
        }
        this.g.fill({ color: this.fillStyle, alpha: this.globalAlpha });
    }

    stroke() {
        this.g.stroke({ width: this.lineWidth, color: this.strokeStyle, cap: this.lineCap, alpha: this.globalAlpha });
    }

    fillRect(x, y, w, h) {
        const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) => this._tf(px, py));
        this.g.moveTo(corners[0][0], corners[0][1])
              .lineTo(corners[1][0], corners[1][1])
              .lineTo(corners[2][0], corners[2][1])
              .lineTo(corners[3][0], corners[3][1])
              .closePath()
              .fill({ color: this.fillStyle, alpha: this.globalAlpha });
    }

    // Reset for reuse across frames on a pooled Graphics/projectile.
    reset() {
        this._rot = 0;
        this._cos = 1;
        this._sin = 0;
        this.globalAlpha = 1;
    }
}
