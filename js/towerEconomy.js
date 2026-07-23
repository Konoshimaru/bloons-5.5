// towerEconomy.js
import { Upgrades } from './towers/index.js';
import { Utils } from './utils.js';
import { RANGE_SCALE } from './config.js';
import { MKEffects } from './monkeyKnowledgeEffects.js';

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
        const tier = this.upgrades[path - 1];
        if (tier >= 5) return false;
        const pathsStarted = this.upgrades.filter(u => u > 0).length;
        if (tier === 0 && pathsStarted >= 2) return false;
        for (let i = 0; i < 3; i++) {
            if (i !== path - 1 && this.upgrades[i] >= 3 && tier >= 2) return false;
        }
        if (tier === 4 && engine.tier5Bought?.[`${this.type}-${path}`]) {
            const mk = engine.config.data.mkActive === false ? {} : (engine.config.data.monkeyKnowledge || {});
            if (this.type === 'dart' && path === 3 && mk['master_double']) {
                let count = 0;
                for(let t of engine.towers) { if(t && t.type === 'dart' && t.upgrades[2] === 5) count++; }
                if (count < 2) return true; 
            }
            return false;
        }
        
        if (this.type === 'village' && path === 3 && tier === 4) {
            const effRange = this.stats.range * RANGE_SCALE;
            let hasFarm = false;
            for (let t of engine.towers) {
                if (t && t !== this && t.type === 'farm' && t.upgrades[0] < 5) {
                    if (Utils.withinRange(this.x, this.y, t.x, t.y, effRange)) {
                        hasFarm = true;
                        break;
                    }
                }
            }
            if (!hasFarm) return false;
        }
        
        return true;
    },

    upgrade(path, engine) {
        const tier = this.upgrades[path - 1];
        const upgradeData = Upgrades[this.type][path][tier];
        if (!upgradeData) return false;

        let baseCost = upgradeData.cost;
        
        if (this.type === 'village' && path === 3 && tier === 4) {
            const effRange = this.stats.range * RANGE_SCALE;
            for (let t of engine.towers) {
                if (t && t !== this && t.type === 'farm' && t.upgrades[0] < 5) {
                    if (Utils.withinRange(this.x, this.y, t.x, t.y, effRange)) {
                        baseCost += 5000;
                    }
                }
            }
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
        // FIX: Use the extracted getSellRate function
        const resaleRate = getSellRate(this, engine);
        engine.cash += Math.floor(this.totalSpent * resaleRate);
        for (let i = 0; i < 3; i++) {
            if (this.upgrades[i] === 5) engine.tier5Bought[`${this.type}-${i + 1}`] = false;
        }
        engine.updateUI();
    }
};

export default TowerEconomy;