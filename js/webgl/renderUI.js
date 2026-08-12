// js/webgl/renderUI.js
import { Sprite, Container, Texture, Graphics, Text, Rectangle } from 'pixi.js';
import { PixiApp } from './pixiApp.js';
import { PixiAssets } from './pixiAssets.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GLOBAL_SCALE, GAME_AREA_WIDTH } from '../constants.js';
import { TowerStats } from '../towers/index.js';
import { HeroStats, Config } from '../config.js';
import { Utils } from '../utils.js';
import { applyBossEffects } from '../input.js';
import { BossHealthBarHandler } from '../BossHealthBarHandler.js';
import { CutsceneManager } from '../cutscene.js';
import { isMobile } from '../mobile.js';
import * as Const from './rendererConstants.js';

export const UIRenderer = {
    _drawFloatingTexts(engine) {
        if (!this._floatingTextsLayer) {
            this._floatingTextsLayer = new Container(); PixiApp.layer('overlay').addChild(this._floatingTextsLayer);
        }
        const layer = this._floatingTextsLayer; const seen = new Set();
        for (const ft of engine.floatingTexts || []) {
            if (!ft) continue; seen.add(ft);
            let text = this._floatingTextSprites.get(ft);
            if (!text) {
                text = new Text({ text: '', style: { fontFamily: 'Nunito, sans-serif', fontSize: 20 * GLOBAL_SCALE, fontWeight: 'bold', fill: Const.FLOATING_TEXT_DEFAULT_COLOR, stroke: { color: 0x000000, width: 3 } } });
                text.anchor.set(0.5); layer.addChild(text); this._floatingTextSprites.set(ft, text);
            }
            if (text.text !== ft.text) text.text = ft.text;
            if (ft.color) text.style.fill = ft.color;
            text.x = ft.x; text.y = ft.y; text.alpha = Math.max(0, Math.min(1, ft.life / ft.maxLife));
        }
        for (const [ft, text] of this._floatingTextSprites) {
            if (!seen.has(ft)) { text.destroy(); this._floatingTextSprites.delete(ft); }
        }
    },

    // Selection highlight is drawn by the tower renderer itself (a white glow
    // around the sprite, matching the canvas drop-shadow outline) — see
    // renderTowers.js _updateSelectionGlow. No range-circle overlay here.

    _drawLeakFlash(engine) {
        if (!this._leakFlashGraphics) { this._leakFlashGraphics = new Graphics(); PixiApp.layer('overlay').addChild(this._leakFlashGraphics); }
        const g = this._leakFlashGraphics; g.clear();
        if (engine.leakFlash > 0) { g.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).stroke({ width: Const.LEAK_FLASH_LINE_WIDTH, color: Const.LEAK_FLASH_COLOR, alpha: engine.leakFlash }); }
    },

    // Renders PixiApp.worldContainer (everything the original draws to its
    // offscreen `_worldCanvas`) into worldTexture, then shows that texture
    // via PixiApp.compositeLayer — either whole, or split top/bottom with a
    // horizontal offset for the boss screen-tear attack. Mirrors
    // renderer.js's render() lines ~85-126 exactly, including which branch
    // wins when (warningLineActive beats screenSplitActive, matching the
    // original's if/else-if order).
    //
    // NOT handled here: camera pan (`CutsceneManager.cameraOffsetX`). The
    // original applies that as a translate on _worldCanvas's context before
    // drawing anything into it; CutsceneManager itself isn't ported at all
    // yet (see MIGRATION.md), so there's nothing to pan. Once it is, that
    // offset belongs on `PixiApp.worldContainer.x` before the render-to-
    // texture call below, not here in the compositing step.
    _compositeWorld(engine) {
        if (!this._compositeFull) {
            // Full-screen black backdrop, first child of compositeLayer.
            // The original Canvas2D renderer clears the on-screen canvas to
            // black every frame before compositing the world (renderer.js:
            // `ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)`), so any
            // canvas edge exposed by the boss screen-split shows black — not
            // the canvas element's CSS background (#8acc4d green in
            // game-ui.css, visible here because PixiApp uses
            // backgroundAlpha:0).
            this._compositeBackdrop = new Graphics();
            this._compositeBackdrop.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).fill('#000');
            this._compositeFull = new Sprite(PixiApp.worldTexture);
            const topTex = new Texture({ source: PixiApp.worldTexture.source, frame: new Rectangle(0, 0, CANVAS_WIDTH, 360) });
            const bottomTex = new Texture({ source: PixiApp.worldTexture.source, frame: new Rectangle(0, 360, CANVAS_WIDTH, 360) });
            this._compositeTop = new Sprite(topTex);
            this._compositeBottom = new Sprite(bottomTex); this._compositeBottom.y = 360;
            this._compositeSplitBar = new Graphics();
            PixiApp.compositeLayer.addChild(this._compositeBackdrop, this._compositeFull, this._compositeTop, this._compositeBottom, this._compositeSplitBar);
        }

        // Camera pan (CutsceneManager.cameraOffsetX) applies to everything
        // panned-and-split (map, entities, etc.) but NOT to revealBar or
        // cutsceneBalls — see pixiApp.js's comment on those two for why.
        // Must be set before the render-to-texture capture below.
        PixiApp.pannedContainer.x = CutsceneManager.cameraOffsetX || 0;

        const boss = BossHealthBarHandler.activeBosses.length > 0 ? BossHealthBarHandler.activeBosses[0].enemy : null;
        const split = boss && (boss.screenSplitActive || boss.currentOffset !== 0);
        const warning = boss && boss.warningLineActive;

        if (!warning && !split) {
            // Fast path: no boss screen effect this frame, so skip the
            // 4x-MSAA render-to-texture pass entirely and draw the world
            // layers straight to the stage. worldContainer is a child of
            // app.stage (see pixiApp.js); the composite sprites/backdrop
            // that would normally display the texture are hidden so the
            // world shows through once, not twice.
            PixiApp.worldContainer.visible = true;
            this._compositeBackdrop.visible = false;
            this._compositeFull.visible = false;
            this._compositeTop.visible = false; this._compositeBottom.visible = false;
            this._compositeSplitBar.visible = false;
            PixiApp.app.renderer.render(PixiApp.app.stage);
            return;
        }

        // Boss screen effect active: capture this frame's world-space
        // content into worldTexture, then composite it (whole, split, or
        // under the warning line). Must happen after every other
        // _draw*/_drawHeroVFX call has updated the world layers for this
        // frame, and before this method's own compositing below reads from
        // the texture it just wrote — pixiRenderer.js's render() calls this
        // last for exactly that reason.
        //
        // renderer.render() bails out early when the root container's
        // `visible` is false (AbstractRenderer.mjs:97), so it must be
        // explicitly trueed here even though a previous split frame hid it.
        PixiApp.worldContainer.visible = true;
        PixiApp.app.renderer.render({ container: PixiApp.worldContainer, target: PixiApp.worldTexture });

        // Hide the world layers before the stage pass so the direct render
        // doesn't double-draw.
        PixiApp.worldContainer.visible = false;
        this._compositeBackdrop.visible = true;
        this._compositeSplitBar.visible = true;

        this._compositeSplitBar.clear();

        if (warning) {
            this._compositeFull.visible = true;
            this._compositeTop.visible = false; this._compositeBottom.visible = false;
            // The warning line itself is drawn by _drawBossWarningLine into
            // screenUI, on top of compositeLayer — nothing more to do here.
        } else if (split) {
            this._compositeFull.visible = false;
            this._compositeTop.visible = true; this._compositeBottom.visible = true;
            const offset = boss.currentOffset;
            this._compositeTop.x = offset;
            this._compositeBottom.x = -offset;
            if (Math.abs(offset) > 10) {
                this._compositeSplitBar.rect(0, 355, CANVAS_WIDTH, 10).fill({ color: 'rgba(0,0,0,0.8)' });
                this._compositeSplitBar.moveTo(0, 360).lineTo(CANVAS_WIDTH, 360).stroke({ width: 2, color: 'rgba(231, 76, 60, 0.5)' });
            }
        } else {
            this._compositeFull.visible = true;
            this._compositeTop.visible = false; this._compositeBottom.visible = false;
        }

        // Manual render, replacing Pixi's own autoStart ticker (disabled in
        // pixiApp.js) — see the comment there for why. This must be the
        // last thing that happens each frame, after every layer (world AND
        // screenUI) has been updated.
        PixiApp.app.renderer.render(PixiApp.app.stage);
    },


    // overlay). These live in PixiApp.layer('screenUI'), NOT 'overlay' —
    // 'overlay' is one of the world-space layers captured into worldTexture
    // for the boss screen-split composite (see _compositeWorld below), and
    // the original draws all four of these straight to the final canvas
    // AFTER that composite step, so a screen-split boss fight never tears
    // the health bar, warning line, or cursor in half. This distinction
    // didn't matter before _compositeWorld existed (nothing was splitting
    // anything), so if you're seeing this comment while looking for why
    // something moved layers, that's why.
    _drawBossHealthBar(engine) {
        if (BossHealthBarHandler.activeBosses.length > 0) {
            BossHealthBarHandler.activeBosses = BossHealthBarHandler.activeBosses.filter(b => b.enemy && b.enemy.alive);
        }
        const bosses = BossHealthBarHandler.activeBosses; const layer = PixiApp.layer('screenUI'); const seen = new Set();
        bosses.forEach((boss, index) => {
            seen.add(boss); let entry = this._bossBarEntries.get(boss);
            if (!entry) {
                const graphics = new Graphics(); const label = new Text({ text: '', style: { fontSize: 14, fontWeight: 'bold', fill: 0xffffff, fontFamily: 'Arial' } });
                label.anchor.set(0.5); layer.addChild(graphics, label); entry = { graphics, label }; this._bossBarEntries.set(boss, entry);
            }
            const { graphics, label } = entry;
            const startX = (GAME_AREA_WIDTH - Const.BOSS_BAR_WIDTH) / 2;
            const y = Const.BOSS_BAR_START_Y + index * Const.BOSS_BAR_SPACING;
            const currentHp = Math.max(0, boss.enemy.hp); const hpPercent = boss.maxHp > 0 ? currentHp / boss.maxHp : 0;
            const fillWidth = Const.BOSS_BAR_WIDTH * hpPercent;
            graphics.clear();
            graphics.rect(startX - 3, y - 3, Const.BOSS_BAR_WIDTH + 6, Const.BOSS_BAR_HEIGHT + 6).fill({ color: Const.BOSS_BAR_BORDER_COLOR, alpha: Const.BOSS_BAR_BORDER_ALPHA });
            graphics.rect(startX, y, Const.BOSS_BAR_WIDTH, Const.BOSS_BAR_HEIGHT).fill({ color: Const.BOSS_BAR_EMPTY_COLOR });
            if (fillWidth > 0) {
                graphics.rect(startX, y, fillWidth, Const.BOSS_BAR_HEIGHT).fill({ color: boss.color });
                graphics.rect(startX, y, fillWidth, Const.BOSS_BAR_HEIGHT / 2).fill({ color: Const.BOSS_BAR_HIGHLIGHT_COLOR, alpha: Const.BOSS_BAR_HIGHLIGHT_ALPHA });
            }
            const text = `${boss.name}: ${Math.ceil(currentHp)} / ${boss.maxHp}`;
            if (label.text !== text) label.text = text;
            label.x = startX + Const.BOSS_BAR_WIDTH / 2; label.y = y + Const.BOSS_BAR_HEIGHT / 2;
        });
        for (const [boss, entry] of this._bossBarEntries) {
            if (!seen.has(boss)) { entry.graphics.destroy(); entry.label.destroy(); this._bossBarEntries.delete(boss); }
        }
    },

    _drawBossWarningLine(engine) {
        if (!this._bossWarningLineGraphics) { this._bossWarningLineGraphics = new Graphics(); PixiApp.layer('screenUI').addChild(this._bossWarningLineGraphics); }
        const g = this._bossWarningLineGraphics; g.clear();
        const boss = BossHealthBarHandler.activeBosses.length > 0 ? BossHealthBarHandler.activeBosses[0].enemy : null;
        if (!boss || !boss.warningLineActive) return;
        const lineAlpha = Math.max(0, Math.min(1, 1.0 - (boss.stateTimer / Const.BOSS_WARNING_STATE_TIMER_DIVISOR)));
        g.moveTo(0, Const.BOSS_WARNING_Y).lineTo(CANVAS_WIDTH, Const.BOSS_WARNING_Y).stroke({ width: Const.BOSS_WARNING_OUTER_WIDTH, color: Const.BOSS_WARNING_OUTER_COLOR, alpha: lineAlpha });
        g.moveTo(0, Const.BOSS_WARNING_Y).lineTo(CANVAS_WIDTH, Const.BOSS_WARNING_Y).stroke({ width: Const.BOSS_WARNING_INNER_WIDTH, color: Const.BOSS_WARNING_INNER_COLOR, alpha: lineAlpha * 0.9 });
    },

    _drawCursor(engine) {
        if (!this._cursorGraphics) { this._cursorGraphics = new Graphics(); PixiApp.layer('screenUI').addChild(this._cursorGraphics); }
        const g = this._cursorGraphics; g.clear();
        if (engine.gameState !== 'playing' || isMobile.any()) return;
        let cx = engine.mouse.rawX !== undefined ? engine.mouse.rawX : engine.mouse.x;
        let cy = engine.mouse.rawY !== undefined ? engine.mouse.rawY : engine.mouse.y;
        const boss = BossHealthBarHandler.activeBosses.length > 0 ? BossHealthBarHandler.activeBosses[0].enemy : null;
        if (boss && (boss.screenSplitActive || boss.currentOffset !== 0)) { cx += cy < 360 ? boss.currentOffset : -boss.currentOffset; }
        g.moveTo(cx, cy).lineTo(cx + 10, cy + 15).lineTo(cx + 4, cy + 15).lineTo(cx + 2, cy + 20).lineTo(cx - 2, cy + 18).lineTo(cx - 4, cy + 13).lineTo(cx - 10, cy + 10)
            .closePath().fill({ color: Const.CURSOR_FILL_COLOR }).stroke({ width: Const.CURSOR_STROKE_WIDTH, color: Const.CURSOR_STROKE_COLOR });
    },

    _drawPlacementPreview(engine) {
        if (!this._placementPreview) {
            const container = new Container(); const rangeGraphics = new Graphics(); const radiusGraphics = new Graphics();
            const sprite = new Sprite(); sprite.anchor.set(0.5);
            container.addChild(rangeGraphics, radiusGraphics, sprite); PixiApp.layer('overlay').addChild(container);
            this._placementPreview = { container, rangeGraphics, radiusGraphics, sprite };
        }
        const { container, rangeGraphics, radiusGraphics, sprite } = this._placementPreview;
        if (!engine.selectedTowerType || !engine.map) { container.visible = false; return; }
        container.visible = true; rangeGraphics.clear(); radiusGraphics.clear(); sprite.visible = false;

        const type = engine.selectedTowerType; const stats = TowerStats[type] || HeroStats[type];
        if (!stats) { container.visible = false; return; }
        const mouse = engine.mouse || {};
        let previewX = mouse.x || 0; let previewY = mouse.y || 0;
        if (engine.stuckPlacement) { const adj = applyBossEffects(engine.stuckPlacement.x, engine.stuckPlacement.y); previewX = adj.x; previewY = adj.y; }

        const map = engine.map; const placementRadius = Math.max(1, (stats.hitRadius || Const.PLACEMENT_RADIUS) * GLOBAL_SCALE);
        const onPath = map.isOnPath(previewX, previewY) || map.isOnProp(previewX, previewY) || previewY > CANVAS_HEIGHT || previewX > CANVAS_WIDTH;
        const onWater = map.isInWater(previewX, previewY);
        const onFrozenWater = map.isOnFrozenWater(previewX, previewY, engine.towers);
        const validLandPlacement = !onPath && (!onWater || onFrozenWater);

        let cost = engine.getCost(stats.cost);
        if (type === 'dart' && !engine.isSandbox && engine.difficulty && !engine.difficulty.noSelling) {
            const mkActive = Config.data.mkActive !== false;
            const hasFreeMonkey = Config.data.unlocks.freeFirstDartMonkey || (mkActive && Config.data.monkeyKnowledge && Config.data.monkeyKnowledge.bonus_monkey);
            if (hasFreeMonkey && !engine.towers.some(t => t.type === 'dart')) cost = 0;
        }
        const canAfford = engine.cash >= cost;

        if (stats.range < 9999) {
            const effRange = Math.max(1, Utils.getEffectiveRange({ stats }, engine));
            rangeGraphics.circle(previewX, previewY, effRange).fill({ color: canAfford ? Const.TOWER_RANGE_AFFORDABLE_COLOR : Const.TOWER_RANGE_OUT_OF_BOUNDS_COLOR, alpha: Const.TOWER_RANGE_ALPHA });
        }
        if (!canAfford) { radiusGraphics.circle(previewX, previewY, placementRadius).fill({ color: Const.TOWER_RANGE_OUT_OF_BOUNDS_COLOR, alpha: Const.TOWER_RANGE_ALPHA }); return; }

        const isOverlapping = (px, py) => { for (const t of engine.towers) { if (t && Utils.withinRange(px, py, t.x, t.y, t.hitRadius + placementRadius)) return true; } return false; };
        let invalid;
        if (stats.waterOnly) invalid = !onWater || onPath; else if (stats.canPlaceOnWater) invalid = onPath; else invalid = !validLandPlacement;
        if (!invalid) invalid = isOverlapping(previewX, previewY);

        if (invalid) { radiusGraphics.circle(previewX, previewY, placementRadius).fill({ color: Const.TOWER_OVERLAP_COLOR, alpha: Const.TOWER_OVERLAP_ALPHA }); return; }

        const texture = PixiAssets.get(`tower_${type}_base`);
        if (texture !== Texture.EMPTY) {
            sprite.visible = true; if (sprite.texture !== texture) sprite.texture = texture;
            const targetSize = (stats.drawSize || (45 * (stats.scale || 1.0))) * GLOBAL_SCALE;
            if (type === 'gojo' || type === 'geto' || type === 'sauda') {
                // Match canvas drawImageCentered (maxDim-based) like the placed
                // sprite does; _sizeUniform leaves x/y untouched so zero them.
                this._sizeUniform(sprite, texture, targetSize);
                sprite.x = 0; sprite.y = 0;
            } else {
                this._applySpriteConfig(sprite, texture, type, 'base', targetSize);
            }
            sprite.x += previewX; sprite.y += previewY; sprite.alpha = Const.TOWER_PREVIEW_SPRITE_ALPHA;
        }
    },

    // --- ADDED: Hitboxes and Dev Overlay ---
    _drawHitboxes(engine) {
        if (!this._hitboxGraphics) {
            this._hitboxGraphics = new Graphics();
            PixiApp.layer('overlay').addChild(this._hitboxGraphics);
        }
        const g = this._hitboxGraphics;
        g.clear();

        if (!Config.data.showHitboxes) return;

        // Towers
        for (const t of engine.towers) {
            if (!t) continue;
            g.circle(t.x, t.y, t.hitRadius).stroke({ color: 0x0000ff, width: 2 });
            if (t.stats && t.stats.range < 9999) {
                g.circle(t.x, t.y, Utils.getEffectiveRange(t, engine)).stroke({ color: 0x00ffff, width: 2 });
            }
        }

        // Enemies
        for (const e of engine.enemies) {
            if (!e || !e.alive) continue;
            g.circle(e.x, e.y, e.radius).stroke({ color: 0xff0000, width: 2 });
        }

        // Minions
        const drawMinion = (m) => {
            if (!m || !m.alive) return;
            g.circle(m.x, m.y, m.hitRadius).stroke({ color: 0x00ff00, width: 2 });
        };
        if (engine.sentries) engine.sentries.forEach(drawMinion);
        if (engine.beasts) engine.beasts.forEach(drawMinion);

        // Projectiles
        const projectiles = engine.projectilePool.active;
        for (let i = 0; i < projectiles.length; i++) {
            const p = projectiles[i];
            if (p && p.alive) {
                g.circle(p.x, p.y, p.radius || 2).stroke({ color: 0xffff00, width: 2 });
            }
        }

        // Explosions (Pixi Graphics has no setLineDash; dashed style is
        // approximated by a slightly thinner solid ring here).
        for (const exp of engine.explosions) {
            if (!exp || !exp.maxLife || exp.maxLife <= 0) continue;
            const r = Math.max(0, exp.radius || 0);
            if (r > 0) g.circle(exp.x, exp.y, r).stroke({ color: 0xffa500, width: 2 });
        }
    },

    _drawDevOverlay(engine, rawDt) {
        if (!engine.showDevOverlay) {
            if (this._devOverlayText) this._devOverlayText.visible = false;
            if (this._devOverlayBg) this._devOverlayBg.visible = false;
            return;
        }

        if (!this._devOverlayText) {
            this._devOverlayText = new Text({
                text: '',
                style: { fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', fill: 0xbdc3c7 }
            });
            this._devOverlayText.x = 10;
            this._devOverlayText.y = 20;
            PixiApp.layer('screenUI').addChild(this._devOverlayText);
            
            // Background for text
            this._devOverlayBg = new Graphics();
            PixiApp.layer('screenUI').addChildAt(this._devOverlayBg, 0); // Behind text
        }
        this._devOverlayText.visible = true;
        this._devOverlayBg.visible = true;

        const fps = Math.round(1 / (rawDt || 0.016));
        const activeProjectiles = (engine.projectilePool && engine.projectilePool.active) ? engine.projectilePool.active.length : 0;
        const maxProjectiles = (engine.projectilePool) ? engine.projectilePool.size : 0;
        const activeEnemies = engine.enemies ? engine.enemies.length : 0;
        const activeTowers = engine.towers ? engine.towers.length : 0;
        const activeParticles = (engine.particlePool && engine.particlePool.active) ? engine.particlePool.active.length : 0;
        const activeExplosions = engine.explosions ? engine.explosions.length : 0;
        const activeTexts = engine.floatingTexts ? engine.floatingTexts.length : 0;
        const currentWave = engine.waveManager ? engine.waveManager.currentWave : 0;

        const text = 
`FPS: ${fps}
Wave: ${currentWave}
Towers: ${activeTowers}
Enemies: ${activeEnemies}
Projectiles: ${activeProjectiles} / ${maxProjectiles}
Particles: ${activeParticles}
Explosions: ${activeExplosions}
Float Texts: ${activeTexts}
Cash/Lives: $${Math.floor(engine.cash || 0)} / ${engine.lives || 0}`;

        this._devOverlayText.text = text;

        // Update background
        this._devOverlayBg.clear();
        this._devOverlayBg.rect(5, 15, 220, (text.split('\n').length * 18) + 10).fill({ color: 0x000000, alpha: 0.75 });
    }
};