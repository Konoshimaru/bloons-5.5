// js/towers/farmer.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { AudioEngine } from '../audio.js';
import { RANGE_SCALE } from '../config.js';

export default {
    stats: { 
        name: "Banana Farmer", cost: 1000, range: 40, 
        baseCooldown: 0, fireRate: 0, // Standardized Base (Does not attack)
        damage: 0, pierce: 0, projectileSpeed: 0, 
        lifespan: 0, desc: "Automatically collects bananas in range.", dmgType: 'none', hitRadius: 18, 
        isStaticRotation: true
    },
    upgrades: {
        1: [
            {name:"Wider Net", cost:300, stat:"range", amount:20, desc:"Increases collection range."}
        ],
        2: [], 
        3: []
    },
    
    update(tower, dt) {
        let effRange = tower.stats.range * RANGE_SCALE;
        let collected = false;
        
        for (let ot of GameEngine.towers) {
            if (ot && ot.bananas && ot.bananas.length > 0) {
                for (let i = ot.bananas.length - 1; i >= 0; i--) {
                    let b = ot.bananas[i];
                    if (b.progress >= 1) {
                        if (Utils.distance(tower.x, tower.y, b.x, b.y) < effRange) {
                            GameEngine.addCash(b.value);
                            ot.cashGenerated = (ot.cashGenerated || 0) + b.value; // PRO FIX: Attribute cash to the farm!
                            ot.bananas.splice(i, 1);
                            collected = true;
                        }
                    }
                }
            }
        }
        
        if (collected) AudioEngine.playSfx('cash');
    }
};