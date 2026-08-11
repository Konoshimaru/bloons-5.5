// js/towers/ace.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GLOBAL_SCALE } from '../constants.js';
import Assets from '../assets.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

export default {
    stats: { 
        name: "Monkey Ace", 
        cost: 800, 
        range: 22, 
        fireRate: 1.68, 
        damage: 1, 
        pierce: 5, 
        projectileSpeed: 300 * GS, 
        lifespan: 1.4, 
        desc: "Flies above the ground shooting volleys of high-pierce darts.", 
        dmgType: 'sharp', 
        projectileType: 'dart', 
        hitRadius: 18, 
        projectileCount: 8, 
        category: 'Military',
        fireWithoutTarget: true 
    },
    upgrades: {
        1: [
            {name:"Rapid Fire", cost:450, desc:"Shoots faster than normal.", extraMods:{cooldownMult: 0.75}},
            {name:"Lots More Darts", cost:550, stat:"projectileCount", amount:4, desc:"Shoots 12 darts at a time."},
            {name:"Fighter Plane", cost:1000, stat:"moabDmg", amount:5, desc:"Flies fast and launches anti-MOAB missiles.", extraMods:{missileCd: 3.0, missileDmg: 18, aceSpeedMult: 1.25}},
            {name:"Operation: Dart Storm", cost:3300, stat:"projectileCount", amount:4, desc:"Shoots 16 darts per volley, and twice as fast.", extraMods:{cooldownMult: 0.5, missileCd: -1.5, missileDmg: 6}},
            {name:"Sky Shredder", cost:42500, stat:"projectileCount", amount:16, desc:"The Bloons will wish they had never come.", extraMods:{pierce: 3, damage: 2, cooldownMult: 0.5, missileDmg: 126, projectileSpeed: 150 * GS, dmgType: 'normal', ceramicDmg: 2}}
        ],
        2: [
            {name:"Exploding Pineapple", cost:200, desc:"Drops pineapples to the ground that explode violently after a few seconds.", extraMods:{pineappleCd: 1.6, pineappleDmg: 1, pineapplePierce: 20, explosionRadius: 35}},
            {name:"Spy Plane", cost:350, stat:"canSeeCamo", amount:true, desc:"Allows Monkey Ace to hit Camo Bloons and do more damage to them.", extraMods:{camoDmg: 1}},
            {name:"Bomber Ace", cost:900, desc:"Drops a line of bombs when crossing the Bloon track.", extraMods:{bomberCd: 1.6, bomberDmg: 3, bomberPierce: 20, camoDmg: 2}},
            {name:"Ground Zero", cost:16000, desc:"Bomb damage increased. Ground Zero Ability: Drops a huge bomb.", extraMods:{isAbility: true, abilityName: "Ground Zero", abilityCd: 35, pineappleDmg: 14, bomberDmg: 12, bomberPierce: 20, camoDmg: 12}},
            {name:"Tsar Bomba", cost:26000, desc:"A very, very large bomb. Someone put a stop to this craziness!", extraMods:{pineappleDmg: 5, bomberDmg: 5, ceramicDmg: 10, camoDmg: 5}}
        ],
        3: [
            {name:"Sharper Darts", cost:500, stat:"pierce", amount:3, desc:"Darts can pop 8 Bloons each."},
            {name:"Centered Path", cost:550, desc:"Unlocks Centered Path flight mode in targeting options.", extraMods:{}},
            {name:"Neva-Miss Targeting", cost:2550, desc:"Darts automatically seek out and pop Bloons by themselves.", extraMods:{homing: true, projectileSpeed: -120 * GS, lifespan: 1.93}},
            {name:"Spectre", cost:23400, desc:"Rapidly fires darts and bombs, dominating most Bloon types easily.", extraMods:{isSpectre: true, machineGunCd: 0.06, damage: 2}},
            {name:"Flying Fortress", cost:90000, desc:"This is a BIG plane.", extraMods:{isFortress: true, machineGunCd: -0.02, damage: 3, dmgType: 'normal'}}
        ]
    },

    update(tower, dt, engine) {
        if (tower.aceAngle === undefined) {
            tower.aceAngle = 0;
            tower.baseX = tower.x;
            tower.baseY = tower.y;
            tower.planeX = tower.x;
            tower.planeY = tower.y;
            tower.planeAngle = 0;
        }
        
        let aceRadius = (tower.stats.aceRadius || 80) * GS;
        let aceSpeed = 0.75 * (tower.stats.aceSpeedMult || 1.0); 
        tower.aceAngle += aceSpeed * dt;
        
        let prevX = tower.planeX;
        let prevY = tower.planeY;
        
        if (!tower.targetingMode || !['Circle', 'Figure Infinite', 'Figure Eight', 'Centered Path'].includes(tower.targetingMode)) {
            tower.targetingMode = 'Circle';
        }

        let t = tower.aceAngle;
        if (tower.targetingMode === 'Circle') {
            tower.planeX = tower.baseX + Math.cos(t) * aceRadius;
            tower.planeY = tower.baseY + Math.sin(t) * aceRadius;
        } else if (tower.targetingMode === 'Figure Infinite') {
            tower.planeX = tower.baseX + (Math.sin(t) * Math.cos(t)) * (aceRadius * 2);
            tower.planeY = tower.baseY + Math.sin(t) * aceRadius;
        } else if (tower.targetingMode === 'Figure Eight') {
            tower.planeX = tower.baseX + Math.sin(t) * aceRadius;
            tower.planeY = tower.baseY + (Math.sin(t) * Math.cos(t)) * (aceRadius * 2);
        } else if (tower.targetingMode === 'Centered Path') {
            tower.planeX = (CANVAS_WIDTH / 2) + Math.cos(t) * (200 * GS);
            tower.planeY = (CANVAS_HEIGHT / 2) + Math.sin(t) * (200 * GS);
        }
        
        tower.planeX = Math.max(10, Math.min(CANVAS_WIDTH - 10, tower.planeX));
        tower.planeY = Math.max(10, Math.min(CANVAS_HEIGHT - 10, tower.planeY));
        
        let dx = tower.planeX - prevX;
        let dy = tower.planeY - prevY;
        if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
            // This aligns the nose perfectly with the movement direction.
            tower.planeAngle = Math.atan2(dy, dx); 
        }

        let bombDmg = tower.stats.pineappleDmg || 0;
        let bombPierce = tower.stats.pineapplePierce || 1;
        let bombRadius = tower.stats.explosionRadius || 35;
        let bombCamoDmg = tower.stats.camoDmg || 0;
        let bombCeramicDmg = tower.stats.ceramicDmg || 0;

        if (tower.stats.pineappleCd) {
            tower.pineappleTimer = (tower.pineappleTimer || 0) - dt;
            if (tower.pineappleTimer <= 0) {
                tower.pineappleTimer = tower.stats.pineappleCd;
                let trackPt = engine.map.getNearestPathPoint(tower.planeX, tower.planeY);
                if (trackPt) {
                    let p = engine.projectilePool.get();
                    p.init(trackPt.x, trackPt.y, bombDmg, null, 'bomb', 0, bombPierce, 5.0, null, {isExplosive: true, explosionRadius: bombRadius * GS, explosionDamage: bombDmg, canHitLead: true, camoDmg: bombCamoDmg, ceramicDmg: bombCeramicDmg}, 0, tower, {isExplosion: true, canHitLead: true});
                }
            }
        }

        if (tower.stats.bomberCd) {
            tower.bomberTimer = (tower.bomberTimer || 0) - dt;
            if (tower.bomberTimer <= 0) {
                tower.bomberTimer = tower.stats.bomberCd;
                let trackPt = engine.map.getNearestPathPoint(tower.planeX, tower.planeY);
                if (trackPt) {
                    for (let i = -1; i <= 1; i++) {
                        let p = engine.projectilePool.get();
                        let offX = i * 30 * GS;
                        p.init(trackPt.x + offX, trackPt.y, bombDmg, null, 'bomb', 0, bombPierce, 0.1, null, {isExplosive: true, explosionRadius: bombRadius * GS, explosionDamage: bombDmg, canHitLead: true, camoDmg: bombCamoDmg, ceramicDmg: bombCeramicDmg}, 0, tower, {isExplosion: true, canHitLead: true});
                    }
                }
            }
        }

        if (tower.stats.missileCd) {
            tower.missileTimer = (tower.missileTimer || 0) - dt;
            if (tower.missileTimer <= 0) {
                tower.missileTimer = tower.stats.missileCd;
                let target = null, bestVal = -Infinity;
                for (const e of engine.enemies) {
                    if (!e || !e.alive || !e.data.isMoab) continue;
                    if (e.data.rbe > bestVal) { bestVal = e.data.rbe; target = e; }
                }
                if (target) {
                    let p = engine.projectilePool.get();
                    p.init(tower.planeX, tower.planeY, tower.stats.missileDmg, target, 'bomb', 600 * GS, 5, 2.0, null, {isExplosive: true, explosionRadius: 30 * GS, explosionDamage: tower.stats.missileDmg, canHitLead: true, ceramicDmg: tower.stats.ceramicDmg || 0}, 0, tower, {isExplosion: true, canHitLead: true, moabDmg: tower.stats.moabDmg || 0});
                }
            }
        }

        if (tower.stats.machineGunCd) {
            tower.machineGunTimer = (tower.machineGunTimer || 0) - dt;
            if (tower.machineGunTimer <= 0) {
                tower.machineGunTimer = tower.stats.machineGunCd;
                let t1 = this._findTargetForGun(tower, engine, 'first');
                if (t1) this._fireMachineGun(tower, t1, engine);
                
                if (tower.stats.isFortress) {
                    let t2 = this._findTargetForGun(tower, engine, 'close');
                    if (t2) this._fireMachineGun(tower, t2, engine);
                    let t3 = this._findTargetForGun(tower, engine, 'last');
                    if (t3) this._fireMachineGun(tower, t3, engine);
                }
            }
        }
    },

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        let pEffects = { ...effects };
        if (tower.stats.camoDmg) pEffects.camoDmg = tower.stats.camoDmg;
        if (tower.stats.ceramicDmg) pEffects.ceramicDmg = tower.stats.ceramicDmg;

        let count = tower.stats.projectileCount || 8;
        let spread = 360 / count;
        
        let dartTarget = null;
        if (tower.stats.homing) {
            pEffects.homing = true;
            dartTarget = this._findTargetForGun(tower, engine, 'first');
        }
        
        for (let i = 0; i < count; i++) {
            let angle = (i * spread) * (Math.PI / 180); 
            let p = engine.projectilePool.get();
            p.init(tower.planeX, tower.planeY, damage, dartTarget, 'dart', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, angle, pEffects, 0, tower, dmgType, isCrit);
        }
    },

    _findTargetForGun(tower, engine, mode) {
        let bestTarget = null;
        let bestVal = (mode === 'close') ? Infinity : -Infinity;
        for (const e of engine.enemies) {
            if (!e || !e.alive || (e.isCamo && !tower.stats.canSeeCamo)) continue;
            const dist = Utils.distanceSq(tower.planeX, tower.planeY, e.x, e.y);
            if (mode === 'close') {
                if (dist < bestVal) { bestVal = dist; bestTarget = e; }
            } else { 
                if (e.distanceTraveled > bestVal) { bestVal = e.distanceTraveled; bestTarget = e; }
            }
        }
        return bestTarget;
    },

    _fireMachineGun(tower, target, engine) {
        if (!target) return;
        
        let dartDmg = 6;
        let dartPierce = 4;
        let bombDmg = tower.stats.isFortress ? 5 : 3;
        let bombPierce = tower.stats.isFortress ? 30 : 20;
        let bombCeramicDmg = 4;
        let moabDmg = tower.stats.isFortress ? 14 : 0;
        
        let pDart = engine.projectilePool.get();
        let dartEffects = { moabDmg: moabDmg };
        pDart.init(tower.planeX, tower.planeY, dartDmg, target, 'dart', 400 * GS, dartPierce, 1.125, null, dartEffects, 0, tower, tower.stats.dmgType, false);
        
        let pBomb = engine.projectilePool.get();
        let bombEffects = { isExplosive: true, explosionRadius: 20 * GS, explosionDamage: bombDmg, canHitLead: true, ceramicDmg: bombCeramicDmg };
        pBomb.init(tower.planeX, tower.planeY, bombDmg, target, 'bomb', 300 * GS, 1, 2.0, null, bombEffects, 0, tower, {isExplosion: true, canHitLead: true});
    },

    draw(ctx, tower, isPreview) {
        if (!isPreview) {
            ctx.save();
            ctx.translate(tower.x, tower.y);
            ctx.fillStyle = 'rgba(50, 50, 50, 0.5)';
            ctx.fillRect(-22 * GS, -22 * GS, 44 * GS, 44 * GS);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.strokeRect(-22 * GS, -22 * GS, 44 * GS, 44 * GS);
            ctx.restore();
        }

        if (!isPreview && tower.planeX !== undefined) {
            const origX = tower.x;
            const origY = tower.y;
            const origAngle = tower.angle;
            
            tower.x = tower.planeX;
            tower.y = tower.planeY;
            tower.angle = tower.planeAngle; 
            
            tower.drawBaseTower(ctx, isPreview);
            
            tower.x = origX;
            tower.y = origY;
            tower.angle = origAngle;
        } else {
            tower.drawBaseTower(ctx, isPreview);
        }
    },

    ability(tower, engine) {
        if (tower.stats.abilityName === "Ground Zero") {
            engine.log("Ground Zero!");
            let isTsar = tower.upgrades[1] >= 5;
            let dmg = isTsar ? 3000 : 700; 
            let pierce = isTsar ? 5000 : 2000;
            let stunDur = isTsar ? 8 : 0;
            
            let effects = {isExplosion: true, canHitLead: true, stun: stunDur};
            
            Utils.applyAoeDamage(engine, tower.planeX, tower.planeY, 1500 * GS, dmg, effects, tower, {}, {maxHits: pierce});
            engine.explosions.push({ x: tower.planeX, y: tower.planeY, radius: 0, maxRadius: 1500 * GS, life: 1.5, maxLife: 1.5, color: '#ffffff' });
        }
    }
};
