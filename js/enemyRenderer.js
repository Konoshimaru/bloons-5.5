// js/enemyRenderer.js
import Assets from './assets.js';
import { Names } from './names.js';
import { drawShadow } from './utils.js';
import { GameEngine } from './engine.js';
import { GLOBAL_SCALE } from './constants.js';
import { MobileManager } from './mobile.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;
const ENEMY_NAMES = [null, 'red', 'blue', 'green', 'yellow', 'pink', 'black', 'white', 'lead', 'zebra', 'purple', 'rainbow', 'ceramic', 'moab', 'bfb', 'zomg', 'ddt', 'bad'];

export const EnemyRenderer = {
    draw(ctx) {
        let asset = this._spriteAsset;
        if (!asset || !asset.loaded) {
            this._updateSpriteCache();
            asset = this._spriteAsset;
        }

        const baseName = ENEMY_NAMES[this.tier];
        
        if (baseName === 'moab' || baseName === 'bfb' || baseName === 'zomg') {
            this._drawBlades(ctx);
        }

        if (asset && asset.loaded) this._drawSprite(ctx, asset);
        else if (this.data.isMoab) this._drawMoabFallback(ctx);
        else this._drawStandardFallback(ctx);

        if (this.slowFactor === 0.0 && this.slowTimer > 0 && !this.isFrozen) this._drawStunOverlay(ctx);
    },

    // Helper to apply the crush transformation
    _applySqueezeTransform(ctx) {
        if (!this.isSqueezed) return;
        const t = performance.now() / 1000;
        ctx.translate(Math.sin(t * 30) * 3, 0); // Violent horizontal shaking
        const squashY = 0.55 + Math.sin(t * 12) * 0.1; // Rhythmic crushing (0.45 to 0.65 height)
        const squashX = 1.0 + (1.0 - squashY) * 0.4; // Bulge out horizontally
        ctx.scale(squashX, squashY);
    },

    _drawBlades(ctx) {
        const mobileScale = MobileManager.isActive ? MobileManager.spriteScale : 1.0;
        const maxHp = this._maxHp;
        if (maxHp <= 0) return;
        
        const damagePercent = 1 - (this.hp / maxHp);
        let stage = 0;
        if (damagePercent > 0.75) stage = 3;
        else if (damagePercent > 0.50) stage = 2;
        else if (damagePercent > 0.25) stage = 1;
        
        let frame = this.bladeFrame;
        const baseName = ENEMY_NAMES[this.tier]; // 'moab', 'bfb', or 'zomg'
        
        let bladeAsset = Assets.get(`${Names.PREFIXES.ENEMY}${baseName}_blades_${stage}_${frame}`);
        if (!bladeAsset || !bladeAsset.loaded) {
            if (stage === 0) bladeAsset = Assets.get(`${Names.PREFIXES.ENEMY}${baseName}_blades_${frame}`);
        }
        if (!bladeAsset || !bladeAsset.loaded) {
            this.bladeFrame = 0;
            bladeAsset = Assets.get(`${Names.PREFIXES.ENEMY}${baseName}_blades_${stage}_0`);
            if (!bladeAsset || !bladeAsset.loaded && stage === 0) bladeAsset = Assets.get(`${Names.PREFIXES.ENEMY}${baseName}_blades_0`);
        }
        if (!bladeAsset || !bladeAsset.loaded) return;
        
        const targetSize = (this.data.size || (this.data.radius * 2)) * GS * mobileScale;
        const maxDim = Math.max(bladeAsset.width, bladeAsset.height);
        const scale = targetSize / maxDim;
        const w = bladeAsset.width * scale;
        const h = bladeAsset.height * scale;
        
        const drawX = this.x + (this.data.spriteOffsetX || 0);
        const drawY = this.y + (this.data.spriteOffsetY || 0);
        
        ctx.save();
        ctx.translate(drawX, drawY);
        this._applySqueezeTransform(ctx); // Apply crush effect
        if (this.tier >= 13) ctx.rotate(this.angle + Math.PI / 2);
        ctx.drawImage(bladeAsset, -w / 2, -h / 2, w, h);
        ctx.restore();
    },

    _drawSprite(ctx, asset) {
        const mobileScale = MobileManager.isActive ? MobileManager.spriteScale : 1.0;
        if (asset.width !== this._cachedSpriteW || asset.height !== this._cachedSpriteH) {
            const targetSize = (this.data.size || (this.data.radius * 2)) * GS * mobileScale;
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
        this._applySqueezeTransform(ctx); // Apply crush effect
        if (this.tier >= 13) ctx.rotate(this.angle + Math.PI / 2);
        ctx.drawImage(asset, -w / 2, -h / 2, w, h);
        ctx.restore();
        
        if (this.tier >= 12 && this.hp < this._maxHp) this._drawCracks(ctx, w, h, drawX, drawY);

        if (this.tier < 13) {
            const srcStr = asset.src || '';
            const hasCustomCamoSprite = srcStr.includes('_camo');
            const hasCustomRegenSprite = srcStr.includes('_regen');

            // Frozen overlay
            if (this.isFrozen) {
                let fImg = Assets.get('effect_frozen_effect');
                if (this.data.isLead) fImg = Assets.get('effect_frozen_effect_lead');
                else if (this.isRegen) fImg = Assets.get('effect_frozen_effect_regen');
                
                ctx.save();
                ctx.translate(drawX, drawY);
                this._applySqueezeTransform(ctx); // Apply crush effect to overlay
                if (fImg && fImg.loaded) {
                    ctx.drawImage(fImg, -w / 2, -h / 2, w, h);
                } else {
                    ctx.strokeStyle = 'rgba(26, 188, 156, 0.9)'; ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.arc(0, 0, this.radius + 3, 0, Math.PI * 2); ctx.stroke(); 
                }
                ctx.restore();
            } else if (this.slowFactor < 1.0) {
                ctx.strokeStyle = 'rgba(241, 196, 15, 0.7)'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2); ctx.stroke(); 
            }

            // Camo/Regen overlay (Skip if custom sprite exists)
            let cImg = null;
            if (this.isCamo && this.isRegen && !hasCustomCamoSprite && !hasCustomRegenSprite) {
                cImg = Assets.get('effect_camo_regen_effect');
            } else if (this.isCamo && !this.isRegen && !hasCustomCamoSprite) {
                cImg = Assets.get('effect_camo_effect');
            } else if (this.isRegen && !hasCustomRegenSprite) {
                cImg = Assets.get('effect_regen_effect');
            }

            if (cImg && cImg.loaded) {
                ctx.save();
                ctx.translate(drawX, drawY);
                this._applySqueezeTransform(ctx); // Apply crush effect to overlay
                ctx.drawImage(cImg, -w / 2, -h / 2, w, h);
                ctx.restore();
            }
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
        
        let stage = 0;
        if (damagePercent > 0.75) stage = 3;
        else if (damagePercent > 0.50) stage = 2;
        else if (damagePercent > 0.25) stage = 1;
        else return;
        
        const crackAsset = Assets.get(`${Names.PREFIXES.ENEMY}${baseName}_${stage}`);
        if (!crackAsset || !crackAsset.loaded) return;
        
        ctx.save();
        ctx.translate(drawX, drawY);
        this._applySqueezeTransform(ctx); // Apply crush effect to cracks
        if (this.tier >= 13) ctx.rotate(this.angle + Math.PI / 2);
        ctx.drawImage(crackAsset, -w / 2, -h / 2, w, h);
        ctx.restore();
    },

    _drawMoabFallback(ctx) {
        const mobileScale = MobileManager.isActive ? MobileManager.spriteScale : 1.0;
        ctx.save();
        ctx.translate(this.x, this.y);
        this._applySqueezeTransform(ctx); // Apply crush effect
        ctx.rotate(this.angle + Math.PI / 2);
        ctx.fillStyle = this.data.color;
        ctx.fillRect(-this.radius * mobileScale, -this.radius * 0.6 * mobileScale, this.radius * 2 * mobileScale, this.radius * 1.2 * mobileScale);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-this.radius * mobileScale, -this.radius * 0.6 * mobileScale, this.radius * 2 * mobileScale, this.radius * 0.3 * mobileScale);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(-5 * mobileScale, -this.radius * 0.6 * mobileScale - 5 * mobileScale, 10 * mobileScale, 5 * mobileScale);
        ctx.restore();
        if (this.isFortified) {
            ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 4;
            ctx.strokeRect(this.x - this.radius * mobileScale, this.y - this.radius * 0.6 * mobileScale, this.radius * 2 * mobileScale, this.radius * 1.2 * mobileScale);
        }
    },

    _drawStandardFallback(ctx) {
        const mobileScale = MobileManager.isActive ? MobileManager.spriteScale : 1.0;
        ctx.fillStyle = this.data.color;
        if (this.isRegen) {
            const r = this.radius * mobileScale;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + r * 0.8);
            ctx.bezierCurveTo(this.x, this.y, this.x - r, this.y, this.x - r, this.y - r * 0.4);
            ctx.bezierCurveTo(this.x - r, this.y - r * 0.8, this.x - r * 0.5, this.y - r, this.x, this.y - r * 0.4);
            ctx.bezierCurveTo(this.x + r * 0.5, this.y - r, this.x + r, this.y - r * 0.8, this.x + r, this.y - r * 0.4);
            ctx.bezierCurveTo(this.x + r, this.y, this.x, this.y, this.x, this.y + r * 0.8);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.radius * 0.9 * mobileScale, this.radius * mobileScale, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        if (this.data.isLead) {
            ctx.fillStyle = '#7f8c8d';
            ctx.beginPath(); ctx.ellipse(this.x, this.y, this.radius * 0.9 * mobileScale, this.radius * mobileScale, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath(); ctx.ellipse(this.x - (this.radius / 3) * mobileScale, this.y - (this.radius / 3) * mobileScale, (this.radius / 4) * mobileScale, (this.radius / 2) * mobileScale, -0.5, 0, Math.PI * 2); ctx.fill();
            if (this.isFortified) {
                ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(this.x, this.y, this.radius * mobileScale, 0, Math.PI * 2); ctx.stroke();
            } else {
                ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(this.x, this.y, this.radius * mobileScale, 0, Math.PI * 2); ctx.stroke();
            }
        } else if (this.isCamo) {
            ctx.fillStyle = '#5d4037';
            ctx.beginPath(); ctx.arc(this.x - 4 * mobileScale, this.y - 2 * mobileScale, 4 * mobileScale, 0, Math.PI * 2); ctx.arc(this.x + 5 * mobileScale, this.y + 3 * mobileScale, 5 * mobileScale, 0, Math.PI * 2); ctx.fill();
        } else if (this.data.isCeramic) {
            ctx.strokeStyle = '#7f8c8d'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius * mobileScale, 0, Math.PI * 2); ctx.stroke();
            if (this.isFortified) {
                ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 5;
                ctx.beginPath(); ctx.arc(this.x, this.y, this.radius * mobileScale, 0, Math.PI * 2); ctx.stroke();
            }
        }
        if (this.isFrozen) {
            ctx.strokeStyle = 'rgba(26, 188, 156, 0.9)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(this.x, this.y, (this.radius + 3) * mobileScale, 0, Math.PI * 2); ctx.stroke();
        } else if (this.slowFactor < 1.0) {
            ctx.strokeStyle = 'rgba(241, 196, 15, 0.7)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(this.x, this.y, (this.radius + 3) * mobileScale, 0, Math.PI * 2); ctx.stroke();
        }
    },

    _drawStunOverlay(ctx) {
        const mobileScale = MobileManager.isActive ? MobileManager.spriteScale : 1.0;
        const t = performance.now() / 1000;
        const fps = 15;
        const frame = Math.floor(t * fps) % fps;
        let stunAsset = Assets.get(Names.getStunFX(frame));
        if (!stunAsset || !stunAsset.loaded) stunAsset = Assets.get(Names.getStunFX(0));
        if (!stunAsset || !stunAsset.loaded) stunAsset = Assets.get('effect_stun');
        if (stunAsset && stunAsset.loaded) {
            const s = (this.data.size || 40) * GS * 0.8 * mobileScale;
            ctx.save();
            ctx.translate(this.x, this.y - this.radius * 0.6 * mobileScale - s / 2);
            ctx.rotate(t * 5);
            ctx.drawImage(stunAsset, -s / 2, -s / 2, s, s);
            ctx.restore();
        }
    }
};