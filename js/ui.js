// js/ui.js
import { TowerStats } from './towers/index.js';
import { Config, HeroStats } from './config.js';
import uiTowerPanel from './uiTowerPanel.js';

const elements = {};
function el(id) {
    if (!elements[id]) {
        elements[id] = document.getElementById(id);
    }
    return elements[id];
}

// FIX: Added 'profile-menu' to the array so the game knows how to hide it when the back button is clicked
const MENUS = ['play-menu', 'hero-select-menu', 'knowledge-menu', 'powers-menu', 'difficulty-menu', 'maps-menu', 'settings-menu', 'pause-menu', 'game-over-menu', 'map-editor-menu', 'custom-maps-menu', 'profile-menu', 'monkeys-menu'];const SPEED_TEXTS = ["Start Wave", "1x", "2x", "3x", "5x", "10x", "20x"];

export const UI = {
    _towerCardCache: null,

    toggleMenus(menuId) {
        let anyOverlayVisible = false;
        for (const id of MENUS) {
            const menu = el(id);
            if (menu) menu.classList.add('hidden');
        }
        
        const mainUI = el('main-menu-ui');
        
        if (menuId) {
            const target = el(menuId);
            if (target) {
                target.classList.remove('hidden');
                anyOverlayVisible = true;
            }
            
            if (mainUI) {
                if (anyOverlayVisible && menuId !== 'main-menu-ui') {
                    mainUI.classList.add('hidden');
                } else if (menuId === 'main-menu-ui') {
                    mainUI.classList.remove('hidden');
                }
            }
        } else {
            if (mainUI) mainUI.classList.add('hidden');
        }
    },

    showPause() {
        const pauseMenu = el('pause-menu');
        if (pauseMenu) pauseMenu.classList.remove('hidden');
    },

    hidePause() {
        const pauseMenu = el('pause-menu');
        if (pauseMenu) pauseMenu.classList.add('hidden');
    },

    updateMetaStats() {
        const levelEl = el('mm-level-text');
        const xpEl = el('mm-xp-text');
        const expFill = el('mm-exp-fill');
        const mmEl = el('mm-top-right');
        const nameEl = el('mm-player-name'); // FIX: Get name element
        
        if (nameEl) nameEl.innerText = Config.data.playerName || "Player"; // FIX: Update name display
        if (levelEl) levelEl.innerText = `Level ${Config.data.playerLevel}`;
        if (xpEl) xpEl.innerText = `${Config.data.playerXP} / ${Config.data.playerXPToNext} XP`;
        if (expFill) expFill.style.width = `${(Config.data.playerXP / Config.data.playerXPToNext) * 100}%`;
        if (mmEl) mmEl.innerText = `🐵 $${Config.data.monkeyMoney}`;
        
        const hasSave = !!Config.data.savedRun;
        const continueBtn = el('btn-continue');
        const abandonBtn = el('btn-abandon');
        if (continueBtn) continueBtn.style.display = hasSave ? 'block' : 'none';
        if (abandonBtn) abandonBtn.style.display = hasSave ? 'block' : 'none';
    },

    updateWaveSpeedBtn(speedState) {
        const btn = el('wave-speed-btn');
        const sbBtn = el('sb-speed-btn');
        const targets = [btn, sbBtn].filter(Boolean);
        if (targets.length === 0) return;
        
        const text = SPEED_TEXTS[speedState] || "Start Wave";
        const active = speedState > 0;
        
        targets.forEach(b => {
            b.innerText = text;
            b.classList.toggle('speed-active', active);
        });
    },

    hideUpgradePanel() {
        const cards = document.querySelectorAll('.tower-card[data-tower]');
        cards.forEach(c => c.classList.remove('selected'));
        const panel = el('upgrade-sidebar');
        if (panel) panel.classList.add('hidden');
        
        const sidebar = el('sidebar');
        if (sidebar) sidebar.classList.remove('hidden');
        
        const shopHeader = el('shop-header');
        if (shopHeader) {
            shopHeader.innerText = 'Shop';
            shopHeader.style.fontSize = '22px'; 
        }

        const shopView = el('shop-view');
        const enemyView = el('enemy-view');
        if (shopView) shopView.classList.remove('hidden');
        if (enemyView) enemyView.classList.add('hidden');
    },

    log(msg) {
        const logEl = el('message-log');
        if (logEl) logEl.innerText = msg;
    },

    updateLives(lives) {
        const livesEl = el('lives-display');
        if (livesEl) livesEl.innerText = `Lives: ${lives}`;
    },

    updateWave(wave) {
        const waveEl = el('wave-display');
        if (waveEl) waveEl.innerText = `Wave ${wave}`;
    },

    updateCash(cash, engine) {
        const cashEl = el('cash-display');
        if (cashEl) cashEl.innerText = `$${cash}`;

        if (!this._towerCardCache) {
            this._towerCardCache = document.querySelectorAll('.tower-card[data-tower]');
        }
        
        this._towerCardCache.forEach(card => {
            const stats = TowerStats[card.dataset.tower] || HeroStats[card.dataset.tower];
            if (!stats) return;
            const cost = engine.getCost(stats.cost);
            if (cash < cost) {
                card.classList.add('disabled');
            } else {
                card.classList.remove('disabled');
            }
        });

        if (engine.selectedPlacedTower && !engine.selectedPlacedTower.stats.isHero) {
            this._updateUpgradeCards(engine.selectedPlacedTower, engine);
        }
    }
};

Object.assign(UI, uiTowerPanel);