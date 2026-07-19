// config.js
import { Maps } from './data.js';
import { HeroStats, HeroLevels } from './heroes/index.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';

export { HeroStats, HeroLevels, CANVAS_WIDTH, CANVAS_HEIGHT };
export const RANGE_SCALE = 3.0;

const STORAGE_KEY = 'td_config_v11';

const DEFAULT_DATA = {
    sfxVolume: 0.5,
    musicVolume: 0.3,
    runInBackground: false,
    autoStart: false,
    currentMap: 0,
    showFlavor: true,
    smoothingEnabled: true,
    showFps: true,
    customMaps: [],
    currentDifficulty: 'medium',
    musicShuffle: false,
    musicRandomStart: false,
    monkeyMoney: 0,
    playerLevel: 1,
    playerXP: 0,
    playerXPToNext: 1000,
    savedRun: null,
    unlockedPerks: [],
    extremeSpeedEnabled: false,
    showTowerStats: false,
    uncapFps: false,
    knowledgePoints: 1, // <-- ADD THIS (Starting KP)
    monkeyKnowledge: {}, // <-- ADD THIS (Tracks unlocked nodes)
    unlocks: {
        extraStartingCash: false,
        extraStartingLives: false,
        freeFirstDartMonkey: false
    }
};

export const Config = {
    data: { ...DEFAULT_DATA },
    load() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.data = { ...DEFAULT_DATA, ...parsed };
            }
            if (!Array.isArray(this.data.customMaps)) this.data.customMaps = [];
            if (typeof this.data.currentMap !== 'number') this.data.currentMap = 0;
            if (!this.data.currentDifficulty) this.data.currentDifficulty = 'medium';
            if (!this.data.monkeyMoney) this.data.monkeyMoney = 0;
            if (!this.data.playerLevel) this.data.playerLevel = 1;
            if (!this.data.playerXP) this.data.playerXP = 0;
            if (!this.data.playerXPToNext) this.data.playerXPToNext = 1000;
            if (!this.data.extremeSpeedEnabled) this.data.extremeSpeedEnabled = false;
            if (this.data.showTowerStats === undefined) this.data.showTowerStats = false;
            if (this.data.uncapFps === undefined) this.data.uncapFps = false; // NEW
            if (!this.data.unlocks) this.data.unlocks = {};
            if (this.data.unlocks.extraStartingCash === undefined) this.data.unlocks.extraStartingCash = false;
            if (this.data.unlocks.extraStartingLives === undefined) this.data.unlocks.extraStartingLives = false;
            if (this.data.unlocks.freeFirstDartMonkey === undefined) this.data.unlocks.freeFirstDartMonkey = false;
            if (this.data.customMaps.length > 0) {
                Maps.push(...this.data.customMaps);
            }
        } catch (e) {
            console.error("Failed to load config, resetting to default.", e);
            this.data = { ...DEFAULT_DATA };
        }
    },
    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error("Failed to save config.", e);
        }
    }
};

export const Difficulties = Object.freeze({
    easy: { name: "Easy", lives: 200, cash: 650, costMod: 0.85, speedMod: 0.91, startRound: 1, maxRound: 40, hpMod: 1.0 },
    medium: { name: "Medium", lives: 150, cash: 650, costMod: 1.0, speedMod: 1.0, startRound: 1, maxRound: 60, hpMod: 1.0 },
    hard: { name: "Hard", lives: 100, cash: 650, costMod: 1.08, speedMod: 1.13, startRound: 3, maxRound: 80, hpMod: 1.0 },
    impoppable: { name: "Impoppable", lives: 1, cash: 650, costMod: 1.20, speedMod: 1.13, startRound: 6, maxRound: 100, hpMod: 1.0 },
    chimps: { name: "CHIMPS", lives: 1, cash: 650, costMod: 1.08, speedMod: 1.13, startRound: 3, maxRound: 100, noSelling: true, noIncome: true, allowWaveCash: true, hpMod: 1.0 },
    postchimps: { name: "Post CHIMPS", lives: 1, cash: 1150, costMod: 1.50, speedMod: 1.13, startRound: 3, maxRound: 120, noSelling: true, noIncome: true, allowWaveCash: true, hpMod: 1.0, isPostChimps: true }
});

Object.values(Difficulties).forEach(Object.freeze);

// Update the TargetingModes array to include the new Spike Factory modes
export const TargetingModes = Object.freeze(['First', 'Last', 'Strong', 'Close', 'Smart']);