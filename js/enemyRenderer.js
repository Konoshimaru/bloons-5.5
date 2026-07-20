// js/enemyRenderer.js
import Assets from './assets.js';
import { Names } from './names.js';
import { drawShadow } from './utils.js';
import { GameEngine } from './engine.js';
import { GLOBAL_SCALE } from './constants.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;
const ENEMY_NAMES = [null, 'red', 'blue', 'green', 'yellow', 'pink', 'black', 'white', 'lead', 'zebra', 'purple', 'rainbow', 'ceramic', 'moab', 'bfb', 'zomg', 'ddt', 'bad'];

export const EnemyRenderer = {
    draw(ctx) {
        if (GameEngine.enemies.length < 800) drawShadow(ctx, this.x, this.y, this.radius); 
        
        let asset = this._spriteAsset;
        if (!asset || !asset.loaded) {
            this._updateSpriteCache();
            asset = this._spriteAsset;
        }

        if (asset && asset.loaded) this._drawSprite(ctx, asset);
        else if (this.data.isMoab) this._drawMoabFallback(ctx);
        else this._drawStandardFallback(ctx);

        if (this.slowFactor === 0.0 && this.slowTimer > 0 && !this.isFrozen) this._drawStunOverlay(ctx);
    },

    _drawSprite(ctx, asset) {
        // PRO FIX: Recalculate dimensions if the asset just finished loading or changed
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

    _drawCracks(ctx, w, h, drawX, drawY) {
        const maxHp = this._maxHp;
        const damagePercent = 1 - (this.hp / maxHp);
        const baseName = ENEMY_NAMES[this.tier];
        const maxCracks = Assets.getMaxCracks(baseName);
        
        if (maxCracks <= 0 || damagePercent <= 0) return;
        
        let stage = Math.floor(damagePercent * maxCracks);
        if (damagePercent >= 1.0) stage = maxCracks; 
        if (stage <= 0) return;
        if (stage > maxCracks) stage = maxCracks;
        
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