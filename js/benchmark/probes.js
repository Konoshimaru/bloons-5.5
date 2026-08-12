// js/benchmark/probes.js
//
// Live diagnostic probes:
//   * GPU / WebGL capabilities (renderer name, vendor, limits)
//   * Per-tower rendered quad vs. source texture size — the direct probe for
//     the "tall sprite downscale" question (e.g. sniper_base 507×1665 →
//     ~53×175 on screen, aspect ~0.30).
//   * JS heap usage (Chromium-only via performance.memory).

import { PixiApp } from '../webgl/pixiApp.js';
import { PixiRenderer } from '../webgl/pixiRenderer.js';

export function gpuInfo() {
    const app = PixiApp.app;
    const gl = app?.renderer?.gl || null;
    const info = {
        rendererType: app?.renderer?.type ?? 'unknown',
        antialias: !!app?.renderer?.antialias,
        resolution: app?.renderer?.resolution ?? 1,
        dpr: window.devicePixelRatio || 1,
        canvas: app?.canvas ? `${app.canvas.width}×${app.canvas.height}` : 'n/a',
        glVersion: 'n/a', glShading: 'n/a', gpu: 'n/a', vendor: 'n/a',
        maxTextureSize: 'n/a', maxTextureUnits: 'n/a', rendererBackend: 'n/a',
    };
    if (gl) {
        try {
            info.glVersion = gl.getParameter(gl.VERSION);
            info.glShading = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
            const dbg = gl.getExtension('WEBGL_debug_renderer_info');
            if (dbg) {
                info.gpu = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
                info.vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);
            } else {
                info.gpu = gl.getParameter(gl.RENDERER) || 'n/a';
            }
            info.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            info.maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
        } catch (e) { /* some drivers restrict getParameter */ }
    }
    if (app?.renderer?.renderers) {
        try { info.rendererBackend = app.renderer.renderers[0]?.constructor?.name || 'n/a'; } catch (e) { /* noop */ }
    }
    return info;
}

// Reads the live tower sprite state straight out of the Pixi renderer.
export function towerQuadProbe() {
    const out = [];
    for (const [tower, entry] of PixiRenderer._towerSprites) {
        const base = entry?.base;
        const tex = base?.texture;
        const srcW = tex?.source?.width || tex?.width || 0;
        const srcH = tex?.source?.height || tex?.height || 0;
        const quadW = Math.round((base?.width || 0) * 10) / 10;
        const quadH = Math.round((base?.height || 0) * 10) / 10;
        const downscale = quadH > 0 ? srcH / quadH : 0;
        out.push({
            type: tower.type,
            upgrades: (tower.upgrades || [0, 0, 0]).join('-'),
            attacking: !!tower.attackAnimActive,
            srcW, srcH,
            quadW, quadH,
            scaleMode: tex?.source?.scaleMode || 'n/a',
            mipmaps: tex?.source?.autoGenerateMipmaps ?? 'n/a',
            aspect: srcH ? (srcW / srcH).toFixed(3) : 'n/a',
            downscale: Math.round(downscale * 10) / 10,
        });
    }
    out.sort((a, b) => b.srcW * b.srcH - a.srcW * a.srcH);
    return out;
}

// Chromium-only.
export function memoryInfo() {
    const m = performance.memory;
    if (!m) return null;
    return {
        usedJS: (m.usedJSHeapSize / 1048576),
        totalJS: (m.totalJSHeapSize / 1048576),
        limitJS: (m.jsHeapSizeLimit / 1048576),
    };
}
