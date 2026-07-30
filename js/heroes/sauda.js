// js/heroes/sauda.js
import { GameEngine } from '../engine.js';
import { Utils, drawImageCentered } from '../utils.js';
import Assets from '../assets.js';
import { Config, RANGE_SCALE } from '../config.js';
import { GLOBAL_SCALE } from '../constants.js';
import { AudioEngine } from '../audio.js'; // FIX 3: Import AudioEngine
import { MobileManager } from '../mobile.js'; // FIX: Import MobileManager

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

// --- SLASH CUSTOMIZATION ---
export const SlashConfig = {
    lifespan: 0.4,           // How long the slash lasts in seconds
    sizeScale: 0.35,         // Size of the slash
    speed: 400,              // How fast it moves away from Sauda
    drawAngleOffset: 0       // Angle offset for the sprite (0 = faces right, Math.PI/2 = faces down)
};

// --- SFX HELPER ---
let lastSaudaAttackSfx = 0;

export default {
    stats: {
        name: "Sauda", cost: 600, range: 23, fireRate: 0.4, damage: 1, pierce: 3,
        lifespan: 0.1, desc: "Carves up Bloons with dual swords in a 180-degree cone. Has built-in camo detection.",
        dmgType: 'sharp', isHero: true, maxLevel: 20, scale: 1.3,
        canSeeCamo: true,
        ceramicDmg: 1, moabDmg: 1
    },
    xpTable: [257, 656, 1425, 2651, 4674, 7382, 11856, 13367, 19409, 23342, 20520, 23726, 21290, 23342, 25394, 27446, 29498, 23470, 24624],
    levels: {
        1: [],
        2: [{ stat: "pierce", amount: 1 }],
        3: [
            { stat: "isAbility", amount: true }, 
            { stat: "leapDmg", amount: 20 }, { stat: "leapMoabDmg", amount: 80 }, { stat: "leapPierce", amount: 20 }, 
            { stat: "afterswordDmg", amount: 2 }
        ],
        4: [{ stat: "damage", amount: 1 }, { stat: "ceramicDmg", amount: 1 }, { stat: "moabDmg", amount: 1 }],
        5: [{ stat: "fireRate", amount: -0.08 }],
        6: [{ stat: "pierce", amount: 2 }, { stat: "range", amount: 3 }],
        7: [
            { stat: "canHitFrozen", amount: true }, { stat: "bonusDmgStunned", amount: 2 }, { stat: "moabBonusDmgStunned", amount: 20 }
        ],
        8: [{ stat: "fireRate", amount: -0.07 }],
        9: [{ stat: "damage", amount: 1 }, { stat: "ceramicDmg", amount: 1 }, { stat: "moabDmg", amount: 1 }, { stat: "applyBleed", amount: true }],
        10: [
            { stat: "isAbility2", amount: true }, { stat: "chargeDmg", amount: 30 }, { stat: "chargePierce", amount: 400 }, 
            { stat: "chargeRepeats", amount: 1 }, { stat: "chargeRadius", amount: 19.5 }
        ],
        11: [
            { stat: "bonusDmgHarmed", amount: 2 }, { stat: "moabBonusDmgHarmed", amount: 10 }
        ],
        12: [
            { stat: "leapDmg", amount: 20 }, { stat: "leapMoabDmg", amount: 100 }, { stat: "leapPierce", amount: 20 }, 
            { stat: "afterswordDmg", amount: 1 }
        ],
        13: [{ stat: "canHitLead", amount: true }, { stat: "bonusDmgStunned", amount: 1 }, { stat: "moabBonusDmgStunned", amount: 1 }],
        14: [{ stat: "fireRate", amount: -0.09 }],
        15: [
            { stat: "range", amount: 3 }, { stat: "pierce", amount: 2 }, { stat: "leapDmg", amount: 40 }, { stat: "leapMoabDmg", amount: 40 }, 
            { stat: "afterswordDmg", amount: 1 }
        ],
        16: [
            { stat: "chargeDmg", amount: 90 }, { stat: "chargeRadius", amount: 3 } 
        ],
        17: [
            { stat: "damage", amount: 1 }, { stat: "ceramicDmg", amount: 1 }, { stat: "moabDmg", amount: 1 }, 
            { stat: "bonusDmgStunned", amount: 1 }, { stat: "moabBonusDmgStunned", amount: 1 }, 
            { stat: "bonusDmgHarmed", amount: 1 }, { stat: "moabBonusDmgHarmed", amount: 1 }
        ],
        18: [{ stat: "fireRate", amount: -0.06 }],
        19: [{ stat: "bonusDmgCRF", amount: 2 }, { stat: "moabBonusDmgCRF", amount: 10 }],
        20: [
            { stat: "leapDmg", amount: 320 }, { stat: "leapMoabDmg", amount: 140 }, { stat: "leapPierce", amount: 20 }, 
            { stat: "afterswordDmg", amount: 2 }, 
            { stat: "chargeDmg", amount: 100 }, { stat: "chargePierce", amount: 1000 }, { stat: "chargeRepeats", amount: 2 } 
        ]
    },
    update(tower, dt) {
        if (tower.leapLockout > 0) tower.leapLockout -= dt;

        if (tower.slashes) {
            for (let i = tower.slashes.length - 1; i >= 0; i--) {
                let s = tower.slashes[i];
                s.life -= dt; 
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                if (s.life <= 0) tower.slashes.splice(i, 1);
            }
        }

        if (tower.chargeShadows && tower.chargeShadows.length > 0) {
            let allDone = true;
            let chargeRadius = tower.stats.chargeRadius || 19.5;
            let baseDmg = tower.stats.chargeDmg || 30;
            let pierce = tower.stats.chargePierce || 400;
            let level = tower.level;

            for (let shadow of tower.chargeShadows) {
                if (shadow.done) continue;
                
                let totalLen = GameEngine.map.paths[shadow.pathIndex].totalLength;
                shadow.distance -= shadow.speed * dt;
                
                if (shadow.distance < -100) {
                    if (shadow.sweepsLeft > 0) {
                        shadow.sweepsLeft--;
                        shadow.distance = totalLen; 
                        shadow.hitSet.clear(); 
                        allDone = false;
                    } else {
                        shadow.done = true;
                    }
                } else {
                    allDone = false;
                    const pos = GameEngine.map.getPositionAtDistance(shadow.distance, shadow.pathIndex);
                    const nextPos = GameEngine.map.getPositionAtDistance(Math.max(0, shadow.distance - 5), shadow.pathIndex);
                    shadow.x = pos.x; 
                    shadow.y = pos.y;
                    shadow.angle = Utils.angle(pos.x, pos.y, nextPos.x, nextPos.y);
                    
                    const nearby = GameEngine.enemyGrid.query(pos.x, pos.y, chargeRadius);
                    for (let e of nearby) {
                        if (!e.alive || e.pathIndex !== shadow.pathIndex) continue;
                        if (shadow.hitSet.has(e)) continue;
                        if (shadow.hitSet.size >= pierce) break;
                        
                        if (Utils.withinRange(pos.x, pos.y, e.x, e.y, chargeRadius)) {
                            let stunned = e.slowFactor <= 0.01;
                            let harmed = (e.slowFactor > 0.01 && e.slowFactor < 1.0) || (e.dotTimer > 0 && e.saudaBleed !== true);
                            
                            let dmg = baseDmg;
                            if (level >= 10 && stunned) {
                                dmg += Math.floor(baseDmg / 2);
                                if (e.data.isMoab) dmg += baseDmg;
                            }
                            if (level >= 11 && harmed) {
                                dmg += Math.floor(baseDmg / 2);
                                if (e.data.isMoab) dmg += baseDmg;
                            }
                            
                            e.takeDamage(dmg, { isSharp: true, canHitLead: true, canHitFrozen: true });
                            shadow.hitSet.add(e);
                        }
                    }
                }
            }
            
            if (allDone) {
                tower.chargeShadows = [];
                tower.chargeLockout = 0; 
            }
        }

        if (tower.aftersword) {
            tower.aftersword.life -= dt;
            if (tower.aftersword.life <= 0) {
                tower.aftersword = null;
            } else {
                tower.aftersword.tick -= dt;
                if (tower.aftersword.tick <= 0) {
                    tower.aftersword.tick = 0.1;
                    const nearby = GameEngine.enemyGrid.query(tower.aftersword.x, tower.aftersword.y, 15);
                    let hits = 0;
                    for (let e of nearby) {
                        if (!e.alive || hits >= 5) continue;
                        if (Utils.withinRange(tower.aftersword.x, tower.aftersword.y, e.x, e.y, 15)) {
                            if (tower.aftersword.hitTimers.has(e) && tower.aftersword.hitTimers.get(e) > 0) continue;
                            
                            let stunned = e.slowFactor <= 0.01;
                            let harmed = (e.slowFactor > 0.01 && e.slowFactor < 1.0) || (e.dotTimer > 0 && e.saudaBleed !== true);
                            
                            let baseDmg = tower.stats.afterswordDmg || 2;
                            let dmg = baseDmg;
                            let level = tower.level;
                            
                            if (level >= 7 && stunned) {
                                dmg += baseDmg; 
                                if (e.data.isMoab) dmg += (10 + 5 * baseDmg);
                            }
                            if (level >= 11 && harmed) {
                                dmg += baseDmg; 
                                if (e.data.isMoab) dmg += (10 + 5 * baseDmg);
                            }
                            
                            e.takeDamage(dmg, { isSharp: true, canHitLead: true, canHitFrozen: true });
                            tower.aftersword.hitTimers.set(e, 0.2);
                            hits++;
                        }
                    }
                    for (let [e, t] of tower.aftersword.hitTimers.entries()) {
                        if (t <= 0 || !e.alive) tower.aftersword.hitTimers.delete(e);
                        else tower.aftersword.hitTimers.set(e, t - 0.1);
                    }
                }
            }
        }
    },
    draw(ctx, tower, isPreview) {
        const mobileScale = MobileManager.isActive ? MobileManager.spriteScale : 1.0;

        if (!isPreview && tower.aftersword) {
            ctx.globalAlpha = Math.min(1, tower.aftersword.life / 2) * 0.7;
            const grad = ctx.createRadialGradient(tower.aftersword.x, tower.aftersword.y, 0, tower.aftersword.x, tower.aftersword.y, 15 * mobileScale);
            grad.addColorStop(0, '#e74c3c');
            grad.addColorStop(1, 'rgba(231, 76, 60, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(tower.aftersword.x, tower.aftersword.y, 15 * mobileScale, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }

        if (!isPreview && tower.chargeShadows && tower.chargeShadows.length > 0) {
            for (let shadow of tower.chargeShadows) {
                if (shadow.done) continue;
                const asset = Assets.get('tower_sauda_base');
                ctx.save();
                ctx.globalAlpha = 0.8; 
                ctx.translate(shadow.x, shadow.y);
                ctx.rotate(shadow.angle + Math.PI / 2); 
                
                let targetSize = 45 * (tower.stats.scale || 1.0) * GS * mobileScale; // FIX: Scale shadow
                
                if (asset && asset.loaded) {
                    drawImageCentered(ctx, asset, targetSize);
                } else {
                    ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.arc(0, 0, 15 * GS * mobileScale, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(0, 0, 10 * GS * mobileScale, 0, Math.PI * 2); ctx.fill();
                }
                ctx.restore();
            }
            ctx.globalAlpha = 1;
        }

        if (!isPreview && tower.slashes) {
            for (let s of tower.slashes) {
                let asset = Assets.get('proj_slash');
                if (asset && asset.loaded) {
                    let alpha = s.life / s.maxLife;
                    let w = asset.width * SlashConfig.sizeScale * mobileScale; // FIX: Scale slash
                    let h = asset.height * SlashConfig.sizeScale * mobileScale;
                    
                    ctx.save();
                    ctx.globalAlpha = alpha;
                    ctx.translate(s.x, s.y);
                    ctx.rotate(s.angle + SlashConfig.drawAngleOffset);
                    ctx.drawImage(asset, -w/2, -h/2, w, h);
                    ctx.restore();
                }
            }
            ctx.globalAlpha = 1;
        }

        if (!tower.chargeLockout || tower.chargeLockout <= 0) {
            const { baseAsset, targetSize } = tower.getActiveAssets();
            if (baseAsset && baseAsset.loaded) {
                ctx.save();
                ctx.translate(tower.x, tower.y);
                if (!isPreview && !tower.stats.isStaticRotation) ctx.rotate(tower.angle + Math.PI / 2);
                drawImageCentered(ctx, baseAsset, targetSize * mobileScale); // FIX: Scale main body
                ctx.restore();
            } else {
                ctx.save();
                ctx.translate(tower.x, tower.y);
                const s = (tower.stats.scale || 1.0) * GS * mobileScale; // FIX: Scale fallback
                ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.arc(0, 0, 15 * s, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(0, 0, 10 * s, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
        }
    },
    ability(tower, engine) {
        if (tower.chargeLockout > 0) return; 
        
        tower.leapLockout = 0.5;
        AudioEngine.playSfx('sauda_leap_activate'); // FIX 3: Routed through AudioEngine

        let target = null;
        let bestVal = (tower.targetingMode === 'First' || tower.targetingMode === 'Strong') ? -Infinity : Infinity;
        
        for (let e of engine.enemies) {
            if (!e.alive) continue;
            let val = (tower.targetingMode === 'First' || tower.targetingMode === 'Last') ? e.distanceTraveled : (tower.targetingMode === 'Strong' ? e.data.rbe : Utils.distance(tower.x, tower.y, e.x, e.y));
            if (tower.targetingMode === 'First' || tower.targetingMode === 'Strong') {
                if (val > bestVal) { bestVal = val; target = e; }
            } else {
                if (val < bestVal) { bestVal = val; target = e; }
            }
        }

        if (target) {
            const leapNearby = engine.enemyGrid.query(target.x, target.y, 15);
            let hits = 0;
            let maxHits = tower.stats.leapPierce || 20;
            let level = tower.level;
            
            for (let e of leapNearby) {
                if (!e.alive || hits >= maxHits) continue;
                if (Utils.withinRange(target.x, target.y, e.x, e.y, 15)) {
                    let stunned = e.slowFactor <= 0.01;
                    let harmed = (e.slowFactor > 0.01 && e.slowFactor < 1.0) || (e.dotTimer > 0 && e.saudaBleed !== true);
                    
                    let baseDmg = e.data.isMoab ? (tower.stats.leapMoabDmg || 80) : (tower.stats.leapDmg || 20);
                    let dmg = baseDmg;
                    
                    if (level >= 7 && stunned) {
                        dmg += Math.floor(baseDmg / 2);
                        if (e.data.isMoab) dmg += baseDmg;
                    }
                    if (level >= 11 && harmed) {
                        dmg += Math.floor(baseDmg / 2);
                        if (e.data.isMoab) dmg += baseDmg;
                    }
                    
                    e.takeDamage(dmg, { isSharp: true, canHitLead: true, canHitFrozen: true });
                    hits++;
                }
            }
            
            tower.aftersword = {
                x: target.x, y: target.y,
                life: 5 + 0.5 * level,
                tick: 0,
                hitTimers: new Map()
            };
            
            setTimeout(() => AudioEngine.playSfx('sauda_leap_landing'), 500); // FIX 3: Routed through AudioEngine
            
            engine.log("Sauda: Leaping Sword!");
        }
    },
    ability2(tower, engine) {
        if (tower.leapLockout > 0) return; 
        
        let sweeps = tower.stats.chargeRepeats || 1;
        tower.chargeLockout = 10.0; 
        
        tower.chargeShadows = [];
        for (let p = 0; p < GameEngine.map.paths.length; p++) {
            let totalLen = GameEngine.map.paths[p].totalLength;
            tower.chargeShadows.push({
                pathIndex: p,
                distance: totalLen, 
                speed: 2500, 
                sweepsLeft: sweeps - 1,
                hitSet: new Set(),
                done: false,
                x: 0, y: 0,
                angle: 0
            });
        }
        
        AudioEngine.playSfx('sauda_charge'); // FIX 3: Routed through AudioEngine
        engine.log("Sauda: Sword Charge!");
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        if (tower.leapLockout > 0 || tower.chargeLockout > 0) return; 
        
        if (!target) return;
        
        const actualRange = Utils.getEffectiveRange(tower, GameEngine);
        const centerAngle = Utils.angle(tower.x, tower.y, target.x, target.y);
        const halfCone = Math.PI / 2; 
        
        const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, actualRange);
        let hits = 0;
        
        for (let e of nearby) {
            if (!e.alive || hits >= tower.stats.pierce) continue;
            if (e.isCamo && !tower.stats.canSeeCamo && !tower.buffedCamo) continue;
            
            if (!Utils.withinRange(tower.x, tower.y, e.x, e.y, actualRange)) continue;
            
            const angleToEnemy = Utils.angle(tower.x, tower.y, e.x, e.y);
            let angleDiff = Math.abs(angleToEnemy - centerAngle);
            if (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - Math.PI * 2);
            
            if (angleDiff <= halfCone) {
                let dmg = damage;
                let actualDmgType = { ...dmgType };
                
                if (tower.stats.ceramicDmg && e.data.isCeramic) dmg += tower.stats.ceramicDmg;
                if (tower.stats.moabDmg && e.data.isMoab) dmg += tower.stats.moabDmg;
                
                let stunned = e.slowFactor <= 0.01;
                let harmed = (e.slowFactor > 0.01 && e.slowFactor < 1.0) || (e.dotTimer > 0 && e.saudaBleed !== true);
                
                if (stunned) {
                    dmg += tower.stats.bonusDmgStunned || 0;
                    if (e.data.isMoab) dmg += tower.stats.moabBonusDmgStunned || 0;
                }
                if (harmed) {
                    dmg += tower.stats.bonusDmgHarmed || 0;
                    if (e.data.isMoab) dmg += tower.stats.moabBonusDmgHarmed || 0;
                }
                
                if (tower.stats.bonusDmgCRF && (e.isCamo || e.isRegen || e.isFortified)) {
                    if (e.data.isMoab) {
                        if (e.isCamo || e.isFortified) dmg += tower.stats.moabBonusDmgCRF || 0;
                    } else {
                        dmg += tower.stats.bonusDmgCRF || 0;
                    }
                }
                
                if (tower.stats.canHitFrozen) actualDmgType.canHitFrozen = true;
                if (tower.stats.canHitLead) actualDmgType.canHitLead = true;
                
                let fx = { ...effects };
                if (tower.stats.applyBleed) {
                    fx.dot = 1;
                    fx.dotTimer = 4.0;
                    fx.dotTick = 2.0;
                    if (e.data.isMoab) fx.moabDot = 20;
                    e.saudaBleed = true; 
                }
                
                let dmgDealt = e.takeDamage(dmg, actualDmgType, fx, tower);
                if (dmgDealt > 0) tower.damageDealt += dmgDealt;
                hits++;
                
                if (!tower.slashes) tower.slashes = [];
                
                let vx = Math.cos(angleToEnemy) * SlashConfig.speed;
                let vy = Math.sin(angleToEnemy) * SlashConfig.speed;
                
                tower.slashes.push({ 
                    x: tower.x, 
                    y: tower.y, 
                    vx: vx, 
                    vy: vy, 
                    angle: angleToEnemy,
                    life: SlashConfig.lifespan, 
                    maxLife: SlashConfig.lifespan 
                });
            }
        }
        
        if (hits > 0) {
            // FIX 3: Throttle attack SFX and route through AudioEngine
            const now = performance.now();
            if (now - lastSaudaAttackSfx > 100) {
                lastSaudaAttackSfx = now;
                AudioEngine.playSfx('sauda_attack');
            }
        }
        
        if (!tower.stats.isStaticRotation) {
            tower.angle = centerAngle;
        }
    }
};