// js/gameController.js
import { GameEngine } from './engineRef.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { dom } from './dom.js';
import { updateShopPrices } from './dragManager.js';
import { menuController } from './menuController.js';
import { LoadGate } from './loadGate.js';
import { Maps } from './data.js';
import { Config } from './config.js';
import { FadeVeil } from './fadeVeil.js';

import { controllers } from './controllers.js';

export const gameController = {
    async startGameUI(isSandbox, { loadSavedRun = false } = {}) {
        // Ignore double-clicks while the pre-game loading screen is up.
        if (this._starting) return;
        this._starting = true;
        try {
            // Cover the menu-to-battle transition. On slow loads, lift the veil
            // when the loading screen appears so progress remains visible;
            // instant loads keep the transition covered through battle setup.
            await FadeVeil.on();
            menuController.showMainMenuUI(false);
            UI.toggleMenus(null);
            let veilLifted = false;
            const liftVeil = () => {
                if (veilLifted) return;
                veilLifted = true;
                FadeVeil.off();
            };
            try {
                // Gate: gameplay assets + this map's background. Instant when the
                // background prefetch already finished; otherwise one loading screen.
                const mapIndex = loadSavedRun
                    ? Config.data.savedRun?.mapIndex
                    : GameEngine.currentMap;
                const mapData = Maps[mapIndex];
                // An invalid/missing saved map is rejected by loadGame() itself,
                // which can provide a useful save-load error without mutating state.
                await LoadGate.ensureMany(
                    [['game'], ['map', mapData]],
                    { label: 'Preparing the battlefield...', onScreen: liftVeil }
                );
                await this._startGameUI(isSandbox, { loadSavedRun });
            } finally {
                liftVeil();
            }
        } finally {
            this._starting = false;
        }
    },

    async _startGameUI(isSandbox, { loadSavedRun = false } = {}) {
        menuController.showMainMenuUI(false);
        UI.toggleMenus(null);
        document.getElementById('sidebar').classList.remove('hidden');
        document.getElementById('top-ui-left').classList.remove('hidden');
        document.getElementById('top-ui-right').classList.remove('hidden');
        // Keep the level/XP bar fully hidden initially. The game-area corner
        // hover zone reveals it without covering canvas interactions.
        UI.toggleLevelBar(true);
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
            const renderer = await GameEngine.rendererReady;
            if (!renderer) {
                throw new Error(GameEngine.lastStartError || 'The graphics renderer is unavailable. Reload the page to try again.');
            }
            const started = loadSavedRun
                ? GameEngine.loadGame()
                : GameEngine.startGame(isSandbox);
            if (!started) {
                throw new Error(GameEngine.lastSaveLoadError || 'Unable to start the game.');
            }
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
        // Listen on the game area instead of adding an overlay, so the reveal
        // zone never intercepts canvas clicks near the bottom-right corner.
        const gameArea = document.getElementById('game-area');
        const levelBar = document.getElementById('level-bar');
        if (gameArea && levelBar) {
            gameArea.addEventListener('mousemove', (e) => {
                if (levelBar.classList.contains('hidden') && GameEngine.gameState !== 'playing' && GameEngine.gameState !== 'paused') return;
                const rect = gameArea.getBoundingClientRect();
                const inCorner = (rect.right - e.clientX) <= 110 && (rect.bottom - e.clientY) <= 110;
                let overBar = false;
                if (!inCorner && !levelBar.classList.contains('hidden')) {
                    const br = levelBar.getBoundingClientRect();
                    overBar = e.clientX >= br.left && e.clientX <= br.right && e.clientY >= br.top && e.clientY <= br.bottom;
                }
                if (inCorner || overBar) {
                    levelBar.classList.remove('hidden');
                } else if (levelBar.classList.contains('collapsed')) {
                    // Collapsed (handle only) + cursor moved away -> hide again.
                    // An expanded panel stays up until the player collapses it.
                    levelBar.classList.add('hidden');
                }
            });
        }
        dom.resumeBtn?.addEventListener('click', () => GameEngine.resumeGame());
        dom.pauseSettingsBtn?.addEventListener('click', () => { GameEngine.lastMenu = 'pause-menu'; UI.toggleMenus('settings-menu'); });
        dom.quitBtn?.addEventListener('click', async () => {
            // Use the shared veil so the battle-to-menu swap is not a hard cut.
            await FadeVeil.through(async () => {
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

controllers.game = gameController;
