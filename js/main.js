// js/main.js
import pkg from '../package.json';
import '../css/base.css';
import '../css/game-ui.css';
import '../css/menus.css';
import '../css/mapEditor.css';
import '../css/monkeyKnowledge.css';
import '../css/upgradePanel.css';
import '../css/heroMenu.css';

import { GameEngine } from './engine.js';
import { Profiler } from './profiler.js';
import { TowerStats } from './towers/index.js';
import { HeroRegistry } from './heroes/index.js';
import { Maps } from './data.js';
import { AudioEngine } from './audio.js';
import { InputManager } from './input.js';
import { UI } from './ui.js';
import { MonkeyKnowledge } from './monkeyKnowledge.js';
import { LevelManager } from './levelManager.js';
import { LoadGate } from './loadGate.js';
import { LoadingMinigame } from './loadingMinigame.js';
import { FadeVeil } from './fadeVeil.js';
import { setupShopListeners, setupNudgeLogic, updateShopPrices } from './dragManager.js';
import selectorMenus from './selectorMenus.js';
import settingsMenu from './settingsMenu.js';
import Assets from './assets.js';
import { dom } from './dom.js';
import { windowLayout } from './windowLayout.js';
import { menuController } from './menuController.js';
import { gameController } from './gameController.js';

export const Main = {};
Object.assign(Main, selectorMenus);
Object.assign(Main, settingsMenu);
Object.assign(Main, menuController);
Object.assign(Main, gameController);

// Canvas-side preload (js/assets.js Images). Mirrors the WebGL background
// preload that PixiRenderer.init() fires at page load: it runs during the
// title screen so the loading screen after Play-click mostly resolves
// instantly. Idempotent — both the background kick-off and the Play-click
// handler await the same promise, so a fast click just waits for the same
// in-flight work.
let canvasPreloadPromise = null;
// Menu portraits (CSS backgrounds in the Monkeys / Heroes menus). Gated before
// those menus open — see LoadGate group "portraits".
function buildPortraitUrls() {
    const urls = [];
    Object.keys(TowerStats).forEach(type => urls.push(`sprites/portraits/${type}_menuportrait.png`));
    Object.keys(HeroRegistry).forEach(key => urls.push(`sprites/portraits/${key}_menuportrait.png`));
    return urls;
}

// Canvas-side gameplay images. Map backgrounds are intentionally NOT here any
// more: they're ~1-3MB each x 2 (day+night) x every map, and a session only
// plays one — LoadGate group "map" loads just the chosen map's pair.
function buildCanvasPreloadUrls() {
    const urls = [];
    Object.keys(TowerStats).forEach(type => {
        urls.push(`sprites/towers/${type}_base.png`);
        urls.push(`sprites/towers/${type}_arm.png`);
    });
    const enemyNames = ['red', 'blue', 'green', 'yellow', 'pink', 'black', 'white', 'lead', 'zebra', 'purple', 'rainbow', 'ceramic', 'moab', 'bfb', 'zomg', 'ddt', 'bad'];
    enemyNames.forEach(name => urls.push(`sprites/enemies/${name}.png`));
    return urls;
}

const EFFECT_PRELOAD_KEYS = [
    'effect_banana', 'effect_banana_crate',
    'effect_camo_effect', 'effect_camo_regen_effect',
    'effect_frozen_effect', 'effect_frozen_effect_lead', 'effect_frozen_effect_regen',
];

function startCanvasPreload() {
    if (!canvasPreloadPromise) {
        canvasPreloadPromise = (async () => {
            await Assets.preloadUrls(buildCanvasPreloadUrls());
            const renderer = await GameEngine.rendererReady;
            if (renderer) {
                const frameKeys = await renderer.towerFrameKeys();
                await Assets.preloadManifest(frameKeys);
            }
            await Assets.preloadManifest(EFFECT_PRELOAD_KEYS);
            await Assets.preloadCracks();
        })().catch(err => console.error('[boot] Canvas preload failed:', err));
    }
    return canvasPreloadPromise;
}

// ---- LoadGate groups (see js/loadGate.js) ---------------------------------
LoadGate.register('boot', {
    load: async () => { await AudioEngine.init(); MonkeyKnowledge.init(); },
});
LoadGate.register('portraits', {
    load: (_ctx, onProgress) => Assets.preloadUrls(buildPortraitUrls(), onProgress),
});
LoadGate.register('game', {
    load: async (_ctx, onProgress) => {
        const renderer = await GameEngine.rendererReady;
        await Promise.all([
            renderer ? renderer.preloadGameAssets(onProgress) : Promise.resolve(),
            startCanvasPreload(),
        ]);
    },
});
LoadGate.register('map', {
    key: (mapData) => (mapData && (mapData.image || mapData.bgImage)) || 'none',
    load: async (mapData) => {
        const renderer = await GameEngine.rendererReady;
        if (renderer && renderer.preloadMap) await renderer.preloadMap(mapData);
    },
});

window.addEventListener('error', (e) => {
    const errMsg = document.getElementById('error-message');
    if (errMsg) {
        errMsg.innerText = `Game Error: ${e.message}. Check console (F12) for details.`;
        errMsg.classList.remove('hidden');
    }
    console.error("Game Error:", e);
});

function setupEventListeners() {
    Main.setupMenuListeners();
    Main._setupSettingsListeners();
    Main.setupGameListeners();
    setupShopListeners(); 
    setupNudgeLogic(); 
    InputManager.init();
    GameEngine.updateShopPrices = updateShopPrices;

    window.addEventListener('keydown', (e) => {
        // Ignore profiler hotkeys while typing in a text field/input.
        const t = e.target;
        const isTyping = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

        if (e.key === 'F2' && !isTyping) {
            e.preventDefault();
            GameEngine.showDevOverlay = !GameEngine.showDevOverlay;
            console.log("Dev Overlay:", GameEngine.showDevOverlay ? "ON" : "OFF");
        }
        if (e.key === 'F3' && !isTyping) {
            e.preventDefault();
            const p = Profiler;
            if (p.capturing) {
                const dur = p.stopCapture();
                console.log("[profiler] capture stopped:", p.session.length, "frames over", Math.round(dur * 10) / 10, "s");
            } else {
                p.startCapture();
                console.log("[profiler] capture started — press F4 to export");
            }
        }
        if (e.key === 'F4' && !isTyping) {
            e.preventDefault();
            Profiler.export(GameEngine);
        }
        if (e.key === 'F5' && !isTyping) {
            e.preventDefault();
            Profiler.download(GameEngine);
            console.log("[profiler] saved JSON report");
        }
        if (e.key === 'F6' && !isTyping) {
            e.preventDefault();
            Profiler.reset();
            console.log("[profiler] reset");
        }
    });
}

// Repeat-visit asset cache (public/sw.js). Production builds only — the dev
// server must always serve fresh files, and the sprite editors rewrite assets.
// Fully optional: if registration is blocked (e.g. some embedded hosts) the
// game simply loads from the network as before.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(`sw.js?v=${__BUILD_ID__}`).catch(err => console.warn('[sw] not registered:', err));
    });
}

// Scale/position the game container immediately (module scripts run after DOM
// parse, so the elements exist here) instead of waiting for the slow `load`
// event — otherwise the title screen shows un-framed until all assets finish.
windowLayout.init();

window.addEventListener('load', () => {
    GameEngine.init();
    // Start every group loading in the background right away (portraits are small
    // so they go first); each is gated only where it is actually needed.
    // 'boot' (audio + knowledge) also starts HERE, not on Play-click: the
    // pre-menu loading screen has less to wait for, and what remains (menu
    // portraits) joins it behind that screen instead of a later gate.
    LoadGate.prefetch('boot');
    LoadGate.prefetch('portraits');
    LoadGate.prefetch('game');
    // v1.3.5: the restored loading minigame quietly farms XP — every
    // xpMilestone swords pulled fires onComplete once (only reachable on
    // genuinely long loads, or via forceMinigame()).
    LoadingMinigame.onComplete = () => LevelManager.addXP(1, { autoGrantCategory: true });
    const titleMeta = document.getElementById('title-meta');
    if (titleMeta) titleMeta.innerText = `v${pkg.version} · ${GameEngine.rendererName}`;
    setupEventListeners();
    Main.applyConfigToUI();
    
    const titleScreen = document.getElementById('title-screen');
    const titlePlayBtn = document.getElementById('title-play-btn');

    titlePlayBtn.addEventListener('click', async () => {
        try {
            // v1.3.6: the title -> menu swap now goes through a fade to black
            // (owner: "no transitions, no fading to black"). The title still
            // fades out on its own; the veil covers the loading gap so the
            // menu never pops in over a bare background.
            LoadGate.fadeHide(titleScreen);
            await FadeVeil.through(async () => {
                // The pre-menu gate: audio + knowledge + menu portraits. Both groups
                // were prefetched at page load, so this is usually instant (the
                // gate only shows its screen after 150ms); when it DOES show, it
                // fades in and out like every other loading screen.
                try {
                    await LoadGate.ensureMany([['boot'], ['portraits']], { label: 'Loading...' });
                } catch (err) {
                    console.error("Boot: Loading sequence failed, forcing menu:", err);
                }
                Main.showMainMenuUI(true);
                AudioEngine.playMenuMusic();
                // Hand out rewards for levels reached in an earlier session but never claimed.
                LevelManager.resumeUnclaimed();
            });
        } catch (err) {
            console.error("Boot: transition failed, forcing menu:", err);
            Main.showMainMenuUI(true);
        }
    });
});
