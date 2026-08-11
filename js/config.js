// js/config.js
import { Maps } from './data.js';
import { HeroStats, HeroLevels } from './heroes/index.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';

export { HeroStats, HeroLevels, CANVAS_WIDTH, CANVAS_HEIGHT };
export const RANGE_SCALE = 3.0;

const STORAGE_KEY = 'td_config';
const CURRENT_SCHEMA_VERSION = 16;

const migrations = {
    11: (data) => {
        if (!data.monkeyKnowledge) data.monkeyKnowledge = {};
        if (!data.unlocks) data.unlocks = {};
        if (!Array.isArray(data.unlockedPerks)) data.unlockedPerks = [];
        return data;
    },
    12: (data) => {
        if (!Array.isArray(data.unlockedTowers)) {
            data.unlockedTowers = ['dart', 'boomerang', 'bomb', 'tack', 'ice', 'glue', 'desperado', 'sniper', 'sub', 'buccaneer', 'ace', 'heli', 'mortar', 'dartling', 'super', 'ninja', 'alchemist', 'druid', 'mermonkey', 'farm', 'spike', 'village', 'engineer', 'beast', 'quincy', 'gwendolin', 'sauda', 'gojo', 'geto'];
        }
        return data;
    },
    13: (data) => {
        if (!data.stats) data.stats = { gamesPlayed: 0, highestRound: 0, totalPops: 0 };
        return data;
    },
    14: (data) => {
        if (!data.playerName) data.playerName = "";
        return data;
    },
    15: (data) => {
        if (!data.unlocks) data.unlocks = {};
        if (data.unlocks.farmer === undefined) data.unlocks.farmer = false;
        return data;
    },
    16: (data) => {
        if (!Array.isArray(data.claimedLevels)) {
            // Assume all levels up to current were already claimed normally,
            // so existing players don't get re-granted rewards on first load.
            const current = data.playerLevel || 1;
            data.claimedLevels = [];
            for (let l = 2; l <= current; l++) data.claimedLevels.push(l);
        }
        return data;
    }
};

const DEFAULT_DATA = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
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
    playerXPToNext: 480,
    playerName: "",
    savedRun: null,
    unlockedPerks: [],
    claimedLevels: [],
    extremeSpeedEnabled: false,
    showTowerStats: false,
    uncapFps: false,
    showHitboxes: false, // <-- ADD THIS
    knowledgePoints: 1,
    monkeyKnowledge: {},
    unlocks: {
        extraStartingCash: false,
        extraStartingLives: false,
        freeFirstDartMonkey: false,
        farmer: false
    },
    unlockedTowers: ['dart', 'quincy'],
    stats: {
        gamesPlayed: 0,
        highestRound: 0,
        totalPops: 0
    }
};

export const Config = {
    data: structuredClone(DEFAULT_DATA),
    load() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('td_config_v11');
            let parsed = saved ? JSON.parse(saved) : {};
            
            const savedVersion = parsed.schemaVersion || 1;
            for (let v = savedVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
                if (migrations[v]) {
                    parsed = migrations[v](parsed);
                }
            }
            parsed.schemaVersion = CURRENT_SCHEMA_VERSION;
            
            this.data = { ...structuredClone(DEFAULT_DATA), ...parsed };
            
            if (!Array.isArray(this.data.customMaps)) this.data.customMaps = [];
            if (!this.data.unlocks) this.data.unlocks = {};
            if (!this.data.monkeyKnowledge) this.data.monkeyKnowledge = {};
            if (!Array.isArray(this.data.unlockedPerks)) this.data.unlockedPerks = [];
            if (!Array.isArray(this.data.claimedLevels)) this.data.claimedLevels = [];
            if (!Array.isArray(this.data.unlockedTowers)) this.data.unlockedTowers = ['dart', 'quincy'];
            if (!this.data.stats) this.data.stats = { gamesPlayed: 0, highestRound: 0, totalPops: 0 };
            if (!this.data.playerName) this.data.playerName = "";
            if (this.data.unlocks.farmer === undefined) this.data.unlocks.farmer = false;
            
            if (this.data.unlocks.extraStartingCash === undefined) this.data.unlocks.extraStartingCash = false;
            if (this.data.unlocks.extraStartingLives === undefined) this.data.unlocks.extraStartingLives = false;
            if (this.data.unlocks.freeFirstDartMonkey === undefined) this.data.unlocks.freeFirstDartMonkey = false;
            
            if (this.data.customMaps.length > 0) {
                Maps.push(...this.data.customMaps);
            }
            
            if (localStorage.getItem('td_config_v11')) {
                localStorage.removeItem('td_config_v11');
            }
        } catch (e) {
            console.error("Failed to load config, resetting to default.", e);
            this.data = structuredClone(DEFAULT_DATA);
        }
    },
    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error("Failed to save config.", e);
        }
    },
    // Wipes all player progress (level, XP, MK, unlocks, stats) back to a fresh save.
    // Does NOT touch settings the player likely wants to keep (volume, custom maps, display prefs).
    resetProgress() {
        const preserved = {
            sfxVolume: this.data.sfxVolume,
            musicVolume: this.data.musicVolume,
            runInBackground: this.data.runInBackground,
            autoStart: this.data.autoStart,
            showFlavor: this.data.showFlavor,
            smoothingEnabled: this.data.smoothingEnabled,
            showFps: this.data.showFps,
            customMaps: this.data.customMaps,
            musicShuffle: this.data.musicShuffle,
            musicRandomStart: this.data.musicRandomStart,
            playerName: this.data.playerName,
            uncapFps: this.data.uncapFps,
            showHitboxes: this.data.showHitboxes,
            showTowerStats: this.data.showTowerStats
        };
        this.data = { ...structuredClone(DEFAULT_DATA), ...preserved };
        this.save();
    }
};

export const Difficulties = Object.freeze({
    easy: { name: "Easy", lives: 200, cash: 650, costMod: 0.85, speedMod: 0.91, startRound: 1, maxRound: 40, hpMod: 1.0 },
    medium: { name: "Medium", lives: 150, cash: 650, costMod: 1.0, speedMod: 1.0, startRound: 1, maxRound: 60, hpMod: 1.0 },
    hard: { name: "Hard", lives: 100, cash: 650, costMod: 1.08, speedMod: 1.13, startRound: 3, maxRound: 80, hpMod: 1.0 },
    halfcash: { name: "Half Cash", lives: 100, cash: 325, costMod: 1.08, speedMod: 1.13, startRound: 3, maxRound: 80, incomeMult: 0.5, hpMod: 1.0 },
    dhm: { name: "Double HP MOABs", lives: 100, cash: 650, costMod: 1.08, speedMod: 1.13, startRound: 3, maxRound: 80, moabHpMod: 2.0, hpMod: 1.0 },
    deflation: { name: "Deflation", lives: 200, cash: 20000, costMod: 0.85, speedMod: 0.91, startRound: 31, maxRound: 60, noIncome: true, hpMod: 1.0 },
    impoppable: { name: "Impoppable", lives: 1, cash: 650, costMod: 1.20, speedMod: 1.13, startRound: 6, maxRound: 100, hpMod: 1.0 },
    chimps: { name: "CHIMPS", lives: 1, cash: 650, costMod: 1.08, speedMod: 1.13, startRound: 3, maxRound: 100, noSelling: true, noIncome: true, allowWaveCash: true, hpMod: 1.0 },
    abr: { name: "Alternate Bloons Rounds", lives: 100, cash: 650, costMod: 1.08, speedMod: 1.13, startRound: 3, maxRound: 80, hpMod: 1.0, isABR: true },
    postchimps: { name: "Post CHIMPS", lives: 1, cash: 1150, costMod: 1.50, speedMod: 1.13, startRound: 3, maxRound: 120, noSelling: true, noIncome: true, allowWaveCash: true, hpMod: 1.0, isPostChimps: true }
});

Object.values(Difficulties).forEach(Object.freeze);

export const TargetingModes = Object.freeze(['First', 'Last', 'Strong', 'Close', 'Smart']);
