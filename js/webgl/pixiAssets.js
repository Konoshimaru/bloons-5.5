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
import { SPRITESHEETS } from '../spriteSheets.js';

const FOLDER_MAP = Object.freeze({
    [Names.PREFIXES.ENEMY]: 'enemies',
    [Names.PREFIXES.PROJECTILE]: 'projectiles',
    [Names.PREFIXES.TOWER]: 'towers',
    [Names.PREFIXES.EFFECT]: 'effects',
    [Names.PREFIXES.MAP]: 'maps',
    'boss_': 'boss'
});

// Static boss sprites that live outside the loose folder layout (see
// js/assets.js BOSS_STATIC_PATHS). Kept in sync so both asset paths resolve
// enemy_knight_front to the same file.
const BOSS_STATIC_PATHS = Object.freeze({
    enemy_knight_front: 'sprites/sheets/enemies/knight_front.png',
});

// Spritesheet override: when a requested key starts with one of these prefixes,
// the texture comes from a packed atlas (TexturePacker Pixi JSON) instead of a
// loose PNG. `frame` is the JSON's frame name for the ORIGINAL key (which keeps
// the game's `tower_bomb_p3_t1_attack_full_0` key scheme intact — only the
// backing resource changes). Sheets are loaded once and cached; every frame
// resolves through the same atlas so no per-frame HTTP request happens.
// Shared with js/assets.js so both render paths agree on which frames exist.
class PixiAssetsManager {
    #textures = new Map();       // key -> PIXI.Texture
    #pending = new Map();        // key -> in-flight load promise
    #missing = new Set();        // keys we've already logged a 404 for, so we don't spam console
    #pixelArt = new Set();       // keys force-sampled with nearest (pixel art) regardless of the smoothing option
    #sheetPromises = new Map();  // sheet json url -> in-flight Assets.load promise

    // Returns { sheet, frame } when `key` is served by a packed atlas, else null.
    _resolveSheet(key) {
        for (const entry of SPRITESHEETS) {
            if (key.startsWith(entry.prefix)) {
                return { sheet: entry.sheet, frame: entry.frame(key) };
            }
        }
        return null;
    }

    _resolvePath(key) {
        if (BOSS_STATIC_PATHS[key]) return BOSS_STATIC_PATHS[key];

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

    // Live hook toggling the mipmap chain for every already-loaded texture
    // (used by benchmark.html to A/B the "tall texture shimmer" hypothesis and
    // potentially by the settings menu later). Mirrors setSmoothing: iterates
    // the cache, flips autoGenerateMipmaps, then forces a re-upload so the
    // change actually takes effect on the GPU (the mip chain is generated at
    // upload time, so toggling the flag alone does nothing on existing
    // textures). Idempotent; safe to call repeatedly.
    setMipmaps(enabled) {
        for (const [, texture] of this.#textures) {
            if (!texture || !texture.source) continue;
            if (texture.source.autoGenerateMipmaps !== enabled) {
                texture.source.autoGenerateMipmaps = enabled;
                texture.source.update();
            }
        }
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

    // True only when the key has a REAL loaded texture (not the dart-monkey
    // fallback injected for missing `tower_*` keys). Renderers use this to
    // decide whether a sprite/upgrade/arm actually exists, so a missing asset
    // never gets mistaken for the dart placeholder.
    //
    // Like get(), this kicks off a background load for keys it hasn't seen
    // yet — renderers gate upgrade bases, `_a` overlays and attack frames on
    // has(), and those sprites are NOT in the preload manifest, so without
    // the load trigger they'd never load and the visuals would stay absent
    // forever. It only reports true once a real texture is actually loaded,
    // and never for a key already known to be missing.
    has(key) {
        if (this.#textures.has(key)) return !this.#missing.has(key);
        if (this.#missing.has(key)) return false;
        if (!this.#pending.has(key)) this._load(key);
        return false;
    }

    async _load(key, quiet = false) {
        const sheetRes = this._resolveSheet(key);

        let promise;
        if (sheetRes) {
            // Try the packed atlas first. If the frame isn't in that atlas
            // (some sheets are missing a frame the game still requests, e.g.
            // effect_stun_0 or boomerang frame 0), fall back to the loose
            // sprites/<folder>/<name>.png instead of marking it missing.
            promise = this._loadSheetFrame(key, sheetRes.sheet, sheetRes.frame)
                .then(texture => {
                    this.#textures.set(key, texture);
                    texture.source.autoGenerateMipmaps = true;
                    this._applyScaleMode(key, texture);
                    return texture;
                })
                .catch(async () => {
                    const fallback = this._resolvePath(key);
                    if (fallback) {
                        try {
                            const texture = await Assets.load(fallback);
                            this.#textures.set(key, texture);
                            texture.source.autoGenerateMipmaps = true;
                            this._applyScaleMode(key, texture);
                            return texture;
                        } catch (err2) {
                            /* fall through to missing */
                        }
                    }
                    if (!this.#missing.has(key)) {
                        this.#missing.add(key);
                        if (!quiet) console.warn(`[pixiAssets] missing sprite for key "${key}" (sheet ${sheetRes.sheet}, frame ${sheetRes.frame})`);
                    }
                    return null;
                })
                .finally(() => {
                    if (this.#pending.get(key) === promise) this.#pending.delete(key);
                });
        } else {
            const path = this._resolvePath(key);
            if (!path) return;

            promise = Assets.load(path)
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
                        if (!quiet) console.warn(`[pixiAssets] missing sprite for key "${key}" (${path})`);
                    }
                    // Do NOT substitute a placeholder: missing keys stay absent so
                    // renderers (which check has() before drawing) treat them as
                    // non-existent, rather than silently drawing the wrong sprite.
                    return null;
                })
                .finally(() => {
                    // Clear the in-flight marker once settled so a transient
                    // network failure on one load can be retried by a later
                    // get() (loaded keys are served from #textures regardless).
                    if (this.#pending.get(key) === promise) this.#pending.delete(key);
                });
        }

        this.#pending.set(key, promise);
        return promise;
    }

    // Loads a packed atlas once, then returns the Texture for one frame inside
    // it. Assets.load on a TexturePacker JSON returns the parsed Spritesheet
    // (cached by URL), whose `.textures` dict is keyed by frame name — no
    // alias/re-parse needed, and it's shared across every frame request so the
    // image is fetched and decoded exactly once.
    async _loadSheetFrame(key, sheet, frame) {
        if (!this.#sheetPromises.has(sheet)) {
            this.#sheetPromises.set(sheet, Assets.load(sheet).catch(err => {
                this.#sheetPromises.delete(sheet);
                throw err;
            }));
        }
        const spritesheet = await this.#sheetPromises.get(sheet);
        const texture = spritesheet?.textures?.[frame];
        if (!texture) {
            throw new Error(`frame not found in ${sheet}: ${frame}`);
        }
        return texture;
    }

    // Await-able version for preload screens (mirrors assets.js preloadManifest).
    // `quiet` suppresses the per-missing-key warnings: the generous preload
    // lists legitimately include optional sprites (camo/regen variants, arms)
    // that only some enemies/towers have, and those 404s are expected there.
    async preloadManifest(keys, onProgress, quiet = false) {
        const total = keys.length;
        let loaded = 0;
        // Fast path: the Play-click re-preload runs over the same generous key
        // lists the background preload already finished. If every key is cached
        // there's nothing to do — don't burn ~50 batched sleeps re-awaiting.
        if (keys.every(key => this.#textures.has(key))) {
            if (onProgress) onProgress(1);
            return;
        }
        // Batched (limited concurrency) so hundreds of texture uploads don't
        // saturate the main thread and starve the loading minigame's rAF.
        // 16-per-chunk / 10ms-yield matches js/assets.js's runBatched.
        for (let i = 0; i < keys.length; i += 16) {
            const chunk = keys.slice(i, i + 16);
            await Promise.all(chunk.map(async key => {
                if (!this.#textures.has(key)) await this._load(key, quiet);
                loaded++;
                if (onProgress) onProgress(loaded / total);
            }));
            if (i + 16 < keys.length) await new Promise(r => setTimeout(r, 10));
        }
    }
}

export const PixiAssets = new PixiAssetsManager();
