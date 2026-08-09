// js/webgl/pixiRenderer.js
import { Texture } from 'pixi.js';
import { PixiApp } from './pixiApp.js';
import { PixiAssets } from './pixiAssets.js';
import { TowersRenderer } from './renderTowers.js';
import { EnemiesRenderer } from './renderEnemies.js';
import { ProjectilesRenderer } from './renderProjectiles.js';
import { WorldRenderer } from './renderWorld.js';
import { UIRenderer } from './renderUI.js';
import { HeroVFXRenderer } from './renderHeroVFX.js';
import { CutsceneRenderer } from './renderCutscene.js';
import { MenuRenderer } from './renderMenu.js';
import { BuffIconsRenderer } from './renderBuffIcons.js';
import { TowerStats } from '../towers/index.js';
import { HeroRegistry } from '../heroes/index.js';
import { Maps } from '../data.js';

export const PixiRenderer = {
    _bgSprite: null,
    _towerSprites: new Map(),
    _enemySprites: new Map(),
    _projectileSprites: new Map(),
    _towerEffectSprites: new Map(),
    _particleSprites: new Map(),
    _beastSprites: new Map(),
    _sentrySprites: new Map(),
    _explosionsGraphics: null,
    _acidPoolGraphics: new Map(),
    _floatingTextsLayer: null,
    _floatingTextSprites: new Map(),
    _selectionGraphics: null,
    _leakFlashGraphics: null,
    _hitscansGraphics: null,
    _bananaSprites: new Map(),
    _bossBarEntries: new Map(),
    _cursorGraphics: null,
    _bossWarningLineGraphics: null,
    _hitboxGraphics: null,
    _devOverlayText: null,
    _devOverlayBg: null,
    _erroredMethods: new Set(),

    async init(canvasEl) {
        await PixiApp.init(canvasEl);
        this._preloadSprites();
    },

    // PixiAssets loads lazily (a get() returns Texture.EMPTY until the asset
    // finishes loading), so any sprite that isn't preloaded is invisible for
    // a frame or two on its FIRST use — that's what made the cutscene slash
    // (and knight, stun rings, cracks, first-spawned towers/enemies) "blink"
    // on first appearance. Mirror the same keys main.js preloads for the
    // Canvas2D path (towers, enemies, effects) plus the cutscene/hero VFX
    // extras, fire-and-forget so it never blocks game start. Idempotent:
    // PixiAssets caches by key and skips already-loaded ones.
    _preloadSprites() {
        const keys = [];
        for (const type of Object.keys(TowerStats)) keys.push(`tower_${type}_base`, `tower_${type}_arm`);
        for (const type of Object.keys(HeroRegistry)) keys.push(`tower_${type}_base`, `tower_${type}_arm`);
        const enemyNames = ['red', 'blue', 'green', 'yellow', 'pink', 'black', 'white', 'lead', 'zebra', 'purple', 'rainbow', 'ceramic', 'moab', 'bfb', 'zomg', 'ddt', 'bad'];
        for (const name of enemyNames) keys.push(`enemy_${name}`, `enemy_${name}_camo`, `enemy_${name}_regen`, `enemy_${name}_regen_camo`);
        for (const name of ['ceramic', 'moab', 'bfb', 'zomg', 'ddt', 'bad']) for (let s = 1; s <= 3; s++) keys.push(`enemy_${name}_${s}`);
        keys.push(
            'effect_banana', 'effect_banana_crate',
            'effect_camo_effect', 'effect_camo_regen_effect', 'effect_regen_effect',
            'effect_frozen_effect', 'effect_frozen_effect_lead', 'effect_frozen_effect_regen',
            'effect_pop', 'effect_pop2', 'effect_pop3'
        );
        for (let i = 1; i <= 14; i++) keys.push(`effect_slash_${i}`);
        for (let i = 0; i <= 14; i++) keys.push(`effect_stun_${i}`);
        keys.push('effect_stun', 'enemy_knight_front', 'enemy_knight_back', 'proj_slash', 'proj_knightsword', 'proj_squid', 'proj_worm');
        // Map backgrounds (and their night variants) — the canvas path preloads
        // these so the first frame isn't a fallback flash; the WebGL path would
        // otherwise show a transparent background for a frame or two on game
        // start while the map texture loads lazily. Iterates the live map list
        // so newly added maps preload automatically too.
        for (const mapData of Maps) {
            if (!mapData || !mapData.image) continue;
            keys.push(`map_${mapData.image}`);
            keys.push(mapData.imageNight ? `map_${mapData.imageNight}` : `map_${mapData.image}_night`);
        }
        PixiAssets.preloadManifest(keys).catch(() => {});
    },

    // FIX: Added rawDt to pass to the dev overlay for FPS calculation
    render(engine, rawDt) {
        if (engine.canvas) {
            engine.canvas.style.cursor = (engine.gameState === 'playing') ? 'none' : 'auto';
        }

        // Mirror renderer.js's night-mode easing here too: the WebGL pipeline
        // reads engine.nightAlpha (map, tower night-glow, super/druid nightMod),
        // which the Canvas2D renderer updates but this one never did.
        if (engine.isNight === undefined) engine.isNight = false;
        if (engine.nightAlpha === undefined) engine.nightAlpha = 0;
        const targetNightAlpha = engine.isNight ? 1 : 0;
        engine.nightAlpha += (targetNightAlpha - engine.nightAlpha) * Math.min(1, (rawDt || 0.016) * 2);

        // Mirrors renderer.js's early return: `engine.gameState === 'menu'`
        // or no map loaded skips the entire gameplay pipeline below (which
        // assumes a real map/entities exist) in favor of just the menu
        // background + dev overlay. This branch didn't exist at all before
        // — see renderMenu.js's file header for what that actually meant
        // in practice.
        if (engine.gameState === 'menu' || !engine.map) {
            PixiApp.menuLayer.visible = true;
            PixiApp.compositeLayer.visible = false;
            PixiApp.cutsceneLayer.visible = false;
            this._safeDraw('_drawMainMenuScenery', engine, rawDt);
            this._safeDraw('_drawDevOverlay', engine, rawDt);
            // Cursor/boss-bar/warning-line are meaningless outside a game
            // but are self-clearing (see renderUI.js), so calling them
            // here too guarantees no stale graphics survive from a
            // previous playing session lingering under the menu.
            this._safeDraw('_drawCursor', engine);
            this._safeDraw('_drawBossHealthBar', engine);
            this._safeDraw('_drawBossWarningLine', engine);
            PixiApp.app.renderer.render(PixiApp.app.stage);
            return;
        }
        PixiApp.menuLayer.visible = false;
        PixiApp.compositeLayer.visible = true;
        PixiApp.cutsceneLayer.visible = true;

        this._safeDraw('_drawBackground', engine);
        this._safeDraw('_drawAcidPools', engine);
        this._safeDraw('_drawExplosions', engine);
        this._safeDraw('_drawSelectionFill', engine);
        this._safeDraw('_drawTowerEffects', engine);
        this._safeDraw('_drawHeroVFX', engine);
        this._safeDraw('_drawTowers', engine);
        this._safeDraw('_drawBuffIcons', engine);
        this._safeDraw('_drawBeasts', engine);
        this._safeDraw('_drawSentries', engine);
        this._safeDraw('_drawProjectiles', engine);
        this._safeDraw('_drawEnemies', engine);
        this._safeDraw('_drawParticles', engine);
        this._safeDraw('_drawHitscans', engine);
        this._safeDraw('_drawBananas', engine);
        this._safeDraw('_drawFloatingTexts', engine);
        this._safeDraw('_drawPlacementPreview', engine);
        this._safeDraw('_drawSelectionOutline', engine);
        this._safeDraw('_drawLeakFlash', engine);
        this._safeDraw('_drawCutsceneRevealBar', engine);
        this._safeDraw('_drawCutsceneBalls', engine);
        this._safeDraw('_drawBossHealthBar', engine);
        this._safeDraw('_drawBossWarningLine', engine);
        
        // FIX: Added Hitboxes and Dev Overlay
        this._safeDraw('_drawHitboxes', engine);
        this._safeDraw('_drawCursor', engine);
        this._safeDraw('_drawDevOverlay', engine, rawDt);
        this._safeDraw('_drawCutscene', engine);

        // Must run last: captures everything the layers above just drew
        // into worldTexture, composites it (split or not) into
        // compositeLayer, then does the single manual
        // app.renderer.render(app.stage) call for this frame. See
        // pixiApp.js's autoStart:false comment for why this replaced
        // Pixi's own ticker.
        this._safeDraw('_compositeWorld', engine);
    },

    // FIX: Updated _safeDraw to accept and spread extra arguments
    _safeDraw(methodName, ...args) {
        try {
            this[methodName](...args);
        } catch (err) {
            if (!this._erroredMethods.has(methodName)) {
                this._erroredMethods.add(methodName);
                console.error(`[PixiRenderer] ${methodName} threw (further errors from this method this session are suppressed, but it will keep being retried every frame):`, err);
            }
        }
    },

    _sizeUniform(sprite, texture, targetSize) {
        if (texture === Texture.EMPTY) return;
        const maxDim = Math.max(texture.width, texture.height) || 1;
        const scale = targetSize / maxDim;
        sprite.width = texture.width * scale;
        sprite.height = texture.height * scale;
    }
};

// Merge all the rendering modules into the main PixiRenderer object
Object.assign(PixiRenderer, TowersRenderer, EnemiesRenderer, ProjectilesRenderer, WorldRenderer, UIRenderer, HeroVFXRenderer, CutsceneRenderer, MenuRenderer, BuffIconsRenderer);