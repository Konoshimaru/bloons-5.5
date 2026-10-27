import { BASE_SPEED } from './constants.js';

export const EnemyTypesData = {
    1: { color: '#e74c3c', radius: 12, size: 24, speed: BASE_SPEED * 1.0, nextTier: null, rbe: 1, maxHp: 1 },
    2: { color: '#3498db', radius: 14, size: 28, speed: BASE_SPEED * 1.4, nextTier: 1, rbe: 2, maxHp: 1 },
    3: { color: '#2ecc71', radius: 16, size: 32, speed: BASE_SPEED * 1.8, nextTier: 2, rbe: 3, maxHp: 1 },
    4: { color: '#f1c40f', radius: 18, size: 36, speed: BASE_SPEED * 3.2, nextTier: 3, rbe: 4, maxHp: 1 },
    5: { color: '#ff00ff', radius: 20, size: 40, speed: BASE_SPEED * 3.5, nextTier: 4, rbe: 5, maxHp: 1 },
    6: { color: '#2c3e50', radius: 14, size: 32, speed: BASE_SPEED * 1.8, nextTier: null, isBlack: true, rbe: 11, maxHp: 1, splitsInto: [{tier: 5, count: 2}], blocksDamageType: (d) => d.isExplosion },
    7: { color: '#ffffff', radius: 14, size: 32, speed: BASE_SPEED * 2.0, nextTier: null, isWhite: true, rbe: 11, maxHp: 1, splitsInto: [{tier: 5, count: 2}], blocksDamageType: (d) => d.isIce },
    8: { color: '#95a5a6', radius: 18, size: 32, speed: BASE_SPEED * 1.0, nextTier: null, isLead: true, rbe: 23, maxHp: 1, splitsInto: [{tier: 6, count: 2}], blocksDamageType: (d) => d.isSharp && !d.canHitLead },
    9: { color: '#bdc3c7', radius: 18, size: 36, speed: BASE_SPEED * 1.8, nextTier: null, isZebra: true, rbe: 23, maxHp: 1, splitsInto: [{tier: 6, count: 1}, {tier: 7, count: 1}], blocksDamageType: (d) => d.isExplosion || d.isIce },
    10:{ color: '#9b59b6', radius: 18, size: 36, speed: BASE_SPEED * 3.0, nextTier: null, isPurple: true, rbe: 11, maxHp: 1, splitsInto: [{tier: 5, count: 2}], blocksDamageType: (d) => (d.isPlasma || d.isEnergy || d.isFire || d.isMagic) && !d.canHitPurple },
    11:{ color: '#e74c3c', radius: 20, size: 40, speed: BASE_SPEED * 2.2, nextTier: null, isRainbow: true, rbe: 47, maxHp: 1, splitsInto: [{tier: 9, count: 2}] },
    12:{ color: '#e67e22', radius: 20, size: 48, speed: BASE_SPEED * 2.5, nextTier: null, isCeramic: true, rbe: 104, maxHp: 10, splitsInto: [{tier: 11, count: 2}] },
    13:{ color: '#2c3e50', radius: 50, size: 110, speed: BASE_SPEED * 1.0, nextTier: null, isMoab: true, rbe: 616, maxHp: 200, splitsInto: [{tier: 12, count: 4}], spriteOffsetX: 0, spriteOffsetY: 0 },
    14:{ color: '#e74c3c', radius: 70, size: 140, speed: BASE_SPEED * 0.25, nextTier: null, isMoab: true, isBFB: true, rbe: 3164, maxHp: 700, splitsInto: [{tier: 13, count: 4}], spriteOffsetX: 0, spriteOffsetY: 0 },
    15:{ color: '#27ae60', radius: 90, size: 180, speed: BASE_SPEED * 0.18, nextTier: null, isMoab: true, isZOMG: true, rbe: 16656, maxHp: 4000, splitsInto: [{tier: 14, count: 4}], spriteOffsetX: 0, spriteOffsetY: 0 },
    16:{ color: '#2c3e50', radius: 50, size: 110, speed: BASE_SPEED * 2.64, nextTier: null, isMoab: true, isDDT: true, isLead: true, rbe: 816, maxHp: 400, splitsInto: [{tier: 12, count: 4, forceCamo: true, forceRegen: true}], blocksDamageType: (d) => d.isExplosion || (d.isSharp && !d.canHitLead), spriteOffsetX: 0, spriteOffsetY: 0 },
    17:{ color: '#e74c3c', radius: 110, size: 200, speed: BASE_SPEED * 0.18, nextTier: null, isMoab: true, isBAD: true, rbe: 55760, maxHp: 20000, splitsInto: [{tier: 15, count: 2}, {tier: 16, count: 3}], spriteOffsetX: 0, spriteOffsetY: 0 }
};
