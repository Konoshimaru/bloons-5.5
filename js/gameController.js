// js/gameController.js
import { GameEngine } from './engineRef.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { dom } from './dom.js';
import { updateShopPrices } from './dragManager.js';
import { menuController } from './menuController.js';
import { LoadGate } from './loadGate.js';
import { Maps } from './data.js';
import { FadeVeil } from './fadeVeil.js';

import { controllers } from './controllers.js';

export const gameController = {
    async startGameUI(isSandbox) {
        // Ignore double-clicks while the pre-game loading screen is up.
        if (this._starting) return;
        this._starting = true;
        try {
            // v1.3.6: menu -> battle now fades to black first (owner ask).
            // v1.4.2 BUGFIX: the veil used to stay on until the ENTIRE load
            // + battle setup finished, hiding the loading screen (and its
            // minigame) behind black. Now the veil lifts the moment the
            // loading screen shows (onScreen), so progress and the minigame
            // are visible on slow loads; on instant loads nothing ever shows
            // and the veil simply covers the battle swap (lifted in finally).
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
                await LoadGate.ensureMany(
                    [['game'], ['map', Maps[GameEngine.currentMap]]],
                    { label: 'Preparing the battlefield...', onScreen: liftVeil }
                );
                await this._startGameUI(isSandbox);
            } finally {
                liftVeil();
            }
        } finally {
            this._starting = false;
        }
    },

    async _startGameUI(isSandbox) {
        menuController.showMainMenuUI(false);
        UI.toggleMenus(null);
        document.getElementById('sidebar').classList.remove('hidden');
        document.getElementById('top-ui-left').classList.remove('hidden');
        document.getElementById('top-ui-right').classList.remove('hidden');
        // v1.3.2: the level/XP shower starts FULLY hidden (display:none - not
        // even the collapsed handle). Hovering the bottom-right corner reveals
        // it (see the #game-area mousemove wiring in setupGameListeners); it
        // also stays z-indexed UNDER the upgrade panel in game-ui.css.
        // document.getElementById('level-bar').classList.remove('hidden');
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
        // Level-bar corner reveal (v1.3.2): the bar starts display:none; the
        // bottom-right corner of the play area is a hover zone. We listen on
        // #game-area mousemove instead of overlaying a hover div so the zone
        // never swallows canvas clicks (tower placement in that corner).
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
            // v1.3.6: battle -> menu goes through the fade-to-black veil so
            // the swap is a transition instead of a hard cut.
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
