import { Tower } from './tower.js';
import { HeroRegistry } from './heroes/index.js';
import { GameEngine } from './engine.js';

const MAX_LEVEL = 20;

export class Hero extends Tower {
    constructor(x, y, type) {
        super(x, y, type);
        
        this.level = 1;
        this.xp = 0;
        this.xpTable = HeroRegistry[this.type].xpTable;
        this.xpToNext = this.xpTable[0];
        
        this.abilityActiveTime = 0;
        this.abilityCooldown = 0;
        this.ability2Cooldown = 0;
        this.ability3Cooldown = 0;
        
        this.stormOfArrows = null;
    }

    gainXp(amount) {
        if (this.level >= MAX_LEVEL) return;
        
        this.xp += amount;
        
        while (this.level < MAX_LEVEL && this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext;
            this._levelUp();
        }
    }

    buyLevel() {
        if (this.level >= MAX_LEVEL) return;
        
        const cost = this.xpToNext - this.xp;
        if (GameEngine.cash < cost) {
            GameEngine.log("Not enough cash to buy level!");
            return;
        }
        
        GameEngine.cash -= cost;
        this.xp = this.xpToNext; 
        this.gainXp(0);
        GameEngine.updateUI();
    }

    _levelUp() {
        this.level++;
        
        if (this.level < MAX_LEVEL) {
            this.xpToNext = this.xpTable[this.level - 1];
        } else {
            this.xpToNext = 0;
            this.xp = 0;
        }
        
        this._applyLevelStats();
        this._unlockAbilities();
        
        GameEngine.updateUI();
    }

    _applyLevelStats() {
        const levelData = HeroRegistry[this.type].levels[this.level - 1];
        if (!levelData) return;
        
        for (const mod of levelData) {
            // The original branching logic (if fireRate / else) was functionally identical.
            // Simplified to a single coherent operation.
            const currentVal = this.stats[mod.stat] || 0;
            this.stats[mod.stat] = currentVal + mod.amount;
        }
    }

    _unlockAbilities() {
        if (this.level >= 3) this.stats.isAbility = true;
        if (this.level >= 10) this.stats.isAbility2 = true;
        if (this.level >= 20) this.stats.isAbility3 = true;
    }

    update(dt) {
        // Delegates entirely to the TowerBehavior ECS system
        super.update(dt);
    }
}