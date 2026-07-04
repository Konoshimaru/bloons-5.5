// js/heroes/geto.js
import { GameEngine } from '../engine.js';
import { Utils, drawImageCentered } from '../utils.js';
import Assets from '../assets.js';
import { AudioEngine } from '../audio.js';

export default {
    stats: { 
        name: "Geto", cost: 720, range: 40, fireRate: 1.2, damage: 1, pierce: 2, projectileSpeed: 0, 
        lifespan: 0.4, desc: "Cursed Spirit Manipulator. Captures curses and unleashes them as resentment.", 
        dmgType: 'magic', projectileType: 'squid', hitRadius: 12, isHero: true, maxLevel: 20, scale: 1.3 
    },
    xpTable: [500, 1200, 2500, 4500, 7000, 10000, 14000, 19000, 25000, 32000, 40000, 50000, 62000, 75000, 90000, 110000, 130000, 160000, 200000, 250000],
    levels: {
        1: [],
        2: [{ stat: "fireRate", amount: -0.2 }],
        3: [{ stat: "isAbility", amount: true }],
        4: [{ stat: "range", amount: 10 }],
        5: [{ stat: "damage", amount: 1 }, { stat: "pierce", amount: 1 }],
        6: [{ stat: "fireRate", amount: -0.15 }, { stat: "slowOnHit", amount: true }],
        7: [{ stat: "wormEvery8th", amount: true }],
        8: [{ stat: "range", amount: 10 }, { stat: "damage", amount: 1 }],
        9: [{ stat: "pierce", amount: 1 }, { stat: "fireRate", amount: -0.1 }],
        10: [{ stat: "isAbility2", amount: true }],
        11: [{ stat: "damage", amount: 1 }, { stat: "range", amount: 10 }],
        12: [{ stat: "twinSquid", amount: true }],
        13: [{ stat: "pierce", amount: 1 }, { stat: "canSeeCamo", amount: true }],
        14: [{ stat: "wormEvery5th", amount: true }, { stat: "wormDmgBonus", amount: 2 }],
        15: [{ stat: "damage", amount: 1 }],
        16: [{ stat: "fireRate", amount: -0.05 }],
        17: [{ stat: "fireRate", amount: -0.1 }, { stat: "pierce", amount: 1 }],
        18: [{ stat: "moabDmgBonus", amount: 2 }, { stat: "wormStun", amount: true }],
        19: [{ stat: "damage", amount: 1 }, { stat: "range", amount: 5 }],
        20: [{ stat: "uzumakiUpgraded", amount: true }]
    },
    update(tower, dt) {
        if (!tower.shotCounter) tower.shotCounter = 0;
        if (!tower.squids) tower.squids = [];

        // Capture buff timer (L3 ability empowerment)
        if (tower.captureBuffTime > 0) {
            tower.captureBuffTime -= dt;
            if (tower.captureBuffTime <= 0) tower.captureBuffTime = 0;
        }

        // Curse Capture channeling state (L3 ability)
        if (tower.isCapturing) {
            tower.captureTime += dt;
            if (tower.captureTarget && tower.captureTarget.alive) {
                let dx = tower.x - tower.captureTarget.x, dy = tower.y - tower.captureTarget.y;
                let dist = Math.hypot(dx, dy);
                if (dist > 1) {
                    tower.captureTarget.offsetX += (dx / dist) * 60 * dt;
                    tower.captureTarget.offsetY += (dy / dist) * 60 * dt;
                }
                tower.captureTarget.applySlow(0.0, 0.1, false);
            }
            if (tower.captureTime >= 1.5) {
                if (tower.captureTarget && tower.captureTarget.alive) {
                    let dmg = tower.captureTarget.takeDamage(99999, { isMagic: true, canHitLead: true });
                    tower.damageDealt += dmg;
                }
                tower.captureBuffTime = 5.0;
                tower.isCapturing = false;
                tower.captureTarget = null;
                GameEngine.log("Curse captured!");
            }
        }

        // Update squid / worm projectiles
        for (let i = tower.squids.length - 1; i >= 0; i--) {
            let s = tower.squids[i];
            s.life -= dt;
            
            // Homing behavior for squids (worms travel straight)
            if (!s.isWorm) {
                let nearest = null, nearestDist = Infinity;
                const candidates = GameEngine.enemyGrid.query(s.x, s.y, 200);
                for (let e of candidates) {
                    if (!e.alive || s.hitEnemies.has(e)) continue;
                    let d = Utils.distance(s.x, s.y, e.x, e.y);
                    if (d < nearestDist) { nearestDist = d; nearest = e; }
                }
                if (nearest) {
                    let dx = nearest.x - s.x, dy = nearest.y - s.y;
                    let dist = Math.hypot(dx, dy);
                    if (dist > 1) {
                        s.vx = (dx / dist) * s.speed;
                        s.vy = (dy / dist) * s.speed;
                        s.angle = Math.atan2(s.vy, s.vx);
                    }
                }
            }
            
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            
            const nearby = GameEngine.enemyGrid.query(s.x, s.y, s.hitRadius + 20);
            for (let e of nearby) {
                if (!e.alive || s.hitEnemies.has(e)) continue;
                if (Utils.distance(s.x, s.y, e.x, e.y) < e.data.radius + s.hitRadius) {
                    let dmg = e.takeDamage(s.dmg, { isMagic: true, canHitLead: true });
                    tower.damageDealt += dmg;
                    s.hitEnemies.add(e);
                    // L6 Lingering Malice: 15% slow for 0.5s
                    if (s.slowOnHit) e.applySlow(0.85, 0.5, false);
                    // L18 Curse Synergy: worm stuns non-MOAB for 0.3s
                    if (s.isWorm && s.wormStun && !(e.data.isMOAB || e.data.isBMOAB || e.data.isDDT || e.data.isZOMG || e.data.isBAD)) {
                        e.applySlow(0.0, 0.3, false);
                    }
                    s.pierce--;
                    if (s.pierce <= 0 && !s.isWorm) {
                        tower.squids.splice(i, 1);
                        break;
                    }
                }
            }
            
            if (s.life <= 0 || s.x < -50 || s.x > 1050 || s.y < -50 || s.y > 750) {
                tower.squids.splice(i, 1);
            }
        }

        // Maximum: Uzumaki beam state (L10 ability)
        if (tower.uzumakiBeam) {
            tower.uzumakiBeam.life -= dt;
            
            if (tower.uzumakiBeam.channelTime > 0) {
                tower.uzumakiBeam.channelTime -= dt;
            } else {
                if (!tower.uzumakiBeam.fired) {
                    tower.uzumakiBeam.fired = true;
                    GameEngine.log("Maximum: Uzumaki!");
                }
                let isUpgraded = tower.stats.uzumakiUpgraded;
                let dpsMult = isUpgraded ? 12 : 8;
                let moabDps = isUpgraded ? 60 : 25;
                for (let e of GameEngine.enemies) {
                    if (!e.alive) continue;
                    let dmg = e.takeDamage(tower.stats.damage * dpsMult * dt, { isMagic: true, canHitLead: true });
                    tower.damageDealt += dmg;
                    if (e.data.isMOAB || e.data.isBMOAB || e.data.isDDT || e.data.isZOMG || e.data.isBAD) {
                        let moabDmg = e.takeDamage(moabDps * dt, { isMagic: true, canHitLead: true });
                        tower.damageDealt += moabDmg;
                    }
                }
                
                // L20 residual CE field trigger
                if (isUpgraded && tower.uzumakiBeam.life <= 0 && !tower.uzumakiBeam.residualSpawned) {
                    tower.uzumakiBeam.residualSpawned = true;
                    tower.ceField = { life: 4.0, maxLife: 4.0 };
                }
            }
            
            if (tower.uzumakiBeam.life <= 0) {
                tower.uzumakiBeam = null;
            }
        }
        
        // L20 residual CE field - slows bloons on track for 4s after ult
        if (tower.ceField) {
            tower.ceField.life -= dt;
            for (let e of GameEngine.enemies) {
                if (!e.alive) continue;
                e.applySlow(0.7, 0.1, false);
            }
            if (tower.ceField.life <= 0) tower.ceField = null;
        }
    },
    draw(ctx, tower, isPreview) {
        // Uzumaki beam VFX
        if (tower.uzumakiBeam) { this.drawUzumakiVFX(ctx, tower, tower.uzumakiBeam); }
        // Residual CE field
        if (tower.ceField) { this.drawCEFieldVFX(ctx, tower); }
        // Capture channeling
        if (tower.isCapturing && tower.captureTarget) { this.drawCaptureVFX(ctx, tower.x, tower.y, tower.captureTarget.x, tower.captureTarget.y, tower.captureTime / 1.5); }

        // Squid / worm projectiles
        if (!isPreview && tower.squids) {
            for (let s of tower.squids) {
                if (s.isWorm) { this.drawWormVFX(ctx, s.x, s.y, s.angle); }
                else { this.drawSquidVFX(ctx, s.x, s.y, s.angle); }
            }
        }

        // Capture buff aura
        if (!isPreview && tower.captureBuffTime > 0) {
            let t = performance.now() / 1000;
            ctx.globalAlpha = 0.5 * (tower.captureBuffTime / 5.0); ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(tower.x, tower.y, 18 + Math.sin(t * 8) * 3, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
        }
        
        const baseAsset = Assets.get(`tower_geto_base`);
        if (baseAsset && baseAsset.loaded) {
            ctx.save(); 
            ctx.translate(tower.x, tower.y);
            if (!isPreview && !tower.stats.isStaticRotation) {
                ctx.rotate(tower.angle + Math.PI / 2); 
            }
            drawImageCentered(ctx, baseAsset, 45);
            ctx.restore();
        } else {
            ctx.save(); ctx.translate(tower.x, tower.y);
            if (!isPreview && !tower.stats.isStaticRotation) ctx.rotate(tower.angle + Math.PI / 2);
            // Geto - monk robes, dark purple
            ctx.fillStyle = '#3a0060'; 
            ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(0, 2, 10, 0, Math.PI * 2); ctx.fill();
            // Topknot - golden dot
            ctx.fillStyle = '#ffcc00'; 
            ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
    },
    drawSquidVFX(ctx, x, y, angle) {
        let t = performance.now() / 1000;
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
        ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(75, 0, 130, 0.8)';
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
        grad.addColorStop(0, '#a020f0'); grad.addColorStop(0.6, '#4a0080'); grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
        // Tentacles
        ctx.strokeStyle = '#a020f0'; ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            let a = (i / 4) * Math.PI * 2 + t * 4;
            ctx.beginPath(); ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
            ctx.stroke();
        }
        ctx.shadowBlur = 0; ctx.restore();
    },
    drawWormVFX(ctx, x, y, angle) {
        let t = performance.now() / 1000;
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
        ctx.globalCompositeOperation = 'screen';
        ctx.shadowBlur = 20; ctx.shadowColor = 'rgba(0, 255, 200, 0.8)';
        // Rainbow Dragon body - segmented
        for (let i = 0; i < 6; i++) {
            let offset = Math.sin(t * 6 + i * 0.5) * 3;
            let hue = (i * 60 + t * 100) % 360;
            const grad = ctx.createRadialGradient(i * 9 - 22, offset, 0, i * 9 - 22, offset, 11);
            grad.addColorStop(0, `hsla(${hue}, 100%, 70%, 1)`);
            grad.addColorStop(0.5, `hsla(${hue}, 80%, 40%, 0.6)`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad; ctx.beginPath();
            ctx.arc(i * 9 - 22, offset, 11, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.restore();
    },
    drawUzumakiVFX(ctx, tower, beam) {
        let t = performance.now() / 1000;
        let isChanneling = beam.channelTime > 0;
        let intensity = isChanneling ? (1.5 - beam.channelTime) / 1.5 : 1.0;
        let isUpgraded = tower.stats.uzumakiUpgraded;
        let beamAngle = tower.uzumakiAngle || 0;
        let beamLength = 700 * intensity;
        
        ctx.save();
        ctx.translate(tower.x, tower.y);
        ctx.rotate(beamAngle);
        ctx.globalCompositeOperation = 'screen';
        ctx.shadowBlur = 40; ctx.shadowColor = isUpgraded ? 'rgba(255, 0, 100, 0.9)' : 'rgba(128, 0, 255, 0.9)';
        
        // Main beam corridor
        const grad = ctx.createLinearGradient(0, 0, beamLength, 0);
        grad.addColorStop(0, `rgba(255, 255, 255, ${intensity})`);
        grad.addColorStop(0.3, isUpgraded ? `rgba(255, 100, 200, ${intensity * 0.8})` : `rgba(200, 100, 255, ${intensity * 0.8})`);
        grad.addColorStop(0.7, isUpgraded ? `rgba(200, 0, 100, ${intensity * 0.5})` : `rgba(100, 0, 200, ${intensity * 0.5})`);
        grad.addColorStop(1, 'rgba(50, 0, 100, 0)');
        ctx.fillStyle = grad; ctx.beginPath();
        let halfWidth = (isUpgraded ? 45 : 35) * intensity;
        ctx.moveTo(0, -halfWidth);
        ctx.lineTo(beamLength, -halfWidth * 0.3);
        ctx.lineTo(beamLength, halfWidth * 0.3);
        ctx.lineTo(0, halfWidth); ctx.closePath(); ctx.fill();
        
        // Spiral overlay - uzumaki pattern
        ctx.strokeStyle = `rgba(255, 255, 255, ${intensity * 0.7})`; ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = 0; x < beamLength; x += 4) {
            let y = Math.sin(x * 0.05 + t * 12) * 18 * intensity;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        // Counter-spiral
        ctx.strokeStyle = `rgba(200, 100, 255, ${intensity * 0.5})`; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < beamLength; x += 4) {
            let y = -Math.sin(x * 0.05 + t * 12 + Math.PI) * 12 * intensity;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.restore();
    },
    drawCEFieldVFX(ctx, tower) {
        let t = performance.now() / 1000;
        let alpha = (tower.ceField.life / tower.ceField.maxLife) * 0.25;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = `rgba(150, 0, 255, ${alpha})`;
        ctx.fillRect(0, 0, 1000, 700);
        // Wavy curse lines
        ctx.strokeStyle = `rgba(200, 100, 255, ${alpha * 2.5})`; ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            let yBase = i * 140;
            for (let x = 0; x < 1000; x += 10) {
                let y = yBase + Math.sin(x * 0.02 + t * 3 + i) * 20;
                if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.restore();
    },
    drawCaptureVFX(ctx, x1, y1, x2, y2, progress) {
        let t = performance.now() / 1000;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.shadowBlur = 15; ctx.shadowColor = 'rgba(200, 0, 255, 0.8)';
        ctx.strokeStyle = `rgba(200, 100, 255, ${progress})`; ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]); ctx.lineDashOffset = -t * 30;
        ctx.beginPath(); ctx.moveTo(x1, y1);
        let mx = (x1 + x2) / 2 + Math.sin(t * 3) * 20;
        let my = (y1 + y2) / 2 + Math.cos(t * 3) * 20;
        ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
        ctx.setLineDash([]);
        // Pull particles flowing from target back to Geto
        for (let i = 0; i < 4; i++) {
            let p = ((t * 2 + i * 0.25) % 1);
            let px = x2 + (x1 - x2) * p;
            let py = y2 + (y1 - y2) * p;
            ctx.fillStyle = `rgba(255, 255, 255, ${1 - p})`;
            ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.restore();
    },
    ability(tower, engine) {
        // Curse Capture - L3
        if (tower.isCapturing) { engine.log("Already capturing."); return; }

        let target = null;
        let bestValue = -Infinity;
        for (let e of engine.enemies) {
            if (!e.alive) continue;
            if (e.data.isMoab || e.data.isDDT || e.data.isBAD) continue;

            const dist = Utils.distance(tower.x, tower.y, e.x, e.y);
            if (dist > tower.stats.range) continue;

            const hp = Number.isFinite(e.hp) ? e.hp : (e.data.maxHp || 0);
            const value = hp - dist * 0.2;
            if (value > bestValue) {
                bestValue = value;
                target = e;
            }
        }

        if (!target) { engine.log("No curse to capture."); return; }
        engine.log("Curse Capture!");
        tower.isCapturing = true;
        tower.captureTime = 0;
        tower.captureTarget = target;
    },
    ability2(tower, engine) {
        // Maximum: Uzumaki - L10 (upgraded at L20)
        let isUpgraded = tower.stats.uzumakiUpgraded;
        engine.log(isUpgraded ? "Maximum Output: Uzumaki!" : "Maximum: Uzumaki!");
        tower.uzumakiAngle = tower.angle || 0;
        tower.uzumakiBeam = {
            life: isUpgraded ? 7.5 : 5.5,   // 1.5s channel + (4s base / 6s upgraded) active
            channelTime: 1.5,
            fired: false,
            residualSpawned: false
        };
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        if (!tower.squids) tower.squids = [];
        tower.shotCounter = (tower.shotCounter || 0) + 1;
        
        // Capture buff - 1.5x damage during buff window
        let actualDmg = damage;
        if (tower.captureBuffTime > 0) actualDmg = Math.floor(actualDmg * 1.5);
        // L18 MOAB dmg bonus
        let moabBonus = tower.stats.moabDmgBonus || 0;
        // L6 slow-on-hit flag
        let slowOnHit = !!tower.stats.slowOnHit;
        // L18 worm stun flag
        let wormStun = !!tower.stats.wormStun;
        
        // Worm chain pattern - L7 every 8th, L14 every 5th
        let wormEvery8th = !!tower.stats.wormEvery8th;
        let wormEvery5th = !!tower.stats.wormEvery5th;
        let isWorm = false;
        if (wormEvery5th) isWorm = (tower.shotCounter % 5 === 0);
        else if (wormEvery8th) isWorm = (tower.shotCounter % 8 === 0);
        
        if (isWorm) {
            let dx = target.x - tower.x, dy = target.y - tower.y;
            let dist = Math.hypot(dx, dy);
            let speed = 600;
            let vx = dist > 0 ? (dx / dist) * speed : 0;
            let vy = dist > 0 ? (dy / dist) * speed : 0;
            let wormDmg = 4 + (tower.stats.wormDmgBonus || 0);
            tower.squids.push({
                x: tower.x, y: tower.y, vx: vx, vy: vy, speed: speed,
                life: 1.5, dmg: wormDmg + moabBonus, pierce: 999, hitRadius: 22,
                hitEnemies: new Set(), isWorm: true,
                angle: Math.atan2(vy, vx), wormStun: wormStun,
                slowOnHit: false
            });
        } else {
            // L12 Twin Squid Volley
            let squidCount = tower.stats.twinSquid ? 2 : 1;
            let baseAngle = Math.atan2(target.y - tower.y, target.x - tower.x);
            for (let i = 0; i < squidCount; i++) {
                let spread = squidCount > 1 ? (i === 0 ? -0.2 : 0.2) : 0;
                let a = baseAngle + spread;
                let speed = 450;
                tower.squids.push({
                    x: tower.x, y: tower.y,
                    vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                    speed: speed, life: 1.0, dmg: actualDmg + moabBonus,
                    pierce: tower.stats.pierce, hitRadius: 12,
                    hitEnemies: new Set(), isWorm: false, angle: a,
                    slowOnHit: slowOnHit, wormStun: false
                });
            }
        }
    }
};
