import { Names } from './names.js';

const Assets = {
    images: {},
    maxCracks: {}, 
    
    async preloadCracks() {
        const crackNames = ['ceramic', 'moab', 'bfb', 'zomg', 'ddt', 'bad'];
        for (const name of crackNames) {
            let loadedCount = 0;
            for (let stage = 1; stage <= 10; stage++) {
                const key = `enemy_${name}_${stage}`;
                const path = `sprites/enemies/${name}_${stage}.png`; 
                
                if (this.images[key] && this.images[key].loaded) {
                    loadedCount = stage;
                    continue;
                }
                
                const img = new Image();
                img.src = path;
                const success = await new Promise(resolve => {
                    img.onload = () => { this.images[key] = img; img.loaded = true; resolve(true); };
                    img.onerror = () => { resolve(false); };
                });
                
                if (success) {
                    loadedCount = stage;
                } else {
                    break; 
                }
            }
            this.maxCracks[name] = loadedCount;
            if (loadedCount > 0) console.log(`Preloaded ${loadedCount} damage stages for ${name}`);
        }
    },

    getMaxCracks(name) {
        return this.maxCracks[name] || 0;
    },
    
    get(key) {
        if (!this.images[key]) {
            let path = '';
            let parts = key.split('_');
            let prefix = parts[0] + '_'; 
            let name = parts.slice(1).join('_'); 
            
            if (prefix === Names.PREFIXES.ENEMY) path = `sprites/enemies/${name}.png`;
            else if (prefix === Names.PREFIXES.PROJECTILE) path = `sprites/projectiles/${name}.png`;
            else if (prefix === Names.PREFIXES.TOWER) path = `sprites/towers/${name}.png`;
            else if (prefix === Names.PREFIXES.EFFECT) path = `sprites/effects/${name}.png`;
            else if (prefix === Names.PREFIXES.MAP) path = `sprites/maps/${name}.png`;
            
            if (path) {
                const img = new Image();
                img.loaded = false;
                img.isError = false; // NEW: Track if the file is actually missing
                img.onload = () => { img.loaded = true; };
                img.onerror = () => { img.loaded = false; img.isError = true; }; 
                try { img.src = path; } catch (e) { console.error(`Failed to load asset: ${path}`, e); }
                this.images[key] = img;
                return img;
            }
        }
        return this.images[key];
    }
};

export default Assets;