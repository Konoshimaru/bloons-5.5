// @vitest-environment jsdom
// Cheat suite (v1.3.1): the Konoshi profile gate + the "unlock everything"
// grant. Pure meta-progression: real Config module against jsdom localStorage,
// same recipe as paragonFlow.test.js (no engine needed - cheats.js only
// touches Config-shaped objects).
import { describe, it, expect, beforeAll } from 'vitest';

import { Config } from '../js/config.js';
import { TowerStats } from '../js/towers/index.js';
import { HeroRegistry } from '../js/heroes/index.js';
import { PARAGON_POWER_RULES } from '../js/paragonPower.js';
import MKData from '../js/monkeyKnowledgeData.js';
import { isCheater, unlockEverything, CHEAT_NAME } from '../js/cheats.js';

function allMkIds() {
    const ids = [];
    for (const fn of Object.values(MKData)) {
        if (typeof fn !== 'function') continue;
        const nodes = fn();
        if (Array.isArray(nodes)) for (const n of nodes) if (n && n.id) ids.push(n.id);
    }
    return ids;
}

beforeAll(() => {
    Config.load();
});

describe('cheat gate: only the Konoshi profile sees it', () => {
    it('accepts the name case-insensitively and trims whitespace', () => {
        Config.data.playerName = 'Konoshi';
        expect(isCheater(Config)).toBe(true);
        Config.data.playerName = 'konoshi';
        expect(isCheater(Config)).toBe(true);
        Config.data.playerName = '  KONOSHI  ';
        expect(isCheater(Config)).toBe(true);
        Config.data.playerName = CHEAT_NAME;
        expect(isCheater(Config)).toBe(true);
    });

    it('rejects every other name (and empty/missing)', () => {
        Config.data.playerName = 'Player';
        expect(isCheater(Config)).toBe(false);
        Config.data.playerName = 'Konoshi2';
        expect(isCheater(Config)).toBe(false);
        Config.data.playerName = 'isKonoshi';
        expect(isCheater(Config)).toBe(false);
        Config.data.playerName = '';
        expect(isCheater(Config)).toBe(false);
        Config.data.playerName = null;
        expect(isCheater(Config)).toBe(false);
    });
});

describe('unlockEverything grants the full meta progression', () => {
    it('unlocks every tower AND hero, all paragons, and all monkey knowledge', () => {
        // Start from a deliberately sparse profile.
        Config.data.unlockedTowers = ['dart'];
        Config.data.paragonUnlocks = {};
        Config.data.towerXp = {};
        Config.data.monkeyKnowledge = {};
        Config.data.knowledgePoints = 0;
        Config.data.playerName = 'Konoshi';

        const res = unlockEverything(Config);

        const towers = Object.keys(TowerStats).filter(k => !k.startsWith('paragon_'));
        const heroes = Object.keys(HeroRegistry);
        for (const t of [...towers, ...heroes]) {
            expect(Config.data.unlockedTowers).toContain(t);
        }
        // Paragons themselves are never "unlocked towers" (shop-excluded).
        for (const k of Object.keys(TowerStats).filter(k => k.startsWith('paragon_'))) {
            expect(Config.data.unlockedTowers).not.toContain(k);
        }

        for (const key of Object.keys(PARAGON_POWER_RULES)) {
            expect(Config.data.paragonUnlocks[key]).toBe(true);
            expect(Config.data.towerXp[key]).toBeGreaterThanOrEqual(PARAGON_POWER_RULES[key].xpToUnlock);
        }
        expect(res.paragons).toBe(Object.keys(PARAGON_POWER_RULES).length);

        const mkIds = allMkIds();
        expect(mkIds.length).toBeGreaterThan(0);
        for (const id of mkIds) expect(Config.data.monkeyKnowledge[id]).toBe(true);
        expect(Config.data.knowledgePoints).toBeGreaterThanOrEqual(999);
        expect(res.towers).toBe(towers.length + heroes.length);
        expect(res.knowledge).toBe(mkIds.length);
    });

    it('persists through Config.save and preserves money/level/stats', () => {
        Config.data.monkeyMoney = 1234;
        Config.data.playerLevel = 7;
        Config.data.playerXP = 250;
        Config.data.stats = { gamesPlayed: 3, highestRound: 42, totalPops: 9999 };

        unlockEverything(Config);

        const saved = JSON.parse(localStorage.getItem('td_config'));
        expect(saved.paragonUnlocks.dart).toBe(true);
        expect(saved.monkeyMoney).toBe(1234);
        expect(saved.playerLevel).toBe(7);
        expect(saved.stats.totalPops).toBe(9999);
    });

    it('is idempotent - running it twice changes nothing further', () => {
        const first = unlockEverything(Config);
        const towersSnapshot = [...Config.data.unlockedTowers].sort();
        const second = unlockEverything(Config);
        expect(second).toEqual(first);
        expect([...Config.data.unlockedTowers].sort()).toEqual(towersSnapshot);
    });
});
