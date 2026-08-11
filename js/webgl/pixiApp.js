// js/webgl/pixiApp.js
//
// WebGL renderer bootstrap (PixiJS). This is a parallel implementation that
// lives alongside the existing Canvas2D renderer (js/renderer.js) during
// migration. See js/webgl/MIGRATION.md for the plan and status.
//
// Once the WebGL path covers everything renderer.js does, engine.js and
// dom.js get pointed at this instead of `canvas.getContext('2d')`, and the
// Canvas2D renderer + its per-entity ctx-drawing code gets deleted.

import { Application, Container, RenderTexture, Texture, Rectangle } from 'pixi.js';
import './pixiGraphicsPatch.js'; // fixes GraphicsPath#getLastPoint for shape primitives

export const PixiApp = {
    app: null,
    layers: {},
    worldContainer: null,
    worldTexture: null,
    compositeLayer: null,
    screenUI: null,

    async init(canvasEl) {
        this.app = new Application();

        await this.app.init({
            canvas: canvasEl,
            width: 1280,
            height: 720,
            backgroundAlpha: 0, // menu/game background art is drawn as a sprite layer, not canvas clear color
            antialias: true,
            // IMPORTANT: resolution must stay 1, not devicePixelRatio.
            // Every input/drag call site across the codebase (engineInput.js,
            // input.js, dragManager.js, mobile.js) does
            // `scaleX = canvas.width / rect.width` to convert a screen click
            // back into world coordinates, assuming `canvas.width` (the pixel
            // backing-store size) equals the logical 1280x720 game space.
            // The original Canvas2D context never did DPR-aware scaling
            // either (canvas.width stayed pinned to the 1280 HTML attribute
            // regardless of screen density), so resolution:1 here isn't a
            // downgrade from the original — it's what reproduces its actual
            // behavior. Setting this to devicePixelRatio (as a "normal" Pixi
            // app would for crisper rendering) silently doubles/triples
            // every click, drag, and hover position on any HiDPI screen
            // (retina, most phones), breaking tower placement/selection —
            // without touching a single one of those input files. If crisper
            // rendering on HiDPI is wanted later, do it by scaling the
            // Application's `resize`/CSS layer instead, and update every
            // `canvas.width`-based coordinate call site (listed above) to
            // divide out the resolution factor at the same time.
            resolution: 1,
            autoDensity: true,
            preference: 'webgl', // falls back to webgpu/canvas automatically if unavailable
            // Rendering is now driven manually (see pixiRenderer.js's
            // render(), which calls app.renderer.render(app.stage) itself
            // at the very end) instead of Pixi's own independent ticker.
            // This became necessary once the boss screen-split effect
            // needed a "render the world to a texture, THEN composite it"
            // two-pass step every frame — with the ticker auto-rendering
            // on its own schedule, there was no guaranteed ordering
            // between "world layers updated for this frame" and "world
            // captured to texture" and "texture composited to canvas".
            // Manual rendering makes all three happen in the fixed order
            // pixiRenderer.js's render() lays out, every frame,
            // guaranteed — the same single-synchronous-call structure the
            // original Canvas2D renderer.js already relies on.
            autoStart: false,
        });
        this.app.ticker.stop();

        // World-space layers: everything the original draws to its offscreen
        // `_worldCanvas` (renderer.js) — i.e. everything subject to the boss
        // screen-split effect. These are NOT added to app.stage directly;
        // they're captured into `worldTexture` each frame (see
        // pixiRenderer.js's _compositeWorld) and it's that texture which
        // actually gets shown, via compositeLayer, split or not.
        //
        // Two of worldContainer's children are NOT camera-pan-affected even
        // though they ARE split-affected: `revealBar` (the black strip that
        // covers the sliver of canvas exposed on the left when the camera
        // pans right — matches the original's `if (camOffset!==0)
        // fillRect(0,0,camOffset,H)`, which happens outside the
        // translate/restore pair) and `cutsceneBalls` (CutsceneManager's
        // background ball swarm — the original draws these via
        // `CutsceneManager.drawBalls(wctx)` specifically AFTER the
        // translate is restored, i.e. into world-canvas/split-affected
        // space but at fixed screen coordinates, not panned). Everything
        // else that needs panning lives inside `pannedContainer`, whose `x`
        // pixiRenderer.js's _compositeWorld sets to
        // `CutsceneManager.cameraOffsetX` each frame.
        //
        // pannedContainer's own child order mirrors renderer.js's
        // render()/_drawEntities: background -> path decorations ->
        // acidPools (drawn before explosions/entities in the original) ->
        // explosions (also before entities, i.e. AOE burst circles sit
        // under towers/enemies) -> towerUnderEffects (buff-state visuals
        // that draw BEHIND the tower sprite — ice arctic wind, wizard fire
        // wells, alchemist monster form, dart's fan club aura, Gojo/Sauda/
        // Geto's ability VFX) -> towers -> minions (beasts/sentries) ->
        // projectiles -> enemies (drawn AFTER projectiles, on top of them)
        // -> effects (particles, drawn last among entities) -> overlay
        // (floating text -> placement preview -> selection outline ->
        // leak-flash, in that fixed order — all still world-space and
        // pan-affected, matching the original).
        this.worldContainer = new Container();
        this.worldContainer.label = 'world';

        this.revealBar = new Container();
        this.revealBar.label = 'revealBar';
        this.worldContainer.addChild(this.revealBar);

        this.pannedContainer = new Container();
        this.pannedContainer.label = 'panned';
        this.worldContainer.addChild(this.pannedContainer);
        const order = ['background', 'path', 'acidPools', 'explosions', 'selectionFill', 'towerUnderEffects', 'towers', 'minions', 'projectiles', 'enemies', 'effects', 'overlay'];
        for (const name of order) {
            const layer = new Container();
            layer.label = name;
            this.pannedContainer.addChild(layer);
            this.layers[name] = layer;
        }

        const cutsceneBallsLayer = new Container();
        cutsceneBallsLayer.label = 'cutsceneBalls';
        this.worldContainer.addChild(cutsceneBallsLayer);
        this.layers['cutsceneBalls'] = cutsceneBallsLayer;

        // antialias:true allocates an MSAA renderbuffer for this target
        // (Pixi only multisamples when textureSource.antialias is truthy).
        // Without it, everything drawn into the world texture — map, towers,
        // enemies, projectiles — rasterizes with aliased edges, since the
        // app-level `antialias:true` only applies to the final stage pass.
        // Requires WebGL2 (Pixi warns + falls back to no AA on WebGL1).
        this.worldTexture = RenderTexture.create({ width: 1280, height: 720, antialias: true });

        // compositeLayer shows worldTexture (whole or split, see
        // _compositeWorld in renderUI.js). cutsceneLayer sits on top of
        // that and IS camera-pan-affected but NOT split-affected — mirrors
        // `CutsceneManager.draw(ctx)` in the original, which runs after the
        // split composite (so the knight/slash/rip visuals are never torn
        // in half) but still inside its own translate(camOffset,0) (so they
        // DO pan with the camera, unlike the boss health bar/cursor/dev
        // overlay in screenUI, which sits above cutsceneLayer and is
        // neither panned nor split-affected).
        this.compositeLayer = new Container();
        this.compositeLayer.label = 'composite';
        this.cutsceneLayer = new Container();
        this.cutsceneLayer.label = 'cutscene';
        this.screenUI = new Container();
        this.screenUI.label = 'screenUI';
        // menuLayer: shown instead of everything above when
        // `engine.gameState === 'menu' || !engine.map` — see
        // pixiRenderer.js's render() for the early-return branch and
        // renderMenu.js for what's actually drawn into it. Added first so
        // it sits behind screenUI (which still shows the dev overlay in
        // the menu, matching the original).
        this.menuLayer = new Container();
        this.menuLayer.label = 'menu';
        // worldContainer is added to the stage so renderUI.js's
        // _compositeWorld can render it DIRECTLY (skipping the offscreen
        // render-to-texture pass) on frames with no boss screen effect. It
        // sits above compositeLayer (which shows the texture) but below
        // cutsceneLayer; its own `visible` toggles between the direct and
        // render-to-texture paths, so the world is never drawn twice.
        this.app.stage.addChild(this.menuLayer, this.compositeLayer, this.worldContainer, this.cutsceneLayer, this.screenUI);

        // Stage-level containers are NOT panned world layers, so they aren't
        // in the loop above — but renderUI.js/renderCutscene.js look several
        // of them up via PixiApp.layer('screenUI') etc. Register them here so
        // those lookups resolve (previously layer('screenUI') returned
        // undefined and the cursor/boss-bar/warning-line/dev-overlay draws
        // threw inside _safeDraw every frame, silently hiding them all).
        this.layers['screenUI'] = this.screenUI;
        this.layers['cutscene'] = this.cutsceneLayer;
        this.layers['composite'] = this.compositeLayer;
        this.layers['menu'] = this.menuLayer;

        return this.app;
    },

    // Convenience accessor used by pixiRenderer.js and future entity renderers.
    layer(name) {
        return this.layers[name];
    },

    destroy() {
        if (this.app) {
            this.app.destroy(true, { children: true, texture: true });
            this.app = null;
            this.layers = {};
            this.worldContainer = null;
            this.pannedContainer = null;
            this.revealBar = null;
            this.worldTexture = null;
            this.compositeLayer = null;
            this.cutsceneLayer = null;
            this.screenUI = null;
            this.menuLayer = null;
        }
    }
};

