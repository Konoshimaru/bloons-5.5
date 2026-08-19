// js/webgl/renderProjectiles.js
import { Sprite, Container, Texture, Graphics } from 'pixi.js';
import { PixiApp } from './pixiApp.js';
import { PixiAssets } from './pixiAssets.js';
import { CanvasGraphicsAdapter } from './canvasGraphicsAdapter.js';
import { ProjectileDrawers } from '../projectileDrawers.js';
import { Names } from '../names.js';
import { GLOBAL_SCALE } from '../constants.js';
import * as Const from './rendererConstants.js';

export const ProjectilesRenderer = {
    _frameGen: 0,

    _drawProjectiles(engine) {
        const layer = PixiApp.layer('projectiles');
        const pool = engine.projectilePool?.active;
        if (!pool) return;
        this._frameGen = (this._frameGen + 1) || 1;
        const gen = this._frameGen;

        for (const p of pool) {
            if (!p) continue;

            let entry = this._projectileSprites.get(p);
            if (!entry) {
                const container = new Container();
                const sprite = new Sprite(); sprite.anchor.set(0.5);
                const graphics = new Graphics();
                container.addChild(sprite, graphics); layer.addChild(container);
                entry = { container, sprite, graphics, adapter: new CanvasGraphicsAdapter(graphics) };
                this._projectileSprites.set(p, entry);
            }
            entry.gen = gen;

            const { container, sprite, graphics, adapter } = entry;
            
            let spriteKey = `proj_${p.type}`;
            if (p.type === 'meteor') {
                const frame = Math.floor(performance.now() / 50) % 16; // Cycles 0-15 every 800ms
                spriteKey = `proj_meteor_${frame}`;
            }
            const texture = PixiAssets.get(spriteKey);
            const hasSprite = texture !== Texture.EMPTY;

            sprite.visible = hasSprite; graphics.visible = !hasSprite;

            if (hasSprite) {
                if (sprite.texture !== texture) sprite.texture = texture;
                if (p.type === 'meteor') sprite.blendMode = 'add'; else sprite.blendMode = 'normal';
                const targetSize = typeof p._getDrawSize === 'function' ? p._getDrawSize() : 18;
                const maxDim = Math.max(texture.width, texture.height) || 1;
                const scale = targetSize / maxDim;
                sprite.width = texture.width * scale; sprite.height = texture.height * scale;
            } else {
                // Drawers emit static per-type geometry (only `arrow` reads
                // p.isCrit, which is fixed at spawn; position/angle live on
                // the container). The projectile pool reuses objects across
                // spawns — possibly as a DIFFERENT type — so redraw only
                // when that geometry key changes instead of re-tessellating
                // every frame.
                const drawer = ProjectileDrawers[p.type] || ProjectileDrawers.dart;
                const critKey = !!(p.isCrit);
                if (entry.lastType !== p.type || entry.lastCrit !== critKey) {
                    graphics.clear(); adapter.reset(); drawer(adapter, p);
                    entry.lastType = p.type; entry.lastCrit = critKey;
                }
            }
            container.x = p.x; container.y = p.y; container.rotation = p.angle || 0;
        }

        for (const [p, entry] of this._projectileSprites) {
            if (entry.gen !== gen) { entry.container.destroy({ children: true }); this._projectileSprites.delete(p); }
        }
    },

    _drawParticles(engine) {
        const layer = PixiApp.layer('effects');
        const particles = engine.particlePool?.active || [];
        this._frameGen = (this._frameGen + 1) || 1;
        const gen = this._frameGen;
        for (const p of particles) {
            if (!p || p.life <= 0) continue;
            let sprite = this._particleSprites.get(p);
            if (!sprite) {
                sprite = new Sprite(); sprite.anchor.set(0.5); layer.addChild(sprite); this._particleSprites.set(p, sprite);
            }
            sprite.gen = gen;
            // Cache the resolved pop texture per variant (a handful of fixed
            // values) instead of building the key string + Map lookup for
            // every particle every frame.
            if (!this._popTextureCache) this._popTextureCache = new Map();
            let texture = this._popTextureCache.get(p.popVariant);
            if (texture === undefined) {
                texture = PixiAssets.get(Names.getPopEffect(p.popVariant));
                // Only cache loaded textures — a not-yet-loaded one would
                // otherwise freeze the EMPTY placeholder forever.
                if (texture !== Texture.EMPTY) this._popTextureCache.set(p.popVariant, texture);
            }
            if (texture === Texture.EMPTY) { sprite.visible = false; continue; }
            sprite.visible = true;
            if (sprite.texture !== texture) sprite.texture = texture;
            const s = Const.PARTICLE_BASE_SIZE * p.size * GLOBAL_SCALE;
            sprite.width = s; sprite.height = s; sprite.x = p.x; sprite.y = p.y; sprite.rotation = p.rotation;
            sprite.alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
        }
        for (const [p, sprite] of this._particleSprites) {
            if (sprite.gen !== gen) { sprite.destroy(); this._particleSprites.delete(p); }
        }
    },

    _drawHitscans(engine) {
        if (!this._hitscansGraphics) {
            this._hitscansGraphics = new Graphics(); PixiApp.layer('effects').addChild(this._hitscansGraphics);
        }
        const g = this._hitscansGraphics; g.clear();
        for (const tower of engine.towers) {
            if (!tower || !tower.hitscans) continue;
            for (const h of tower.hitscans) {
                if (!h) continue;
                const alpha = Math.max(0, Math.min(1, h.life / Const.HITSCAN_MAX_LIFE));
                if (alpha <= 0) continue;
                g.moveTo(h.x1, h.y1).lineTo(h.x2, h.y2).stroke({ width: Const.HITSCAN_LINE_WIDTH, color: Const.HITSCAN_COLOR, alpha });
            }
        }
    },

    _drawBananas(engine) {
        const layer = PixiApp.layer('effects');
        this._frameGen = (this._frameGen + 1) || 1;
        const gen = this._frameGen;
        for (const tower of engine.towers) {
            if (!tower || !tower.bananas) continue;
            for (const b of tower.bananas) {
                if (!b) continue;
                let sprite = this._bananaSprites.get(b);
                if (!sprite) {
                    sprite = new Sprite(); sprite.anchor.set(0.5); layer.addChild(sprite); this._bananaSprites.set(b, sprite);
                }
                sprite.gen = gen;
                // Banana texture is fixed; resolve once instead of every banana
                // every frame.
                if (!this._bananaTexture || this._bananaTexture === Texture.EMPTY) this._bananaTexture = PixiAssets.get(Names.getBanana());
                const texture = this._bananaTexture;
                if (texture === Texture.EMPTY) { sprite.visible = false; continue; }
                sprite.visible = true;
                if (sprite.texture !== texture) sprite.texture = texture;
                const s = (b.isCrate ? Const.BANANA_CRATE_SIZE : Const.BANANA_SIZE) * GLOBAL_SCALE;
                this._sizeUniform(sprite, texture, s);
                sprite.x = b.x; sprite.y = b.y - b.arc;
                sprite.alpha = Math.max(0, Math.min(1, b.life / Const.BANANA_ALPHA_DIVISOR));
            }
        }
        for (const [b, sprite] of this._bananaSprites) {
            if (sprite.gen !== gen) { sprite.destroy(); this._bananaSprites.delete(b); }
        }
    }
};