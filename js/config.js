// js/config.js
import { Maps } from './data.js';
import { HeroStats, HeroLevels } from './heroes/index.js';

export { HeroStats, HeroLevels };

export const RANGE_SCALE = 3.0; // Changed from 3.5 to 3.0

export const Config = {
    data: { sfxVolume: 0.5, musicVolume: 0.3, runInBackground: false, autoStart: false, currentMap: 0, showFlavor: true, smoothingEnabled: true, showFps: true, customMaps: [], currentDifficulty: 'medium',
        // NEW MUSIC SETTINGS
        musicShuffle: false,
        musicRandomStart: false,
        musicPlaylist: ['music/music1.mp3', 'music/music2.mp3', 'music/music3.mp3'] },
    load() { 
        try {
            const saved = localStorage.getItem('td_config_v10'); 
            if (saved) this.data = { ...this.data, ...JSON.parse(saved) }; 
            if (!this.data.currentDifficulty) this.data.currentDifficulty = 'medium';
        } catch (e) {
            console.error("Failed to load config, resetting to default.", e);
            this.data = { sfxVolume: 0.5, musicVolume: 0.3, runInBackground: false, autoStart: false, currentMap: 0, showFlavor: true, smoothingEnabled: true, showFps: true, customMaps: [], currentDifficulty: 'medium' };
        }
    },
    save() { 
        try {
            localStorage.setItem('td_config_v10', JSON.stringify(this.data)); 
        } catch (e) {
            console.error("Failed to save config.", e);
        }
    }
};

export const Difficulties = {
    easy: { name: "Easy", lives: 200, cash: 650, costMod: 0.85, speedMod: 0.91, startRound: 1, maxRound: 40 },
    medium: { name: "Medium", lives: 150, cash: 650, costMod: 1.0, speedMod: 1.0, startRound: 1, maxRound: 60 },
    hard: { name: "Hard", lives: 100, cash: 650, costMod: 1.08, speedMod: 1.13, startRound: 3, maxRound: 80 },
    impoppable: { name: "Impoppable", lives: 1, cash: 650, costMod: 1.20, speedMod: 1.13, startRound: 6, maxRound: 100 },
    chimps: { name: "CHIMPS", lives: 1, cash: 650, costMod: 1.08, speedMod: 1.13, startRound: 3, maxRound: 100, noSelling: true, noIncome: true }
};

export const TargetingModes = ['First', 'Last', 'Strong', 'Close'];

if (Array.isArray(Config.data.customMaps)) {
    Maps.push(...Config.data.customMaps);
}