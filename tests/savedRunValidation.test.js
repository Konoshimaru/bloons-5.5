import { describe, expect, it } from 'vitest';
import { Difficulties } from '../js/config.js';
import { validateSavedRun } from '../js/savedRunValidation.js';

const towerStats = {
    dart: { cost: 200 },
    paragon_dart: { cost: 500000 }
};
const heroStats = {
    quincy: { isHero: true, cost: 0 }
};
const paragonTypes = ['dart', 'boomerang'];

function makeSave(overrides = {}) {
    return {
        mapIndex: 0,
        difficultyKey: 'medium',
        lives: 100,
        cash: 650,
        wave: 12,
        towers: [
            { x: 100, y: 200, type: 'dart', upgrades: [2, 1, 0], targeting: 'First', heroLevel: 0 }
        ],
        ...overrides
    };
}

function validate(state) {
    return validateSavedRun(state, {
        mapCount: 3,
        difficulties: Difficulties,
        towerStats,
        heroStats,
        paragonTypes
    });
}

describe('validateSavedRun', () => {
    it('accepts a valid run snapshot', () => {
        expect(validate(makeSave())).toMatchObject({ valid: true, difficultyKey: 'medium' });
    });

    it('supports legacy difficulty display names', () => {
        expect(validate(makeSave({ difficultyKey: undefined, difficulty: 'Double HP MOABs' })))
            .toMatchObject({ valid: true, difficultyKey: 'dhm' });
    });

    it('rejects invalid map indices and unknown difficulties', () => {
        expect(validate(makeSave({ mapIndex: 3 }))).toMatchObject({ valid: false });
        expect(validate(makeSave({ difficultyKey: 'impossible' }))).toMatchObject({ valid: false });
    });

    it('rejects invalid economy and round values', () => {
        expect(validate(makeSave({ lives: Number.NaN }))).toMatchObject({ valid: false });
        expect(validate(makeSave({ cash: -1 }))).toMatchObject({ valid: false });
        expect(validate(makeSave({ wave: 1.5 }))).toMatchObject({ valid: false });
    });

    it('rejects malformed tower lists and unknown tower types', () => {
        expect(validate(makeSave({ towers: null }))).toMatchObject({ valid: false });
        expect(validate(makeSave({ towers: [{ ...makeSave().towers[0], type: 'unknown' }] })))
            .toMatchObject({ valid: false });
    });

    it('rejects malformed tower coordinates and upgrade arrays', () => {
        const original = makeSave().towers[0];
        expect(validate(makeSave({ towers: [{ ...original, x: Number.POSITIVE_INFINITY }] })))
            .toMatchObject({ valid: false });
        expect(validate(makeSave({ towers: [{ ...original, upgrades: [6, 0, 0] }] })))
            .toMatchObject({ valid: false });
        expect(validate(makeSave({ towers: [{ ...original, upgrades: [1, 2] }] })))
            .toMatchObject({ valid: false });
    });

    it('rejects multiple heroes and out-of-range hero levels', () => {
        const hero = { x: 10, y: 10, type: 'quincy', upgrades: [0, 0, 0], heroLevel: 10 };
        expect(validate(makeSave({ towers: [hero, { ...hero }] }))).toMatchObject({ valid: false });
        expect(validate(makeSave({ towers: [{ ...hero, heroLevel: 21 }] }))).toMatchObject({ valid: false });
    });

    it('validates paragon type, degree and investment', () => {
        const paragon = {
            x: 10, y: 10, type: 'paragon_dart', upgrades: [0, 0, 0],
            isParagon: true, paragonBaseType: 'dart', paragonDegree: 100, totalSpent: 500000
        };
        expect(validate(makeSave({ towers: [paragon] })).valid).toBe(true);
        expect(validate(makeSave({ towers: [{ ...paragon, paragonBaseType: 'wizard' }] })).valid).toBe(false);
        expect(validate(makeSave({ towers: [{ ...paragon, paragonDegree: 101 }] })).valid).toBe(false);
        expect(validate(makeSave({ towers: [{ ...paragon, totalSpent: -5 }] })).valid).toBe(false);
    });

    it('does not mutate invalid save data', () => {
        const save = makeSave({ cash: -1 });
        const snapshot = structuredClone(save);
        validate(save);
        expect(save).toEqual(snapshot);
    });
});
