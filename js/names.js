// names.js
// Provides naming helpers for enemies, towers, and other game labels.

const ENEMY_PREFIX = 'enemy_';
const PROJECTILE_PREFIX = 'proj_';
const TOWER_PREFIX = 'tower_';
const EFFECT_PREFIX = 'effect_';
const MAP_PREFIX = 'map_';

const ENEMY_NAMES = [
    null, 'red', 'blue', 'green', 'yellow', 'pink', 'black', 'white', 'lead', 
    'zebra', 'purple', 'rainbow', 'ceramic', 'moab', 'bfb', 'zomg', 'ddt', 'bad'
];

export const Names = {
    PREFIXES: Object.freeze({
        ENEMY: ENEMY_PREFIX,
        PROJECTILE: PROJECTILE_PREFIX,
        TOWER: TOWER_PREFIX,
        EFFECT: EFFECT_PREFIX,
        MAP: MAP_PREFIX
    }),

    ENEMIES: Object.freeze(ENEMY_NAMES),

    getEnemy(tier) {
        return `${ENEMY_PREFIX}${ENEMY_NAMES[tier]}`;
    },

    getEnemyWithModifiers(tier, isCamo, isRegen) {
        const base = ENEMY_NAMES[tier];
        if (isCamo && isRegen) return `${ENEMY_PREFIX}${base}_regen_camo`;
        if (isCamo) return `${ENEMY_PREFIX}${base}_camo`;
        if (isRegen) return `${ENEMY_PREFIX}${base}_regen`;
        return `${ENEMY_PREFIX}${base}`;
    },

    getProjectile(type) {
        return `${PROJECTILE_PREFIX}${type}`;
    },

    getTowerBase(type) {
        return `${TOWER_PREFIX}${type}_base`;
    },

    getTowerArm(type) {
        return `${TOWER_PREFIX}${type}_arm`;
    },

    getTowerUpgradeBase(type, path, tier) {
        return `${TOWER_PREFIX}${type}_p${path}_t${tier}_base`;
    },

    getTowerUpgradeArm(type, path, tier) {
        return `${TOWER_PREFIX}${type}_p${path}_t${tier}_arm`;
    },

    getPopEffect(variant = 1) {
        return variant === 1 ? `${EFFECT_PREFIX}pop` : `${EFFECT_PREFIX}pop${variant}`;
    },

    getMoabCrack() {
        return `${EFFECT_PREFIX}moab_crack`;
    },

    getCeramicCrack() {
        return `${EFFECT_PREFIX}ceramic_crack`;
    },

    getBanana() {
        return `${EFFECT_PREFIX}banana`;
    },

    getMap(name) {
        return `${MAP_PREFIX}${name}`;
    },

    getCamo() {
        return `${EFFECT_PREFIX}camo`;
    },

    getFortified() {
        return `${EFFECT_PREFIX}fortified`;
    },

    getRegen() {
        return `${EFFECT_PREFIX}regen`;
    },

    getStunFX(frame) {
        return `${EFFECT_PREFIX}stun_${frame}`;
    }
};

Object.freeze(Names);
