// js/towers/village.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { RANGE_SCALE } from '../config.js';

export default {
    stats: { name: "Monkey Village", cost: 1200, range: 40, fireRate: 0, desc: "Buff towers in range. Grants range, attack speed, camo, and lead.", dmgType: 'none', hitRadius: 18 },
    upgrades: {
        1: [{name:"Jungle Drums",cost:2000,stat:"fireRateBuff",amount:0.2,desc:"Towers in range attack 20% faster."},{name:"Overclock",cost:5000,stat:"fireRateBuff",amount:0.5,desc:"Towers in range attack 50% faster."},{name:"Ultravision",cost:20000,stat:"rangeBuff",amount:0.5,desc:"Towers in range have +50% range."},{name:"High Energy Beacon",cost:30000,stat:"rangeBuff",amount:1.0,desc:"Towers in range have +100% range."},{name:"Total War",cost:50000,stat:"rangeBuff",amount:1.5,desc:"Towers in range have +150% range."}], 
        2: [{name:"Greater Range",cost:400,stat:"range",amount:30,desc:"Increases Village range."},{name:"Radar Scanner",cost:1000,stat:"grantsCamo",amount:true,desc:"Towers in range can detect Camo."},{name:"MIB",cost:4000,stat:"grantsLead",amount:true,desc:"Towers in range can pop all bloon types."},{name:"Call to Arms",cost:10000,stat:"fireRateBuff",amount:1.0,desc:"Towers in range attack 100% faster."},{name:"Homeland Defense",cost:30000,stat:"rangeBuff",amount:1.0,desc:"Towers in range have +100% range."}], 
        3: [{name:"Cheaper Upgrades",cost:1000,stat:"discount",amount:0.1,desc:"10% discount on towers in range."},{name:"Better Discount",cost:3000,stat:"discount",amount:0.2,desc:"20% discount on towers in range."},{name:"Free Upgrade",cost:8000,stat:"discount",amount:0.3,desc:"30% discount on towers in range."},{name:"Monkey City",cost:15000,stat:"income",amount:100,desc:"Generates $100 per round."},{name:"Monkey Metropolis",cost:40000,stat:"income",amount:500,desc:"Generates $500 per round."}]
    },
    updateSupport(tower, dt) {
        const effRange = tower.stats.range * RANGE_SCALE;
        for (let t of GameEngine.towers) {
            if (t === tower) continue;
            if (Utils.distance(tower.x, tower.y, t.x, t.y) < effRange) {
                t.buffedRange = Math.max(t.buffedRange, tower.stats.rangeBuff || 0);
                t.buffedFireRate = Math.max(t.buffedFireRate, tower.stats.fireRateBuff || 0);
                if (tower.stats.grantsCamo) t.buffedCamo = true;
                if (tower.stats.grantsLead) t.buffedLead = true;
                t.discount = Math.max(t.discount, tower.stats.discount || 0); 
            }
        }
    },
        update(tower, dt) {
        if (tower.stats.income) {
            tower.incomeTimer = (tower.incomeTimer || 0) - dt;
            if (tower.incomeTimer <= 0) {
                tower.incomeTimer = 5.0; // Generate income every 5 seconds
                GameEngine.addCash(tower.stats.income);
            }
        }
    }
    // No custom draw or update, falls through to drawBaseTower and acquireAndFire (which skips due to fireRate <= 0)
};