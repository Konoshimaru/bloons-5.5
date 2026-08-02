// js/hero.js
import { Tower } from './tower.js';
import { HeroRegistry } from './heroes/index.js';
import { GameEngine } from './engine.js';
import { MKEffects } from './monkeyKnowledgeEffects.js';

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

        const mk = GameEngine.config.data.mkActive === false ? {} : (GameEngine.config.data.monkeyKnowledge || {});
        this._applyMKEffects(mk, MKEffects.heroInit, GameEngine);
    }

    gainXp(amount) {
        if (this.level >= MAX_LEVEL) return;
        
        const mk = GameEngine.config.data.mkActive === false ? {} : (GameEngine.config.data.monkeyKnowledge || {});
        let mult = 1.0;
        for (const eff of MKEffects.heroXpGain) {
            if (!mk[eff.id]) continue;
            if (eff.hero && !this.stats.isHero) continue;
            if (eff.condition && !eff.condition(this, GameEngine)) continue;
            
            if (eff.action) mult *= eff.action(this, GameEngine);
            else if (eff.stat === 'mult') mult *= eff.amount;
        }
        amount *= mult;

        this.xp += amount;
        
        while (this.level < MAX_LEVEL && this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext;
            this._levelUp();
        }
    }

    buyLevel(engine) {
        if (this.level >= MAX_LEVEL) return;
        
        let cost = this.xpToNext - this.xp;
        
        const mk = engine.config.data.mkActive === false ? {} : (engine.config.data.monkeyKnowledge || {});
        let mult = 1.0;
        for (const eff of MKEffects.heroBuyLevel) {
            if (!mk[eff.id]) continue;
            if (eff.hero && !this.stats.isHero) continue;
            if (eff.condition && !eff.condition(this, engine)) continue;
            
            if (eff.action) mult *= eff.action(this, engine);
            else if (eff.stat === 'mult') mult *= eff.amount;
        }
        cost = Math.floor(cost * mult);

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