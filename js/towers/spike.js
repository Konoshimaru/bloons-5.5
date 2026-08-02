// js/towers/spike.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { RANGE_SCALE } from '../config.js';

export default {
    stats: {
        name: "Spike Factory", cost: 1000, range: 34,
        baseCooldown: 1.75, fireRate: 1.75,
        damage: 1, pierce: 5, projectileSpeed: 800,
        lifespan: 50.0, desc: "Produces spikes on the track.",
        dmgType: 'sharp', projectileType: 'spike', hitRadius: 18,
        isStaticRotation: true,
        canSeeCamo: true
    },
    upgrades: {
        1: [
            {name:"Bigger Stacks", cost:800, stat:"pierce", amount:5, desc:"Increases pierce of piles by +5."},
            {name:"White Hot Spikes", cost:600, stat:"dmgType", amount:'heavy', desc:"Changes Damage Type to Normal. Spikes can now pop Lead and Frozen Bloons.", extraMods:{canHitLead: true}},
            {name:"Spiked Balls", cost:2300, stat:"projectileType", amount:"spike_opult", desc:"Replaces standard spikes with Spiked Balls.", extraMods:{damage: 1, pierce: 9, bonusCeramic: 1, fortifiedDmg: 1, baseCooldown: 2.2, dmgType: 'heavy'}},
            {name:"Spiked Mines", cost:9500, stat:"projectileType", amount:"juggernaut", desc:"Replaces Spiked Balls with Spiked Mines.", extraMods:{damage: 1, pierce: 2, bonusCeramic: 1, fortifiedDmg: 1, isExplosive: true, explosionRadius: 30, explosionDamage: 10, explosionPierce: 30, dot: 2, dotTimer: 3.0}},
            {name:"Super Mines", cost:125000, stat:"projectileType", amount:"ultra_juggernaut", desc:"Replaces Spiked Mines with giant Super Mines.", extraMods:{damage: 997, pierce: 44, baseCooldown: 4.4, isExplosive: true, explosionRadius: 60, explosionDamage: 1000, explosionPierce: 100, dot: 500, dotTimer: 4.0}}
        ],
        2: [
            {name:"Faster Production", cost:600, desc:"Multiplies base cooldown by 0.8.", cooldownMult: 0.8},
            {name:"Even Faster Production", cost:800, desc:"Multiplies previous cooldown by 0.75.", cooldownMult: 0.75},
            {name:"MOAB SHREDR", cost:2500, stat:"moabDmg", amount:3, desc:"Adds +3 bonus damage to MOAB-Class Bloons."},
            {name:"Spike Storm", cost:7000, stat:"isAbility", amount:true, desc:"Unlocks Manual Active Ability: Spike Storm.", extraMods:{unlocksAbility:true, abilityName:"Storm", abilityCd:40}},
            {name:"Carpet of Spikes", cost:41000, stat:"carpetOfSpikes", amount:true, desc:"Passive trigger and storm enhancements.", extraMods:{damage: 1, moabDmg: 4}}
        ],
        3: [
            {name:"Long Reach", cost:150, stat:"range", amount:8, desc:"Increases range and lifespan.", extraMods:{lifespan: 50.0}},
            {name:"Smart Spikes", cost:400, stat:"smartSpikes", amount:true, desc:"Unlocks targeting priorities and round start buff."},
            {name:"Long Life Spikes", cost:1300, stat:"lifespan", amount:90.0, desc:"Increases lifespan to 140 seconds."},
            {name:"Deadly Spikes", cost:3600, stat:"damage", amount:1, desc:"Increases base damage to 2.", extraMods:{pierce: 5}},
            {name:"Perma-Spike", cost:30000, stat:"projectileType", amount:"ultra_juggernaut", desc:"Replaces regular spikes with permanent spikes.", extraMods:{damage: 8, pierce: 40, lifespan: 250.0, baseCooldown: 5.0}}
        ]
    },
    
    canChangeTargeting(tower) {
        return !!tower.stats.smartSpikes;
    },

    update(tower, dt) {
        if (tower.stats.smartSpikes && tower.smartSpikeTimer > 0) {
            tower.smartSpikeTimer -= dt;
            if (tower.smartSpikeTimer <= 0) {
                tower._cooldownMult /= 0.25;
            }
        }
        
        if (tower.stormSpawnsLeft > 0) {
            tower.stormTimer -= dt;
            if (tower.stormTimer <= 0) {
                tower.stormTimer = 0.02; // Spawn batch every 0.02s
                let spawnCount = Math.min(10, tower.stormSpawnsLeft);
                this._spawnSpikeStorm(tower, spawnCount);
                tower.stormSpawnsLeft -= spawnCount;
            }
        }

        if (tower.stats.carpetOfSpikes) {
            tower.carpetTimer = (tower.carpetTimer || 0) - dt;
            if (tower.carpetTimer <= 0) {
                tower.carpetTimer = 15.0;
                tower.stormSpawnsLeft = 80; // Trigger passive storm over time
                tower.stormTimer = 0;
            }
        }
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        const range = Utils.getEffectiveRange(tower, GameEngine);
        const trackPoints = GameEngine.map.getTrackPointsInRange(tower.x, tower.y, range);
        
        let placeX = tower.x;
        let placeY = tower.y;
        
        if (trackPoints.length > 0) {
            if (tower.stats.smartSpikes && tower.targetingMode === 'Smart') {
                let bestPoint = trackPoints[0];
                for (let pt of trackPoints) {
                    if (pt.distAlong > bestPoint.distAlong) bestPoint = pt;
                }
                placeX = bestPoint.x; placeY = bestPoint.y;
            } else if (tower.stats.smartSpikes && tower.targetingMode === 'Close') {
                let bestPoint = trackPoints[0];
                for (let pt of trackPoints) {
                    if (pt.distToTower < bestPoint.distToTower) bestPoint = pt;
                }
                placeX = bestPoint.x; placeY = bestPoint.y;
            } else {
                let randomPoint = trackPoints[Math.floor(Math.random() * trackPoints.length)];
                placeX = randomPoint.x; placeY = randomPoint.y;
            }
        }
        
        let angle = Utils.angle(tower.x, tower.y, placeX, placeY);
        let p = GameEngine.projectilePool.get();
        p.init(tower.x, tower.y, damage, null, tower.stats.projectileType, tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, angle, effects, 0, tower, dmgType);
        p.targetX = placeX;
        p.targetY = placeY;
    },
    ability(tower, engine) {
        engine.log("Spike Storm!");
        tower.stormSpawnsLeft = 200; // Start spawning 200 spikes over time
        tower.stormTimer = 0;
    },
    _spawnSpikeStorm(tower, count) {
        let baseDmg = tower.stats.damage;
        let projType = tower.stats.projectileType;
        let pierce = tower.stats.pierce;
        let dmgType = tower.stats.dmgType;
        let effects = {};
        if (tower.stats.isExplosive) {
            effects.isExplosive = true;
            effects.explosionRadius = tower.stats.explosionRadius;
            effects.explosionDamage = tower.stats.explosionDamage;
            effects.explosionPierce = tower.stats.explosionPierce;
            effects.dot = tower.stats.dot;
            effects.dotTimer = tower.stats.dotTimer;
        }

        for(let i=0; i<count; i++) {
            let x = Math.random() * 900;
            let y = Math.random() * 600;
            let pt = GameEngine.map.getNearestPathPoint(x, y);
            
            let angle = Utils.angle(tower.x, tower.y, pt.x, pt.y);
            let p = GameEngine.projectilePool.get();
            p.init(tower.x, tower.y, baseDmg, null, projType, 800, pierce, 50.0, angle, effects, 0, tower, dmgType);
            p.targetX = pt.x;
            p.targetY = pt.y;
        }
    }
};
