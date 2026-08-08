// js/webgl/renderEnemies.js
import { Sprite, Container, Texture, Graphics } from 'pixi.js';
import { PixiApp } from './pixiApp.js';
import { PixiAssets } from './pixiAssets.js';
import { CanvasGraphicsAdapter } from './canvasGraphicsAdapter.js';
import { GLOBAL_SCALE } from '../constants.js';
import { ENEMY_NAMES, CRACKABLE } from './rendererConstants.js';

export const EnemiesRenderer = {
    _drawEnemies(engine) {
        const layer = PixiApp.layer('enemies');
        const seen = new Set();

        for (const enemy of engine.enemies) {
            if (!enemy || !enemy.alive) continue;
            // KnightEnemy (tier 99) is cutscene-only, doesn't fit the
            // tier-indexed ENEMY_NAMES sprite lookup below (index 99 is out
            // of range), and uses its own `.sprite` string property
            // instead. Drawn separately by renderCutscene.js.
            if (enemy.tier === 99) continue;
            seen.add(enemy);

            let entry = this._enemySprites.get(enemy);
            if (!entry) {
                const container = new Container();
                const blade = new Sprite(); blade.anchor.set(0.5);
                const base = new Sprite(); base.anchor.set(0.5);
                const crack = new Sprite(); crack.anchor.set(0.5);
                const frozenSprite = new Sprite(); frozenSprite.anchor.set(0.5);
                const camoRegenSprite = new Sprite(); camoRegenSprite.anchor.set(0.5);
                const statusGraphics = new Graphics();
                const tintSprite = new Sprite(); tintSprite.anchor.set(0.5); tintSprite.tint = 0xa253ff;
                const stun = new Sprite(); stun.anchor.set(0.5);
                container.addChild(blade, base, crack, frozenSprite, camoRegenSprite, statusGraphics, tintSprite, stun);
                layer.addChild(container);
                entry = { container, blade, base, crack, frozenSprite, camoRegenSprite, statusGraphics, statusAdapter: new CanvasGraphicsAdapter(statusGraphics), tintSprite, stun };
                this._enemySprites.set(enemy, entry);
            }

            const { container, base, crack, blade, frozenSprite, camoRegenSprite, statusGraphics, statusAdapter, tintSprite, stun } = entry;
            const baseName = ENEMY_NAMES[enemy.tier];

            const modifierKey = enemy.isCamo || enemy.isRegen ? `enemy_${baseName}${enemy.isCamo ? '_camo' : ''}${enemy.isRegen ? '_regen' : ''}` : null;
            let texture = modifierKey ? PixiAssets.get(modifierKey) : null;
            const usedCustomModifierSprite = !!(texture && texture !== Texture.EMPTY);
            if (!usedCustomModifierSprite) texture = PixiAssets.get(`enemy_${baseName}`);
            if (base.texture !== texture) base.texture = texture;

            const targetSize = (enemy.data?.size || (enemy.radius * 2) || 20) * GLOBAL_SCALE;
            const spriteOffX = enemy.data?.spriteOffsetX || 0;
            const spriteOffY = enemy.data?.spriteOffsetY || 0;
            this._sizeUniform(base, texture, targetSize);
            base.x = spriteOffX; base.y = spriteOffY;

            let stage = 0;
            if (CRACKABLE.has(baseName) && enemy._maxHp > 0) {
                const damagePercent = 1 - (enemy.hp / enemy._maxHp);
                if (damagePercent > 0.75) stage = 3; else if (damagePercent > 0.50) stage = 2; else if (damagePercent > 0.25) stage = 1;
            }

            crack.visible = false;
            if (stage > 0) {
                const crackTexture = PixiAssets.get(`enemy_${baseName}_${stage}`);
                if (crackTexture !== Texture.EMPTY) {
                    crack.texture = crackTexture; this._sizeUniform(crack, crackTexture, targetSize);
                    crack.x = spriteOffX; crack.y = spriteOffY; crack.visible = true;
                }
            }

            blade.visible = false;
            if (baseName === 'moab' || baseName === 'bfb' || baseName === 'zomg') {
                const frame = enemy.bladeFrame || 0;
                let bladeTexture = PixiAssets.get(`enemy_${baseName}_blades_${stage}_${frame}`);
                if (bladeTexture === Texture.EMPTY && stage === 0) bladeTexture = PixiAssets.get(`enemy_${baseName}_blades_${frame}`);
                if (bladeTexture === Texture.EMPTY) bladeTexture = PixiAssets.get(`enemy_${baseName}_blades_${stage}_0`);
                if (bladeTexture === Texture.EMPTY && stage === 0) bladeTexture = PixiAssets.get(`enemy_${baseName}_blades_0`);
                if (bladeTexture !== Texture.EMPTY) {
                    blade.texture = bladeTexture; this._sizeUniform(blade, bladeTexture, targetSize);
                    blade.x = enemy.data?.spriteOffsetX || 0; blade.y = enemy.data?.spriteOffsetY || 0; blade.visible = true;
                }
            }

            frozenSprite.visible = false; camoRegenSprite.visible = false;
            let statusRingRadius = null; let statusRingColor = null;

            if (enemy.tier < 13) {
                if (enemy.isFrozen) {
                    let frozenKey = 'effect_frozen_effect';
                    if (enemy.data?.isLead) frozenKey = 'effect_frozen_effect_lead'; else if (enemy.isRegen) frozenKey = 'effect_frozen_effect_regen';
                    const frozenTexture = PixiAssets.get(frozenKey);
                    if (frozenTexture !== Texture.EMPTY) {
                        frozenSprite.texture = frozenTexture; this._sizeUniform(frozenSprite, frozenTexture, targetSize);
                        frozenSprite.x = spriteOffX; frozenSprite.y = spriteOffY; frozenSprite.visible = true;
                    } else { statusRingRadius = enemy.radius + 3; statusRingColor = 'rgba(26, 188, 156, 0.9)'; }
                } else if (enemy.slowFactor < 1.0) { statusRingRadius = enemy.radius + 3; statusRingColor = 'rgba(241, 196, 15, 0.7)'; }

                let camoRegenKey = null;
                if (enemy.isCamo && enemy.isRegen && !usedCustomModifierSprite) camoRegenKey = 'effect_camo_regen_effect';
                else if (enemy.isCamo && !enemy.isRegen && !usedCustomModifierSprite) camoRegenKey = 'effect_camo_effect';
                else if (enemy.isRegen && !usedCustomModifierSprite) camoRegenKey = 'effect_regen_effect';
                if (camoRegenKey) {
                    const camoRegenTexture = PixiAssets.get(camoRegenKey);
                    if (camoRegenTexture !== Texture.EMPTY) {
                        camoRegenSprite.texture = camoRegenTexture; this._sizeUniform(camoRegenSprite, camoRegenTexture, targetSize);
                        camoRegenSprite.x = spriteOffX; camoRegenSprite.y = spriteOffY; camoRegenSprite.visible = true;
                    }
                }
            }

            statusGraphics.clear(); statusAdapter.reset();
            if (statusRingRadius !== null) {
                statusAdapter.strokeStyle = statusRingColor; statusAdapter.lineWidth = statusRingColor.includes('26, 188, 156') ? 3 : 2;
                statusAdapter.beginPath(); statusAdapter.arc(0, 0, statusRingRadius, 0, Math.PI * 2); statusAdapter.stroke();
            }
            if (enemy.brittle) {
                statusAdapter.strokeStyle = '#e74c3c'; statusAdapter.lineWidth = 2;
                statusAdapter.beginPath(); statusAdapter.arc(0, 0, enemy.radius + 6, 0, Math.PI * 2); statusAdapter.stroke();
            }

            tintSprite.visible = false;
            if (enemy.infinityTint > 0) {
                tintSprite.texture = base.texture; this._sizeUniform(tintSprite, base.texture, targetSize);
                tintSprite.x = spriteOffX; tintSprite.y = spriteOffY; tintSprite.alpha = enemy.infinityTint * 0.6; tintSprite.visible = true;
            }

            stun.visible = false;
            if (enemy.slowFactor === 0.0 && enemy.slowTimer > 0 && !enemy.isFrozen) {
                const t = performance.now() / 1000; const frame = (Math.floor(t * 15) % 15) + 1; // effect_stun_1..15 (stun_0.png missing — avoids blink)
                let stunTexture = PixiAssets.get(`effect_stun_${frame}`);
                if (stunTexture === Texture.EMPTY) stunTexture = PixiAssets.get('effect_stun_0');
                if (stunTexture === Texture.EMPTY) stunTexture = PixiAssets.get('effect_stun');
                if (stunTexture !== Texture.EMPTY) {
                    const s = (enemy.data?.size || 40) * GLOBAL_SCALE * 0.8;
                    stun.texture = stunTexture; stun.width = s; stun.height = s; stun.x = 0; stun.y = -enemy.radius * 0.6 - s / 2; stun.rotation = t * 5; stun.visible = true;
                }
            }

            if (enemy.isSqueezed) {
                const t = performance.now() / 1000;
                container.x = enemy.x + Math.sin(t * 30) * 3;
                const squashY = 0.55 + Math.sin(t * 12) * 0.1;
                const squashX = 1.0 + (1.0 - squashY) * 0.4;
                container.scale.set(squashX, squashY);
            } else { container.x = enemy.x; container.scale.set(1, 1); }
            container.y = enemy.y;
            container.rotation = enemy.tier >= 13 ? (enemy.angle + Math.PI / 2) : 0;
        }

        for (const [enemy, entry] of this._enemySprites) {
            if (!seen.has(enemy)) { entry.container.destroy({ children: true }); this._enemySprites.delete(enemy); }
        }
    }
};