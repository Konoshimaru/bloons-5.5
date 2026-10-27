// @vitest-environment jsdom
// v1.3.5: the loading minigame is RESTORED (v1.3.4 had deleted it outright —
// the intent was "only on long loads", not "gone"). Covers the restored
// module + long-load gating, plus the kept v1.3.4 polish: real fades with a
// longer minimum display, settings menu as two LATERAL lanes, styled
// Update-Log close X.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf-8');
const menusCss = readFileSync(join(ROOT, 'css', 'menus.css'), 'utf-8');
const loadGateSrc = readFileSync(join(ROOT, 'js', 'loadGate.js'), 'utf-8');

describe('v1.3.5 minigame restored, gated behind LONG loads', () => {
    it('the minigame module exists again and the loading screen carries canvas + Back button', () => {
        expect(existsSync(join(ROOT, 'js', 'loadingMinigame.js'))).toBe(true);
        expect(indexHtml).toContain('id="loading-minigame"');
        expect(indexHtml).toContain('id="minigame-close"');
        expect(menusCss).toContain('.loading-minigame');
        expect(menusCss).toContain('.loading-minigame.live');
        expect(menusCss).toContain('minigame-only');
        const tuning = readFileSync(join(ROOT, 'js', 'tuning.js'), 'utf-8');
        expect(tuning).toContain('minigame:');
        expect(tuning).toContain('appearAfterMs');
    });

    it('loadGate summons the minigame on a DELAY, never synchronously on show', () => {
        expect(loadGateSrc).toContain("from './loadingMinigame.js'");
        expect(loadGateSrc).toContain('appearAfterMs');
        // arming is a timeout, not an immediate start; release disarms
        expect(loadGateSrc).toMatch(/setTimeout\(\s*\(\)\s*=>\s*{[\s\S]*?LoadingMinigame\.start/);
        expect(loadGateSrc).toMatch(/function armMinigame/);
        expect(loadGateSrc).toMatch(/function disarmMinigame/);
        expect(loadGateSrc).toContain('armMinigame();');
        expect(loadGateSrc).toContain('disarmMinigame();');
    });

    it('the plain status + progress bar still load immediately', () => {
        expect(indexHtml).toContain('id="loading-status"');
        expect(indexHtml).toContain('id="loading-bar"');
    });
});

describe('v1.3.4 settings menu: two lateral lanes', () => {
    it('the HTML carries two settings columns (SFX lane + Music lane)', () => {
        expect((indexHtml.match(/class="settings-col"/g) || []).length).toBe(2);
        expect(indexHtml).toContain('id="volume-slider"');
        expect(indexHtml).toContain('id="music-slider"');
    });

    it('the CSS pins two side-by-side vertical columns with a narrow fallback', () => {
        expect(menusCss).toMatch(/\.settings-grid\s*{[^}]*grid-template-columns:\s*minmax\(280px,\s*1fr\)\s*minmax\(280px,\s*1fr\)/);
        expect(menusCss).toMatch(/\.settings-col\s*{[^}]*flex-direction:\s*column/);
        // Narrow screens may stack to one column, desktop must not.
        expect(menusCss).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.settings-grid\s*{\s*grid-template-columns:\s*1fr/);
    });
});

describe('v1.3.4 Update Log close X', () => {
    it('the X button exists and has its dedicated styling', () => {
        expect(indexHtml).toContain('id="update-log-close"');
        expect(indexHtml).toContain('class="menu-x"');
        expect(menusCss).toMatch(/\.menu-x\s*{/);
        expect(menusCss).toMatch(/\.menu-x:hover\s*{/);
        expect(menusCss).toMatch(/\.menu-x:focus-visible\s*{/);
    });
});

describe('v1.3.4/v1.3.5 loading gate: real fades + deliberate minimum', () => {
    let LoadGate;
    beforeAll(async () => {
        document.body.innerHTML = `
            <div id="loading-screen" class="full-screen-overlay hidden">
                <canvas id="loading-minigame" class="loading-minigame"></canvas>
                <div class="loading-container">
                    <button id="minigame-close" class="back-btn hidden">Back</button>
                    <div id="loading-status">Loading...</div>
                    <div id="loading-bar"><div id="loading-bar-fill"></div></div>
                </div>
            </div>`;
        ({ LoadGate } = await import('../js/loadGate.js'));
    });

    it('fast loads (<150ms) never show the screen at all', async () => {
        LoadGate.register('fast', { load: async () => {} });
        await LoadGate.ensure('fast');
        const screen = document.getElementById('loading-screen');
        expect(screen.classList.contains('hidden')).toBe(true);
    });

    it('slow loads show the screen, hold the minimum, then fade-hide', async () => {
        let release;
        LoadGate.register('slow', {
            load: () => new Promise((res) => { release = res; }),
        });
        const done = LoadGate.ensure('slow');
        await new Promise((r) => setTimeout(r, 250)); // > SHOW_DELAY_MS (150)
        const screen = document.getElementById('loading-screen');
        expect(screen.classList.contains('hidden')).toBe(false); // shown

        release();
        await new Promise((r) => setTimeout(r, 60)); // loader done; MIN_SHOW_MS holds it
        expect(screen.classList.contains('hidden')).toBe(false); // still up (700ms minimum)

        await new Promise((r) => setTimeout(r, 1100)); // minimum + fade elapsed
        expect(screen.classList.contains('hidden')).toBe(true); // hidden after fade
        await done;
    });

    it('a mid-length load shows the bar but NEVER the minigame; a long load fades it in, release removes it', async () => {
        let release;
        LoadGate.register('minigameload', {
            load: () => new Promise((res) => { release = res; }),
        });
        const done = LoadGate.ensure('minigameload');
        const canvas = document.getElementById('loading-minigame');

        // Past SHOW_DELAY_MS (150) but well under TUNING.minigame.appearAfterMs (1500):
        await new Promise((r) => setTimeout(r, 400));
        const screen = document.getElementById('loading-screen');
        expect(screen.classList.contains('hidden')).toBe(false); // screen shown
        expect(canvas.classList.contains('live')).toBe(false);   // minigame NOT summoned

        // Outlive appearAfterMs (1500ms of SCREEN time):
        await new Promise((r) => setTimeout(r, 1400));
        expect(canvas.classList.contains('live')).toBe(true);    // minigame joined

        // Load finishes: minigame is dismissed immediately, screen still
        // holds its minimum before fading out.
        release();
        await new Promise((r) => setTimeout(r, 80));
        expect(canvas.classList.contains('live')).toBe(false);   // minigame gone
        await done;
    }, 10000);
});
