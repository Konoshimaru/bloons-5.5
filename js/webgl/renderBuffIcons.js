// js/webgl/renderBuffIcons.js
//
// WebGL port of the tower buff-icon row that lives in towerRenderer.js's
// _drawBuffs/_getBuffIconCanvas (Canvas2D). Buff icons are small colored
// circles with a white glyph, drawn in a horizontal row just above the
// currently-selected tower (GameEngine.selectedPlacedTower), one icon per
// active buff.
//
// The Canvas2D version pre-renders each icon *type* to an offscreen 32x32
// canvas once and caches it, then blits it per frame. We mirror that: each
// type is pre-rendered to a 32x32 canvas using the exact same vector code,
// then wrapped in a Pixi Texture that's reused by a small pool of sprites.
// This keeps the icons byte-for-byte identical to the Canvas2D output while
// letting Pixi batch them.

import { Sprite, Text, Texture } from 'pixi.js';
import { PixiApp } from './pixiApp.js';
import { GLOBAL_SCALE } from '../constants.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;
const ICON_SIZE = 32; // px, matches towerRenderer.js's 32x32 icon canvas
const ICON_SPACING = 20 * GS;
const STACK_BADGE_RADIUS = 7 * GS;

const _buffIconTextureCache = {};

// Draw one 32x32 icon canvas for a buff type. This is a faithful port of
// towerRenderer.js's _getBuffIconCanvas (color table + all shape branches).
function _renderIconCanvas(type) {
    const canvas = document.createElement('canvas');
    canvas.width = ICON_SIZE;
    canvas.height = ICON_SIZE;
    const ctx = canvas.getContext('2d');
    const sizeScale = 1.2;

    ctx.translate(ICON_SIZE / 2, ICON_SIZE / 2); // Center drawing

    const colorTable = {
        alch: '#9b59b6', // purple brew
        alch_dip: '#1abc9c', // teal acid dip
        oc: '#e74c3c', // red overclock
        village: '#3498db', // blue village
        jd: '#27ae60', // green jungle drums
        ptr: '#f1c40f', // yellow primary training
        pm: '#e67e22', // orange primary mentoring
        pe: '#c0392b', // dark red primary expertise
        cta: '#9b59b6', // purple call to arms
        radar: '#16a085', // teal radar
        mib: '#34495e', // dark blue/grey MIB
        pat_rally: '#f39c12', // orange rally
        adora: '#ffd700', // gold long arm
        ezili: '#8e44ad', // purple totem
        skywarden: '#7f8c8d', // grey skywarden
        heat_it_up: '#e67e22', // orange heat it up
        rabble: '#d35400', // burnt orange rabble
        reposition: '#2ecc71', // green reposition
        flight_boost: '#3498db' // blue flight boost
    };

    let bgColor = colorTable[type];
    if (!bgColor) {
        // Deterministic fallback color for any unknown buff type, so a new
        // buff still gets a distinct icon instead of the generic star.
        let h = 0;
        for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) >>> 0;
        bgColor = `hsl(${h % 360}, 55%, 50%)`;
    }

    // Draw background circle
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.arc(0, 0, 10 * GS * sizeScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 2 * GS;
    ctx.stroke();

    // Draw specific symbol
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 * GS;

    if (type === 'village') {
        ctx.beginPath();
        ctx.moveTo(0, -6 * GS * sizeScale);
        ctx.lineTo(5 * GS * sizeScale, 0);
        ctx.lineTo(5 * GS * sizeScale, 5 * GS * sizeScale);
        ctx.lineTo(-5 * GS * sizeScale, 5 * GS * sizeScale);
        ctx.lineTo(-5 * GS * sizeScale, 0);
        ctx.closePath();
        ctx.fill();
    } else if (type === 'oc') {
        ctx.beginPath();
        ctx.moveTo(-2 * GS * sizeScale, -7 * GS * sizeScale);
        ctx.lineTo(4 * GS * sizeScale, -1 * GS * sizeScale);
        ctx.lineTo(0, 0);
        ctx.lineTo(2 * GS * sizeScale, 7 * GS * sizeScale);
        ctx.lineTo(-4 * GS * sizeScale, 1 * GS * sizeScale);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
    } else if (type === 'alch') {
        ctx.beginPath();
        ctx.moveTo(0, -7 * GS * sizeScale);
        ctx.bezierCurveTo(5 * GS * sizeScale, -2 * GS * sizeScale, 5 * GS * sizeScale, 5 * GS * sizeScale, 0, 5 * GS * sizeScale);
        ctx.bezierCurveTo(-5 * GS * sizeScale, 5 * GS * sizeScale, -5 * GS * sizeScale, -2 * GS * sizeScale, 0, -7 * GS * sizeScale);
        ctx.fill();
    } else if (type === 'jd') {
        ctx.beginPath();
        ctx.ellipse(0, 3 * GS * sizeScale, 5 * GS * sizeScale, 2 * GS * sizeScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-3 * GS * sizeScale, -4 * GS * sizeScale, 6 * GS * sizeScale, 7 * GS * sizeScale);
        ctx.beginPath();
        ctx.ellipse(0, -4 * GS * sizeScale, 3 * GS * sizeScale, 1 * GS * sizeScale, 0, 0, Math.PI * 2);
        ctx.fill();
    } else if (type === 'ptr') {
        ctx.beginPath();
        ctx.arc(0, 0, 5 * GS * sizeScale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-7 * GS * sizeScale, 0); ctx.lineTo(-2 * GS * sizeScale, 0);
        ctx.moveTo(2 * GS * sizeScale, 0); ctx.lineTo(7 * GS * sizeScale, 0);
        ctx.moveTo(0, -7 * GS * sizeScale); ctx.lineTo(0, -2 * GS * sizeScale);
        ctx.moveTo(0, 2 * GS * sizeScale); ctx.lineTo(0, 7 * GS * sizeScale);
        ctx.stroke();
    } else if (type === 'pm') {
        ctx.beginPath();
        ctx.moveTo(-5 * GS * sizeScale, -2 * GS * sizeScale);
        ctx.lineTo(0, -5 * GS * sizeScale);
        ctx.lineTo(5 * GS * sizeScale, -2 * GS * sizeScale);
        ctx.lineTo(5 * GS * sizeScale, 4 * GS * sizeScale);
        ctx.lineTo(0, 7 * GS * sizeScale);
        ctx.lineTo(-5 * GS * sizeScale, 4 * GS * sizeScale);
        ctx.closePath();
        ctx.fill();
    } else if (type === 'pe') {
        ctx.beginPath();
        ctx.moveTo(0, -7 * GS * sizeScale);
        ctx.lineTo(4 * GS * sizeScale, -2 * GS * sizeScale);
        ctx.lineTo(1 * GS * sizeScale, -2 * GS * sizeScale);
        ctx.lineTo(1 * GS * sizeScale, 6 * GS * sizeScale);
        ctx.lineTo(-1 * GS * sizeScale, 6 * GS * sizeScale);
        ctx.lineTo(-1 * GS * sizeScale, -2 * GS * sizeScale);
        ctx.lineTo(-4 * GS * sizeScale, -2 * GS * sizeScale);
        ctx.closePath();
        ctx.fill();
    } else if (type === 'cta') {
        ctx.beginPath();
        ctx.moveTo(-4 * GS * sizeScale, -3 * GS * sizeScale);
        ctx.lineTo(2 * GS * sizeScale, -6 * GS * sizeScale);
        ctx.lineTo(2 * GS * sizeScale, 6 * GS * sizeScale);
        ctx.lineTo(-4 * GS * sizeScale, 3 * GS * sizeScale);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(-7 * GS * sizeScale, -2 * GS * sizeScale, 3 * GS * sizeScale, 4 * GS * sizeScale);
    } else if (type === 'radar') {
        ctx.beginPath();
        ctx.moveTo(-5 * GS * sizeScale, -2 * GS * sizeScale);
        ctx.quadraticCurveTo(0, -8 * GS * sizeScale, 5 * GS * sizeScale, -2 * GS * sizeScale);
        ctx.fill();
        ctx.fillRect(-1 * GS * sizeScale, -1 * GS * sizeScale, 2 * GS * sizeScale, 6 * GS * sizeScale);
        ctx.beginPath();
        ctx.arc(0, 6 * GS * sizeScale, 2 * GS * sizeScale, 0, Math.PI * 2);
        ctx.fill();
    } else if (type === 'mib') {
        ctx.beginPath();
        ctx.moveTo(0, -7 * GS * sizeScale);
        ctx.lineTo(5 * GS * sizeScale, -4 * GS * sizeScale);
        ctx.lineTo(4 * GS * sizeScale, 4 * GS * sizeScale);
        ctx.lineTo(0, 7 * GS * sizeScale);
        ctx.lineTo(-4 * GS * sizeScale, 4 * GS * sizeScale);
        ctx.lineTo(-5 * GS * sizeScale, -4 * GS * sizeScale);
        ctx.closePath();
        ctx.fill();
    } else if (type === 'alch_dip') {
        ctx.beginPath();
        ctx.moveTo(-3 * GS * sizeScale, -6 * GS * sizeScale);
        ctx.quadraticCurveTo(5 * GS * sizeScale, -2 * GS * sizeScale, 4 * GS * sizeScale, 3 * GS * sizeScale);
        ctx.quadraticCurveTo(0, 6 * GS * sizeScale, -4 * GS * sizeScale, 3 * GS * sizeScale);
        ctx.quadraticCurveTo(-5 * GS * sizeScale, -2 * GS * sizeScale, -3 * GS * sizeScale, -6 * GS * sizeScale);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 4 * GS * sizeScale, 1.5 * GS * sizeScale, 0, Math.PI * 2);
        ctx.fill();
    } else if (type === 'pat_rally') {
        ctx.fillRect(-1 * GS * sizeScale, -7 * GS * sizeScale, 2 * GS * sizeScale, 12 * GS * sizeScale);
        ctx.beginPath();
        ctx.moveTo(1 * GS * sizeScale, -7 * GS * sizeScale);
        ctx.lineTo(7 * GS * sizeScale, -4 * GS * sizeScale);
        ctx.lineTo(1 * GS * sizeScale, -1 * GS * sizeScale);
        ctx.closePath();
        ctx.fill();
    } else if (type === 'adora') {
        ctx.beginPath();
        ctx.arc(0, 0, 3.5 * GS * sizeScale, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4;
            ctx.fillRect(Math.cos(a) * 4.5 * GS * sizeScale - 1 * GS * sizeScale, Math.sin(a) * 4.5 * GS * sizeScale - 1 * GS * sizeScale, 2 * GS * sizeScale, 2 * GS * sizeScale);
        }
    } else if (type === 'ezili') {
        ctx.beginPath();
        ctx.moveTo(0, 5 * GS * sizeScale);
        ctx.bezierCurveTo(-7 * GS * sizeScale, -1 * GS * sizeScale, -3 * GS * sizeScale, -6 * GS * sizeScale, 0, -1 * GS * sizeScale);
        ctx.bezierCurveTo(3 * GS * sizeScale, -6 * GS * sizeScale, 7 * GS * sizeScale, -1 * GS * sizeScale, 0, 5 * GS * sizeScale);
        ctx.fill();
    } else if (type === 'skywarden') {
        ctx.beginPath();
        ctx.moveTo(-7 * GS * sizeScale, -3 * GS * sizeScale);
        ctx.quadraticCurveTo(0, -6 * GS * sizeScale, 7 * GS * sizeScale, -3 * GS * sizeScale);
        ctx.quadraticCurveTo(0, 0, -7 * GS * sizeScale, -3 * GS * sizeScale);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 2 * GS * sizeScale, 1.5 * GS * sizeScale, 0, Math.PI * 2);
        ctx.fill();
    } else if (type === 'heat_it_up') {
        ctx.beginPath();
        ctx.moveTo(0, -7 * GS * sizeScale);
        ctx.quadraticCurveTo(5 * GS * sizeScale, -1 * GS * sizeScale, 3 * GS * sizeScale, 3 * GS * sizeScale);
        ctx.quadraticCurveTo(0, 6 * GS * sizeScale, -3 * GS * sizeScale, 3 * GS * sizeScale);
        ctx.quadraticCurveTo(-5 * GS * sizeScale, -1 * GS * sizeScale, 0, -7 * GS * sizeScale);
        ctx.fill();
    } else if (type === 'rabble') {
        ctx.beginPath();
        ctx.moveTo(-6 * GS * sizeScale, 1 * GS * sizeScale);
        ctx.lineTo(0, -4 * GS * sizeScale);
        ctx.lineTo(6 * GS * sizeScale, 1 * GS * sizeScale);
        ctx.lineTo(6 * GS * sizeScale, 3 * GS * sizeScale);
        ctx.lineTo(0, -2 * GS * sizeScale);
        ctx.lineTo(-6 * GS * sizeScale, 3 * GS * sizeScale);
        ctx.closePath();
        ctx.fill();
    } else if (type === 'reposition') {
        ctx.beginPath();
        ctx.moveTo(7 * GS * sizeScale, 0);
        ctx.lineTo(2 * GS * sizeScale, -4 * GS * sizeScale);
        ctx.lineTo(2 * GS * sizeScale, 4 * GS * sizeScale);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-7 * GS * sizeScale, 0);
        ctx.lineTo(-2 * GS * sizeScale, -4 * GS * sizeScale);
        ctx.lineTo(-2 * GS * sizeScale, 4 * GS * sizeScale);
        ctx.closePath();
        ctx.fill();
    } else if (type === 'flight_boost') {
        ctx.beginPath();
        ctx.moveTo(0, -7 * GS * sizeScale);
        ctx.lineTo(7 * GS * sizeScale, 1 * GS * sizeScale);
        ctx.lineTo(3 * GS * sizeScale, 1 * GS * sizeScale);
        ctx.lineTo(3 * GS * sizeScale, 5 * GS * sizeScale);
        ctx.lineTo(-3 * GS * sizeScale, 5 * GS * sizeScale);
        ctx.lineTo(-3 * GS * sizeScale, 1 * GS * sizeScale);
        ctx.lineTo(-7 * GS * sizeScale, 1 * GS * sizeScale);
        ctx.closePath();
        ctx.fill();
    } else {
        // Generic fallback: white 5-point star.
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI / 5) - Math.PI / 2;
            const x1 = Math.cos(angle) * 6 * GS * sizeScale;
            const y1 = Math.sin(angle) * 6 * GS * sizeScale;
            if (i === 0) ctx.moveTo(x1, y1);
            else ctx.lineTo(x1, y1);
        }
        ctx.closePath();
        ctx.fill();
    }

    return canvas;
}

// Lazy, cached: pre-renders each buff type's icon to a Pixi Texture once.
function _getBuffIconTexture(type) {
    if (!_buffIconTextureCache[type]) {
        _buffIconTextureCache[type] = Texture.from(_renderIconCanvas(type));
    }
    return _buffIconTextureCache[type];
}

// Mirrors towerRenderer.js _drawBuffs's buffsToDraw assembly (legacy
// alch/overclock buffs + activeBuffs entries).
function _collectBuffs(tower) {
    const buffs = [];
    if (tower.alchBuff) {
        buffs.push({ type: 'alch', stacks: tower.alchBuff.shotsLeft > 0 ? tower.alchBuff.shotsLeft : '' });
    }
    if (tower.overclockTimer > 0) {
        buffs.push({ type: 'oc', stacks: tower.ultraboostStacks > 1 ? tower.ultraboostStacks : '' });
    }
    if (tower.activeBuffs && tower.activeBuffs.length > 0) {
        for (const buff of tower.activeBuffs) {
            buffs.push({ type: buff.data.type || 'generic', stacks: buff.stacks > 1 ? buff.stacks : '' });
        }
    }
    return buffs;
}

export const BuffIconsRenderer = {
    _buffIconSprites: [],

    // Draws the buff icon row above the currently selected tower. Lives in
    // the world-space 'towers' layer (added there rather than inside the
    // tower's rotated container so the icons stay world-aligned, matching
    // how towerRenderer.js draws them in world space and how the stun
    // overlay sprite is handled here). Only one tower is ever selected, so
    // a single small sprite pool suffices.
    _drawBuffIcons(engine) {
        const tower = engine.selectedPlacedTower;
        const buffs = tower ? _collectBuffs(tower) : [];

        while (this._buffIconSprites.length < buffs.length) {
            const sprite = new Sprite();
            sprite.anchor.set(0.5);
            sprite.width = ICON_SIZE;
            sprite.height = ICON_SIZE;
            PixiApp.layer('towers').addChild(sprite);
            this._buffIconSprites.push(sprite);
        }
        while (this._buffIconSprites.length > buffs.length) {
            this._buffIconSprites.pop().destroy();
        }

        if (buffs.length === 0 || !tower) return;

        const totalWidth = (buffs.length - 1) * ICON_SPACING;
        const startX = tower.x - totalWidth / 2;
        const y = tower.y - ((tower.hitRadius || 20) * 1.5) - 15 * GS;

        buffs.forEach((buff, i) => {
            const sprite = this._buffIconSprites[i];
            sprite.texture = _getBuffIconTexture(buff.type);
            sprite.x = startX + i * ICON_SPACING;
            sprite.y = y;
            sprite.visible = true;

            // Stack-count badge (port of towerRenderer.js _drawBuffs's
            // `ctx.arc(x + 7*GS, y + 7*GS, 7*GS)` + fillText block).
            if (buff.stacks !== '' && buff.stacks !== undefined) {
                if (!sprite._stackBadge) {
                    const badge = new Text({
                        text: '',
                        style: { fontFamily: 'Nunito, sans-serif', fontSize: 10 * GS, fontWeight: 'bold', fill: '#ffffff' }
                    });
                    badge.anchor.set(0.5);
                    sprite.addChild(badge);
                    sprite._stackBadge = badge;
                }
                const badge = sprite._stackBadge;
                if (badge.text !== String(buff.stacks)) badge.text = String(buff.stacks);
                badge.x = STACK_BADGE_RADIUS;
                badge.y = STACK_BADGE_RADIUS;
                badge.visible = true;
            } else if (sprite._stackBadge) {
                sprite._stackBadge.visible = false;
            }
        });
    }
};
