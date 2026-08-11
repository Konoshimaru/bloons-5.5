// damageTypes.js
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
    HEAVY:      { isSharp: true, canHitLead: true },
    // In this engine, canHitLead: true also bypasses the Frozen bloon immunity for sharp/ice types!
    SHATTER:    { isSharp: true, canHitLead: true },  // Pops frozen, black, and lead
    FRIGID:     { isIce: true, canHitLead: true },    // Pops frozen, black, and lead, applies freeze
    NONE:       {}
});

export function resolveDmgType(str) {
    if (str === undefined || str === null) return DamageType.SHARP;
    const s = String(str).toLowerCase();
    const map = {
        sharp: DamageType.SHARP,
        explosion: DamageType.EXPLOSION,
        ice: DamageType.ICE,
        plasma: DamageType.PLASMA,
        energy: DamageType.ENERGY,
        fire: DamageType.FIRE,
        magic: DamageType.MAGIC,
        acid: DamageType.ACID,
        heavy: DamageType.HEAVY,
        shatter: DamageType.SHATTER,
        frigid: DamageType.FRIGID,
        glue: DamageType.SHARP
    };
    return map[s] || DamageType.NONE;
}

// Ability flags granted inherently by a base type. Mods can only ADD these,
// never remove them: e.g. FIRE always pops lead even if a caller passes
// canHitLead: false, so towers that upgrade to fire never silently lose the
// type's lead-popping property (Red Hot Rangs bug).
const ADDITIVE_ABILITY_FLAGS = ['canHitLead', 'canHitMoab', 'canHitPurple'];

export function createDmgType(base, mods = {}) {
    if (!base) return { ...mods };
    const merged = { ...base, ...mods };
    for (const flag of ADDITIVE_ABILITY_FLAGS) {
        if (base[flag]) merged[flag] = true;
    }
    return merged;
}
