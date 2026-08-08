// js/towers/sniper.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import Assets from '../assets.js';
import { GLOBAL_SCALE } from '../constants.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

const _sniperBounceScratch = [];

export default {
    stats: {
        name: "Sniper Monkey", cost: 350, range: 9999,
        baseCooldown: 1.59, fireRate: 1.59,
        damage: 2, pierce: 1, projectileSpeed: 1000, hitscan: true,
        lifespan: 1.2, desc: "Shoots bloons from anywhere on the map.",
        dmgType: 'sharp', projectileType: 'dart', hitRadius: 18,
        drawSize: 150
    },
    upgrades: {
        1: [
            {name:"Full Metal Jacket", cost:350, stat:"damage", amount:2, desc:"Deals 2 extra damage. Can pop Lead and Frozen.", extraMods:{dmgType:'heavy'}},
            {name:"Large Calibre", cost:1300, stat:"damage", amount:3, desc:"Deals 3 extra damage."},
            {name:"Deadly Precision", cost:2200, stat:"damage", amount:13, desc:"Deals massive damage to Ceramics.", extraMods:{bonusCeramic:50}},
            {name:"Maim MOAB", cost:6300, stat:"damage", amount:10, desc:"Stuns MOAB-class bloons.", extraMods:{stunMoab:3, stunBfb:1.5, stunZomg:0.5, stunDdt:1.5}},
            {name:"Cripple MOAB", cost:32000, stat:"damage", amount:110, desc:"Increased stun. Crippled MOABs take +5 damage from all sources.", extraMods:{stunMoab:6, stunBfb:3, stunZomg:1, stunDdt:3, crippleDebuff:true}}
        ],
        2: [
            {name:"Night Vision Goggles", cost:250, stat:"canSeeCamo", amount:true, desc:"Can detect Camo bloons. +2 dmg to Camo.", extraMods:{bonusCamo:2}},
            {name:"Shrapnel Shot", cost:450, stat:"shrapnel", amount:true, desc:"Bullets spray shrapnel on hit.", extraMods:{shrapnelDmg:1, shrapnelPierce:3}},
            {name:"Bouncing Bullet", cost:2100, stat:"bounces", amount:2, desc:"Bullet ricochets to 2 more bloons."},
            {name:"Supply Drop", cost:7600, stat:"isAbility", amount:true, desc:"Ability: Drops a crate for $1100. Bounces to 5.", extraMods:{unlocksAbility:true, abilityName:"Supply Drop", abilityCd:90, bounces:4, dmgType:'heavy', supplyCash:1100}},
            {name:"Elite Sniper", cost:14500, stat:"damage", amount:2, desc:"Ability gives $3000. All Snipers attack faster. Unlocks Elite targeting.", extraMods:{supplyCash:3000, globalSniperBuff:true, shrapnelDmg:1, unlocksElite:true}}
        ],
        3: [
            {name:"Fast Firing", cost:400, desc:"Attacks faster.", cooldownMult: 0.70},
            {name:"Even Faster Firing", cost:400, desc:"Attacks even faster.", cooldownMult: 0.70},
            {name:"Semi-Automatic", cost:2700, desc:"Attacks 3x faster.", cooldownMult: 0.333},
            {name:"Full Auto Rifle", cost:4100, desc:"Attacks incredibly fast. Can pop Lead.", cooldownMult: 0.33, extraMods:{dmgType:'heavy'}},
            {name:"Elite Defender", cost:14000, desc:"Hyper-flurry. 2x dmg to MOABs. Speed scales with track distance. Life-loss frenzy.", cooldownMult: 0.5, extraMods:{eliteDefender:true}}
        ]
    },
    update(tower, dt, engine) {
        if (!tower._waveActive && GameEngine.waveManager.waveActive) {
            tower.abilityUsesThisRound = 0;
        }
        tower._waveActive = GameEngine.waveManager.waveActive;
        
        if (tower.stats.eliteDefender) {
            if (engine.lives < (tower._lastLives || engine.lives)) {
                tower.frenzyTimer = 4.0;
            }
            tower._lastLives = engine.lives;
            if (tower.frenzyTimer > 0) {
                tower.frenzyTimer -= dt;
                tower.eliteDefenderSpeedMod = 0.25;
            } else {
                let maxDist = 0;
                for (let e of engine.enemies) {
                    if (e.alive && e.distanceTraveled > maxDist) maxDist = e.distanceTraveled;
                }
                let totalLen = engine.map.getTotalLength();
                let progress = Math.min(1, maxDist / totalLen);
                tower.eliteDefenderSpeedMod = 1 - progress * 0.5;
            }
        } else {
            tower.eliteDefenderSpeedMod = 1;
        }

        if (tower.bananas && tower.bananas.length > 0) {
            for (let i = tower.bananas.length - 1; i >= 0; i--) {
                let b = tower.bananas[i];
                if (b.progress < 1) {
                    b.progress += dt / 0.8;
                    if (b.progress >= 1) {
                        b.progress = 1;
                        b.x = b.targetX;
                        b.y = b.targetY;
                        b.arc = 0;
                    } else {
                        b.x = b.targetX;
                        b.y = b.startY + (b.targetY - b.startY) * b.progress;
                        b.arc = Math.sin(b.progress * Math.PI) * 20;
                    }
                }
            }
        }
    },
    updateSupport(tower, dt) {
        if (tower.stats.globalSniperBuff) {
            for (let t of GameEngine.towers) {
                if (t && t.type === 'sniper' && t !== tower) {
                    t.buffedFireRate = Math.max(t.buffedFireRate, 0.33);
                }
            }
        }
    },
    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        let actualDmg = damage;
        if (tower.stats.eliteDefender && target.data.isMoab) actualDmg *= 2;
        if (tower.stats.bonusCeramic && target.data.isCeramic) actualDmg += tower.stats.bonusCeramic;
        if (tower.stats.bonusCamo && target.isCamo) actualDmg += tower.stats.bonusCamo;
        if (tower.stats.crippleDebuff) {
            target.crippled = true;
            target.crippleTimer = 4.0;
        }
        let stunDur = 0;
        if (target.data.isMoab) {
            if (target.tier === 13) stunDur = tower.stats.stunMoab || 0;
            else if (target.tier === 14) stunDur = tower.stats.stunBfb || 0;
            else if (target.tier === 15) stunDur = tower.stats.stunZomg || 0;
            else if (target.tier === 16) stunDur = tower.stats.stunDdt || 0;
        }
        let dmgDealt = target.takeDamage(actualDmg, dmgType, { stun: stunDur });
        if (dmgDealt > 0) tower.damageDealt += dmgDealt;
        tower.hitscans.push({ x1: tower.x, y1: tower.y, x2: target.x, y2: target.y, life: 0.1 });
        let bounces = tower.stats.bounces || 0;
        let hitSet = new Set([target]);
        let currentTarget = target;
        for (let i = 0; i <= bounces; i++) {
            if (tower.stats.shrapnel) {
                this._fireShrapnel(tower, currentTarget, dmgType, engine);
            }
            if (i >= bounces) break;
            const nearby = engine.enemyGrid.query(currentTarget.x, currentTarget.y, 40, _sniperBounceScratch);
            let nextTarget = null;
            let bestDistSq = Infinity;
            for (let e of nearby) {
                if (!e.alive || hitSet.has(e)) continue;
                let distSq = Utils.distanceSq(currentTarget.x, currentTarget.y, e.x, e.y);
                if (distSq < bestDistSq) { bestDistSq = distSq; nextTarget = e; }
            }
            if (nextTarget) {
                tower.hitscans.push({ x1: currentTarget.x, y1: currentTarget.y, x2: nextTarget.x, y2: nextTarget.y, life: 0.1 });
                hitSet.add(nextTarget);
                currentTarget = nextTarget;
                let bounceDmg = actualDmg;
                if (tower.stats.eliteDefender && currentTarget.data.isMoab) bounceDmg *= 2;
                if (tower.stats.bonusCeramic && currentTarget.data.isCeramic) bounceDmg += tower.stats.bonusCeramic;
                if (tower.stats.bonusCamo && currentTarget.isCamo) bounceDmg += tower.stats.bonusCamo;
                if (tower.stats.crippleDebuff) {
                    currentTarget.crippled = true;
                    currentTarget.crippleTimer = 4.0;
                }
                let bounceStun = 0;
                if (currentTarget.data.isMoab) {
                    if (currentTarget.tier === 13) bounceStun = tower.stats.stunMoab || 0;
                    else if (currentTarget.tier === 14) bounceStun = tower.stats.stunBfb || 0;
                    else if (currentTarget.tier === 15) bounceStun = tower.stats.stunZomg || 0;
                    else if (currentTarget.tier === 16) bounceStun = tower.stats.stunDdt || 0;
                }
                let bounceDmgDealt = currentTarget.takeDamage(bounceDmg, dmgType, { stun: bounceStun });
                if (bounceDmgDealt > 0) tower.damageDealt += bounceDmgDealt;
            } else {
                break;
            }
        }
    },
    _fireShrapnel(tower, originTarget, dmgType, engine) {
        let count = 5;
        let baseAngle = Math.atan2(originTarget.y - tower.y, originTarget.x - tower.x);
        let spread = Math.PI / 4;
        let startAngle = baseAngle - spread / 2;
        let shrapDmg = 1;
        if (tower.upgrades[0] >= 1) shrapDmg = 2;
        if (tower.upgrades[0] >= 2) shrapDmg = 3;
        if (tower.upgrades[0] >= 3) shrapDmg = 4;
        if (tower.upgrades[0] >= 4) shrapDmg = 6;
        if (tower.upgrades[0] >= 5) shrapDmg = 12;
        if (tower.stats.shrapnelDmg) shrapDmg += tower.stats.shrapnelDmg;
        let shrapPierce = tower.upgrades[0] >= 5 ? 3 : (tower.stats.shrapnelPierce || 3);
        let shrapDmgType = { isSharp: true, canHitLead: dmgType.canHitLead };
        let shrapEffects = {};
        if (tower.stats.stunMoab) {
            shrapEffects.stun = tower.stats.stunMoab;
        }
        for (let i = 0; i < count; i++) {
            let a = startAngle + (i / (count - 1)) * spread;
            let p = engine.projectilePool.get();
            p.init(originTarget.x, originTarget.y, shrapDmg, null, 'nail', 600, shrapPierce, 0.5, a, shrapEffects, 0, tower, shrapDmgType);
        }
    },
    ability(tower, engine) {
        if (tower.abilityUsesThisRound >= 3) {
            engine.log("Max Supply Drops reached this round!");
            return;
        }
        let cash = tower.stats.supplyCash || 1100;
        
        tower.bananas = tower.bananas || [];
        let targetX = 640 + (Math.random() - 0.5) * 400;
        let targetY = 360 + (Math.random() - 0.5) * 200;
        tower.bananas.push({
            startX: targetX, startY: -50, 
            targetX: targetX, targetY: targetY,
            x: targetX, y: -50, arc: 0, progress: 0,
            life: 15, maxLife: 15,
            value: cash,
            isCrate: true
        });
        
        tower.abilityUsesThisRound = (tower.abilityUsesThisRound || 0) + 1;
        engine.log("Supply Drop Incoming!");
    },
    draw(ctx, tower, isPreview) {
        tower.drawBaseTower(ctx, isPreview);
        
        if (tower.bananas) {
            const crateAsset = Assets.get('effect_banana_crate');
            for (let b of tower.bananas) {
                let alpha = Math.min(1, b.life / 2);
                ctx.globalAlpha = alpha;
                if (crateAsset && crateAsset.loaded) {
                    let size = 60 * GS;
                    ctx.drawImage(crateAsset, b.x - size/2, b.y - size/2 + (b.arc || 0), size, size);
                } else {
                    ctx.fillStyle = '#8B4513';
                    ctx.fillRect(b.x - 20, b.y - 20, 40, 40);
                }
            }
            ctx.globalAlpha = 1;
        }
    }
};
