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
import { LoadingMinigame } from './loadingMinigame.js';
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
function buildCanvasPreloadUrls() {
    const urls = [];
    Object.keys(TowerStats).forEach(type => urls.push(`sprites/portraits/${type}_menuportrait.png`));
    Object.keys(HeroRegistry).forEach(key => urls.push(`sprites/portraits/${key}_menuportrait.png`));
    Maps.forEach(map => {
        if (map.bgImage) urls.push(`sprites/maps/${map.bgImage}`);
    });
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

// Scale/position the game container immediately (module scripts run after DOM
// parse, so the elements exist here) instead of waiting for the slow `load`
// event — otherwise the title screen shows un-framed until all assets finish.
windowLayout.init();

window.addEventListener('load', () => {
    GameEngine.init();
    startCanvasPreload();
    const titleMeta = document.getElementById('title-meta');
    if (titleMeta) titleMeta.innerText = `v${pkg.version} · ${GameEngine.rendererName}`;
    setupEventListeners();
    Main.applyConfigToUI();
    
    const titleScreen = document.getElementById('title-screen');
    const loadingScreen = document.getElementById('loading-screen');
    const titlePlayBtn = document.getElementById('title-play-btn');
    const loadingStatus = document.getElementById('loading-status');

    const setStatus = (text) => { if (loadingStatus) loadingStatus.textContent = text; };

    titlePlayBtn.addEventListener('click', async () => {
        try {
            titleScreen.classList.add('hidden');
            loadingScreen.classList.remove('hidden');
            loadingScreen.classList.remove('minigame-only');
            document.getElementById('minigame-close')?.classList.add('hidden');
            setStatus('Loading...');
            LoadingMinigame.onComplete = () => LevelManager.addXP(1, { autoGrantCategory: true });
            LoadingMinigame.start();

            // 1-4) Run the three independent preload tracks concurrently:
            //   a) WebGL textures (tower/hero frames incl. upgrades, enemies +
            //      cracks + blades, effects, projectiles, maps) — mostly loaded
            //      already by the background _preloadSprites() fired at init.
            //   b) Canvas Images — same URL/Manifest lists, preloaded in the
            //      background by startCanvasPreload() during the title screen;
            //      they drive the animation-decision logic (towerBehavior probes
            //      Assets.get() to pick full-anim prefixes) and warm the HTTP
            //      cache for the CSS menu portraits.
            //   c) AudioEngine.init() — builds the AudioContext, loads the music
            //      playlist, and decodes all SFX.
            // Each track is independent (its own cache/subsystem) and every
            // preload is idempotent, so awaiting them together is safe.
            const renderer = await GameEngine.rendererReady;
            setStatus('Loading assets...');
            await Promise.all([
                renderer ? renderer.preloadGameAssets(() => { setStatus('Loading assets...'); }) : Promise.resolve(),
                startCanvasPreload(),
                AudioEngine.init(),
            ]);

            setStatus('Ready!');
            MonkeyKnowledge.init();

            await new Promise(r => setTimeout(r, 300));
            
            LoadingMinigame.stop();
            loadingScreen.classList.add('hidden');
            Main.showMainMenuUI(true);
            AudioEngine.playMenuMusic();
        } catch (err) {
            console.error("Boot: Loading sequence failed, forcing game load:", err);
            LoadingMinigame.stop();
            loadingScreen.classList.add('hidden');
            Main.showMainMenuUI(true);
        }
    });
});
