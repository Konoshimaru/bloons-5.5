// js/assets.js
// Loads and tracks game art, sprites, and asset references used by the game.

import { Names } from './names.js';
import { sheetHasFrame } from './spriteSheets.js';

const FOLDER_MAP = Object.freeze({
    [Names.PREFIXES.ENEMY]: 'enemies',
    [Names.PREFIXES.PROJECTILE]: 'projectiles',
    [Names.PREFIXES.TOWER]: 'towers',
    [Names.PREFIXES.EFFECT]: 'effects',
    [Names.PREFIXES.MAP]: 'maps',
    'boss_': 'boss'
});

// Boss art lives outside the standard folders: the static knight front view is
// under sheets/enemies and the cutscene animation frames under boss/. The old
// loose sprites/enemies/knight_*.png files were replaced by those frames.
const BOSS_STATIC_PATHS = Object.freeze({
    enemy_knight_front: 'sprites/sheets/enemies/knight_front.png',
});

const CRACK_NAMES = Object.freeze(['ceramic', 'moab', 'bfb', 'zomg', 'ddt', 'bad']);
const MAX_CRACK_STAGES = 10;
const DAMAGE_STAGE_SUFFIXES = Object.freeze(['_1', '_2', '_3', '_4', '_5', '_6', '_7', '_8', '_9', '_10']);

function awaitImageLoad(img) {
    return new Promise(resolve => {
        if (!img) return resolve();
        
        if (img.loaded || (img.complete && img.naturalWidth > 0)) {
            img.loaded = true;
            return resolve();
        }
        if (img.complete && img.naturalWidth === 0) {
            img.loaded = false;
            return resolve(); 
        }
        
        let resolved = false;
        const onL = () => { 
            if (resolved) return; resolved = true; 
            img.removeEventListener('load', onL); img.removeEventListener('error', onE); 
            img.loaded = true; resolve(); 
        };
        const onE = () => { 
            if (resolved) return; resolved = true; 
            img.removeEventListener('load', onL); img.removeEventListener('error', onE); 
            img.loaded = false; resolve(); 
        };
        img.addEventListener('load', onL);
        img.addEventListener('error', onE);
    });
}

// Limited-concurrency runner: preload can request hundreds of sprites at once;
// firing them all simultaneously saturates the main thread with Image()/decode
// work and starves the loading minigame's rAF. This processes `items` in small
// batches (with a yield between batches long enough for a couple of rAF frames)
// so the loading minigame keeps animating smoothly while loads run in parallel
// within each batch. 16-per-chunk with a 10ms yield is the sweet spot between
// keeping the minigame alive and not wasting seconds on sleeps.
const PRELOAD_BATCH = 16;
const PRELOAD_YIELD_MS = 10;
async function runBatched(items, batch, task) {
    for (let i = 0; i < items.length; i += batch) {
        const chunk = items.slice(i, i + batch);
        await Promise.all(chunk.map(item => task(item)));
        if (i + batch < items.length) await new Promise(r => setTimeout(r, PRELOAD_YIELD_MS));
    }
}

class AssetsManager {
    #images = new Map();
    #maxCracks = new Map();
    #folderMap = FOLDER_MAP;

    _resolvePath(key) {
        if (BOSS_STATIC_PATHS[key]) return BOSS_STATIC_PATHS[key];

        const parts = key.split('_');
        const prefix = parts[0] + '_';
        const folder = this.#folderMap[prefix];
        
        if (!folder) return null;
        
        const name = parts.slice(1).join('_');
        return `sprites/${folder}/${name}.png`;
    }

    _createImage(key, path) {
        const img = new Image();
        img.loaded = false;
        
        img.onload = () => {
            img.loaded = true;
        };
        
        img.onerror = () => {
            img.loaded = false;
        };
        
        img.src = path;
        this.#images.set(key, img);
        return img;
    }

    get(key) {
        if (this.#images.has(key)) {
            return this.#images.get(key);
        }
        
        if (sheetHasFrame(key)) {
            const img = new Image();
            img.loaded = true;
            this.#images.set(key, img);
            return img;
        }
        
        const path = this._resolvePath(key);
        if (!path) {
            return null;
        }
        
        return this._createImage(key, path);
    }

    async preloadCracks() {
        for (const name of CRACK_NAMES) {
            let loadedCount = 0;
            
            for (let stage = 1; stage <= MAX_CRACK_STAGES; stage++) {
                const suffix = DAMAGE_STAGE_SUFFIXES[stage - 1] || `_${stage}`;
                const key = `${Names.PREFIXES.ENEMY}${name}${suffix}`;
                const img = this.get(key);
                
                await awaitImageLoad(img);

                if (img.loaded) {
                    loadedCount = stage;
                } else {
                    break; 
                }
            }
            
            this.#maxCracks.set(name, loadedCount);
        }
    }

    getMaxCracks(name) {
        return this.#maxCracks.get(name) || 0;
    }

    async preloadManifest(keys, onProgress) {
        const total = keys.length;
        let loaded = 0;
        // Fast path: Play-click re-awaits the same lists the background preload
        // already finished — skip the batched sleeps if everything's cached.
        if (keys.every(key => {
            const img = this.get(key);
            return img && img.loaded;
        })) {
            if (onProgress) onProgress(1);
            return;
        }
        await runBatched(keys, PRELOAD_BATCH, async key => {
            const img = this.get(key);
            await awaitImageLoad(img);
            loaded++;
            if (onProgress) onProgress(loaded / total);
        });
    }

    // This is perfect for UI assets that live in different folders (like portraits/)
    async preloadUrls(urls, onProgress) {
        const total = urls.length;
        let loaded = 0;
        // Fast path: already-preloaded URLs resolve instantly on re-await.
        if (urls.every(url => {
            const img = this.#images.get(url);
            return img && img.loaded;
        })) {
            if (onProgress) onProgress(1);
            return;
        }
        await runBatched(urls, PRELOAD_BATCH, url => {
            // Use the URL as the key so it gets cached in the #images map
            if (this.#images.has(url)) {
                const img = this.#images.get(url);
                if (img.loaded) {
                    loaded++;
                    if (onProgress) onProgress(loaded / total);
                    return Promise.resolve();
                }
            }
            
            const img = new Image();
            img.loaded = false;
            this.#images.set(url, img);
            
            return new Promise(resolve => {
                img.onload = () => { img.loaded = true; loaded++; if (onProgress) onProgress(loaded / total); resolve(); };
                img.onerror = () => { img.loaded = false; loaded++; if (onProgress) onProgress(loaded / total); resolve(); };
                img.src = url;
            });
        });
    }
}

const Assets = new AssetsManager();
Object.freeze(Assets);

export default Assets;
