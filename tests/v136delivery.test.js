// @vitest-environment jsdom
// v1.3.6 "delivery repair" wave. Root cause of a pile of "still broken"
// reports: the cumulative packs' union set had been silently dropping files
// since an early base (164 repo files were missing from every shipped zip -
// names.js, monkeyKnowledgeEffects.js, menus.css, main.js, loadGate.js,
// tuning.js among them), so the owner's game ran a mixed-version install.
// This wave: (1) the packaging now mirrors the ENTIRE repo with a manifest
// equality check, (2) sandbox portraits degrade gracefully on partial
// installs instead of crashing, (3) fade-to-black transitions between
// screens (js/fadeVeil.js), (4) the Update-Log X restyled to match the
// menu's own button language.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf-8');
const menusCss = readFileSync(join(ROOT, 'css', 'menus.css'), 'utf-8');
const dragSrc = readFileSync(join(ROOT, 'js', 'dragManager.js'), 'utf-8');

describe('v1.3.6 crash hardening: sandbox portraits vs stale names.js', () => {
    it('names.js still exports getEnemySpriteFile and dragManager imports THAT module', () => {
        const namesSrc = readFileSync(join(ROOT, 'js', 'names.js'), 'utf-8');
        expect(namesSrc).toMatch(/export const Names\s*=/);
        expect(namesSrc).toContain('getEnemySpriteFile(tier');
        // the import must point at names.js, not some other Names
        expect(dragSrc).toContain("import { Names } from './names.js';");
    });

    it('applySandboxPortraits guards the call - a partial install degrades, never crashes', () => {
        expect(dragSrc).toContain('typeof Names.getEnemySpriteFile');
        expect(dragSrc).toContain('applySandboxPortraits._warned');
        expect(dragSrc).toContain('Re-apply the FULL latest pack');
    });
});

describe('v1.3.6 fade-through-black transitions', () => {
    it('the veil exists in HTML and CSS (black cover above every overlay)', () => {
        expect(indexHtml).toContain('id="fade-veil"');
        expect(menusCss).toMatch(/#fade-veil\s*{[^}]*background:\s*#000/);
        expect(menusCss).toMatch(/#fade-veil\s*{[^}]*z-index:\s*9000/);
        expect(menusCss).toMatch(/#fade-veil\.on\s*{[^}]*opacity:\s*1/);
    });

    it('fadeVeil.js is an import-free leaf with through()/on()/off()', async () => {
        const src = readFileSync(join(ROOT, 'js', 'fadeVeil.js'), 'utf-8');
        expect(src).not.toMatch(/^import /m);
        expect(src).toContain('through(mid)');
        expect(src).toContain('async on()');
        expect(src).toContain('async off()');
        expect(existsSync(join(ROOT, 'js', 'fadeVeil.js'))).toBe(true);
    });

    it('all three screen swaps go through the veil', () => {
        const mainSrc = readFileSync(join(ROOT, 'js', 'main.js'), 'utf-8');
        const gcSrc = readFileSync(join(ROOT, 'js', 'gameController.js'), 'utf-8');
        // title -> menu
        expect(mainSrc).toContain('FadeVeil.through');
        // menu -> battle (veil covers the swap; v1.4.2: lifts the moment the
        // loading screen shows via onScreen, and again in the finally)
        expect(gcSrc).toContain('await FadeVeil.on()');
        expect(gcSrc).toContain('onScreen: liftVeil');
        expect(gcSrc).toMatch(/finally\s*\{\s*liftVeil\(\);?\s*}/);
        // quit -> menu
        expect(gcSrc).toMatch(/quitBtn[\s\S]{0,400}FadeVeil\.through/);
    });

    it('behavioral: through() covers the screen, runs the swap, then reveals', async () => {
        document.body.innerHTML = `<div id="fade-veil"></div>
            <div id="screen-a">A</div><div id="screen-b" class="hidden">B</div>`;
        const { FadeVeil } = await import('../js/fadeVeil.js');
        const veil = document.getElementById('fade-veil');
        let swapped = false;
        const p = FadeVeil.through(async () => {
            // mid-swap runs while the veil is black
            expect(veil.classList.contains('on')).toBe(true);
            swapped = true;
            document.getElementById('screen-a').classList.add('hidden');
            document.getElementById('screen-b').classList.remove('hidden');
        });
        expect(swapped).toBe(false);          // not yet - veil first
        await p;
        expect(swapped).toBe(true);           // swap happened behind the veil
        expect(document.getElementById('screen-a').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('screen-b').classList.contains('hidden')).toBe(false);
        expect(veil.classList.contains('on')).toBe(false);  // revealed again
    }, 5000);
});

describe('v1.3.6 Update-Log X matches the menu button language', () => {
    it('the X is the red rounded-square used across the menus (map-delete-btn style)', () => {
        expect(menusCss).toMatch(/\.menu-x\s*{[^}]*background:\s*rgba\(231,\s*76,\s*60,\s*0\.9\)/);
        expect(menusCss).toMatch(/\.menu-x\s*{[^}]*border:\s*none/);
        expect(menusCss).toMatch(/\.menu-x\s*{[^}]*color:\s*white/);
        expect(menusCss).toMatch(/\.menu-x:hover\s*{[^}]*background:\s*#c0392b/);
        expect(menusCss).toMatch(/\.menu-x:focus-visible\s*{/);
    });
});

describe('v1.3.6 settings lanes still pinned (delivered for the first time)', () => {
    it('two lateral columns with one volume slider each', () => {
        expect((indexHtml.match(/class="settings-col"/g) || []).length).toBe(2);
        expect(indexHtml).toContain('id="volume-slider"');
        expect(indexHtml).toContain('id="music-slider"');
        expect(menusCss).toMatch(/\.settings-grid\s*{[^}]*grid-template-columns:\s*minmax\(280px,\s*1fr\)\s*minmax\(280px,\s*1fr\)/);
    });
});
