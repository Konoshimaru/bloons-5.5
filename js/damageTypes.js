// js/damageTypes.js
export const DamageType = {
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
};

// Helper to merge base damage type with dynamic modifiers (MOAB dmg, Fortified dmg, etc.)
export function createDmgType(base, mods = {}) {
    return { ...base, ...mods };
}