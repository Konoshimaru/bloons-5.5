// js/towerEconomy.js
import { Upgrades } from './towers/index.js';
import { Utils } from './utils.js';
import { RANGE_SCALE } from './config.js';
import { MKEffects } from './monkeyKnowledgeEffects.js';
import { getBehavior } from './registry.js';

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
        if (behavior?.canUpgrade && !behavior.canUpgrade(this, path, engine)) return false;
        
        const tier = this.upgrades[path - 1];
        if (tier >= 5) return false;
        const pathsStarted = this.upgrades.filter(u => u > 0).length;
        if (tier === 0 && pathsStarted >= 2) return false;
        for (let i = 0; i < 3; i++) {
            if (i !== path - 1 && this.upgrades[i] >= 3 && tier >= 2) return false;
        }
        
        if (tier === 4 && engine.tier5Bought?.[`${this.type}-${path}`]) {
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
        // Village Primary Mentoring/Expertise: free tier 1 / tier 1+2 upgrades
        const nextTier = this.upgrades[path - 1];
        if (this.freeTier2 && nextTier <= 1) cost = 0;
        else if (this.freeTier1 && nextTier === 0) cost = 0;
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
    },

    activateAbility(slot, engine) {
        const behavior = getBehavior(this.type);
        if (!behavior) return false;
        
        let actualTower = this;
        if (behavior.getAbilityTarget) {
            actualTower = behavior.getAbilityTarget(this, slot) || this;
        }

        const mk = engine.config.data.mkActive === false ? {} : (engine.config.data.monkeyKnowledge || {});
        let cdMult = 1.0;
        for (const eff of MKEffects.abilityCooldown) {
            if (!mk[eff.id]) continue;
            if (eff.hero && !this.stats.isHero) continue;
            if (eff.condition && !eff.condition(this, slot)) continue;
            if (eff.stat === 'cdMult') cdMult *= eff.amount;
        }
        if (this.abilityCdMult) cdMult *= this.abilityCdMult;

        if (slot === 1 && actualTower.stats.isAbility && actualTower.abilityCooldown <= 0 && behavior.ability) {
            behavior.ability(actualTower, engine);
            const cd = actualTower.stats.abilityCd || 45;
            actualTower.abilityCooldown = cd * cdMult; 
            return true;
        }
        if (slot === 2 && actualTower.stats.isAbility2 && actualTower.ability2Cooldown <= 0 && behavior.ability2) {
            behavior.ability2(actualTower, engine); 
            const cd = actualTower.stats.ability2Cd || (actualTower.stats.isHero ? 70 : 60);
            actualTower.ability2Cooldown = cd * cdMult; 
            return true;
        }
        if (slot === 3 && actualTower.stats.isAbility3 && actualTower.ability3Cooldown <= 0 && behavior.ability3) {
            behavior.ability3(actualTower, engine); 
            const cd = actualTower.stats.ability3Cd || (actualTower.stats.isHero ? 120 : 60);
            actualTower.ability3Cooldown = cd * cdMult; 
            return true;
        }
        return false;
    }
};

export default TowerEconomy;