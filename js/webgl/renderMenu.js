// js/webgl/renderMenu.js
//
// Port of renderer.js's _drawMainMenuScenery — the decorative background
// (time-of-day sky, stars, sun/moon, clouds, hills, a bouncing bloon,
// trees, falling darts) shown behind the main menu. Pure vector drawing in
// the original (no sprites, no blend modes), so this is a straight
// Graphics port with no adapter/filter tricks needed, unlike most of the
// rest of this migration.
//
// This was flagged in MIGRATION.md's gap list as "main-menu scenery,
// low priority" — which undersold it. It's not just missing decoration:
// pixiRenderer.js had NO branch at all for `engine.gameState === 'menu'`,
// so the entire normal gameplay pipeline (which assumes `engine.map`
// exists) ran unconditionally every frame, menu included. Individual
// draw calls mostly no-op safely against a null map (guarded by
// `_safeDraw`), so nothing crashed — but nothing resembling the actual
// menu rendered either. See pixiRenderer.js for the added early-return
// branch that fixes that; this file is only the scenery itself.

import { Graphics, FillGradient } from 'pixi.js';
import { PixiApp } from './pixiApp.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants.js';

export const MenuRenderer = {
    // The sky gradient only changes between the four day phases, but the
    // original code allocated a new FillGradient every frame — and each new
    // instance uploads a fresh 256x256 texture to the GPU (see
    // FillGradient.styleKey, which is uid-based and never deduped). Cache one
    // gradient per phase instead; the menu stays fully static otherwise.
    _skyGradients: {},

    _drawMainMenuScenery(engine, rawDt) {
        if (!this._menuGfx) {
            this._menuGfx = new Graphics();
            PixiApp.menuLayer.addChild(this._menuGfx);
        }
        const g = this._menuGfx;
        g.clear();

        const dtSafe = rawDt || 0.016;
        const t = performance.now() / 1000;

        const date = new Date();
        const hours = date.getHours() + date.getMinutes() / 60;
        let phase = 'day';
        if (hours >= 5 && hours < 8) phase = 'dawn';
        else if (hours >= 8 && hours < 17) phase = 'day';
        else if (hours >= 17 && hours < 20) phase = 'dusk';
        else phase = 'night';

        // Sky gradient
        let skyStops;
        if (phase === 'dawn') skyStops = [{ offset: 0, color: '#ff7e5f' }, { offset: 1, color: '#feb47b' }];
        else if (phase === 'day') skyStops = [{ offset: 0, color: '#4facfe' }, { offset: 1, color: '#00f2fe' }];
        else if (phase === 'dusk') skyStops = [{ offset: 0, color: '#355C7D' }, { offset: 0.5, color: '#6C5B7B' }, { offset: 1, color: '#C06C84' }];
        else skyStops = [{ offset: 0, color: '#0F2027' }, { offset: 1, color: '#203A43' }];
        let skyGrad = this._skyGradients[phase];
        if (!skyGrad) {
            skyGrad = new FillGradient({
                type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: CANVAS_HEIGHT }, colorStops: skyStops,
                // 'global' means these coordinates are literal world-space
                // pixels (unlike 'local', which normalizes to the filled
                // shape's own 0-1 bounding box and would need start/end
                // re-derived as fractions instead of the 0/720 pixel values
                // above) — sidesteps having to hand-verify the local-space
                // transform math for a case (linear, non-square shape) this
                // codebase hadn't exercised yet. Every radial gradient
                // elsewhere in this migration uses 'local' successfully
                // because center==outerCenter makes it self-normalizing
                // regardless of the absolute radius chosen; that shortcut
                // doesn't apply here since start != end.
                textureSpace: 'global',
            });
            this._skyGradients[phase] = skyGrad;
        }
        g.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).fill({ fill: skyGrad });

        // Stars
        if (phase === 'night' || phase === 'dusk') {
            for (let i = 0; i < 60; i++) {
                const sx = (i * 137) % 1280, sy = (i * 97) % 400;
                const twinkle = Math.sin(t * 2 + i) * 0.5 + 0.5;
                g.rect(sx, sy, 2, 2).fill({ color: '#ffffff', alpha: twinkle * (phase === 'night' ? 1 : 0.4) });
            }
        }

        // Sun/moon
        let progress;
        if (hours > 6 && hours <= 18) progress = (hours - 6) / 12;
        else { const nightHours = hours <= 6 ? hours + 6 : hours - 18; progress = nightHours / 12; }
        const smX = progress * 1280, smY = 150 - Math.sin(progress * Math.PI) * 50;
        if (phase === 'day' || phase === 'dawn') {
            g.circle(smX, smY, 75).fill({ color: 'rgba(255, 215, 0, 0.3)' });
            g.circle(smX, smY, 45).fill({ color: '#FFD700' });
        }
        if (phase === 'night' || phase === 'dusk') {
            g.circle(smX, smY, 35).fill({ color: '#F4F6F0' });
            g.circle(smX + 10, smY - 5, 8).fill({ color: '#e0e0e0' });
        }

        // Clouds
        const cloudColor = phase === 'night' ? 'rgba(100, 100, 120, 0.4)' : 'rgba(255, 255, 255, 0.6)';
        for (let i = 0; i < 4; i++) {
            const cx = ((t * 15 + i * 350) % 1400) - 100, cy = 100 + i * 50;
            g.circle(cx, cy, 40).circle(cx + 40, cy + 10, 30).circle(cx - 30, cy + 10, 25).fill({ color: cloudColor });
        }

        // Hills
        let hillColor1 = '#2ecc71', hillColor2 = '#27ae60';
        if (phase === 'dusk') { hillColor1 = '#2c3e50'; hillColor2 = '#22313f'; }
        if (phase === 'night') { hillColor1 = '#1a252f'; hillColor2 = '#16202a'; }
        g.moveTo(0, 600).quadraticCurveTo(640, 400, 1280, 600).lineTo(1280, 720).lineTo(0, 720).closePath().fill({ color: hillColor1 });
        g.moveTo(0, 650).quadraticCurveTo(640, 500, 1280, 650).lineTo(1280, 720).lineTo(0, 720).closePath().fill({ color: hillColor2 });

        // Bouncing bloon mascot
        const bounce = Math.sin(t * 2) * 5;
        const bx = 640, by = 520 + bounce;
        g.moveTo(bx + 40, by + 10).quadraticCurveTo(bx + 90, by - 20, bx + 70, by - 60)
            .stroke({ width: 8, color: '#795548', cap: 'round' });
        g.ellipse(bx, by + 10, 40, 45).fill({ color: '#795548' });
        g.ellipse(bx, by + 20, 25, 30).fill({ color: '#D2B48C' });
        g.circle(bx, by - 20, 35).fill({ color: '#795548' });
        g.circle(bx - 30, by - 20, 12).circle(bx + 30, by - 20, 12).fill({ color: '#795548' });
        g.circle(bx - 30, by - 20, 6).circle(bx + 30, by - 20, 6).fill({ color: '#D2B48C' });
        g.ellipse(bx, by - 15, 22, 20).fill({ color: '#D2B48C' });
        g.circle(bx - 10, by - 25, 8).circle(bx + 10, by - 25, 8).fill({ color: '#ffffff' });
        const eyeOffset = Math.sin(t * 0.5) * 2;
        g.circle(bx - 10 + eyeOffset, by - 25, 4).circle(bx + 10 + eyeOffset, by - 25, 4).fill({ color: '#000000' });
        g.arc(bx, by - 10, 10, 0.2, Math.PI - 0.2).stroke({ width: 2, color: '#000000' });

        // Trees
        g.rect(150, 550, 20, 100).fill({ color: '#8B4513' });
        g.circle(160, 540, 50).fill({ color: phase === 'night' ? '#1a5c1a' : '#228B22' });
        g.rect(1100, 580, 20, 80).fill({ color: '#8B4513' });
        g.circle(1110, 570, 40).fill({ color: phase === 'night' ? '#1a5c1a' : '#228B22' });

        // Falling darts (menuClickables) — this state lives on `engine`
        // itself, not this renderer, matching the original (which mutates
        // it inside its own draw call too); kept identical so nothing else
        // that might read `engine.menuClickables` breaks.
        if (!engine.menuClickables) engine.menuClickables = [];
        if (Math.random() < 0.01 && engine.menuClickables.length < 5) {
            engine.menuClickables.push({ x: Math.random() * 1080 + 100, y: -50, vx: (Math.random() - 0.5) * 20, vy: 50 + Math.random() * 30, r: 15, rot: 0, vrot: (Math.random() - 0.5) * 5 });
        }
        for (let i = engine.menuClickables.length - 1; i >= 0; i--) {
            const item = engine.menuClickables[i];
            item.x += item.vx * dtSafe; item.y += item.vy * dtSafe; item.rot += item.vrot * dtSafe;
            if (item.y > 720) { engine.menuClickables.splice(i, 1); continue; }
            // ctx.rotate(item.rot) then draw an ellipse tilted PI/4 within
            // that rotated frame == a single ellipse tilted (item.rot + PI/4)
            // in world space; Graphics.ellipse() has no rotation parameter
            // of its own, so the combined angle is baked into the point math.
            const rx = item.r, ry = item.r * 0.6, ang = item.rot + Math.PI / 4;
            const pts = [];
            const N = 16;
            for (let k = 0; k <= N; k++) {
                const a = (k / N) * Math.PI * 2;
                const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
                const c = Math.cos(ang), s = Math.sin(ang);
                pts.push(item.x + ex * c - ey * s, item.y + ex * s + ey * c);
            }
            g.poly(pts).fill({ color: '#FFDC00' }).stroke({ width: 2, color: '#E6B800' });
        }
    },
};
