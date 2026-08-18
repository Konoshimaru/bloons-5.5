// js/webgl/renderEnemies.js
import { Sprite, Container, Texture, Graphics } from 'pixi.js';
import { PixiApp } from './pixiApp.js';
import { PixiAssets } from './pixiAssets.js';
import { CanvasGraphicsAdapter } from './canvasGraphicsAdapter.js';
import { GLOBAL_SCALE } from '../constants.js';
import { getSpriteScale } from '../mobile.js';
import { ENEMY_NAMES, CRACKABLE } from './rendererConstants.js';
import { BloonSpriteConfig } from '../bloonSpriteConfig.js';

const ENEMY_POOL_MAX = 150;

export const EnemiesRenderer = {
    // Per-frame generation stamp replaces the fresh `seen` Set that was
    // allocated + filled (1000+ inserts) every frame just to sweep dead
    // entries out of _enemySprites. Each entry carries the frame number that
    // touched it; the sweep below reclaims any entry whose stamp is stale.
    _frameGen: 0,

    _drawEnemies(engine) {
        const layer = PixiApp.layer('enemies');
        const mscale = getSpriteScale();
        this._frameGen = (this._frameGen + 1) || 1;
        const gen = this._frameGen;
        const _t0 = performance.now();

        for (const enemy of engine.enemies) {
            if (!enemy || !enemy.alive) continue;
            // KnightEnemy (tier 99) is cutscene-only, doesn't fit the
            // tier-indexed ENEMY_NAMES sprite lookup below (index 99 is out
            // of range), and uses its own `.sprite` string property
            // instead. Drawn separately by renderCutscene.js.
            if (enemy.tier === 99) continue;

            let entry = this._enemySprites.get(enemy);
            if (!entry) {
                entry = this._acquireEnemyEntry();
                this._enemySprites.set(enemy, entry);
            }
            entry.gen = gen;
            entry.container.visible = true;

            const { container, base, crack, blade, frozenSprite, camoRegenSprite, statusGraphics, statusAdapter, tintSprite, stun } = entry;
            const baseName = ENEMY_NAMES[enemy.tier];

            // Base texture + size only re-resolve when the fields that select
            // them change (tier, camo/regen, size) or the asset is still
            // loading (EMPTY) — not every frame for every enemy.
            const baseInfo = this._refreshEnemyBase(entry, enemy, baseName, mscale);
            const targetSize = baseInfo.targetSize;
            const spriteOffX = baseInfo.spriteOffX;
            const spriteOffY = baseInfo.spriteOffY;
            const bodySize = baseInfo.bodySize;
            const bodyX = baseInfo.bodyX;
            const bodyY = baseInfo.bodyY;
            const usedCustomModifierSprite = baseInfo.usedCustomModifierSprite;

            let stage = 0;
            if (CRACKABLE.has(baseName) && enemy._maxHp > 0) {
                const damagePercent = 1 - (enemy.hp / enemy._maxHp);
                if (damagePercent > 0.75) stage = 3; else if (damagePercent > 0.50) stage = 2; else if (damagePercent > 0.25) stage = 1;
            }

            this._refreshCrack(entry, stage, baseName, targetSize, spriteOffX, spriteOffY);
            this._refreshBlade(entry, enemy, baseName, stage, targetSize, spriteOffX, spriteOffY);

            frozenSprite.visible = false; camoRegenSprite.visible = false;
            let statusRingRadius = null; let statusRingColor = null;
            let statusHasRing = false; let statusHasBrittle = false;

            if (enemy.tier < 13) {
                if (enemy.isFrozen) {
                    let frozenKey = 'effect_frozen_effect';
                    if (enemy.data?.isLead) frozenKey = 'effect_frozen_effect_lead'; else if (enemy.isRegen) frozenKey = 'effect_frozen_effect_regen';
                    const frozenTexture = this._cachedTexture(entry._frozenCache, frozenKey);
                    if (frozenTexture !== Texture.EMPTY) {
                        frozenSprite.texture = frozenTexture; this._sizeUniform(frozenSprite, frozenTexture, bodySize);
                        frozenSprite.x = bodyX; frozenSprite.y = bodyY; frozenSprite.visible = true;
                        this._ensureChild(container, frozenSprite);
                    } else { statusRingRadius = (enemy.radius + 3) * mscale; statusRingColor = 'rgba(26, 188, 156, 0.9)'; statusHasRing = true; }
                } else if (enemy.slowFactor < 1.0) { statusRingRadius = (enemy.radius + 3) * mscale; statusRingColor = 'rgba(241, 196, 15, 0.7)'; statusHasRing = true; }
                let camoRegenKey = null;
                if (enemy.isCamo && enemy.isRegen && !usedCustomModifierSprite) camoRegenKey = 'effect_camo_regen_effect';
                else if (enemy.isCamo && !enemy.isRegen && !usedCustomModifierSprite) camoRegenKey = 'effect_camo_effect';
                else if (enemy.isRegen && !usedCustomModifierSprite) camoRegenKey = 'effect_regen_effect';
                if (camoRegenKey) {
                    const camoRegenTexture = this._cachedTexture(entry._camoRegenCache, camoRegenKey);
                    if (camoRegenTexture !== Texture.EMPTY) {
                        camoRegenSprite.texture = camoRegenTexture; this._sizeUniform(camoRegenSprite, camoRegenTexture, bodySize);
                        camoRegenSprite.x = bodyX; camoRegenSprite.y = bodyY; camoRegenSprite.visible = true;
                        this._ensureChild(container, camoRegenSprite);
                    }
                }
            }

            if (enemy.brittle) statusHasBrittle = true;

            // statusGraphics is the per-enemy Graphics that draws the slow /
            // frozen / brittle rings. Skip the clear+redraw entirely for
            // enemies that have never had a status (the common case), but
            // still clear stale geometry when a status just ended so it can
            // never reappear on the next ring.
            const hadStatus = entry._hadStatus || false;
            const hasStatus = statusHasRing || statusHasBrittle;
            if (hasStatus || hadStatus) {
                statusGraphics.clear(); statusAdapter.reset();
            }
            if (hasStatus) this._ensureChild(container, statusGraphics);
            if (statusHasRing) {
                statusAdapter.strokeStyle = statusRingColor; statusAdapter.lineWidth = statusRingColor.includes('26, 188, 156') ? 3 : 2;
                statusAdapter.beginPath(); statusAdapter.arc(0, 0, statusRingRadius, 0, Math.PI * 2); statusAdapter.stroke();
            }
            if (statusHasBrittle) {
                statusAdapter.strokeStyle = '#e74c3c'; statusAdapter.lineWidth = 2;
                statusAdapter.beginPath(); statusAdapter.arc(0, 0, (enemy.radius + 6) * mscale, 0, Math.PI * 2); statusAdapter.stroke();
            }
            statusGraphics.visible = hasStatus;
            entry._hadStatus = hasStatus;

            tintSprite.visible = false;
            if (enemy.infinityTint > 0) {
                tintSprite.texture = base.texture; this._sizeUniform(tintSprite, base.texture, bodySize);
                tintSprite.x = bodyX; tintSprite.y = bodyY; tintSprite.alpha = enemy.infinityTint * 0.6; tintSprite.visible = true;
                this._ensureChild(container, tintSprite);
            }

            stun.visible = false;
            if (enemy.slowFactor === 0.0 && enemy.slowTimer > 0 && !enemy.isFrozen) {
                const t = performance.now() / 1000; const frame = (Math.floor(t * 15) % 15) + 1; // effect_stun_1..15
                const stunTexture = PixiAssets.get(`effect_stun_${frame}`);
                if (stunTexture !== Texture.EMPTY) {
                    const s = (enemy.data?.size || 40) * GLOBAL_SCALE * 0.8 * mscale;
                    const rot = enemy.tier >= 13 ? (enemy.angle + Math.PI / 2) : 0;
                    const d = enemy.radius * 0.6 * mscale + s / 2;
                    stun.texture = stunTexture; stun.width = s; stun.height = s; stun.x = -d * Math.sin(rot); stun.y = -d * Math.cos(rot); stun.rotation = t * 5 - rot; stun.visible = true;
                    this._ensureChild(container, stun);
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
            if (entry.gen !== gen) {
                this._enemySprites.delete(enemy);
                // Cap the reuse pool so a single big pop burst (MOAB/BFB/ZOMG
                // splitting into dozens of children) can't permanently bloat
                // the 'enemies' layer — pooled entries stay in the scene graph
                // (just hidden), so uncapped they grow that layer forever and
                // every frame's transform walk gets slower the longer you play.
                if (this._enemySpritePool.length < ENEMY_POOL_MAX) {
                    entry.container.visible = false;
                    this._enemySpritePool.push(entry);
                } else {
                    entry.container.destroy({ children: true });
                }
            }
        }

        engine._frameMs = engine._frameMs || {};
        engine._frameMs.renderEnemies = performance.now() - _t0;
    },

    // Resolves the base sprite's texture + sizing once and reuses it while
    // the selection fields (tier / camo / regen / size / late-loading EMPTY
    // texture) stay unchanged.
    _refreshEnemyBase(entry, enemy, baseName, mscale) {
        const base = entry.base;
        const cache = entry._baseCache;
        const modifierKey = enemy.isCamo || enemy.isRegen ? `enemy_${baseName}${enemy.isCamo ? '_camo' : ''}${enemy.isRegen ? '_regen' : ''}` : null;
        const targetSize = (enemy.data?.size || (enemy.radius * 2) || 20) * GLOBAL_SCALE * mscale;
        const spriteOffX = enemy.data?.spriteOffsetX || 0;
        const spriteOffY = enemy.data?.spriteOffsetY || 0;

        // BloonSpriteConfig: body x/y/scale applied on top of the data-level
        // offsets. frozen/camo/tint overlays reuse bodySize/bodyX/bodyY so
        // they stay glued to the body wherever the user moves it.
        const cfg = BloonSpriteConfig[baseName]?.body || {};
        const bodySize = targetSize * (cfg.scale ?? 1);
        const bodyX = spriteOffX + (cfg.x || 0);
        const bodyY = spriteOffY + (cfg.y || 0);

        if (cache.baseName !== baseName || cache.modifierKey !== modifierKey || cache.targetSize !== bodySize || cache.texture === Texture.EMPTY) {
            cache.baseName = baseName;
            cache.modifierKey = modifierKey;
            cache.targetSize = bodySize;
            let texture = modifierKey ? PixiAssets.get(modifierKey) : null;
            const usedCustomModifierSprite = !!(texture && texture !== Texture.EMPTY);
            if (!usedCustomModifierSprite) texture = PixiAssets.get(`enemy_${baseName}`);
            cache.texture = texture;
            cache.usedCustomModifierSprite = usedCustomModifierSprite;
            if (base.texture !== texture) base.texture = texture;
            this._sizeUniform(base, texture, bodySize);
        }
        base.x = bodyX; base.y = bodyY;
        return { targetSize, spriteOffX, spriteOffY, usedCustomModifierSprite: cache.usedCustomModifierSprite, bodySize, bodyX, bodyY };
    },

    // Crack overlay: the damage stage is recomputed every frame (cheap
    // division), but the texture lookup + re-layout only happen when the
    // stage (or base/targetSize) actually changes.
    _refreshCrack(entry, stage, baseName, targetSize, spriteOffX, spriteOffY) {
        const crack = entry.crack;
        crack.visible = false;
        const cache = entry._crackCache;
        const cfg = BloonSpriteConfig[baseName]?.cracks || {};
        const crackSize = targetSize * (cfg.scale ?? 1);
        const crackX = spriteOffX + (cfg.x || 0);
        const crackY = spriteOffY + (cfg.y || 0);
        if (stage > 0) {
            if (cache.stage !== stage || cache.baseName !== baseName || cache.targetSize !== crackSize || cache.texture === Texture.EMPTY || cache.texture === undefined) {
                cache.stage = stage;
                cache.baseName = baseName;
                cache.targetSize = crackSize;
                cache.texture = PixiAssets.get(`enemy_${baseName}_${stage}`);
            }
            if (cache.texture !== Texture.EMPTY) {
                crack.texture = cache.texture; this._sizeUniform(crack, cache.texture, crackSize);
                crack.x = crackX; crack.y = crackY; crack.visible = true;
                this._ensureChild(entry.container, crack);
            }
        } else {
            cache.stage = 0;
            cache.texture = undefined;
        }
    },

    // Blade animation for MOAB/BFB/ZOMG. Blade frames change every ~0.1s, so
    // the texture only re-resolves when (base, stage, frame) changes.
    _refreshBlade(entry, enemy, baseName, stage, targetSize, spriteOffX, spriteOffY) {
        const blade = entry.blade;
        blade.visible = false;
        if (baseName !== 'moab' && baseName !== 'bfb' && baseName !== 'zomg') return;
        const cache = entry._bladeCache;
        const cfg = BloonSpriteConfig[baseName]?.blades || {};
        const bladeSize = targetSize * (cfg.scale ?? 1);
        const bladeX = spriteOffX + (cfg.x || 0);
        const bladeY = spriteOffY + (cfg.y || 0);
        const frame = enemy.bladeFrame || 0;
        const key = `${baseName}:${stage}:${frame}`;
        if (cache.key !== key || cache.texture === Texture.EMPTY || cache.texture === undefined) {
            cache.key = key;

            // Effective stage: a damage stage with no blade frames steps down
            // to the nearest lower stage that has them (MOAB's sheet only
            // ships stages 0-2, so its stage 3 uses stage 2 blades).
            let useStage = stage;
            while (useStage > 0 && PixiAssets.get(`enemy_${baseName}_blades_${useStage}_0`) === Texture.EMPTY) {
                useStage--;
            }

            let bladeTexture = PixiAssets.get(`enemy_${baseName}_blades_${useStage}_${frame}`);
            if (bladeTexture === Texture.EMPTY && useStage === 0) bladeTexture = PixiAssets.get(`enemy_${baseName}_blades_${frame}`);
            if (bladeTexture === Texture.EMPTY) {
                // Mirror canvas: reset the animation and retry from frame 0
                // at the effective stage, then bare any-stage fallbacks.
                if (enemy.bladeFrame !== 0) enemy.bladeFrame = 0;
                bladeTexture = PixiAssets.get(`enemy_${baseName}_blades_${useStage}_0`);
                if (bladeTexture === Texture.EMPTY) bladeTexture = PixiAssets.get(`enemy_${baseName}_blades_0`);
            }
            cache.texture = bladeTexture;
        }
        if (cache.texture !== Texture.EMPTY) {
            blade.texture = cache.texture; this._sizeUniform(blade, cache.texture, bladeSize);
            blade.x = bladeX; blade.y = bladeY; blade.visible = true;
            this._ensureChild(entry.container, blade, 0);
        }
    },

    // Attaches an overlay child to the enemy container on its first use.
    // Children are only permanently attached for the ones actually needed
    // (plain bloons just get `base`), so the per-frame transform/renderable
    // walk over 1000+ enemies touches ~1-2 display objects instead of 8.
    // `index` inserts at a specific z-order: the blade must go BEHIND the
    // body (index 0), matching the canvas path which draws blades first.
    _ensureChild(container, child, index) {
        if (child.parent !== container) {
            if (typeof index === 'number') container.addChildAt(child, index);
            else container.addChild(child);
        }
    },

    // Keyed texture lookup cached per entry. Keeps re-resolving while the
    // asset is still EMPTY (not yet loaded) so late-loading textures are
    // picked up as soon as they arrive.
    _cachedTexture(cache, key) {
        if (cache.key !== key || cache.texture === Texture.EMPTY) {
            cache.key = key;
            cache.texture = PixiAssets.get(key);
        }
        return cache.texture;
    },

    // Pops a pooled enemy render entry (a hidden Container, `base` attached,
    // overlays attached on first use) or builds a fresh one. Pooling matters for the
    // mass-pop case: when a cluster of bloons splits, dozens/hundreds of
    // children appear in a single frame, and reusing hidden entries instead
    // of constructing Containers+Sprite trees (then destroying them) avoids
    // the allocation/GC churn that shows up as lag exactly during breaks.
    _enemySpritePool: [],
    _acquireEnemyEntry() {
        const pooled = this._enemySpritePool.pop();
        if (pooled) return pooled;

        const layer = PixiApp.layer('enemies');
        const container = new Container();
        const blade = new Sprite(); blade.anchor.set(0.5);
        const base = new Sprite(); base.anchor.set(0.5);
        const crack = new Sprite(); crack.anchor.set(0.5);
        const frozenSprite = new Sprite(); frozenSprite.anchor.set(0.5);
        const camoRegenSprite = new Sprite(); camoRegenSprite.anchor.set(0.5);
        const statusGraphics = new Graphics();
        const tintSprite = new Sprite(); tintSprite.anchor.set(0.5); tintSprite.tint = 0xa253ff;
        const stun = new Sprite(); stun.anchor.set(0.5);
        // Only `base` is attached now; overlays are attached lazily on first
        // use by _ensureChild so plain bloons stay at 1 display object.
        container.addChild(base);
        layer.addChild(container);
        return {
            container, blade, base, crack, frozenSprite, camoRegenSprite, statusGraphics, statusAdapter: new CanvasGraphicsAdapter(statusGraphics), tintSprite, stun,
            gen: 0,
            _hadStatus: false,
            _baseCache: {},
            _crackCache: {},
            _bladeCache: {},
            _frozenCache: {},
            _camoRegenCache: {},
        };
    },
};