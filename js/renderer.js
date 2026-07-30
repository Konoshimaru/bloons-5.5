// js/renderer.js
import { Config, RANGE_SCALE, HeroStats } from './config.js';
import { TowerStats } from './towers/index.js';
import { Utils } from './utils.js';
import { Tower } from './tower.js';
import { CutsceneManager } from './cutscene.js';
import { KnightEnemy } from './bosses/knight.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GLOBAL_SCALE } from './constants.js';
import { BossHealthBarHandler } from './BossHealthBarHandler.js';
import { applyBossEffects } from './input.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

const PLACEMENT_RADIUS = 18;
const TOWER_HIT_RADIUS_PADDING = 4;
const TOWER_SELECTION_LINE_WIDTH = 3;
const TOWER_SELECTION_FILL_ALPHA = 0.15;
const TOWER_RANGE_FILL_COLOR = 'rgba(230, 126, 34, 1)';
const TOWER_OUT_OF_BOUNDS_COLOR = 'rgba(255, 0, 0, 0.2)';
const TOWER_AFFORDABLE_COLOR = 'rgba(255, 255, 255, 0.2)';
const TOWER_OVERLAP_COLOR = 'red';
const EXPLOSION_INNER_COLOR = '#f1c40f';
const LEAK_FLASH_COLOR = '#e74c3c';
const LEAK_FLASH_LINE_WIDTH = 10;

let _engineInstance = null;

const _worldCanvas = document.createElement('canvas');
_worldCanvas.width = CANVAS_WIDTH;
_worldCanvas.height = CANVAS_HEIGHT;
const _worldCtx = _worldCanvas.getContext('2d');

export const Renderer = {
    render(engine, dt) {
        _engineInstance = engine; 
        const ctx = engine.ctx;
        const wctx = _worldCtx; 
        
        if (engine.isNight === undefined) engine.isNight = false;
        if (engine.nightAlpha === undefined) engine.nightAlpha = 0;
        
        const targetNightAlpha = engine.isNight ? 1 : 0;
        engine.nightAlpha += (targetNightAlpha - engine.nightAlpha) * Math.min(1, (dt || 0.016) * 2);

        if (engine.gameState === 'menu' || !engine.map) {
            this._drawMainMenuScenery(ctx, engine, dt);
            // FIX: Draw dev overlay on main menu too!
            this._drawDevOverlay(ctx, engine, dt);
            return;
        }

        if (engine.canvas) {
            engine.canvas.style.cursor = (engine.gameState === 'playing') ? 'none' : 'auto';
        }

        this._setupContext(ctx);
        this._setupContext(wctx);
        wctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        let camOffset = CutsceneManager.cameraOffsetX || 0;
        if (camOffset !== 0) {
            wctx.fillStyle = '#000000';
            wctx.fillRect(0, 0, camOffset, CANVAS_HEIGHT);
            wctx.save();
            wctx.translate(camOffset,0);
        }

        engine.map.draw(wctx);
        this._drawAcidPools(wctx, engine); 
        this._drawExplosions(wctx, engine.explosions);
        this._drawEntities(wctx, engine);
        this._drawFloatingTexts(wctx, engine); 
        this._drawPlacementPreview(wctx, engine);
        this._drawSelection(wctx, engine);
        this._drawLeakFlash(wctx, engine);

        if (Config.data.showHitboxes) {
            this._drawHitboxes(wctx, engine);
        }

        if (camOffset !== 0) wctx.restore();
        
        CutsceneManager.drawBalls(wctx); 
        
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        let boss = BossHealthBarHandler.activeBosses.length > 0 ? BossHealthBarHandler.activeBosses[0].enemy : null;
        
        if (boss && boss.warningLineActive) {
            ctx.drawImage(_worldCanvas, 0, 0);
            
            let lineAlpha = 1.0 - (boss.stateTimer / 2.0); 
            ctx.strokeStyle = `rgba(255, 50, 50, ${lineAlpha})`;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(0, 360);
            ctx.lineTo(CANVAS_WIDTH, 360);
            ctx.stroke();
            
            ctx.strokeStyle = `rgba(231, 76, 60, ${lineAlpha * 0.9})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 360);
            ctx.lineTo(CANVAS_WIDTH, 360);
            ctx.stroke();
        } else if (boss && (boss.screenSplitActive || boss.currentOffset !== 0)) {
            let offset = boss.currentOffset;
            
            ctx.drawImage(_worldCanvas, 0, 0, CANVAS_WIDTH, 360, offset, 0, CANVAS_WIDTH, 360);
            ctx.drawImage(_worldCanvas, 0, 360, CANVAS_WIDTH, 360, -offset, 360, CANVAS_WIDTH, 360);
            
            if (Math.abs(offset) > 10) {
                ctx.fillStyle = 'rgba(0,0,0,0.8)';
                ctx.fillRect(0, 355, CANVAS_WIDTH, 10);
                ctx.strokeStyle = 'rgba(231, 76, 60, 0.5)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, 360);
                ctx.lineTo(CANVAS_WIDTH, 360);
                ctx.stroke();
            }
        } else {
            ctx.drawImage(_worldCanvas, 0, 0);
        }
        
        if (camOffset !== 0) {
            ctx.save();
            ctx.translate(camOffset, 0);
        }
        CutsceneManager.draw(ctx);
        if (camOffset !== 0) ctx.restore();
        
        BossHealthBarHandler.draw(ctx);
        this._drawCursor(ctx, engine);
        
        // FIX: Draw Dev Overlay last so it sits on top of everything during gameplay!
        this._drawDevOverlay(ctx, engine, dt);
    },

    _drawDevOverlay(ctx, engine, rawDt) {
        if (!engine.showDevOverlay) return;

        // Calculate FPS (smoothened slightly)
        const fps = Math.round(1 / (rawDt || 0.016));
        
        // FIX: Safely gather stats with fallbacks so it doesn't crash on the main menu!
        const activeProjectiles = (engine.projectilePool && engine.projectilePool.active) ? engine.projectilePool.active.length : 0;
        const maxProjectiles = (engine.projectilePool) ? engine.projectilePool.size : 0;
        const activeEnemies = engine.enemies ? engine.enemies.length : 0;
        const activeTowers = engine.towers ? engine.towers.length : 0;
        const activeParticles = (engine.particlePool && engine.particlePool.active) ? engine.particlePool.active.length : 0;
        const activeExplosions = engine.explosions ? engine.explosions.length : 0;
        const activeTexts = engine.floatingTexts ? engine.floatingTexts.length : 0;
        const currentWave = engine.waveManager ? engine.waveManager.currentWave : 0;

        const textX = 10;
        const textY = 20;
        const lineHeight = 18;
        
        ctx.save();
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        // Background box
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(textX - 5, textY - 5, 220, (lineHeight * 9) + 10);
        
        // Helper to draw text lines
        const drawLine = (label, value, color, y) => {
            ctx.fillStyle = '#bdc3c7';
            ctx.fillText(label, textX, y);
            ctx.fillStyle = color;
            ctx.fillText(value, textX + 90, y);
        };

        drawLine('FPS:', `${fps}`, fps >= 50 ? '#2ecc71' : (fps >= 30 ? '#f1c40f' : '#e74c3c'), textY);
        drawLine('Wave:', `${currentWave}`, '#f1c40f', textY + lineHeight);
        drawLine('Towers:', `${activeTowers}`, '#3498db', textY + lineHeight * 2);
        drawLine('Enemies:', `${activeEnemies}`, '#e74c3c', textY + lineHeight * 3);
        
        // Turn orange if pool is near limit
        const projColor = activeProjectiles > maxProjectiles * 0.8 ? '#e67e22' : '#2ecc71';
        drawLine('Projectiles:', `${activeProjectiles} / ${maxProjectiles}`, projColor, textY + lineHeight * 4);
        
        drawLine('Particles:', `${activeParticles}`, '#9b59b6', textY + lineHeight * 5);
        drawLine('Explosions:', `${activeExplosions}`, '#e67e22', textY + lineHeight * 6);
        drawLine('Float Texts:', `${activeTexts}`, '#1abc9c', textY + lineHeight * 7);
        drawLine('Cash/Lives:', `$${Math.floor(engine.cash || 0)} / ${engine.lives || 0}`, '#ecf0f1', textY + lineHeight * 8);

        ctx.restore();
    },

    _drawAcidPools(ctx, engine) {
        if (!engine.acidPools) return;
        for (const pool of engine.acidPools) {
            if (!pool) continue;
            const alpha = Math.min(1, pool.life / 2.0); 
            ctx.globalAlpha = alpha;
            
            if (pool.isFoam) {
                ctx.fillStyle = '#ecf0f1'; 
            } else {
                ctx.fillStyle = '#2ecc71'; 
            }
            
            ctx.beginPath();
            ctx.arc(pool.x, pool.y, pool.radius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.globalAlpha = 1;
        }
    },

    _drawFloatingTexts(ctx, engine) {
        if (!engine.floatingTexts) return;
        for (const ft of engine.floatingTexts) {
            const alpha = Math.max(0, ft.life / ft.maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = ft.color || '#f1c40f';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.font = 'bold 20px Nunito, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeText(ft.text, ft.x, ft.y);
            ctx.fillText(ft.text, ft.x, ft.y);
        }
        ctx.globalAlpha = 1;
    },

    _drawCursor(ctx, engine) {
        if (engine.gameState !== 'playing') return;
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        
        let cx = engine.mouse.rawX !== undefined ? engine.mouse.rawX : engine.mouse.x;
        let cy = engine.mouse.rawY !== undefined ? engine.mouse.rawY : engine.mouse.y;

        let boss = BossHealthBarHandler.activeBosses.length > 0 ? BossHealthBarHandler.activeBosses[0].enemy : null;
        if (boss && (boss.screenSplitActive || boss.currentOffset !== 0)) {
            if (cy < 360) {
                cx += boss.currentOffset; 
            } else {
                cx -= boss.currentOffset; 
            }
        }
        
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + 10, cy + 15);
        ctx.lineTo(cx + 4, cy + 15);
        ctx.lineTo(cx + 2, cy + 20);
        ctx.lineTo(cx - 2, cy + 18);
        ctx.lineTo(cx - 4, cy + 13);
        ctx.lineTo(cx - 10, cy + 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    },

    _drawMainMenuScenery(ctx, engine, dt) {
        const dtSafe = dt || 0.016;
        let t = performance.now() / 1000;
        
        const date = new Date();
        const hours = date.getHours() + date.getMinutes() / 60;
        let phase = 'day';
        if (hours >= 5 && hours < 8) phase = 'dawn';
        else if (hours >= 8 && hours < 17) phase = 'day';
        else if (hours >= 17 && hours < 20) phase = 'dusk';
        else phase = 'night';

        const grad = ctx.createLinearGradient(0, 0, 0, 720);
        if (phase === 'dawn') { grad.addColorStop(0, '#ff7e5f'); grad.addColorStop(1, '#feb47b'); }
        else if (phase === 'day') { grad.addColorStop(0, '#4facfe'); grad.addColorStop(1, '#00f2fe'); }
        else if (phase === 'dusk') { grad.addColorStop(0, '#355C7D'); grad.addColorStop(0.5, '#6C5B7B'); grad.addColorStop(1, '#C06C84'); }
        else { grad.addColorStop(0, '#0F2027'); grad.addColorStop(1, '#203A43'); }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1280, 720);

        if (phase === 'night' || phase === 'dusk') {
            ctx.fillStyle = '#fff';
            for(let i=0; i<60; i++) {
                let sx = (i * 137) % 1280;
                let sy = (i * 97) % 400;
                let twinkle = Math.sin(t * 2 + i) * 0.5 + 0.5;
                ctx.globalAlpha = twinkle * (phase === 'night' ? 1 : 0.4);
                ctx.fillRect(sx, sy, 2, 2);
            }
            ctx.globalAlpha = 1;
        }

        let progress;
        if (hours > 6 && hours <= 18) progress = (hours - 6) / 12;
        else { let nightHours = hours <= 6 ? hours + 6 : hours - 18; progress = nightHours / 12; }
        let smX = progress * 1280;
        let smY = 150 - Math.sin(progress * Math.PI) * 50;
        
        if (phase === 'day' || phase === 'dawn') {
            ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
            ctx.beginPath(); ctx.arc(smX, smY, 75, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#FFD700';
            ctx.beginPath(); ctx.arc(smX, smY, 45, 0, Math.PI * 2); ctx.fill();
        }
        if (phase === 'night' || phase === 'dusk') {
            ctx.fillStyle = '#F4F6F0';
            ctx.beginPath(); ctx.arc(smX, smY, 35, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#e0e0e0';
            ctx.beginPath(); ctx.arc(smX + 10, smY - 5, 8, 0, Math.PI * 2); ctx.fill();
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        if (phase === 'night') ctx.fillStyle = 'rgba(100, 100, 120, 0.4)';
        for(let i=0; i<4; i++) {
            let cx = ((t * 15 + i * 350) % 1400) - 100;
            let cy = 100 + i * 50;
            ctx.beginPath();
            ctx.arc(cx, cy, 40, 0, Math.PI * 2); ctx.arc(cx + 40, cy + 10, 30, 0, Math.PI * 2); ctx.arc(cx - 30, cy + 10, 25, 0, Math.PI * 2);
            ctx.fill();
        }

        let hillColor1 = '#2ecc71', hillColor2 = '#27ae60';
        if (phase === 'dusk') { hillColor1 = '#2c3e50'; hillColor2 = '#22313f'; }
        if (phase === 'night') { hillColor1 = '#1a252f'; hillColor2 = '#16202a'; }
        
        ctx.fillStyle = hillColor1;
        ctx.beginPath(); ctx.moveTo(0, 600); ctx.quadraticCurveTo(640, 400, 1280, 600); ctx.lineTo(1280, 720); ctx.lineTo(0, 720); ctx.closePath(); ctx.fill();
        ctx.fillStyle = hillColor2;
        ctx.beginPath(); ctx.moveTo(0, 650); ctx.quadraticCurveTo(640, 500, 1280, 650); ctx.lineTo(1280, 720); ctx.lineTo(0, 720); ctx.closePath(); ctx.fill();

        let bounce = Math.sin(t * 2) * 5;
        let bx = 640, by = 520 + bounce;
        ctx.strokeStyle = '#795548'; ctx.lineWidth = 8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(bx + 40, by + 10); ctx.quadraticCurveTo(bx + 90, by - 20, bx + 70, by - 60); ctx.stroke();
        ctx.fillStyle = '#795548'; ctx.beginPath(); ctx.ellipse(bx, by + 10, 40, 45, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#D2B48C'; ctx.beginPath(); ctx.ellipse(bx, by + 20, 25, 30, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#795548'; ctx.beginPath(); ctx.arc(bx, by - 20, 35, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(bx - 30, by - 20, 12, 0, Math.PI * 2); ctx.arc(bx + 30, by - 20, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#D2B48C'; ctx.beginPath(); ctx.arc(bx - 30, by - 20, 6, 0, Math.PI * 2); ctx.arc(bx + 30, by - 20, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(bx, by - 15, 22, 20, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx - 10, by - 25, 8, 0, Math.PI * 2); ctx.arc(bx + 10, by - 25, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000';
        let eyeOffset = Math.sin(t * 0.5) * 2;
        ctx.beginPath(); ctx.arc(bx - 10 + eyeOffset, by - 25, 4, 0, Math.PI * 2); ctx.arc(bx + 10 + eyeOffset, by - 25, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by - 10, 10, 0.2, Math.PI - 0.2); ctx.stroke();

        ctx.fillStyle = '#8B4513'; ctx.fillRect(150, 550, 20, 100);
        ctx.fillStyle = phase === 'night' ? '#1a5c1a' : '#228B22';
        ctx.beginPath(); ctx.arc(160, 540, 50, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8B4513'; ctx.fillRect(1100, 580, 20, 80);
        ctx.fillStyle = phase === 'night' ? '#1a5c1a' : '#228B22';
        ctx.beginPath(); ctx.arc(1110, 570, 40, 0, Math.PI * 2); ctx.fill();

        if (!engine.menuClickables) engine.menuClickables = [];
        if (Math.random() < 0.01 && engine.menuClickables.length < 5) {
            engine.menuClickables.push({ x: Math.random() * 1080 + 100, y: -50, vx: (Math.random() - 0.5) * 20, vy: 50 + Math.random() * 30, r: 15, rot: 0, vrot: (Math.random() - 0.5) * 5 });
        }
        
        for (let i = engine.menuClickables.length - 1; i >= 0; i--) {
            let item = engine.menuClickables[i];
            item.x += item.vx * dtSafe; item.y += item.vy * dtSafe; item.rot += item.vrot * dtSafe;
            if (item.y > 720) { engine.menuClickables.splice(i, 1); continue; }
            ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(item.rot);
            ctx.fillStyle = '#FFDC00'; ctx.beginPath(); ctx.ellipse(0, 0, item.r, item.r * 0.6, Math.PI / 4, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#E6B800'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        }
    },

    _setupContext(ctx) {
        ctx.imageSmoothingEnabled = Config.data.smoothingEnabled;
        if (Config.data.smoothingEnabled) ctx.imageSmoothingQuality = 'high';
    },

    _drawExplosions(ctx, explosions) {
        for (const exp of explosions) {
            if (!exp || !exp.maxLife || exp.maxLife <= 0) continue;
            const alpha = Math.max(0, Math.min(1, exp.life / exp.maxLife));
            const r = Math.max(0, exp.radius || 0);
            const r2 = Math.max(0, (exp.radius || 0) * 0.6);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = exp.color || '#e67e22';
            ctx.beginPath(); ctx.arc(exp.x, exp.y, r, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = EXPLOSION_INNER_COLOR;
            ctx.beginPath(); ctx.arc(exp.x, exp.y, r2, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }
    },

    _drawEntities(ctx, engine) {
        engine.towers.forEach(t => { if (t) t.draw(ctx, false, engine); });
        
        if (engine.beasts) {
            engine.beasts.forEach(b => { if (b) b.draw(ctx); });
        }

        if (engine.sentries) {
            engine.sentries.forEach(s => { if (s) s.draw(ctx); });
        }

        const projectiles = engine.projectilePool.active;
        for (let i = 0; i < projectiles.length; i++) {
            const p = projectiles[i];
            if (p && p.alive) p.draw(ctx);
        }
        engine.enemies.forEach(e => { if (e && !(e instanceof KnightEnemy)) e.draw(ctx); });
        const particles = engine.particlePool.active;
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (p && p.life > 0) p.draw(ctx);
        }
    },

    _drawPlacementPreview(ctx, engine) {
        if (!engine.selectedTowerType) return;

        const stats = TowerStats[engine.selectedTowerType] || HeroStats[engine.selectedTowerType];
        const mouse = engine.mouse;
        
        let previewX = mouse.x;
        let previewY = mouse.y;

        if (engine.stuckPlacement) {
            const adj = applyBossEffects(engine.stuckPlacement.x, engine.stuckPlacement.y);
            previewX = adj.x;
            previewY = adj.y;
        }

        const map = engine.map;
        const placementRadius = Math.max(1, (stats.hitRadius || PLACEMENT_RADIUS) * GS);
        
        const onPath = map.isOnPath(previewX, previewY) || map.isOnProp(previewX, previewY) || previewY > CANVAS_HEIGHT || previewX > CANVAS_WIDTH;
        const onWater = map.isInWater(previewX, previewY);
        const onFrozenWater = map.isOnFrozenWater(previewX, previewY, engine.towers);
        const validLandPlacement = !onPath && (!onWater || onFrozenWater);

        let cost = engine.getCost(stats.cost);
        if (engine.selectedTowerType === 'dart' && !engine.isSandbox && engine.difficulty && !engine.difficulty.noSelling) {
            const mkActive = Config.data.mkActive !== false;
            const hasFreeMonkey = Config.data.unlocks.freeFirstDartMonkey || (mkActive && Config.data.monkeyKnowledge && Config.data.monkeyKnowledge.bonus_monkey);
            if (hasFreeMonkey && !engine.towers.some(t => t.type === 'dart')) {
                cost = 0;
            }
        }
        const canAfford = engine.cash >= cost;

        ctx.globalAlpha = 0.6;

        if (stats.range < 9999) {
            const effRange = Math.max(1, Utils.getEffectiveRange({ stats }, engine));
            ctx.fillStyle = canAfford ? TOWER_AFFORDABLE_COLOR : TOWER_OUT_OF_BOUNDS_COLOR;
            ctx.beginPath(); ctx.arc(previewX, previewY, effRange, 0, Math.PI * 2); ctx.fill();
        }

        if (!canAfford) {
            ctx.fillStyle = TOWER_OUT_OF_BOUNDS_COLOR;
            ctx.beginPath(); ctx.arc(previewX, previewY, placementRadius, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1; return;
        }

        if (stats.waterOnly) {
            if (!onWater || onPath) {
                ctx.fillStyle = TOWER_OVERLAP_COLOR; ctx.beginPath(); ctx.arc(previewX, previewY, placementRadius, 0, Math.PI * 2); ctx.fill();
            } else {
                const isOverlapping = this._checkPlacementOverlap(engine, stats, previewX, previewY);
                if (isOverlapping) { ctx.fillStyle = TOWER_OVERLAP_COLOR; ctx.beginPath(); ctx.arc(previewX, previewY, placementRadius, 0, Math.PI * 2); ctx.fill(); }
                else { Tower.drawPreview(ctx, previewX, previewY, engine.selectedTowerType); }
            }
        } else if (stats.canPlaceOnWater) {
            if (onPath) {
                ctx.fillStyle = TOWER_OVERLAP_COLOR; ctx.beginPath(); ctx.arc(previewX, previewY, placementRadius, 0, Math.PI * 2); ctx.fill();
            } else {
                const isOverlapping = this._checkPlacementOverlap(engine, stats, previewX, previewY);
                if (isOverlapping) { ctx.fillStyle = TOWER_OVERLAP_COLOR; ctx.beginPath(); ctx.arc(previewX, previewY, placementRadius, 0, Math.PI * 2); ctx.fill(); }
                else { Tower.drawPreview(ctx, previewX, previewY, engine.selectedTowerType); }
            }
        } else {
            if (!validLandPlacement) {
                ctx.fillStyle = TOWER_OVERLAP_COLOR; ctx.beginPath(); ctx.arc(previewX, previewY, placementRadius, 0, Math.PI * 2); ctx.fill();
            } else {
                const isOverlapping = this._checkPlacementOverlap(engine, stats, previewX, previewY);
                if (isOverlapping) { ctx.fillStyle = TOWER_OVERLAP_COLOR; ctx.beginPath(); ctx.arc(previewX, previewY, placementRadius, 0, Math.PI * 2); ctx.fill(); }
                else { Tower.drawPreview(ctx, previewX, previewY, engine.selectedTowerType); }
            }
        }
        ctx.globalAlpha = 1;
    },

    _checkPlacementOverlap(engine, stats, x, y) {
        const placementRadius = (stats.hitRadius || PLACEMENT_RADIUS) * GS;
        for (const t of engine.towers) {
            if (t && Utils.withinRange(x, y, t.x, t.y, t.hitRadius + placementRadius)) {
                return true;
            }
        }
        return false;
    },

    _drawSelection(ctx, engine) {
        if (!engine.selectedPlacedTower) return;

        const t = engine.selectedPlacedTower;
        ctx.strokeStyle = '#e67e22'; ctx.lineWidth = TOWER_SELECTION_LINE_WIDTH;
        ctx.beginPath(); ctx.arc(t.x, t.y, Math.max(1, t.hitRadius + TOWER_HIT_RADIUS_PADDING), 0, Math.PI * 2); ctx.stroke();

        if (t.stats.range < 9999) {
            const effRange = Math.max(1, Utils.getEffectiveRange(t, engine));

            ctx.fillStyle = TOWER_RANGE_FILL_COLOR; ctx.globalAlpha = TOWER_SELECTION_FILL_ALPHA;
            ctx.beginPath(); ctx.arc(t.x, t.y, effRange, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }
    },

    _drawLeakFlash(ctx, engine) {
        if (engine.leakFlash > 0) {
            ctx.globalAlpha = engine.leakFlash; ctx.strokeStyle = LEAK_FLASH_COLOR; ctx.lineWidth = LEAK_FLASH_LINE_WIDTH;
            ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); ctx.globalAlpha = 1;
        }
    },

    _drawHitboxes(ctx, engine) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 2;
        
        // Draw Tower Ranges and Footprints
        engine.towers.forEach(t => {
            if (!t) return;
            ctx.strokeStyle = 'blue';
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.hitRadius, 0, Math.PI * 2);
            ctx.stroke();

            if (t.stats && t.stats.range < 9999) {
                ctx.strokeStyle = 'cyan';
                ctx.beginPath();
                ctx.arc(t.x, t.y, Utils.getEffectiveRange(t, engine), 0, Math.PI * 2);
                ctx.stroke();
            }
        });

        // Draw Enemy Hitboxes (Collision Radius)
        engine.enemies.forEach(e => {
            if (!e || !e.alive) return;
            ctx.strokeStyle = 'red';
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
            ctx.stroke();
        });

        // Draw Minion Footprints
        const drawMinionHitbox = (m) => {
            if (!m || !m.alive) return;
            ctx.strokeStyle = 'lime';
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.hitRadius, 0, Math.PI * 2);
            ctx.stroke();
        };
        if (engine.sentries) engine.sentries.forEach(drawMinionHitbox);
        if (engine.beasts) engine.beasts.forEach(drawMinionHitbox);

        // FIX: Draw Projectile Hitboxes
        const projectiles = engine.projectilePool.active;
        for (let i = 0; i < projectiles.length; i++) {
            const p = projectiles[i];
            if (p && p.alive) {
                ctx.strokeStyle = 'yellow';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius || 2, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // FIX: Draw Explosion Radii
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'orange';
        for (const exp of engine.explosions) {
            if (!exp || !exp.maxLife || exp.maxLife <= 0) continue;
            const r = Math.max(0, exp.radius || 0);
            if (r > 0) {
                ctx.beginPath();
                ctx.arc(exp.x, exp.y, r, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        ctx.setLineDash([]);

        ctx.restore();
    }
};

window.toggleNight = function() {
    if (!_engineInstance || !_engineInstance.map) {
        console.error("❌ Night Mode Error: You must be in an active game to toggle night!");
        return;
    }
    _engineInstance.isNight = !_engineInstance.isNight;
    console.log(`🌙 Night mode: ${_engineInstance.isNight ? 'ON' : 'OFF'}`);
};