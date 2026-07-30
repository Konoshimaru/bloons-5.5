// js/towerRenderer.js
import { TowerStats } from './towers/index.js';
import { HeroStats } from './heroes/index.js';
import { GameEngine } from './engine.js';
import { getBehavior } from './registry.js';
import { drawImageCentered, drawShadow } from './utils.js';
import Assets from './assets.js';
import { Names } from './names.js';
import { SpriteConfig } from './spriteConfig.js';
import { GLOBAL_SCALE } from './constants.js';
import { MobileManager } from './mobile.js'; // FIX: Import MobileManager

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

const FARM_VILLAGE_TYPES = new Set(['farm', 'village']);
const SHADOW_SCALE = 22;

// Cache for pre-rendered buff icons
const _buffIconCache = {};

export default {
    draw(ctx, isPreview = false, engine = null) {
        // FIX: Apply 1.2x scale on mobile
        const mobileScale = MobileManager.isActive ? MobileManager.spriteScale : 1.0;
        
        if (!isPreview && engine && engine.nightAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = engine.nightAlpha * 0.5;
            const glowR = 35 * GS * mobileScale;
            if (!this._nightGlowGradient || this._nightGlowRadius !== glowR || this._nightGlowX !== this.x || this._nightGlowY !== this.y) {
                this._nightGlowGradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowR);
                this._nightGlowGradient.addColorStop(0, 'rgba(255, 240, 150, 0.6)');
                this._nightGlowGradient.addColorStop(1, 'rgba(255, 240, 150, 0)');
                this._nightGlowRadius = glowR; this._nightGlowX = this.x; this._nightGlowY = this.y;
            }
            ctx.fillStyle = this._nightGlowGradient;
            ctx.beginPath(); ctx.arc(this.x, this.y, glowR, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        if (!isPreview) drawShadow(ctx, this.x, this.y, SHADOW_SCALE * (this.stats.scale || 1.0) * GS * mobileScale);
        this._drawHitscans(ctx);
        
        const behavior = getBehavior(this.type);
        if (behavior && behavior.draw) {
            behavior.draw(ctx, this, isPreview, engine);
        } else {
            this.drawBaseTower(ctx, isPreview);
        }
        
        // FIX: Draw bananas AFTER the tower so they are visible and clickable
        this._drawBananas(ctx);
        
        // Draw buffs above the monkey's head ONLY if this tower is currently selected
        if (!isPreview && GameEngine.selectedPlacedTower === this) {
            this._drawBuffs(ctx);
        }

        // FIX: Draw stun stars if stunned
        if (!isPreview && this.stunTimer > 0) {
            this._drawStunOverlay(ctx);
        }
    },

    drawPreview(ctx, x, y, type) {
        const mobileScale = MobileManager.isActive ? MobileManager.spriteScale : 1.0;
        const stats = TowerStats[type] || HeroStats[type];
        const scaleVal = (stats?.scale || 1.0) * GS * mobileScale;
        const asset = Assets.get(`tower_${type}_base`);
        if (asset && asset.loaded) {
            ctx.save();
            ctx.translate(x, y);
            
            // Use SpriteConfig for scale AND offset to match placed tower exactly
            const off = SpriteConfig[type]?.["base"] || { x: 0, y: 0, scale: 1 };
            const size = SpriteConfig[type]?.["base"] ? (45 * (off.scale || 1) * GS * mobileScale) : (stats?.drawSize ? stats.drawSize * GS * mobileScale : 45 * scaleVal);
            
            const maxDim = Math.max(asset.width, asset.height);
            if (maxDim > 0 && !isNaN(size)) {
                const scale = size / maxDim;
                const w = asset.width * scale;
                const h = asset.height * scale;
                // Apply X and Y offsets from SpriteConfig
                ctx.drawImage(asset, -w / 2 + (off.x || 0), -h / 2 + (off.y || 0), w, h);
            } else {
                drawImageCentered(ctx, asset, 45 * scaleVal);
            }
            ctx.restore();
        } else {
            ctx.fillStyle = '#795548';
            ctx.beginPath(); ctx.arc(x, y, 15 * scaleVal, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#D7BCA3';
            ctx.beginPath(); ctx.arc(x, y, 10 * scaleVal, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#795548';
            ctx.beginPath(); ctx.arc(x - 12 * scaleVal, y - 8 * scaleVal, 5 * scaleVal, 0, Math.PI * 2); ctx.arc(x + 12 * scaleVal, y - 8 * scaleVal, 5 * scaleVal, 0, Math.PI * 2); ctx.fill();
        }
    },

    // FIX: Merged redundant wrapper directly into the public function
    drawBaseTower(ctx, isPreview = false) {
        if (FARM_VILLAGE_TYPES.has(this.type)) { this._drawFarmOrVillage(ctx); return; }
        const { baseAsset, armAsset, targetSize, isCustomBase } = this.getActiveAssets();
        const isStatic = this.stats.isStaticRotation || false;
        if (this._drawFullBodyAnimation(ctx, isStatic, targetSize, isCustomBase)) return;

        let activeArmAsset = armAsset;
        if (this.attackAnimActive && !this.isFullAnim) {
            const animAsset = Assets.get(`${this.attackPrefix}attack_${this.attackAnimFrame}`);
            if (animAsset && animAsset.loaded) activeArmAsset = animAsset;
        }
        if (baseAsset && baseAsset.loaded) { this._drawSprite(ctx, baseAsset, armAsset, activeArmAsset, targetSize, isStatic, isCustomBase); return; }
        this._drawFallbackSprite(ctx, isStatic);
    },

    _drawHitscans(ctx) {
        for (const h of this.hitscans) {
            ctx.globalAlpha = h.life / 0.1;
            ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(h.x1, h.y1); ctx.lineTo(h.x2, h.y2); ctx.stroke();
            ctx.globalAlpha = 1;
        }
    },

    _drawBananas(ctx) {
        const mobileScale = MobileManager.isActive ? MobileManager.spriteScale : 1.0;
        const bananaAsset = Assets.get(Names.getBanana());
        for (const b of this.bananas) {
            ctx.globalAlpha = Math.min(1, b.life / 2);
            if (bananaAsset && bananaAsset.loaded) {
                const s = (b.isCrate ? 40 : 25) * GS * mobileScale;
                ctx.drawImage(bananaAsset, b.x - s / 2, (b.y - b.arc) - s / 2, s, s);
            } else {
                ctx.fillStyle = '#f1c40f';
                ctx.beginPath(); ctx.arc(b.x, b.y - b.arc, 4 * GS * mobileScale, Math.PI * 0.2, Math.PI * 1.2); ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
    },

    _drawAsset(ctx, asset, type, key, defaultSize) {
        if (!asset || !asset.loaded) return;
        const mobileScale = MobileManager.isActive ? MobileManager.spriteScale : 1.0;
        const off = SpriteConfig[type]?.[key] || { x: 0, y: 0, scale: 1 };
        const size = (SpriteConfig[type]?.[key] ? (45 * (off.scale || 1) * GS) : defaultSize) * mobileScale;
        const maxDim = Math.max(asset.width, asset.height);
        if (maxDim === 0 || isNaN(size)) return; 
        const scale = size / maxDim;
        const w = asset.width * scale; const h = asset.height * scale;
        ctx.drawImage(asset, -w / 2 + (off.x || 0), -h / 2 + (off.y || 0), w, h);
    },

    _drawFullBodyAnimation(ctx, isStatic, targetSize, isCustomBase) {
        if (!this.attackAnimActive || !this.isFullAnim) return false;
        const animAsset = Assets.get(`${this.attackPrefix}attack_full_${this.attackAnimFrame}`);
        if (!animAsset || !animAsset.loaded) return false;
        ctx.save(); ctx.translate(this.x, this.y);
        if (!isStatic) ctx.rotate(this.angle + Math.PI / 2);
        this._drawAsset(ctx, animAsset, this.type, `attack_full_${this.attackAnimFrame}`, targetSize);
        ctx.restore();
        if (!isCustomBase) {
            ctx.save(); ctx.translate(this.x, this.y);
            if (!isStatic) ctx.rotate(this.angle + Math.PI / 2);
            for (let p = 1; p <= 3; p++) {
                const t = this.upgrades[p - 1];
                if (t > 0) {
                    const ovAsset = Assets.get(`tower_${this.type}_p${p}_t${t}`);
                    if (ovAsset && ovAsset.loaded) { const overlayId = `${this.type}_p${p}_t${t}`; this._drawAsset(ctx, ovAsset, overlayId, "base", targetSize); }
                }
            }
            ctx.restore();
        }
        return true;
    },

    _drawSprite(ctx, baseAsset, armAsset, activeArmAsset, targetSize, isStatic, isCustomBase) {
        ctx.save(); ctx.translate(this.x, this.y);
        if (!isStatic) ctx.rotate(this.angle + Math.PI / 2);
        if (armAsset && activeArmAsset && activeArmAsset.loaded) {
            let key = this.attackAnimFrame === 0 ? "arm" : `attack_${this.attackAnimFrame}`;
            this._drawAsset(ctx, activeArmAsset, this.type, key, targetSize);
        }
        if (!isCustomBase) {
            for (let p = 1; p <= 3; p++) {
                const t = this.upgrades[p - 1];
                if (t > 0) {
                    const ovAsset = Assets.get(`tower_${this.type}_p${p}_t${t}_a`);
                    if (ovAsset && ovAsset.loaded) { const overlayId = `${this.type}_p${p}_t${t}`; this._drawAsset(ctx, ovAsset, overlayId, "base", targetSize); }
                }
            }
        }
        this._drawAsset(ctx, baseAsset, this.type, "base", targetSize);
        if (!isCustomBase) {
            for (let p = 1; p <= 3; p++) {
                const t = this.upgrades[p - 1];
                if (t > 0) {
                    const ovAsset = Assets.get(`tower_${this.type}_p${p}_t${t}`);
                    if (ovAsset && ovAsset.loaded) { const overlayId = `${this.type}_p${p}_t${t}`; this._drawAsset(ctx, ovAsset, overlayId, "base", targetSize); }
                }
            }
        }
        ctx.restore();
    },

    _drawFarmOrVillage(ctx) {
        const mobileScale = MobileManager.isActive ? MobileManager.spriteScale : 1.0;
        const asset = Assets.get(`tower_${this.type}_base`);
        if (asset && asset.loaded) {
            ctx.save(); ctx.translate(this.x, this.y); drawImageCentered(ctx, asset, 45 * GS * mobileScale);
            for (let p = 1; p <= 3; p++) {
                const t = this.upgrades[p - 1];
                if (t > 0) {
                    const ovAsset = Assets.get(`tower_${this.type}_p${p}_t${t}`);
                    if (ovAsset && ovAsset.loaded) drawImageCentered(ctx, ovAsset, 45 * GS * mobileScale);
                }
            }
            ctx.restore();
        } else {
            if (this.type === 'farm') {
                ctx.fillStyle = '#8b6b3f'; ctx.fillRect(this.x - 12 * GS * mobileScale, this.y - 2 * GS * mobileScale, 24 * GS * mobileScale, 16 * GS * mobileScale);
                ctx.fillStyle = '#795548'; ctx.beginPath(); ctx.moveTo(this.x - 14 * GS * mobileScale, this.y - 2 * GS * mobileScale); ctx.lineTo(this.x, this.y - 14 * GS * mobileScale); ctx.lineTo(this.x + 14 * GS * mobileScale, this.y - 2 * GS * mobileScale); ctx.fill();
                ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.arc(this.x + 15 * GS * mobileScale, this.y - 10 * GS * mobileScale, 12 * GS * mobileScale, 0, Math.PI * 2); ctx.fill();
                if (this.stats.isBank) { ctx.fillStyle = '#f1c40f'; ctx.font = `${10 * GS * mobileScale}px Arial`; ctx.textAlign = 'center'; ctx.fillText('$', this.x, this.y + 10 * GS * mobileScale); }
            }
            if (this.type === 'village') {
                ctx.fillStyle = '#8e44ad'; ctx.beginPath(); ctx.moveTo(this.x, this.y - 15 * GS * mobileScale); ctx.lineTo(this.x + 15 * GS * mobileScale, this.y + 10 * GS * mobileScale); ctx.lineTo(this.x - 15 * GS * mobileScale, this.y + 10 * GS * mobileScale); ctx.fill();
                ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(this.x, this.y, 5 * GS * mobileScale, 0, Math.PI * 2); ctx.fill();
            }
        }
    },

    _drawFallbackSprite(ctx, isStatic) {
        const mobileScale = MobileManager.isActive ? MobileManager.spriteScale : 1.0;
        ctx.save(); ctx.translate(this.x, this.y);
        if (!isStatic) ctx.rotate(this.angle);
        const scale = (this.stats.scale || 1.0) * GS * mobileScale;
        ctx.fillStyle = '#795548'; ctx.beginPath(); ctx.arc(0, 0, 15 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#D7BCA3'; ctx.beginPath(); ctx.arc(0, 0, 10 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#795548'; ctx.beginPath(); ctx.arc(-12 * scale, -8 * scale, 5 * scale, 0, Math.PI * 2); ctx.arc(12 * scale, -8 * scale, 5 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    },

    // FIX 1B: Draws buff icons using pre-rendered offscreen canvases instead of vector paths
    _drawBuffs(ctx) {
        const buffsToDraw = [];
        
        // Legacy buffs
        if (this.alchBuff && (!this.alchBuff.isPerm || this.alchBuff.shotsLeft > 0)) {
            buffsToDraw.push({ type: 'alch', stacks: this.alchBuff.shotsLeft > 0 ? this.alchBuff.shotsLeft : '', name: 'Alchemist Buff' });
        }
        if (this.overclockTimer > 0) {
            buffsToDraw.push({ type: 'oc', stacks: this.ultraboostStacks > 1 ? this.ultraboostStacks : '', name: 'Overclock' });
        }

        // Custom stackable buffs (Village Path 1, Call to Arms, etc.)
        if (this.activeBuffs && this.activeBuffs.length > 0) {
            for (let buff of this.activeBuffs) {
                buffsToDraw.push({ 
                    type: buff.data.type || 'generic', 
                    stacks: buff.stacks > 1 ? buff.stacks : '', 
                    name: buff.name 
                });
            }
        }

        if (buffsToDraw.length === 0) return;

        const spacing = 20 * GS;
        const totalWidth = (buffsToDraw.length - 1) * spacing;
        const startX = this.x - totalWidth / 2;
        const y = this.y - (this.hitRadius * 1.5) - 15 * GS; 

        buffsToDraw.forEach((buff, i) => {
            const x = startX + i * spacing;
            const iconCanvas = this._getBuffIconCanvas(buff.type);
            // Draw the cached 32x32 icon centered at x, y
            ctx.drawImage(iconCanvas, x - 16, y - 16);

            // Draw stacks directly on main ctx
            if (buff.stacks !== '' && buff.stacks !== undefined) {
                ctx.fillStyle = 'rgba(0,0,0,0.85)';
                ctx.beginPath();
                ctx.arc(x + 7 * GS, y + 7 * GS, 7 * GS, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${10 * GS}px Nunito, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(buff.stacks, x + 7 * GS, y + 7.5 * GS);
            }
        });
    },

    // Pre-renders buff icons to an offscreen canvas to avoid per-frame vector drawing
    _getBuffIconCanvas(type) {
        if (_buffIconCache[type]) return _buffIconCache[type];
        
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const sizeScale = 1.2;
        
        ctx.translate(16, 16); // Center drawing

        let bgColor = '#2ecc71'; // generic green
        if (type === 'alch') bgColor = '#9b59b6'; // purple
        if (type === 'oc') bgColor = '#e74c3c'; // red
        if (type === 'village') bgColor = '#3498db'; // blue
        if (type === 'jd') bgColor = '#27ae60'; // green
        if (type === 'ptr') bgColor = '#f1c40f'; // yellow
        if (type === 'pm') bgColor = '#e67e22'; // orange
        if (type === 'pe') bgColor = '#c0392b'; // dark red
        if (type === 'cta') bgColor = '#9b59b6'; // purple (Call to Arms)
        if (type === 'radar') bgColor = '#16a085'; // teal
        if (type === 'mib') bgColor = '#34495e'; // dark blue/grey

        // Draw background circle
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.arc(0, 0, 10 * GS * sizeScale, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 2 * GS;
        ctx.stroke();

        // Draw specific symbol
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 * GS;
        
        if (type === 'village') {
            ctx.beginPath();
            ctx.moveTo(0, -6 * GS * sizeScale);
            ctx.lineTo(5 * GS * sizeScale, 0);
            ctx.lineTo(5 * GS * sizeScale, 5 * GS * sizeScale);
            ctx.lineTo(-5 * GS * sizeScale, 5 * GS * sizeScale);
            ctx.lineTo(-5 * GS * sizeScale, 0);
            ctx.closePath();
            ctx.fill();
        } else if (type === 'oc') {
            ctx.beginPath();
            ctx.moveTo(-2 * GS * sizeScale, -7 * GS * sizeScale);
            ctx.lineTo(4 * GS * sizeScale, -1 * GS * sizeScale);
            ctx.lineTo(0, 0);
            ctx.lineTo(2 * GS * sizeScale, 7 * GS * sizeScale);
            ctx.lineTo(-4 * GS * sizeScale, 1 * GS * sizeScale);
            ctx.lineTo(0, 0);
            ctx.closePath();
            ctx.fill();
        } else if (type === 'alch') {
            ctx.beginPath();
            ctx.moveTo(0, -7 * GS * sizeScale);
            ctx.bezierCurveTo(5 * GS * sizeScale, -2 * GS * sizeScale, 5 * GS * sizeScale, 5 * GS * sizeScale, 0, 5 * GS * sizeScale);
            ctx.bezierCurveTo(-5 * GS * sizeScale, 5 * GS * sizeScale, -5 * GS * sizeScale, -2 * GS * sizeScale, 0, -7 * GS * sizeScale);
            ctx.fill();
        } else if (type === 'jd') {
            ctx.beginPath();
            ctx.ellipse(0, 3 * GS * sizeScale, 5 * GS * sizeScale, 2 * GS * sizeScale, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(-3 * GS * sizeScale, -4 * GS * sizeScale, 6 * GS * sizeScale, 7 * GS * sizeScale);
            ctx.beginPath();
            ctx.ellipse(0, -4 * GS * sizeScale, 3 * GS * sizeScale, 1 * GS * sizeScale, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (type === 'ptr') {
            ctx.beginPath();
            ctx.arc(0, 0, 5 * GS * sizeScale, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-7 * GS * sizeScale, 0); ctx.lineTo(-2 * GS * sizeScale, 0);
            ctx.moveTo(2 * GS * sizeScale, 0); ctx.lineTo(7 * GS * sizeScale, 0);
            ctx.moveTo(0, -7 * GS * sizeScale); ctx.lineTo(0, -2 * GS * sizeScale);
            ctx.moveTo(0, 2 * GS * sizeScale); ctx.lineTo(0, 7 * GS * sizeScale);
            ctx.stroke();
        } else if (type === 'pm') {
            ctx.beginPath();
            ctx.moveTo(-5 * GS * sizeScale, -2 * GS * sizeScale);
            ctx.lineTo(0, -5 * GS * sizeScale);
            ctx.lineTo(5 * GS * sizeScale, -2 * GS * sizeScale);
            ctx.lineTo(5 * GS * sizeScale, 4 * GS * sizeScale);
            ctx.lineTo(0, 7 * GS * sizeScale);
            ctx.lineTo(-5 * GS * sizeScale, 4 * GS * sizeScale);
            ctx.closePath();
            ctx.fill();
        } else if (type === 'pe') {
            ctx.beginPath();
            ctx.moveTo(0, -7 * GS * sizeScale);
            ctx.lineTo(4 * GS * sizeScale, -2 * GS * sizeScale);
            ctx.lineTo(1 * GS * sizeScale, -2 * GS * sizeScale);
            ctx.lineTo(1 * GS * sizeScale, 6 * GS * sizeScale);
            ctx.lineTo(-1 * GS * sizeScale, 6 * GS * sizeScale);
            ctx.lineTo(-1 * GS * sizeScale, -2 * GS * sizeScale);
            ctx.lineTo(-4 * GS * sizeScale, -2 * GS * sizeScale);
            ctx.closePath();
            ctx.fill();
        } else if (type === 'cta') {
            ctx.beginPath();
            ctx.moveTo(-4 * GS * sizeScale, -3 * GS * sizeScale);
            ctx.lineTo(2 * GS * sizeScale, -6 * GS * sizeScale);
            ctx.lineTo(2 * GS * sizeScale, 6 * GS * sizeScale);
            ctx.lineTo(-4 * GS * sizeScale, 3 * GS * sizeScale);
            ctx.closePath();
            ctx.fill();
            ctx.fillRect(-7 * GS * sizeScale, -2 * GS * sizeScale, 3 * GS * sizeScale, 4 * GS * sizeScale);
        } else if (type === 'radar') {
            ctx.beginPath();
            ctx.moveTo(-5 * GS * sizeScale, -2 * GS * sizeScale);
            ctx.quadraticCurveTo(0, -8 * GS * sizeScale, 5 * GS * sizeScale, -2 * GS * sizeScale);
            ctx.fill();
            ctx.fillRect(-1 * GS * sizeScale, -1 * GS * sizeScale, 2 * GS * sizeScale, 6 * GS * sizeScale);
            ctx.beginPath();
            ctx.arc(0, 6 * GS * sizeScale, 2 * GS * sizeScale, 0, Math.PI * 2);
            ctx.fill();
        } else if (type === 'mib') {
            ctx.beginPath();
            ctx.moveTo(0, -7 * GS * sizeScale);
            ctx.lineTo(5 * GS * sizeScale, -4 * GS * sizeScale);
            ctx.lineTo(4 * GS * sizeScale, 4 * GS * sizeScale);
            ctx.lineTo(0, 7 * GS * sizeScale);
            ctx.lineTo(-4 * GS * sizeScale, 4 * GS * sizeScale);
            ctx.lineTo(-5 * GS * sizeScale, -4 * GS * sizeScale);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i * 4 * Math.PI / 5) - Math.PI / 2;
                const x1 = Math.cos(angle) * 6 * GS * sizeScale;
                const y1 = Math.sin(angle) * 6 * GS * sizeScale;
                if (i === 0) ctx.moveTo(x1, y1);
                else ctx.lineTo(x1, y1);
            }
            ctx.closePath();
            ctx.fill();
        }
        
        _buffIconCache[type] = canvas;
        return canvas;
    },

    // FIX: Draw stun stars overlay (same as bloons)
    _drawStunOverlay(ctx) {
        const mobileScale = MobileManager.isActive ? MobileManager.spriteScale : 1.0;
        const t = performance.now() / 1000;
        const fps = 15;
        const frame = Math.floor(t * fps) % fps;
        let stunAsset = Assets.get(Names.getStunFX(frame));
        if (!stunAsset || !stunAsset.loaded) stunAsset = Assets.get(Names.getStunFX(0));
        if (!stunAsset || !stunAsset.loaded) stunAsset = Assets.get('effect_stun');
        if (stunAsset && stunAsset.loaded) {
            const s = 30 * GS * mobileScale; // Scaled size for towers
            ctx.save();
            ctx.translate(this.x, this.y - this.hitRadius - s / 2);
            ctx.rotate(t * 5);
            ctx.drawImage(stunAsset, -s / 2, -s / 2, s, s);
            ctx.restore();
        }
    }
};