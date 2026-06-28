// js/towers/alchemist.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { Projectile } from '../projectile.js';
import { RANGE_SCALE } from '../config.js';

export default {
    stats: { name: "Alchemist", cost: 400, range: 36, fireRate: 1.1, damage: 1, pierce: 1, projectileSpeed: 400, lifespan: 1.0, desc: "Throws acid flasks that splash and damage bloons. Can buff towers or alter bloons.", dmgType: 'acid', projectileType: 'potion', hitRadius: 18, explosionRadius: 20 },
    upgrades: {
        1: [
            {name:"Stronger Acid",cost:300,stat:"damage",amount:1,desc:"Deals +1 damage and applies Damage Over Time.", extraMods: {applyDot: 1}},
            {name:"Acid Pool",cost:400,stat:"explosionRadius",amount:15,desc:"Creates a larger splash of acid."},
            {name:"Lead to Gold",cost:2000,stat:"canHitLead",amount:true,desc:"Turns Lead bloons into gold, granting cash.", extraMods: {gold: 50}},
            {name:"Rubber to Gold",cost:4000,stat:"damage",amount:2,desc:"All hit bloons turn to gold and take extra damage.", extraMods: {gold: 20}},
            {name:"Bloon Master Alchemist",cost:30000,stat:"damage",amount:10,desc:"Shrinks non-MOAB bloons to reds instantly.", extraMods: {instakill: true}}
        ],
        2: [
            {name:"Berserker Brew",cost:500,stat:"buffDmg",amount:1,desc:"Buffs nearby towers with +1 damage.", extraMods: {buffPierce: 1}},
            {name:"Stimulating Potions",cost:1200,stat:"buffFireRate",amount:0.2,desc:"Buffs nearby towers with +20% attack speed."},
            {name:"Permanent Brew",cost:3000,stat:"buffDmg",amount:1,desc:"Buffs are stronger.", extraMods: {buffFireRate: 0.1}},
            {name:"Stronger Stimulant",cost:8000,stat:"buffFireRate",amount:0.2,desc:"Massive attack speed boost to nearby towers.", extraMods: {buffRange: 0.2}},
            {name:"Total Transformation",cost:25000,stat:"buffDmg",amount:5,desc:"Godlike buffs to all nearby towers.", extraMods: {buffFireRate: 0.5, buffRange: 0.3}}
        ],
        3: [
            {name:"Larger Potions",cost:250,stat:"explosionRadius",amount:10,desc:"Increased splash radius."},
            {name:"Faster Throwing",cost:300,stat:"fireRate",amount:-0.3,desc:"Throws potions faster."},
            {name:"Acidic Mixture Dip",cost:1500,stat:"dip",amount:true,desc:"Potions dip bloons, making them take +1 damage from all sources.", extraMods: {canSeeCamo: true}},
            {name:"Unstable Concoction",cost:3500,stat:"moabDmg",amount:5,desc:"Deals +5 damage to MOABs and applies heavy DoT."},
            {name:"Grand Concoction",cost:30000,stat:"explosionRadius",amount:40,desc:"Colossal splash radius and damage.", extraMods: {damage: 10}}
        ]
    },
    updateSupport(tower, dt) {
        if (tower.stats.buffDmg > 0 || tower.stats.buffFireRate > 0) {
            const effRange = tower.stats.range * RANGE_SCALE;
            for (let t of GameEngine.towers) {
                if (t === tower) continue;
                if (Utils.distance(tower.x, tower.y, t.x, t.y) < effRange) {
                    t.buffedDmg = Math.max(t.buffedDmg || 0, tower.stats.buffDmg || 0);
                    t.buffedFireRate = Math.max(t.buffedFireRate, tower.stats.buffFireRate || 0);
                    t.buffedRange = Math.max(t.buffedRange, tower.stats.buffRange || 0);
                    t.buffedPierce = Math.max(t.buffedPierce || 0, tower.stats.buffPierce || 0);
                }
            }
        }
    },
    update(tower, dt) {
        tower.acquireAndFire(dt);
    },
    draw(ctx, tower, isPreview) {
        tower.drawBaseTower(ctx, isPreview);
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        effects.explosionRadius = tower.stats.explosionRadius; 
        effects.gold = tower.stats.gold || 0; 
        effects.instakill = tower.stats.instakill || false; 
        effects.dip = tower.stats.dip || false; 
        effects.dot = tower.stats.applyDot || 0; 
        effects.moabDot = tower.stats.moabDmg > 0 ? 10 : 0; 
        
        GameEngine.projectiles.push(new Projectile(tower.x, tower.y, damage, target, 'potion', tower.stats.projectileSpeed, 1, tower.stats.lifespan, null, effects, 0, tower, dmgType));
    }
};