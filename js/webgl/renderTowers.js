// js/webgl/renderTowers.js
import { Sprite, Container, Texture, Graphics, FillGradient, Text } from 'pixi.js';
import { PixiApp } from './pixiApp.js';
import { PixiAssets } from './pixiAssets.js';
import { CanvasGraphicsAdapter } from './canvasGraphicsAdapter.js';
import { SpriteConfig } from '../spriteConfig.js';
import { GLOBAL_SCALE } from '../constants.js';
import { getSpriteScale } from '../mobile.js';
import * as Const from './rendererConstants.js';

export const TowersRenderer = {
    _drawTowers(engine) {
        const layer = PixiApp.layer('towers');
        const seen = new Set();
        const mscale = getSpriteScale();

        for (const tower of engine.towers) {
            if (!tower) continue;
            seen.add(tower);

            let entry = this._towerSprites.get(tower);
            if (!entry) {
                const container = new Container();
                const nightGlow = new Graphics();
                const shadow = new Graphics();
                const arm = new Sprite(); arm.anchor.set(0.5);
                const aOverlayLayer = new Container();
                const base = new Sprite(); base.anchor.set(0.5);
                const overlayLayer = new Container();
                const catapult = new Sprite(); catapult.anchor.set(0.5); catapult.visible = false;
                container.addChild(nightGlow, shadow, arm, aOverlayLayer, base, overlayLayer, catapult);
                layer.addChild(container);
                // Stun overlay lives on the world layer (not inside the rotated
                // container) so the stun sprite stays world-aligned, matching the
                // Canvas2D _drawStunOverlay which draws in world space.
                const stun = new Sprite();
                stun.anchor.set(0.5);
                layer.addChild(stun);
                entry = { container, nightGlow, shadow, arm, aOverlayLayer, base, overlayLayer, catapult, stun, aOverlays: [], overlays: [] };
                this._towerSprites.set(tower, entry);
            }

            this._updateTowerVisual(tower, entry);

            // Shadow must stay flat/world-aligned (matches Canvas2D drawShadow,
            // which draws in world space before any rotation transform).
            // It's parented under `container` for free position-following, so
            // counter-rotate it to cancel out container.rotation.
            entry.shadow.rotation = -entry.container.rotation;

            const shadowR = Const.TOWER_SHADOW_SCALE * (tower.stats?.scale || 1.0) * GLOBAL_SCALE * mscale;
            entry.shadow.clear();
            entry.shadow.ellipse(0, shadowR * Const.SHADOW_Y_OFFSET, shadowR, shadowR * Const.SHADOW_SQUASH)
                .fill({ color: Const.SHADOW_COLOR, alpha: Const.SHADOW_ALPHA });

            entry.nightGlow.clear();
            if (engine.nightAlpha > 0) {
                const glowR = Const.NIGHT_GLOW_RADIUS * GLOBAL_SCALE * mscale;
                if (!entry.nightGlowGradient || entry.nightGlowGradientR !== glowR) {
                    entry.nightGlowGradient = new FillGradient({
                        type: 'radial', center: { x: 0, y: 0 }, innerRadius: 0,
                        outerCenter: { x: 0, y: 0 }, outerRadius: glowR,
                        colorStops: [
                            { offset: 0, color: Const.NIGHT_GLOW_INNER_COLOR },
                            { offset: 1, color: Const.NIGHT_GLOW_OUTER_COLOR },
                        ],
                        // 'global' (not 'local'): Pixi v8's local-space radial
                        // gradients render as a flat solid disc (per-pixel
                        // alpha is lost); global maps the texture's fade onto
                        // the exact circle radius, matching the Canvas2D
                        // radial-gradient glow. Verified pixel-level.
                        textureSpace: 'global',
                    });
                    entry.nightGlowGradientR = glowR;
                }
                entry.nightGlow.circle(0, 0, glowR).fill({ fill: entry.nightGlowGradient, alpha: engine.nightAlpha * 0.5 });
            }

            // Stun overlay (port of towerRenderer.js _drawStunOverlay: a
            // spinning 30*GS icon floating above the tower, offset up by
            // hitRadius + s/2, rotating at t*5 rad/s).
            const stunT = performance.now() / 1000;
            if (tower.stunTimer && tower.stunTimer > 0) {
                // effect_stun_1..effect_stun_15 are the actual files (see
                // sprites/effects/stun_1.png..stun_15.png). The canvas
                // computes `% 15` -> 0..14 which requests effect_stun_0
                // (a missing file) and blinks once per loop; +1 maps onto the
                // real 15-frame sequence so every frame exists.
                const frame = (Math.floor(stunT * 15) % 15) + 1;
                const stunTexture = PixiAssets.get(`effect_stun_${frame}`);
                if (stunTexture !== Texture.EMPTY) {
                    if (entry.stun.texture !== stunTexture) entry.stun.texture = stunTexture;
                    const s = 30 * GLOBAL_SCALE * mscale;
                    entry.stun.width = s;
                    entry.stun.height = s;
                    entry.stun.x = tower.x;
                    entry.stun.y = tower.y - (tower.hitRadius || 20) - s / 2;
                    entry.stun.rotation = stunT * 5;
                    entry.stun.visible = true;
                } else {
                    entry.stun.visible = false;
                }
            } else {
                entry.stun.visible = false;
            }
        }

        for (const [tower, entry] of this._towerSprites) {
            if (!seen.has(tower)) { entry.container.destroy({ children: true }); entry.stun?.destroy(); this._towerSprites.delete(tower); }
        }
    },

    _drawTowerEffects(engine) {
        const layer = PixiApp.layer('towerUnderEffects');
        const seen = new Set();

        for (const tower of engine.towers) {
            if (!tower) continue;
            
            // FIX: Reverted Gojo, Geto, and Sauda. The adapter hack failed because 
            // it cannot handle sprites or screen blending. They will just render their 
            // base sprites until properly ported natively.
            const hasEffect =
                (tower.type === 'ice' && tower.stats?.arcticWind) ||
                (tower.type === 'mermonkey' && (tower.activeRiptides?.length > 0 || tower.tranceActive > 0 || tower.totemX !== undefined)) ||
                (tower.type === 'alchemist' && tower.isMonster) ||
                (tower.type === 'dart' && tower.fanClubBuffTimer > 0) ||
                (tower.type === 'wizard' && tower.fireWells?.length > 0) ||
                tower.type === 'ace' ||
                (tower.type === 'gwendolin' && tower.cocktails?.length > 0) ||
                (tower.type === 'obyn' && tower.activeTrap) ||
                (tower.type === 'engineer' && tower.activeTrap) ||
                (tower.type === 'quincy' && tower.stormOfArrows?.active);

            if (!hasEffect) continue;
            seen.add(tower);

            let entry = this._towerEffectSprites.get(tower);
            if (!entry) {
                const graphics = new Graphics();
                layer.addChild(graphics);
                entry = { graphics, adapter: new CanvasGraphicsAdapter(graphics) };
                this._towerEffectSprites.set(tower, entry);
            }

            const { graphics, adapter } = entry;
            graphics.clear();
            adapter.reset();

            if (tower.type === 'ice' && tower.stats?.arcticWind) this._drawArcticWind(adapter, tower);
            else if (tower.type === 'mermonkey') { this._drawRiptides(adapter, tower); this._drawTranceAndTotem(adapter, tower); }
            else if (tower.type === 'alchemist' && tower.isMonster) this._drawMonsterForm(adapter, tower);
            else if (tower.type === 'dart' && tower.fanClubBuffTimer > 0) this._drawFanClubAura(adapter, tower);
            else if (tower.type === 'wizard') this._drawFireWells(adapter, tower);
            else if (tower.type === 'ace') this._drawAceLandingPad(adapter, tower);
            else if (tower.type === 'gwendolin') this._drawCocktails(adapter, tower);
            else if (tower.type === 'obyn') this._drawObynTrap(adapter, tower);
            else if (tower.type === 'engineer') { this._drawEngineerTrap(adapter, tower); this._drawEngineerTrapText(entry, layer, tower); }
            else if (tower.type === 'quincy') this._drawStormOfArrows(adapter, tower);
        }

        for (const [tower, entry] of this._towerEffectSprites) {
            if (!seen.has(tower)) { entry.graphics.destroy(); entry.trapText?.destroy(); this._towerEffectSprites.delete(tower); }
        }
    },

    // --- Existing Tower Effects ---
    _drawArcticWind(ctx, tower) {
        ctx.globalAlpha = 0.7; ctx.fillStyle = '#a3e4ff'; ctx.strokeStyle = '#74c2ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(tower.x, tower.y, 45 * GLOBAL_SCALE, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.globalAlpha = 1;
    },
    _drawFireWells(ctx, tower) {
        for (const w of tower.fireWells) {
            ctx.globalAlpha = Math.min(1, w.life / w.maxLife) * 0.6;
            const grad = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.radius);
            grad.addColorStop(0, 'rgba(255, 100, 0, 0.8)'); grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }
    },
    _drawAceLandingPad(ctx, tower) {
        ctx.fillStyle = 'rgba(50, 50, 50, 0.5)';
        ctx.fillRect(tower.x - 22 * GLOBAL_SCALE, tower.y - 22 * GLOBAL_SCALE, 44 * GLOBAL_SCALE, 44 * GLOBAL_SCALE);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tower.x - 22 * GLOBAL_SCALE, tower.y - 22 * GLOBAL_SCALE);
        ctx.lineTo(tower.x + 22 * GLOBAL_SCALE, tower.y - 22 * GLOBAL_SCALE);
        ctx.lineTo(tower.x + 22 * GLOBAL_SCALE, tower.y + 22 * GLOBAL_SCALE);
        ctx.lineTo(tower.x - 22 * GLOBAL_SCALE, tower.y + 22 * GLOBAL_SCALE);
        ctx.closePath(); ctx.stroke();
    },
    _drawCocktails(ctx, tower) {
        for (const c of tower.cocktails) {
            ctx.globalAlpha = Math.min(1, c.life / 2);
            ctx.fillStyle = '#e67e22'; ctx.beginPath(); ctx.arc(c.x, c.y, 50, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(c.x, c.y, 30, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
    },
    _drawObynTrap(ctx, tower) {
        const trap = tower.activeTrap;
        ctx.fillStyle = trap.rbe >= trap.maxRbe ? '#27ae60' : '#2ecc71';
        ctx.beginPath(); ctx.arc(trap.x, trap.y, trap.radius, 0, Math.PI * 2); ctx.fill();
    },
    _drawEngineerTrap(ctx, tower) {
        // Port of engineer.js draw(): an orange/red 24px box at the trap's
        // world position (trap.x/y are WORLD coords; the layer is the
        // panned world-space towerUnderEffects layer, so use them directly).
        const trap = tower.activeTrap;
        if (!trap) return;
        ctx.fillStyle = trap.rbe >= trap.maxRbe ? '#e74c3c' : '#e67e22';
        ctx.fillRect(trap.x - 12 * GLOBAL_SCALE, trap.y - 12 * GLOBAL_SCALE, 24 * GLOBAL_SCALE, 24 * GLOBAL_SCALE);
    },
    _drawEngineerTrapText(entry, layer, tower) {
        const trap = tower.activeTrap;
        if (!trap) return;
        if (!entry.trapText) {
            entry.trapText = new Text({ text: '', style: { fontFamily: 'Arial', fontSize: 10 * GLOBAL_SCALE, fontWeight: 'bold', fill: '#000000' } });
            entry.trapText.anchor.set(0.5);
            layer.addChild(entry.trapText);
        }
        const text = `${trap.rbe}/${trap.maxRbe}`;
        if (entry.trapText.text !== text) entry.trapText.text = text;
        entry.trapText.x = trap.x; entry.trapText.y = trap.y + 3 * GLOBAL_SCALE;
    },
    _drawStormOfArrows(ctx, tower) {
        const soa = tower.stormOfArrows;
        ctx.globalAlpha = 0.15; ctx.fillStyle = '#9b59b6';
        ctx.beginPath(); ctx.arc(soa.x, soa.y, soa.radius, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2;
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2; const r = Math.random() * soa.radius;
            const x1 = soa.x + Math.cos(angle) * r; const y1 = soa.y + Math.sin(angle) * r;
            ctx.beginPath(); ctx.moveTo(x1, y1 - 12); ctx.lineTo(x1, y1); ctx.stroke();
        }
    },
    _drawTranceAndTotem(ctx, tower) {
        if (tower.tranceActive > 0) {
            const t = performance.now() / 1000;
            const cx = tower.totemX !== undefined ? tower.totemX : tower.x;
            const cy = tower.totemY !== undefined ? tower.totemY : tower.y;
            ctx.globalAlpha = 0.5; ctx.strokeStyle = '#9b59b6'; ctx.lineWidth = 4; ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const startAng = t * 4 + (i * Math.PI / 2);
                ctx.moveTo(cx, cy); ctx.arc(cx, cy, 30 + Math.sin(t * 5) * 10, startAng, startAng + Math.PI * 1.5);
            }
            ctx.stroke(); ctx.globalAlpha = 1;
        }
        if (tower.totemX !== undefined) {
            ctx.fillStyle = '#8e44ad'; ctx.fillRect(tower.totemX - 5, tower.totemY - 20, 10, 20);
            ctx.fillStyle = '#9b59b6'; ctx.beginPath(); ctx.arc(tower.totemX, tower.totemY - 20, 6, 0, Math.PI * 2); ctx.fill();
        }
    },
    _drawRiptides(ctx, tower) {
        for (const r of tower.activeRiptides) {
            ctx.fillStyle = '#1abc9c'; ctx.beginPath();
            const cos = Math.cos(r.angle), sin = Math.sin(r.angle);
            const pt = (lx, ly) => [r.x + lx * cos - ly * sin, r.y + lx * sin + ly * cos];
            const [x1, y1] = pt(r.radius, 0); const [x2, y2] = pt(-r.radius, -r.radius); const [x3, y3] = pt(-r.radius, r.radius);
            ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.fill();
        }
    },
    _drawMonsterForm(ctx, tower) {
        ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.arc(tower.x, tower.y, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(tower.x, tower.y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(tower.x, tower.y, 4, 0, Math.PI * 2); ctx.fill();
    },
    _drawFanClubAura(ctx, tower) {
        const s = (tower.stats?.scale || 1.0) * GLOBAL_SCALE;
        ctx.fillStyle = '#34495e'; ctx.beginPath(); ctx.arc(tower.x, tower.y, 15 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#D7BCA3'; ctx.beginPath(); ctx.arc(tower.x, tower.y + 2 * s, 10 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#34495e'; ctx.beginPath();
        ctx.arc(tower.x - 12 * s, tower.y - 8 * s, 5 * s, 0, Math.PI * 2);
        ctx.arc(tower.x + 12 * s, tower.y - 8 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
        const cos = Math.cos(tower.angle), sin = Math.sin(tower.angle);
        const pt = (lx, ly) => [tower.x + lx * cos - ly * sin, tower.y + lx * sin + ly * cos];
        if (tower.fanClubType === 'plasma') {
            ctx.fillStyle = '#9b59b6'; let c = [pt(0, -4 * s), pt(20 * s, -4 * s), pt(20 * s, 4 * s), pt(0, 4 * s)];
            ctx.beginPath(); ctx.moveTo(...c[0]); ctx.lineTo(...c[1]); ctx.lineTo(...c[2]); ctx.lineTo(...c[3]); ctx.fill();
            ctx.fillStyle = '#e74c3c'; c = [pt(0, -2 * s), pt(15 * s, -2 * s), pt(15 * s, 2 * s), pt(0, 2 * s)];
            ctx.beginPath(); ctx.moveTo(...c[0]); ctx.lineTo(...c[1]); ctx.lineTo(...c[2]); ctx.lineTo(...c[3]); ctx.fill();
        } else {
            ctx.fillStyle = '#34495e'; let c = [pt(0, -4 * s), pt(20 * s, -4 * s), pt(20 * s, 4 * s), pt(0, 4 * s)];
            ctx.beginPath(); ctx.moveTo(...c[0]); ctx.lineTo(...c[1]); ctx.lineTo(...c[2]); ctx.lineTo(...c[3]); ctx.fill();
            ctx.fillStyle = '#e74c3c'; ctx.beginPath();
            ctx.moveTo(...pt(20 * s, 0)); ctx.lineTo(...pt(15 * s, -5 * s)); ctx.lineTo(...pt(15 * s, 5 * s)); ctx.fill();
        }
    },

    _updateTowerVisual(tower, entry) {
        if (tower.type === 'dart') { this._updateDartVisual(tower, entry); return; }
        if (tower.type === 'mermonkey') { this._updateMermonkeyVisual(tower, entry); return; }
        this._updateGenericTowerVisual(tower, entry);
    },
    _updateGenericTowerVisual(tower, entry) {
        const { container, arm, aOverlayLayer, base, overlayLayer, catapult } = entry;
        const type = tower.type;
        if (type === 'alchemist' && tower.isMonster) {
            arm.visible = false; base.visible = false; catapult.visible = false;
            this._reconcileOverlayList(aOverlayLayer, entry.aOverlays, [], 0);
            this._reconcileOverlayList(overlayLayer, entry.overlays, [], 0);
            container.x = tower.x; container.y = tower.y; return;
        }
        // Sauda hides her own sprite entirely during Sword Charge (ability2) —
        // the charging duplicates in renderHeroVFX.js stand in for her instead.
        // Original: `if (!tower.chargeLockout || tower.chargeLockout <= 0) { ...draw... }`
        if (type === 'sauda' && tower.chargeLockout > 0) {
            arm.visible = false; base.visible = false; catapult.visible = false;
            this._reconcileOverlayList(aOverlayLayer, entry.aOverlays, [], 0);
            this._reconcileOverlayList(overlayLayer, entry.overlays, [], 0);
            container.x = tower.x; container.y = tower.y; return;
        }
        arm.visible = true; base.visible = true;
        const targetSize = (tower.stats?.drawSize || (45 * (tower.stats?.scale || 1.0))) * GLOBAL_SCALE * getSpriteScale();
        const attackPrefix = tower.attackPrefix || `tower_${type}_`;
        let bestTier = 0, bestPath = 0;
        for (let p = 1; p <= 3; p++) { if ((tower.upgrades?.[p - 1] || 0) > bestTier) { bestTier = tower.upgrades[p - 1]; bestPath = p; } }
        let baseKey = `tower_${type}_base`; let isCustomBase = false;
        if (bestTier > 0) {
            const customKey = `tower_${type}_p${bestPath}_t${bestTier}_base`;
            if (PixiAssets.get(customKey) !== Texture.EMPTY) { baseKey = customKey; isCustomBase = true; }
        }
        const isFullAnimActive = tower.isFullAnim && tower.attackAnimActive;
        let fullAnimTexture = Texture.EMPTY;
        if (isFullAnimActive) fullAnimTexture = PixiAssets.get(`${attackPrefix}attack_full_${tower.attackAnimFrame}`);
        const useFullAnim = isFullAnimActive && fullAnimTexture !== Texture.EMPTY;
        const baseTexture = useFullAnim ? fullAnimTexture : PixiAssets.get(baseKey);
        if (base.texture !== baseTexture) base.texture = baseTexture;
        const basePartKey = useFullAnim ? `attack_full_${tower.attackAnimFrame}` : 'base';
        if (type === 'gojo' || type === 'geto' || type === 'sauda') {
            // These heroes draw their base via drawImageCentered(baseAsset,
            // targetSize) in the canvas (heroes/gojo.js, geto.js, sauda.js) —
            // sized purely by targetSize with NO SpriteConfig offset/scale.
            // Their SpriteConfig entries (gojo scale 0.9, sauda 1.2) would
            // shrink them below the canvas size, so bypass SpriteConfig.
            // _sizeUniform matches the canvas drawImageCentered exactly: both
            // scale so the LONGEST dimension equals targetSize (maxDim-based).
            this._sizeUniform(base, baseTexture, targetSize);
            base.x = 0;
            base.y = 0;
        } else {
            this._applySpriteConfig(base, baseTexture, type, basePartKey, targetSize);
        }
        if (useFullAnim) { arm.visible = false; } else {
            const isAttacking = tower.attackAnimActive;
            const armKey = isAttacking ? `${attackPrefix}attack_${tower.attackAnimFrame}` : `${attackPrefix}arm`;
            const armPartKey = isAttacking ? `attack_${tower.attackAnimFrame}` : 'arm';
            const armTexture = PixiAssets.get(armKey);
            if (armTexture !== Texture.EMPTY) {
                arm.visible = true; if (arm.texture !== armTexture) arm.texture = armTexture;
                this._applySpriteConfig(arm, armTexture, type, armPartKey, targetSize);
            } else { arm.visible = false; }
        }
        const neededAOverlays = [];
        if (!useFullAnim && !isCustomBase) {
            for (let p = 1; p <= 3; p++) {
                const t = tower.upgrades?.[p - 1] || 0;
                if (t > 0) {
                    const key = `tower_${type}_p${p}_t${t}_a`;
                    if (PixiAssets.get(key) !== Texture.EMPTY) neededAOverlays.push({ textureKey: key, configType: `${type}_p${p}_t${t}` });
                }
            }
        }
        this._reconcileOverlayList(aOverlayLayer, entry.aOverlays, neededAOverlays, targetSize);
        const neededOverlays = [];
        if (!isCustomBase) {
            for (let p = 1; p <= 3; p++) {
                const t = tower.upgrades?.[p - 1] || 0;
                if (t > 0) neededOverlays.push({ textureKey: `tower_${type}_p${p}_t${t}`, configType: `${type}_p${p}_t${t}` });
            }
        }
        this._reconcileOverlayList(overlayLayer, entry.overlays, neededOverlays, targetSize);
        if (type === 'ace' && tower.planeX !== undefined) {
            container.x = tower.planeX; container.y = tower.planeY;
            container.rotation = (tower.planeAngle ?? 0) + Math.PI / 2;
        } else {
            container.x = tower.x; container.y = tower.y;
            container.rotation = tower.stats?.isStaticRotation ? 0 : ((tower.angle ?? 0) + Math.PI / 2);
        }
    },
    _reconcileOverlayList(parentContainer, poolArray, neededEntries, targetSize) {
        while (poolArray.length < neededEntries.length) {
            const s = new Sprite(); s.anchor.set(0.5); parentContainer.addChild(s); poolArray.push(s);
        }
        while (poolArray.length > neededEntries.length) { poolArray.pop().destroy(); }
        for (let i = 0; i < neededEntries.length; i++) {
            const { textureKey, configType } = neededEntries[i];
            const texture = PixiAssets.get(textureKey);
            const sprite = poolArray[i];
            if (sprite.texture !== texture) sprite.texture = texture;
            this._applySpriteConfig(sprite, texture, configType, 'base', targetSize);
        }
    },
    _updateDartVisual(tower, entry) {
        const { container, arm, aOverlayLayer, base, overlayLayer, catapult } = entry;
        if (tower.fanClubBuffTimer > 0) {
            arm.visible = false; base.visible = false; catapult.visible = false;
            this._reconcileOverlayList(aOverlayLayer, entry.aOverlays, [], 0);
            this._reconcileOverlayList(overlayLayer, entry.overlays, [], 0);
            container.x = tower.x; container.y = tower.y; container.rotation = 0; return;
        }
        arm.visible = true; base.visible = true;
        let bestTier = 0, bestPath = 0;
        for (let p = 1; p <= 3; p++) { if ((tower.upgrades?.[p - 1] || 0) > bestTier) { bestTier = tower.upgrades[p - 1]; bestPath = p; } }
        const sharedConfigType = bestTier > 0 ? `dart_p${bestPath}_t${bestTier}` : 'dart';
        const dartFallbackSize = 45 * GLOBAL_SCALE * getSpriteScale();
        let baseKey = 'tower_dart_base'; let isCustomBase = false;
        if (bestTier > 0) {
            const customKey = `tower_dart_p${bestPath}_t${bestTier}_base`;
            if (PixiAssets.get(customKey) !== Texture.EMPTY) { baseKey = customKey; isCustomBase = true; }
        }
        const catapultTexture = PixiAssets.get('tower_dart_catapult');
        if (tower.upgrades?.[0] >= 3 && !isCustomBase && catapultTexture !== Texture.EMPTY) {
            catapult.visible = true; catapult.texture = catapultTexture;
            this._applySpriteConfig(catapult, catapultTexture, sharedConfigType, 'base', dartFallbackSize);
            arm.visible = false; base.visible = false;
            this._reconcileOverlayList(aOverlayLayer, entry.aOverlays, [], 0);
            this._reconcileOverlayList(overlayLayer, entry.overlays, [], 0);
            container.x = tower.x; container.y = tower.y; container.rotation = (tower.angle ?? 0) + Math.PI / 2; return;
        }
        catapult.visible = false;
        const isFullAnimActive = tower.isFullAnim && tower.attackAnimActive;
        let fullAnimTexture = Texture.EMPTY;
        if (isFullAnimActive) fullAnimTexture = PixiAssets.get(`${tower.attackPrefix}attack_full_${tower.attackAnimFrame}`);
        const useFullAnim = isFullAnimActive && fullAnimTexture !== Texture.EMPTY;
        const baseTexture = useFullAnim ? fullAnimTexture : PixiAssets.get(baseKey);
        base.texture = baseTexture;
        const basePartKey = useFullAnim ? `attack_full_${tower.attackAnimFrame}` : 'base';
        this._applySpriteConfig(base, baseTexture, sharedConfigType, basePartKey, dartFallbackSize);
        if (useFullAnim) { arm.visible = false; } else {
            const isAttacking = tower.attackAnimActive;
            const armKey = isAttacking ? `${tower.attackPrefix}attack_${tower.attackAnimFrame}` : `${tower.attackPrefix}arm`;
            const armPartKey = isAttacking ? `attack_${tower.attackAnimFrame}` : 'arm';
            const armTexture = PixiAssets.get(armKey);
            if (armTexture !== Texture.EMPTY) {
                arm.visible = true; arm.texture = armTexture;
                this._applySpriteConfig(arm, armTexture, sharedConfigType, armPartKey, dartFallbackSize);
            } else { arm.visible = false; }
        }
        const neededAOverlays = [];
        if (!useFullAnim && !isCustomBase) {
            for (let i = 1; i <= 3; i++) {
                const t = tower.upgrades?.[i - 1] || 0;
                if (t > 0) {
                    const key = `tower_dart_p${i}_t${i}_a`;
                    if (PixiAssets.get(key) !== Texture.EMPTY) neededAOverlays.push({ textureKey: key, configType: sharedConfigType });
                }
            }
        }
        this._reconcileOverlayList(aOverlayLayer, entry.aOverlays, neededAOverlays, dartFallbackSize);
        const neededOverlays = [];
        if (!isCustomBase) {
            for (let i = 1; i <= 3; i++) {
                const t = tower.upgrades?.[i - 1] || 0;
                if (t > 0) neededOverlays.push({ textureKey: `tower_dart_p${i}_t${t}`, configType: sharedConfigType });
            }
        }
        this._reconcileOverlayList(overlayLayer, entry.overlays, neededOverlays, dartFallbackSize);
        container.x = tower.x; container.y = tower.y; container.rotation = (tower.angle ?? 0) + Math.PI / 2;
    },
    _updateMermonkeyVisual(tower, entry) {
        const { container, arm, aOverlayLayer, base, overlayLayer, catapult } = entry;
        arm.visible = false; catapult.visible = false;
        this._reconcileOverlayList(aOverlayLayer, entry.aOverlays, [], 0);
        this._reconcileOverlayList(overlayLayer, entry.overlays, [], 0);
        let bestTier = 0, bestPath = 0;
        for (let p = 1; p <= 3; p++) { if ((tower.upgrades?.[p - 1] || 0) > bestTier) { bestTier = tower.upgrades[p - 1]; bestPath = p; } }
        let baseKey = 'tower_mermonkey_base';
        if (bestTier > 0) {
            const customKey = `tower_mermonkey_p${bestPath}_t${bestTier}_base`;
            if (PixiAssets.get(customKey) !== Texture.EMPTY) baseKey = customKey;
        }
        const baseTexture = PixiAssets.get(baseKey);
        base.visible = true;
        if (base.texture !== baseTexture) base.texture = baseTexture;
        const targetSize = (tower.stats?.drawSize || (45 * (tower.stats?.scale || 1.0))) * GLOBAL_SCALE * getSpriteScale();
        this._sizeUniform(base, baseTexture, targetSize);
        base.x = 0; base.y = 0;
        container.x = tower.x; container.y = tower.y;
        container.rotation = tower.stats?.isStaticRotation ? 0 : ((tower.angle ?? 0) + Math.PI / 2);
    },
    
    // FIX: Hardened the SpriteConfig logic to exactly match Canvas2D getDrawParams
    _applySpriteConfig(sprite, texture, configType, partKey, defaultSize) {
        if (texture === Texture.EMPTY) return;
        const off = SpriteConfig[configType]?.[partKey];
        
        // If SpriteConfig provides a scale, it overrides everything completely.
        // Otherwise, we fall back to the defaultSize passed in.
        const size = off ? (45 * (off.scale || 1) * GLOBAL_SCALE * getSpriteScale()) : defaultSize;
        
        const maxDim = Math.max(texture.width, texture.height) || 1;
        const scale = size / maxDim;
        sprite.width = texture.width * scale;
        sprite.height = texture.height * scale;
        
        // Apply offsets if they exist
        sprite.x = off?.x || 0;
        sprite.y = off?.y || 0;
    }
};