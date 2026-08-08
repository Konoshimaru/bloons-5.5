// js/webgl/pixiAssets.js
//
// Texture cache for the WebGL renderer. Deliberately mirrors the key scheme
// in js/assets.js (prefix_name -> sprites/<folder>/<name>.png) so the rest of
// the codebase can keep asking for "tower_dart_1", "enemy_moab", etc. without
// caring whether the backing resource is an HTMLImageElement (Canvas2D path)
// or a PIXI.Texture (WebGL path).
//
// Once migration is complete, js/assets.js's Image-based loading goes away
// and everything routes through here.

import { Assets, Texture } from 'pixi.js';
import { Names } from '../names.js';
import { Config } from '../config.js';

const FOLDER_MAP = Object.freeze({
    [Names.PREFIXES.ENEMY]: 'enemies',
    [Names.PREFIXES.PROJECTILE]: 'projectiles',
    [Names.PREFIXES.TOWER]: 'towers',
    [Names.PREFIXES.EFFECT]: 'effects',
    [Names.PREFIXES.MAP]: 'maps'
});

class PixiAssetsManager {
    #textures = new Map();       // key -> PIXI.Texture
    #pending = new Map();        // key -> in-flight load promise
    #missing = new Set();        // keys we've already logged a 404 for, so we don't spam console
    #pixelArt = new Set();       // keys force-sampled with nearest (pixel art) regardless of the smoothing option

    _resolvePath(key) {
        const parts = key.split('_');
        const prefix = parts[0] + '_';
        const folder = FOLDER_MAP[prefix];
        if (!folder) return null;
        const name = parts.slice(1).join('_');
        return `sprites/${folder}/${name}.png`;
    }

    // Texture filtering mirrors the Canvas2D imageSmoothingEnabled option:
    // Config.data.smoothingEnabled -> linear (smooth), off -> nearest
    // (crisp). Keys in #pixelArt are always nearest, matching places where
    // the canvas path intentionally upscales pixel art (the cutscene knight).
    _applyScaleMode(key, texture) {
        if (!texture || !texture.source) return;
        const mode = (this.#pixelArt.has(key) || !Config.data.smoothingEnabled) ? 'nearest' : 'linear';
        if (texture.source.scaleMode !== mode) {
            texture.source.scaleMode = mode;
            // TextureStyle caches a _sharedResourceId keyed on the old
            // filter values, and scaleMode's setter only mutates the filters
            // without invalidating that cache — so just assigning it is a
            // silent no-op on already-uploaded textures. style.update()
            // clears the cached id and emits 'change' (-> 'styleChange'),
            // which makes GLTextureSystem re-key the sampler. Without this,
            // toggling the menu smoothing option does nothing.
            texture.source.style.update();
        }
    }

    // Live hook for the settings-menu smoothing checkbox: re-samples every
    // already-loaded texture without needing a reload.
    setSmoothing(enabled) {
        Config.data.smoothingEnabled = enabled;
        for (const [key, texture] of this.#textures) this._applyScaleMode(key, texture);
    }

    // Forces nearest sampling for specific pixel-art sprites (knight, slash,
    // thrown sword) regardless of the smoothing option. Idempotent; safe to
    // call every frame while the texture is still loading (no-op on EMPTY).
    setPixelArt(...keys) {
        for (const key of keys) {
            this.#pixelArt.add(key);
            const texture = this.#textures.get(key);
            if (texture) this._applyScaleMode(key, texture);
        }
    }

    // Synchronous accessor for the render loop: returns Texture.EMPTY until
    // loaded (so a draw call never throws), and kicks off loading in the
    // background if this is the first time we've seen this key.
    get(key) {
        if (this.#textures.has(key)) return this.#textures.get(key);
        if (!this.#pending.has(key)) this._load(key);
        return Texture.EMPTY;
    }

    async _load(key) {
        const path = this._resolvePath(key);
        if (!path) return;

        const promise = Assets.load(path)
            .then(texture => {
                this.#textures.set(key, texture);
                // Mipmaps: the sprite sheets are big (towers 510x480,
                // upgrade overlays 820x1250, maps larger) and most get
                // downscaled 8-9x on screen. With no mip chain, GL linear
                // filtering only samples a 2x2 texel neighborhood at the
                // mapped point, so the reduced image shimmers/aliases —
                // exactly where the Canvas2D path (imageSmoothingEnabled +
                // imageSmoothingQuality='high') looks smooth. Generating
                // mips at upload lets scaleMode (via minFilter/mipmapFilter,
                // both driven by _applyScaleMode) produce a smooth downscale.
                texture.source.autoGenerateMipmaps = true;
                this._applyScaleMode(key, texture);
                return texture;
            })
            .catch(() => {
                if (!this.#missing.has(key)) {
                    this.#missing.add(key);
                    console.warn(`[pixiAssets] missing sprite for key "${key}" (${path})`);
                }
                return null;
            })
            .finally(() => {
                // Clear the in-flight marker once settled so a transient
                // network failure on one load can be retried by a later
                // get() (loaded keys are served from #textures regardless).
                if (this.#pending.get(key) === promise) this.#pending.delete(key);
            });

        this.#pending.set(key, promise);
        return promise;
    }

    // Await-able version for preload screens (mirrors assets.js preloadManifest).
    async preloadManifest(keys, onProgress) {
        const total = keys.length;
        let loaded = 0;
        await Promise.all(keys.map(async key => {
            if (!this.#textures.has(key)) await this._load(key);
            loaded++;
            if (onProgress) onProgress(loaded / total);
        }));
    }

    has(key) {
        return this.#textures.has(key);
    }
}

export const PixiAssets = new PixiAssetsManager();
