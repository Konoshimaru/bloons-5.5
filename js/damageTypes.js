// damageTypes.js
// Defines damage categories and special damage interactions used by towers and enemies.

import { deepFreeze } from './utils.js';

export const DamageType = deepFreeze({
    SHARP:      { isSharp: true, canHitLead: false },
    EXPLOSION:  { isExplosion: true, canHitLead: true },
    ICE:        { isIce: true, canHitLead: false },
    PLASMA:     { isPlasma: true, canHitLead: true },
    ENERGY:     { isEnergy: true, canHitLead: true },
    FIRE:       { isFire: true, canHitLead: true },
    MAGIC:      { isMagic: true, canHitLead: false },
    ACID:       { isAcid: true, canHitLead: true },
    HEAVY:      { isSharp: true, canHitLead: true }, // Juggernaut
    NONE:       {}
});

/**
 * Maps a damage type string key to its canonical DamageType constant.
 * Single source of truth — used by towerBehavior.js and tower behavior modules.
 */
export function resolveDmgType(str) {
    return {
        sharp: DamageType.SHARP,
        explosion: DamageType.EXPLOSION,
        ice: DamageType.ICE,
        plasma: DamageType.PLASMA,
        energy: DamageType.ENERGY,
        fire: DamageType.FIRE,
        magic: DamageType.MAGIC,
        acid: DamageType.ACID,
        heavy: DamageType.HEAVY
    }[str] || DamageType.NONE;
}

/**
 * Helper to merge base damage type with dynamic modifiers (MOAB dmg, Fortified dmg, etc.)
 * @param {object} base - The base damage type object.
 * @param {object} mods - The modifiers to apply.
 * @returns {object} A new damage type object.
 */
export function createDmgType(base, mods = {}) {
    // Merge the base damage category with temporary modifiers like crit or special effect flags.
    if (!base) return { ...mods };
    return { ...base, ...mods };
}
