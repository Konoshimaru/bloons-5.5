// js/towers/desperado.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

export default {
    stats: { 
        name: "Desperado", cost: 300, range: 60, fireRate: 1.2, 
        damage: 1, pierce: 1, projectileSpeed: 2000, // High speed to simulate hitscan
        lifespan: 0.2, desc: "Attacks in 2 shot bursts. High range, low pierce.", 
        dmgType: 'sharp', projectileType: 'nail', hitRadius: 8, 
        projectileCount: 2, category: 'Primary' 
    },
    upgrades: {
        1: [
            {name:"Quickdraw", cost:200, desc:"Attacks faster the further Bloons are from Desperado.", extraMods:{quickdraw: true}},
            {name:"Standoff", cost:200, desc:"Attacks faster the fewer Bloons are in range.", extraMods:{standoff: true}},
            {name:"Big Iron", cost:1200, stat:"projectileCount", amount:4, desc:"Upgrades pistol to a 6-shot revolver."},
            {name:"Twin Sixes", cost:5800, stat:"damage", amount:2, desc:"Gains twin higher damage revolvers.", extraMods:{cooldownMult: 0.8}},
            {name:"The Blazing Sun", cost:16500, stat:"dmgType", amount:'fire', desc:"They say Desperado shoots so fast them revolvers catch alight.", extraMods:{cooldownMult: 0.5, dot: 2, dotTimer: 1.0}}
        ],
        2: [
            {name:"Eagle Eye", cost:150, stat:"canSeeCamo", amount:true, desc:"Desperado can see Camo Bloons."},
            {name:"Bullseye", cost:350, desc:"Shots get a chance to Crit. Chance goes up when target is further away.", extraMods:{canCrit: true, critChance: 0.3, critDmg: 5}},
            {name:"Deadeye", cost:3000, stat:"damage", amount:4, desc:"Gains a long range rifle. Excel against Fortified. Can pop Lead.", extraMods:{projectileCount: -1, pierce: 3, range: 20, fortifiedDmg: 4, canHitLead: true, cooldownMult: 1.5, isRifle: true}},
            {name:"Bounty Hunter", cost:6000, stat:"damage", amount:4, desc:"Marks Bloons, then proceeds to attack all Marked Bloons. Marked Bloons give more cash.", extraMods:{bounty: 10}},
            {name:"Golden Justice", cost:42000, stat:"damage", amount:10, desc:"They say Desperado's longarm can hit clean through an army of Bloons.", extraMods:{pierce: 10, fortifiedDmg: 10, bounty: 25}}
        ],
        3: [
            {name:"Wanderer", cost:220, desc:"Attacks much faster, but less so when more Monkeys are in range.", extraMods:{wanderer: true}},
            {name:"Nomad", cost:280, desc:"Attacks faster the more Bloons are in range.", extraMods:{nomad: true}},
            {name:"Enforcer", cost:2100, stat:"projectileCount", amount:3, desc:"Uses a shotgun that can knock back Bloons.", extraMods:{spread: 30, knockback: 15, cooldownMult: 1.2, isShotgun: true}},
            {name:"Avenger", cost:9500, stat:"damage", amount:2, desc:"Shotgun hits release shrapnel and can even knock back MOABs.", extraMods:{fragCount: 4, knockback: 30}},
            {name:"The Desert Phantom", cost:31000, stat:"damage", amount:15, desc:"They say Desperado hits so hard it's like a mine blast.", extraMods:{isExplosive: true, explosionRadius: 30, explosionDamage: 15, cooldownMult: 0.8}}
        ]
    },

    update(tower, dt, engine) {
        // Dynamic attack speed buffs
        let buffMult = 0;
        
        // Quickdraw (faster if bloons are far)
        if (tower.stats.quickdraw) {
            // Simplified: just grant a static buff for performance
            buffMult += 0.15;
        }
        
        // Standoff (faster if few bloons)
        if (tower.stats.standoff) {
            const nearby = engine.enemyGrid.query(tower.x, tower.y, Utils.getEffectiveRange(tower, engine));
            if (nearby.length < 5) buffMult += 0.2;
        }
        
        // Wanderer (faster if few monkeys nearby)
        if (tower.stats.wanderer) {
            let monkeyCount = 0;
            for (const t of engine.towers) {
                if (t && t !== tower && Utils.distanceSq(tower.x, tower.y, t.x, t.y) < 100*100) monkeyCount++;
            }
            if (monkeyCount === 0) buffMult += 0.3;
        }
        
        // Nomad (faster if many bloons)
        if (tower.stats.nomad) {
            const nearby = engine.enemyGrid.query(tower.x, tower.y, Utils.getEffectiveRange(tower, engine));
            if (nearby.length > 10) buffMult += 0.3;
        }

        if (buffMult > 0) {
            tower.buffedFireRate = Math.max(tower.buffedFireRate || 0, buffMult);
        }
    },

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        let pEffects = { ...effects };
        if (tower.stats.knockback) pEffects.knockback = tower.stats.knockback;
        if (tower.stats.bounty) pEffects.gold = tower.stats.bounty; // Approximate bounty with gold effect
        if (tower.stats.dot) { pEffects.dot = tower.stats.dot; pEffects.dotTimer = tower.stats.dotTimer; }
        if (tower.stats.fragCount) pEffects.fragCount = tower.stats.fragCount;
        
        let count = tower.stats.projectileCount || 2;
        if (count < 1) count = 1; // Ensure at least 1 for rifle mode
        let spread = tower.stats.spread || 0;
        let isShotgun = tower.stats.isShotgun;
        let isRifle = tower.stats.isRifle;
        let isExplosive = tower.stats.isExplosive;

        for (let i = 0; i < count; i++) {
            let offset = spread > 0 ? (spread * (i - (count - 1) / 2)) : 0;
            let pType = tower.stats.projectileType;
            let pPierce = tower.stats.pierce;
            
            // Rifle mode: 1 high power shot
            if (isRifle) {
                pType = 'arrow'; // Use arrow for rifle visual
                pPierce = tower.stats.pierce;
            } else if (isShotgun) {
                pType = 'tack'; // Use tack for shotgun visual
            }

            let p = engine.projectilePool.get();
            p.init(tower.x, tower.y, damage, target, pType, tower.stats.projectileSpeed, pPierce, tower.stats.lifespan, null, pEffects, offset, tower, dmgType, isCrit);
            
            // Explosive shotgun (T5)
            if (isExplosive) {
                p.effects.isExplosive = true;
                p.effects.explosionRadius = tower.stats.explosionRadius;
                p.effects.explosionDamage = tower.stats.explosionDamage;
                p.effects.explosionPierce = 20;
                p.dmgType.isExplosion = true;
            }
        }
    }
};
