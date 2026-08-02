// js/beastData.js

export const LAND_BEASTS = [
    { name: "Microraptor", tier: 1, basePower: 1, maxPower: 1, damage: 1, pierce: 5, range: 20, fireRate: 1.0, dmgType: 'sharp', explosionRadius: 10, damageRange: 0, pierceRange: 0, rangeRange: 0, cooldownRange: 0 },
    { name: "Adasaurus", tier: 2, basePower: 3, maxPower: 6, damage: 2, pierce: 8, range: 20, fireRate: 1.0, dmgType: 'normal', explosionRadius: 15, ceramicDmg: 1, damageRange: 2, pierceRange: 4, rangeRange: 0, cooldownRange: 0 },
    { name: "Velociraptor", tier: 3, basePower: 8, maxPower: 24, damage: 4, pierce: 12, range: 24, fireRate: 1.0, dmgType: 'normal', explosionRadius: 18, ceramicDmg: 4, stunDmg: 3, damageRange: 6, pierceRange: 8, rangeRange: 6, cooldownRange: 0.2 },
    { name: "Tyrannosaurus Rex", tier: 4, basePower: 16, maxPower: 64, damage: 20, pierce: 22, range: 30, fireRate: 1.0, dmgType: 'normal', explosionRadius: 18, ceramicDmg: 5, stunDmg: 8, isAbility: true, abilityName: "T-Rex Stomp", abilityCd: 40, damageRange: 30, pierceRange: 10, rangeRange: 10, cooldownRange: 0.25 },
    { name: "Giganotosaurus", tier: 5, basePower: 36, maxPower: 132, damage: 750, pierce: 44, range: 50, fireRate: 1.25, dmgType: 'normal', explosionRadius: 24, stunDmg: 250, isAbility: true, abilityName: "Giganoto Stomp", abilityCd: 25, damageRange: 500, pierceRange: 20, rangeRange: 20, cooldownRange: 0.25 }
];

export const WATER_BEASTS = [
    { name: "Piranha", tier: 1, basePower: 1, maxPower: 1, damage: 1, pierce: 1, range: 30, fireRate: 0.6, dmgType: 'shatter', explosionRadius: 4, damageRange: 0, pierceRange: 0, rangeRange: 0, cooldownRange: 0 },
    { name: "Barracuda", tier: 2, basePower: 3, maxPower: 6, damage: 2, pierce: 4, range: 35, fireRate: 0.6, dmgType: 'shatter', explosionRadius: 8, knockback: 20, damageRange: 2, pierceRange: 4, rangeRange: 0, cooldownRange: 0 },
    { name: "Great White", tier: 3, basePower: 8, maxPower: 24, damage: 0, pierce: 10, range: 40, fireRate: 1.1, dmgType: 'normal', explosionRadius: 15, knockback: 40, canHitLead: true, thrashDamage: 12, thrashFireRate: 0.6, thrashPierce: 10, thrashRadius: 15, damageRange: 6, pierceRange: 8, rangeRange: 6, cooldownRange: 0.2 },
    { name: "Orca", tier: 4, basePower: 16, maxPower: 64, damage: 0, pierce: 20, range: 50, fireRate: 1.1, dmgType: 'normal', explosionRadius: 24, knockback: 80, thrashDamage: 30, thrashFireRate: 0.6, thrashPierce: 20, thrashRadius: 24, moabDmg: 5, damageRange: 30, pierceRange: 10, rangeRange: 10, cooldownRange: 0.25 },
    { name: "Megalodon", tier: 5, basePower: 36, maxPower: 132, damage: 0, pierce: 50, range: 60, fireRate: 1.1, dmgType: 'normal', explosionRadius: 48, knockback: 150, thrashDamage: 600, thrashFireRate: 0.6, thrashPierce: 50, thrashRadius: 48, moabDmg: 50, damageRange: 500, pierceRange: 20, rangeRange: 20, cooldownRange: 0.25 }
];

export const AIR_BEASTS = [
    { name: "Gyrfalcon", tier: 1, basePower: 1, maxPower: 1, damage: 1, pierce: 3, range: 60, fireRate: 1.0, dmgType: 'sharp', explosionRadius: 10, damageRange: 0, pierceRange: 0, rangeRange: 0, cooldownRange: 0 },
    { name: "Horned Owl", tier: 2, basePower: 3, maxPower: 6, damage: 1, pierce: 6, range: 60, fireRate: 1.0, dmgType: 'sharp', explosionRadius: 20, canSeeCamo: true, damageRange: 2, pierceRange: 4, rangeRange: 0, cooldownRange: 0 },
    { name: "Golden Eagle", tier: 3, basePower: 8, maxPower: 24, damage: 1, pierce: 30, range: 60, fireRate: 1.0, dmgType: 'sharp', explosionRadius: 25, damageRange: 6, pierceRange: 8, rangeRange: 6, cooldownRange: 0.2 },
    { name: "Giant Condor", tier: 4, basePower: 16, maxPower: 64, damage: 2, pierce: 30, range: 60, fireRate: 1.0, dmgType: 'sharp', explosionRadius: 25, moabDmg: 11, damageRange: 30, pierceRange: 10, rangeRange: 10, cooldownRange: 0.25 },
    { name: "Pouākai", tier: 5, basePower: 36, maxPower: 132, damage: 10, pierce: 150, range: 60, fireRate: 0.8, dmgType: 'normal', explosionRadius: 45, moabDmg: 80, damageRange: 500, pierceRange: 20, rangeRange: 20, cooldownRange: 0.25 }
];
