// js/profiler.js
// Rolling-window profiler. Keeps the last N per-frame samples (frame/sim/render
// ms + entity counts), lets you capture an explicit session, and exports a
// structured report (percentiles, peaks, worst frames) that can be pasted to
// someone smarter for analysis.

export const Profiler = {
    enabled: true,
    // Ring buffer of per-frame samples, capped. 2400 frames ≈ 40s @ 60fps.
    buffer: [],
    maxSamples: 2400,
    // Session capture (start/stop via F3). Everything recorded while a capture
    // is live goes into `session` (unbounded) and into the report on export.
    capturing: false,
    session: [],
    sessionStart: 0,
    // Duration of the last finished session (seconds), frozen at stopCapture()
    // so reports don't keep growing after the capture ends.
    lastSessionSeconds: 0,

    _tick: 0,

    reset() {
        this.buffer.length = 0;
        this.session.length = 0;
        this.capturing = false;
        this.sessionStart = 0;
        this.lastSessionSeconds = 0;
    },

    startCapture() {
        this.capturing = true;
        this.session.length = 0;
        this.sessionStart = performance.now();
    },

    stopCapture() {
        this.capturing = false;
        this.lastSessionSeconds = this._sessionDuration();
        return this.lastSessionSeconds;
    },

    _sessionDuration() {
        return this.sessionStart ? (performance.now() - this.sessionStart) / 1000 : 0;
    },

    // The most recent finished session (if any) stays the report source until
    // the next capture or reset, so "F3 stop → F4 export" works as expected.
    _reportSamples() {
        if (this.session.length) return this.session;
        return this.buffer;
    },

    // Called once per frame from engine.loop() with the frame timing plus a
    // cheap snapshot of the scene (entity counts, wave, substeps).
    record(engine, timing) {
        if (!this.enabled) return;
        const t = timing || {};
        const s = {
            t: performance.now(),
            sim: t.sim || 0,
            render: t.render || 0,
            renderEnemies: t.renderEnemies || 0,
            stage: t.stage || 0,
            total: t.total || 0,
            steps: t.steps || 1,
            towers: engine.towers ? engine.towers.length : 0,
            enemies: engine.enemies ? engine.enemies.length : 0,
            projectiles: (engine.projectilePool && engine.projectilePool.active) ? engine.projectilePool.active.length : 0,
            particles: (engine.particlePool && engine.particlePool.active) ? engine.particlePool.active.length : 0,
            explosions: engine.explosions ? engine.explosions.length : 0,
            texts: engine.floatingTexts ? engine.floatingTexts.length : 0,
            wave: engine.waveManager ? engine.waveManager.currentWave : 0,
        };
        this.buffer.push(s);
        if (this.buffer.length > this.maxSamples) this.buffer.shift();
        if (this.capturing) this.session.push(s);
        this._tick++;
    },

    // ---------- Stats helpers ----------
    percentile(sorted, p) {
        if (!sorted.length) return 0;
        const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
        return sorted[Math.max(0, idx)];
    },

    // One metric (array of numbers) -> { min, avg, p50, p95, p99, max }
    _metric(values) {
        if (!values.length) return { min: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0 };
        const sorted = [...values].sort((a, b) => a - b);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const r2 = (v) => Math.round(v * 100) / 100;
        return {
            min: r2(sorted[0]),
            avg: r2(avg),
            p50: r2(this.percentile(sorted, 50)),
            p95: r2(this.percentile(sorted, 95)),
            p99: r2(this.percentile(sorted, 99)),
            max: r2(sorted[sorted.length - 1]),
        };
    },

    // ---------- Report ----------
    // Build the full export. `samples` is either the ring buffer or the active
    // session; engine provides the context snapshot (renderer, resolution,
    // tower grid stats, tower type counts, memory).
    buildReport(engine, samples) {
        if (!samples || !samples.length) return null;
        const fpsValues = samples.map(s => (s.total > 0 ? 1000 / s.total : 0));
        // Peak / worst entity loads across the window (what the sim actually
        // had to chew on) — often the true culprit behind slow frames.
        const peaks = {};
        for (const k of ['towers', 'enemies', 'projectiles', 'particles', 'explosions', 'texts']) {
            let max = 0, at = null;
            for (const s of samples) {
                if (s[k] > max) { max = s[k]; at = s; }
            }
            peaks[k] = max;
        }

        // Worst frames by sim time (the expensive part of our budget).
        const worst = [...samples]
            .map((s, i) => ({ ...s, idx: i }))
            .sort((a, b) => (b.sim + b.render) - (a.sim + a.render))
            .slice(0, 8);

        // Tower type breakdown at window end (or peak towers sample).
        const typeCounts = {};
        if (engine.towers) {
            for (const t of engine.towers) {
                if (!t) continue;
                const k = t.type || 'unknown';
                typeCounts[k] = (typeCounts[k] || 0) + 1;
            }
        }

        const towerGrid = engine.towerGrid ? engine.towerGrid.stats() : null;
        const enemyGrid = engine.enemyGrid ? engine.enemyGrid.stats() : null;

        const mem = (typeof performance !== 'undefined' && performance.memory) ? {
            usedJSHeapMB: Math.round(performance.memory.usedJSHeapSize / 1048576),
            totalJSHeapMB: Math.round(performance.memory.totalJSHeapSize / 1048576),
        } : null;

        const report = {
            meta: {
                generatedAt: new Date().toISOString(),
                renderer: engine.rendererName || (engine.useWebGL ? 'WebGL' : 'Canvas 2D'),
                resolution: engine.canvas ? { w: engine.canvas.width, h: engine.canvas.height } : null,
                dpr: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
                samples: samples.length,
                windowSeconds: Math.round(((samples[samples.length - 1].t - samples[0].t) / 1000) * 10) / 10,
                isSession: this.session.length > 0,
                sessionSeconds: Math.round((this.capturing ? this._sessionDuration() : this.lastSessionSeconds) * 10) / 10,
                gameState: engine.gameState,
                wave: engine.waveManager ? engine.waveManager.currentWave : 0,
                fps: engine.fps,
            },
            timing: {
                simMs: this._metric(samples.map(s => s.sim)),
                renderMs: this._metric(samples.map(s => s.render)),
                renderEnemiesMs: this._metric(samples.map(s => s.renderEnemies || 0)),
                stageMs: this._metric(samples.map(s => s.stage || 0)),
                totalMs: this._metric(samples.map(s => s.total)),
                fps: this._metric(fpsValues),
                avgSteps: samples.reduce((a, s) => a + (s.steps || 1), 0) / samples.length,
            },
            load: {
                peaks,
                avgTowers: samples.reduce((a, s) => a + s.towers, 0) / samples.length,
                avgEnemies: samples.reduce((a, s) => a + s.enemies, 0) / samples.length,
                avgProjectiles: samples.reduce((a, s) => a + s.projectiles, 0) / samples.length,
                avgParticles: samples.reduce((a, s) => a + s.particles, 0) / samples.length,
            },
            towerTypes: typeCounts,
            grids: {
                towerGrid,
                enemyGrid,
            },
            worstFrames: worst.map(s => ({
                idx: s.idx,
                t: Math.round(s.t * 100) / 100,
                sim: Math.round(s.sim * 100) / 100,
                render: Math.round(s.render * 100) / 100,
                renderEnemies: Math.round((s.renderEnemies || 0) * 100) / 100,
                stage: Math.round((s.stage || 0) * 100) / 100,
                total: Math.round(s.total * 100) / 100,
                steps: s.steps,
                towers: s.towers,
                enemies: s.enemies,
                projectiles: s.projectiles,
                particles: s.particles,
                wave: s.wave,
            })),
            memory: mem,
        };
        return report;
    },

    // Returns the report for the current window (or live session if capturing).
    currentReport(engine) {
        return this.buildReport(engine, this._reportSamples());
    },

    // Human-readable summary (for the dev overlay / quick glance).
    liveSummary(engine) {
        const samples = this._reportSamples();
        if (!samples.length) return null;
        const s = samples[samples.length - 1];
        const fps = s.total > 0 ? Math.round(1000 / s.total) : 0;
        return {
            capturing: this.capturing,
            samples: samples.length,
            fps,
            sim: Math.round(s.sim * 10) / 10,
            render: Math.round(s.render * 10) / 10,
            total: Math.round(s.total * 10) / 10,
            enemies: s.enemies,
            projectiles: s.projectiles,
        };
    },

    // Pretty-printed report for copy/console (compact, tab-separated, so it
    // pastes cleanly into a chat / spreadsheet).
    formatReport(report) {
        if (!report) return 'No samples captured yet — press F3 to start a capture, let it run, then F4 to export.';        const L = [];
        const M = report.timing;
        const m = (o, unit) => `${o.min}${unit} min / ${o.p50}${unit} p50 / ${o.avg}${unit} avg / ${o.p95}${unit} p95 / ${o.p99}${unit} p99 / ${o.max}${unit} max`;
        L.push('=== PROFILER REPORT ===');
        L.push(`Renderer: ${report.meta.renderer} | ${report.meta.resolution ? report.meta.resolution.w + 'x' + report.meta.resolution.h : '?'} @${report.meta.dpr}x dpr`);
        L.push(`Window: ${report.meta.samples} frames over ${report.meta.windowSeconds}s` +
            (report.meta.isSession ? ` (session, ${report.meta.sessionSeconds}s)` : ' (rolling)'));
        L.push(`Game: state=${report.meta.gameState} wave=${report.meta.wave} fps=${report.meta.fps}`);
        L.push('');
        L.push('Timing (ms):');
        L.push(`  sim    ${m(M.simMs, '')}`);
        L.push(`  render ${m(M.renderMs, '')}`);
        L.push(`    enemies ${m(M.renderEnemiesMs, '')}`);
        L.push(`    stage   ${m(M.stageMs, '')}`);
        L.push(`  total  ${m(M.totalMs, '')}`);
        L.push(`  fps    ${M.fps.min} min / ${M.fps.avg} avg / ${M.fps.max} max   (avg substeps=${Math.round(M.avgSteps * 100) / 100})`);
        L.push('');
        L.push('Peak entity load:');
        const P = report.load.peaks;
        L.push(`  towers=${P.towers} enemies=${P.enemies} projectiles=${P.projectiles} particles=${P.particles} explosions=${P.explosions} texts=${P.texts}`);
        L.push(`  avg towers=${Math.round(report.load.avgTowers * 10) / 10} enemies=${Math.round(report.load.avgEnemies * 10) / 10} projectiles=${Math.round(report.load.avgProjectiles * 10) / 10} particles=${Math.round(report.load.avgParticles * 10) / 10}`);
        L.push('');
        L.push('Grids (cells/entities/maxBucket):');
        L.push(`  tower ${report.grids.towerGrid ? `${report.grids.towerGrid.cells}/${report.grids.towerGrid.entities}/${report.grids.towerGrid.maxBucket}` : 'n/a'}`);
        L.push(`  enemy ${report.grids.enemyGrid ? `${report.grids.enemyGrid.cells}/${report.grids.enemyGrid.entities}/${report.grids.enemyGrid.maxBucket}` : 'n/a'}`);
        L.push('');
        const types = Object.keys(report.towerTypes);
        if (types.length) {
            L.push('Tower types: ' + types.map(k => `${k}x${report.towerTypes[k]}`).join(' '));
            L.push('');
        }
        L.push('Worst frames (sim+render):');
        for (const w of report.worstFrames) {
            L.push(`  #${w.idx} @${w.t}ms sim=${w.sim} render=${w.render} total=${w.total} steps=${w.steps} | towers=${w.towers} enemies=${w.enemies} proj=${w.projectiles} particles=${w.particles} wave=${w.wave}`);
        }
        if (report.memory) {
            L.push('');
            L.push(`Memory: ${report.memory.usedJSHeapMB}MB used / ${report.memory.totalJSHeapMB}MB heap`);
        }
        return L.join('\n');
    },

    // Full JSON (best for feeding an analyzer).
    toJSON(engine) {
        return JSON.stringify(this.currentReport(engine), null, 2);
    },

    // Download the full report as a timestamped JSON file.
    download(engine) {
        const json = this.toJSON(engine);
        try {
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `profiler-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log('[profiler] downloaded JSON report');
        } catch (e) {
            console.log('[profiler] download failed:', e);
        }
        return json;
    },

    // Console + clipboard export. Returns the report object.
    export(engine) {
        const report = this.currentReport(engine);
        const text = this.formatReport(report);
        console.log('[profiler] report:', report);
        console.log(text);
        const json = JSON.stringify(report, null, 2);
        console.log('[profiler] JSON:', json);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                console.log('[profiler] copied to clipboard');
            }).catch(() => {
                this._fallbackCopy(text);
            });
        } else {
            this._fallbackCopy(text);
        }
        return report;
    },

    _fallbackCopy(text) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            console.log('[profiler] copied to clipboard (fallback)');
        } catch (e) {
            console.log('[profiler] clipboard unavailable');
        }
    },
};
