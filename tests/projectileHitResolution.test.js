import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../js/combat.js', () => ({
    spawnExplosion: vi.fn(),
    canBeAoeTarget: vi.fn(() => true),
    creditDamage: vi.fn()
}));
import ProjectileHitResolution from '../js/projectileHitResolution.js';
import { GameEngine } from '../js/engineRef.js';
import { EnemyTypes } from '../js/data.js';
import { GLOBAL_SCALE } from '../js/constants.js';
import { SpatialGrid } from '../js/spatialGrid.js';

function makeEnemy(overrides = {}) {
    return {
        x: 50,
        y: 0,
        radius: 10,
        alive: true,
        isCamo: false,
        untargetable: false,
        damageImmune: false,
        collisionImmune: false,
        ...overrides
    };
}

function makeProjectile(overrides = {}) {
    return {
        x: 100,
        y: 0,
        radius: 5,
        type: 'dart',
        alive: true,
        tower: null,
        hitEnemies: new Set(),
        hit: vi.fn(),
        ...overrides
    };
}

describe('ProjectileHitResolution production swept collision checks', () => {
    beforeEach(() => {
        GameEngine.enemyGrid = new SpatialGrid(40);
    });

    it('hits an enemy crossed between the projectile start and end positions', () => {
        const enemy = makeEnemy({ x: 50, y: 4, radius: 8 });
        GameEngine.enemyGrid.insert(enemy);
        const projectile = makeProjectile();

        ProjectileHitResolution._checkCollisions.call(projectile, 0, 0);

        expect(projectile.hit).toHaveBeenCalledOnce();
        expect(projectile.hit).toHaveBeenCalledWith(enemy);
        expect(projectile.hitEnemies.has(enemy)).toBe(true);
    });

    it('queries far enough to include the largest declared enemy hitbox', () => {
        const largestRadius = Math.max(
            ...Object.values(EnemyTypes).map(type => (type.radius || 10) * GLOBAL_SCALE)
        );
        const largeEnemy = makeEnemy({
            x: -largestRadius,
            y: 0,
            radius: largestRadius
        });
        GameEngine.enemyGrid.insert(largeEnemy);
        const projectile = makeProjectile();

        ProjectileHitResolution._checkCollisions.call(projectile, 0, 0);

        expect(projectile.hit).toHaveBeenCalledWith(largeEnemy);
    });

    it('skips dead, immune, untargetable and camouflaged enemies without camo detection', () => {
        const dead = makeEnemy({ alive: false, x: 30 });
        const immune = makeEnemy({ damageImmune: true, x: 40 });
        const collisionImmune = makeEnemy({ collisionImmune: true, x: 50 });
        const untargetable = makeEnemy({ untargetable: true, x: 60 });
        const camo = makeEnemy({ isCamo: true, x: 70 });
        [dead, immune, collisionImmune, untargetable, camo].forEach(enemy => {
            GameEngine.enemyGrid.insert(enemy);
        });
        const projectile = makeProjectile();

        ProjectileHitResolution._checkCollisions.call(projectile, 0, 0);

        expect(projectile.hit).not.toHaveBeenCalled();
    });

    it('respects prior hit tracking for ordinary projectiles', () => {
        const enemy = makeEnemy();
        GameEngine.enemyGrid.insert(enemy);
        const projectile = makeProjectile();
        projectile.hitEnemies.add(enemy);

        ProjectileHitResolution._checkCollisions.call(projectile, 0, 0);

        expect(projectile.hit).not.toHaveBeenCalled();
    });

    it('allows exempt projectile families to hit an already tracked enemy again', () => {
        const enemy = makeEnemy();
        GameEngine.enemyGrid.insert(enemy);
        const projectile = makeProjectile({ type: 'spike' });
        projectile.hitEnemies.add(enemy);

        ProjectileHitResolution._checkCollisions.call(projectile, 0, 0);

        expect(projectile.hit).toHaveBeenCalledWith(enemy);
        expect(projectile.hitEnemies.has(enemy)).toBe(true);
    });
});
