// js/enemyRenderer.js
import Assets from './assets.js';
import { Names } from './names.js';
import { drawShadow } from './utils.js'; // Keep import for compatibility, but no longer used
import { GameEngine } from './engine.js';
import { GLOBAL_SCALE } from './constants.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;
const ENEMY_NAMES = [null, 'red', 'blue', 'green', 'yellow', 'pink', 'black', 'white', 'lead', 'zebra', 'purple', 'rainbow', 'ceramic', 'moab', 'bfb', 'zomg', 'ddt', 'bad'];

export const EnemyRenderer = {
    draw(ctx) {
        let asset = this._spriteAsset;
        if (!asset || !asset.loaded) {
            this._updateSpriteCache();
            asset = this._spriteAsset;
        }

        // FIX: Draw animated blades for BFB BEFORE the main sprite so they render underneath
        const baseName = ENEMY_NAMES[this.tier];
        if (baseName === 'bfb') this._drawBlades(ctx);

        if (asset && asset.loaded) this._drawSprite(ctx, asset);
        else if (this.data.isMoab) this._drawMoabFallback(ctx);
        else this._drawStandardFallback(ctx);

        if (this.slowFactor === 0.0 && this.slowTimer > 0 && !this.isFrozen) this._drawStunOverlay(ctx);
    },

    // FIX: Strict 25% intervals and proper 10 FPS animation loop
    _drawBlades(ctx) {
        const maxHp = this._maxHp;
        if (maxHp <= 0) return;
        
        const damagePercent = 1 - (this.hp / maxHp);
        
        // STRICT 25% INTERVALS AS REQUESTED
        let stage = 0;
        if (damagePercent > 0.75) stage = 3;
        else if (damagePercent > 0.50) stage = 2;
        else if (damagePercent > 0.25) stage = 1;
        else stage = 0;
        
        let frame = this.bladeFrame;
        
        // Try stage_frame format first (e.g. bfb_blades_1_0)
        let bladeAsset = Assets.get(`${Names.PREFIXES.ENEMY}bfb_blades_${stage}_${frame}`);
        if (!bladeAsset || !bladeAsset.loaded) {
            // Fallback to frame only for stage 0 (e.g. bfb_blades_0)
            if (stage === 0) {
                bladeAsset = Assets.get(`${Names.PREFIXES.ENEMY}bfb_blades_${frame}`);
            }
        }
        
        // FIX: If the current frame doesn't exist or isn't loaded, loop back to frame 0
        if (!bladeAsset || !bladeAsset.loaded) {
            this.bladeFrame = 0; // Reset animation loop
            bladeAsset = Assets.get(`${Names.PREFIXES.ENEMY}bfb_blades_${stage}_0`);
            if (!bladeAsset || !bladeAsset.loaded) {
                if (stage === 0) bladeAsset = Assets.get(`${Names.PREFIXES.ENEMY}bfb_blades_0`);
            }
        }
        
        if (!bladeAsset || !bladeAsset.loaded) return;
        
        // Calculate dimensions based on the blade asset's own aspect ratio to prevent stretching
        const targetSize = (this.data.size || (this.data.radius * 2)) * GS;
        const maxDim = Math.max(bladeAsset.width, bladeAsset.height);
        const scale = targetSize / maxDim;
        const w = bladeAsset.width * scale;
        const h = bladeAsset.height * scale;
        
        // FIX: Perfectly centered, no displacement
        const drawX = this.x + (this.data.spriteOffsetX || 0);
        const drawY = this.y + (this.data.spriteOffsetY || 0);
        
        ctx.save();
        ctx.translate(drawX, drawY);
        if (this.tier >= 13) ctx.rotate(this.angle + Math.PI / 2);
        ctx.drawImage(bladeAsset, -w / 2, -h / 2, w, h);
        ctx.restore();
    },

    _drawSprite(ctx, asset) {
        if (asset.width !== this._cachedSpriteW || asset.height !== this._cachedSpriteH) {
            const targetSize = (this.data.size || (this.data.radius * 2)) * GS;
            const maxDim = Math.max(asset.width, asset.height);
            const scale = targetSize / maxDim;
            this._spriteW = asset.width * scale;
            this._spriteH = asset.height * scale;
            this._cachedSpriteW = asset.width;
            this._cachedSpriteH = asset.height;
        }
        
        const w = this._spriteW;
        const h = this._spriteH;
        const drawX = this.x + (this.data.spriteOffsetX || 0);
        const drawY = this.y + (this.data.spriteOffsetY || 0);
        
        ctx.save();
        ctx.translate(drawX, drawY);
        if (this.tier >= 13) ctx.rotate(this.angle + Math.PI / 2);
        ctx.drawImage(asset, -w / 2, -h / 2, w, h);
        ctx.restore();
        
        if (this.tier >= 12 && this.hp < this._maxHp) this._drawCracks(ctx, w, h, drawX, drawY);

        if (this.isFrozen) {
            ctx.strokeStyle = 'rgba(26, 188, 156, 0.9)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2); ctx.stroke(); 
        } else if (this.slowFactor < 1.0) {
            ctx.strokeStyle = 'rgba(241, 196, 15, 0.7)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2); ctx.stroke(); 
        }
        
        if (this.brittle) {
            ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2); ctx.stroke(); 
        }
        
        if (this.infinityTint > 0) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = this.infinityTint * 0.6;
            ctx.fillStyle = '#a253ff';
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill(); 
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }
    },

    // FIX: Use dynamic baseName so all bloons use their own cracks, but keep 25% intervals
    _drawCracks(ctx, w, h, drawX, drawY) {
        const maxHp = this._maxHp;
        const damagePercent = 1 - (this.hp / maxHp);
        const baseName = ENEMY_NAMES[this.tier];
        const maxCracks = Assets.getMaxCracks(baseName);
        
        if (maxCracks <= 0 || damagePercent <= 0) return;
        
        // STRICT 25% INTERVALS AS REQUESTED
        let stage = 0;
        if (damagePercent > 0.75) stage = 3;
        else if (damagePercent > 0.50) stage = 2;
        else if (damagePercent > 0.25) stage = 1;
        else return; // 0-25% uses base sprite, no cracks
        
        // FIX: Use baseName (e.g. moab, ceramic, bfb) instead of hardcoding 'bfb'
        const crackAsset = Assets.get(`${Names.PREFIXES.ENEMY}${baseName}_${stage}`);
        if (!crackAsset || !crackAsset.loaded) return;
        
        ctx.save();
        ctx.translate(drawX, drawY);
        if (this.tier >= 13) ctx.rotate(this.angle + Math.PI / 2);
        ctx.drawImage(crackAsset, -w / 2, -h / 2, w, h);
        ctx.restore();
    },

    _drawMoabFallback(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI / 2);
        ctx.fillStyle = this.data.color;
        ctx.fillRect(-this.radius, -this.radius * 0.6, this.radius * 2, this.radius * 1.2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-this.radius, -this.radius * 0.6, this.radius * 2, this.radius * 0.3);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(-5, -this.radius * 0.6 - 5, 10, 5);
        ctx.restore();
        if (this.isFortified) {
            ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 4;
            ctx.strokeRect(this.x - this.radius, this.y - this.radius * 0.6, this.radius * 2, this.radius * 1.2);
        }
    },

    _drawStandardFallback(ctx) {
        ctx.fillStyle = this.data.color;
        if (this.isRegen) {
            const r = this.radius;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + r * 0.8);
            ctx.bezierCurveTo(this.x, this.y, this.x - r, this.y, this.x - r, this.y - r * 0.4);
            ctx.bezierCurveTo(this.x - r, this.y - r * 0.8, this.x - r * 0.5, this.y - r, this.x, this.y - r * 0.4);
            ctx.bezierCurveTo(this.x + r * 0.5, this.y - r, this.x + r, this.y - r * 0.8, this.x + r, this.y - r * 0.4);
            ctx.bezierCurveTo(this.x + r, this.y, this.x, this.y, this.x, this.y + r * 0.8);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.radius * 0.9, this.radius, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        if (this.data.isLead) {
            ctx.fillStyle = '#7f8c8d';
            ctx.beginPath(); ctx.ellipse(this.x, this.y, this.radius * 0.9, this.radius, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath(); ctx.ellipse(this.x - this.radius / 3, this.y - this.radius / 3, this.radius / 4, this.radius / 2, -0.5, 0, Math.PI * 2); ctx.fill();
            if (this.isFortified) {
                ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.stroke();
            } else {
                ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.stroke();
            }
        } else if (this.isCamo) {
            ctx.fillStyle = '#5d4037';
            ctx.beginPath(); ctx.arc(this.x - 4, this.y - 2, 4, 0, Math.PI * 2); ctx.arc(this.x + 5, this.y + 3, 5, 0, Math.PI * 2); ctx.fill();
        } else if (this.data.isCeramic) {
            ctx.strokeStyle = '#7f8c8d'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.stroke();
            if (this.isFortified) {
                ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 5;
                ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.stroke();
            }
        }
        if (this.isFrozen) {
            ctx.strokeStyle = 'rgba(26, 188, 156, 0.9)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2); ctx.stroke();
        } else if (this.slowFactor < 1.0) {
            ctx.strokeStyle = 'rgba(241, 196, 15, 0.7)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2); ctx.stroke();
        }
    },

    _drawStunOverlay(ctx) {
        const t = performance.now() / 1000;
        const fps = 15;
        const frame = Math.floor(t * fps) % fps;
        let stunAsset = Assets.get(Names.getStunFX(frame));
        if (!stunAsset || !stunAsset.loaded) stunAsset = Assets.get(Names.getStunFX(0));
        if (!stunAsset || !stunAsset.loaded) stunAsset = Assets.get('effect_stun');
        if (stunAsset && stunAsset.loaded) {
            const s = (this.data.size || 40) * GS * 0.8;
            ctx.save();
            ctx.translate(this.x, this.y - this.radius * 0.6 - s / 2);
            ctx.rotate(t * 5);
            ctx.drawImage(stunAsset, -s / 2, -s / 2, s, s);
            ctx.restore();
        }
    }
};

export const EnemyTypesData = {
    1: { color: '#e74c3c', radius: 12, size: 24, speed: 60, nextTier: null, livesLost: 1, rbe: 1, maxHp: 1 },
    2: { color: '#3498db', radius: 14, size: 28, speed: 80, nextTier: 1, livesLost: 1, rbe: 2, maxHp: 1 },
    3: { color: '#2ecc71', radius: 16, size: 32, speed: 120, nextTier: 2, livesLost: 1, rbe: 3, maxHp: 1 },
    4: { color: '#f1c40f', radius: 18, size: 36, speed: 180, nextTier: 3, livesLost: 1, rbe: 4, maxHp: 1 },
    5: { color: '#ff00ff', radius: 20, size: 40, speed: 240, nextTier: 4, livesLost: 1, rbe: 5, maxHp: 1 },
    6: { color: '#2c3e50', radius: 14, size: 32, speed: 100, nextTier: null, isBlack: true, livesLost: 3, rbe: 11, maxHp: 1, splitsInto: [{tier: 5, count: 2}], blocksDamageType: (d) => d.isExplosion },
    7: { color: '#ffffff', radius: 14, size: 32, speed: 110, nextTier: null, isWhite: true, livesLost: 3, rbe: 11, maxHp: 1, splitsInto: [{tier: 5, count: 2}], blocksDamageType: (d) => d.isIce },
    8: { color: '#95a5a6', radius: 18, size: 32, speed: 50, nextTier: null, isLead: true, livesLost: 6, rbe: 23, maxHp: 1, splitsInto: [{tier: 6, count: 2}], blocksDamageType: (d) => d.isSharp && !d.canHitLead },
    9: { color: '#bdc3c7', radius: 18, size: 36, speed: 120, nextTier: null, isZebra: true, livesLost: 6, rbe: 23, maxHp: 1, splitsInto: [{tier: 6, count: 1}, {tier: 7, count: 1}], blocksDamageType: (d) => d.isExplosion || d.isIce },
    10:{ color: '#9b59b6', radius: 18, size: 36, speed: 130, nextTier: null, isPurple: true, livesLost: 3, rbe: 11, maxHp: 1, splitsInto: [{tier: 5, count: 2}], blocksDamageType: (d) => (d.isPlasma || d.isEnergy || d.isFire || d.isMagic) && !d.canHitPurple },
    11:{ color: '#e74c3c', radius: 20, size: 40, speed: 100, nextTier: null, isRainbow: true, livesLost: 12, rbe: 47, maxHp: 1, splitsInto: [{tier: 9, count: 2}] },
    12:{ color: '#e67e22', radius: 20, size: 48, speed: 80, nextTier: null, isCeramic: true, livesLost: 26, rbe: 104, maxHp: 10, splitsInto: [{tier: 11, count: 2}] },
    13:{ color: '#2c3e50', radius: 50, size: 110, speed: 40, nextTier: null, isMoab: true, livesLost: 154, rbe: 616, maxHp: 200, splitsInto: [{tier: 12, count: 4}], spriteOffsetX: 0, spriteOffsetY: 0 },
    14:{ color: '#e74c3c', radius: 70, size: 140, speed: 30, nextTier: null, isMoab: true, livesLost: 791, rbe: 3164, maxHp: 700, splitsInto: [{tier: 13, count: 4}], spriteOffsetX: 0, spriteOffsetY: 0 },
    15:{ color: '#27ae60', radius: 90, size: 180, speed: 20, nextTier: null, isMoab: true, livesLost: 4164, rbe: 16656, maxHp: 4000, splitsInto: [{tier: 14, count: 4}], spriteOffsetX: 0, spriteOffsetY: 0 },
    16:{ color: '#2c3e50', radius: 50, size: 110, speed: 110, nextTier: null, isMoab: true, isDDT: true, isLead: true, livesLost: 816, rbe: 816, maxHp: 400, splitsInto: [{tier: 12, count: 4, forceCamo: true, forceRegen: true}], blocksDamageType: (d) => d.isExplosion || (d.isSharp && !d.canHitLead), spriteOffsetX: 0, spriteOffsetY: 0 },
    17:{ color: '#e74c3c', radius: 110, size: 200, speed: 15, nextTier: null, isMoab: true, isBAD: true, livesLost: 55760, rbe: 55760, maxHp: 20000, splitsInto: [{tier: 15, count: 2}, {tier: 16, count: 3}], spriteOffsetX: 0, spriteOffsetY: 0 }
};