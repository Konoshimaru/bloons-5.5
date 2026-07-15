export const EnemyTypesData = {
    1: { color: '#e74c3c', radius: 12, size: 24, speed: 60, nextTier: null, livesLost: 1, rbe: 1, maxHp: 1 },
    2: { color: '#3498db', radius: 14, size: 28, speed: 80, nextTier: 1, livesLost: 1, rbe: 2, maxHp: 1 },
    3: { color: '#2ecc71', radius: 16, size: 32, speed: 120, nextTier: 2, livesLost: 1, rbe: 3, maxHp: 1 },
    4: { color: '#f1c40f', radius: 18, size: 36, speed: 180, nextTier: 3, livesLost: 1, rbe: 4, maxHp: 1 },
    5: { color: '#ff00ff', radius: 20, size: 40, speed: 240, nextTier: 4, livesLost: 1, rbe: 5, maxHp: 1 },
    6: { color: '#2c3e50', radius: 14, size: 32, speed: 100, nextTier: null, isBlack: true, livesLost: 3, rbe: 11, maxHp: 1, splitsInto: [{tier: 5, count: 2}], blocksDamageType: (d) => d.isExplosion },
    7: { color: '#ffffff', radius: 14, size: 32, speed: 110, nextTier: null, isWhite: true, livesLost: 3, rbe: 11, maxHp: 1, splitsInto: [{tier: 5, count: 2}], blocksDamageType: (d) => d.isIce },
    8: { color: '#95a5a6', radius: 18, size: 32, speed: 50, nextTier: null, isLead: true, livesLost: 6, rbe: 23, maxHp: 1, splitsInto: [{tier: 6, count: 2}], blocksDamageType: (d) => d.isSharp && !d.canHitLead },
    9: { color: '#bdc3c7', radius: 18, size: 36, speed: 120, nextTier: null, isZebra: true, livesLost: 6, rbe: 23, maxHp: 1, splitsInto: [{tier: 6, count: 1}, {tier: 7, count: 1}], blocksDamageType: (d) => d.isExplosion || d.isIce },
    10:{ color: '#9b59b6', radius: 18, size: 36, speed: 130, nextTier: null, isPurple: true, livesLost: 3, rbe: 11, maxHp: 1, splitsInto: [{tier: 5, count: 2}], blocksDamageType: (d) => (d.isPlasma || d.isEnergy || d.isFire || d.isMagic) && !d.canHitPurple },
    11:{ color: '#e74c3c', radius: 20, size: 40, speed: 100, nextTier: null, isRainbow: true, livesLost: 12, rbe: 47, maxHp: 1, splitsInto: [{tier: 9, count: 2}] },
    12:{ color: '#e67e22', radius: 20, size: 48, speed: 80, nextTier: null, isCeramic: true, livesLost: 26, rbe: 104, maxHp: 10, splitsInto: [{tier: 11, count: 2}] },
    13:{ color: '#2c3e50', radius: 50, size: 110, speed: 40, nextTier: null, isMoab: true, livesLost: 154, rbe: 616, maxHp: 200, splitsInto: [{tier: 12, count: 4}], spriteOffsetX: 0, spriteOffsetY: 0 },
    14:{ color: '#e74c3c', radius: 70, size: 140, speed: 30, nextTier: null, isMoab: true, livesLost: 791, rbe: 3164, maxHp: 700, splitsInto: [{tier: 13, count: 4}], spriteOffsetX: 0, spriteOffsetY: 0 },
    15:{ color: '#27ae60', radius: 90, size: 180, speed: 20, nextTier: null, isMoab: true, livesLost: 4164, rbe: 16656, maxHp: 4000, splitsInto: [{tier: 14, count: 4}], spriteOffsetX: 0, spriteOffsetY: 0 },
    16:{ color: '#2c3e50', radius: 50, size: 110, speed: 110, nextTier: null, isMoab: true, isDDT: true, isLead: true, livesLost: 816, rbe: 816, maxHp: 400, splitsInto: [{tier: 12, count: 4, forceCamo: true, forceRegen: true}], blocksDamageType: (d) => d.isExplosion || (d.isSharp && !d.canHitLead), spriteOffsetX: 0, spriteOffsetY: 0 },
    17:{ color: '#e74c3c', radius: 110, size: 200, speed: 15, nextTier: null, isMoab: true, isBAD: true, livesLost: 55760, rbe: 55760, maxHp: 20000, splitsInto: [{tier: 15, count: 2}, {tier: 16, count: 3}], spriteOffsetX: 0, spriteOffsetY: 0 }
};