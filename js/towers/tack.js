// js/towers/tack.js
import { GameEngine } from '../engine.js';
import { Projectile } from '../projectile.js';
import { Utils } from '../utils.js';
import Assets from '../assets.js';

export default {
    stats: { 
        name: "Tack Shooter", cost: 260, range: 23, fireRate: 1.12, damage: 1, pierce: 1, projectileSpeed: 250, 
        lifespan: 0.35, desc: "Shoots a volley of tacks in 8 directions.", 
        dmgType: 'sharp', projectileType: 'tack', hitRadius: 18, 
        isStaticRotation: true, 
        tackCount: 8 
    },
    upgrades: {
        1: [
            {name:"Faster Shooting", cost:150, stat:"fireRate", amount:-0.28, desc:"Attacks +33% faster."},
            {name:"Even Faster Shooting", cost:300, stat:"fireRate", amount:-0.21, desc:"Attacks even faster."},
            {name:"Hot Shots", cost:600, stat:"damage", amount:1, desc:"Superhot tacks deal +1 damage and pop Lead.", extraMods:{canHitLead:true, dmgType:'fire'}},
            {name:"Ring of Fire", cost:3500, stat:"damage", amount:3, desc:"Creates a deadly ring of flame instead of tacks.", extraMods:{pierce:29, fireRate:-0.315, dmgType:'fire', projectileType:'fire_ring', lifespan:0.1}},
            {name:"Inferno Ring", cost:45500, stat:"damage", amount:3, desc:"Deadly inferno roasts Bloons. Meteors fall!", extraMods:{moabDmg:4, fireRate:-0.1, range:12, pierce:15}}
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
            {name:"Overdrive", cost:3200, stat:"fireRate", amount:-0.42, desc:"Shoots incredibly fast (3x attack speed)."},
            {name:"The Tack Zone", cost:20000, stat:"tackCount", amount:16, desc:"Many, many tacks. Attacks faster.", extraMods:{fireRate:-0.12, range:7, moabDmg:1}}
        ]
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        // Ring of Fire / Inferno Ring Logic
        if (tower.upgrades[0] >= 4) {
            let expRadius = tower.stats.range * 3.0; // Use scaled range
            GameEngine.explosions.push({ x: tower.x, y: tower.y, radius: 0, maxRadius: expRadius, life: 0.2, maxLife: 0.2, color: '#e67e22' });
            const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, expRadius);
            for (let e of nearby) {
                if (!e.alive) continue;
                if (Utils.distance(tower.x, tower.y, e.x, e.y) < expRadius) {
                    e.takeDamage(damage, dmgType, effects);
                    if (tower.upgrades[0] >= 5) {
                        // Inferno Ring DoT
                        e.dotTimer = 3.0; e.dotDmg = 50; 
                    }
                }
            }
            return;
        }

        // Standard Tack / Blade Shooting
        let count = tower.stats.tackCount || 8;
        let projType = tower.stats.projectileType || 'tack';
        for (let i = 0; i < count; i++) {
            let angle = (i / count) * Math.PI * 2;
            let p = new Projectile(tower.x, tower.y, damage, null, projType, tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, angle, effects, 0, tower, dmgType);
            GameEngine.projectiles.push(p);
        }
    },
    ability(tower, engine) {
        let isSuper = tower.upgrades[1] === 5;
        let count = isSuper ? 120 : 60;
        let dmg = isSuper ? 5 : 2;
        let canHitLead = isSuper; // Super Maelstrom pops lead
        let dmgType = { isSharp: true, canHitLead: canHitLead };
        
        // Spray blades everywhere
        for(let i=0; i<count; i++) {
            let angle = (i / count) * Math.PI * 2 + Math.random() * 0.1;
            let p = new Projectile(tower.x, tower.y, dmg, null, 'blade', 450, 100, 3.0, angle, null, 0, tower, dmgType);
            engine.projectiles.push(p);
        }
        engine.log(isSuper ? "Super Maelstrom Activated!" : "Blade Maelstrom Activated!");
    },
    draw(ctx, tower, isPreview) {
        // Use sprites if available
        const baseAsset = Assets.get(`tower_${tower.type}_base`);
        if (baseAsset && baseAsset.loaded) {
            tower.drawBaseTower(ctx, isPreview);
            return;
        }
        // Center bolt
        ctx.fillStyle = '#7f8c8d';
        ctx.beginPath(); ctx.arc(0, 0, 5 * size, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
};