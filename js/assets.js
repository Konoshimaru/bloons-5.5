import { Names } from './names.js';

const FOLDER_MAP = Object.freeze({
    [Names.PREFIXES.ENEMY]: 'enemies',
    [Names.PREFIXES.PROJECTILE]: 'projectiles',
    [Names.PREFIXES.TOWER]: 'towers',
    [Names.PREFIXES.EFFECT]: 'effects',
    [Names.PREFIXES.MAP]: 'maps'
});

const CRACK_NAMES = Object.freeze(['ceramic', 'moab', 'bfb', 'zomg', 'ddt', 'bad']);
const MAX_CRACK_STAGES = 10;

class AssetsManager {
    #images = new Map();
    #maxCracks = new Map();
    #folderMap = FOLDER_MAP;

    _resolvePath(key) {
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
            console.warn(`Asset failed to load: ${path} (Key: ${key})`);
        };
        
        img.src = path;
        this.#images.set(key, img);
        return img;
    }

    get(key) {
        if (this.#images.has(key)) {
            return this.#images.get(key);
        }
        
        const path = this._resolvePath(key);
        if (!path) {
            console.warn(`Unknown asset prefix for key: ${key}`);
            return null;
        }
        
        return this._createImage(key, path);
    }

    async preloadCracks() {
        for (const name of CRACK_NAMES) {
            let loadedCount = 0;
            
            for (let stage = 1; stage <= MAX_CRACK_STAGES; stage++) {
                const key = `${Names.PREFIXES.ENEMY}${name}_${stage}`;
                const img = this.get(key);
                
                if (img.loaded) {
                    loadedCount = stage;
                    continue;
                }

                await new Promise(resolve => {
                    const originalOnError = img.onerror;
                    img.onload = () => { resolve(true); };
                    img.onerror = (e) => {
                        if (originalOnError) originalOnError(e);
                        resolve(false);
                    };
                });

                if (img.loaded) {
                    loadedCount = stage;
                } else {
                    break; 
                }
            }
            
            this.#maxCracks.set(name, loadedCount);
            if (loadedCount > 0) {
                console.log(`Preloaded ${loadedCount} damage stages for ${name}`);
            }
        }
    }

    getMaxCracks(name) {
        return this.#maxCracks.get(name) || 0;
    }
}

const Assets = new AssetsManager();
Object.freeze(Assets);

export default Assets;