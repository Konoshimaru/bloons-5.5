// js/benchmark/report.js
//
// Aggregates measured results into a display model, renders the results
// table, and exports CSV / JSON / Markdown.

import { computeStats } from './harness.js';
import { esc, fmtMs, fmt1, msColor, fpsColor } from './env.js';
import { splitBarHTML } from './charts.js';

// Combines one or more measurement passes (repeats) for a scenario into a
// single result row. Worst-case p95/p99/max across repeats; mean for the
// averages so a single hot repeat doesn't dominate.
export function aggregateResult(scenario, mode, passes, note = '') {
    const stats = passes.map((p) => computeStats(p.samples, p.simSamples, p.renderSamples, note)).filter(Boolean);
    if (!stats.length) return null;
    const mean = (key) => stats.reduce((a, s) => a + (s[key] ?? 0), 0) / stats.length;
    const worst = (key) => Math.max(...stats.map((s) => s[key] ?? 0));
    const r = stats[0];
    return {
        scenarioId: scenario.id,
        name: scenario.name,
        group: scenario.group,
        desc: scenario.desc,
        mode,
        repeats: stats.length,
        n: r.n,
        fps: mean('fps'),
        avg: mean('avg'),
        p50: mean('p50'),
        p90: mean('p90'),
        p95: worst('p95'),
        p99: worst('p99'),
        min: Math.min(...stats.map((s) => s.min)),
        max: worst('max'),
        std: mean('std'),
        over33Pct: mean('over33Pct'),
        over50Pct: mean('over50Pct'),
        simAvg: mean('simAvg'),
        renderAvg: mean('renderAvg'),
        simShare: mean('simShare'),
        renderShare: mean('renderShare'),
        note: r.note,
    };
}

export function renderResultsTable(tbody, results) {
    tbody.innerHTML = results.map((r, i) => {
        const budget = r.avg < 16.7 ? 'OK' : r.avg < 33.4 ? 'SLOW' : '★ BROKEN';
        return `<tr class="${budget === 'OK' ? 'row-ok' : budget === 'SLOW' ? 'row-warn' : 'row-bad'}">
            <td class="cell-idx">${i + 1}</td>
            <td class="cell-name">${esc(r.name)}<div class="cell-sub">${esc(r.mode)} · ${r.n} fr · ${r.repeats}×</div></td>
            <td class="cell-fps" style="color:${fpsColor(r.fps)}"><b>${fmt1(r.fps)}</b></td>
            <td class="cell-ms" style="color:${msColor(r.avg)}">${fmtMs(r.avg)}</td>
            <td class="cell-ms">${fmtMs(r.p50)}</td>
            <td class="cell-ms" style="color:${msColor(r.p95)}">${fmtMs(r.p95)}</td>
            <td class="cell-ms">${fmtMs(r.p99)}</td>
            <td class="cell-ms">${fmtMs(r.max)}</td>
            <td class="cell-split">${splitBarHTML(r.renderShare, r.simShare)}<div class="cell-sub">sim ${fmtMs(r.simAvg)} · rnd ${fmtMs(r.renderAvg)}</div></td>
            <td class="cell-pct" style="color:${r.over33Pct > 5 ? '#e74c3c' : '#2ecc71'}">${r.over33Pct.toFixed(1)}%</td>
            <td class="cell-badge">${budget}</td>
        </tr>`;
    }).join('');
    if (!results.length) tbody.innerHTML = `<tr><td colspan="11" class="cell-empty">No results yet — press Run.</td></tr>`;
}

// Comparison vs. a baseline (first OK result is used as baseline).
export function summaryLine(results) {
    if (!results.length) return 'No results.';
    const base = results.find((r) => r.avg < 16.7) || results[0];
    const parts = [];
    for (const r of results) {
        const ratio = r.avg / base.avg;
        parts.push(`${r.name}: ${ratio >= 1.2 ? '×' + ratio.toFixed(2) : '×' + ratio.toFixed(2)} of baseline`);
    }
    const slow = results.filter((r) => r.avg >= 33.4);
    const warn = results.filter((r) => r.avg >= 16.7 && r.avg < 33.4);
    let msg = `Baseline "${base.name}" (avg ${fmtMs(base.avg)}ms · ${fmt1(base.fps)} FPS).`;
    if (slow.length) msg += ` ${slow.length} broken scenario(s) ≥33.4ms: ${slow.map((r) => r.name).join(', ')}.`;
    if (warn.length) msg += ` ${warn.length} slow (16.7-33.4ms): ${warn.map((r) => r.name).join(', ')}.`;
    return msg;
}

export function toCSV(results) {
    const head = ['#', 'Scenario', 'Group', 'Mode', 'Frames', 'FPS', 'Avg(ms)', 'p50', 'p90', 'p95', 'p99', 'Min', 'Max', 'Std', 'Sim(ms)', 'Render(ms)', 'Sim%', 'Render%', '%>33ms', '%>50ms', 'Note'];
    const rows = results.map((r, i) => [
        i + 1, r.name, r.group, r.mode, r.n,
        r.fps.toFixed(2), r.avg.toFixed(3), r.p50.toFixed(3), r.p90.toFixed(3), r.p95.toFixed(3),
        r.p99.toFixed(3), r.min.toFixed(3), r.max.toFixed(3), r.std.toFixed(3),
        (r.simAvg ?? 0).toFixed(3), (r.renderAvg ?? 0).toFixed(3),
        r.simShare.toFixed(1), r.renderShare.toFixed(1),
        r.over33Pct.toFixed(1), r.over50Pct.toFixed(1), r.note,
    ]);
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    return [head, ...rows].map((row) => row.map(q).join(',')).join('\n');
}

export function toMarkdown(results) {
    const head = ['Scenario', 'Mode', 'FPS', 'Avg', 'p95', 'p99', 'Max', 'Sim', 'Render'];
    const lines = [
        '| ' + head.join(' | ') + ' |',
        '|' + head.map(() => '---|').join(''),
        ...results.map((r) => `| ${r.name} | ${r.mode} | ${fmt1(r.fps)} | ${fmtMs(r.avg)} | ${fmtMs(r.p95)} | ${fmtMs(r.p99)} | ${fmtMs(r.max)} | ${fmtMs(r.simAvg)} | ${fmtMs(r.renderAvg)} |`),
    ];
    return lines.join('\n');
}

export function toJSON(results) {
    return JSON.stringify(results, null, 2);
}

export function download(filename, content, mime = 'text/plain') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}
