// js/config.js
import { Maps } from './data.js';
import { HeroStats, HeroLevels } from './heroes/index.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';

export { HeroStats, HeroLevels, CANVAS_WIDTH, CANVAS_HEIGHT };
export const RANGE_SCALE = 3.0;

const STORAGE_KEY = 'td_config';
const CURRENT_SCHEMA_VERSION = 15;

const migrations = {
    11: (data) => {
        if (!data.monkeyKnowledge) data.monkeyKnowledge = {};
        if (!data.unlocks) data.unlocks = {};
        if (!Array.isArray(data.unlockedPerks)) data.unlockedPerks = [];
        return data;
    },
    12: (data) => {
        if (!Array.isArray(data.unlockedTowers)) {
            data.unlockedTowers = ['dart', 'boomerang', 'bomb', 'tack', 'ice', 'glue', 'desperado', 'sniper', 'sub', 'buccaneer', 'ace', 'heli', 'mortar', 'dartling', 'wizard', 'super', 'ninja', 'alchemist', 'druid', 'mermonkey', 'farm', 'spike', 'village', 'engineer', 'beast', 'quincy', 'gwendolin', 'sauda', 'gojo', 'geto'];
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
    unlockedTowers: ['dart', 'wizard', 'quincy'],
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
            if (!Array.isArray(this.data.unlockedTowers)) this.data.unlockedTowers = ['dart', 'wizard', 'quincy'];
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

export const TargetingModes = Object.freeze(['First', 'Last', 'Strong', 'Close', 'Smart']);