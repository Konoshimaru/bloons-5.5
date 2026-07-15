// renderer.js
import { Config, RANGE_SCALE, HeroStats } from './config.js';
import { TowerStats } from './towers/index.js';
import { Utils } from './utils.js';
import { Tower } from './tower.js';
import { CutsceneManager } from './cutscene.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GLOBAL_SCALE } from './constants.js';

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

export const Renderer = {
    render(engine, dt) {
        const ctx = engine.ctx;
        
        // Draw Main Menu Scenery if in menu state or no map loaded
        if (engine.gameState === 'menu' || !engine.map) {
            this._drawMainMenuScenery(ctx, engine, dt);
            return;
        }

        this._setupContext(ctx);
        
        let camOffset = CutsceneManager.cameraOffsetX || 0;
        if (camOffset !== 0) {
            ctx.fillStyle = '#8acc4d';
            ctx.fillRect(0, 0, camOffset, CANVAS_HEIGHT);
            ctx.save();
            ctx.translate(camOffset, 0);
        }

        engine.map.draw(ctx);
        this._drawExplosions(ctx, engine.explosions);
        this._drawEntities(ctx, engine);
        this._drawPlacementPreview(ctx, engine);
        this._drawSelection(ctx, engine);
        this._drawLeakFlash(ctx, engine);

        if (camOffset !== 0) {
            ctx.restore();
        }
        
        CutsceneManager.draw(ctx);
    },

    _drawMainMenuScenery(ctx, engine, dt) {
        const dtSafe = dt || 0.016;
        let t = performance.now() / 1000;
        
        // 1. Time & Phase Calculation
        const date = new Date();
        const hours = date.getHours() + date.getMinutes() / 60;
        let phase = 'day';
        if (hours >= 5 && hours < 8) phase = 'dawn';
        else if (hours >= 8 && hours < 17) phase = 'day';
        else if (hours >= 17 && hours < 20) phase = 'dusk';
        else phase = 'night';

        // 2. Sky Gradient
        const grad = ctx.createLinearGradient(0, 0, 0, 720);
        if (phase === 'dawn') {
            grad.addColorStop(0, '#ff7e5f'); grad.addColorStop(1, '#feb47b');
        } else if (phase === 'day') {
            grad.addColorStop(0, '#4facfe'); grad.addColorStop(1, '#00f2fe');
        } else if (phase === 'dusk') {
            grad.addColorStop(0, '#355C7D'); grad.addColorStop(0.5, '#6C5B7B'); grad.addColorStop(1, '#C06C84');
        } else {
            grad.addColorStop(0, '#0F2027'); grad.addColorStop(1, '#203A43');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1280, 720);

        // 3. Stars (Night)
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

        // 4. Sun / Moon Position
        let progress;
        if (hours > 6 && hours <= 18) {
            progress = (hours - 6) / 12; // Day: 6am to 6pm
        } else {
            let nightHours = hours <= 6 ? hours + 6 : hours - 18;
            progress = nightHours / 12; // Night: 6pm to 6am
        }
        let smX = progress * 1280;
        let smY = 150 - Math.sin(progress * Math.PI) * 50;
        
        // Sun
        if (phase === 'day' || phase === 'dawn') {
            ctx.fillStyle = '#FFD700';
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 60;
            ctx.beginPath();
            ctx.arc(smX, smY, 45, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        // Moon
        if (phase === 'night' || phase === 'dusk') {
            ctx.fillStyle = '#F4F6F0';
            ctx.shadowColor = '#F4F6F0';
            ctx.shadowBlur = 30;
            ctx.beginPath();
            ctx.arc(smX, smY, 35, 0, Math.PI * 2);
            ctx.fill();
            // Crater
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#e0e0e0';
            ctx.beginPath();
            ctx.arc(smX + 10, smY - 5, 8, 0, Math.PI * 2);
            ctx.fill();
        }

        // 5. Clouds
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        if (phase === 'night') ctx.fillStyle = 'rgba(100, 100, 120, 0.4)';
        for(let i=0; i<4; i++) {
            let cx = ((t * 15 + i * 350) % 1400) - 100;
            let cy = 100 + i * 50;
            ctx.beginPath();
            ctx.arc(cx, cy, 40, 0, Math.PI * 2);
            ctx.arc(cx + 40, cy + 10, 30, 0, Math.PI * 2);
            ctx.arc(cx - 30, cy + 10, 25, 0, Math.PI * 2);
            ctx.fill();
        }

        // 6. Hills
        let hillColor1 = '#2ecc71', hillColor2 = '#27ae60';
        if (phase === 'dusk') { hillColor1 = '#2c3e50'; hillColor2 = '#22313f'; }
        if (phase === 'night') { hillColor1 = '#1a252f'; hillColor2 = '#16202a'; }
        
        ctx.fillStyle = hillColor1;
        ctx.beginPath();
        ctx.moveTo(0, 600);
        ctx.quadraticCurveTo(640, 400, 1280, 600);
        ctx.lineTo(1280, 720); ctx.lineTo(0, 720);
        ctx.closePath(); ctx.fill();
        
        ctx.fillStyle = hillColor2;
        ctx.beginPath();
        ctx.moveTo(0, 650);
        ctx.quadraticCurveTo(640, 500, 1280, 650);
        ctx.lineTo(1280, 720); ctx.lineTo(0, 720);
        ctx.closePath(); ctx.fill();

        // 7. Improved Monkey Sprite
        let bounce = Math.sin(t * 2) * 5;
        let bx = 640, by = 520 + bounce;
        
        // Tail
        ctx.strokeStyle = '#795548';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx + 40, by + 10);
        ctx.quadraticCurveTo(bx + 90, by - 20, bx + 70, by - 60);
        ctx.stroke();
        
        // Body
        ctx.fillStyle = '#795548';
        ctx.beginPath();
        ctx.ellipse(bx, by + 10, 40, 45, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Belly
        ctx.fillStyle = '#D2B48C';
        ctx.beginPath();
        ctx.ellipse(bx, by + 20, 25, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Head
        ctx.fillStyle = '#795548';
        ctx.beginPath();
        ctx.arc(bx, by - 20, 35, 0, Math.PI * 2);
        ctx.fill();
        
        // Ears
        ctx.beginPath();
        ctx.arc(bx - 30, by - 20, 12, 0, Math.PI * 2);
        ctx.arc(bx + 30, by - 20, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner Ears & Face
        ctx.fillStyle = '#D2B48C';
        ctx.beginPath();
        ctx.arc(bx - 30, by - 20, 6, 0, Math.PI * 2);
        ctx.arc(bx + 30, by - 20, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(bx, by - 15, 22, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(bx - 10, by - 25, 8, 0, Math.PI * 2);
        ctx.arc(bx + 10, by - 25, 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#000';
        let eyeOffset = Math.sin(t * 0.5) * 2;
        ctx.beginPath();
        ctx.arc(bx - 10 + eyeOffset, by - 25, 4, 0, Math.PI * 2);
        ctx.arc(bx + 10 + eyeOffset, by - 25, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Smile
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx, by - 10, 10, 0.2, Math.PI - 0.2);
        ctx.stroke();

        // 8. Trees
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(150, 550, 20, 100);
        ctx.fillStyle = phase === 'night' ? '#1a5c1a' : '#228B22';
        ctx.beginPath();
        ctx.arc(160, 540, 50, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#8B4513';
        ctx.fillRect(1100, 580, 20, 80);
        ctx.fillStyle = phase === 'night' ? '#1a5c1a' : '#228B22';
        ctx.beginPath();
        ctx.arc(1110, 570, 40, 0, Math.PI * 2);
        ctx.fill();

        // 9. Clickable Banana Events
        if (!engine.menuClickables) engine.menuClickables = [];
        if (Math.random() < 0.01 && engine.menuClickables.length < 5) {
            engine.menuClickables.push({
                x: Math.random() * 1080 + 100,
                y: -50,
                vx: (Math.random() - 0.5) * 20,
                vy: 50 + Math.random() * 30,
                r: 15,
                rot: 0,
                vrot: (Math.random() - 0.5) * 5
            });
        }
        
        for (let i = engine.menuClickables.length - 1; i >= 0; i--) {
            let item = engine.menuClickables[i];
            item.x += item.vx * dtSafe;
            item.y += item.vy * dtSafe;
            item.rot += item.vrot * dtSafe;
            
            if (item.y > 720) {
                engine.menuClickables.splice(i, 1);
                continue;
            }
            
            ctx.save();
            ctx.translate(item.x, item.y);
            ctx.rotate(item.rot);
            ctx.fillStyle = '#FFDC00';
            ctx.beginPath();
            ctx.ellipse(0, 0, item.r, item.r * 0.6, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#E6B800';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }
    },

    _setupContext(ctx) {
        ctx.imageSmoothingEnabled = Config.data.smoothingEnabled;
        if (Config.data.smoothingEnabled) {
            ctx.imageSmoothingQuality = 'high';
        }
    },

    _drawExplosions(ctx, explosions) {
        for (const exp of explosions) {
            if (!exp || !exp.maxLife || exp.maxLife <= 0) continue;

            const alpha = Math.max(0, Math.min(1, exp.life / exp.maxLife));
            const r = Math.max(0, exp.radius || 0);
            const r2 = Math.max(0, (exp.radius || 0) * 0.6);

            ctx.globalAlpha = alpha;
            ctx.fillStyle = exp.color || '#e67e22';
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = EXPLOSION_INNER_COLOR;
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, r2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    },

    _drawEntities(ctx, engine) {
        engine.towers.forEach(t => { if (t) t.draw(ctx); });
        
        const projectiles = engine.projectilePool.active;
        for (let i = 0; i < projectiles.length; i++) {
            const p = projectiles[i];
            if (p && p.alive) p.draw(ctx);
        }

        engine.enemies.forEach(e => { if (e) e.draw(ctx); });

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
        const map = engine.map;
        
        const placementRadius = Math.max(1, (stats.hitRadius || PLACEMENT_RADIUS) * GS);
        
        const onPath = map.isOnPath(mouse.x, mouse.y) || map.isOnProp(mouse.x, mouse.y) || mouse.y > CANVAS_HEIGHT || mouse.x > CANVAS_WIDTH;
        const cost = engine.getCost(stats.cost);
        const canAfford = engine.cash >= cost;

        ctx.globalAlpha = 0.6;

        if (stats.range < 9999) {
            const effRange = Math.max(1, stats.range * RANGE_SCALE * GS);
            ctx.fillStyle = canAfford ? TOWER_AFFORDABLE_COLOR : TOWER_OUT_OF_BOUNDS_COLOR;
            ctx.beginPath();
            ctx.arc(mouse.x, mouse.y, effRange, 0, Math.PI * 2);
            ctx.fill();
        }

        if (!onPath && canAfford) {
            const isOverlapping = this._checkPlacementOverlap(engine, stats, mouse.x, mouse.y);
            
            if (isOverlapping) {
                ctx.fillStyle = TOWER_OVERLAP_COLOR;
                ctx.beginPath();
                ctx.arc(mouse.x, mouse.y, placementRadius, 0, Math.PI * 2);
                ctx.fill();
            } else {
                Tower.drawPreview(ctx, mouse.x, mouse.y, engine.selectedTowerType);
            }
        } else {
            ctx.fillStyle = TOWER_OVERLAP_COLOR;
            ctx.beginPath();
            ctx.arc(mouse.x, mouse.y, placementRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    },

    _checkPlacementOverlap(engine, stats, x, y) {
        const placementRadius = (stats.hitRadius || PLACEMENT_RADIUS) * GS;
        for (const t of engine.towers) {
            if (t && Utils.distance(x, y, t.x, t.y) < (t.hitRadius + placementRadius)) {
                return true;
            }
        }
        return false;
    },

    _drawSelection(ctx, engine) {
        if (!engine.selectedPlacedTower) return;

        const t = engine.selectedPlacedTower;
        ctx.strokeStyle = '#e67e22';
        ctx.lineWidth = TOWER_SELECTION_LINE_WIDTH;
        ctx.beginPath();
        ctx.arc(t.x, t.y, Math.max(1, t.hitRadius + TOWER_HIT_RADIUS_PADDING), 0, Math.PI * 2);
        ctx.stroke();

        if (t.stats.range < 9999) {
            const scale = typeof RANGE_SCALE === 'number' ? RANGE_SCALE : 3.0;
            const buffMult = typeof t.buffedRange === 'number' ? t.buffedRange : 0;
            const alchBuff = t.alchBuff ? t.alchBuff.range : 0;
            const effRange = Math.max(1, t.stats.range * scale * (1 + buffMult + alchBuff) * GS);

            ctx.fillStyle = TOWER_RANGE_FILL_COLOR;
            ctx.globalAlpha = TOWER_SELECTION_FILL_ALPHA;
            ctx.beginPath();
            ctx.arc(t.x, t.y, effRange, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    },

    _drawLeakFlash(ctx, engine) {
        if (engine.leakFlash > 0) {
            ctx.globalAlpha = engine.leakFlash;
            ctx.strokeStyle = LEAK_FLASH_COLOR;
            ctx.lineWidth = LEAK_FLASH_LINE_WIDTH;
            ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.globalAlpha = 1;
        }
    }
};