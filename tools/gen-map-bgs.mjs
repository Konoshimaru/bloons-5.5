// tools/gen-map-bgs.mjs
//
// Procedurally renders 1280x720 background PNGs for the maps defined in
// js/generatedMaps.js (day + night variants) into public/sprites/maps/.
//
// Pure Node — no deps. PNG encoding is done by hand (zlib deflate for IDAT +
// CRC32), so there's nothing to install. Run:  node tools/gen-map-bgs.mjs
//
// What gets baked into each image:
//  - themed ground (gradient + noise patches)
//  - the path itself (dark outline + dirt fill, matching MapRenderCore's
//    drawPaths look, since generated maps keep paths visible:false)
//  - water brushes (same thickness/color the engine draws, so the baked
//    stroke and the runtime overlay align exactly)
//  - decorations for each hitbox prop, keyed off the prop's `decor` tag

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GeneratedMaps } from '../js/generatedMaps.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'sprites', 'maps');
mkdirSync(OUT_DIR, { recursive: true });

const W = 1280;
const H = 720;

// ---------------------------------------------------------------------------
// PNG encoder
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
    return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(w, h, rgba) {
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8;   // bit depth
    ihdr[9] = 6;   // color type RGBA
    ihdr[10] = 0;  // compression
    ihdr[11] = 0;  // filter
    ihdr[12] = 0;  // interlace
    const stride = w * 4;
    const raw = Buffer.alloc((stride + 1) * h);
    for (let y = 0; y < h; y++) {
        raw[y * (stride + 1)] = 0; // filter: none
        Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
    }
    const idat = deflateSync(raw, { level: 9 });
    return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------------------
// Tiny rasterizer
// ---------------------------------------------------------------------------

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

class Raster {
    constructor(w = W, h = H) {
        this.w = w;
        this.h = h;
        this.d = new Uint8Array(w * h * 4);
    }
    _idx(x, y) { return (y * this.w + x) * 4; }
    setPx(x, y, c, a = 1) {
        x = Math.round(x); y = Math.round(y);
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
        const i = this._idx(x, y);
        const d = this.d;
        const r = c[0], g = c[1], b = c[2];
        d[i] = r * a + d[i] * (1 - a);
        d[i + 1] = g * a + d[i + 1] * (1 - a);
        d[i + 2] = b * a + d[i + 2] * (1 - a);
        d[i + 3] = 255;
    }
    fillRect(x, y, w, h, c, a = 1) {
        const x0 = Math.max(0, Math.floor(x));
        const y0 = Math.max(0, Math.floor(y));
        const x1 = Math.min(this.w, Math.ceil(x + w));
        const y1 = Math.min(this.h, Math.ceil(y + h));
        for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.setPx(xx, yy, c, a);
    }
    fillCircle(cx, cy, r, c, a = 1) {
        const x0 = Math.max(0, Math.floor(cx - r));
        const y0 = Math.max(0, Math.floor(cy - r));
        const x1 = Math.min(this.w, Math.ceil(cx + r));
        const y1 = Math.min(this.h, Math.ceil(cy + r));
        for (let yy = y0; yy < y1; yy++) {
            for (let xx = x0; xx < x1; xx++) {
                const dx = xx - cx, dy = yy - cy;
                if (dx * dx + dy * dy <= r * r) this.setPx(xx, yy, c, a);
            }
        }
    }
    fillEllipse(cx, cy, rx, ry, c, a = 1) {
        const x0 = Math.max(0, Math.floor(cx - rx));
        const y0 = Math.max(0, Math.floor(cy - ry));
        const x1 = Math.min(this.w, Math.ceil(cx + rx));
        const y1 = Math.min(this.h, Math.ceil(cy + ry));
        for (let yy = y0; yy < y1; yy++) {
            for (let xx = x0; xx < x1; xx++) {
                const dx = (xx - cx) / rx, dy = (yy - cy) / ry;
                if (dx * dx + dy * dy <= 1) this.setPx(xx, yy, c, a);
            }
        }
    }
    fillPoly(pts, c, a = 1) {
        let minY = Infinity, maxY = -Infinity;
        for (const p of pts) {
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }
        minY = Math.max(0, Math.floor(minY));
        maxY = Math.min(this.h - 1, Math.ceil(maxY));
        for (let y = minY; y <= maxY; y++) {
            const xs = [];
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                const pi = pts[i], pj = pts[j];
                const yi = pi.y, yj = pj.y;
                if ((yi <= y && yj > y) || (yj <= y && yi > y)) {
                    const t = (y - yi) / (yj - yi);
                    xs.push(pi.x + t * (pj.x - pi.x));
                }
            }
            xs.sort((p, q) => p - q);
            for (let k = 0; k + 1 < xs.length; k += 2) {
                const x0 = Math.max(0, Math.floor(xs[k]));
                const x1 = Math.min(this.w - 1, Math.ceil(xs[k + 1]));
                for (let x = x0; x <= x1; x++) this.setPx(x, y, c, a);
            }
        }
    }
    // Thick line with round caps (used for paths + water brushes).
    strokeLine(x1, y1, x2, y2, w, c, a = 1) {
        const dist = Math.hypot(x2 - x1, y2 - y1);
        const r = w / 2;
        const steps = Math.max(1, Math.ceil(dist / 2));
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            this.fillCircle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, r, c, a);
        }
    }
    strokePath(pts, w, c, a = 1) {
        for (let i = 0; i < pts.length - 1; i++) {
            this.strokeLine(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, w, c, a);
        }
        // cap the ends like a round cap
        if (pts.length > 0) this.fillCircle(pts[0].x, pts[0].y, w / 2, c, a);
        if (pts.length > 1) this.fillCircle(pts[pts.length - 1].x, pts[pts.length - 1].y, w / 2, c, a);
    }
    vGradient(cTop, cBot) {
        for (let y = 0; y < this.h; y++) {
            const t = y / (this.h - 1);
            const c = [
                cTop[0] + (cBot[0] - cTop[0]) * t,
                cTop[1] + (cBot[1] - cTop[1]) * t,
                cTop[2] + (cBot[2] - cTop[2]) * t
            ];
            this.fillRect(0, y, this.w, 1, c);
        }
    }
    speckle(count, colors, alpha, rng) {
        for (let i = 0; i < count; i++) {
            const x = rng() * this.w;
            const y = rng() * this.h;
            const c = colors[Math.floor(rng() * colors.length)];
            this.setPx(x, y, c, alpha);
        }
    }
}

// ---------------------------------------------------------------------------
// Themes: ground + decoration painters. Each receives the Raster and the map.
// ---------------------------------------------------------------------------

const PALM_FROND = [0x3, 0x0, 0x0]; // placeholder unused

function paintGround(r, theme) {
    const T = {
        beach:   { top: [244, 224, 168], bot: [224, 197, 138] },
        hedge:   { top: [126, 200, 80],  bot: [96, 174, 60] },
        desert:  { top: [232, 207, 150], bot: [216, 183, 124] },
        city:    { top: [123, 127, 135], bot: [94, 97, 105] },
        candy:   { top: [255, 215, 232], bot: [255, 193, 221] },
        winter:  { top: [244, 249, 255], bot: [222, 234, 246] },
        volcano: { top: [107, 95, 85],   bot: [76, 69, 62] },
        forest:  { top: [46, 79, 58],    bot: [33, 55, 41] },
        neon:    { top: [26, 29, 49],    bot: [15, 17, 32] }
    }[theme];
    r.vGradient(T.top, T.bot);
}

function paintNoise(r, theme, rng) {
    const N = {
        beach:   [[240, 216, 158], [228, 202, 144]],
        hedge:   [[120, 196, 76], [104, 184, 66], [132, 206, 86]],
        desert:  [[226, 199, 142], [238, 213, 158], [210, 178, 118]],
        city:    [[130, 134, 142], [110, 113, 120], [90, 93, 100]],
        candy:   [[255, 222, 238], [250, 208, 228], [255, 205, 226]],
        winter:  [[240, 246, 255], [250, 252, 255], [232, 240, 250]],
        volcano: [[99, 87, 78], [116, 102, 92], [86, 76, 68]],
        forest:  [[40, 70, 52], [52, 88, 64], [30, 50, 38]],
        neon:    [[30, 33, 55], [22, 25, 42], [35, 39, 64]]
    }[theme];
    r.speckle(2600, N, 0.5, rng);
}

// Draws one point of a quadratic bezier path the way map.js samples curves.
function samplePath(waypoints) {
    const pts = [];
    if (!waypoints || waypoints.length === 0) return pts;
    for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i], p2 = waypoints[i + 1];
        if (p2.curve) {
            const cp = { x: p2.curve.cx, y: p2.curve.cy };
            const subdiv = 40;
            let prev = { x: p1.x, y: p1.y };
            for (let s = 1; s <= subdiv; s++) {
                const t = s / subdiv;
                const x = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * cp.x + t * t * p2.x;
                const y = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * cp.y + t * t * p2.y;
                pts.push({ x, y });
                prev = { x, y };
            }
        } else {
            pts.push({ x: p2.x, y: p2.y });
        }
    }
    // push the start point first
    pts.unshift({ x: waypoints[0].x, y: waypoints[0].y });
    return pts;
}

function paintPath(r, map) {
    for (const path of map.paths || []) {
        if (!path || !path.waypoints || path.waypoints.length < 2) continue;
        const pts = samplePath(path.waypoints);
        const w = path.width || 45;
        // dark soft outline like drawPaths
        r.strokePath(pts, w + 10, [0, 0, 0], 0.22);
        // dirt fill
        const dirt = map.theme === 'neon' ? [96, 100, 112] : [168, 130, 90];
        r.strokePath(pts, w, dirt);
        // subtle texture on the road
        r.strokePath(pts, w * 0.7, [184, 146, 104], 0.35);
    }
}

function paintWater(r, map) {
    for (const brush of map.waterBrushes || []) {
        if (!brush || !brush.points || brush.points.length === 0) continue;
        const color = brush.color || '#3498db';
        const c = hex(color);
        // soft darker bed under the water
        r.strokePath(brush.points, (brush.thickness || 60) + 14, [0, 0, 0], 0.25);
        r.strokePath(brush.points, brush.thickness || 60, c);
        // sparkle
        if (brush.points.length === 1) {
            r.fillCircle(brush.points[0].x, brush.points[0].y, (brush.thickness || 60) / 2, [255, 255, 255], 0.25);
        }
    }
}

function hex(hx) {
    return [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)];
}

function paintDecor(r, prop, theme, rng) {
    if (!prop || !prop.decor) return;
    const x = prop.x, y = prop.y;
    switch (prop.decor) {
        case 'tree': {
            r.fillRect(x - 4, y, 8, 18, [92, 64, 44]);
            r.fillCircle(x, y - 6, prop.r || 20, [54, 96, 48]);
            r.fillCircle(x - 10, y + 4, 12, [64, 108, 56]);
            r.fillCircle(x + 10, y + 4, 12, [64, 108, 56]);
            break;
        }
        case 'palm': {
            r.fillRect(x - 3, y, 6, 24, [140, 105, 60]);
            r.strokeLine(x, y, x + 14, y - 20, 4, [120, 88, 52]);
            for (let i = 0; i < 6; i++) {
                const ang = -Math.PI / 2 + (i - 2.5) * 0.55;
                const fx = x + 14 + Math.cos(ang) * 18;
                const fy = y - 20 + Math.sin(ang) * 18;
                r.fillEllipse(fx, fy, 9, 4, [44, 128, 52]);
            }
            r.fillEllipse(x, y - 22, 5, 5, [90, 70, 40]);
            break;
        }
        case 'rock': {
            const rr = prop.r || 16;
            r.fillEllipse(x, y + rr * 0.3, rr * 1.15, rr * 0.7, [0, 0, 0], 0.22);
            r.fillEllipse(x, y, rr, rr * 0.85, [120, 122, 126]);
            r.fillEllipse(x - rr * 0.3, y - rr * 0.3, rr * 0.45, rr * 0.35, [150, 152, 156]);
            break;
        }
        case 'bush': {
            const rr = prop.r || 14;
            r.fillCircle(x, y + 6, rr * 0.8, [66, 128, 56]);
            r.fillCircle(x - rr * 0.6, y, rr * 0.7, [58, 118, 50]);
            r.fillCircle(x + rr * 0.6, y, rr * 0.7, [60, 122, 52]);
            r.fillCircle(x, y - rr * 0.4, rr * 0.75, [72, 138, 60]);
            break;
        }
        case 'hedge': {
            const rr = prop.r || 20;
            r.fillEllipse(x, y + 8, rr * 1.5, rr * 0.8, [0, 0, 0], 0.25);
            r.fillCircle(x - rr, y, rr, [42, 96, 40]);
            r.fillCircle(x + rr, y, rr, [42, 96, 40]);
            r.fillCircle(x, y - rr * 0.5, rr * 1.1, [50, 110, 46]);
            r.fillCircle(x, y + rr * 0.6, rr * 0.9, [38, 88, 36]);
            break;
        }
        case 'cactus': {
            const hh = prop.r || 18;
            r.fillRect(x - 6, y - hh, 12, hh + 6, [50, 118, 62]);
            r.fillRect(x - 16, y - hh * 0.5, 6, 14, [50, 118, 62]);
            r.fillRect(x - 18, y - hh * 0.8, 8, 6, [50, 118, 62]);
            r.fillRect(x + 10, y - hh * 0.6, 6, 14, [50, 118, 62]);
            r.fillRect(x + 11, y - hh * 0.9, 8, 6, [50, 118, 62]);
            r.fillRect(x - 4, y - hh - 2, 2, 4, [150, 200, 150]);
            break;
        }
        case 'building': {
            const w = prop.w || 80, h = prop.h || 80;
            r.fillRect(x - w / 2, y - h / 2, w, h, [180, 184, 192]);
            r.fillRect(x - w / 2, y - h / 2, w, 6, [140, 144, 152]);
            for (let gy = -h / 2 + 14; gy < h / 2 - 8; gy += 16) {
                for (let gx = -w / 2 + 8; gx < w / 2 - 8; gx += 14) {
                    r.fillRect(x + gx, y + gy, 7, 9, [210, 216, 224]);
                }
            }
            break;
        }
        case 'fountain': {
            const rr = prop.r || 30;
            r.fillCircle(x, y + 8, rr * 1.3, [160, 164, 172]);
            r.fillCircle(x, y, rr, [120, 190, 230]);
            r.fillCircle(x, y - rr * 0.4, rr * 0.4, [170, 220, 245]);
            r.fillCircle(x, y, rr, [0, 0, 0], 0.15);
            break;
        }
        case 'lollipop': {
            const rr = prop.r || 18;
            r.strokeLine(x, y, x, y + 26, 5, [230, 230, 235]);
            r.fillCircle(x, y, rr, [255, 255, 255]);
            for (let i = 0; i < 3; i++) {
                const a0 = (i * 2) * Math.PI / 3;
                r.strokeLine(x, y, x + Math.cos(a0) * rr * 0.7, y + Math.sin(a0) * rr * 0.7, 5, [230, 120, 160], 0.8);
            }
            r.fillCircle(x, y, rr, [0, 0, 0], 0.12);
            break;
        }
        case 'gumdrop': {
            const rr = prop.r || 18;
            r.fillEllipse(x, y + 6, rr, rr * 0.5, [0, 0, 0], 0.22);
            r.fillEllipse(x, y - rr * 0.4, rr, rr * 0.95, [255, 170, 210]);
            r.fillEllipse(x, y - rr, rr * 0.75, rr * 0.6, [255, 200, 225]);
            break;
        }
        case 'pine': {
            const hh = prop.r || 20;
            r.fillRect(x - 3, y, 6, 14, [92, 64, 44]);
            const layers = 3;
            for (let i = 0; i < layers; i++) {
                const ww = (hh * 1.2) * (1 - i * 0.28);
                const yy = y - hh + i * hh * 0.62;
                r.fillPoly([
                    { x, y: yy - ww },
                    { x: x - ww, y: yy + ww * 0.4 },
                    { x: x + ww, y: yy + ww * 0.4 }
                ], [46, 108, 66]);
            }
            r.fillPoly([
                { x, y: y - hh * 1.7 },
                { x: x - hh * 0.4, y: y - hh * 0.8 },
                { x: x + hh * 0.4, y: y - hh * 0.8 }
            ], [70, 140, 88]);
            break;
        }
        case 'mushroom': {
            const rr = prop.r || 16;
            r.fillRect(x - 3, y, 6, 12, [230, 224, 210]);
            r.fillCircle(x, y - 4, rr, [214, 60, 72]);
            r.fillCircle(x - rr * 0.5, y - rr * 0.6, rr * 0.25, [255, 255, 255]);
            r.fillCircle(x + rr * 0.4, y - rr * 0.7, rr * 0.2, [255, 255, 255]);
            r.fillEllipse(x, y - rr * 1.1, rr * 0.7, rr * 0.4, [255, 220, 160], 0.5);
            break;
        }
        case 'neonBuilding': {
            const w = prop.w || 90, h = prop.h || 90;
            r.fillRect(x - w / 2, y - h / 2, w, h, [30, 33, 52]);
            r.fillRect(x - w / 2 - 3, y - h / 2 - 3, w + 6, h + 6, [140, 90, 230], 0.35);
            const cols = [[255, 60, 160], [80, 220, 255], [120, 255, 120]];
            for (let gy = -h / 2 + 12; gy < h / 2 - 8; gy += 16) {
                for (let gx = -w / 2 + 10; gx < w / 2 - 8; gx += 16) {
                    const c = cols[(((gx + gy) % 3) + 3) % 3];
                    r.fillRect(x + gx, y + gy, 7, 10, c, 0.9);
                }
            }
            break;
        }
    }
}

// ---------------------------------------------------------------------------
// Night variant: darken, blue-shift, add stars + glow.
// ---------------------------------------------------------------------------

function makeNight(r, map, rng) {
    const night = new Raster();
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            let rr = r.d[i], gg = r.d[i + 1], bb = r.d[i + 2];
            // cool dark shift
            rr = rr * 0.34; gg = gg * 0.38; bb = bb * 0.62;
            night.d[i] = rr; night.d[i + 1] = gg; night.d[i + 2] = bb; night.d[i + 3] = 255;
        }
    }
    // stars
    for (let s = 0; s < 220; s++) {
        const x = rng() * W, y = rng() * H * 0.55;
        const bright = 0.4 + rng() * 0.6;
        night.fillCircle(x, y, 1 + rng() * 1.6, [255, 255, 255], bright);
    }
    // keep water / lava / neon glowing
    paintWaterGlow(night, map);
    paintNeonGlow(night, map);
    return night;
}

function paintWaterGlow(night, map) {
    for (const brush of map.waterBrushes || []) {
        if (!brush || !brush.points) continue;
        const color = brush.color ? hex(brush.color) : [52, 152, 219];
        night.strokePath(brush.points, brush.thickness || 60, color, 0.55);
    }
}

function paintNeonGlow(night, map) {
    for (const prop of map.props || []) {
        if (prop.decor === 'neonBuilding') {
            const w = prop.w || 90, h = prop.h || 90;
            night.fillRect(prop.x - w / 2 - 4, prop.y - h / 2 - 4, w + 8, h + 8, [140, 90, 230], 0.5);
            night.fillRect(prop.x - w / 2, prop.y - h / 2, w, h, [20, 22, 38], 0.9);
        }
        if (prop.decor === 'mushroom') {
            night.fillCircle(prop.x, prop.y - 6, (prop.r || 16) * 1.4, [255, 220, 160], 0.18);
        }
        if (prop.decor === 'fountain') {
            night.fillCircle(prop.x, prop.y, (prop.r || 30) * 1.4, [120, 190, 230], 0.35);
        }
    }
}

// ---------------------------------------------------------------------------
// Build + write each map's day & night PNG.
// ---------------------------------------------------------------------------

let errors = 0;
for (const map of GeneratedMaps) {
    const seed = map.image.split('').reduce((a, ch) => a + ch.charCodeAt(0), 7);
    const rng = mulberry32(seed);
    const r = new Raster();

    paintGround(r, map.theme);
    paintNoise(r, map.theme, rng);

    // water bed first, then path so the road sits on top
    paintWater(r, map);
    paintPath(r, map);

    for (const prop of map.props || []) {
        paintDecor(r, prop, map.theme, rng);
    }

    const dayPng = encodePng(W, H, r.d);
    writeFileSync(join(OUT_DIR, `${map.image}.png`), dayPng);

    const night = makeNight(r, map, rng);
    const nightPng = encodePng(W, H, night.d);
    writeFileSync(join(OUT_DIR, `${map.image}_night.png`), nightPng);

    console.log(`wrote ${map.image}.png + ${map.image}_night.png (${(dayPng.length / 1024).toFixed(0)} KB / ${(nightPng.length / 1024).toFixed(0)} KB)`);
}

console.log(errors ? `finished with ${errors} error(s)` : 'done');
process.exit(errors ? 1 : 0);