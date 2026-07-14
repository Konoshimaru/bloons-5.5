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
        if (!engine.map) return;

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
            // PRO FIX: Use CANVAS_WIDTH and CANVAS_HEIGHT from constants (1280x720)
            ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.globalAlpha = 1;
        }
    }
};