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
    NONE:       {}
});

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
        heavy: DamageType.HEAVY,
        glue: DamageType.SHARP // PRO FIX: Glue now resolves to SHARP so it respects immunities properly
    }[str] || DamageType.NONE;
}

export function createDmgType(base, mods = {}) {
    if (!base) return { ...mods };
    return { ...base, ...mods };
}