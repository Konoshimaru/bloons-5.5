// js/towers/tack.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

const _tackRingScratch = [];

export default {
    stats: { 
        name: "Tack Shooter", cost: 280, range: 23, 
        baseCooldown: 1.12, fireRate: 1.12, 
        damage: 1, pierce: 1, 
        projectileSpeed: 160, 
        lifespan: 0.4, 
        desc: "Shoots a volley of tacks in 8 directions.", 
        dmgType: 'sharp', projectileType: 'tack', hitRadius: 18, 
        isStaticRotation: true, 
        tackCount: 8,
        category: 'Primary',
        isAbility: false,
        abilityName: "Blade Maelstrom", 
        abilityCd: 20,
        abilities: [
            { lvl: 4, name: "Blade Maelstrom", desc: "Covers the area in a storm of blades." },
            { lvl: 5, name: "Super Maelstrom", desc: "Even more powerful Maelstrom ability and lasts longer." }
        ]
    },
    upgrades: {
        1: [
            {name:"Faster Shooting", cost:150, desc:"Shoots tacks faster.", cooldownMult: 0.75},
            {name:"Even Faster Shooting", cost:300, desc:"Shoots tacks even faster.", cooldownMult: 0.75},
            {name:"Hot Shots", cost:600, stat:"damage", amount:1, desc:"Superhot tacks deal +1 damage and pop Lead.", extraMods:{dmgType:'normal', canHitLead:true, canHitFrozen:true}},
            {name:"Ring of Fire", cost:3500, stat:"damage", amount:3, desc:"Creates a deadly ring of flame instead of tacks.", cooldownMult: 0.5, extraMods:{pierce:30, dmgType:'fire', explosionRadius:25}},
            {name:"Inferno Ring", cost:45500, stat:"damage", amount:3, desc:"Deadly inferno roasts Bloons into oblivion.", cooldownMult: 0.317, extraMods:{moabDmg:4, pierce:15, explosionRadius:36.5, range:11.5}}
        ],
        2: [
            {name:"Long Range Tacks", cost:100, stat:"range", amount:3.91, desc:"Tacks fly out further.", extraMods:{projectileSpeed:27.2, lifespan:0.134}},
            {name:"Super Range Tacks", cost:225, stat:"range", amount:3.91, desc:"Even longer range.", extraMods:{pierce:3, lifespan:0.1291}},
            {name:"Blade Shooter", cost:550, stat:"pierce", amount:4, desc:"Shoots sharp blades that can shatter frozen Bloons.", extraMods:{projectileType:'blade', range:15.18, dmgType:'shatter', canHitFrozen:true, lifespan:0.0788}},
            {name:"Blade Maelstrom", cost:2700, stat:"damage", amount:1, desc:"Ability: Covers the area in a storm of blades.", extraMods:{unlocksAbility:true, isAbility:true, abilityName:"Blade Maelstrom", abilityCd:20}},
            {name:"Super Maelstrom", cost:15000, stat:"damage", amount:3, desc:"Even more powerful Maelstrom ability.", extraMods:{dmgType:'normal', canHitLead:true, canHitFrozen:true, ceramicDmg:5}}
        ],
        3: [
            {name:"More Tacks", cost:110, stat:"tackCount", amount:2, desc:"Shoots 10 tacks instead of 8."},
            {name:"Even More Tacks", cost:110, stat:"tackCount", amount:2, desc:"Shoots 12 tacks per shot."},
            {name:"Tack Sprayer", cost:450, stat:"tackCount", amount:4, desc:"Sprays out 16 higher pierce tacks per volley.", extraMods:{pierce:1}},
            {name:"Overdrive", cost:3200, desc:"Shoots incredibly fast (3x attack speed).", cooldownMult: 0.3333},
            {name:"The Tack Zone", cost:20000, stat:"tackCount", amount:16, desc:"Many, many tacks. Attacks faster.", cooldownMult: 0.2, extraMods:{range:7, moabDmg:1, projectileSpeed:80}}
        ]
    },
    
    update(tower, dt, engine) {
        // Inferno Ring Meteor Logic
        if (tower.upgrades[0] >= 5) {
            if (tower.meteorCd === undefined) tower.meteorCd = 4.0;
            if (tower.meteorCd > 0) {
                tower.meteorCd -= dt;
            } else {
                let bestMoab = null; let bestHp = 0;
                for (let e of engine.enemies) {
                    if (e.alive && e.data.isMoab && e.hp > bestHp) {
                        bestHp = e.hp; bestMoab = e;
                    }
                }
                if (bestMoab) {
                    let meteor = engine.projectilePool.get();
                    // Spawn exactly from the center of the tower
                    meteor.init(tower.x, tower.y, 700, bestMoab, 'meteor', 800, 1, 2.0, null, {isExplosive: true, explosionRadius: 18, explosionDamage: 50, explosionPierce: 10}, 0, tower, {isExplosion: true, canHitLead: true, isFire: true});
                    tower.meteorCd = 4.0;
                }
            }
        }

        // Maelstrom Ability Logic
        if (tower.maelstromTimer > 0) {
            tower.maelstromTimer -= dt;
            tower.maelstromFireCd = (tower.maelstromFireCd || 0) - dt;
            
            tower.maelstromAngle = (tower.maelstromAngle || 0) - (dt * Math.PI * 2);
            
            if (tower.maelstromFireCd <= 0) {
                tower.maelstromFireCd = 0.045;
                let isSuper = tower.upgrades[1] === 5;
                let count = isSuper ? 4 : 2;
                let dmg = 2;
                let pierce = isSuper ? 300 : 100;
                let ceramicDmg = isSuper ? 8 : 0;
                let dmgType = { isShatter: true, canHitLead: isSuper, canHitFrozen: true, ceramicDmg: ceramicDmg };
                
                for(let i=0; i<count; i++) {
                    let angle = tower.maelstromAngle + (i / count) * Math.PI * 2;
                    let p = engine.projectilePool.get();
                    p.init(tower.x, tower.y, dmg, null, 'blade', 150, pierce, 2.0, angle, null, 0, tower, dmgType);
                }
            }
        }
    },

    fire(tower, target, damage, dmgType, isCrit, effects) {
        // Ring of Fire / Inferno Ring
        if (tower.upgrades[0] >= 4) {
            // FIX: Scale explosion radius proportionally to the tower's effective range
            // This converts the BTD6 "unit" radius (25) into the correct amount of screen pixels
            const baseRange = tower.stats.range || 23;
            const expRadiusRaw = tower.stats.explosionRadius || 25;
            const effRange = Math.max(1, Utils.getEffectiveRange(tower, GameEngine));
            let expRadius = effRange * (expRadiusRaw / baseRange);
            
            // Lingers for 1.0s so it perfectly overlaps with the next shot
            GameEngine.explosions.push({ x: tower.x, y: tower.y, radius: 0, maxRadius: expRadius, life: 1.0, maxLife: 1.0, color: '#e67e22' });
            
            const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, expRadius, _tackRingScratch);
            for (let e of nearby) {
                if (!e.alive) continue;
                if (Utils.withinRange(tower.x, tower.y, e.x, e.y, expRadius)) {
                    let infernoEffects = effects;
                    if (tower.upgrades[0] >= 5) {
                        infernoEffects = { ...effects, dot: 4, dotTimer: 1.0, dotDuration: 3.0 };
                    }
                    let dmgDealt = e.takeDamage(damage, dmgType, infernoEffects, tower);
                    if (!isNaN(dmgDealt) && dmgDealt !== -1) {
                        tower.damageDealt += dmgDealt;
                    }
                }
            }
            return;
        }

        // Standard Tacks / Blades
        let count = tower.stats.tackCount || 8;
        let projType = tower.stats.projectileType || 'tack';
        const spawnR = (tower.stats.hitRadius || 14) * 0.6;
        for (let i = 0; i < count; i++) {
            let angle = (i / count) * Math.PI * 2;
            let p = GameEngine.projectilePool.get();
            // Spawn from the edge of the tack's hit area, not the exact
            // center, so projectiles don't appear inside the character.
            p.init(tower.x + Math.cos(angle) * spawnR, tower.y + Math.sin(angle) * spawnR, damage, null, projType, tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, angle, effects, 0, tower, dmgType, isCrit);
        }
    },

    ability(tower, engine) {
        let isSuper = tower.upgrades[1] === 5;
        tower.maelstromTimer = isSuper ? 9.0 : 3.0;
        tower.maelstromFireCd = 0;
        tower.maelstromAngle = 0;
        engine.log(isSuper ? "Super Maelstrom Activated!" : "Blade Maelstrom Activated!");
    },

    draw(ctx, tower, isPreview) {
        tower.drawBaseTower(ctx, isPreview);
    }
};