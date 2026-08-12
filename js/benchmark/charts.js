// js/benchmark/charts.js
//
// Canvas2D chart renderers for the benchmark dashboard. Everything is drawn
// on demand (no animation loop) — call render*() whenever new data lands.

import { fmt1 } from './env.js';

const W = 16.7, R30 = 33.3; // reference frame budgets (60/30 fps)

function prep(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 100;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    return { g, w, h };
}

// Frame-time line chart with budget gridlines at 16.7/33.3 ms.
export function drawLineChart(canvas, samples, label = 'frame ms') {
    if (!canvas) return;
    const { g, w, h } = prep(canvas);
    const padL = 30, padB = 14, padT = 6;
    const plotW = w - padL - 6, plotH = h - padT - padB;
    const maxMs = Math.max(16.7, ...(samples || []), 0);
    const yFor = (ms) => padT + plotH - (ms / maxMs) * plotH;
    const n = samples?.length || 0;

    // gridlines
    g.strokeStyle = '#2a2f3a'; g.fillStyle = '#5b6472'; g.font = '9px ui-monospace, monospace'; g.lineWidth = 1;
    for (const [label, ms] of [['60fps', W], ['30fps', R30]]) {
        const y = yFor(ms);
        g.setLineDash([3, 3]); g.beginPath(); g.moveTo(padL, y); g.lineTo(w - 4, y); g.stroke(); g.setLineDash([]);
        g.fillText(label, 2, y + 3);
    }
    g.fillText('0', 2, padT + plotH + 3);

    if (n < 2) return;
    // budget bands
    const band = (lo, hi, color) => {
        g.fillStyle = color;
        g.fillRect(padL, yFor(hi), plotW, yFor(lo) - yFor(hi));
    };
    band(R30, maxMs, 'rgba(231,76,60,0.08)');
    band(W, R30, 'rgba(230,126,34,0.06)');

    // polyline
    g.beginPath();
    for (let i = 0; i < n; i++) {
        const x = padL + (i / (n - 1)) * plotW;
        const y = yFor(samples[i]);
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.strokeStyle = '#4dabf7'; g.lineWidth = 1.2;
    g.stroke();

    // max marker
    let maxV = -Infinity, maxI = 0;
    for (let i = 0; i < n; i++) if (samples[i] > maxV) { maxV = samples[i]; maxI = i; }
    const mx = padL + (maxI / (n - 1)) * plotW;
    g.fillStyle = '#e74c3c';
    g.beginPath(); g.arc(mx, yFor(maxV), 2.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff9a8b'; g.font = '9px ui-monospace, monospace';
    g.fillText(`${fmt1(maxV)}ms`, mx + 4, Math.max(8, yFor(maxV) - 3));
    g.fillStyle = '#5b6472';
    g.fillText(`avg ${fmt1(mean(samples))}ms · n=${n}`, padL, h - 3);
}

// Frame-time histogram with buckets aligned to the budget lines.
export function drawHistogram(canvas, samples) {
    if (!canvas) return;
    const { g, w, h } = prep(canvas);
    const buckets = [0, 8, 16.7, 25, 33.3, 50, 100, Infinity];
    const labels = ['<8', '8-17', '17-25', '25-33', '33-50', '50-100', '>100'];
    const counts = new Array(buckets.length).fill(0);
    for (const s of (samples || [])) {
        for (let b = 0; b < buckets.length; b++) if (s < buckets[b]) { counts[b]++; break; }
    }
    const n = samples?.length || 0;
    const maxC = Math.max(...counts, 1);
    const bw = (w - 10) / buckets.length;
    g.fillStyle = '#5b6472'; g.font = '9px ui-monospace, monospace'; g.textAlign = 'center';
    for (let b = 0; b < buckets.length; b++) {
        const bh = Math.max(2, (counts[b] / maxC) * (h - 20));
        const color = b <= 1 ? '#2ecc71' : b === 2 ? '#f1c40f' : b === 3 ? '#e67e22' : '#e74c3c';
        g.fillStyle = color;
        g.fillRect(5 + b * bw + 1, h - 14 - bh, bw - 2, bh);
        g.fillStyle = '#9aa3b0';
        g.fillText(labels[b], 5 + b * bw + bw / 2, h - 3);
    }
    if (n) { g.textAlign = 'left'; g.fillStyle = '#5b6472'; g.fillText(`${n} frames`, 6, 9); }
}

// Circular FPS gauge.
export function drawFpsGauge(canvas, fps) {
    if (!canvas) return;
    const { g, w, h } = prep(canvas);
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 8;
    const val = fps == null ? 0 : Math.min(120, Math.max(0, fps));
    const p = val / 120;
    const color = fps >= 55 ? '#2ecc71' : fps >= 40 ? '#f1c40f' : fps >= 30 ? '#e67e22' : '#e74c3c';
    g.lineWidth = 6; g.lineCap = 'round';
    g.strokeStyle = '#232733';
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = color;
    g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); g.stroke();
    g.fillStyle = '#e8ecf2'; g.font = 'bold 20px ui-monospace, monospace'; g.textAlign = 'center';
    g.fillText(fps == null ? '--' : fmt1(fps), cx, cy + 7);
    g.fillStyle = '#5b6472'; g.font = '9px ui-monospace, monospace';
    g.fillText('FPS', cx, cy + 20);
    g.textAlign = 'left';
}

// Tiny stacked sim/render split bar (returns HTML, not canvas).
export function splitBarHTML(shareRender, shareSim) {
    return `<div class="splitbar" title="render ${fmt1(shareRender)}% · sim ${fmt1(shareSim)}%">
        <div class="sb-render" style="width:${shareRender.toFixed(1)}%"></div>
        <div class="sb-sim" style="width:${shareSim.toFixed(1)}%"></div>
    </div>`;
}

function mean(arr) {
    if (!arr || !arr.length) return 0;
    let s = 0; for (const v of arr) s += v; return s / arr.length;
}
