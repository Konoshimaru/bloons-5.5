// js/benchmark/harness.js
//
// Boot + measurement core for the WebGL benchmark. The real game boots the
// PixiJS renderer from inside GameEngine.init(); we let it do that, then
// cancel the engine's own requestAnimationFrame loop and take over the
// per-frame update/render calls ourselves so we can time them separately.
//
// Two measurement modes:
//   * burst  — N synchronous update/render iterations back-to-back with no
//              vsync gate. Reports the raw CPU/GPU cost per frame (this is
//              what exposes the sniper's ~50ms frame even on a 60Hz display).
//   * vsync  — real requestAnimationFrame pacing. Reports wall-clock FPS
//              including v-sync, browser compositing and long-task stutter.

import { Config } from '../config.js';
import { GameEngine } from '../engine.js';
import { GameMap } from '../map.js';
import { Tower } from '../tower.js';
import { WaveManager } from '../waveManager.js';
import { SpatialGrid } from '../spatialGrid.js';
import { TowerStats } from '../towers/index.js';
import { Maps } from '../data.js';
import { PixiRenderer } from '../webgl/pixiRenderer.js';
import { PixiAssets } from '../webgl/pixiAssets.js';
import { waitFor } from './env.js';

export const DT = 0.016;          // fixed timestep (matches FIXED_TIMESTEP in engine.js)
export const DEFAULT_WARMUP = 5;  // untimed frames after scene setup (texture/first-use warm)

export const ctx = {
    engine: null,
    sim: true,
    params: {},
};

// --- Boot ---------------------------------------------------------------

// Boots the engine (WebGL only), waits for the Pixi renderer to come up,
// then stops the game's own loop so the harness owns every frame.
export async function boot() {
    Config.load();
    GameEngine.init();
    if (GameEngine._rafId) { cancelAnimationFrame(GameEngine._rafId); GameEngine._rafId = null; }
    await waitFor(() => GameEngine._pixiRenderer, 15000);
    if (!GameEngine._pixiRenderer) throw new Error('PixiRenderer failed to initialize (WebGL unavailable?)');
    GameEngine.useWebGL = true;
    GameEngine.rendererName = 'WebGL';
    prepareState();
    ctx.engine = GameEngine;
    return GameEngine;
}

export function prepareState() {
    const e = GameEngine;
    e.difficulty = {
        name: 'Benchmark', lives: 999999, cash: 1000000000, costMod: 1,
        speedMod: 1, startRound: 1, maxRound: 40, hpMod: 1,
        noIncome: false, incomeMult: 1,
    };
    e.gameState = 'playing';
    e.map = new GameMap(0);
    e.waveManager = new WaveManager();
    e.waveManager.autoWaveEnabled = false;
    e.waveManager.currentWave = 0;
    e.timeScale = 1;
    e.selectedPlacedTower = null;
    e.isNight = false;
    e.nightAlpha = 0;
}

// Preloads every sprite the scenarios touch so the first measured frame isn't
// skewed by lazy texture loads (PixiAssets returns Texture.EMPTY until the
// asset arrives, which would make the first frames artificially cheap).
export async function preloadAssets(onProgress) {
    PixiRenderer._preloadSprites(); // kicks off the standard set idempotently
    const keys = new Set();
    for (const type of Object.keys(TowerStats)) {
        keys.add(`tower_${type}_base`);
        keys.add(`tower_${type}_arm`);
    }
    const enemyNames = ['red', 'blue', 'green', 'yellow', 'pink', 'black', 'white', 'lead', 'zebra', 'purple', 'rainbow', 'ceramic', 'moab', 'bfb', 'zomg', 'ddt', 'bad'];
    for (const name of enemyNames) {
        keys.add(`enemy_${name}`); keys.add(`enemy_${name}_camo`);
        keys.add(`enemy_${name}_regen`); keys.add(`enemy_${name}_regen_camo`);
    }
    for (const name of ['ceramic', 'moab', 'bfb', 'zomg', 'ddt', 'bad']) {
        for (let s = 1; s <= 3; s++) keys.add(`enemy_${name}_${s}`);
    }
    keys.add('effect_pop'); keys.add('effect_pop2'); keys.add('effect_pop3');
    // The full-body attack frames for the towers the diagnostic scenarios
    // force into attack animation (the tall 507x1665 sniper sprites).
    for (let i = 0; i <= 22; i++) keys.add(`tower_sniper_attack_full_${i}`);
    for (let i = 0; i <= 14; i++) keys.add(`effect_slash_${i}`);
    for (let i = 0; i <= 14; i++) keys.add(`effect_stun_${i}`);
    for (const mapData of Maps) {
        if (!mapData || !mapData.image) continue;
        keys.add(`map_${mapData.image}`);
        keys.add(mapData.imageNight ? `map_${mapData.imageNight}` : `map_${mapData.image}_night`);
    }
    await PixiAssets.preloadManifest(Array.from(keys), onProgress);
}

// --- Scene helpers ------------------------------------------------------

// Clears every entity/pool/spawned-sprite so a scenario starts from a blank
// slate. Sprite container maps are left intact; the renderers' per-frame
// diff (destroy-unseen) reclaims stale containers on the first render.
export function resetScene() {
    const e = GameEngine;
    e.towers.length = 0;
    e.enemies.length = 0;
    e.beasts.length = 0;
    e.sentries.length = 0;
    e.explosions.length = 0;
    e.floatingTexts.length = 0;
    e.acidPools.length = 0;
    e.projectilePool.clear();
    e.particlePool.clear();
    e.enemyPool.clear();
    e.selectedPlacedTower = null;
    e.enemyGrid = new SpatialGrid(80);
    e.towerGrid = new SpatialGrid(80);
    e.lives = 999999;
    e.gameState = 'playing';
    e.isNight = false;
    e.nightAlpha = 0;
    e.waveManager = new WaveManager();
    e.waveManager.autoWaveEnabled = false;
    e.waveManager.currentWave = 0;
}

export function placeTower(type, x, y, upgrades = null, opts = {}) {
    const t = new Tower(x, y, type);
    if (upgrades) { t.upgrades = upgrades.slice(); t._recalculateStats(); }
    if (opts.isFullAnim) { t.isFullAnim = true; t.attackAnimActive = true; t.attackAnimFrame = 0; }
    GameEngine.towers.push(t);
    return t;
}

// Spawns a bloon from the engine pool. init() positions it at the start of
// path `pathIndex`; pass override coords to place it anywhere afterwards.
export function spawnEnemy(tier, x = null, y = null, pathIndex = 0) {
    const e = GameEngine.enemyPool.get();
    e.init(tier, GameEngine.map, false, false, tier, false, 1.0, pathIndex);
    if (x != null && y != null) { e.x = x; e.y = y; e.distanceTraveled = 0; }
    GameEngine.enemies.push(e);
    return e;
}

// Grid of evenly spaced positions centered on (cx, cy).
export function gridPoints(count, cx = 640, cy = 360, cols = null, spacing = 80) {
    const n = Math.max(1, count);
    const c = cols || Math.max(1, Math.ceil(Math.sqrt(n)));
    const rows = Math.ceil(n / c);
    const pts = [];
    for (let i = 0; i < n; i++) {
        const r = Math.floor(i / c), col = i % c;
        pts.push([
            cx + (col - (c - 1) / 2) * spacing,
            cy + (r - (rows - 1) / 2) * spacing,
        ]);
    }
    return pts;
}

// --- Statistics ---------------------------------------------------------

export function computeStats(samples, simSamples = null, renderSamples = null, note = '') {
    const n = samples.length;
    if (!n) return null;
    let sum = 0, min = Infinity, max = -Infinity;
    for (const v of samples) { sum += v; if (v < min) min = v; if (v > max) max = v; }
    const avg = sum / n;
    let variance = 0;
    for (const v of samples) variance += (v - avg) ** 2;
    const sorted = Array.from(samples).sort((a, b) => a - b);
    const pct = (p) => sorted[Math.max(0, Math.min(n - 1, Math.floor(p * (n - 1))))];
    let over33 = 0, over50 = 0;
    for (const v of samples) { if (v > 33.3) over33++; if (v > 50) over50++; }
    const mean = (arr) => (arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
    return {
        n,
        avg, min, max, std: Math.sqrt(variance / n),
        p50: pct(0.50), p90: pct(0.90), p95: pct(0.95), p99: pct(0.99),
        over33, over50, over33Pct: (over33 / n) * 100, over50Pct: (over50 / n) * 100,
        fps: n / (sum / 1000),
        simAvg: mean(simSamples), renderAvg: mean(renderSamples),
        simShare: mean(simSamples) != null ? (mean(simSamples) / Math.max(1e-9, avg)) * 100 : 0,
        renderShare: mean(renderSamples) != null ? (mean(renderSamples) / Math.max(1e-9, avg)) * 100 : 100,
        note,
    };
}

// --- Measurement --------------------------------------------------------

function withStep(step, post, i) {
    if (step) step(ctx, i);
    if (post) post(ctx, i);
}

// Burst mode: synchronous frames, no vsync. Returns raw arrays of frame /
// sim / render times (Float64Array) plus totals.
export function measureBurst({ frames, warmup = DEFAULT_WARMUP, sim = true, step = null, post = null, onFrame = null, shouldStop = null }) {
    const e = GameEngine;
    ctx.sim = sim;
    const total = frames + warmup;
    const samples = new Float64Array(frames);
    const simSamples = sim ? new Float64Array(frames) : null;
    const renderSamples = new Float64Array(frames);
    let f = 0;
    for (let i = 0; i < total; i++) {
        if (shouldStop && shouldStop()) break;
        if (sim) {
            if (step) step(ctx, i);
            const s0 = performance.now();
            e.update(DT);
            const s1 = performance.now();
            if (post) post(ctx, i);
            const r0 = performance.now();
            PixiRenderer.render(e, DT);
            const r1 = performance.now();
            if (i >= warmup) {
                const idx = f++;
                samples[idx] = r1 - s0;
                simSamples[idx] = s1 - s0;
                renderSamples[idx] = r1 - r0;
                if (onFrame) onFrame(idx + 1, r1 - s0, s1 - s0, r1 - r0);
            }
        } else {
            if (step) step(ctx, i);
            const r0 = performance.now();
            PixiRenderer.render(e, DT);
            const r1 = performance.now();
            if (i >= warmup) {
                const idx = f++;
                samples[idx] = r1 - r0;
                renderSamples[idx] = r1 - r0;
                if (onFrame) onFrame(idx + 1, r1 - r0, 0, r1 - r0);
            }
        }
    }
    return { samples: samples.subarray(0, f), simSamples: simSamples ? simSamples.subarray(0, f) : null, renderSamples: renderSamples.subarray(0, f) };
}

// Vsync mode: real requestAnimationFrame pacing for `durationMs` (or
// maxFrames), with a short untimed warmup. Returns plain arrays + elapsed.
export async function measureVsync({ durationMs = 2000, maxFrames = 3000, warmup = DEFAULT_WARMUP, sim = true, step = null, post = null, onFrame = null, shouldStop = null }) {
    const e = GameEngine;
    ctx.sim = sim;
    return new Promise((resolve) => {
        const samples = [], simSamples = [], renderSamples = [];
        let warm = 0, f = 0;
        const started = performance.now();
        const tick = () => {
            if (shouldStop && shouldStop()) return resolve({ samples, simSamples, renderSamples, elapsed: performance.now() - started });
            const elapsed = performance.now() - started;
            const record = warm >= warmup;
            if (record && (elapsed >= durationMs || f >= maxFrames)) return resolve({ samples, simSamples, renderSamples, elapsed });
            const frameStart = performance.now();
            let s0 = 0, s1 = 0, r0 = 0, r1 = 0;
            if (sim) {
                if (step) step(ctx, f);
                s0 = performance.now();
                e.update(DT);
                s1 = performance.now();
                if (post) post(ctx, f);
                r0 = performance.now();
                PixiRenderer.render(e, DT);
                r1 = performance.now();
            } else {
                if (step) step(ctx, f);
                r0 = performance.now();
                PixiRenderer.render(e, DT);
                r1 = performance.now();
            }
            const frameEnd = performance.now();
            if (record) {
                samples.push(frameEnd - frameStart);
                if (sim) simSamples.push(s1 - s0);
                renderSamples.push(r1 - r0);
                f++;
                if (onFrame) onFrame(f, frameEnd - frameStart, sim ? s1 - s0 : 0, r1 - r0);
            } else {
                warm++;
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
}
