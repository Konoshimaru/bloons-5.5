// js/webgl/renderWorld.js
import { Sprite, Container, Graphics, Text, Texture } from 'pixi.js';
import { PixiApp } from './pixiApp.js';
import { PixiAssets } from './pixiAssets.js';
import { CanvasGraphicsAdapter } from './canvasGraphicsAdapter.js';
import { MapRenderCore } from '../mapRenderCore.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GLOBAL_SCALE } from '../constants.js';
import * as Const from './rendererConstants.js';

export const WorldRenderer = {
    _frameGen: 0,
    _drawBackground(engine) {
        const map = engine.map;
        if (!map || !map.data.image) return;
        const mapKey = `map_${map.data.image}`;
        const texture = PixiAssets.get(mapKey);

        if (!this._bgSprite) {
            this._bgSprite = new Sprite(texture); PixiApp.layer('background').addChild(this._bgSprite);
        }
        if (this._bgSprite.texture !== texture) this._bgSprite.texture = texture;

        const scale = map.data.imageScale || 1;
        const offX = map.data.imageOffsetX || 0; const offY = map.data.imageOffsetY || 0;
        let w = CANVAS_WIDTH * scale; let h = CANVAS_HEIGHT * scale;
        if (map.data.imageMaintainRatio && texture.width > 0) { h = w * (texture.height / texture.width); }
        this._bgSprite.x = offX; this._bgSprite.y = offY; this._bgSprite.width = w; this._bgSprite.height = h;

        // Night map overlay — mirrors map.js draw()'s lines 140-148, which the
        // Canvas2D renderer applies but this file never did (a real, verified
        // visual gap): when a night variant of the map image exists and
        // engine.nightAlpha > 0, draw it over the day image at nightAlpha.
        // Uses map.data.imageNight when set, else `${image}_night` — the same
        // fallback map.js's _initBackground uses.
        const nightName = map.data.imageNight || `${map.data.image}_night`;
        const nightTexture = PixiAssets.get(`map_${nightName}`);
        if (nightTexture !== Texture.EMPTY && engine.nightAlpha > 0) {
            if (!this._bgNightSprite) { this._bgNightSprite = new Sprite(nightTexture); PixiApp.layer('background').addChild(this._bgNightSprite); }
            if (this._bgNightSprite.texture !== nightTexture) this._bgNightSprite.texture = nightTexture;
            let nh = h;
            if (map.data.imageMaintainRatio && nightTexture.width > 0) { nh = w * (nightTexture.height / nightTexture.width); }
            this._bgNightSprite.x = offX; this._bgNightSprite.y = offY; this._bgNightSprite.width = w; this._bgNightSprite.height = nh;
            this._bgNightSprite.alpha = engine.nightAlpha;
            this._bgNightSprite.visible = true;
        } else if (this._bgNightSprite) {
            this._bgNightSprite.visible = false;
        }

        this._drawMapDecorations(map);
    },

    // Port of map.js's drawToCache() (the static overlay canvas the Canvas2D
    // renderer draws on top of the map image every frame): water brushes (when
    // waterVisible !== false) and visible paths. Props stay skipped — the
    // original has them commented out in drawToCache too. Drawn once per map
    // into a shared Graphics on the 'path' layer (above 'background', matching
    // drawImage(cacheCanvas) coming after the night overlay), reusing the
    // exact canvas functions via CanvasGraphicsAdapter so the shapes match.
    _drawMapDecorations(map) {
        if (this._mapDecoCacheMap === map) return;
        this._mapDecoCacheMap = map;
        if (this._mapDecoGfx) { this._mapDecoGfx.destroy(); this._mapDecoGfx = null; }
        this._mapDecoAdapter = null;

        const hasWater = map.data.waterVisible !== false && Array.isArray(map.waterBrushes) && map.waterBrushes.length > 0;
        const hasVisiblePaths = Array.isArray(map.data.paths) && map.data.paths.some(p => p && Array.isArray(p.waypoints) && p.visible !== false);
        if (!hasWater && !hasVisiblePaths) return;

        this._mapDecoGfx = new Graphics();
        PixiApp.layer('path').addChild(this._mapDecoGfx);
        this._mapDecoAdapter = new CanvasGraphicsAdapter(this._mapDecoGfx);
        if (hasWater) MapRenderCore.drawWater(this._mapDecoAdapter, map.waterBrushes);
        MapRenderCore.drawPaths(this._mapDecoAdapter, map.data.paths);
    },

    _drawExplosions(engine) {
        if (!this._explosionsGraphics) {
            this._explosionsGraphics = new Graphics(); PixiApp.layer('explosions').addChild(this._explosionsGraphics);
        }
        const g = this._explosionsGraphics; g.clear();
        for (const exp of engine.explosions || []) {
            if (!exp || !exp.maxLife || exp.maxLife <= 0) continue;
            const alpha = Math.max(0, Math.min(1, exp.life / exp.maxLife));
            const r = Math.max(0, exp.radius || 0); const r2 = Math.max(0, (exp.radius || 0) * 0.6);
            g.circle(exp.x, exp.y, r).fill({ color: exp.color || Const.EXPLOSION_DEFAULT_COLOR, alpha });
            g.circle(exp.x, exp.y, r2).fill({ color: Const.EXPLOSION_INNER_COLOR, alpha });
        }
    },

    _drawAcidPools(engine) {
        const layer = PixiApp.layer('acidPools');
        this._frameGen = (this._frameGen + 1) || 1;
        const gen = this._frameGen;
        for (const pool of engine.acidPools || []) {
            if (!pool) continue;
            let g = this._acidPoolGraphics.get(pool);
            if (!g) { g = new Graphics(); layer.addChild(g); this._acidPoolGraphics.set(pool, g); }
            g.gen = gen;
            g.clear();
            const alpha = Math.max(0, Math.min(1, pool.life / Const.ACID_POOL_LIFE_DIVISOR));
            g.circle(pool.x, pool.y, pool.radius).fill({ color: pool.isFoam ? Const.ACID_FOAM_COLOR : Const.ACID_POOL_COLOR, alpha });
        }
        for (const [pool, g] of this._acidPoolGraphics) {
            if (g.gen !== gen) { g.destroy(); this._acidPoolGraphics.delete(pool); }
        }
    },

    _drawBeasts(engine) {
        const layer = PixiApp.layer('minions');
        const beasts = engine.beasts || [];
        this._frameGen = (this._frameGen + 1) || 1;
        const gen = this._frameGen;
        for (const beast of beasts) {
            if (!beast) continue;
            let entry = this._beastSprites.get(beast);
            if (!entry) {
                const container = new Container(); const ownerLine = new Graphics(); const circle = new Graphics();
                const label = new Text({ text: '', style: { fontSize: 10 * GLOBAL_SCALE, fontWeight: 'bold', fill: 0xffffff, fontFamily: 'Arial' } });
                label.anchor.set(0.5); container.addChild(ownerLine, circle, label); layer.addChild(container);
                entry = { container, ownerLine, circle, label, lastTier: null }; this._beastSprites.set(beast, entry);
            }
            entry.gen = gen;
            const { container, ownerLine, circle, label } = entry;
            const r = (10 + beast.tier * 2) * GLOBAL_SCALE;
            const color = Const.BEAST_COLORS[(beast.tier - 1) % Const.BEAST_COLORS.length] ?? Const.BEAST_FALLBACK_COLOR;
            ownerLine.clear();
            if (beast.ownerTower && beast.ownerTower.alive) {
                ownerLine.moveTo(beast.ownerTower.x, beast.ownerTower.y).lineTo(beast.x, beast.y).stroke({ width: 2, color: 0xffffff, alpha: 0.2 });
            }
            circle.clear(); circle.circle(0, 0, r).fill({ color });
            if (entry.lastTier !== beast.tier) { label.text = `L${beast.tier}`; entry.lastTier = beast.tier; }
            container.x = beast.x; container.y = beast.y;
        }
        for (const [beast, entry] of this._beastSprites) {
            if (entry.gen !== gen) { entry.container.destroy({ children: true }); this._beastSprites.delete(beast); }
        }
    },

    _drawSentries(engine) {
        const layer = PixiApp.layer('minions');
        const sentries = engine.sentries || [];
        this._frameGen = (this._frameGen + 1) || 1;
        const gen = this._frameGen;
        for (const sentry of sentries) {
            if (!sentry) continue;
            let entry = this._sentrySprites.get(sentry);
            if (!entry) { const graphics = new Graphics(); layer.addChild(graphics); entry = { graphics }; this._sentrySprites.set(sentry, entry); }
            entry.gen = gen;
            const { graphics } = entry; const gs = GLOBAL_SCALE;
            const shadowR = 15 * gs; const bodyColor = sentry.stats?.color ?? 0x000000;
            graphics.clear();
            graphics.ellipse(sentry.x, sentry.y + shadowR * Const.SHADOW_Y_OFFSET, shadowR, shadowR * Const.SHADOW_SQUASH).fill({ color: Const.SHADOW_COLOR, alpha: Const.SHADOW_ALPHA });
            graphics.circle(sentry.x, sentry.y, 8 * gs).fill({ color: bodyColor });
            graphics.rect(sentry.x - 3 * gs, sentry.y - 15 * gs, 6 * gs, 8 * gs).fill({ color: 0x34495e });
        }
        for (const [sentry, entry] of this._sentrySprites) {
            if (entry.gen !== gen) { entry.graphics.destroy(); this._sentrySprites.delete(sentry); }
        }
    }
};