// js/heroes/gojo.js
import { GameEngine } from '../engine.js';
import { Utils, drawImageCentered } from '../utils.js';
import Assets from '../assets.js';
import { AudioEngine } from '../audio.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GLOBAL_SCALE } from '../constants.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

export default {
    stats: { 
        name: "Gojo", cost: 2500, range: 50, fireRate: 1.2, damage: 2, pierce: 15, projectileSpeed: 800, 
        lifespan: 0.4, desc: "The Honored One. Manipulates space to crush bloons.", 
        dmgType: 'magic', projectileType: 'blue', hitRadius: 18, isHero: true, maxLevel: 20, scale: 1.3 
    },
    xpTable: [500, 1200, 2500, 4500, 7000, 10000, 14000, 19000, 25000, 32000, 40000, 50000, 62000, 75000, 90000, 110000, 130000, 160000, 200000, 250000],
    levels: {
        1: [], 2: [{ stat: "damage", amount: 1 }], 
        3: [{ stat: "limitlessPassive", amount: true }], 
        4: [{ stat: "range", amount: 5 }], 5: [{ stat: "fireRate", amount: -0.1 }], 
        6: [{ stat: "damage", amount: 2 }], 
        7: [{ stat: "isAbility", amount: true }], 
        8: [{ stat: "fireRate", amount: -0.1 }], 9: [{ stat: "range", amount: 10 }], 
        10: [{ stat: "damage", amount: 3 }], 
        11: [{ stat: "fireRate", amount: -0.1 }], 12: [{ stat: "damage", amount: 3 }], 
        13: [{ stat: "isAbility2", amount: true }], 
        14: [{ stat: "range", amount: 15 }], 15: [{ stat: "damage", amount: 5 }], 
        16: [{ stat: "fireRate", amount: -0.1 }], 17: [{ stat: "damage", amount: 5 }], 
        18: [{ stat: "pierce", amount: 30 }], 19: [{ stat: "fireRate", amount: -0.1 }], 
        20: [{ stat: "isAbility3", amount: true }] 
    },
    update(tower, dt) {
        if (!tower.phase) tower.phase = 1;
        if (tower.hollowChargeTime === undefined) tower.hollowChargeTime = 0;

        let shouldHaveAb3 = (tower.level >= 20 && tower.phase === 2);
        if (shouldHaveAb3 && !tower.stats.isAbility3) {
            tower.stats.isAbility3 = true;
            tower.ability3Cooldown = 120 * (2 / 3); 
        } else if (!shouldHaveAb3 && tower.stats.isAbility3) {
            tower.stats.isAbility3 = false; 
        }

        if (tower.isHollowCharging) {
            tower.cooldown = 1.0; 
            tower.attackPointTimer = 0;
            tower.angle = Utils.angle(tower.x, tower.y, GameEngine.mouse.x, GameEngine.mouse.y);
            tower.hollowChargeTime += dt;
        }

        if (tower.hollowProjectile) {
            tower.hollowProjectile.x += Math.cos(tower.hollowProjectile.angle) * 1200 * dt;
            tower.hollowProjectile.y += Math.sin(tower.hollowProjectile.angle) * 1200 * dt;
            
            const nearby = GameEngine.enemyGrid.query(tower.hollowProjectile.x, tower.hollowProjectile.y, 80);
            for (let i = 0; i < nearby.length; i++) {
                const e = nearby[i];
                if (!e || !e.alive) continue;
                if (tower.hollowProjectile.hitEnemies.has(e)) continue;
                
                if (Utils.withinRange(tower.hollowProjectile.x, tower.hollowProjectile.y, e.x, e.y, e.data.radius + 40)) {
                    let dmg = e.takeDamage(10000, { isMagic: true, canHitLead: true });
                    if (!isNaN(dmg) && dmg !== -1) tower.damageDealt += dmg;
                    tower.hollowProjectile.hitEnemies.add(e); 
                }
            }
            
            if (tower.hollowProjectile.x < -100 || tower.hollowProjectile.x > CANVAS_WIDTH + 100 || tower.hollowProjectile.y < -100 || tower.hollowProjectile.y > CANVAS_HEIGHT + 100) {
                tower.hollowProjectile = null;
            }
        }

        if (tower.phase === 1 && GameEngine.difficulty && GameEngine.map) {
            const totalLen = GameEngine.map.getTotalLength(0); 
            let wouldDie = false;
            
            if (totalLen > 0) {
                for (let i = 0; i < GameEngine.enemies.length; i++) {
                    const e = GameEngine.enemies[i];
                    if (e && e.alive && e.distanceTraveled >= totalLen * 0.95) {
                        if (GameEngine.lives - e.getLivesLost() <= 0) {
                            wouldDie = true;
                            break;
                        }
                    }
                }
            }

            if (wouldDie) {
                tower.phase = 2; tower.awakened = true;
                tower.stats.canSeeCamo = true; 
                
                let startDist = 0;
                for (let i = 0; i < GameEngine.enemies.length; i++) {
                    const e = GameEngine.enemies[i];
                    if (e && e.alive && e.distanceTraveled > startDist) startDist = e.distanceTraveled;
                }
                tower.reverseWell = { life: 5.0, maxLife: 5.0, dist: startDist };
                GameEngine.log("Gojo has awakened..."); AudioEngine.playSfx('place'); 
            }
        }

        if (tower.reverseWell) {
            tower.reverseWell.life -= dt; tower.reverseWell.dist -= 200 * dt; 
            if (tower.reverseWell.dist < 0) tower.reverseWell.dist = 0;
            const pos = GameEngine.map.getPositionAtDistance(tower.reverseWell.dist, 0);
            tower.reverseWell.x = pos.x; tower.reverseWell.y = pos.y;
            
            // Backward iteration is extremely safe against array modifications
            for (let i = GameEngine.enemies.length - 1; i >= 0; i--) {
                const e = GameEngine.enemies[i];
                if (!e || !e.alive) continue;
                if (e.distanceTraveled > tower.reverseWell.dist) {
                    e.distanceTraveled = Math.max(tower.reverseWell.dist, e.distanceTraveled - 400 * dt);
                    e.offsetX *= 0.5; e.offsetY *= 0.5; 
                }
                if (Utils.withinRange(tower.reverseWell.x, tower.reverseWell.y, e.x, e.y, 150)) {
                    let dmg = e.takeDamage(5000 * dt, { isMagic: true, canHitLead: true }); 
                    if (!isNaN(dmg) && dmg !== -1) tower.damageDealt += dmg;
                }
            }
            if (tower.reverseWell.life <= 0 || tower.reverseWell.dist <= 0) tower.reverseWell = null;
        }

        if (tower.stats.limitlessPassive && GameEngine.map) {
            for (let i = 0; i < GameEngine.enemies.length; i++) {
                const e = GameEngine.enemies[i];
                if (!e || !e.alive) continue;
                const totalLen = GameEngine.map.getTotalLength(e.pathIndex || 0);
                if (totalLen > 0) {
                    const maxSlow = tower.phase === 2 ? 0.50 : 0.25;
                    let progress = Math.min(1, Math.max(0, e.distanceTraveled / totalLen));
                    if (isNaN(progress)) progress = 0;
                    let slowVal = 1 - (progress * maxSlow); 
                    e.gojoSlow = isNaN(slowVal) ? 1.0 : slowVal; 
                    e.infinityTint = progress;
                } else {
                    e.gojoSlow = 1.0; 
                    e.infinityTint = 0;
                }
            }
        }

        if (tower.maxBlue) {
            tower.maxBlue.life -= dt; tower.maxBlue.angle += dt * 4; 
            let mx = tower.x + Math.cos(tower.maxBlue.angle) * 150; let my = tower.y + Math.sin(tower.maxBlue.angle) * 150;
            tower.maxBlue.x = mx; tower.maxBlue.y = my;
            const nearby = GameEngine.enemyGrid.query(mx, my, 150);
            for (let i = 0; i < nearby.length; i++) {
                const e = nearby[i];
                if (!e || !e.alive) continue; 
                let dx = mx - e.x; let dy = my - e.y; let dist = Math.hypot(dx, dy);
                if (dist > 1) { e.offsetX += dx * 0.1; e.offsetY += dy * 0.1; }
                let dmg = e.takeDamage(tower.maxBlue.dmg * dt * 5, { isMagic: true, canHitLead: true }); 
                if (!isNaN(dmg) && dmg !== -1) tower.damageDealt += dmg;
            }
            if (tower.maxBlue.life <= 0) {
                GameEngine.explosions.push({ x: mx, y: my, radius: 0, maxRadius: 200, life: 0.5, maxLife: 0.5, color: '#0000ff' });
                for (let i = 0; i < nearby.length; i++) {
                    const e = nearby[i];
                    if (!e || !e.alive) continue; 
                    let dmg = e.takeDamage(tower.maxBlue.dmg * 50, { isMagic: true, canHitLead: true }); 
                    if (!isNaN(dmg) && dmg !== -1) tower.damageDealt += dmg; 
                }
                tower.maxBlue = null;
            }
        }
    },
    draw(ctx, tower, isPreview) {
        if (tower.reverseWell) { this.drawMaxBlueVFX(ctx, tower.reverseWell.x, tower.reverseWell.y, 150); }
        if (tower.maxBlue) { this.drawMaxBlueVFX(ctx, tower.maxBlue.x, tower.maxBlue.y, 100); }
        
        if (tower.isHollowCharging) {
            let dist = 40; 
            let vx = tower.x + Math.cos(tower.angle) * dist;
            let vy = tower.y + Math.sin(tower.angle) * dist;
            let progress = Math.min(1, tower.hollowChargeTime / 1.0); 
            this.drawHollowPurpleVFX(ctx, vx, vy, progress);
        }

        if (tower.hollowProjectile) {
            this.drawHollowPurpleVFX(ctx, tower.hollowProjectile.x, tower.hollowProjectile.y, 1.0);
        }

        if (!isPreview && tower.stats.limitlessPassive) {
            let auraColor = tower.phase === 2 ? '#ff00ff' : '#a253ff'; ctx.globalAlpha = 0.3; ctx.strokeStyle = auraColor; ctx.lineWidth = 2;
            let t = performance.now() / 1000;
            for(let i=0; i<3; i++) { ctx.beginPath(); ctx.arc(tower.x, tower.y, 22 + (i*4), t + (i * Math.PI / 3), t + (i * Math.PI / 3) + Math.PI * 1.5); ctx.stroke(); }
            ctx.globalAlpha = 1;
        }
        
        const { baseAsset, targetSize } = tower.getActiveAssets();
        if (baseAsset && baseAsset.loaded) {
            ctx.save(); 
            ctx.translate(tower.x, tower.y);
            if (!isPreview && !tower.stats.isStaticRotation) {
                ctx.rotate(tower.angle + Math.PI / 2); 
            }
            drawImageCentered(ctx, baseAsset, targetSize); 
            ctx.restore();
        } else {
            ctx.save(); ctx.translate(tower.x, tower.y);
            if (!isPreview && !tower.stats.isStaticRotation) ctx.rotate(tower.angle + Math.PI / 2);
            ctx.fillStyle = tower.phase === 2 ? '#ff00ff' : '#9b59b6'; ctx.beginPath(); ctx.arc(0, 0, 15 * GS, 0, Math.PI * 2); ctx.fill(); 
            ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(0, 2 * GS, 10 * GS, 0, Math.PI * 2); ctx.fill(); 
            ctx.fillStyle = '#00ffff'; ctx.beginPath(); ctx.arc(0, 0, 4 * GS, 0, Math.PI * 2); ctx.fill(); 
            ctx.restore();
        }
    },
    drawMaxBlueVFX(ctx, x, y, baseR) {
        if (isNaN(x) || isNaN(y) || isNaN(baseR)) return;
        let t = performance.now() / 1000; 
        let pulse = 1 + Math.sin(t * 4) * 0.15; 
        let r = Math.max(1, baseR * pulse); 
        let points = 16;
        ctx.save(); ctx.translate(x, y); ctx.shadowBlur = 80 + Math.sin(t * 4) * 30; ctx.shadowColor = 'rgba(0, 85, 255, 0.7)'; ctx.globalCompositeOperation = 'screen';
        ctx.save(); ctx.rotate(t * 1.5); let scaleA = 1 + Math.sin(t * 3) * 0.05; ctx.scale(scaleA, scaleA);
        const gradA = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.2); gradA.addColorStop(0, 'rgba(0, 210, 255, 0.6)'); gradA.addColorStop(0.6, 'rgba(0, 85, 255, 0.2)'); gradA.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradA; ctx.beginPath();
        for(let i=0; i<=points; i++) { let ang = (i / points) * Math.PI * 2; let rad = r * 1.2 + Math.sin(ang * 3 + t * 5) * 25; let px = Math.cos(ang) * rad; let py = Math.sin(ang) * rad; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
        ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.save(); ctx.rotate(-t * 1.8); let scaleB = 1 - Math.sin(t * 4) * 0.05; ctx.scale(scaleB, scaleB);
        const gradB = ctx.createRadialGradient(0, 0, 0, 0, 0, r); gradB.addColorStop(0.2, 'rgba(0, 210, 255, 0.5)'); gradB.addColorStop(0.7, 'rgba(0, 34, 102, 0.4)'); gradB.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradB; ctx.beginPath();
        for(let i=0; i<=points; i++) { let ang = (i / points) * Math.PI * 2; let rad = r + Math.cos(ang * 4 + t * 6) * 20; let px = Math.cos(ang) * rad; let py = Math.sin(ang) * rad; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
        ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.globalCompositeOperation = 'source-over';
        const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.8); coreGrad.addColorStop(0.1, '#ffffff'); coreGrad.addColorStop(0.4, '#00d2ff'); coreGrad.addColorStop(0.8, '#002266'); coreGrad.addColorStop(1, 'rgba(0, 34, 102, 0)');
        ctx.fillStyle = coreGrad; ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.restore();
    },
    drawHollowPurpleVFX(ctx, x, y, progress) {
        if (isNaN(x) || isNaN(y) || isNaN(progress)) return;
        let t = performance.now() / 1000; 
        let trembleX = (Math.random() - 0.5) * 4; 
        let trembleY = (Math.random() - 0.5) * 4;
        ctx.save(); ctx.translate(x + trembleX, y + trembleY); ctx.globalCompositeOperation = 'screen';
        let shroudR = 100 + Math.sin(t * 2) * 20;
        const shroudGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, shroudR * progress)); shroudGrad.addColorStop(0, `rgba(148, 0, 211, 0.9)`); shroudGrad.addColorStop(0.7, `rgba(75, 0, 130, 0.5)`); shroudGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shroudGrad; ctx.beginPath(); ctx.arc(0, 0, Math.max(1, shroudR * progress), 0, Math.PI * 2); ctx.fill();
        let ringR = 80 + Math.sin(t * 3) * 10; ctx.shadowBlur = 30; ctx.shadowColor = 'rgba(148, 0, 211, 0.8)'; ctx.strokeStyle = `rgba(255, 255, 255, 0.5)`; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(0, 0, Math.max(1, ringR * progress), 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.random() * 0.8})`; ctx.lineWidth = 2;
        for(let i=0; i<3; i++) { let ang = t * 10 + (i * Math.PI * 2 / 3); ctx.beginPath(); ctx.moveTo(0, 0); let len = 60 * progress; let x1 = Math.cos(ang) * len * 0.5; let y1 = Math.sin(ang) * len * 0.5; let x2 = Math.cos(ang + Math.random()*0.5) * len; let y2 = Math.sin(ang + Math.random()*0.5) * len; ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
        ctx.globalCompositeOperation = 'source-over'; let eyeR = 40 * progress;
        const eyeGrad = ctx.createRadialGradient(0,0,0, 0,0, Math.max(1, eyeR)); eyeGrad.addColorStop(0, '#ffffff'); eyeGrad.addColorStop(0.5, '#e6beff'); eyeGrad.addColorStop(0.8, 'rgba(148, 0, 211, 0.8)'); eyeGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = eyeGrad; ctx.beginPath(); ctx.arc(0, 0, Math.max(1, eyeR), 0, Math.PI * 2); ctx.fill(); ctx.restore();
    },
    ability(tower, engine) {
        if (tower.phase === 2) {
            engine.log("Reversal: Red!"); 
            let target = null; let bestVal = -Infinity;
            for (let i = 0; i < engine.enemies.length; i++) {
                const e = engine.enemies[i];
                if (!e || !e.alive) continue;
                if (e.distanceTraveled > bestVal) { bestVal = e.distanceTraveled; target = e; } 
            }
            let x = target ? target.x : tower.x; let y = target ? target.y : tower.y;
            const p = engine.projectilePool.get();
            p.init(x, y, tower.stats.damage * 20, null, 'bomb', 1, 1, 0.01, null, { isExplosive: true, explosionRadius: 150, explosionDamage: tower.stats.damage * 20, canHitLead: true }, 0, tower, { isMagic: true, canHitLead: true });
            return;
        }
        engine.log("Reversal: Re... huh?");
        const p = engine.projectilePool.get();
        p.init(tower.x, tower.y - 20, 0, null, 'bomb', 1, 1, 0.01, null, { isExplosive: true, explosionRadius: 80, explosionDamage: 0, canHitLead: true }, 0, tower, { isMagic: true, canHitLead: true });
    },
    ability2(tower, engine) {
        if (tower.phase === 2) {
            engine.log("Hollow Purple... Select Target!");
            tower.isHollowCharging = true;
            tower.hollowChargeTime = 0;
            return;
        }
        engine.log("Maximum: Blue!"); 
        tower.maxBlue = { life: 3.14, maxLife: 3.14, angle: 0, x: tower.x, y: tower.y, dmg: tower.stats.damage };
    },
    ability3(tower, engine) {
        engine.log("Domain Expansion: 0.2 Second Void!");
        for (let i = engine.enemies.length - 1; i >= 0; i--) {
            const e = engine.enemies[i];
            if (e && e.alive && !e.data.isBAD) { e.applySlow(0.0, 10.0, false); } 
        }
        engine.explosions.push({ x: 450, y: 300, radius: 0, maxRadius: 900, life: 0.8, maxLife: 0.8, color: '#ff00ff' });
    },
    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        let count = tower.phase === 2 ? 2 : 1;
        for (let i = 0; i < count; i++) {
            const p = engine.projectilePool.get();
            const offset = count > 1 ? (i === 0 ? -10 : 10) : 0;
            p.init(tower.x, tower.y, damage, target, 'blue', 800, tower.stats.pierce, tower.stats.lifespan, null, effects, offset, tower, dmgType, isCrit);
        }
    }
};