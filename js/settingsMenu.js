// js/settingsMenu.js
import { Config } from './config.js';
import { GameEngine } from './engine.js';
import { AudioEngine } from './audio.js';
import { dom } from './dom.js';
import { LevelManager } from './levelManager.js';
import { UI } from './ui.js';
import { menuController } from './menuController.js';
import { PixiAssets } from './webgl/pixiAssets.js';

const settingsMenu = {
    _setupSettingsListeners() {
        dom.volumeSlider?.addEventListener('input', (e) => { dom.volDisplay.innerText = e.target.value + '%'; AudioEngine.setSfxVolume(e.target.value / 100); });
        dom.musicSlider?.addEventListener('input', (e) => { dom.musicVolDisplay.innerText = e.target.value + '%'; AudioEngine.setMusicVolume(e.target.value / 100); });
        dom.bgRunCheckbox?.addEventListener('change', (e) => { GameEngine.runInBackground = e.target.checked; Config.data.runInBackground = e.target.checked; Config.save(); });
        dom.flavorTextCheckbox?.addEventListener('change', (e) => { Config.data.showFlavor = e.target.checked; Config.save(); });
        dom.smoothingCheckbox?.addEventListener('change', (e) => { Config.data.smoothingEnabled = e.target.checked; Config.save(); PixiAssets.setSmoothing(e.target.checked); });
        dom.fpsCheckbox?.addEventListener('change', (e) => { Config.data.showFps = e.target.checked; Config.save(); if (dom.fpsDisplay) dom.fpsDisplay.style.display = e.target.checked ? 'block' : 'none'; });
        dom.extremeSpeedCheckbox?.addEventListener('change', (e) => { Config.data.extremeSpeedEnabled = e.target.checked; Config.save(); });
        dom.shuffleMusicCheckbox?.addEventListener('change', (e) => { Config.data.musicShuffle = e.target.checked; Config.save(); });
        dom.randomStartCheckbox?.addEventListener('change', (e) => { Config.data.musicRandomStart = e.target.checked; Config.save(); });
        dom.showStatsCheckbox?.addEventListener('change', (e) => { Config.data.showTowerStats = e.target.checked; Config.save(); });
        
        dom.uncapFpsCheckbox?.addEventListener('change', (e) => { 
            Config.data.uncapFps = e.target.checked; 
            Config.save(); 
            GameEngine.restartLoop(); 
        });
        
        dom.showHitboxesCheckbox?.addEventListener('change', (e) => { 
            Config.data.showHitboxes = e.target.checked; 
            Config.save(); 
        });
        
        const autoToggle = (e) => {
            GameEngine.waveManager.autoWaveEnabled = e.target.checked;
            Config.data.autoStart = e.target.checked;
            Config.save();
            if (dom.autoWaveMenu) dom.autoWaveMenu.checked = e.target.checked;
            if (dom.autoWavePause) dom.autoWavePause.checked = e.target.checked;
        };
        dom.autoWaveMenu?.addEventListener('change', autoToggle);
        dom.autoWavePause?.addEventListener('change', autoToggle);
        dom.prevSongBtn?.addEventListener('click', () => AudioEngine.prevTrack());
        dom.nextSongBtn?.addEventListener('click', () => AudioEngine.nextTrack());
        dom.pausePrevSong?.addEventListener('click', () => AudioEngine.prevTrack());
        dom.pauseNextSong?.addEventListener('click', () => AudioEngine.nextTrack());

        dom.levelFixBtn?.addEventListener('click', () => {
            const result = LevelManager.reconcileLevel();
            if (!dom.levelFixStatus) return;
            if (result.fixedLevels === 0) {
                dom.levelFixStatus.textContent = 'Nothing missing — all rewards already claimed.';
            } else {
                dom.levelFixStatus.textContent = `Fixed ${result.fixedLevels} level(s): +${result.mmGained} Monkey Money, +${result.mkGained} Knowledge, +${result.towersGained} tower(s) unlocked.`;
            }
        });

        // Reset requires a second confirming click to avoid accidental wipes.
        let resetArmed = false;
        let resetArmedTimeout = null;
        dom.resetDataBtn?.addEventListener('click', () => {
            if (!resetArmed) {
                resetArmed = true;
                dom.resetDataBtn.textContent = 'Click again to confirm — this cannot be undone';
                resetArmedTimeout = setTimeout(() => {
                    resetArmed = false;
                    dom.resetDataBtn.textContent = 'Reset All Progress';
                }, 4000);
                return;
            }
            clearTimeout(resetArmedTimeout);
            resetArmed = false;
            Config.resetProgress();
            menuController.applyConfigToUI();
            UI.updateMetaStats();
            dom.resetDataBtn.textContent = 'Reset All Progress';
            if (dom.levelFixStatus) dom.levelFixStatus.textContent = '';
        });
    }
};

export default settingsMenu;
