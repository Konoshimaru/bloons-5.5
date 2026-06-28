export const Names = {
    PREFIXES: {
        ENEMY: 'enemy_',
        PROJECTILE: 'proj_',
        TOWER: 'tower_',
        EFFECT: 'effect_',
        MAP: 'map_'
    },

    ENEMIES: [null, 'red', 'blue', 'green', 'yellow', 'pink', 'black', 'white', 'lead', 'zebra', 'purple', 'rainbow', 'ceramic', 'moab', 'bfb', 'zomg', 'ddt', 'bad'],

    getEnemy(tier) { return `${this.PREFIXES.ENEMY}${this.ENEMIES[tier]}`; },
    getEnemyWithModifiers(tier, isCamo, isRegen) {
        let base = this.ENEMIES[tier];
        let key = `${this.PREFIXES.ENEMY}${base}`;
        if (isCamo && isRegen) return `${key}_regen_camo`; 
        if (isCamo) return `${key}_camo`;
        if (isRegen) return `${key}_regen`;
        return key;
    },
    getProjectile(type) { return `${this.PREFIXES.PROJECTILE}${type}`; },
    getTowerBase(type) { return `${this.PREFIXES.TOWER}${type}_base`; },
    getTowerArm(type) { return `${this.PREFIXES.TOWER}${type}_arm`; },
    getTowerUpgradeBase(type, path, tier) { return `${this.PREFIXES.TOWER}${type}_p${path}_t${tier}_base`; },
    getTowerUpgradeArm(type, path, tier) { return `${this.PREFIXES.TOWER}${type}_p${path}_t${tier}_arm`; },
    
    // PRO FIX: Added variant parameter for pop effects (1, 2, or 3)
    getPopEffect(variant = 1) { return `${this.PREFIXES.EFFECT}pop${variant}`; },
    getMoabCrack() { return `${this.PREFIXES.EFFECT}moab_crack`; },
    getCeramicCrack() { return `${this.PREFIXES.EFFECT}ceramic_crack`; },
    getBanana() { return `${this.PREFIXES.EFFECT}banana`; },
    getMap(name) { return `${this.PREFIXES.MAP}${name}`; },
    getCamo() { return `${this.PREFIXES.EFFECT}camo`; },
    getFortified() { return `${this.PREFIXES.EFFECT}fortified`; },
    getRegen() { return `${this.PREFIXES.EFFECT}regen`; },
    
    // PRO FIX: Added stun frame helper
    getStunFX(frame) { return `${this.PREFIXES.EFFECT}stun_${frame}`; }
};