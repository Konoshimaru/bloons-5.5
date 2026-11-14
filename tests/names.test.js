import { describe, expect, it } from 'vitest';
import { Names } from '../js/names.js';

describe('Names production helpers', () => {
    it('exposes immutable prefix and enemy-name tables', () => {
        expect(Names.PREFIXES).toEqual({
            ENEMY: 'enemy_',
            PROJECTILE: 'proj_',
            TOWER: 'tower_',
            EFFECT: 'effect_',
            MAP: 'map_'
        });
        expect(Names.ENEMIES[1]).toBe('red');
        expect(Names.ENEMIES[17]).toBe('bad');
        expect(Object.isFrozen(Names)).toBe(true);
        expect(Object.isFrozen(Names.PREFIXES)).toBe(true);
        expect(Object.isFrozen(Names.ENEMIES)).toBe(true);
    });

    it('builds enemy identifiers with camo/regen suffixes in the shared order', () => {
        expect(Names.getEnemy(1)).toBe('enemy_red');
        expect(Names.getEnemyWithModifiers(5, false, false)).toBe('enemy_pink');
        expect(Names.getEnemyWithModifiers(5, true, false)).toBe('enemy_pink_camo');
        expect(Names.getEnemyWithModifiers(5, false, true)).toBe('enemy_pink_regen');
        expect(Names.getEnemyWithModifiers(5, true, true)).toBe('enemy_pink_regen_camo');
    });

    it('resolves matching enemy sprite paths, including missing tiers', () => {
        expect(Names.getEnemySpriteFile(8, false, false)).toBe('sprites/enemies/lead.png');
        expect(Names.getEnemySpriteFile(8, true, false)).toBe('sprites/enemies/lead_camo.png');
        expect(Names.getEnemySpriteFile(8, false, true)).toBe('sprites/enemies/lead_regen.png');
        expect(Names.getEnemySpriteFile(8, true, true)).toBe('sprites/enemies/lead_regen_camo.png');
        expect(Names.getEnemySpriteFile(0, false, false)).toBeNull();
    });

    it('builds projectile, tower, upgrade, map and effect keys consistently', () => {
        expect(Names.getProjectile('bomb')).toBe('proj_bomb');
        expect(Names.getTowerBase('dart')).toBe('tower_dart_base');
        expect(Names.getTowerArm('dart')).toBe('tower_dart_arm');
        expect(Names.getTowerUpgradeBase('dart', 2, 3)).toBe('tower_dart_p2_t3_base');
        expect(Names.getTowerUpgradeArm('dart', 2, 3)).toBe('tower_dart_p2_t3_arm');
        expect(Names.getMap('maze')).toBe('map_maze');
    });

    it('builds shared effect variants and utility effect keys', () => {
        expect(Names.getPopEffect()).toBe('effect_pop');
        expect(Names.getPopEffect(3)).toBe('effect_pop3');
        expect(Names.getMoabCrack()).toBe('effect_moab_crack');
        expect(Names.getCeramicCrack()).toBe('effect_ceramic_crack');
        expect(Names.getBanana()).toBe('effect_banana');
        expect(Names.getCamo()).toBe('effect_camo');
        expect(Names.getFortified()).toBe('effect_fortified');
        expect(Names.getRegen()).toBe('effect_regen');
        expect(Names.getStunFX(4)).toBe('effect_stun_4');
    });
});
