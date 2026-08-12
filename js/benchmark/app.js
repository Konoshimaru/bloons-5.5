// js/benchmark/app.js
//
// Orchestration + DOM wiring for benchmark.html. Boots the engine (WebGL),
// preloads sprites, exposes the scenario checklist with per-scenario params,
// runs the selected scenarios in burst or vsync mode, and pushes results
// into the table/charts. Also wires the interactive toolbox.

import { GameEngine } from '../engine.js';
import { PixiRenderer } from '../webgl/pixiRenderer.js';
import { boot, preloadAssets, resetScene, ctx, DT, DEFAULT_WARMUP, measureBurst, measureVsync, computeStats } from './harness.js';
import { SCENARIOS, SCENARIO_GROUPS } from './scenarios.js';
import { gpuInfo, memoryInfo } from './probes.js';
import { drawFpsGauge, drawLineChart, drawHistogram } from './charts.js';
import { aggregateResult, renderResultsTable, summaryLine, toCSV, toJSON, toMarkdown, download } from './report.js';
import * as toolbox from './toolbox.js';
import { $, $$, el, sleep, esc, fmt1, fmtMs } from './env.js';

const state = {
    booted: false,
    running: false,
    stop: false,
    enabled: new Set(SCENARIOS.map((s) => s.id)),
    overrides: {},
    results: [],
    lastSamples: null,
};

// --- Boot ---------------------------------------------------------------

async function init() {
    const status = el('status');
    try {
        setStatus('Booting engine…', 'pending');
        await boot();
        setStatus('Preloading sprites…', 'pending');
        await preloadAssets(progressInto('progress-fill'));
        setStatus('Ready', 'ok');
        state.booted = true;

        renderGpuPanel();
        buildScenarioList();
        loadPreset();
        applyToolboxState();
        wireEvents();
        renderResultsTable(el('results-tbody'), []);
        log(`Booting took ${fmt1(performance.now() - bootStart)}ms. GPU: ${el('gpu-name').textContent}`);
    } catch (err) {
        setStatus('Boot failed', 'bad');
        log(`FATAL: ${err.message}`);
        console.error(err);
    }
}

let bootStart = performance.now();

function progressInto(id) {
    const fill = el(id);
    return (p) => { fill.style.width = `${Math.round(p * 100)}%`; };
}

function setStatus(text, cls) {
    const s = el('status');
    s.textContent = text;
    s.className = `pill ${cls || ''}`;
}

function log(msg, cls = '') {
    const out = el('log');
    const line = document.createElement('div');
    line.className = cls;
    line.textContent = `[${new Date().toTimeString().slice(0, 8)}] ${msg}`;
    out.appendChild(line);
    while (out.children.length > 500) out.removeChild(out.firstChild);
    console.log('[bench]', msg);
}

// --- Scenario list UI ---------------------------------------------------

function buildScenarioList() {
    const wrap = el('scenario-list');
    wrap.innerHTML = '';
    for (const group of SCENARIO_GROUPS) {
        const groupScenarios = SCENARIOS.filter((s) => s.group === group);
        if (!groupScenarios.length) continue;
        const section = document.createElement('section');
        section.className = 'scenario-group';
        section.innerHTML = `<h3>${esc(group)}</h3>`;
        for (const sc of groupScenarios) {
            const row = document.createElement('label');
            row.className = 'scenario-row';
            let paramsHtml = '';
            if (sc.paramDefs.length) {
                paramsHtml = `<div class="scenario-params">` + sc.paramDefs.map((pd) => `
                    <span class="param">
                        <span>${esc(pd.label)}</span>
                        <input type="number" data-param="${esc(pd.key)}" min="${pd.min}" max="${pd.max}" step="${pd.step}" value="${sc.params[pd.key]}">
                    </span>`).join('') + `</div>`;
            }
            row.innerHTML = `
                <input type="checkbox" data-scenario="${esc(sc.id)}" ${state.enabled.has(sc.id) ? 'checked' : ''}>
                <div class="scenario-main">
                    <div class="scenario-title">
                        <span class="scenario-name">${esc(sc.name)}</span>
                        <span class="scenario-tag ${sc.sim ? 'tag-sim' : 'tag-render'}">${sc.sim ? 'sim' : 'render'}</span>
                    </div>
                    <div class="scenario-desc">${esc(sc.desc)}</div>
                    ${paramsHtml}
                </div>`;
            wrap.appendChild(section);
            section.appendChild(row);
        }
    }
    // read param overrides back into state on change
    $$('[data-param]', wrap).forEach((inp) => {
        inp.addEventListener('input', () => {
            const sc = inp.closest('.scenario-row');
            const id = sc?.querySelector('input[data-scenario]')?.dataset.scenario;
            if (!id) return;
            state.overrides[id] = state.overrides[id] || {};
            state.overrides[id][inp.dataset.param] = parseFloat(inp.value);
        });
    });
    $$('input[data-scenario]', wrap).forEach((cb) => {
        cb.addEventListener('change', () => {
            if (cb.checked) state.enabled.add(cb.dataset.scenario);
            else state.enabled.delete(cb.dataset.scenario);
        });
    });
}

function scenarioParams(sc) {
    const P = { ...sc.params };
    const o = state.overrides[sc.id];
    if (o) for (const k of Object.keys(P)) if (o[k] != null) P[k] = o[k];
    return P;
}

// --- Presets ------------------------------------------------------------

function savePreset() {
    const preset = { enabled: Array.from(state.enabled), params: state.overrides };
    localStorage.setItem('btd_benchmark_preset', JSON.stringify(preset));
    log('Preset saved.');
}

function loadPreset() {
    try {
        const raw = localStorage.getItem('btd_benchmark_preset');
        if (!raw) return;
        const p = JSON.parse(raw);
        if (Array.isArray(p.enabled)) {
            state.enabled = new Set(p.enabled);
            $$('input[data-scenario]').forEach((cb) => { cb.checked = state.enabled.has(cb.dataset.scenario); });
        }
        if (p.params) {
            state.overrides = p.params;
            $$('input[data-param]').forEach((inp) => {
                const sc = inp.closest('.scenario-row');
                const id = sc?.querySelector('input[data-scenario]')?.dataset.scenario;
                const v = p.params?.[id]?.[inp.dataset.param];
                if (v != null) inp.value = v;
            });
        }
    } catch (e) { /* corrupt preset, ignore */ }
}

// --- GPU / diagnostics panels -------------------------------------------

function renderGpuPanel() {
    const info = gpuInfo();
    el('gpu-name').textContent = info.gpu;
    const rows = [
        ['Renderer', info.rendererType],
        ['Backend', info.rendererBackend],
        ['GL', info.glVersion],
        ['GPU', info.gpu],
        ['Vendor', info.vendor],
        ['Canvas', info.canvas],
        ['DPR', info.dpr],
        ['Antialias', info.antialias],
        ['Max tex size', info.maxTextureSize],
        ['Max tex units', info.maxTextureUnits],
    ];
    el('gpu-rows').innerHTML = rows.map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join('');
}

function updateMemory() {
    const m = memoryInfo();
    const t = el('mem-used');
    if (!m) { t.textContent = 'heap n/a'; return; }
    t.textContent = `JS heap ${m.usedJS.toFixed(1)}MB / ${m.limitJS.toFixed(0)}MB`;
}

// --- Running ------------------------------------------------------------

function readSettings() {
    const mode = el('run-mode').value;
    return {
        mode,
        frames: Math.max(30, parseInt(el('frames-input').value, 10) || 300),
        duration: Math.max(250, parseInt(el('duration-input').value, 10) || 2000),
        warmup: Math.max(0, parseInt(el('warmup-input').value, 10) || DEFAULT_WARMUP),
        repeats: Math.max(1, parseInt(el('repeats-input').value, 10) || 1),
        autoProbe: el('auto-probe').checked,
    };
}

function wireEvents() {
    el('btn-run').addEventListener('click', runBenchmark);
    el('btn-stop').addEventListener('click', () => { state.stop = true; });
    el('btn-select-all').addEventListener('click', () => {
        state.enabled = new Set(SCENARIOS.map((s) => s.id));
        $$('input[data-scenario]').forEach((cb) => { cb.checked = true; });
    });
    el('btn-deselect-all').addEventListener('click', () => {
        state.enabled.clear();
        $$('input[data-scenario]').forEach((cb) => { cb.checked = false; });
    });
    el('btn-save-preset').addEventListener('click', savePreset);
    el('btn-reset-preset').addEventListener('click', () => {
        localStorage.removeItem('btd_benchmark_preset');
        state.overrides = {};
        location.reload();
    });

    el('btn-csv').addEventListener('click', () => download(`benchmark_${stamp()}.csv`, toCSV(state.results), 'text/csv'));
    el('btn-json').addEventListener('click', () => download(`benchmark_${stamp()}.json`, toJSON(state.results), 'application/json'));
    el('btn-md').addEventListener('click', () => download(`benchmark_${stamp()}.md`, toMarkdown(state.results), 'text/markdown'));

    // toolbox
    const typeSel = el('tool-type');
    typeSel.innerHTML = toolbox.TOWER_CHOICES.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    el('btn-place').addEventListener('click', () => {
        const n = toolbox.placeTowers(typeSel.value, clampNum(el('tool-count').value, 1, 500));
        log(`Placed ${n} × ${typeSel.value}.`);
    });
    el('btn-bloons').addEventListener('click', () => {
        const n = toolbox.spawnBloons(clampNum(el('tool-tier').value, 1, 18), clampNum(el('tool-bloons').value, 1, 2000));
        log(`Spawned ${n} tier-${el('tool-tier').value} bloons.`);
    });
    el('btn-clear').addEventListener('click', () => {
        toolbox.clearScene();
        log('Scene cleared.');
        renderQuad();
    });
    el('btn-select1').addEventListener('click', () => {
        const ok = toolbox.selectFirstTower();
        log(ok ? 'Selected first tower (white glow active).' : 'No towers to select.');
        renderQuad();
    });
    el('btn-step').addEventListener('click', () => {
        if (state.running) return;
        toolbox.stepOnce();
        renderQuad();
    });
    el('btn-screenshot').addEventListener('click', () => toolbox.screenshot(el('gameCanvas')));

    el('tg-mipmaps').addEventListener('change', (e) => { toolbox.toggleMipmaps(e.target.checked); log(`Mipmaps → ${e.target.checked ? 'ON' : 'OFF'}.`); });
    el('tg-smoothing').addEventListener('change', (e) => { toolbox.toggleSmoothing(e.target.checked); log(`Smoothing → ${e.target.checked ? 'ON' : 'OFF'}.`); });
    el('tg-night').addEventListener('change', (e) => { toolbox.toggleNight(e.target.checked); log(`Night mode → ${e.target.checked ? 'ON' : 'OFF'}.`); });
    el('btn-probe').addEventListener('click', renderQuad);
}

function applyToolboxState() {
    el('tg-mipmaps').checked = true;
    el('tg-smoothing').checked = true;
    el('tg-night').checked = false;
}

function renderQuad() {
    const n = toolbox.renderQuadProbe(el('quad-tbody'));
    el('quad-count').textContent = `${n} sprite(s)`;
}

function clampNum(v, lo, hi) {
    const n = parseFloat(v);
    if (isNaN(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

async function runBenchmark() {
    if (!state.booted || state.running) return;
    const settings = readSettings();
    const targets = SCENARIOS.filter((s) => state.enabled.has(s.id));
    if (!targets.length) { log('No scenarios selected.'); return; }

    state.running = true;
    state.stop = false;
    state.results = [];
    el('btn-run').disabled = true;
    el('btn-stop').disabled = false;
    renderResultsTable(el('results-tbody'), []);
    log(`Run start · ${settings.mode} mode · ${targets.length} scenario(s)`);

    // mute console noise during timing if asked
    const silent = el('mute-console').checked;
    const saveConsole = { log: console.log, warn: console.warn, error: console.error };
    if (silent) {
        console.log = console.warn = console.error = () => {};
    }

    try {
        for (let s = 0; s < targets.length; s++) {
            if (state.stop) { log('Stopped.'); break; }
            const sc = targets[s];
            const P = scenarioParams(sc);
            setStatus(`#${s + 1}/${targets.length} ${sc.name}`, 'pending');
            el('progress-fill').style.width = '0%';
            log(`Running: ${sc.name} (${sc.sim ? 'sim' : 'render'})…`);

            resetScene();
            await sc.setup(ctx, P);

            // settle: let any lazily-triggered texture loads land off-timing
            for (let i = 0; i < 8; i++) {
                if (sc.sim) GameEngine.update(DT);
                PixiRenderer.render(GameEngine, DT);
            }
            await sleep(300);

            // run repeats
            const passes = [];
            for (let rep = 0; rep < settings.repeats; rep++) {
                if (state.stop) break;
                let measure;
                if (settings.mode === 'vsync') {
                    measure = await measureVsync({
                        durationMs: settings.duration,
                        maxFrames: 99999,
                        warmup: settings.warmup,
                        sim: sc.sim,
                        step: sc.step,
                        post: sc.post,
                        shouldStop: () => state.stop,
                        onFrame: (i, ft, st, rt) => onLiveFrame(i, ft),
                    });
                } else {
                    measure = measureBurst({
                        frames: settings.frames,
                        warmup: settings.warmup,
                        sim: sc.sim,
                        step: sc.step,
                        post: sc.post,
                        shouldStop: () => state.stop,
                        onFrame: (i, ft) => { if (i % 64 === 0) { el('progress-fill').style.width = `${Math.min(100, Math.round((i / settings.frames) * 100))}%`; } },
                    });
                }
                if (measure.samples.length) passes.push(measure);
                if (measure.samples.length && settings.mode === 'burst') {
                    state.lastSamples = measure.samples;
                }
            }

            if (!passes.length) { log(`No samples for ${sc.name} (stopped?).`); continue; }
            const result = aggregateResult(sc, settings.mode, passes);
            if (!result) continue;
            state.results.push(result);
            renderResultsTable(el('results-tbody'), state.results);
            el('last-line').textContent = summaryLine(state.results);
            updateMemory();
            if (settings.autoProbe && sc.sim) renderQuad();

            // charts from the last completed pass
            if (passes[0]) {
                const st = computeStats(passes[0].samples, passes[0].simSamples, passes[0].renderSamples);
                if (st) drawFpsGauge(el('fps-gauge'), st.fps);
                drawLineChart(el('line-chart'), passes[0].samples);
                drawHistogram(el('hist-chart'), passes[0].samples);
            }
            log(`  avg ${fmtMs(result.avg)}ms · ${fmt1(result.fps)} FPS · p95 ${fmtMs(result.p95)} · render ${fmtMs(result.renderAvg)} / sim ${fmtMs(result.simAvg)}`);
            el('progress-fill').style.width = `${Math.round(((s + 1) / targets.length) * 100)}%`;
        }
    } finally {
        if (silent) Object.assign(console, saveConsole);
        state.running = false;
        el('btn-run').disabled = false;
        el('btn-stop').disabled = true;
        setStatus(state.results.length ? 'Done' : 'Idle', state.results.length ? 'ok' : '');
        el('last-line').textContent = summaryLine(state.results);
        el('progress-fill').style.width = '100%';
    }
}

// Live frame hook for vsync mode (charts animate in real time).
function onLiveFrame(i, frameMs) {
    if (frameMs > 0) {
        const fps = 1000 / frameMs;
        drawFpsGauge(el('fps-gauge'), fps);
    }
}

init();
