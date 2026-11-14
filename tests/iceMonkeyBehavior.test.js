// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../js/engineRef.js', () => ({
    GameEngine: {
        nightAlpha: 0,
        waveManager: { currentWave: 1 },
        enemies: [],
        towers: [],
        explosions: [],
        hasIceShardTower: false,
        enemyGrid: { query: vi.fn(() => []) },
        projectilePool: { active: [], get: vi.fn() }
    }
}));
vi.mock('../js/audio.js', () => ({
    AudioEngine: { playSfx: vi.fn() }
}));
vi.mock('../js/assets.js', () => ({
    default: { get: () => null }
}));

import { GameEngine } from '../js/engineRef.js';
import { Enemy } from '../js/enemy.js';
import iceBehavior from '../js/towers/ice.js';
import { DamageType } from '../js/damageTypes.js';

function makeEnemy(overrides = {}) {
    const enemy = new Enemy();
    Object.assign(enemy, {
        x: 20,
        y: 0,
        alive: true,
        data: {
            isWhite: false,
            isZebra: false,
            isLead: false,
            isMoab: false,
            isCeramic: false,
            isBAD: false
        },
        isCamo: false,
        isRegen: false,
        isFrozen: false,
        slowFactor: 1,
        slowTimer: 0,
        brittle: false,
        brittleBonus: 0,
        permafrostSlow: 1,
        takeDamage: vi.fn(() => 1)
    }, overrides);
    return enemy;
}

function makeTower(stats = {}) {
    return {
        type: 'ice',
        x: 0,
        y: 0,
        buffedRange: 0,
        buffedCamo: false,
        damageDealt: 0,
        upgrades: [0, 0, 0],
        stats: {
            range: 20,
            pierce: 40,
            freezeDuration: 1.5,
            ...stats
        }
    };
}

describe('Ice Monkey production behavior', () => {
    beforeEach(() => {
        GameEngine.nightAlpha = 0;
        GameEngine.waveManager = { currentWave: 1 };
        GameEngine.explosions.length = 0;
        GameEngine.enemyGrid.query.mockReset();
    });

    it('uses the real Enemy.applySlow method to freeze a target', () => {
        const enemy = makeEnemy();
        GameEngine.enemyGrid.query.mockReturnValue([enemy]);

        iceBehavior.fire(makeTower(), enemy, 1, DamageType.ICE, false, {});

        expect(enemy.isFrozen).toBe(true);
        expect(enemy.slowFactor).toBe(0);
        expect(enemy.slowTimer).toBeGreaterThan(0);
        expect(enemy.takeDamage).toHaveBeenCalled();
    });

    it('Embrittlement strips Camo and Regrow and applies brittle state', () => {
        const enemy = makeEnemy({ isCamo: true, isRegen: true });
        GameEngine.enemyGrid.query.mockReturnValue([enemy]);

        iceBehavior.fire(
            makeTower({ canSeeCamo: true, embrittlement: true }),
            enemy,
            1,
            DamageType.ICE,
            false,
            {}
        );

        expect(enemy.isCamo).toBe(false);
        expect(enemy.isRegen).toBe(false);
        expect(enemy.brittle).toBe(true);
        expect(enemy.brittleBonus).toBe(1);
        expect(enemy.brittleTimer).toBe(2);
        expect(enemy.isFrozen).toBe(true);
    });

    it('does not freeze White or Zebra bloons with the base attack', () => {
        const white = makeEnemy({ data: { isWhite: true, isZebra: false, isLead: false, isMoab: false } });
        const zebra = makeEnemy({ data: { isWhite: false, isZebra: true, isLead: false, isMoab: false }, x: 25 });
        GameEngine.enemyGrid.query.mockReturnValue([white, zebra]);

        iceBehavior.fire(makeTower(), null, 1, DamageType.ICE, false, {});

        expect(white.isFrozen).toBe(false);
        expect(zebra.isFrozen).toBe(false);
        expect(white.takeDamage).not.toHaveBeenCalled();
        expect(zebra.takeDamage).not.toHaveBeenCalled();
    });

    it('applies the Permafrost slow modifier to a successfully frozen target', () => {
        const enemy = makeEnemy();
        GameEngine.enemyGrid.query.mockReturnValue([enemy]);

        iceBehavior.fire(makeTower({ permafrost: true }), null, 1, DamageType.ICE, false, {});

        expect(enemy.isFrozen).toBe(true);
        expect(enemy.permafrostSlow).toBe(0.5);
    });
});
