// js/cutscenePlayback.js
//
// Plays authored cutscene docs (see js/cutsceneRuntime.js for the format)
// inside the real game, on PixiApp.cutsceneLayer — the same layer the boss
// cutscene's silhouette/rip effects live on, so authored actors render above
// the world but below the screen UI.
//
// The editor (cutsceneeditor.html) writes docs to localStorage under
// 'kilo_cutscene_v1'; CutsceneManager loads them at trigger() time when
// doc.useForBossIntro is set and runs them instead of the hardcoded
// knight reveal states.
//
// Handover convention: an actor named "knight" (case-insensitive) maps to
// the real KnightEnemy. While the scene plays, that actor DRIVES the real
// enemy (position + sprite) instead of drawing a duplicate — so the boss is
// rendered by the normal enemy renderer with all its effects, and when the
// scene ends he snaps to the actor's final transform. No "knight" actor →
// vanilla end state (x=200, y=300, front).
//
// Camera: a reserved actor with isCamera:true (see cutsceneRuntime.js) pans
// the world — its sampled x/y lands in CustomCutscene.cam, and CutsceneManager
// copies cam.x into cameraOffsetX each frame (the renderer shifts the whole
// panned world AND this layer by that offset, so world-space actor coords
// stay consistent with the vanilla cutscene).

import { Container, Sprite, Texture, Rectangle } from 'pixi.js';
import { PixiApp } from './webgl/pixiApp.js';
import { findEntry } from './spriteIndex.js';
import { sampleScene, sampleActor, sampleCamera, sceneDuration, isKnightActor } from './cutsceneRuntime.js';

// Crop textures per sheet png (base source is shared, frames are cheap views).
const cropCache = new Map();
function frameTexture(entry) {
    if (entry.sx == null) return Texture.from(entry.url);
    let byRect = cropCache.get(entry.url);
    if (!byRect) { byRect = new Map(); cropCache.set(entry.url, byRect); }
    const rk = `${entry.sx},${entry.sy},${entry.sw},${entry.sh}`;
    if (byRect.has(rk)) return byRect.get(rk);
    const base = Texture.from(entry.url);
    const tex = new Texture({ source: base.source, frame: new Rectangle(entry.sx, entry.sy, entry.sw, entry.sh) });
    byRect.set(rk, tex);
    return tex;
}

function textureForRef(ref) {
    if (!ref) return Texture.EMPTY;
    const entry = findEntry(ref);
    if (entry) return frameTexture(entry);
    if (ref.includes('/')) return Texture.from(ref); // raw path fallback
    return Texture.EMPTY;
}

export const CustomCutscene = {
    doc: null,
    t: 0,
    active: false,
    cam: { x: 0, y: 0 },      // sampled camera offset — game reads cam.x each frame
    _knightTarget: null,      // real KnightEnemy driven by the "knight" actor
    _container: null,
    _sprites: new Map(), // actor id -> Sprite

    /** Route the actor named "knight" to a real enemy object (KnightEnemy):
     *  its sampled state is applied to the object instead of drawing a
     *  duplicate sprite on the cutscene layer. Pass null to unbind. */
    setKnightTarget(obj) { this._knightTarget = obj || null; },

    /** Begin playback. Returns the scene duration in seconds. */
    start(doc) {
        // Preserve the knight binding across the internal teardown: the boss
        // flow binds the real KnightEnemy immediately before start(), and
        // stop() would otherwise null it — that bug let a duplicate knight
        // sprite play on the cutscene layer while the real boss stood frozen
        // at his spawn point ("two knights" + no authored translation).
        const keepKnight = this._knightTarget;
        this.stop();
        this._knightTarget = keepKnight;
        this.doc = doc;
        this.t = 0;
        this.active = !!doc;
        this.cam = { x: 0, y: 0 };
        if (!doc) return 0;

        this._container = new Container();
        this._container.label = 'customCutscene';
        this._sprites.clear();
        for (const actor of doc.actors) {
            if (actor.isCamera) continue;   // camera never gets a sprite
            if (actor.visible === false) continue;
            const s = new Sprite(Texture.EMPTY);
            s.anchor.set(0.5);
            s.visible = false;
            this._container.addChild(s);
            this._sprites.set(actor.id, s);
        }
        if (PixiApp?.cutsceneLayer) PixiApp.cutsceneLayer.addChild(this._container);
        return sceneDuration(doc);
    },

    /** Advance playback. Returns true while the scene is still running. */
    update(dt) {
        if (!this.active || !this.doc) return false;
        this.t += dt;
        this.cam = sampleCamera(this.doc, this.t);
        const states = sampleScene(this.doc, this.t);
        const drawn = new Set();

        // The "knight" actor drives the real enemy instead of a duplicate
        // sprite (the enemy renderer draws him on the panned world, so he
        // inherits the camera pan exactly like the vanilla cutscene). Sampled
        // DIRECTLY rather than through sampleScene's filtered states, so
        // alpha-0 or sprite-less frames still own the boss every frame.
        if (this._knightTarget) {
            const knightActor = this.doc.actors.find(isKnightActor);
            if (knightActor) {
                this._applyKnight(sampleActor(knightActor, this.t));
                drawn.add(knightActor.id); // keeps his layer sprite suppressed
            }
        }

        for (const st of states) {
            // Never draw a duplicate of the bound knight.
            if (this._knightTarget && isKnightActor(st.actor)) continue;
            const s = this._sprites.get(st.actor.id);
            if (!s) continue;
            drawn.add(st.actor.id);
            const tex = textureForRef(st.sprite);
            if (s.texture !== tex) s.texture = tex;
            s.position.set(st.x, st.y);
            s.rotation = (st.rotation || 0) * Math.PI / 180;
            const k = Math.max(0.01, st.scale || 1);
            s.scale.set(st.mirror ? -k : k, k);
            s.alpha = Math.max(0, Math.min(1, st.alpha));
            s.visible = s.alpha > 0 && tex !== Texture.EMPTY;
        }
        for (const [id, s] of this._sprites) {
            if (!drawn.has(id)) s.visible = false;
        }
        return this.t < sceneDuration(this.doc);
    },

    /** Apply a sampled "knight" state to the real enemy object.
     *  Scale and mirror now DRIVE the boss (they used to be preview-only):
     *  previewScale multiplies the renderer's own draw size (1 = exactly what
     *  the hardcoded intro shows), spriteMirror overrides his facing — null
     *  means "not authored", so the vanilla always-mirrored default holds. */
    _applyKnight(st) {
        const k = this._knightTarget;
        k.x = st.x;
        k.y = st.y;
        if (st.sprite && k.sprite !== st.sprite) k.sprite = st.sprite;
        if (typeof k.alpha === 'number') k.alpha = Math.max(0, Math.min(1, st.alpha));
        k.previewScale = Math.max(0.01, st.scale || 1);
        k.spriteMirror = st.mirrorFound ? !!st.mirror : null;
    },

    /** Final transform of the "knight" actor (name or id, case-insensitive),
     *  sampled directly so visibility filtering can't hide the handover.
     *  Returns null when the scene has no authored knight — the manager then
     *  falls back to the vanilla end state (x200, y300, front). */
    finalKnightState() {
        if (!this.doc) return null;
        const knight = this.doc.actors.find(isKnightActor);
        if (!knight) return null;
        if (!knight.keys || !knight.keys.length) return null;
        return sampleActor(knight, sceneDuration(this.doc));
    },

    /** Tear down visuals (idempotent). Keeps doc for finalKnightState(). */
    stop() {
        if (this._container) {
            this._container.destroy({ children: true });
            this._container = null;
        }
        this._sprites.clear();
        this._knightTarget = null;
        this.cam = { x: 0, y: 0 };
        this.active = false;
    },
};
