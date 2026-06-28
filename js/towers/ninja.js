// js/towers/ninja.js
import { GameEngine } from '../engine.js';
import { Projectile } from '../projectile.js';
import { Utils } from '../utils.js';
import { RANGE_SCALE } from '../config.js';

export default {
    stats: { 
        name: "Ninja Monkey", cost: 400, range: 32, fireRate: 0.62, damage: 1, pierce: 2, projectileSpeed: 300, 
        lifespan: 0.5, desc: "Throws shurikens. Can detect Camo.", 
        dmgType: 'sharp', projectileType: 'ninja', hitRadius: 18, 
        canSeeCamo: true, projectileCount: 1
    },
    upgrades: {
        1: [
            {name:"Ninja Discipline", cost:300, stat:"fireRate", amount:-0.1, desc:"Increases attack speed and range.", extraMods:{range:8}},
            {name:"Sharp Shurikens", cost:350, stat:"pierce", amount:2, desc:"Can pop 4 bloons per shuriken."},
            {name:"Double Shot", cost:1200, stat:"projectileCount", amount:1, desc:"Throws 2 shurikens at once."},
            {name:"Bloonjitsu", cost:3500, stat:"projectileCount", amount:3, desc:"Throws 5 shurikens at once!", extraMods:{damage:1}},
            {name:"Grandmaster Ninja", cost:14000, stat:"fireRate", amount:-0.2, desc:"Massive attack speed increase. Throws 8 shurikens.", extraMods:{projectileCount:3, damage:1, pierce:4}}
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
            {name:"Caltrops", cost:500, stat:"caltrops", amount:true, desc:"Drops spikes on the track."},
            {name:"Flash Bomb", cost:2000, stat:"flashBomb", amount:true, desc:"Throws flash bombs that stun bloons."},
            {name:"Sticky Bomb", cost:4500, stat:"stickyBomb", amount:true, desc:"Throws a bomb that sticks to MOABs and explodes."},
            {name:"Master Bomber", cost:14000, stat:"damage", amount:5, desc:"Massive damage against MOABs."}
        ]
    },

    updateSupport(tower, dt) {
        if (tower.stats.shinobi) {
            let ninjaCount = 0;
            let effRange = tower.stats.range * RANGE_SCALE;
            for (let ot of GameEngine.towers) {
                if (ot && ot.type === 'ninja' && ot !== tower) {
                    if (Utils.distance(tower.x, tower.y, ot.x, ot.y) < effRange) {
                        ninjaCount++;
                    }
                }
            }
            let buffMult = Math.min(20, ninjaCount) * 0.05; 
            tower.buffedFireRate = (tower.buffedFireRate || 0) + buffMult;
            tower.buffedPierce = (tower.buffedPierce || 0) + Math.min(20, ninjaCount);
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

        if (tower.stats.flashBomb && shotCount % 4 === 0) {
            projType = 'flash_bomb';
            projDamage = 1;
            projDmgType = { isExplosion: true, canHitLead: true };
            ninjaEffects.stun = 1.0; 
        } else if (tower.stats.stickyBomb && target.data.isMoab && shotCount % 3 === 0) {
            projType = 'sticky_bomb';
            projDamage = tower.stats.damage * 10; 
            projDmgType = { isExplosion: true, canHitLead: true, moabDmg: 50 };
        }

        // PRO FIX: Proper spread for multi-shots
        let spread = count > 2 ? 20 : 15; // 15 deg for Double, 20 deg for Bloonjitsu/Grandmaster
        for(let i=0; i<count; i++) {
            let offset = spread * (i - (count-1)/2);
            let p = new Projectile(tower.x, tower.y, projDamage, target, projType, tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, ninjaEffects, offset, tower, projDmgType);
            p.isCrit = isCrit;
            GameEngine.projectiles.push(p);
        }

        // PRO FIX: Caltrops drop ON THE TRACK
        if (tower.stats.caltrops && shotCount % 5 === 0) {
            let trackPoint = GameEngine.map.getNearestPathPoint(tower.x, tower.y);
            let p = new Projectile(trackPoint.x, trackPoint.y, 1, null, 'spike', 0, 8, 10.0, Math.PI/2, null, 0, tower, { isSharp: true, canHitLead: true });
            GameEngine.projectiles.push(p);
        }
    },

    ability(tower, engine) {
        engine.log("Bloon Sabotage Activated!");
        for (let e of engine.enemies) {
            if (!e.alive) continue;
            e.applySlow(0.5, 15.0, false); 
        }
    }
};