// js/gameController.js
import { GameEngine } from './engine.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { dom } from './dom.js';
import { updateShopPrices } from './dragManager.js';
import { menuController } from './menuController.js';

export const gameController = {
    async startGameUI(isSandbox) {
        menuController.showMainMenuUI(false);
        UI.toggleMenus(null);
        document.getElementById('sidebar').classList.remove('hidden');
        document.getElementById('top-ui-left').classList.remove('hidden');
        document.getElementById('top-ui-right').classList.remove('hidden');
        document.getElementById('level-bar').classList.remove('hidden');
        UI.toggleLevelBar(false);
        UI.updateMetaStats();
        const sandboxControls = document.getElementById('sandbox-controls');
        const normControls = document.getElementById('norm-controls');
        if (isSandbox) {
            sandboxControls.classList.remove('hidden');
            normControls.classList.add('hidden');
        } else {
            sandboxControls.classList.add('hidden');
            normControls.classList.remove('hidden');
        }
        document.getElementById('shop-view').classList.remove('hidden');
        document.getElementById('enemy-view').classList.add('hidden');
        if (dom.sbViewToggle) dom.sbViewToggle.innerText = '🎈 Spawn Bloons';
        try {
            GameEngine.startGame(isSandbox);
            updateShopPrices();
            await AudioEngine.init();
            AudioEngine.playGameMusic();
        } catch (err) {
            console.error("Failed to start game:", err);
            GameEngine.gameState = 'gameover';
            UI.toggleMenus('game-over-menu');
            document.getElementById('go-wave-stat').innerText = `Game Crash: ${err.message}. Check console (F12).`;
        }
    },

    setupGameListeners() {
        dom.pauseBtn?.addEventListener('click', () => GameEngine.pauseGame());
        dom.levelBarToggle?.addEventListener('click', () => UI.toggleLevelBar());
        dom.resumeBtn?.addEventListener('click', () => GameEngine.resumeGame());
        dom.pauseSettingsBtn?.addEventListener('click', () => { GameEngine.lastMenu = 'pause-menu'; UI.toggleMenus('settings-menu'); });
        dom.quitBtn?.addEventListener('click', () => {
            GameEngine.deselectAll();
            GameEngine.saveGame();
            GameEngine.gameState = 'menu';
            GameEngine.map = null; 
            UI.toggleMenus(null);
            menuController.showMainMenuUI(true);
            document.getElementById('sidebar').classList.add('hidden');
            document.getElementById('top-ui-left').classList.add('hidden');
            document.getElementById('top-ui-right').classList.add('hidden');
            document.getElementById('level-bar').classList.add('hidden');
            AudioEngine.playMenuMusic();
            updateShopPrices();
        });
        dom.sbPrev?.addEventListener('click', () => GameEngine.skipWave(-1));
        dom.sbNext?.addEventListener('click', () => GameEngine.skipWave(1));
        dom.waveSpeedBtn?.addEventListener('click', () => GameEngine.handleWaveSpeedClick(1));
        dom.sbSpeedBtn?.addEventListener('click', () => GameEngine.handleWaveSpeedClick(1));
        const handleSpeedRightClick = (e) => {
            e.preventDefault();
            GameEngine.handleWaveSpeedClick(-1);
        };
        dom.waveSpeedBtn?.addEventListener('contextmenu', handleSpeedRightClick);
        dom.sbSpeedBtn?.addEventListener('contextmenu', handleSpeedRightClick);
        dom.sbResetCooldowns?.addEventListener('click', () => {
            if (!GameEngine.isSandbox) return;
            GameEngine.towers.forEach(t => {
                if (!t) return;
                t.abilityCooldown = 0;
                t.ability2Cooldown = 0;
                t.ability3Cooldown = 0;
            });
            GameEngine.log("Ability cooldowns reset!");
            UI.updateAbilityBar(GameEngine);
        });
        dom.cashDisplay?.addEventListener('click', () => {
            if (!GameEngine.isSandbox) return;
            const val = prompt("Set Cash Amount:", GameEngine.cash);
            if (val !== null && !isNaN(val)) { GameEngine.cash = Math.max(0, parseInt(val)); GameEngine.updateUI(); }
        });
        dom.livesDisplay?.addEventListener('click', () => {
            if (!GameEngine.isSandbox) return;
            const val = prompt("Set Lives Amount:", GameEngine.lives);
            if (val !== null && !isNaN(val)) { GameEngine.lives = Math.max(0, parseInt(val)); GameEngine.updateUI(); }
        });
        dom.waveDisplay?.addEventListener('click', () => {
            if (!GameEngine.isSandbox) return;
            const val = prompt("Set Round:", GameEngine.waveManager.currentWave);
            if (val !== null && !isNaN(val)) {
                GameEngine.waveManager.currentWave = Math.max(1, parseInt(val));
                GameEngine.updateUI();
            }
        });
        dom.cancelBtn?.addEventListener('click', () => GameEngine.deselectAll());
        dom.upTargetPrev?.addEventListener('click', () => GameEngine.cycleTargeting(-1));
        dom.upTargetNext?.addEventListener('click', () => GameEngine.cycleTargeting(1));
    }
};
