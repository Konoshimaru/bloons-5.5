/**
 * SUB-ENTITY PATTERN: PASSIVE AURA / UPDATE SUPPORT
 * =================================================
 * The Village (and Farm, Ninja, Sniper) uses the `updateSupport(tower, dt, engine)` hook.
 * 
 * - Lifecycle: Has no sub-entities. The tower itself is the aura.
 * - Updates: `updateSupport()` is called every frame by `simulationLoop._updateTowers()`
 *   *before* the standard `update()` method.
 * - Purpose: Used for logic that must run continuously regardless of attack state, 
 *   such as scanning for nearby towers to buff (Village), generating cash (Farm), 
 *   or applying global modifiers (Ninja/Sniper).
 */

// js/towers/ninja.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { RANGE_SCALE } from '../config.js';

export default {
    stats: {
        name: "Ninja Monkey", cost: 400, range: 32,
        baseCooldown: 0.62, fireRate: 0.62,
        damage: 1, pierce: 2, projectileSpeed: 450,
        lifespan: 0.5, desc: "Throws shurikens. Can detect Camo.",
        dmgType: 'sharp', projectileType: 'ninja', hitRadius: 18,
        canSeeCamo: true, projectileCount: 1
    },
    upgrades: {
        1: [
            {name:"Ninja Discipline", cost:300, desc:"Increases attack speed and range.", cooldownMult: 0.85, extraMods:{range:8}},
            {name:"Sharp Shurikens", cost:350, stat:"pierce", amount:2, desc:"Can pop 4 bloons per shuriken."},
            {name:"Double Shot", cost:1200, desc:"Throws 2 shurikens at a time.", cooldownMult: 0.75, extraMods: { projectileCount: 1 }},
            {name:"Bloonjitsu", cost:3500, desc:"Throws 5 shurikens at once!", cooldownMult: 0.5, extraMods: { projectileCount: 3, damage: 1 }},
            {name:"Grandmaster Ninja", cost:14000, desc:"Massive attack speed increase. Throws 8 shurikens.", cooldownMult: 0.5, extraMods: { projectileCount: 3, damage: 1 }}
        ],
        2: [
            {name:"Distraction", cost:250, stat:"distraction", amount:true, desc:"Shurikens have a chance to knock bloons backwards."},
            {name:"Counter-Espionage", cost:400, stat:"counterEspionage", amount:true, desc:"Strips Camo from bloons they hit."},
            {name:"Shinobi Tactics", cost:2000, stat:"shinobi", amount:true, desc:"Buffs nearby Ninja Monkeys' attack speed and pierce."},
            {name:"Bloon Sabotage", cost:4000, stat:"isAbility", amount:true, desc:"Ability: Slows all bloons on screen by 50% for 15s.", extraMods:{unlocksAbility:true, abilityName:"Sabotage", abilityCd:45}},
            {name:"Grand Saboteur", cost:14000, stat:"damage", amount:2, desc:"Increases ability duration and damage."}
        ],
        3: [
            {name:"Seeking Shuriken", cost:300, stat:"seeking", amount:true, desc:"Shurikens seek out bloons automatically."},
            {name:"Caltrops", cost:500, stat:"caltrops", amount:true, desc:"Dispenses caltrops onto the ground every 3.9 seconds."},
            {name:"Flash Bomb", cost:2000, stat:"flashBomb", amount:true, desc:"Throws flash bombs that stun bloons."},
            {name:"Sticky Bomb", cost:4500, stat:"stickyBomb", amount:true, desc:"Throws a bomb that sticks to MOABs and explodes."},
            {name:"Master Bomber", cost:14000, stat:"damage", amount:5, desc:"Massive damage against MOABs."}
        ]
    },
    updateSupport(tower, dt) {
        if (tower.stats.shinobi) {
            let ninjaCount = 0; 
            let effRange = Utils.getEffectiveRange(tower, GameEngine);
            const nearbyTowers = GameEngine.towerGrid.query(tower.x, tower.y, effRange);
            for (let ot of nearbyTowers) { 
                if (ot && ot.type === 'ninja' && ot !== tower) { 
                    if (Utils.withinRange(tower.x, tower.y, ot.x, ot.y, effRange)) ninjaCount++; 
                } 
            }
            let stacks = Math.min(20, ninjaCount); 
            let speedBuff = stacks * 0.05; 
            let pierceBuff = (tower.stats.pierce || 2) * (stacks * 0.08);
            tower.buffedFireRate = (tower.buffedFireRate || 0) + speedBuff; 
            tower.buffedPierce = (tower.buffedPierce || 0) + pierceBuff;
        }
    },
    update(tower, dt) {
        if (tower.stats.caltrops) {
            tower.caltropTimer = (tower.caltropTimer || 3.9) - dt;
            if (tower.caltropTimer <= 0) {
                tower.caltropTimer = 3.9 * (tower._cooldownMult || 1.0);
                this._fireCaltrops(tower);
            }
        }
    },
    _fireCaltrops(tower) {
        const range = Utils.getEffectiveRange(tower, GameEngine);
        const trackPoints = GameEngine.map.getTrackPointsInRange(tower.x, tower.y, range);
        if (trackPoints.length > 0) {
            let pt = trackPoints[Math.floor(Math.random() * trackPoints.length)];
            
            let caltropEffects = {};
            if (tower.stats.distraction && Math.random() < 0.10) {
                caltropEffects.knockback = 30;
            }
            
            let angle = Utils.angle(tower.x, tower.y, pt.x, pt.y);
            let p = GameEngine.projectilePool.get();
            p.init(tower.x, tower.y, 1, null, 'spike', 600, 6, 35.0, angle, caltropEffects, 0, tower, { isSharp: true });
            p.targetX = pt.x;
            p.targetY = pt.y;
        }
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        let count = tower.stats.projectileCount || 1; 
        let shotCount = tower.shotCount || 0; 
        tower.shotCount++;
        let ninjaEffects = { ...effects };
        if (tower.stats.distraction && Math.random() < 0.3) ninjaEffects.knockback = 30;
        if (tower.stats.counterEspionage) ninjaEffects.stripCamo = true;
        let projType = tower.stats.projectileType; 
        let projDamage = damage; 
        let projDmgType = dmgType; 
        let projPierce = (tower.stats.pierce + (tower.buffedPierce || 0)) || 2;
        if (tower.stats.flashBomb && shotCount % 4 === 0) {
            projType = 'flash_bomb'; projDamage = 1; projPierce = 1; projDmgType = { isExplosion: true, canHitLead: true };
            ninjaEffects.stun = 1.0; ninjaEffects.isExplosive = true; ninjaEffects.explosionPierce = 30; ninjaEffects.explosionRadius = 60; ninjaEffects.explosionDamage = 1;
        } else if (tower.stats.stickyBomb && target.data.isMoab && shotCount % 3 === 0) {
            projType = 'sticky_bomb'; projDamage = tower.stats.damage * 10; projPierce = 1; projDmgType = { isExplosion: true, canHitLead: true, moabDmg: 50 };
            ninjaEffects.isExplosive = true; ninjaEffects.explosionPierce = 1; ninjaEffects.explosionRadius = 60; ninjaEffects.explosionDamage = projDamage;
        }
        let spread = count > 2 ? 20 : 15;
        for(let i=0; i<count; i++) {
            let offset = spread * (i - (count-1)/2);
            let p = GameEngine.projectilePool.get();
            p.init(tower.x, tower.y, projDamage, target, projType, tower.stats.projectileSpeed, projPierce, tower.stats.lifespan, null, ninjaEffects, offset, tower, projDmgType);
            p.isCrit = isCrit;
        }
    },
    ability(tower, engine) {
        engine.log("Bloon Sabotage Activated!");
        for (let e of engine.enemies) { if (!e.alive) continue; e.applySlow(0.5, 15.0, false); }
    }
};