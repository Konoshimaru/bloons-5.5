// js/towers/mermonkey.js
import { GameEngine } from '../engine.js';
import { Utils, drawImageCentered } from '../utils.js';
import { GLOBAL_SCALE } from '../constants.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

const _mermAuraScratch = [];
const _mermRiptideScratch = [];

export default {
    stats: { 
        name: "Mermonkey", cost: 750, range: 28, fireRate: 1.2, damage: 2, pierce: 2, 
        projectileSpeed: 600, lifespan: 1.0, desc: "Throws tridents that splash. Stronger in water.", 
        dmgType: 'shatter', projectileType: 'trident', hitRadius: 12, 
        canPlaceOnWater: true, category: 'Magic', 
        explosionRadius: 15, explosionDamage: 2, explosionPierce: 3
    },
    upgrades: {
        1: [
            {name:"Trident Efficiency", cost:150, desc:"Increases attack speed by 17.6%.", extraMods:{cooldownMult: 0.85}},
            {name:"Trident Swiftness", cost:250, desc:"Increases attack speed by 25%. Tridents travel faster.", extraMods:{cooldownMult: 0.8, projectileSpeed: 300, lifespan: -0.333}},
            {name:"Abyss Dweller", cost:1600, stat:"damage", amount:2, desc:"Unleashes an Abyssal Creature with 8 tentacles. Buffs nearby pierce.", extraMods:{explosionDamage: 2}},
            {name:"Abyssal Warrior", cost:4200, stat:"damage", amount:4, desc:"Ink slows bloons. Tentacles are much stronger. Buffs pierce more.", extraMods:{explosionDamage: 4, slow: 0.4, slowDuration: 10}},
            {name:"Lord of the Abyss", cost:23000, stat:"range", amount:4, desc:"Massive power. Allows water towers on land. Buffs pierce massively.", extraMods:{explosionDamage: 2, pierce: 7, cooldownMult: 0.5, lifespan: 0.667}}
        ],
        2: [
            {name:"Sharper Prongs", cost:200, stat:"pierce", amount:1, desc:"More pierce.", extraMods:{explosionPierce: 3}},
            {name:"Tidal Chill", cost:225, desc:"Splashes are larger and freeze bloons.", extraMods:{explosionRadius: 10, freeze: true, freezeDuration: 0.5}},
            {name:"Riptide Champion", cost:2000, desc:"Tridents grow in power and crash into wavelets. Can pop lead.", extraMods:{dmgType: 'frigid', canHitLead: true, lifespan: 1.5, projectileSpeed: -200, pierce: 23}},
            {name:"Arctic Knight", cost:8000, desc:"Tridents grow faster. Ice Jet ability fires bouncing ice balls.", extraMods:{isAbility: true, abilityName: "Ice Jet", abilityCd: 45, canHitLead: true}},
            {name:"Popseidon", cost:52000, stat:"range", amount:8, desc:"Ice Jet floods the map. Tridents fire 3 at once.", extraMods:{isAbility: true, abilityName: "Ice Jet 2", abilityCd: 45, canHitLead: true}}
        ],
        3: [
            {name:"Echosense Precision", cost:200, stat:"canSeeCamo", amount:true, desc:"Can detect Camo. Tridents seek their target.", extraMods:{homing: true}},
            {name:"Echosense Network", cost:280, stat:"range", amount:2, desc:"Increases range for all Echosense Mermonkeys. Stacks up to 10 times."},
            {name:"Alluring Melody", cost:2000, desc:"Hypnotic tune pulls bloons, strips camo, and detonates DoT.", extraMods:{explosionPierce: 6}},
            {name:"Symphonic Resonance", cost:7600, stat:"range", amount:4, desc:"Trance affects MOABs. Can echo from a point.", extraMods:{explosionPierce: 3, isAbility: true, abilityName: "Place Totem", abilityCd: 6}},
            {name:"The Final Harmonic", cost:25000, stat:"range", amount:6, desc:"Trance affects all bloons. Buffs heroes and magic.", extraMods:{explosionPierce: 9, isAbility: true, abilityName: "Place Totem", abilityCd: 6}}
        ]
    },
    
    update(tower, dt, engine) {
        // 1. Water Range Bonus & Echosense Network
        let baseRange = 28 + (tower.upgrades[0] >= 5 ? 4 : 0) + (tower.upgrades[1] >= 5 ? 8 : 0) + (tower.upgrades[2] >= 4 ? 4 : 0) + (tower.upgrades[2] >= 5 ? 6 : 0);
        let rangeMult = 1.0;
        
        if (tower.upgrades[2] >= 2) {
            let mermonkeyCount = 0;
            for (let t of engine.towers) {
                if (t && t.type === 'mermonkey' && t.upgrades[2] >= 2) mermonkeyCount++;
            }
            rangeMult *= 1 + (Math.min(10, mermonkeyCount) * 0.075);
        }
        
        if (engine.map.isInWater(tower.x, tower.y)) rangeMult *= 1.35;
        tower.stats.range = baseRange * rangeMult;

        // 2. Abyssal Creature (Path 1 T3+) - 8 Independent Tentacles
        if (tower.upgrades[0] >= 3) {
            if (!tower.tentacles) {
                tower.tentacles = [];
                for (let i=0; i<8; i++) {
                    tower.tentacles.push({ cooldown: Math.random() * 3.0 });
                }
            }
            
            let cd = 3.0;
            if (tower.upgrades[0] >= 4) cd = 2.5;
            if (tower.upgrades[0] >= 5) cd = 1.25;
            
            let dmg = 8;
            if (tower.upgrades[0] >= 4) dmg = 18;
            if (tower.upgrades[0] >= 5) dmg = 50;
            
            let pierce = 20;
            if (tower.upgrades[0] >= 4) pierce = 30;
            if (tower.upgrades[0] >= 5) pierce = 80;
            if (tower.upgrades[1] >= 1) pierce = Math.floor(pierce * 1.35);
            
            const effRange = Utils.getEffectiveRange(tower, engine);
            const effRangeSq = effRange * effRange;
            
            for (let i=0; i<8; i++) {
                let tent = tower.tentacles[i];
                tent.cooldown -= dt;
                
                if (tent.cooldown <= 0) {
                    let angle = (i / 8) * Math.PI * 2;
                    let target = null;
                    let bestVal = -Infinity; 
                    const nearby = engine.enemyGrid.query(tower.x, tower.y, effRange, _mermAuraScratch);
                    
                    for (const e of nearby) {
                        if (!e || !e.alive) continue;
                        if (e.isCamo && !tower.stats.canSeeCamo && !tower.buffedCamo) continue;
                        
                        const distSq = Utils.distanceSq(tower.x, tower.y, e.x, e.y);
                        if (distSq > effRangeSq) continue;
                        
                        let eAngle = Utils.angle(tower.x, tower.y, e.x, e.y);
                        let diff = Math.abs(eAngle - angle);
                        if (diff > Math.PI) diff = Math.PI * 2 - diff;
                        
                        if (diff < Math.PI / 4) { 
                            if (e.distanceTraveled > bestVal) {
                                bestVal = e.distanceTraveled;
                                target = e;
                            }
                        }
                    }
                    
                    if (target) {
                        tent.cooldown = cd;
                        let p = engine.projectilePool.get();
                        p.init(tower.x, tower.y, dmg, target, 'tentacle', 800, pierce, 0.3, angle, {canHitLead: true}, 0, tower, {isSharp: true, canHitLead: true});
                    } else {
                        tent.cooldown = 0.1; 
                    }
                }
            }
        }

        // 3. Buff Nearby Towers (Path 1 T3+ Pierce Buff)
        if (tower.upgrades[0] >= 3) {
            let buffMult = 0.10;
            if (tower.upgrades[0] >= 4) buffMult = 0.20;
            if (tower.upgrades[0] >= 5) buffMult = 0.40;
            
            const range = Utils.getEffectiveRange(tower, engine);
            for (const t of engine.towers) {
                if (t === tower || !t) continue;
                if (Utils.distanceSq(tower.x, tower.y, t.x, t.y) < range * range) {
                    t.addBuff('mermonkey_pierce', 'Abyssal Pierce', 0.5, 1, { type: 'mermonkey_pierce' }, false);
                    t.buffedPierce = Math.max(t.buffedPierce || 0, Math.ceil((t.stats.pierce || 1) * buffMult));
                }
            }
        }

        // 4. The Final Harmonic Buff (Path 3 T5 Hero/Magic Buff)
        if (tower.upgrades[2] >= 5) {
            const range = Utils.getEffectiveRange(tower, engine);
            const cx = tower.totemX !== undefined ? tower.totemX : tower.x;
            const cy = tower.totemY !== undefined ? tower.totemY : tower.y;
            for (const t of engine.towers) {
                if (t === tower || !t) continue;
                if (Utils.distanceSq(cx, cy, t.x, t.y) < range * range) {
                    if (t.stats.isHero) {
                        t.addBuff('final_harmonic', 'Final Harmonic', 0.5, 1, { type: 'final_harmonic' }, false);
                        t.buffedRange = Math.max(t.buffedRange || 0, 0.15);
                        t.abilityCdMult = Math.min(t.abilityCdMult || 1.0, 0.85);
                    }
                    if (t.stats.category === 'Magic') {
                        t.addBuff('final_harmonic', 'Final Harmonic', 0.5, 1, { type: 'final_harmonic' }, false);
                        t.buffedPierce = Math.max(t.buffedPierce || 0, 3);
                    }
                }
            }
        }

        // 5. Alluring Melody Trance (Path 3 T3+)
        if (tower.upgrades[2] >= 3) {
            if (tower.tranceCooldown === undefined) tower.tranceCooldown = 12.0;
            tower.tranceCooldown -= dt;
            if (tower.tranceCooldown <= 0) {
                tower.tranceActive = 6.0;
                tower.tranceCooldown = (tower.upgrades[2] >= 5 ? 3.0 : 12.0);
            }
            
            if (tower.tranceActive > 0) {
                tower.tranceActive -= dt;
                const cx = tower.totemX !== undefined ? tower.totemX : tower.x;
                const cy = tower.totemY !== undefined ? tower.totemY : tower.y;
                const tranceRange = Utils.getEffectiveRange(tower, engine);
                let pierce = 6 + (tower.upgrades[2] >= 4 ? 6 : 0);
                let hits = 0;
                
                for (const e of engine.enemies) {
                    if (hits >= pierce) break;
                    if (!e || !e.alive) continue;
                    if (e.data.isPurple) continue; 
                    
                    let canPull = !e.data.isMoab;
                    if (tower.upgrades[2] >= 4 && (e.data.isMoab || e.data.isDDT)) canPull = true;
                    if (tower.upgrades[2] >= 5 && (e.data.isBFB || e.data.isZOMG)) canPull = true;
                    let isBad = e.data.isBAD; 
                    
                    if (!canPull && !isBad) continue;
                    
                    if (Utils.withinRange(cx, cy, e.x, e.y, tranceRange)) {
                        if (e.isCamo) e.isCamo = false;
                        
                        if (e.dotTimer > 0) {
                            let dotCap = 50 + (tower.upgrades[2] >= 4 ? 75 : 0) + (tower.upgrades[2] >= 5 ? 9875 : 0);
                            let dotDmg = Math.min(e.dotDmg, dotCap);
                            e.takeDamage(dotDmg, {isAcid: true, canHitLead: true});
                            e.dotTimer = 0; e.dotDmg = 0;
                        }
                        
                        let cost = 1;
                        if (e.data.isCeramic && tower.upgrades[2] < 4) cost = 2; 
                        if (e.data.isMoab || e.data.isDDT) cost = 3; 
                        if (e.data.isBFB || e.data.isZOMG) cost = 3; 
                        if (isBad) cost = 3; 
                        
                        if (hits + cost > pierce) continue; 
                        
                        if (canPull) {
                            const pos = engine.map.getPositionAtDistance(e.distanceTraveled, e.pathIndex || 0);
                            if (pos && !pos.finished) {
                                let dx = e.x - cx, dy = e.y - cy;
                                let dist = Math.hypot(dx, dy);
                                let angle = Math.atan2(dy, dx);
                                
                                angle += 4.0 * dt; // Spin speed
                                let targetR = Math.max(35, dist - 250 * dt); // Yank them in violently
                                
                                let targetX = cx + Math.cos(angle) * targetR;
                                let targetY = cy + Math.sin(angle) * targetR;
                                
                                // Forcefully set their offset so the movement system places them in the orbit
                                e.offsetX = targetX - pos.x;
                                e.offsetY = targetY - pos.y;
                            }
                        }
                        
                        hits += cost;
                    }
                }
            }
        }

        // 6. Riptide Champion Custom Projectiles (Path 2 T3+)
        if (tower.upgrades[1] >= 3 && tower.activeRiptides && tower.activeRiptides.length > 0) {
            for (let i = tower.activeRiptides.length - 1; i >= 0; i--) {
                let r = tower.activeRiptides[i];
                r.x += Math.cos(r.angle) * r.speed * dt;
                r.y += Math.sin(r.angle) * r.speed * dt;
                r.life -= dt;
                r.timeAlive += dt;
                
                let growth = 0.5 + (tower.upgrades[1] >= 4 ? 0.25 : 0) + (tower.upgrades[1] >= 5 ? 0.375 : 0);
                r.dmg = r.baseDmg * (1 + Math.min(2, r.timeAlive * growth));
                r.radius = r.baseRadius * (1 + r.timeAlive * 0.1);
                
                const nearby = engine.enemyGrid.query(r.x, r.y, r.radius + 20, _mermRiptideScratch);
                for (const e of nearby) {
                    if (!e.alive || r.hitEnemies.has(e)) continue;
                    if (Utils.withinRange(r.x, r.y, e.x, e.y, r.radius + e.data.radius)) {
                        let dmg = e.takeDamage(r.dmg, {isFrigid: true, canHitLead: true}, {freeze: true, freezeDuration: 1.0}, tower);
                        if (dmg !== -1) {
                            r.hitEnemies.add(e);
                            r.pierce--;
                            if (r.pierce <= 0) { r.life = 0; break; }
                        }
                    }
                }
                
                if (r.life <= 0 || r.x < 0 || r.x > 1280 || r.y < 0 || r.y > 720) {
                    for (let j=0; j<2; j++) {
                        let waveletAngle = r.angle + (j === 0 ? Math.PI/2 : -Math.PI/2);
                        let p = engine.projectilePool.get();
                        p.init(r.x, r.y, r.baseDmg, null, 'wavelet', 400, 25, 1.0, waveletAngle, {freeze: true, freezeDuration: 1.0}, 0, tower, {isFrigid: true, canHitLead: true});
                    }
                    tower.activeRiptides.splice(i, 1);
                }
            }
        }

        // 7. Arctic Knight / Popseidon Ability Active Effect
        if (tower.iceJetActive > 0) {
            tower.iceJetActive -= dt;
            tower.cooldown -= dt; 
            if (tower.cooldown <= 0) {
                tower.cooldown = 0.05; 
                let targetAngle = Utils.angle(tower.x, tower.y, GameEngine.mouse.x, GameEngine.mouse.y);
                let spread = 30 * Math.PI / 180; 
                if (tower.upgrades[2] >= 1) spread = 10 * Math.PI / 180; 
                
                let dmg = 20 + (tower.upgrades[1] >= 5 ? 10 : 0);
                let pierce = 240;
                
                let angle = targetAngle + (Math.random() - 0.5) * spread;
                let p = engine.projectilePool.get();
                p.init(tower.x, tower.y, dmg, null, 'ice_ball', 800, pierce, 3.0, angle, {freeze: true, freezeDuration: 3.0, canHitLead: true}, 0, tower, {isFrigid: true, canHitLead: true});
            }
        }
    },
    
    draw(ctx, tower, isPreview) {
        if (!isPreview && tower.activeRiptides && tower.activeRiptides.length > 0) {
            for (const r of tower.activeRiptides) {
                ctx.save();
                ctx.translate(r.x, r.y);
                ctx.rotate(r.angle);
                ctx.fillStyle = '#1abc9c';
                ctx.beginPath();
                ctx.moveTo(r.radius, 0);
                ctx.lineTo(-r.radius, -r.radius);
                ctx.lineTo(-r.radius, r.radius);
                ctx.fill();
                ctx.restore();
            }
        }

        if (!isPreview && tower.tranceActive > 0) {
            let t = performance.now() / 1000;
            let cx = tower.totemX !== undefined ? tower.totemX : tower.x;
            let cy = tower.totemY !== undefined ? tower.totemY : tower.y;
            
            ctx.save();
            ctx.translate(cx, cy);
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = '#9b59b6';
            ctx.lineWidth = 4;
            ctx.beginPath();
            for (let i=0; i<4; i++) {
                let startAng = t * 4 + (i * Math.PI / 2);
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, 30 + Math.sin(t * 5) * 10, startAng, startAng + Math.PI * 1.5);
            }
            ctx.stroke();
            ctx.restore();
        }

        if (!isPreview && tower.totemX !== undefined) {
            ctx.save();
            ctx.translate(tower.totemX, tower.totemY);
            ctx.fillStyle = '#8e44ad';
            ctx.fillRect(-5, -20, 10, 20);
            ctx.fillStyle = '#9b59b6';
            ctx.beginPath();
            ctx.arc(0, -20, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        const { baseAsset, targetSize } = tower.getActiveAssets();
        if (baseAsset && baseAsset.loaded) {
            ctx.save(); 
            ctx.translate(tower.x, tower.y);
            if (!isPreview && !tower.stats.isStaticRotation) ctx.rotate(tower.angle + Math.PI / 2);
            drawImageCentered(ctx, baseAsset, targetSize); 
            ctx.restore();
        } else {
            ctx.save(); ctx.translate(tower.x, tower.y);
            if (!isPreview && !tower.stats.isStaticRotation) ctx.rotate(tower.angle + Math.PI / 2);
            ctx.fillStyle = '#2980b9'; ctx.beginPath(); ctx.arc(0, 0, 15 * GS, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1abc9c'; ctx.beginPath(); ctx.arc(0, -5 * GS, 8 * GS, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
    },
    
    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        if (tower.upgrades[1] >= 3) {
            if (!tower.activeRiptides) tower.activeRiptides = [];
            let baseDmg = 4 + (tower.upgrades[1] >= 4 ? 4 : 0) + (tower.upgrades[1] >= 5 ? 7 : 0);
            let count = 1;
            if (tower.upgrades[1] >= 5) count = 3;
            
            for (let i=0; i<count; i++) {
                let angle = Utils.angle(tower.x, tower.y, (tower._aim && tower._aim.x) || target.x, (tower._aim && tower._aim.y) || target.y);
                if (count > 1) angle += (i - 1) * (Math.PI / 4);
                tower.activeRiptides.push({
                    x: tower.x, y: tower.y, angle: angle,
                    speed: 400, life: 1.5, timeAlive: 0,
                    baseDmg: baseDmg, dmg: baseDmg,
                    baseRadius: 5, radius: 5,
                    pierce: 25, hitEnemies: new Set()
                });
            }
            return;
        }

        let pEffects = { ...effects };
        if (tower.upgrades[1] >= 2) {
            pEffects.freeze = true;
            pEffects.freezeDuration = 0.5;
        }
        if (tower.upgrades[2] >= 1) pEffects.homing = true;
        if (tower.upgrades[0] >= 4) {
            pEffects.slow = 0.4;
            pEffects.slowDuration = 10;
        }
        
        let p = engine.projectilePool.get();
        p.init(tower.x, tower.y, damage, target, 'trident', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, pEffects, 0, tower, dmgType, isCrit);
    },
    
    // ... [Keep all existing code the same until the ability method at the bottom] ...
    
    ability(tower, engine) {
        // Ice Jet Ability
        if (tower.upgrades[1] >= 4) {
            engine.log("Ice Jet Activated!");
            tower.iceJetActive = 3.0;
            tower.cooldown = 0;
            
            if (tower.upgrades[1] >= 5) {
                engine.log("Rogue Wave!");
                Utils.applyAoeDamage(engine, 640, 360, 1500, 70, {isFrigid: true, canHitLead: true}, tower, {}, {
                    onHit: (e) => e.applySlow(0.5, 8.0, false)
                });
                engine.explosions.push({ x: 640, y: 360, radius: 0, maxRadius: 1500, life: 1.0, maxLife: 1.0, color: '#1abc9c' });
            }
        }
        
        // Place Totem Ability (Symphonic Resonance +)
        if (tower.upgrades[2] >= 4) {
            tower.isPlacingTotem = true;
            engine.log("Click on the map to place the Totem!");
        }
    }
};
