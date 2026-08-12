// js/benchmark/toolbox.js
//
// Interactive live-scene tools for poking at the running renderer without
// the overhead of a full benchmark pass: drop towers/bloons, flip mipmaps /
// smoothing / night mode, step a single frame, screenshot, and inspect the
// rendered-vs-source quad sizes of every live tower sprite.

import { GameEngine } from '../engine.js';
import { PixiRenderer } from '../webgl/pixiRenderer.js';
import { PixiAssets } from '../webgl/pixiAssets.js';
import { Config } from '../config.js';
import { TowerStats } from '../towers/index.js';
import { placeTower, spawnEnemy, resetScene, gridPoints, DT } from './harness.js';
import { towerQuadProbe } from './probes.js';
import { esc, fmt1 } from './env.js';

export const TOWER_CHOICES = Object.keys(TowerStats).sort();

export function clearScene() {
    resetScene();
}

export function placeTowers(type, count, cx = 640, cy = 360) {
    const pts = gridPoints(count, cx, cy, Math.ceil(Math.sqrt(count)), 74);
    for (const [x, y] of pts) placeTower(type, x, y);
    return count;
}

export function spawnBloons(tier, count, cx = 640, cy = 360) {
    for (let i = 0; i < count; i++) {
        const en = spawnEnemy(tier, cx + ((i % 12) - 6) * 16, cy + (Math.floor(i / 12) - 1) * 18);
        en.distanceTraveled = 0;
    }
    return count;
}

export function selectFirstTower() {
    GameEngine.selectedPlacedTower = GameEngine.towers[0] || null;
    return GameEngine.selectedPlacedTower ? true : false;
}

export function toggleMipmaps(enabled) {
    PixiAssets.setMipmaps(enabled);
    return enabled;
}

export function toggleSmoothing(enabled) {
    PixiAssets.setSmoothing(enabled);
    return enabled;
}

export function toggleNight(enabled) {
    GameEngine.isNight = enabled;
    if (!enabled) GameEngine.nightAlpha = 0;
    return enabled;
}

export function stepOnce() {
    if (GameEngine.lives <= 0) { GameEngine.lives = 999999; GameEngine.gameState = 'playing'; }
    GameEngine.update(DT);
    PixiRenderer.render(GameEngine, DT);
}

export function screenshot(canvasEl) {
    const name = `benchmark_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    canvasEl.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, 'image/png');
}

export function renderQuadProbe(tbody) {
    const rows = towerQuadProbe();
    tbody.innerHTML = rows.map((r) => {
        const flagged = r.aspect !== 'n/a' && parseFloat(r.aspect) < 0.6;
        return `<tr class="${flagged ? 'row-warn' : ''}">
            <td>${esc(r.type)}${r.upgrades !== '0-0-0' ? ` <span class="cell-sub">u${esc(r.upgrades)}</span>` : ''}</td>
            <td>${r.srcW}×${r.srcH}</td>
            <td>${r.quadW}×${r.quadH}</td>
            <td>${r.aspect}</td>
            <td>×${r.downscale}</td>
            <td>${esc(r.scaleMode)}</td>
            <td>${r.mipmaps}</td>
            <td>${r.attacking ? '<span style="color:#f1c40f">anim</span>' : '—'}</td>
        </tr>`;
    }).join('');
    if (!rows.length) tbody.innerHTML = `<tr><td colspan="8" class="cell-empty">No towers in the scene.</td></tr>`;
    return rows.length;
}

export function applyMipmapLabel(state, mipEl, smEl) {
    // helper: mipEl/smEl are small text elements describing current state
    if (mipEl) mipEl.textContent = `mipmaps ${state ? 'ON' : 'OFF'}`;
    if (smEl) smEl.textContent = `smoothing ${Config.data.smoothingEnabled ? 'ON' : 'OFF'}`;
}
