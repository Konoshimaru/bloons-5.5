// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { Config } from '../js/config.js';
import { Maps } from '../js/data.js';

const originalData = structuredClone(Config.data);
const originalMapCount = Maps.length;

afterEach(() => {
    localStorage.clear();
    Config.data = structuredClone(originalData);
    Maps.length = originalMapCount;
});

describe('Config schema migration persistence', () => {
    it('promotes td_config_v11 to td_config before removing the legacy key', () => {
        const savedRun = {
            mapIndex: 0,
            difficultyKey: 'medium',
            lives: 75,
            cash: 420,
            wave: 8,
            towers: [],
        };
        localStorage.setItem('td_config_v11', JSON.stringify({
            schemaVersion: 11,
            playerName: 'Legacy Player',
            monkeyMoney: 321,
            playerLevel: 4,
            customMaps: [],
            savedRun,
        }));

        Config.load();

        expect(Config.data.playerName).toBe('Legacy Player');
        expect(Config.data.monkeyMoney).toBe(321);
        expect(Config.data.savedRun).toEqual(savedRun);
        expect(Config.data.schemaVersion).toBe(17);
        expect(Config.data.towerXp).toEqual({});
        expect(Config.data.paragonUnlocks).toEqual({});
        expect(localStorage.getItem('td_config_v11')).toBeNull();

        const persisted = JSON.parse(localStorage.getItem('td_config'));
        expect(persisted.schemaVersion).toBe(17);
        expect(persisted.playerName).toBe('Legacy Player');
        expect(persisted.savedRun).toEqual(savedRun);

        // A fresh load must now read the promoted key rather than reset progress.
        Config.data.playerName = 'temporary in-memory value';
        Config.load();
        expect(Config.data.playerName).toBe('Legacy Player');
        expect(Config.data.savedRun).toEqual(savedRun);
    });

    it('writes migrations from an older td_config schema back to the same key', () => {
        localStorage.setItem('td_config', JSON.stringify({
            schemaVersion: 15,
            playerName: 'Existing Player',
            playerLevel: 4,
            customMaps: [],
            unlocks: {},
        }));

        Config.load();

        const persisted = JSON.parse(localStorage.getItem('td_config'));
        expect(persisted.schemaVersion).toBe(17);
        expect(persisted.playerName).toBe('Existing Player');
        expect(persisted.claimedLevels).toEqual([2, 3, 4]);
        expect(persisted.towerXp).toEqual({});
        expect(persisted.paragonUnlocks).toEqual({});
    });
});
