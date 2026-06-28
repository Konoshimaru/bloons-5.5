import { Tower } from './tower.js';
import { HeroRegistry } from './heroes/index.js';
import { GameEngine } from './engine.js';

export class Hero extends Tower {
    constructor(x, y, type) {
        super(x, y, type);
        this.level = 1;
        this.xp = 0;
        this.xpTable = HeroRegistry[this.type].xpTable;
        this.xpToNext = this.xpTable[0];
        
        this.abilityCooldown = 0;
        this.ability2Cooldown = 0;
        this.ability3Cooldown = 0; 
        this.abilityActiveTime = 0;
        this.stormOfArrows = null;
    }

    gainXp(amount) {
        if (this.level >= 20) return;
        this.xp += amount;
        while (this.level < 20 && this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext;
            this.levelUp();
        }
    }

    buyLevel() {
        if (this.level >= 20) return;
        const cost = this.xpToNext - this.xp; 
        if (GameEngine.cash >= cost) {
            GameEngine.cash -= cost;
            this.xp = this.xpToNext; 
            this.gainXp(0);
            GameEngine.updateUI();
        } else { GameEngine.log("Not enough cash to buy level!"); }
    }

    levelUp() {
        this.level++;
        if (this.level < 20) { this.xpToNext = this.xpTable[this.level - 1]; } 
        else { this.xpToNext = 0; this.xp = 0; }
        
        const levelData = HeroRegistry[this.type].levels[this.level - 1]; 
        if (levelData) {
            levelData.forEach(mod => {
                if (typeof mod.amount === 'number') { this.stats[mod.stat] = (this.stats[mod.stat] || 0) + mod.amount; } 
                else { this.stats[mod.stat] = mod.amount; }
            });
        }
        
        if (this.level === 3) { this.stats.isAbility = true; this.abilityCooldown = (this.stats.rapidShotCd || 60) * (16.7 / 60); }
        if (this.level === 10) { this.stats.isAbility2 = true; this.ability2Cooldown = (this.stats.stormCd || 70) * (23.33 / 70); }
        
        GameEngine.updateUI();
    }

    update(dt) { super.update(dt); }
}