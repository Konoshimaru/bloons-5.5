// js/webgl/renderHeroVFX.js
//
// Native Pixi ports of hero ability VFX that CanvasGraphicsAdapter can't
// handle: `ctx.globalCompositeOperation = 'screen'` blending and nested
// `ctx.rotate()`/`ctx.scale()` transforms on gradient-filled blobs. See
// MIGRATION.md — Gojo/Geto/Sauda were reverted from the adapter hack for
// exactly this reason (renderTowers.js still renders their base sprite
// generically; this file adds back the ability VFX on top).
//
// Since PIXI.Graphics has no "bake a rotate+scale into future path points"
// operation (same limitation the adapter itself works around), each blob's
// polygon points are rotated+scaled by hand before being handed to Pixi —
// for a uniform scale factor s and rotation angle a, transforming a point
// and then scaling it is the same as scaling then rotating, so a single
// rotScale() helper covers both canvas.rotate()+canvas.scale() calls at
// once. Gradient outerRadius is scaled by the same factor for the same
// reason (a radial gradient's shape is scaled by the transform in effect
// when it's painted, same as any other fill).
//
// Not verified in an actual browser (no browser available in this
// environment) — flagged the same way as canvasGraphicsAdapter.js.

import { Container, Graphics, Sprite, FillGradient, Texture } from 'pixi.js';
import { PixiApp } from './pixiApp.js';
import { PixiAssets } from './pixiAssets.js';
import { GLOBAL_SCALE } from '../constants.js';
import { getSpriteScale } from '../mobile.js';

function rotScale(px, py, ang, s) {
    const c = Math.cos(ang), sn = Math.sin(ang);
    return [(px * c - py * sn) * s, (px * sn + py * c) * s];
}

function radialGrad(outerR, stops) {
    return new FillGradient({
        type: 'radial', center: { x: 0, y: 0 }, innerRadius: 0,
        outerCenter: { x: 0, y: 0 }, outerRadius: Math.max(1, outerR),
        // 'global' (not 'local'): Pixi v8's local-space radial gradients
        // render as a flat solid disc (per-pixel alpha is lost); global maps
        // the texture's fade onto the exact circle radius.
        colorStops: stops, textureSpace: 'global',
    });
}

// A rotated/scaled "wobbly blob" outline: same point-generation loop as the
// canvas version's `for (i=0; i<=points; i++) { ang = ...; rad = ...; }`.
function blobPoints(baseR, ampFn, rotAngle, scale) {
    const pts = [];
    const N = 16;
    for (let i = 0; i <= N; i++) {
        const ang = (i / N) * Math.PI * 2;
        const rad = ampFn(ang);
        const [x, y] = rotScale(Math.cos(ang) * rad, Math.sin(ang) * rad, rotAngle, scale);
        pts.push(x, y);
    }
    return pts;
}

export const HeroVFXRenderer = {
    _heroVFXEntries: new Map(),
    _saudaVFXEntries: new Map(),
    _getoVFXEntries: new Map(),

    _drawHeroVFX(engine) {
        const layer = PixiApp.layer('towerUnderEffects');
        const overlayLayer = PixiApp.layer('overlay');
        const gojoSeen = new Set();
        const saudaSeen = new Set();
        const getoSeen = new Set();

        for (const tower of engine.towers) {
            if (!tower) continue;

            if (tower.type === 'gojo') {
                gojoSeen.add(tower);
                this._drawGojoEntry(tower, layer);
            } else if (tower.type === 'sauda') {
                saudaSeen.add(tower);
                this._drawSaudaEntry(tower, layer);
            } else if (tower.type === 'geto') {
                getoSeen.add(tower);
                this._drawGetoEntry(tower, layer, overlayLayer);
            }
        }

        for (const [tower, entry] of this._heroVFXEntries) {
            if (!gojoSeen.has(tower)) { entry.container.destroy({ children: true }); this._heroVFXEntries.delete(tower); }
        }
        for (const [tower, entry] of this._saudaVFXEntries) {
            if (!saudaSeen.has(tower)) { entry.container.destroy({ children: true }); this._saudaVFXEntries.delete(tower); }
        }
        for (const [tower, entry] of this._getoVFXEntries) {
            if (!getoSeen.has(tower)) { entry.container.destroy({ children: true }); entry.ceField.destroy(); this._getoVFXEntries.delete(tower); }
        }
    },

    _drawGojoEntry(tower, layer) {
            let entry = this._heroVFXEntries.get(tower);
            if (!entry) {
                const container = new Container();
                const blueScreen = new Graphics(); blueScreen.blendMode = 'screen';
                const blueCore = new Graphics();
                const redScreen = new Graphics(); redScreen.blendMode = 'screen';
                const redCore = new Graphics();
                const purpleScreen = new Graphics(); purpleScreen.blendMode = 'screen';
                const purpleCore = new Graphics();
                const aura = new Graphics();
                container.addChild(blueScreen, blueCore, redScreen, redCore, purpleScreen, purpleCore, aura);
                layer.addChild(container);
                entry = { container, blueScreen, blueCore, redScreen, redCore, purpleScreen, purpleCore, aura, wellGfx: [] };
                this._heroVFXEntries.set(tower, entry);
            }

            entry.blueScreen.clear(); entry.blueCore.clear();
            entry.redScreen.clear(); entry.redCore.clear();
            entry.purpleScreen.clear(); entry.purpleCore.clear();
            entry.aura.clear();

            if (tower.reverseWell) this._drawMaxBlueVFX(entry, tower.reverseWell.x, tower.reverseWell.y, 150);
            else if (tower.maxBlue) this._drawMaxBlueVFX(entry, tower.maxBlue.x, tower.maxBlue.y, 100);

            if (tower.fakeRed) this._drawRedTyphoonVFX(entry, tower.x, tower.y - 20, tower.fakeRed.rot, 50);
            else if (tower.reversalRed) this._drawRedTyphoonVFX(entry, tower.reversalRed.x, tower.reversalRed.y, tower.reversalRed.rot, 80);

            if (tower.isHollowCharging) {
                const dist = 40;
                const vx = tower.x + Math.cos(tower.angle) * dist;
                const vy = tower.y + Math.sin(tower.angle) * dist;
                const progress = Math.min(1, tower.hollowChargeTime / 1.0);
                this._drawHollowPurpleVFX(entry, vx, vy, progress);
            } else if (tower.hollowProjectile) {
                this._drawHollowPurpleVFX(entry, tower.hollowProjectile.x, tower.hollowProjectile.y, 1.0);
            }

            if (tower.stats.limitlessPassive) this._drawLimitlessAura(entry, tower);

            this._drawBlueWells(entry, tower);
    },

    _drawSaudaEntry(tower, layer) {
        let entry = this._saudaVFXEntries.get(tower);
        if (!entry) {
            const container = new Container();
            const aftersword = new Graphics();
            const shadowLayer = new Container();
            const slashLayer = new Container();
            container.addChild(aftersword, shadowLayer, slashLayer);
            layer.addChild(container);
            entry = { container, aftersword, shadowLayer, slashLayer, shadowSprites: [], slashSprites: [] };
            this._saudaVFXEntries.set(tower, entry);
        }

        entry.aftersword.clear();
        if (tower.aftersword) {
            const { x, y } = tower.aftersword;
            const alpha = Math.min(1, tower.aftersword.life / 2) * 0.7;
            const r = 15 * getSpriteScale();
            entry.aftersword.position.set(x, y);
            entry.aftersword.circle(0, 0, r).fill({ fill: radialGrad(r, [
                { offset: 0, color: '#e74c3c' },
                { offset: 1, color: 'rgba(231, 76, 60, 0)' },
            ]), alpha });
        }

        const shadows = (tower.chargeShadows || []).filter(s => !s.done);
        while (entry.shadowSprites.length < shadows.length) {
            const s = new Sprite(); s.anchor.set(0.5); entry.shadowLayer.addChild(s); entry.shadowSprites.push(s);
        }
        while (entry.shadowSprites.length > shadows.length) { entry.shadowSprites.pop().destroy(); }
        const baseTexture = PixiAssets.get('tower_sauda_base');
        const shadowSize = 45 * (tower.stats?.scale || 1.0) * GLOBAL_SCALE * getSpriteScale();
        for (let i = 0; i < shadows.length; i++) {
            const shadow = shadows[i];
            const sprite = entry.shadowSprites[i];
            sprite.alpha = 0.8;
            sprite.position.set(shadow.x, shadow.y);
            sprite.rotation = shadow.angle + Math.PI / 2;
            if (baseTexture !== Texture.EMPTY) {
                if (sprite.texture !== baseTexture) sprite.texture = baseTexture;
                const maxDim = Math.max(baseTexture.width, baseTexture.height) || 1;
                const scale = shadowSize / maxDim;
                sprite.width = baseTexture.width * scale;
                sprite.height = baseTexture.height * scale;
                sprite.visible = true;
            } else {
                sprite.visible = false; // fallback circles omitted; base texture always exists in practice
            }
        }

        const slashes = tower.slashes || [];
        while (entry.slashSprites.length < slashes.length) {
            const s = new Sprite(); s.anchor.set(0.5); entry.slashLayer.addChild(s); entry.slashSprites.push(s);
        }
        while (entry.slashSprites.length > slashes.length) { entry.slashSprites.pop().destroy(); }
        const slashTexture = PixiAssets.get('proj_slash');
        for (let i = 0; i < slashes.length; i++) {
            const s = slashes[i];
            const sprite = entry.slashSprites[i];
            sprite.position.set(s.x, s.y);
            sprite.rotation = s.angle; // SlashConfig.drawAngleOffset is 0
            sprite.alpha = s.life / s.maxLife;
            if (slashTexture !== Texture.EMPTY) {
                if (sprite.texture !== slashTexture) sprite.texture = slashTexture;
                sprite.width = slashTexture.width * 0.35 * getSpriteScale(); // SlashConfig.sizeScale
                sprite.height = slashTexture.height * 0.35 * getSpriteScale();
                sprite.visible = true;
            } else {
                sprite.visible = false;
            }
        }
    },

    _drawGetoEntry(tower, layer, overlayLayer) {
        let entry = this._getoVFXEntries.get(tower);
        if (!entry) {
            const container = new Container();
            const spiritLayer = new Container();
            const blast = new Graphics(); blast.blendMode = 'screen';
            const hands = new Graphics();
            const capture = new Graphics(); capture.blendMode = 'screen';
            const captureBuff = new Graphics();
            const squidLayer = new Container();
            container.addChild(spiritLayer, blast, hands, capture, captureBuff, squidLayer);
            layer.addChild(container);
            const ceField = new Graphics(); ceField.blendMode = 'screen';
            overlayLayer.addChild(ceField);
            entry = { container, spiritLayer, blast, hands, capture, captureBuff, squidLayer, ceField, spiritSlots: [], squidSlots: [] };
            this._getoVFXEntries.set(tower, entry);
        }

        entry.blast.clear(); entry.hands.clear(); entry.capture.clear(); entry.captureBuff.clear(); entry.ceField.clear();

        const u = tower.uzumaki;
        this._reconcileSpiritSlots(entry, u && u.phase === 'condensing' ? u.spirits : [], tower.x, tower.y);
        if (u) {
            if (u.phase === 'firing') {
                const grad = radialGrad(22, [
                    { offset: 0, color: 'rgba(255,255,255,0.9)' },
                    { offset: 0.5, color: u.isUpgraded ? 'rgba(255,0,100,0.6)' : 'rgba(128,0,255,0.6)' },
                    { offset: 1, color: 'rgba(0,0,0,0)' },
                ]);
                entry.blast.position.set(tower.x, tower.y);
                entry.blast.circle(0, 0, 22).fill({ fill: grad });
                this._drawStretchedHands(entry.hands, u.hands);
            }
        }

        entry.ceField.position.set(0, 0);
        if (tower.ceField) {
            const t = performance.now() / 1000;
            const alpha = (tower.ceField.life / tower.ceField.maxLife) * 0.25;
            entry.ceField.rect(0, 0, 1000, 700).fill({ color: 'rgb(150, 0, 255)', alpha });
            for (let i = 0; i < 5; i++) {
                const yBase = i * 140;
                const pts = [];
                for (let x = 0; x <= 1000; x += 10) pts.push(x, yBase + Math.sin(x * 0.02 + t * 3 + i) * 20);
                entry.ceField.poly(pts, false).stroke({ width: 2, color: 'rgb(200, 100, 255)', alpha: Math.min(1, alpha * 2.5) });
            }
        }

        if (tower.isCapturing && tower.captureTarget) {
            this._drawCaptureVFX(entry.capture, tower.x, tower.y, tower.captureTarget.x, tower.captureTarget.y, tower.captureTime / 1.5);
        }

        if (tower.captureBuffTime > 0) {
            const t = performance.now() / 1000;
            entry.captureBuff.position.set(tower.x, tower.y);
            entry.captureBuff.circle(0, 0, 18 + Math.sin(t * 8) * 3)
                .stroke({ width: 3, color: '#ff00ff', alpha: 0.5 * (tower.captureBuffTime / 5.0) });
        }

        this._drawGetoSquids(entry, tower.squids || []);
    },

    _reconcileSpiritSlots(entry, spirits, cx, cy) {
        while (entry.spiritSlots.length < spirits.length) {
            const body = new Graphics();
            const faceContainer = new Container();
            const face = new Graphics();
            faceContainer.addChild(face);
            entry.spiritLayer.addChild(body, faceContainer);
            entry.spiritSlots.push({ body, faceContainer, face });
        }
        while (entry.spiritSlots.length > spirits.length) {
            const slot = entry.spiritSlots.pop();
            slot.body.destroy(); slot.faceContainer.destroy({ children: true });
        }
        for (let i = 0; i < spirits.length; i++) {
            this._drawUzumakiSpirit(entry.spiritSlots[i], spirits[i], cx, cy);
        }
    },

    // Mirrors _UzumakiSpirit.draw() in heroes/geto.js: a 5-segment tapered
    // spine (the "body") plus a small face drawn in the body's own rotated
    // local frame at its front end. The body's spine points are already
    // computed in world space (same as the original, which draws directly
    // in tower-relative world coords with no canvas transform), so `body`
    // needs no position/rotation of its own — only the face does, via a
    // real Pixi Container transform standing in for the original's
    // ctx.translate+rotate before drawing an unrotated ellipse.
    _drawUzumakiSpirit(slot, spirit, cx, cy) {
        const { body, faceContainer, face } = slot;
        body.clear(); face.clear();
        if (!spirit.active) { faceContainer.visible = false; return; }
        faceContainer.visible = true;

        const segments = 5, spine = [];
        const gravityIntensity = 140 / (spirit.radius + 30);
        const stretch = 1.0 + gravityIntensity * 0.6;
        const angleStep = 0.07 * spirit.speedMultiplier * stretch;
        const radiusStep = 3 * stretch;
        for (let i = 0; i < segments; i++) {
            const r = spirit.radius + i * radiusStep, a = spirit.angle - i * angleStep;
            spine.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
        }
        const left = [], right = [];
        for (let i = 0; i < spine.length; i++) {
            let dx, dy;
            if (i === 0) { dx = spine[1].x - spine[0].x; dy = spine[1].y - spine[0].y; }
            else if (i === spine.length - 1) { dx = spine[i].x - spine[i - 1].x; dy = spine[i].y - spine[i - 1].y; }
            else { dx = spine[i + 1].x - spine[i - 1].x; dy = spine[i + 1].y - spine[i - 1].y; }
            const len = Math.hypot(dx, dy) || 1;
            const nx = -(dy / len), ny = (dx / len);
            const t = i / (spine.length - 1);
            let w = t < 0.15 ? spirit.size * 0.45 * Math.sin((t / 0.15) * Math.PI / 2) : spirit.size * 0.45 * Math.cos(((t - 0.15) / 0.85) * Math.PI / 2);
            w /= Math.sqrt(stretch);
            left.push({ x: spine[i].x + nx * w, y: spine[i].y + ny * w });
            right.push({ x: spine[i].x - nx * w, y: spine[i].y - ny * w });
        }
        const pts = [spine[0].x, spine[0].y];
        for (const p of left) pts.push(p.x, p.y);
        for (let i = right.length - 1; i >= 0; i--) pts.push(right[i].x, right[i].y);
        body.poly(pts).fill({ color: spirit.color, alpha: spirit.opacity })
            .stroke({ width: 1.2, color: '#000000', alpha: spirit.opacity });

        const facePt = spine[Math.min(1, spine.length - 1)];
        const faceAngle = Math.atan2(spine[2].y - spine[0].y, spine[2].x - spine[0].x) + Math.PI;
        faceContainer.position.set(facePt.x, facePt.y);
        faceContainer.rotation = faceAngle;
        const fx = spirit.size * 0.12;
        face.fill({ color: '#000000' });
        if (spirit.faceType === 'cyclops') {
            face.ellipse(fx, 0, spirit.size * 0.11, spirit.size * 0.16).fill({ color: '#000000' });
        } else if (spirit.faceType === 'screaming') {
            face.circle(fx + spirit.size * 0.08, -spirit.size * 0.1, spirit.size * 0.07);
            face.circle(fx + spirit.size * 0.08, spirit.size * 0.1, spirit.size * 0.07);
            face.fill({ color: '#000000' });
            face.ellipse(fx - spirit.size * 0.08, 0, spirit.size * 0.08, spirit.size * 0.16).fill({ color: '#000000' });
        } else {
            face.circle(fx + spirit.size * 0.08, -spirit.size * 0.09, spirit.size * 0.08);
            face.circle(fx + spirit.size * 0.08, spirit.size * 0.09, spirit.size * 0.08);
            face.fill({ color: '#000000' });
        }
    },

    // Mirrors _StretchedHand.draw(): a bezier "arm" with 5 short finger
    // curves fanned out at the tip. Normal blend (only the blast circle in
    // the caller uses screen), drawn per-hand in that hand's own rotated
    // local frame.
    _drawStretchedHands(gfx, hands) {
        for (const h of hands) {
            const c1x = h.length * 0.3, c1y = Math.sin(h.waveOffset) * 20;
            const c2x = h.length * 0.6, c2y = Math.cos(h.waveOffset) * -20;
            const [sx, sy] = rotScale(0, 0, h.angle, 1);
            const [ex, ey] = rotScale(h.length, 0, h.angle, 1);
            const [cc1x, cc1y] = rotScale(c1x, c1y, h.angle, 1);
            const [cc2x, cc2y] = rotScale(c2x, c2y, h.angle, 1);
            gfx.moveTo(h.x + sx, h.y + sy)
                .bezierCurveTo(h.x + cc1x, h.y + cc1y, h.x + cc2x, h.y + cc2y, h.x + ex, h.y + ey)
                .stroke({ width: h.thickness, color: '#020203', alpha: h.opacity, cap: 'round', join: 'round' });
            const tipx = h.x + ex, tipy = h.y + ey;
            gfx.circle(tipx, tipy, h.thickness * 1.3).fill({ color: '#020203', alpha: h.opacity });
            for (let i = 0; i < 5; i++) {
                const fingerAngle = h.angle + (i - 2) * 0.4;
                const [fmx, fmy] = rotScale(h.thickness * 2, -h.thickness, fingerAngle, 1);
                const [fex, fey] = rotScale(h.thickness * 5, 0, fingerAngle, 1);
                gfx.moveTo(tipx, tipy)
                    .quadraticCurveTo(tipx + fmx, tipy + fmy, tipx + fex, tipy + fey)
                    .stroke({ width: h.thickness * 0.35, color: '#020203', alpha: h.opacity });
            }
        }
    },

    // Mirrors drawCaptureVFX(): a dashed quadratic-curve tether plus a few
    // dots traveling from target back to tower. Pixi Graphics has no
    // setLineDash equivalent, so the curve is sampled into short segments
    // and every other one is skipped to fake the dash pattern.
    _drawCaptureVFX(gfx, x1, y1, x2, y2, progress) {
        const t = performance.now() / 1000;
        const mx = (x1 + x2) / 2 + Math.sin(t * 3) * 20;
        const my = (y1 + y2) / 2 + Math.cos(t * 3) * 20;
        const dashLen = 5, gapLen = 5, dashCycle = dashLen + gapLen;
        const samples = 40;
        const pts = [];
        for (let i = 0; i <= samples; i++) {
            const s = i / samples;
            const px = (1 - s) * (1 - s) * x1 + 2 * (1 - s) * s * mx + s * s * x2;
            const py = (1 - s) * (1 - s) * y1 + 2 * (1 - s) * s * my + s * s * y2;
            pts.push({ x: px, y: py });
        }
        let dist = -(-t * 30) % dashCycle; if (dist < 0) dist += dashCycle;
        for (let i = 0; i < pts.length - 1; i++) {
            const segLen = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
            const phase = (dist + i * (Math.hypot(x2 - x1, y2 - y1) / samples)) % dashCycle;
            if (phase < dashLen) gfx.moveTo(pts[i].x, pts[i].y).lineTo(pts[i + 1].x, pts[i + 1].y);
        }
        gfx.stroke({ width: 3, color: 'rgba(200, 100, 255, ' + progress + ')' });
        for (let i = 0; i < 4; i++) {
            const p = ((t * 2 + i * 0.25) % 1);
            const px = x2 + (x1 - x2) * p, py = y2 + (y1 - y2) * p;
            gfx.circle(px, py, 3).fill({ color: '#ffffff', alpha: 1 - p });
        }
    },

    _drawGetoSquids(entry, squids) {
        while (entry.squidSlots.length < squids.length) {
            const container = new Container();
            const sprite = new Sprite(); sprite.anchor.set(0.5);
            const gfx = new Graphics();
            container.addChild(sprite, gfx);
            entry.squidLayer.addChild(container);
            entry.squidSlots.push({ container, sprite, gfx });
        }
        while (entry.squidSlots.length > squids.length) {
            const slot = entry.squidSlots.pop();
            slot.container.destroy({ children: true });
        }
        const squidTexture = PixiAssets.get('proj_squid');
        const wormTexture = PixiAssets.get('proj_worm');
        for (let i = 0; i < squids.length; i++) {
            const s = squids[i];
            const { container, sprite, gfx } = entry.squidSlots[i];
            container.position.set(s.x, s.y);
            container.rotation = s.angle;
            gfx.clear();
            const texture = s.isWorm ? wormTexture : squidTexture;
            if (texture !== Texture.EMPTY) {
                if (sprite.texture !== texture) sprite.texture = texture;
                const size = s.isWorm ? 50 : 24;
                const maxDim = Math.max(texture.width, texture.height) || 1;
                const scale = size / maxDim;
                sprite.width = texture.width * scale;
                sprite.height = texture.height * scale;
                sprite.visible = true;
            } else {
                sprite.visible = false;
                if (s.isWorm) {
                    gfx.blendMode = 'screen';
                    const t = performance.now() / 1000;
                    for (let j = 0; j < 6; j++) {
                        const offset = Math.sin(t * 6 + j * 0.5) * 3;
                        const hue = (j * 60 + t * 100) % 360;
                        const cx = j * 9 - 22;
                        gfx.circle(cx, offset, 11).fill({ fill: radialGrad(11, [
                            { offset: 0, color: `hsla(${hue}, 100%, 70%, 1)` },
                            { offset: 0.5, color: `hsla(${hue}, 80%, 40%, 0.6)` },
                            { offset: 1, color: 'rgba(0, 0, 0, 0)' },
                        ]) });
                    }
                } else {
                    gfx.blendMode = 'normal';
                    const t = performance.now() / 1000;
                    gfx.circle(0, 0, 12).fill({ fill: radialGrad(12, [
                        { offset: 0, color: '#a020f0' },
                        { offset: 0.6, color: '#4a0080' },
                        { offset: 1, color: 'rgba(0, 0, 0, 0)' },
                    ]) });
                    for (let j = 0; j < 4; j++) {
                        const a = (j / 4) * Math.PI * 2 + t * 4;
                        gfx.moveTo(0, 0).lineTo(Math.cos(a) * 8, Math.sin(a) * 8)
                            .stroke({ width: 2, color: '#a020f0' });
                    }
                }
            }
        }
    },

    _drawMaxBlueVFX(entry, x, y, baseR) {
        if (isNaN(x) || isNaN(y) || isNaN(baseR)) return;
        const t = performance.now() / 1000;
        const pulse = 1 + Math.sin(t * 4) * 0.15;
        const r = Math.max(1, baseR * pulse);

        const scaleA = 1 + Math.sin(t * 3) * 0.05;
        const ptsA = blobPoints(r, (ang) => r * 1.2 + Math.sin(ang * 3 + t * 5) * 25, t * 1.5, scaleA);
        entry.blueScreen.poly(ptsA).fill({ fill: radialGrad(r * 1.2 * scaleA, [
            { offset: 0, color: 'rgba(0, 210, 255, 0.6)' },
            { offset: 0.6, color: 'rgba(0, 85, 255, 0.2)' },
            { offset: 1, color: 'rgba(0, 0, 0, 0)' },
        ]) });
        entry.blueScreen.position.set(x, y);

        const scaleB = 1 - Math.sin(t * 4) * 0.05;
        const ptsB = blobPoints(r, (ang) => r + Math.cos(ang * 4 + t * 6) * 20, -t * 1.8, scaleB);
        entry.blueScreen.poly(ptsB).fill({ fill: radialGrad(r * scaleB, [
            { offset: 0.2, color: 'rgba(0, 210, 255, 0.5)' },
            { offset: 0.7, color: 'rgba(0, 34, 102, 0.4)' },
            { offset: 1, color: 'rgba(0, 0, 0, 0)' },
        ]) });

        entry.blueCore.position.set(x, y);
        entry.blueCore.circle(0, 0, r * 0.8).fill({ fill: radialGrad(r * 0.8, [
            { offset: 0.1, color: '#ffffff' },
            { offset: 0.4, color: '#00d2ff' },
            { offset: 0.8, color: '#002266' },
            { offset: 1, color: 'rgba(0, 34, 102, 0)' },
        ]) });
    },

    _drawRedTyphoonVFX(entry, x, y, rot, baseR) {
        if (isNaN(x) || isNaN(y) || isNaN(baseR) || isNaN(rot)) return;
        const t = performance.now() / 1000;
        const pulse = 1 + Math.sin(t * 5) * 0.15;
        const r = Math.max(1, baseR * pulse);

        entry.redScreen.position.set(x, y);
        const grad = radialGrad(r, [
            { offset: 0, color: 'rgba(255, 255, 255, 0)' },
            { offset: 0.5, color: 'rgba(255, 0, 43, 0.6)' },
            { offset: 0.9, color: 'rgba(255, 255, 255, 0.8)' },
            { offset: 1, color: 'rgba(0, 0, 0, 0)' },
        ]);
        for (let i = 0; i < 3; i++) {
            const ang = rot + (i * Math.PI * 2 / 3);
            // arc(0,0,r,0,PI*0.6) rotated by `ang` -> arc from ang to ang+PI*0.6
            entry.redScreen.arc(0, 0, r, ang, ang + Math.PI * 0.6)
                .stroke({ width: r * 0.4, fill: grad, alpha: 1 });
        }

        entry.redCore.position.set(x, y);
        entry.redCore.circle(0, 0, r * 0.5).fill({ fill: radialGrad(r * 0.5, [
            { offset: 0, color: '#ffffff' },
            { offset: 0.5, color: '#ff002b' },
            { offset: 1, color: 'rgba(255, 0, 43, 0)' },
        ]) });
    },

    _drawHollowPurpleVFX(entry, x, y, progress) {
        if (isNaN(x) || isNaN(y) || isNaN(progress)) return;
        const t = performance.now() / 1000;
        const trembleX = (Math.random() - 0.5) * 4;
        const trembleY = (Math.random() - 0.5) * 4;
        entry.purpleScreen.position.set(x + trembleX, y + trembleY);

        const shroudR = Math.max(1, (100 + Math.sin(t * 2) * 20) * progress);
        entry.purpleScreen.circle(0, 0, shroudR).fill({ fill: radialGrad(shroudR, [
            { offset: 0, color: 'rgba(148, 0, 211, 0.9)' },
            { offset: 0.7, color: 'rgba(75, 0, 130, 0.5)' },
            { offset: 1, color: 'rgba(0, 0, 0, 0)' },
        ]) });

        const ringR = Math.max(1, (80 + Math.sin(t * 3) * 10) * progress);
        entry.purpleScreen.circle(0, 0, ringR).stroke({ width: 5, color: 'rgba(255, 255, 255, 0.5)' });

        const len = 60 * progress;
        for (let i = 0; i < 3; i++) {
            const ang = t * 10 + (i * Math.PI * 2 / 3);
            const x1 = Math.cos(ang) * len * 0.5, y1 = Math.sin(ang) * len * 0.5;
            const x2 = Math.cos(ang + Math.random() * 0.5) * len, y2 = Math.sin(ang + Math.random() * 0.5) * len;
            entry.purpleScreen.moveTo(0, 0).lineTo(x1, y1).lineTo(x2, y2)
                .stroke({ width: 2, color: `rgba(255, 255, 255, ${Math.random() * 0.8})` });
        }

        entry.purpleCore.position.set(x + trembleX, y + trembleY);
        const eyeR = Math.max(1, 40 * progress);
        entry.purpleCore.circle(0, 0, eyeR).fill({ fill: radialGrad(eyeR, [
            { offset: 0, color: '#ffffff' },
            { offset: 0.5, color: '#e6beff' },
            { offset: 0.8, color: 'rgba(148, 0, 211, 0.8)' },
            { offset: 1, color: 'rgba(0, 0, 0, 0)' },
        ]) });
    },

    _drawLimitlessAura(entry, tower) {
        entry.aura.position.set(tower.x, tower.y);
        const color = tower.phase === 2 ? '#ff00ff' : '#a253ff';
        const t = performance.now() / 1000;
        for (let i = 0; i < 3; i++) {
            const start = t + (i * Math.PI / 3);
            entry.aura.arc(0, 0, 22 + (i * 4), start, start + Math.PI * 1.5)
                .stroke({ width: 2, color, alpha: 0.3 });
        }
    },

    _drawBlueWells(entry, tower) {
        const wells = tower.blueWells || [];
        while (entry.wellGfx.length < wells.length) {
            const g = new Graphics();
            entry.container.addChild(g);
            entry.wellGfx.push(g);
        }
        while (entry.wellGfx.length > wells.length) { entry.wellGfx.pop().destroy(); }

        for (let i = 0; i < wells.length; i++) {
            const w = wells[i];
            const g = entry.wellGfx[i];
            g.clear();
            if (!w) continue;
            const alpha = Math.min(1, w.life / w.maxLife) * 0.6;
            const wx = isNaN(w.x) ? tower.x : w.x;
            const wy = isNaN(w.y) ? tower.y : w.y;
            const wr = Math.max(1, w.radius || 50);
            g.position.set(wx, wy);
            g.circle(0, 0, wr).fill({ fill: radialGrad(wr, [
                { offset: 0, color: 'rgba(0, 0, 0, 1)' },
                { offset: 0.5, color: 'rgba(0, 50, 255, 0.8)' },
                { offset: 1, color: 'rgba(0, 0, 0, 0)' },
            ]), alpha });
        }
    },
};
