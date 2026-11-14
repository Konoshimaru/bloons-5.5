// js/savedRunValidation.js
// Pure validation for persisted run snapshots. Keep this module free of DOM,
// engine, and browser-storage dependencies so the save format can be tested.
const isRecord = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

const isFiniteNumber = (value) =>
    typeof value === 'number' && Number.isFinite(value);

function resolveDifficulty(state, difficulties) {
    const raw = typeof state.difficultyKey === 'string'
        ? state.difficultyKey
        : typeof state.difficulty === 'string'
            ? state.difficulty
            : 'medium';

    const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
    const entry = Object.entries(difficulties).find(([key, data]) =>
        key.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized ||
        data.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized
    );

    return entry ? entry[0] : null;
}

/**
 * Validates a persisted save before it mutates the live singleton engine.
 * Returns a canonical difficulty key with the validation result.
 */
export function validateSavedRun(state, {
    mapCount,
    difficulties,
    towerStats,
    heroStats,
    paragonTypes = []
} = {}) {
    const invalid = (reason) => ({ valid: false, reason });

    if (!isRecord(state)) return invalid('Save data is not an object.');
    if (!Number.isInteger(mapCount) || mapCount < 1) {
        return invalid('No maps are available to load.');
    }
    if (!Number.isInteger(state.mapIndex) || state.mapIndex < 0 || state.mapIndex >= mapCount) {
        return invalid('Saved map index is out of range.');
    }

    const difficultyKey = resolveDifficulty(state, difficulties || {});
    if (!difficultyKey) return invalid('Saved difficulty is unknown.');

    if (!isFiniteNumber(state.lives) || state.lives < 0) {
        return invalid('Saved lives value is invalid.');
    }
    if (!isFiniteNumber(state.cash) || state.cash < 0) {
        return invalid('Saved cash value is invalid.');
    }
    if (!Number.isInteger(state.wave) || state.wave < 0) {
        return invalid('Saved wave number is invalid.');
    }
    if (!Array.isArray(state.towers)) {
        return invalid('Saved tower list is missing or invalid.');
    }

    let heroCount = 0;
    for (let i = 0; i < state.towers.length; i++) {
        const tower = state.towers[i];
        if (!isRecord(tower)) return invalid(`Tower #${i + 1} is not an object.`);
        if (!isFiniteNumber(tower.x) || !isFiniteNumber(tower.y)) {
            return invalid(`Tower #${i + 1} has invalid coordinates.`);
        }
        if (typeof tower.type !== 'string') {
            return invalid(`Tower #${i + 1} has no valid type.`);
        }

        const stats = towerStats?.[tower.type] || heroStats?.[tower.type];
        if (!stats) return invalid(`Tower #${i + 1} uses unknown type "${tower.type}".`);
        if (stats.isHero) heroCount++;
        if (!Array.isArray(tower.upgrades) || tower.upgrades.length !== 3 ||
            !tower.upgrades.every(tier => Number.isInteger(tier) && tier >= 0 && tier <= 5)) {
            return invalid(`Tower #${i + 1} has invalid upgrade tiers.`);
        }
        if (tower.targeting !== undefined &&
            (typeof tower.targeting !== 'string' || tower.targeting.length > 40)) {
            return invalid(`Tower #${i + 1} has invalid targeting data.`);
        }
        if (stats.isHero && tower.heroLevel !== undefined &&
            (!Number.isInteger(tower.heroLevel) || tower.heroLevel < 0 || tower.heroLevel > 20)) {
            return invalid(`Hero #${i + 1} has an invalid level.`);
        }

        if (tower.isParagon) {
            if (!paragonTypes.includes(tower.paragonBaseType || 'dart')) {
                return invalid(`Paragon #${i + 1} has an unsupported base type.`);
            }
            if (tower.paragonDegree !== undefined &&
                (!Number.isInteger(tower.paragonDegree) || tower.paragonDegree < 1 || tower.paragonDegree > 100)) {
                return invalid(`Paragon #${i + 1} has an invalid degree.`);
            }
            if (tower.totalSpent !== undefined &&
                (!isFiniteNumber(tower.totalSpent) || tower.totalSpent < 0)) {
                return invalid(`Paragon #${i + 1} has an invalid total investment.`);
            }
        }
    }

    if (heroCount > 1) return invalid('Save contains more than one hero.');

    return { valid: true, reason: null, difficultyKey };
}
