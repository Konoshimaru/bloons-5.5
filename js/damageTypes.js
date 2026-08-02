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
    if (!str) return DamageType.SHARP;
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
    return map[str.toLowerCase()] || DamageType.NONE;
}

export function createDmgType(base, mods = {}) {
    if (!base) return { ...mods };
    return { ...base, ...mods };
}
