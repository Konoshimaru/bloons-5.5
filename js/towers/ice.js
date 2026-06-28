import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { RANGE_SCALE } from '../config.js';

export default {
    stats: { name: "Ice Tower", cost: 500, range: 35, fireRate: 1.5, damage: 1, slow: 0.5, slowDuration: 2, desc: "Pulses frost, freezing and damaging all nearby bloons.", dmgType: 'ice', hitRadius: 18, isStaticRotation: true },
upgrades: {
    1: [{name:"Permafrost",cost:400,stat:"slowDuration",amount:2,desc:"Freezes for 2 seconds longer."},{name:"Deep Freeze",cost:500,stat:"damage",amount:1,desc:"Deals 1 extra damage."},{name:"Absolute Zero",cost:2500,stat:"slow",amount:0.3,desc:"Freezes bloons completely."},{name:"Cryo Cannon",cost:4000,stat:"damage",amount:2,desc:"Deals 2 extra damage."},{name:"Ice Age",cost:20000,stat:"slow",amount:0.2,desc:"Freezes bloons almost entirely."}], 
    2: [{name:"Faster Shots",cost:400,stat:"fireRate",amount:-0.4,desc:"Pulses faster."},{name:"Arctic Wind",cost:600,stat:"range",amount:30,desc:"Increases range."},{name:"Super Range",cost:1000,stat:"range",amount:40,desc:"Huge range increase."},{name:"Snowstorm",cost:2500,stat:"fireRate",amount:-0.5,desc:"Pulses even faster."},{name:"Blizzard",cost:10000,stat:"range",amount:80,desc:"Massive range increase."}], 
    3: [{name:"Camo Frost",cost:500,stat:"canSeeCamo",amount:true,desc:"Can detect Camo bloons."},{name:"Lead Frost",cost:800,stat:"canHitLead",amount:true,desc:"Can pop Lead bloons."},{name:"Viral Frost",cost:3000,stat:"damage",amount:2,desc:"Deals 2 extra damage."},{name:"Glacial Wave",cost:5000,stat:"slowDuration",amount:3,desc:"Freezes for 3 seconds longer."},{name:"Eternal Winter",cost:25000,stat:"damage",amount:10,desc:"Deals colossal damage."}]
},
    update(tower, dt) {
        let enemiesInRange = false;
        const effRange = tower.stats.range * RANGE_SCALE * (1 + tower.buffedRange);
        const candidates = GameEngine.enemyGrid.query(tower.x, tower.y, effRange);
        for(let e of candidates) { 
            if (!e.alive) continue;
            if (e.isCamo && !tower.stats.canSeeCamo && !tower.buffedCamo) continue; 
            if (Utils.distance(tower.x, tower.y, e.x, e.y) < effRange) { enemiesInRange = true; break; } 
        }
        if (enemiesInRange && tower.cooldown <= 0) { tower.fire(null); tower.cooldown = tower.stats.fireRate / (1 + tower.buffedFireRate); }
    },
    fire(tower, target, damage, dmgType) {
        const effRange = tower.stats.range * RANGE_SCALE * (1 + tower.buffedRange);
        GameEngine.explosions.push({ x: tower.x, y: tower.y, radius: 0, maxRadius: effRange, life: 0.4, maxLife: 0.4, color: '#1abc9c' });
        const candidates = GameEngine.enemyGrid.query(tower.x, tower.y, effRange);
        let canSeeCamo = tower.stats.canSeeCamo || tower.buffedCamo;
        for (let e of candidates) { 
            if (!e.alive) continue;
            if (e.isCamo && !canSeeCamo) continue; 
            if (Utils.distance(tower.x, tower.y, e.x, e.y) < effRange) { 
                let dmg = e.takeDamage(damage, dmgType); tower.damageDealt += dmg; e.applySlow(tower.stats.slow, tower.stats.slowDuration, true); 
            } 
        }
    }
};