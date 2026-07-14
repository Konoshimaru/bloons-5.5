// hero.js
import { Tower } from './tower.js';
import { HeroRegistry } from './heroes/index.js';

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

    buyLevel(engine) {
        if (this.level >= MAX_LEVEL) return;
        
        const cost = this.xpToNext - this.xp;
        if (engine.cash < cost) {
            engine.log("Not enough cash to buy level!");
            return;
        }
        
        engine.cash -= cost;
        this.xp = this.xpToNext; 
        this.gainXp(0);
        engine.updateUI();
    }

    _levelUp(engine) {
        this.level++;
        
        if (this.level < MAX_LEVEL) {
            this.xpToNext = this.xpTable[this.level - 1];
        } else {
            this.xpToNext = 0;
            this.xp = 0;
        }
        
        this._applyLevelStats();
        this._unlockAbilities();
        
        if (engine) engine.updateUI();
    }

    _applyLevelStats() {
        // PRO FIX: Use this.level directly because the levels object is 1-indexed
        const levelData = HeroRegistry[this.type].levels[this.level];
        if (!levelData) return;
        
        for (const mod of levelData) {
            const currentVal = this.stats[mod.stat] || 0;
            this.stats[mod.stat] = currentVal + mod.amount;
        }
    }

    _unlockAbilities() {
        if (this.level >= 3) this.stats.isAbility = true;
        if (this.level >= 10) this.stats.isAbility2 = true;
    }

    update(dt, engine) {
        super.update(dt, engine);
    }
}