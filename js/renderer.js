// js/renderer.js
import { Config, RANGE_SCALE } from './config.js';
import { TowerStats, Upgrades } from './towers/index.js';
import { HeroStats } from './config.js';
import { Utils } from './utils.js';
import { Tower } from './tower.js';

export const Renderer = {
    render(engine) {
        const ctx = engine.ctx;
        if (!engine.map) return; 
        
        ctx.imageSmoothingEnabled = Config.data.smoothingEnabled;
        if (Config.data.smoothingEnabled) ctx.imageSmoothingQuality = 'high';
        
        // Draw Map
        engine.map.draw(ctx); 
        
        // Draw Explosions
        for (let exp of engine.explosions) { 
            if (!exp || !exp.maxLife || exp.maxLife <= 0) continue; 
            let alpha = Math.max(0, Math.min(1, exp.life / exp.maxLife));
            let r = Math.max(0, exp.radius || 0); 
            let r2 = Math.max(0, (exp.radius || 0) * 0.6); 
            
            ctx.globalAlpha = alpha; 
            ctx.fillStyle = exp.color || '#e67e22'; 
            ctx.beginPath(); ctx.arc(exp.x, exp.y, r, 0, Math.PI * 2); ctx.fill(); 
            ctx.fillStyle = '#f1c40f'; 
            ctx.beginPath(); ctx.arc(exp.x, exp.y, r2, 0, Math.PI * 2); ctx.fill(); 
            ctx.globalAlpha = 1; 
        } 
        
        // Draw Entities
        engine.towers.forEach(t => { if (t) t.draw(ctx); }); 
        engine.projectiles.forEach(p => { if (p) p.draw(ctx); }); 
        engine.enemies.forEach(e => { if (e) e.draw(ctx); }); 
        engine.particles.forEach(p => { if (p) p.draw(ctx); }); 
        
        // Draw Placement Preview
        if (engine.selectedTowerType) { 
            const stats = TowerStats[engine.selectedTowerType] || HeroStats[engine.selectedTowerType]; 
            const onPath = engine.map.isOnPath(engine.mouse.x, engine.mouse.y) || engine.map.isOnProp(engine.mouse.x, engine.mouse.y) || engine.mouse.y > 600 || engine.mouse.x > 720; 
            const cost = engine.getCost(stats.cost);
            const canAfford = engine.cash >= cost; 
            ctx.globalAlpha = 0.6; 
            if (stats.range < 9999) { 
                ctx.fillStyle = canAfford ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 0, 0, 0.2)'; 
                ctx.beginPath(); ctx.arc(engine.mouse.x, engine.mouse.y, stats.range * RANGE_SCALE, 0, Math.PI * 2); ctx.fill(); 
            } 
            
            if (!onPath && canAfford) { 
                let isOverlapping = false;
                let placementRadius = stats.hitRadius || 18;
                for (let t of engine.towers) {
                    if (t && Utils.distance(engine.mouse.x, engine.mouse.y, t.x, t.y) < (t.hitRadius + placementRadius)) {
                        isOverlapping = true; break;
                    }
                }

                if (isOverlapping) {
                    ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(engine.mouse.x, engine.mouse.y, 18, 0, Math.PI * 2); ctx.fill();
                } else {
                    Tower.drawPreview(ctx, engine.mouse.x, engine.mouse.y, engine.selectedTowerType); 
                }
            } else { 
                ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(engine.mouse.x, engine.mouse.y, 18, 0, Math.PI * 2); ctx.fill(); 
            } 
            ctx.globalAlpha = 1; 
        } 
        
        // Draw Selected Tower Highlight
        if (engine.selectedPlacedTower) { 
            const t = engine.selectedPlacedTower; 
            ctx.strokeStyle = '#e67e22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(t.x, t.y, t.hitRadius + 4, 0, Math.PI * 2); ctx.stroke(); 
            if (t.stats.range < 9999) { 
                ctx.fillStyle = 'rgba(230, 126, 34, 0.15)'; 
                ctx.beginPath(); ctx.arc(t.x, t.y, t.stats.range * RANGE_SCALE * (1 + t.buffedRange), 0, Math.PI * 2); ctx.fill(); 
            } 
        } 
        
        // DOM Updates (Moved here to run exactly once per painted frame)
        if (engine.flavorTimer > 0) {
            engine.flavorTimer -= 0.016; // Approximate dt for render loop
            const el = document.getElementById('flavor-text');
            if (el) {
                el.innerText = engine.flavorText;
                el.style.opacity = Config.data.showFlavor ? 1 : 0;
            }
        } else { 
            const el = document.getElementById('flavor-text');
            if (el) el.style.opacity = 0; 
        }
        
        // Call UI Ability Bar update from here so it syncs with visual frame
        // Note: UI module is imported in engine.js, we will trigger it via engine reference
        if (engine.ui) engine.ui.updateAbilityBar(engine);
    }
};