// js/towerEconomy.js
import { Upgrades } from './towers/index.js';
import { Utils } from './utils.js';
import { RANGE_SCALE } from './config.js';
import { MKEffects } from './monkeyKnowledgeEffects.js';
import { getBehavior } from './registry.js'; // FIX: Import getBehavior to access module hooks

// FIX: Extracted reusable sell rate calculation
export function getSellRate(tower, engine) {
    let resaleRate = 0.70;
    const mk = engine.config.data.mkActive === false ? {} : (engine.config.data.monkeyKnowledge || {});
    for (const eff of MKEffects.sellRate) {
        if (!mk[eff.id]) continue;
        if (eff.type && !eff.type.includes(tower.type)) continue;
        if (eff.condition && !eff.condition(tower, engine)) continue;
        
        let val = eff.amount;
        if (eff.action) val = eff.action(tower, engine);
        if (val !== undefined) resaleRate = Math.max(resaleRate, val);
    }
    return resaleRate;
}

const TowerEconomy = {
    canUpgrade(path, engine) {
        if (this.isMinion) return false; 
        
        const behavior = getBehavior(this.type);
        // FIX: Let the specific tower module decide if it can be upgraded
        if (behavior?.canUpgrade && !behavior.canUpgrade(this, path, engine)) return false;
        
        const tier = this.upgrades[path - 1];
        if (tier >= 5) return false;
        const pathsStarted = this.upgrades.filter(u => u > 0).length;
        if (tier === 0 && pathsStarted >= 2) return false;
        for (let i = 0; i < 3; i++) {
            if (i !== path - 1 && this.upgrades[i] >= 3 && tier >= 2) return false;
        }
        
        if (tier === 4 && engine.tier5Bought?.[`${this.type}-${path}`]) {
            // FIX: Let the specific tower module decide if it can bypass the tier 5 limit
            let allow = false;
            if (behavior?.canBuyTier5) allow = behavior.canBuyTier5(this, path, engine);
            if (!allow) return false;
        }
        
        return true;
    },

    upgrade(path, engine) {
        const tier = this.upgrades[path - 1];
        const upgradeData = Upgrades[this.type][path][tier];
        if (!upgradeData) return false;

        let baseCost = upgradeData.cost;
        const behavior = getBehavior(this.type);
        
        // FIX: Let the tower module modify the base cost (e.g. Village adds $5000 per farm)
        if (behavior?.getUpgradeCostModifier) {
            baseCost = behavior.getUpgradeCostModifier(this, baseCost, path, tier, engine);
        }

        const mk = engine.config.data.mkActive === false ? {} : (engine.config.data.monkeyKnowledge || {});

        for (const eff of MKEffects.upgradeCost) {
            if (!mk[eff.id]) continue;
            if (eff.type && !eff.type.includes(this.type)) continue;
            if (eff.condition && !eff.condition(this)) continue;
            
            if (eff.mode === 'sub') baseCost -= eff.amount;
            else if (eff.mode === 'mult') baseCost *= eff.amount;
        }

        let cost = engine.getCost(baseCost);
        if (this.discount > 0) cost = Math.floor(cost * (1 - this.discount));
        if (engine.cash < cost || !this.canUpgrade(path, engine)) return false;

        engine.cash -= cost;
        this.totalSpent += cost;
        this.upgrades[path - 1]++;
        
        this._applyUpgradeStats(upgradeData);
        this._recalculateStats();
        this._postUpgradeHook(path);

        if (this.stats.fireRate < 0.05 && !this.stats.baseCooldown) this.stats.fireRate = 0.05;
        if (tier === 4) engine.tier5Bought[`${this.type}-${path}`] = true;
        engine.updateUI();
        return true;
    },

    sell(engine) {
        const resaleRate = getSellRate(this, engine);
        engine.cash += Math.floor(this.totalSpent * resaleRate);
        for (let i = 0; i < 3; i++) {
            if (this.upgrades[i] === 5) engine.tier5Bought[`${this.type}-${i + 1}`] = false;
        }
        engine.updateUI();
    }
};

export default TowerEconomy;