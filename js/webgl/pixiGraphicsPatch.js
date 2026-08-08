// js/webgl/pixiGraphicsPatch.js
//
// Works around a Pixi v8 bug in GraphicsPath#getLastPoint. That method only
// knows about point-based commands (moveTo/lineTo/quadraticCurveTo/
// bezierCurveTo) and has broken/absent handling for shape primitives:
//   - "arc"/"arcToSvg" read data[5]/data[6], which are NOT the endpoint
//     (arc data is [x, y, radius, startAngle, endAngle, counterclockwise]),
//     so they return garbage.
//   - "circle", "ellipse", "rect", "roundRect", "poly", "arcTo", etc. have
//     NO case at all, so the (reused) out point is left as whatever it held
//     before — typically (0,0).
//
// GraphicsContext#_initNextPathLocation calls getLastPoint after every
// fill()/stroke() and seeds the next path with moveTo(that point). So every
// point-based path (arc / lineTo / poly / ...) drawn AFTER a circle or rect
// in the same Graphics inherits a phantom current point of (0,0) — the top
// left corner of the screen — and draws a connecting line from there. This
// is what made the main-menu monkey's mouth extend to the corner of the
// screen, and it can pollute any other stroked path that follows a shape.
//
// Imported for its side effect by pixiApp.js (before any Graphics work).

import { GraphicsPath, GraphicsContext } from 'pixi.js';

const originalGetLastPoint = GraphicsPath.prototype.getLastPoint;

// Also neutralize GraphicsContext#_initNextPathLocation's seed. Pixi uses
// it after every fill()/stroke() to carry the path's last point into the
// NEXT path as a moveTo, so point-based commands following a shape in the
// same Graphics always draw a connecting line from the previous shape. That
// matches nothing in Canvas2D (where beginPath() resets the path between
// shapes) and produced the phantom corner-lines above. Our renderers never
// rely on path continuation across a fill/stroke boundary (every path group
// starts with its own moveTo or is a standalone shape/arc), so a plain
// clear() is safe and gives exact canvas semantics: each fill()/stroke()
// group is fully independent.
GraphicsContext.prototype._initNextPathLocation = function () {
    this._activePath.clear();
};

GraphicsPath.prototype.getLastPoint = function (out) {
    let index = this.instructions.length - 1;
    let lastInstruction = this.instructions[index];
    if (!lastInstruction) { out.x = 0; out.y = 0; return out; }
    while (lastInstruction.action === 'closePath') {
        index--;
        if (index < 0) { out.x = 0; out.y = 0; return out; }
        lastInstruction = this.instructions[index];
    }
    const d = lastInstruction.data;
    switch (lastInstruction.action) {
        case 'moveTo':
        case 'lineTo':
            out.x = d[0]; out.y = d[1];
            break;
        case 'quadraticCurveTo':
            out.x = d[2]; out.y = d[3];
            break;
        case 'bezierCurveTo':
            out.x = d[4]; out.y = d[5];
            break;
        case 'arc':
            out.x = d[0] + Math.cos(d[4]) * d[2];
            out.y = d[1] + Math.sin(d[4]) * d[2];
            break;
        case 'arcTo':
            out.x = d[2]; out.y = d[3];
            break;
        case 'arcToSvg':
            out.x = d[5]; out.y = d[6];
            break;
        case 'circle':
            out.x = d[0] + d[2]; out.y = d[1];
            break;
        case 'ellipse':
            out.x = d[0] + d[2]; out.y = d[1];
            break;
        case 'rect':
        case 'roundRect':
        case 'filletRect':
        case 'chamferRect':
            out.x = d[0] + d[2]; out.y = d[1] + d[3];
            break;
        case 'poly':
        case 'roundShape': {
            const pts = d[0];
            if (pts && pts.length >= 2) { out.x = pts[pts.length - 2]; out.y = pts[pts.length - 1]; }
            else { out.x = 0; out.y = 0; }
            break;
        }
        case 'regularPoly':
        case 'roundPoly': {
            const sides = Math.max(d[3] | 0, 3);
            const startAngle = -Math.PI / 2 + (d[4] || 0);
            const delta = (Math.PI * 2) / sides;
            const ang = startAngle - (sides - 1) * delta;
            out.x = d[0] + d[2] * Math.cos(ang);
            out.y = d[1] + d[2] * Math.sin(ang);
            break;
        }
        case 'addPath':
            d[0].getLastPoint(out);
            break;
        default:
            return originalGetLastPoint.call(this, out);
    }
    return out;
};
