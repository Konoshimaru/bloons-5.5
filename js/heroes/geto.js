import { GameEngine } from '../engine.js';
import { Utils, drawImageCentered } from '../utils.js';
import Assets from '../assets.js';
import { AudioEngine } from '../audio.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config.js';

const _UZUMAKI_FACE_TYPES = ['screaming', 'cyclops', 'hollow'];

class _UzumakiSpirit {
    constructor(cx, cy, maxDim) { this.reset(cx, cy, maxDim, true); }
    reset(cx, cy, maxDim, initialSpread = false) {
        this.angle = Math.random() * Math.PI * 2;
        this.radius = initialSpread ? Math.random() * maxDim * 0.55 : (0.85 + Math.random() * 0.15) * maxDim;
        this.size = 6 + Math.random() * 6;
        this.faceType = _UZUMAKI_FACE_TYPES[Math.floor(Math.random() * 3)];
        this.speedMultiplier = 0.85 + Math.random() * 0.55;
        this.opacity = 0.75 + Math.random() * 0.25;
        this.color = Math.random() > 0.15 ? '#4b5563' : '#1f2937';
        this.active = true;
    }
    update(dt, pullSpeed) {
        if (!this.active) return;
        this.angle += 0.05 * this.speedMultiplier * (dt * 60);
        this.radius -= pullSpeed * (dt * 60);
        if (this.radius < 8) this.active = false;
    }
    draw(ctx, cx, cy) {
        if (!this.active) return;
        const segments = 5, spine = [], gravityIntensity = 140 / (this.radius + 30);
        const stretch = 1.0 + gravityIntensity * 0.6;
        const angleStep = 0.07 * this.speedMultiplier * stretch;
        const radiusStep = 3 * stretch;
        for (let i = 0; i < segments; i++) {
            const r = this.radius + i * radiusStep, a = this.angle - i * angleStep;
            spine.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
        }
        const left = [], right = [];
        for (let i = 0; i < spine.length; i++) {
            let dx, dy;
            if (i === 0) { dx = spine[1].x - spine[0].x; dy = spine[1].y - spine[0].y; } 
            else if (i === spine.length - 1) { dx = spine[i].x - spine[i - 1].x; dy = spine[i].y - spine[i - 1].y; } 
            else { dx = spine[i + 1].x - spine[i - 1].x; dy = spine[i + 1].y - spine[i - 1].y; }
            const len = Math.hypot(dx, dy) || 1;
            const nx = -(dy / len), ny = (dx / len);
            const t = i / (spine.length - 1);
            let w = t < 0.15 ? this.size * 0.45 * Math.sin((t / 0.15) * Math.PI / 2) : this.size * 0.45 * Math.cos(((t - 0.15) / 0.85) * Math.PI / 2);
            w /= Math.sqrt(stretch);
            left.push({ x: spine[i].x + nx * w, y: spine[i].y + ny * w });
            right.push({ x: spine[i].x - nx * w, y: spine[i].y - ny * w });
        }
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(spine[0].x, spine[0].y);
        for (const p of left) ctx.lineTo(p.x, p.y);
        for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        const facePt = spine[Math.min(1, spine.length - 1)];
        const faceAngle = Math.atan2(spine[2].y - spine[0].y, spine[2].x - spine[0].x) + Math.PI;
        ctx.save();
        ctx.translate(facePt.x, facePt.y);
        ctx.rotate(faceAngle);
        ctx.fillStyle = '#000000';
        const fx = this.size * 0.12;
        if (this.faceType === 'cyclops') {
            ctx.beginPath(); ctx.ellipse(fx, 0, this.size * 0.11, this.size * 0.16, 0, 0, Math.PI * 2); ctx.fill();
        } else if (this.faceType === 'screaming') {
            ctx.beginPath();
            ctx.arc(fx + this.size * 0.08, -this.size * 0.1, this.size * 0.07, 0, Math.PI * 2);
            ctx.arc(fx + this.size * 0.08, this.size * 0.1, this.size * 0.07, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath(); ctx.ellipse(fx - this.size * 0.08, 0, this.size * 0.08, this.size * 0.16, 0, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(fx + this.size * 0.08, -this.size * 0.09, this.size * 0.08, 0, Math.PI * 2);
            ctx.arc(fx + this.size * 0.08, this.size * 0.09, this.size * 0.08, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
        ctx.restore();
    }
}

class _StretchedHand {
    constructor(startX, startY, angle) {
        this.x = startX; this.y = startY; this.angle = angle;
        this.length = 20 + Math.random() * 30;
        this.maxLength = 260 + Math.random() * 140;
        this.speed = 500 + Math.random() * 400;
        this.thickness = 5 + Math.random() * 7;
        this.waveOffset = Math.random() * 100;
        this.waveSpeed = 12 + Math.random() * 6;
        this.opacity = 1.0;
    }
    update(dt) {
        this.length += this.speed * dt;
        this.waveOffset += dt * this.waveSpeed;
        if (this.length > this.maxLength) this.opacity -= dt * 6.5;
        return this.opacity > 0;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = '#020203'; ctx.strokeStyle = '#020203';
        ctx.lineWidth = this.thickness;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.globalAlpha = this.opacity;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const c1 = Math.sin(this.waveOffset) * 20, c2 = Math.cos(this.waveOffset) * -20;
        ctx.bezierCurveTo(this.length * 0.3, c1, this.length * 0.6, c2, this.length, 0);
        ctx.stroke();
        ctx.save();
        ctx.translate(this.length, 0);
        ctx.beginPath(); ctx.arc(0, 0, this.thickness * 1.3, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 5; i++) {
            const fingerAngle = (i - 2) * 0.4;
            ctx.save();
            ctx.rotate(fingerAngle);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(this.thickness * 2, -this.thickness, this.thickness * 5, 0);
            ctx.lineWidth = this.thickness * 0.35;
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
        ctx.restore();
    }
}

export default {
    stats: {
        name: "Geto", cost: 720, range: 40, fireRate: 1.2, damage: 1, pierce: 2,
        projectileSpeed: 0, lifespan: 0.4, desc: "Cursed Spirit Manipulator. Captures curses and unleashes them as resentment.",
        dmgType: 'magic', projectileType: 'squid', hitRadius: 12, isHero: true, maxLevel: 20, scale: 1.3
    },
    xpTable: [500, 1200, 2500, 4500, 7000, 10000, 14000, 19000, 25000, 32000, 40000, 50000, 62000, 75000, 90000, 110000, 130000, 160000, 200000, 250000],
    levels: {
        1: [], 2: [{ stat: "fireRate", amount: -0.2 }], 3: [{ stat: "isAbility", amount: true }],
        4: [{ stat: "range", amount: 10 }], 5: [{ stat: "damage", amount: 1 }, { stat: "pierce", amount: 1 }],
        6: [{ stat: "fireRate", amount: -0.15 }, { stat: "slowOnHit", amount: true }],
        7: [{ stat: "wormEvery8th", amount: true }], 8: [{ stat: "range", amount: 10 }, { stat: "damage", amount: 1 }],
        9: [{ stat: "pierce", amount: 1 }, { stat: "fireRate", amount: -0.1 }],
        10: [{ stat: "isAbility2", amount: true }], 11: [{ stat: "damage", amount: 1 }, { stat: "range", amount: 10 }],
        12: [{ stat: "twinSquid", amount: true }], 13: [{ stat: "pierce", amount: 1 }, { stat: "canSeeCamo", amount: true }],
        14: [{ stat: "wormEvery5th", amount: true }, { stat: "wormDmgBonus", amount: 2 }],
        15: [{ stat: "damage", amount: 1 }], 16: [{ stat: "fireRate", amount: -0.05 }],
        17: [{ stat: "fireRate", amount: -0.1 }, { stat: "pierce", amount: 1 }],
        18: [{ stat: "moabDmgBonus", amount: 2 }, { stat: "wormStun", amount: true }],
        19: [{ stat: "damage", amount: 1 }, { stat: "range", amount: 5 }],
        20: [{ stat: "uzumakiUpgraded", amount: true }]
    },
    update(tower, dt) {
        if (!tower.shotCounter) tower.shotCounter = 0;
        if (!tower.squids) tower.squids = [];
        if (tower.captureBuffTime > 0) {
            tower.captureBuffTime -= dt;
            if (tower.captureBuffTime <= 0) tower.captureBuffTime = 0;
        }
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
        for (let i = tower.squids.length - 1; i >= 0; i--) {
            let s = tower.squids[i];
            s.life -= dt;
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
                    // PRO FIX: Guard against -1 and NaN
                    if (!isNaN(dmg) && dmg !== -1) tower.damageDealt += dmg;
                    s.hitEnemies.add(e);
                    if (s.slowOnHit) e.applySlow(0.85, 0.5, false);
                    if (s.isWorm && s.wormStun && !e.data.isMoab) e.applySlow(0.0, 0.3, false);
                    s.pierce--;
                    if (s.pierce <= 0 && !s.isWorm) {
                        tower.squids.splice(i, 1);
                        break;
                    }
                }
            }
if (s.life <= 0 || s.x < -100 || s.x > CANVAS_WIDTH + 100 || s.y < -100 || s.y > CANVAS_HEIGHT + 100) {                tower.squids.splice(i, 1);
            }
        }
        if (tower.uzumaki) {
            const u = tower.uzumaki;
            if (u.phase === 'condensing') {
                u.condenseTime -= dt;
                const pullSpeed = 1.5 + (1 - Math.max(u.condenseTime, 0) / u.condenseDuration) * 9;
                for (const spirit of u.spirits) spirit.update(dt, pullSpeed);
                if (u.condenseTime <= 0) {
                    u.phase = 'firing';
                    u.fireTime = u.fireDuration;
                    GameEngine.log(u.isUpgraded ? "Maximum Output: Uzumaki!" : "Maximum: Uzumaki!");
                }
            } else if (u.phase === 'firing') {
                u.fireTime -= dt;
                const dpsMult = u.isUpgraded ? 12 : 8;
                const moabDps = u.isUpgraded ? 60 : 25;
                for (let e of GameEngine.enemies) {
                    if (!e.alive) continue;
                    let dmg = e.takeDamage(tower.stats.damage * dpsMult * dt, { isMagic: true, canHitLead: true });
                    tower.damageDealt += dmg;
                    if (e.data.isMoab) {
                        let moabDmg = e.takeDamage(moabDps * dt, { isMagic: true, canHitLead: true });
                        tower.damageDealt += moabDmg;
                    }
                }
                const progress = 1 - Math.max(u.fireTime, 0) / u.fireDuration;
                if (progress > 0.05 && progress < 0.9 && Math.random() > 0.45) {
                    const spread = (Math.random() - 0.5) * 0.7;
                    u.hands.push(new _StretchedHand(tower.x, tower.y, u.angle + spread));
                }
                for (let i = u.hands.length - 1; i >= 0; i--) {
                    if (!u.hands[i].update(dt)) u.hands.splice(i, 1);
                }
                if (u.fireTime <= 0) {
                    if (u.isUpgraded) tower.ceField = { life: 4.0, maxLife: 4.0 };
                    tower.uzumaki = null;
                }
            }
        }
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
        if (tower.uzumaki) this.drawUzumakiVFX(ctx, tower, tower.uzumaki);
        if (tower.ceField) this.drawCEFieldVFX(ctx, tower);
        if (tower.isCapturing && tower.captureTarget) {
            this.drawCaptureVFX(ctx, tower.x, tower.y, tower.captureTarget.x, tower.captureTarget.y, tower.captureTime / 1.5);
        }
        if (!isPreview && tower.squids) {
            for (let s of tower.squids) {
                if (s.isWorm) this.drawWormVFX(ctx, s.x, s.y, s.angle);
                else this.drawSquidVFX(ctx, s.x, s.y, s.angle);
            }
        }
        if (!isPreview && tower.captureBuffTime > 0) {
            let t = performance.now() / 1000;
            ctx.globalAlpha = 0.5 * (tower.captureBuffTime / 5.0);
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(tower.x, tower.y, 18 + Math.sin(t * 8) * 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        const baseAsset = Assets.get('tower_geto_base');
        if (baseAsset && baseAsset.loaded) {
            ctx.save();
            ctx.translate(tower.x, tower.y);
            if (!isPreview && !tower.stats.isStaticRotation) ctx.rotate(tower.angle + Math.PI / 2);
            drawImageCentered(ctx, baseAsset, 45);
            ctx.restore();
        } else {
            ctx.save();
            ctx.translate(tower.x, tower.y);
            if (!isPreview && !tower.stats.isStaticRotation) ctx.rotate(tower.angle + Math.PI / 2);
            ctx.fillStyle = '#3a0060';
            ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath(); ctx.arc(0, 2, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
    },
    drawSquidVFX(ctx, x, y, angle) {
        const squidAsset = Assets.get('proj_squid');
        if (squidAsset && squidAsset.loaded) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            drawImageCentered(ctx, squidAsset, 24);
            ctx.restore();
            return;
        }
        let t = performance.now() / 1000;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(75, 0, 130, 0.8)';
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
        grad.addColorStop(0, '#a020f0');
        grad.addColorStop(0.6, '#4a0080');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#a020f0'; ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            let a = (i / 4) * Math.PI * 2 + t * 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
            ctx.stroke();
        }
        ctx.shadowBlur = 0; ctx.restore();
    },
    drawWormVFX(ctx, x, y, angle) {
        const wormAsset = Assets.get('proj_worm');
        if (wormAsset && wormAsset.loaded) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            drawImageCentered(ctx, wormAsset, 50);
            ctx.restore();
            return;
        }
        let t = performance.now() / 1000;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.globalCompositeOperation = 'screen';
        ctx.shadowBlur = 20; ctx.shadowColor = 'rgba(0, 255, 200, 0.8)';
        for (let i = 0; i < 6; i++) {
            let offset = Math.sin(t * 6 + i * 0.5) * 3;
            let hue = (i * 60 + t * 100) % 360;
            const grad = ctx.createRadialGradient(i * 9 - 22, offset, 0, i * 9 - 22, offset, 11);
            grad.addColorStop(0, `hsla(${hue}, 100%, 70%, 1)`);
            grad.addColorStop(0.5, `hsla(${hue}, 80%, 40%, 0.6)`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(i * 9 - 22, offset, 11, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0; ctx.restore();
    },
    drawUzumakiVFX(ctx, tower, u) {
        if (u.phase === 'condensing') {
            for (const spirit of u.spirits) spirit.draw(ctx, tower.x, tower.y);
        } else if (u.phase === 'firing') {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.shadowBlur = 30; ctx.shadowColor = u.isUpgraded ? 'rgba(255, 0, 100, 0.9)' : 'rgba(128, 0, 255, 0.9)';
            const grad = ctx.createRadialGradient(tower.x, tower.y, 0, tower.x, tower.y, 22);
            grad.addColorStop(0, 'rgba(255,255,255,0.9)');
            grad.addColorStop(0.5, u.isUpgraded ? 'rgba(255,0,100,0.6)' : 'rgba(128,0,255,0.6)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(tower.x, tower.y, 22, 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
            ctx.restore();
            for (const hand of u.hands) hand.draw(ctx);
        }
    },
    drawCEFieldVFX(ctx, tower) {
        let t = performance.now() / 1000;
        let alpha = (tower.ceField.life / tower.ceField.maxLife) * 0.25;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = `rgba(150, 0, 255, ${alpha})`;
        ctx.fillRect(0, 0, 1000, 700);
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
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -t * 30;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        let mx = (x1 + x2) / 2 + Math.sin(t * 3) * 20;
        let my = (y1 + y2) / 2 + Math.cos(t * 3) * 20;
        ctx.quadraticCurveTo(mx, my, x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
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
        if (tower.isCapturing) { engine.log("Already capturing."); return; }
        let target = null, bestValue = -Infinity;
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
        let isUpgraded = tower.stats.uzumakiUpgraded;
        engine.log("Charging Maximum: Uzumaki...");
        const angle = tower.angle || 0;
        const chargeRadius = 90, spiritCount = 90, spirits = [];
        for (let i = 0; i < spiritCount; i++) {
            spirits.push(new _UzumakiSpirit(tower.x, tower.y, chargeRadius));
        }
        tower.uzumaki = {
            phase: 'condensing', condenseDuration: 1.5, condenseTime: 1.5,
            fireDuration: isUpgraded ? 6.0 : 4.0, fireTime: 0,
            angle: angle, isUpgraded: isUpgraded, spirits: spirits, hands: []
        };
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        if (!tower.squids) tower.squids = [];
        tower.shotCounter = (tower.shotCounter || 0) + 1;
        let actualDmg = damage;
        if (tower.captureBuffTime > 0) actualDmg = Math.floor(actualDmg * 1.5);
        let moabBonus = tower.stats.moabDmgBonus || 0;
        let slowOnHit = !!tower.stats.slowOnHit;
        let wormStun = !!tower.stats.wormStun;
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
                hitEnemies: new Set(), isWorm: true, angle: Math.atan2(vy, vx),
                wormStun: wormStun, slowOnHit: false
            });
        } else {
            let squidCount = tower.stats.twinSquid ? 2 : 1;
            let baseAngle = Math.atan2(target.y - tower.y, target.x - tower.x);
            for (let i = 0; i < squidCount; i++) {
                let spread = squidCount > 1 ? (i === 0 ? -0.2 : 0.2) : 0;
                let a = baseAngle + spread;
                let speed = 450;
                tower.squids.push({
                    x: tower.x, y: tower.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                    speed: speed, life: 1.0, dmg: actualDmg + moabBonus, pierce: tower.stats.pierce,
                    hitRadius: 12, hitEnemies: new Set(), isWorm: false, angle: a,
                    slowOnHit: slowOnHit, wormStun: false
                });
            }
        }
    }
};