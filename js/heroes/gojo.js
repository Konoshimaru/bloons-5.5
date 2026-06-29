// js/heroes/gojo.js
import { GameEngine } from '../engine.js';
import { Utils, drawImageCentered } from '../utils.js';
import Assets from '../assets.js';
import { Projectile } from '../projectile.js';
import { AudioEngine } from '../audio.js';

export default {
    stats: { 
        name: "Gojo", cost: 2500, range: 50, fireRate: 1.2, damage: 2, pierce: 15, projectileSpeed: 0, 
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
            for (let e of nearby) {
                if (!e.alive) continue;
                if (tower.hollowProjectile.hitEnemies.has(e)) continue;
                
                if (Utils.distance(tower.hollowProjectile.x, tower.hollowProjectile.y, e.x, e.y) < e.data.radius + 40) {
                    let dmg = e.takeDamage(10000, { isMagic: true, canHitLead: true });
                    tower.damageDealt += dmg;
                    tower.hollowProjectile.hitEnemies.add(e); 
                }
            }
            
            if (tower.hollowProjectile.x < -100 || tower.hollowProjectile.x > 1000 || tower.hollowProjectile.y < -100 || tower.hollowProjectile.y > 700) {
                tower.hollowProjectile = null;
            }
        }

        if (tower.phase === 1 && GameEngine.difficulty) {
            const criticalLives = Math.max(1, GameEngine.difficulty.lives * 0.1);
            if (GameEngine.lives <= criticalLives) {
                tower.phase = 2; tower.awakened = true;
                let startDist = 0;
                for (let e of GameEngine.enemies) { if (e.alive && e.distanceTraveled > startDist) startDist = e.distanceTraveled; }
                tower.reverseWell = { life: 5.0, maxLife: 5.0, dist: startDist };
                GameEngine.log("Gojo has awakened..."); AudioEngine.playSfx('place'); 
            }
        }

        if (tower.reverseWell) {
            tower.reverseWell.life -= dt; tower.reverseWell.dist -= 200 * dt; 
            if (tower.reverseWell.dist < 0) tower.reverseWell.dist = 0;
            const pos = GameEngine.map.getPositionAtDistance(tower.reverseWell.dist);
            tower.reverseWell.x = pos.x; tower.reverseWell.y = pos.y;
            for (let e of GameEngine.enemies) {
                if (!e.alive) continue;
                if (e.distanceTraveled > tower.reverseWell.dist) {
                    e.distanceTraveled = Math.max(tower.reverseWell.dist, e.distanceTraveled - 400 * dt);
                    e.offsetX *= 0.5; e.offsetY *= 0.5; 
                }
                if (Utils.distance(tower.reverseWell.x, tower.reverseWell.y, e.x, e.y) < 150) {
                    let dmg = e.takeDamage(5000 * dt, { isMagic: true, canHitLead: true }); tower.damageDealt += dmg;
                }
            }
            if (tower.reverseWell.life <= 0 || tower.reverseWell.dist <= 0) tower.reverseWell = null;
        }

        if (tower.stats.limitlessPassive && GameEngine.map) {
            const totalLen = GameEngine.map.getTotalLength(); const maxSlow = tower.phase === 2 ? 0.50 : 0.25;
            for (let e of GameEngine.enemies) {
                if (!e.alive) continue;
                let progress = Math.min(1, e.distanceTraveled / totalLen);
                let slowVal = 1 - (progress * maxSlow); e.gojoSlow = slowVal; e.infinityTint = progress;
            }
        }

        if (tower.fakeRed) {
            tower.fakeRed.life -= dt; tower.fakeRed.rot += dt * 4;
            if (tower.fakeRed.life <= 0) { GameEngine.explosions.push({ x: tower.x, y: tower.y - 20, radius: 0, maxRadius: 80, life: 0.3, maxLife: 0.3, color: '#ff0000' }); tower.fakeRed = null; }
        }
        if (tower.reversalRed) {
            tower.reversalRed.life -= dt; tower.reversalRed.rot += dt * 4;
            if (tower.reversalRed.life <= 0) {
                let rx = tower.reversalRed.x, ry = tower.reversalRed.y;
                GameEngine.explosions.push({ x: rx, y: ry, radius: 0, maxRadius: 150, life: 0.4, maxLife: 0.4, color: '#ff0000' });
                const nearby = GameEngine.enemyGrid.query(rx, ry, 150);
                for (let e of nearby) { if (e.alive && Utils.distance(rx, ry, e.x, e.y) < 150) { let dmg = e.takeDamage(tower.stats.damage * 20, { isMagic: true, canHitLead: true }); tower.damageDealt += dmg; e.applySlow(0.0, 3.0, false); } }
                tower.reversalRed = null;
            }
        }

        if (tower.maxBlue) {
            tower.maxBlue.life -= dt; tower.maxBlue.angle += dt * 4; 
            let mx = tower.x + Math.cos(tower.maxBlue.angle) * 150; let my = tower.y + Math.sin(tower.maxBlue.angle) * 150;
            tower.maxBlue.x = mx; tower.maxBlue.y = my;
            const nearby = GameEngine.enemyGrid.query(mx, my, 150);
            for (let e of nearby) {
                if (!e.alive) continue; let dx = mx - e.x; let dy = my - e.y; let dist = Math.hypot(dx, dy);
                if (dist > 1) { e.offsetX += dx * 0.1; e.offsetY += dy * 0.1; }
                let dmg = e.takeDamage(tower.stats.damage * dt * 5, { isMagic: true, canHitLead: true }); tower.damageDealt += dmg;
            }
            if (tower.maxBlue.life <= 0) {
                GameEngine.explosions.push({ x: mx, y: my, radius: 0, maxRadius: 200, life: 0.5, maxLife: 0.5, color: '#0000ff' });
                for (let e of nearby) { if (!e.alive) continue; let dmg = e.takeDamage(tower.stats.damage * 50, { isMagic: true, canHitLead: true }); tower.damageDealt += dmg; }
                tower.maxBlue = null;
            }
        }

        if (tower.blueWells && tower.blueWells.length > 0) {
            for (let i = tower.blueWells.length - 1; i >= 0; i--) {
                let w = tower.blueWells[i]; w.life -= dt; w.rot += dt * 10;
                const nearby = GameEngine.enemyGrid.query(w.x, w.y, w.radius); let pullHits = 0;
                for (let e of nearby) {
                    if (pullHits >= w.maxHits) break; if (!e.alive) continue;
                    let dx = w.x - e.x; let dy = w.y - e.y; let dist = Math.hypot(dx, dy);
                    if (dist < w.radius && dist > 1) { let pullStrength = 20 * dt * (w.life / w.maxLife); e.offsetX += dx * pullStrength; e.offsetY += dy * pullStrength; e.distanceTraveled += (w.targetDist - e.distanceTraveled) * 0.15; pullHits++; }
                }
                if (w.life <= 0) {
                    tower.blueWells.splice(i, 1); GameEngine.explosions.push({ x: w.x, y: w.y, radius: 0, maxRadius: w.radius, life: 0.3, maxLife: 0.3, color: '#0000ff' });
                    let explosionHits = 0;
                    for (let e of nearby) { if (explosionHits >= w.maxHits) break; if (!e.alive) continue; if (Utils.distance(w.x, w.y, e.x, e.y) < w.radius) { let dmg = e.takeDamage(tower.stats.damage * 5, { isMagic: true, canHitLead: true }); tower.damageDealt += dmg; e.offsetX = 0; e.offsetY = 0; explosionHits++; } }
                }
            }
        }
    },
    draw(ctx, tower, isPreview) {
        if (tower.reverseWell) { this.drawMaxBlueVFX(ctx, tower.reverseWell.x, tower.reverseWell.y, 150); }
        if (tower.fakeRed) { this.drawRedTyphoonVFX(ctx, tower.x, tower.y - 20, tower.fakeRed.rot, 50); }
        if (tower.reversalRed) { this.drawRedTyphoonVFX(ctx, tower.reversalRed.x, tower.reversalRed.y, tower.reversalRed.rot, 80); }
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

        if (!isPreview && tower.blueWells) {
            for (let w of tower.blueWells) {
                let alpha = Math.min(1, w.life / w.maxLife);
                ctx.globalAlpha = alpha * 0.6;
                const grad = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.radius);
                grad.addColorStop(0, 'rgba(0, 0, 0, 1)'); grad.addColorStop(0.5, 'rgba(0, 50, 255, 0.8)'); grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = alpha; ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 3;
                for(let i=0; i<4; i++) { ctx.beginPath(); let startAng = w.rot + (i * Math.PI / 2); ctx.arc(w.x, w.y, 10 + (i*5), startAng, startAng + Math.PI * 1.5); ctx.stroke(); }
                ctx.globalAlpha = 1;
            }
        }
        if (!isPreview && tower.stats.limitlessPassive) {
            let auraColor = tower.phase === 2 ? '#ff00ff' : '#a253ff'; ctx.globalAlpha = 0.3; ctx.strokeStyle = auraColor; ctx.lineWidth = 2;
            let t = performance.now() / 1000;
            for(let i=0; i<3; i++) { ctx.beginPath(); ctx.arc(tower.x, tower.y, 22 + (i*4), t + (i * Math.PI / 3), t + (i * Math.PI / 3) + Math.PI * 1.5); ctx.stroke(); }
            ctx.globalAlpha = 1;
        }
        
        // PRO FIX: Apply rotation so Gojo faces his target!
        const baseAsset = Assets.get(`tower_gojo_base`);
        if (baseAsset && baseAsset.loaded) {
            ctx.save(); 
            ctx.translate(tower.x, tower.y);
            if (!isPreview && !tower.stats.isStaticRotation) {
                ctx.rotate(tower.angle + Math.PI / 2); // Rotate to face target
            }
            drawImageCentered(ctx, baseAsset, 45);
            ctx.restore();
        } else {
            ctx.save(); ctx.translate(tower.x, tower.y);
            if (!isPreview && !tower.stats.isStaticRotation) ctx.rotate(tower.angle + Math.PI / 2);
            ctx.fillStyle = tower.phase === 2 ? '#ff00ff' : '#9b59b6'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(0, 2, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#00ffff'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
    },
    drawMaxBlueVFX(ctx, x, y, baseR) {
        let t = performance.now() / 1000; let pulse = 1 + Math.sin(t * 4) * 0.15; let r = baseR * pulse; let points = 16;
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
    drawRedTyphoonVFX(ctx, x, y, rot, baseR) {
        let t = performance.now() / 1000; let pulse = 1 + Math.sin(t * 5) * 0.15; let r = baseR * pulse;
        ctx.save(); ctx.translate(x, y); ctx.globalCompositeOperation = 'screen';
        for(let i=0; i<3; i++) {
            ctx.save(); ctx.rotate(rot + (i * Math.PI * 2 / 3)); ctx.shadowBlur = 15; ctx.shadowColor = 'rgba(255, 0, 43, 0.8)';
            const grad = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r); grad.addColorStop(0, 'rgba(255, 255, 255, 0)'); grad.addColorStop(0.5, 'rgba(255, 0, 43, 0.6)'); grad.addColorStop(0.9, 'rgba(255, 255, 255, 0.8)'); grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.strokeStyle = grad; ctx.lineWidth = r * 0.4; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 0.6); ctx.stroke(); ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 40; ctx.shadowColor = '#ffffff';
        const coreGrad = ctx.createRadialGradient(0,0,0, 0,0, r * 0.5); coreGrad.addColorStop(0, '#ffffff'); coreGrad.addColorStop(0.5, '#ff002b'); coreGrad.addColorStop(1, 'rgba(255, 0, 43, 0)');
        ctx.fillStyle = coreGrad; ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.restore();
    },
    drawHollowPurpleVFX(ctx, x, y, progress) {
        let t = performance.now() / 1000; let trembleX = (Math.random() - 0.5) * 4; let trembleY = (Math.random() - 0.5) * 4;
        ctx.save(); ctx.translate(x + trembleX, y + trembleY); ctx.globalCompositeOperation = 'screen';
        let shroudR = 100 + Math.sin(t * 2) * 20;
        const shroudGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, shroudR); shroudGrad.addColorStop(0, `rgba(148, 0, 211, 0.9)`); shroudGrad.addColorStop(0.7, `rgba(75, 0, 130, 0.5)`); shroudGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shroudGrad; ctx.beginPath(); ctx.arc(0, 0, shroudR * progress, 0, Math.PI * 2); ctx.fill();
        let ringR = 80 + Math.sin(t * 3) * 10; ctx.shadowBlur = 30; ctx.shadowColor = 'rgba(148, 0, 211, 0.8)'; ctx.strokeStyle = `rgba(255, 255, 255, 0.5)`; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(0, 0, ringR * progress, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.random() * 0.8})`; ctx.lineWidth = 2;
        for(let i=0; i<3; i++) { let ang = t * 10 + (i * Math.PI * 2 / 3); ctx.beginPath(); ctx.moveTo(0, 0); let len = 60 * progress; let x1 = Math.cos(ang) * len * 0.5; let y1 = Math.sin(ang) * len * 0.5; let x2 = Math.cos(ang + Math.random()*0.5) * len; let y2 = Math.sin(ang + Math.random()*0.5) * len; ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
        ctx.globalCompositeOperation = 'source-over'; let eyeR = 40 * progress;
        const eyeGrad = ctx.createRadialGradient(0,0,0, 0,0, eyeR); eyeGrad.addColorStop(0, '#ffffff'); eyeGrad.addColorStop(0.5, '#e6beff'); eyeGrad.addColorStop(0.8, 'rgba(148, 0, 211, 0.8)'); eyeGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = eyeGrad; ctx.beginPath(); ctx.arc(0, 0, eyeR, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    },
    ability(tower, engine) {
        if (tower.phase === 2) {
            engine.log("Reversal: Red!"); let target = null; let bestVal = -Infinity;
            for (let e of engine.enemies) { if (!e.alive) continue; if (e.distanceTraveled > bestVal) { bestVal = e.distanceTraveled; target = e; } }
            let x = target ? target.x : tower.x; let y = target ? target.y : tower.y;
            tower.reversalRed = { x, y, life: 1.5, maxLife: 1.5, rot: 0 }; return;
        }
        engine.log("Reversal: Re... huh?"); tower.fakeRed = { life: 1.5, maxLife: 1.5, rot: 0 };
    },
    ability2(tower, engine) {
        if (tower.phase === 2) {
            engine.log("Hollow Purple... Select Target!");
            tower.isHollowCharging = true;
            tower.hollowChargeTime = 0;
            return;
        }
        engine.log("Maximum: Blue!"); tower.maxBlue = { life: 3.14, maxLife: 3.14, angle: 0, x: tower.x, y: tower.y };
    },
    ability3(tower, engine) {
        engine.log("Domain Expansion: 0.2 Second Void!");
        for (let e of engine.enemies) { if (!e.alive) continue; if (!e.data.isBAD) { e.applySlow(0.0, 10.0, false); } }
        engine.explosions.push({ x: 450, y: 300, radius: 0, maxRadius: 900, life: 0.8, maxLife: 0.8, color: '#ff00ff' });
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        let wellCount = tower.phase === 2 ? 2 : 1;
        for (let i = 0; i < wellCount; i++) {
            let offsetX = wellCount > 1 ? (i === 0 ? -15 : 15) : 0; let offsetY = wellCount > 1 ? (i === 0 ? -15 : 15) : 0;
            tower.blueWells = tower.blueWells || [];
            tower.blueWells.push({ x: target.x + offsetX, y: target.y + offsetY, targetDist: target.distanceTraveled, life: 0.4, maxLife: 0.4, radius: 50 + (tower.stats.range * 0.5), rot: 0, maxHits: tower.stats.pierce });
        }
    }
};