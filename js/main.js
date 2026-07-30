// js/main.js
import '../css/base.css';
import '../css/game-ui.css';
import '../css/menus.css';
import '../css/mapEditor.css';
import '../css/monkeyKnowledge.css';
import '../css/upgradePanel.css';

import { GameEngine } from './engine.js';
import { TowerStats } from './towers/index.js';
import { HeroRegistry } from './heroes/index.js';
import { Maps } from './data.js';
import { AudioEngine } from './audio.js';
import { InputManager } from './input.js';
import { UI } from './ui.js';
import { MonkeyKnowledge } from './monkeyKnowledge.js';
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

    // FIX: Add F2 Dev Overlay Toggle
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F2') {
            e.preventDefault();
            GameEngine.showDevOverlay = !GameEngine.showDevOverlay;
            console.log("Dev Overlay:", GameEngine.showDevOverlay ? "ON" : "OFF");
        }
    });
}

window.addEventListener('load', () => {
    GameEngine.init();
    setupEventListeners();
    Main.applyConfigToUI();
    windowLayout.init();
    
    const titleScreen = document.getElementById('title-screen');
    const loadingScreen = document.getElementById('loading-screen');
    const titlePlayBtn = document.getElementById('title-play-btn');
    const loadingBar = document.getElementById('loading-bar-fill');
    
    titlePlayBtn.addEventListener('click', async () => {
        try {
            titleScreen.classList.add('hidden');
            loadingScreen.classList.remove('hidden');
            loadingBar.style.width = '0%';
            
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

            const effectKeys = [
                'effect_banana', 'effect_banana_crate', 
                'effect_camo_effect', 'effect_camo_regen_effect', 'effect_regen_effect', 
                'effect_frozen_effect', 'effect_frozen_effect_lead', 'effect_frozen_effect_regen'
            ];
            
            // FIX: Use preloadManifest so it resolves the 'sprites/effects/' paths automatically!
            await Assets.preloadManifest(effectKeys, (pct) => {
                loadingBar.style.width = `${50 + Math.floor(pct * 20)}%`;
            });
            await AudioEngine.init();
            loadingBar.style.width = '70%';

            await Assets.preloadCracks();
            loadingBar.style.width = '90%';

            MonkeyKnowledge.init();
            loadingBar.style.width = '100%';

            await new Promise(r => setTimeout(r, 300));
            
            loadingScreen.classList.add('hidden');
            Main.showMainMenuUI(true);
            AudioEngine.playMenuMusic();
        } catch (err) {
            console.error("Boot: Loading sequence failed, forcing game load:", err);
            loadingScreen.classList.add('hidden');
            Main.showMainMenuUI(true);
        }
    });
});