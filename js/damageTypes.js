const _deepFreeze = (obj) => {
    if (obj && typeof obj === 'object') {
        Object.values(obj).forEach(_deepFreeze);
        Object.freeze(obj);
    }
    return obj;
};

export const DamageType = _deepFreeze({
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
 * Helper to merge base damage type with dynamic modifiers (MOAB dmg, Fortified dmg, etc.)
 * @param {object} base - The base damage type object.
 * @param {object} mods - The modifiers to apply.
 * @returns {object} A new damage type object.
 */
export function createDmgType(base, mods = {}) {
    if (!base) return { ...mods };
    return { ...base, ...mods };
}