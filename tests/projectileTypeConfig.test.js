import { describe, expect, it } from 'vitest';
import { ProjectileTypeConfig } from '../js/projectileTypeConfig.js';

describe('ProjectileTypeConfig production data', () => {
    it('marks explosive projectile families and their display colors', () => {
        for (const type of ['bomb', 'missile', 'mortar_shell', 'flash_bomb', 'sticky_bomb']) {
            expect(ProjectileTypeConfig[type]).toMatchObject({
                isExplosive: true,
                explosionColor: '#e67e22'
            });
        }
        expect(ProjectileTypeConfig.potion).toMatchObject({
            isExplosive: true,
            isAcid: true,
            explosionColor: '#9b59b6'
        });
        expect(ProjectileTypeConfig.ice_bomb).toMatchObject({
            isExplosive: true,
            explosionColor: '#1abc9c'
        });
    });

    it('retains specialized pierce and hit-tracking behavior', () => {
        expect(ProjectileTypeConfig.spike.exemptFromHitTracking).toBe(true);
        expect(ProjectileTypeConfig.spike_opult.exemptFromHitTracking).toBe(true);
        expect(ProjectileTypeConfig.juggernaut.exemptFromHitTracking).toBe(true);
        expect(ProjectileTypeConfig.ultra_juggernaut).toMatchObject({
            exemptFromHitTracking: true,
            splitsOnZeroPierce: true
        });
        expect(ProjectileTypeConfig.apex_ball.apexSplit).toBe(true);
        expect(ProjectileTypeConfig.boomerang.survivesZeroPierce).toBe(true);
        expect(ProjectileTypeConfig.arrow.decrementsPierceOnExplosion).toBe(true);
        expect(ProjectileTypeConfig.thorn.exemptFromHitTracking).toBe(true);
    });

    it('configures all Beast Handler projectile variants', () => {
        const expected = {
            beast_attack: '#3498db',
            beast_water: '#2980b9',
            beast_land: '#27ae60',
            beast_air: '#f1c40f'
        };
        for (const [type, color] of Object.entries(expected)) {
            expect(ProjectileTypeConfig[type]).toMatchObject({
                isExplosive: true,
                explosionColor: color,
                decrementsPierceOnExplosion: true
            });
        }
    });

    it('leaves regular projectile variants on the default standard-hit path', () => {
        for (const type of ['blue', 'trident', 'wavelet', 'ice_ball', 'tentacle']) {
            expect(Object.hasOwn(ProjectileTypeConfig, type)).toBe(false);
            expect(ProjectileTypeConfig[type] || {}).toEqual({});
        }
    });
});
