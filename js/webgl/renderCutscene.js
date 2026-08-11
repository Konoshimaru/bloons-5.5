// js/webgl/renderCutscene.js
//
// Native Pixi port of the MOAB-tier boss cutscene (js/cutscene.js +
// js/bosses/cutsceneBalls.js). CutsceneManager.update()/trigger()/reset()
// are pure game-state logic and untouched — this file only replaces its
// two Canvas2D draw methods (drawBalls, draw) and CutsceneBalls.draw().
//
// The "punch-hole particle effect" (CutsceneBalls) is ported to match
// cutsceneBalls.js's two-canvas compositing exactly: all black fill disks go
// into one RenderTexture (the merged blob), and all white rings go into a
// second RenderTexture followed by inner-disc destination-out erase sprites
// (blendMode 'erase'), then the ring texture is composited over the fill
// texture. The erase is what makes overlapping balls' rings cut each other,
// leaving one continuous outline instead of crossing white lines. Each ring
// texture itself is baked from a white disc minus its interior (the canvas
// fill-then-destination-out trick), since Canvas2D has no per-shape stroke
// alignment.
//
// The silhouette-rip (CutsceneManager.draw, states slashing/waiting_to_rip/
// ripping) is the genuinely hard part flagged in MIGRATION.md. The
// original renders the target boss to an offscreen canvas, then uses
// `globalCompositeOperation = 'source-in'` + a white fillRect to recolor
// every non-transparent pixel white while keeping its exact alpha shape —
// a silhouette cutout. Pixi's ColorMatrixFilter can do the same thing in
// one GPU pass: a matrix whose R/G/B rows are `[0,0,0,0,1]` (ignore the
// input color entirely, always output 1.0) and whose alpha row is
// `[0,0,0,1,0]` (pass alpha through unchanged) is exactly "recolor to
// white, keep alpha" — the GPU equivalent of source-in + white fill.
//
// Known simplification: the silhouette only captures the target's base
// body sprite, not its blade overlay (drawn separately in the original,
// see enemyRenderer.js's _drawBlades) or hp-bar/status effects. The rip
// only lasts under a second and the shape read is what matters for the
// beat to land, so this was judged not worth the extra capture pass —
// worth revisiting if it looks visibly wrong.

import { Container, Graphics, Sprite, Texture, RenderTexture, ColorMatrixFilter, Particle, ParticleContainer } from 'pixi.js';
import { PixiApp } from './pixiApp.js';
import { PixiAssets } from './pixiAssets.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GLOBAL_SCALE } from '../constants.js';
import { ENEMY_NAMES, KNIGHT_SCALE, KNIGHT_TRAIL_SCALE, KNIGHT_TRAIL_DRIFT, KNIGHT_SWORD_SCALE, KNIGHT_SLASH_COLOR, KNIGHT_SLASH_EDGE_COLOR, KNIGHT_AIM_TRACK_COLOR, KNIGHT_AIM_LOCK_COLOR } from './rendererConstants.js';
import { CutsceneManager } from '../cutscene.js';
import CutsceneBalls from '../bosses/cutsceneBalls.js';

const slashScale = 1.5;

// R'=1, G'=1, B'=1 regardless of input color; A'=A unchanged. Same result
// as the original's `globalCompositeOperation='source-in'` + white fill.
const WHITE_SILHOUETTE_MATRIX = [
    0, 0, 0, 0, 1,
    0, 0, 0, 0, 1,
    0, 0, 0, 0, 1,
    0, 0, 0, 1, 0,
];

export const CutsceneRenderer = {
    // Perf: the old implementation cleared one shared Graphics and re-added
    // ~2000 circle+stroke pairs every frame, re-tessellating and re-uploading
    // hundreds of thousands of vertices to the GPU each frame (the canvas
    // original does the same 2000 arcs but as cheap 2D raster ops). Instead
    // each ball is a pooled Sprite using one of a handful of pre-baked
    // textures, scaled to its exact radius — per-frame work is just
    // transform/alpha updates, no geometry rebuild.
    //
    // The canvas original paints into TWO offscreen canvases — all black
    // fills into one, all white rings (fill-then-destination-out) into the
    // second — then composites the ring canvas ON TOP of the fill canvas.
    // That draw order is what makes overlapping balls look like ONE merged
    // blob with rings on top. Baking each ball's ring INTO its sprite would
    // break that: later-drawn balls' opaque fills would cover earlier balls'
    // rings, leaving visible seam cracks where balls touch. So this keeps
    // two parallel sprite pools (fills first, rings on top) to reproduce the
    // canvas two-pass exactly.
    _ballBucketRadii: [8, 10, 13, 16, 20, 25, 32, 40, 50, 63, 79, 100],
    // Perf: fill/erase discs are solid black — scale-invariant — so one shared
    // texture covers every ball radius instead of per-bucket textures. That
    // kills the per-ball bucket lookup AND collapses the whole fill pass to a
    // single batch. Rings are NOT shareable (their band width is absolute,
    // radius - outlineWidth), so they stay bucketed. See _getBallRingTexture.
    _ballFillTexture: null,
    _ballFillRadius: 100,
    _ballRingTextures: new Map(),
    _ballRingBucketCache: new Map(),
    _ballFillSprites: [],
    _ballRingSprites: [],
    _ballEraseSprites: [],
    _ballsFillRT: null,
    _ballsRingRT: null,
    _ballsFillComposite: null,
    _ballsRingComposite: null,
    _ballsFillContainer: null,
    _ballsRingContainer: null,
    _ballsEraseContainer: null,
    _ballsRingGroup: null,
    // Perf: the storm is slow (balls jitter ±10px on 1-3 rad/s sin/cos,
    // drifters crawl at ~60-110 px/s) and the canvas original redraws all
    // ~2000 arcs every frame, so we redraw every frame too for parity. The
    // fill + ring/erase passes render into FULL-resolution RenderTextures so
    // the fill silhouette edge and ring band share one pixel grid (any
    // downscale/upscale mismatch shows as stray pixels around the ring).
    _ballPoolBudget: 800,
    // Max ball textures baked per cutscene frame while warming up.
    _ballBakeBudget: 6,
    _ballBakeQueue: null,

    _ballBucketIndex(r) {
        let idx = this._ballBucketRadii.findIndex(br => br >= r);
        if (idx === -1) idx = this._ballBucketRadii.length - 1;
        return idx;
    },

    // One shared solid-black disc for every ball radius (fill and erase
    // passes). Solid discs are scale-invariant, so scaling a 100px disc to
    // any radius is pixel-identical to a per-bucket texture — but it's a
    // single texture, so the whole pass batches into one draw call and the
    // per-ball bucket lookup disappears.
    _getBallFillTexture() {
        if (!this._ballFillTexture) {
            const g = new Graphics();
            g.circle(0, 0, this._ballFillRadius).fill({ color: '#000000' });
            // textureSourceOptions sets the sampler to nearest AT CREATION, so
            // it can't be lost to the silent-no-op on post-upload assignment.
            this._ballFillTexture = PixiApp.app.renderer.generateTexture({ target: g, resolution: 1, textureSourceOptions: { scaleMode: 'nearest' } });
            g.destroy();
        }
        return this._ballFillTexture;
    },

    _getBallRingTexture(r, outlineWidth) {
        // Perf: balls keep a fixed radius for the whole fight, so cache the
        // (bucket index, texture, radius) lookup per radius — no findIndex or
        // string-key concat in the per-frame loop. The baked texture is still
        // keyed by BUCKET index + outlineWidth (only ~12 textures), so all
        // balls sharing a bucket batch into one draw call.
        const cacheKey = `${r}_${outlineWidth}`;
        let cached = this._ballRingBucketCache.get(cacheKey);
        if (cached) return cached;
        const idx = this._ballBucketIndex(r);
        const textureKey = `${idx}_${outlineWidth}`;
        let texture = this._ballRingTextures.get(textureKey);
        if (!texture) {
            const radius = this._ballBucketRadii[idx];
            // Bake the ring exactly like cutsceneBalls.js does: a full white
            // disc with its interior erased (destination-out) by a smaller
            // disc, leaving the inner-aligned band [radius - outlineWidth,
            // radius] — matching the canvas silhouette instead of a centered
            // stroke.
            const outer = new Graphics();
            outer.circle(0, 0, radius).fill({ color: '#ffffff' });
            const inner = new Graphics();
            inner.circle(0, 0, Math.max(0, radius - outlineWidth)).fill({ color: '#000000' });
            inner.blendMode = 'erase';
            const c = new Container();
            c.addChild(outer, inner);
            texture = PixiApp.app.renderer.generateTexture({ target: c, resolution: 2, textureSourceOptions: { scaleMode: 'nearest' } });
            // resolution 2 bakes the 4px outline band to 8 texels, so the
            // nearest-sampled downscale to each ball's radius keeps the band
            // edge crisp instead of dropping texels into stray speckles.
            c.destroy({ children: true });
            this._ballRingTextures.set(textureKey, texture);
        }
        cached = { texture, radius: this._ballBucketRadii[idx] };
        this._ballRingBucketCache.set(cacheKey, cached);
        return cached;
    },

    // Bakes the small set of ball textures gradually (up to `budget` per
    // call) instead of all at once on the fight's first frame. Fires while
    // the cutscene plays, well before knight_floating, so the first frame of
    // the fight only pays ~0ms of generateTexture. Idempotent; the bake
    // queue is drained once and never rebuilt (a late BallsConfig
    // outlineWidth change lazily bakes its own ring textures on first use).
    _warmBallTextures(budget) {
        if (!this._ballBakeQueue) {
            this._ballBakeQueue = [];
            // Fill/erase share one scale-invariant disc; only rings are per-bucket.
            this._ballBakeQueue.push(['fill']);
            const widths = new Set([4]);
            const cfg = window.BallsConfig || {};
            if (typeof cfg.outlineWidth === 'number') widths.add(cfg.outlineWidth);
            for (const w of widths) {
                for (let i = 0; i < this._ballBucketRadii.length; i++) {
                    this._ballBakeQueue.push(['ring', this._ballBucketRadii[i], w]);
                }
            }
        }
        let n = 0;
        while (this._ballBakeQueue.length && n < budget) {
            const [kind, rad, w] = this._ballBakeQueue.shift();
            if (kind === 'fill') this._getBallFillTexture();
            else this._getBallRingTexture(rad, w);
            n++;
        }
    },

    // Grows the three sprite pools toward `target`, creating at most `budget`
    // new sprites per call (spread across frames) so the first fight frame
    // doesn't allocate 6390 sprites synchronously. Returns the count created.
    //
    // Fill and erase are plain Particles (lightweight records, not display
    // objects) in ParticleContainers — both passes only ever use the single
    // shared black disc, so texture is set once here and never changes, and
    // the particles just write position/scale/alpha straight into a shared
    // GPU buffer each frame. The ring pool stays as Sprites because its
    // texture is picked per radius bucket and can change at runtime (drifter
    // balls cross bucket boundaries as they shrink).
    _growBallSprites(target, budget) {
        let created = 0;
        const fillTexture = this._getBallFillTexture();
        while (this._ballFillSprites.length < target && created < budget) {
            const p = new Particle({ texture: fillTexture, anchorX: 0.5, anchorY: 0.5 });
            this._ballsFillContainer.addParticle(p); this._ballFillSprites.push(p); created++;
        }
        while (this._ballRingSprites.length < target && created < budget) {
            const s = new Sprite(); s.anchor.set(0.5); this._ballsRingContainer.addChild(s); this._ballRingSprites.push(s); created++;
        }
        while (this._ballEraseSprites.length < target && created < budget) {
            const p = new Particle({ texture: fillTexture, anchorX: 0.5, anchorY: 0.5 });
            this._ballsEraseContainer.addParticle(p); this._ballEraseSprites.push(p); created++;
        }
        return created;
    },

    _drawCutsceneBalls(engine) {
        if (!this._cutsceneBallsLayer) {
            this._cutsceneBallsLayer = PixiApp.layer('cutsceneBalls');
        }
        const layer = this._cutsceneBallsLayer;
        const balls = CutsceneBalls.blackBalls || [];
        const active = CutsceneManager.state === 'knight_floating';

        if (!this._ballsFillRT) {
            // BOTH render textures are FULL resolution so the fill silhouette
            // edge and the ring band land on the same pixel grid. Splitting
            // them (0.75 fill vs 1.0 ring) made the chunky upscaled fill edge
            // round outward past the crisp ring edge, leaving stray black
            // specks on the ring's outer border. scaleMode is set natively in
            // the create options so nearest sampling is guaranteed from the
            // very first upload (no post-upload no-op to worry about).
            this._ballsFillRT = RenderTexture.create({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, scaleMode: 'nearest' });
            this._ballsRingRT = RenderTexture.create({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, scaleMode: 'nearest' });
        }
        if (!this._ballsFillComposite) {
            this._ballsFillComposite = new Sprite(this._ballsFillRT);
            this._ballsRingComposite = new Sprite(this._ballsRingRT);
            this._ballsFillComposite.scale.set(1, 1);
            this._ballsRingComposite.scale.set(1, 1);
            layer.addChild(this._ballsFillComposite, this._ballsRingComposite);
        }
        if (!this._ballsFillContainer) {
            // Fill and erase are ParticleContainers (see _growBallSprites):
            // position/scale/color are dynamic, everything else (vertex size,
            // rotation, uvs) is static and computed once on add. `vertex` is
            // dynamic here on purpose — the particle's corner offsets are
            // baked from its scaleX/scaleY, and every ball rescales each frame.
            const particleProps = { position: true, vertex: true, color: true, rotation: false, uvs: false };
            this._ballsFillContainer = new ParticleContainer({ texture: this._getBallFillTexture(), dynamicProperties: particleProps });
            this._ballsEraseContainer = new ParticleContainer({ texture: this._getBallFillTexture(), dynamicProperties: particleProps });
            // The whole erase pass shares one blend mode; setting it on the
            // container (once) instead of per sprite avoids 2130 blend-state
            // changes per frame. Same rendered result — erasing an already
            // erased pixel is idempotent.
            this._ballsEraseContainer.blendMode = 'erase';
            this._ballsRingContainer = new Container();
            this._ballsRingGroup = new Container();
            this._ballsRingGroup.addChild(this._ballsRingContainer, this._ballsEraseContainer);
            // The source containers draw in fullscreen (0,0..CANVAS_W/H)
            // coordinates. All three scale 1.0 into their full-res
            // RenderTextures so the fill edge and ring band share one pixel
            // grid (any downscale/upscale mismatch shows as stray edge pixels).
            this._ballsFillContainer.scale.set(1, 1);
            this._ballsRingContainer.scale.set(1, 1);
            this._ballsEraseContainer.scale.set(1, 1);
        }

        // While the cutscene plays (but before the fight phase), bake the
        // small set of ball textures gradually so the first knight_floating
        // frame doesn't spend ~30ms in generateTexture.
        if (CutsceneManager.state !== 'idle') this._warmBallTextures(this._ballBakeBudget);

        // Grow the sprite pool gradually (budget per frame) so the first
        // knight_floating frame doesn't allocate all 6390 sprites at once.
        this._growBallSprites(balls.length, this._ballPoolBudget);
        while (this._ballFillSprites.length > balls.length) this._ballsFillContainer.removeParticle(this._ballFillSprites.pop());
        while (this._ballRingSprites.length > balls.length) this._ballRingSprites.pop().destroy();
        while (this._ballEraseSprites.length > balls.length) this._ballsEraseContainer.removeParticle(this._ballEraseSprites.pop());

        this._ballsFillComposite.visible = active;
        this._ballsRingComposite.visible = active;

        if (!active) {
            for (const p of this._ballFillSprites) p.alpha = 0;
            for (const s of this._ballRingSprites) s.visible = false;
            for (const p of this._ballEraseSprites) p.alpha = 0;
            return;
        }

        // Full-rate redraw: the canvas original redraws the storm every frame,
        // so we redraw the full-res RenderTextures every frame too. Between
        // frames the cached RenderTextures stay composited while the pool is
        // still growing.
        const cfg = window.BallsConfig || {};
        const outlineWidth = cfg.outlineWidth ?? 4;
        const t = performance.now() / 1000;

        // Only touch sprites that actually exist while the pool is growing.
        const drawn = Math.min(balls.length, this._ballFillSprites.length, this._ballRingSprites.length, this._ballEraseSprites.length);
        // The canvas paints every ball, off-screen ones included (canvas clips
        // them), so culling outside the viewport is pixel-identical but skips
        // both the sprite updates and the RT fill for those balls. The storm
        // spans a ~700x700 cloud; typically a quarter of the balls sit off-screen.
        const viewL = 0, viewR = CANVAS_WIDTH, viewT = 0, viewB = CANVAS_HEIGHT;

        const fillScaleToR = 1 / this._ballFillRadius;

        for (let i = 0; i < drawn; i++) {
            const b = balls[i];
            if (!(b.r > 0)) {
                this._ballFillSprites[i].alpha = 0;
                this._ballRingSprites[i].visible = false;
                this._ballEraseSprites[i].alpha = 0;
                continue;
            }
            const sx = CutsceneBalls.ballCenterX + b.ox + Math.sin(t * b.speed + b.phase) * 10;
            const sy = (CANVAS_HEIGHT / 2) + b.oy + Math.cos(t * b.speed + b.phase) * 10;
            if (sx + b.r < viewL || sx - b.r > viewR || sy + b.r < viewT || sy - b.r > viewB) {
                this._ballFillSprites[i].alpha = 0;
                this._ballRingSprites[i].visible = false;
                this._ballEraseSprites[i].alpha = 0;
                continue;
            }
            const alpha = b.alpha !== undefined ? b.alpha : 1.0;

            // Fill pass: all black disks first (later balls merge into the
            // shared silhouette, exactly like ballCanvas in the original).
            const fillSprite = this._ballFillSprites[i];
            fillSprite.scaleX = b.r * fillScaleToR;
            fillSprite.scaleY = b.r * fillScaleToR;
            fillSprite.x = sx; fillSprite.y = sy;
            fillSprite.alpha = alpha;

            // Ring pass: white rings and, after them, the inner-disc erase
            // sprites (destination-out) in the SAME RenderTexture — mirroring
            // ballOutlineCtx's fill-then-destination-out in the original. The
            // erase only ever touches rings (fills live in _ballsFillRT), so
            // overlapping balls cut each other's rings without punching holes
            // in the black silhouette.
            const ringBucket = this._getBallRingTexture(b.r, outlineWidth);
            const ringSprite = this._ballRingSprites[i];
            if (ringSprite.texture !== ringBucket.texture) ringSprite.texture = ringBucket.texture;
            ringSprite.scale.set(b.r / ringBucket.radius);
            ringSprite.x = sx; ringSprite.y = sy;
            ringSprite.alpha = alpha;
            ringSprite.visible = true;

            const innerR = Math.max(0, b.r - outlineWidth);
            const eraseSprite = this._ballEraseSprites[i];
            eraseSprite.scaleX = innerR * fillScaleToR;
            eraseSprite.scaleY = innerR * fillScaleToR;
            eraseSprite.x = sx; eraseSprite.y = sy;
            eraseSprite.alpha = innerR > 0 ? alpha : 0;
        }

        PixiApp.app.renderer.render({ container: this._ballsFillContainer, target: this._ballsFillRT, clear: true });
        PixiApp.app.renderer.render({ container: this._ballsRingGroup, target: this._ballsRingRT, clear: true });
    },

    // Rebuilds the cached white-silhouette RenderTexture for the current
    // cutscene target. The original captures the FULL enemy via
    // `target.draw(offCtx)` (base sprite + MOAB-class blades, un-rotated
    // crack state via the `_maxHp = hp` trick, real world rotation), so the
    // base-sprite-only capture used to be visibly wrong (blades missing,
    // straight-on instead of rotated). This renders a small container that
    // mirrors renderEnemies.js's assembly — base + blades, damagePercent 0 —
    // with the white ColorMatrixFilter applied, then caches it. Rebuilt only
    // when the target or blade animation frame changes.
    _updateCutsceneSilhouette(target) {
        if (!this._silhouetteTexture) {
            this._silhouetteTexture = RenderTexture.create({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
        }
        const frame = target.bladeFrame || 0;
        if (this._silhouetteBuiltFor === target && this._silhouetteFrame === frame) return;
        this._silhouetteBuiltFor = target;
        this._silhouetteFrame = frame;

        const baseName = ENEMY_NAMES[target.tier];
        const baseTexture = PixiAssets.get(`enemy_${baseName}`);
        if (baseTexture === Texture.EMPTY) return;

        const targetSize = (target.data?.size || (target.radius * 2) || 20) * GLOBAL_SCALE;
        const offsetX = target.data?.spriteOffsetX || 0;
        const offsetY = target.data?.spriteOffsetY || 0;

        const c = new Container();
        const baseSprite = new Sprite(baseTexture); baseSprite.anchor.set(0.5);
        const maxDim = Math.max(baseTexture.width, baseTexture.height) || 1;
        const scale = targetSize / maxDim;
        baseSprite.width = baseTexture.width * scale;
        baseSprite.height = baseTexture.height * scale;
        baseSprite.x = offsetX; baseSprite.y = offsetY;
        c.addChild(baseSprite);

        if (baseName === 'moab' || baseName === 'bfb' || baseName === 'zomg') {
            let bladeTexture = PixiAssets.get(`enemy_${baseName}_blades_0_${frame}`);
            if (bladeTexture === Texture.EMPTY && frame === 0) bladeTexture = PixiAssets.get(`enemy_${baseName}_blades_${frame}`);
            if (bladeTexture === Texture.EMPTY) bladeTexture = PixiAssets.get(`enemy_${baseName}_blades_0`);
            if (bladeTexture === Texture.EMPTY && frame === 0) bladeTexture = PixiAssets.get(`enemy_${baseName}_blades`);
            if (bladeTexture !== Texture.EMPTY) {
                const blade = new Sprite(bladeTexture); blade.anchor.set(0.5);
                const maxDim2 = Math.max(bladeTexture.width, bladeTexture.height) || 1;
                const scale2 = targetSize / maxDim2;
                blade.width = bladeTexture.width * scale2;
                blade.height = bladeTexture.height * scale2;
                blade.x = offsetX; blade.y = offsetY;
                c.addChild(blade);
            }
        }

        c.position.set(target.x, target.y);
        if (target.tier >= 13) c.rotation = (target.angle || 0) + Math.PI / 2;
        if (!this._silhouetteFilter) this._silhouetteFilter = new ColorMatrixFilter();
        this._silhouetteFilter.matrix = WHITE_SILHOUETTE_MATRIX;
        c.filters = [this._silhouetteFilter];

        PixiApp.app.renderer.render({ container: c, target: this._silhouetteTexture, clear: true });
        c.destroy({ children: true });
    },

    _ensureCutsceneEntities() {
        if (this._cutsceneEntities) return this._cutsceneEntities;
        const layer = PixiApp.cutsceneLayer;

        const blackRect = new Graphics(); // full-screen blackout during rip states

        const full = new Sprite(); // slashing / waiting_to_rip: whole silhouette, undisturbed
        const leftHalf = new Container();
        const leftSprite = new Sprite();
        const leftMask = new Graphics();
        leftHalf.addChild(leftSprite, leftMask);
        leftSprite.mask = leftMask;

        const rightHalf = new Container();
        const rightSprite = new Sprite();
        const rightMask = new Graphics();
        rightHalf.addChild(rightSprite, rightMask);
        rightSprite.mask = rightMask;

        const slash = new Sprite(); slash.anchor.set(0.5);
        const knight = new Sprite(); knight.anchor.set(0.5);

        // Knight effects (trail / spinning slashes / thrown swords / aim line)
        // mirror KnightRenderer.draw()'s order: trail first, then the knight,
        // then slashes, then swords.
        const knightLayer = new Container();
        const trailLayer = new Container();   // pooled trail ghost sprites
        const slashGfx = new Graphics();      // spinning slash lines
        const aimGfx = new Graphics();        // cursor-sword dashed aim lines
        const swordLayer = new Container();   // pooled thrown-sword sprites
        knightLayer.addChild(trailLayer, knight, slashGfx, aimGfx, swordLayer);

        layer.addChild(blackRect, full, leftHalf, rightHalf, slash, knightLayer);
        this._cutsceneEntities = { full, leftHalf, leftSprite, leftMask, rightHalf, rightSprite, rightMask, slash, knight, blackRect, knightLayer, trailLayer, slashGfx, aimGfx, swordLayer, trailSprites: [], swordSprites: [] };
        return this._cutsceneEntities;
    },

    _drawCutscene(engine) {
        const e = this._ensureCutsceneEntities();
        const state = CutsceneManager.state;

        // Camera pan — the one thing this layer does that compositeLayer
        // doesn't: it's split-immune but still pans with the camera,
        // matching CutsceneManager.draw(ctx) running inside the original's
        // translate(camOffset,0)/restore pair (see pixiApp.js's comment on
        // cutsceneLayer for the full reasoning).
        PixiApp.cutsceneLayer.x = CutsceneManager.cameraOffsetX || 0;

        const rippingStates = state === 'slashing' || state === 'waiting_to_rip' || state === 'ripping';

        // Full-screen blackout during the rip states, matching
        // `CutsceneManager.draw`'s `fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT)`
        // (no camera transform, so always canvas-fixed). cutsceneLayer renders
        // after compositeLayer, so the blackout covers the world while the
        // screenUI boss bar and cursor still draw on top, exactly like the
        // original.
        e.blackRect.clear();
        if (rippingStates) e.blackRect.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).fill({ color: '#000000' });

        e.full.visible = false; e.leftHalf.visible = false; e.rightHalf.visible = false;
        e.slash.visible = false;

        if (rippingStates && CutsceneManager.target) {
            this._updateCutsceneSilhouette(CutsceneManager.target);
            const target = CutsceneManager.target;

            if (state === 'slashing' || state === 'waiting_to_rip') {
                e.full.visible = true;
                if (e.full.texture !== this._silhouetteTexture) e.full.texture = this._silhouetteTexture;
                e.full.position.set(0, 0);
            } else {
                // ripping: two 200x400 vertical strips either side of the
                // target's own center, each in its own rotated/translated
                // local frame — see the file header for the derivation.
                e.leftHalf.visible = true; e.rightHalf.visible = true;
                const t = CutsceneManager.ripProgress;
                const drop = t * t * 1000;
                const spread = t * 200;
                const rot = t * 6;

                if (e.leftSprite.texture !== this._silhouetteTexture) { e.leftSprite.texture = this._silhouetteTexture; e.rightSprite.texture = this._silhouetteTexture; }
                e.leftSprite.position.set(-target.x, -target.y);
                e.rightSprite.position.set(-target.x, -target.y);

                e.leftHalf.position.set(target.x - spread, target.y + drop);
                e.leftHalf.rotation = -rot;
                e.rightHalf.position.set(target.x + spread, target.y + drop);
                e.rightHalf.rotation = rot;

                e.leftMask.clear().rect(-200, -200, 200, 400).fill({ color: '#ffffff' });
                e.rightMask.clear().rect(0, -200, 200, 400).fill({ color: '#ffffff' });
            }
        }

        if (state === 'slashing' && CutsceneManager.target) {
            const progress = 1 - (CutsceneManager.timer / 0.7); // PHASE_SLASH_DURATION
            const frame = Math.min(14, Math.floor(progress * 14) + 1);
            const texture = PixiAssets.get(`effect_slash_${frame}`);
            if (texture !== Texture.EMPTY) {
                e.slash.visible = true;
                if (e.slash.texture !== texture) e.slash.texture = texture;
                e.slash.position.set(CutsceneManager.target.x, CutsceneManager.target.y);
                e.slash.scale.set(-slashScale, slashScale); // ctx.scale(-1,1) mirror
            }
        }

        if (CutsceneManager.knightEnemy) {
            this._drawKnightEffects(e, CutsceneManager.knightEnemy);
        } else {
            this._clearKnightEffects(e);
        }
    },

    // Hides every knight effect node at once (used when the knight isn't on
    // screen, including the 'idle' cutscene state).
    _clearKnightEffects(e) {
        e.knight.visible = false;
        for (const s of e.trailSprites) s.visible = false;
        for (const s of e.swordSprites) s.visible = false;
        e.slashGfx.clear();
        e.aimGfx.clear();
    },

    // Port of KnightRenderer.draw() (js/bosses/knightRenderer.js): trail
    // ghosts first, then the knight body, then the spinning slashes, then
    // the thrown swords with their cursor aim lines. All transforms happen
    // on the entity's live position, so the cutscene knight reuses the same
    // renderer path as the in-game boss (knightRenderer is driven entirely
    // from this.x/this.y/knightTrail/spinningSlashes/thrownSwords).
    _drawKnightEffects(e, knight) {
        // --- Trail ghosts: `enemy_knight_front` at trailScale, mirrored via
        // ctx.scale(-1,1), alpha = trail alpha (fades as it ages). ---
        const trail = knight.knightTrail || [];
        while (e.trailSprites.length < trail.length) {
            const s = new Sprite(); s.anchor.set(0.5); e.trailLayer.addChild(s); e.trailSprites.push(s);
        }
        while (e.trailSprites.length > trail.length) e.trailSprites.pop().destroy();
        const trailTexture = PixiAssets.get('enemy_knight_front');
        PixiAssets.setPixelArt('enemy_knight_front');
        for (let i = 0; i < e.trailSprites.length; i++) {
            const s = e.trailSprites[i];
            if (i < trail.length && trailTexture !== Texture.EMPTY) {
                const t = trail[i];
                s.visible = true;
                s.texture = trailTexture;
                s.width = trailTexture.width * KNIGHT_TRAIL_SCALE;
                s.height = trailTexture.height * KNIGHT_TRAIL_SCALE;
                s.scale.x = -Math.abs(s.scale.x); // ctx.scale(-1,1) mirror
                s.x = t.x - i * KNIGHT_TRAIL_DRIFT; s.y = t.y;
                s.alpha = Math.max(0, Math.min(1, t.alpha));
            } else {
                s.visible = false;
            }
        }

        // --- Knight body: `knight.sprite` (enemy_knight_front/back) at
        // knightScale, mirrored. ---
        const texture = PixiAssets.get(knight.sprite);
        PixiAssets.setPixelArt(knight.sprite);
        if (texture !== Texture.EMPTY) {
            e.knight.visible = true;
            if (e.knight.texture !== texture) e.knight.texture = texture;
            e.knight.width = texture.width * KNIGHT_SCALE;
            e.knight.height = texture.height * KNIGHT_SCALE;
            e.knight.scale.x = -Math.abs(e.knight.scale.x);
            e.knight.x = knight.x; e.knight.y = knight.y;
            e.knight.alpha = Math.min(1, knight.alpha ?? 1);
        } else {
            e.knight.visible = false;
        }

        // --- Spinning slashes: a thick translucent red line with a thin
        // white core, both spanning the full slash length about its pivot. ---
        e.slashGfx.clear();
        for (const s of knight.spinningSlashes || []) {
            const cos = Math.cos(s.angle), sin = Math.sin(s.angle);
            const p1x = s.pivotX - cos * s.length, p1y = s.pivotY - sin * s.length;
            const p2x = s.pivotX + cos * s.length, p2y = s.pivotY + sin * s.length;
            e.slashGfx.moveTo(p1x, p1y).lineTo(p2x, p2y).stroke({ width: 10, color: KNIGHT_SLASH_COLOR, alpha: s.alpha });
            e.slashGfx.moveTo(p1x, p1y).lineTo(p2x, p2y).stroke({ width: 3, color: KNIGHT_SLASH_EDGE_COLOR, alpha: s.alpha });
        }

        // --- Thrown swords: dashed aim line during the cursor sword's
        // track/lock phases, then the sword sprite at swordScale. ---
        e.aimGfx.clear();
        const swords = knight.thrownSwords || [];
        while (e.swordSprites.length < swords.length) {
            const s = new Sprite(); s.anchor.set(0.5); e.swordLayer.addChild(s); e.swordSprites.push(s);
        }
        while (e.swordSprites.length > swords.length) e.swordSprites.pop().destroy();
        const swordTexture = PixiAssets.get('proj_knightsword');
        PixiAssets.setPixelArt('proj_knightsword');
        for (let i = 0; i < swords.length; i++) {
            const s = swords[i];
            const sprite = e.swordSprites[i];
            if (s.isCursorSword && (s.phase === 'track' || s.phase === 'lock')) {
                const color = s.phase === 'lock' ? KNIGHT_AIM_LOCK_COLOR : KNIGHT_AIM_TRACK_COLOR;
                this._strokeDashedLine(e.aimGfx, s.x + 20, s.y, CANVAS_WIDTH, s.y, 15, 10, color, 3);
            }
            if (swordTexture !== Texture.EMPTY) {
                sprite.visible = true;
                sprite.texture = swordTexture;
                sprite.width = swordTexture.width * KNIGHT_SWORD_SCALE;
                sprite.height = swordTexture.height * KNIGHT_SWORD_SCALE;
                sprite.rotation = 0;
                sprite.x = s.x; sprite.y = s.y;
                sprite.alpha = 1;
            } else {
                sprite.visible = false;
            }
        }
        for (let i = swords.length; i < e.swordSprites.length; i++) e.swordSprites[i].visible = false;
    },

    // A straight dashed line built from discrete segments. Pixi v8 Graphics
    // has no dashed-line primitive, so we hand-roll it with moveTo/lineTo
    // subpaths and one stroke() (same trick as _drawCaptureVFX).
    _strokeDashedLine(gfx, x1, y1, x2, y2, dashLen, gapLen, color, width) {
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        if (len <= 0) return;
        const nx = dx / len, ny = dy / len;
        const cycle = dashLen + gapLen;
        for (let d = 0; d < len; d += cycle) {
            const end = Math.min(d + dashLen, len);
            gfx.moveTo(x1 + nx * d, y1 + ny * d).lineTo(x1 + nx * end, y1 + ny * end);
        }
        gfx.stroke({ width, color });
    },

    // The black strip revealed on the left when the camera pans right,
    // matching the original's `if (camOffset!==0) fillRect(0,0,camOffset,H)`
    // (drawn outside the translate/restore pair, so it isn't itself panned).
    _drawCutsceneRevealBar(engine) {
        if (!this._revealBarGfx) {
            this._revealBarGfx = new Graphics();
            PixiApp.revealBar.addChild(this._revealBarGfx);
        }
        const g = this._revealBarGfx;
        g.clear();
        const camOffset = CutsceneManager.cameraOffsetX || 0;
        if (camOffset !== 0) g.rect(0, 0, camOffset, CANVAS_HEIGHT).fill({ color: '#000000' });
    },
};
