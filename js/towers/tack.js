import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

export default {
    stats: { 
        name: "Tack Shooter", cost: 260, range: 23, 
        baseCooldown: 1.12, fireRate: 1.12, 
        damage: 1, pierce: 1, projectileSpeed: 250, 
        lifespan: 0.35, desc: "Shoots a volley of tacks in 8 directions.", 
        dmgType: 'sharp', projectileType: 'tack', hitRadius: 18, 
        isStaticRotation: true, 
        tackCount: 8,
        category: 'Primary' // FIX 1
    },
    upgrades: {
        1: [
            {name:"Faster Shooting", cost:150, desc:"Attacks +33% faster.", cooldownMult: 0.75},
            {name:"Even Faster Shooting", cost:300, desc:"Attacks even faster.", cooldownMult: 0.75},
            {name:"Hot Shots", cost:600, stat:"damage", amount:1, desc:"Superhot tacks deal +1 damage and pop Lead.", extraMods:{canHitLead:true, dmgType:'fire'}},
            {name:"Ring of Fire", cost:3500, stat:"damage", amount:3, desc:"Creates a deadly ring of flame instead of tacks.", cooldownMult: 0.5, extraMods:{pierce:29, dmgType:'fire', projectileType:'fire_ring', lifespan:0.1}},
            {name:"Inferno Ring", cost:45500, stat:"damage", amount:3, desc:"Deadly inferno roasts Bloons. Meteors fall!", extraMods:{moabDmg:4, range:12, pierce:15}}
        ],
        2: [
            {name:"Long Range Tacks", cost:100, stat:"range", amount:4, desc:"Tacks fly out further.", extraMods:{projectileSpeed:50}},
            {name:"Super Range Tacks", cost:225, stat:"range", amount:4, desc:"Even longer range.", extraMods:{pierce:3}},
            {name:"Blade Shooter", cost:550, stat:"pierce", amount:4, desc:"Shoots sharp blades that pop up to 8 bloons.", extraMods:{projectileType:'blade', range:15}},
            {name:"Blade Maelstrom", cost:2700, stat:"damage", amount:1, desc:"Ability: Covers the area in a storm of blades.", extraMods:{unlocksAbility:true, abilityName:"Maelstrom", abilityCd:35}},
            {name:"Super Maelstrom", cost:15000, stat:"damage", amount:3, desc:"Even more powerful Maelstrom ability.", extraMods:{canHitLead:true}}
        ],
        3: [
            {name:"More Tacks", cost:110, stat:"tackCount", amount:2, desc:"Shoots 10 tacks instead of 8."},
            {name:"Even More Tacks", cost:110, stat:"tackCount", amount:2, desc:"Shoots 12 tacks per shot."},
            {name:"Tack Sprayer", cost:450, stat:"tackCount", amount:4, desc:"Sprays out 16 tacks per volley.", extraMods:{pierce:1}},
            {name:"Overdrive", cost:3200, desc:"Shoots incredibly fast (3x attack speed).", cooldownMult: 0.33},
            {name:"The Tack Zone", cost:20000, stat:"tackCount", amount:16, desc:"Many, many tacks. Attacks faster.", cooldownMult: 0.5, extraMods:{range:7, moabDmg:1}}
        ]
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        if (tower.upgrades[0] >= 4) {
            let expRadius = tower.stats.range * 3.0; 
            GameEngine.explosions.push({ x: tower.x, y: tower.y, radius: 0, maxRadius: expRadius, life: 0.2, maxLife: 0.2, color: '#e67e22' });
            const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, expRadius);
            for (let e of nearby) {
                if (!e.alive) continue;
                if (Utils.withinRange(tower.x, tower.y, e.x, e.y, expRadius)) {
                    e.takeDamage(damage, dmgType, effects);
                    if (tower.upgrades[0] >= 5) {
                        e.dotTimer = 3.0; e.dotDmg = 50; 
                    }
                }
            }
            return;
        }

        let count = tower.stats.tackCount || 8;
        let projType = tower.stats.projectileType || 'tack';
        for (let i = 0; i < count; i++) {
            let angle = (i / count) * Math.PI * 2;
            let p = GameEngine.projectilePool.get();
            p.init(tower.x, tower.y, damage, null, projType, tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, angle, effects, 0, tower, dmgType, isCrit);
        }
    },
    ability(tower, engine) {
        let isSuper = tower.upgrades[1] === 5;
        let count = isSuper ? 120 : 60;
        let dmg = isSuper ? 5 : 2;
        let canHitLead = isSuper; 
        let dmgType = { isSharp: true, canHitLead: canHitLead };
        
        for(let i=0; i<count; i++) {
            let angle = (i / count) * Math.PI * 2 + Math.random() * 0.1;
            let p = GameEngine.projectilePool.get();
            p.init(tower.x, tower.y, dmg, null, 'blade', 450, 100, 3.0, angle, null, 0, tower, dmgType);
        }
        engine.log(isSuper ? "Super Maelstrom Activated!" : "Blade Maelstrom Activated!");
    },
    draw(ctx, tower, isPreview) {
        tower.drawBaseTower(ctx, isPreview);
    }
};