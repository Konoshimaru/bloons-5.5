// js/mapEditorIO.js
import { Config } from './config.js';
import { Maps } from './data.js';
import { UI } from './ui.js';

export default {
    loadBackgroundPreview() {
        const nameInput = document.getElementById('bg-image-name');
        if (!nameInput) return;
        const name = nameInput.value.trim();
        if (!name) {
            this.clearBackground();
            return;
        }
        this.mapData.image = name;
        this.bgImage.onload = () => { this.bgImage.loaded = true; };
        this.bgImage.onerror = () => { 
            this.bgImage.loaded = false; 
            alert('Could not load day image. Make sure it is in the sprites/maps/ folder!'); 
        };
        this.bgImage.src = `sprites/maps/${name}.png`;
    },

    clearBackground() {
        this.mapData.image = null;
        this.bgImage.loaded = false;
        const nameInput = document.getElementById('bg-image-name');
        if (nameInput) nameInput.value = "";
        UI.log("Day background cleared.");
    },
    
    loadNightBackgroundPreview() {
        const nameInput = document.getElementById('bg-night-image-name');
        if (!nameInput) return;
        const name = nameInput.value.trim();
        if (!name) {
            this.clearNightBackground();
            return;
        }
        this.mapData.imageNight = name;
        this.bgNightImage.onload = () => { this.bgNightImage.loaded = true; };
        this.bgNightImage.onerror = () => { 
            this.bgNightImage.loaded = false; 
            alert('Could not load night image. Make sure it is in the sprites/maps/ folder!'); 
        };
        this.bgNightImage.src = `sprites/maps/${name}.png`;
    },

    clearNightBackground() {
        this.mapData.imageNight = null;
        this.bgNightImage.loaded = false;
        const nameInput = document.getElementById('bg-night-image-name');
        if (nameInput) nameInput.value = "";
        UI.log("Night background cleared.");
    },
    
    saveMap() {
        const nameInput = document.getElementById('editor-map-name');
        this.mapData.name = (nameInput && nameInput.value) ? nameInput.value : "Custom Map";
        
        if (!this.mapData.id) {
            this.mapData.id = crypto.randomUUID();
        }
        
        this.mapData.paths = this.mapData.paths.filter(p => p && p.waypoints && p.waypoints.length > 0);
        
        if (this.mapData.paths.length === 0) { alert("Please draw at least one path with 2 or more points."); return; }
        
        for (let p of this.mapData.paths) {
            if (p.waypoints.length < 2) { alert("Each path must have at least 2 waypoints."); return; }
        }
        
        const existingIdx = Config.data.customMaps.findIndex(m => m.id === this.mapData.id);
        const mapCopy = JSON.parse(JSON.stringify(this.mapData));
        if (existingIdx > -1) {
            Config.data.customMaps[existingIdx] = mapCopy;
            if (Maps[existingIdx + 6]) Maps[existingIdx + 6] = mapCopy;
        } else {
            Config.data.customMaps.push(mapCopy);
            Maps.push(mapCopy);
        }
        Config.save();
        alert("Map saved successfully!");
    },
    
    loadMap() {
        const names = Config.data.customMaps.map(m => m.name);
        if (names.length === 0) { alert("No custom maps saved."); return; }
        const name = prompt("Enter map name to load:\n" + names.join(", "));
        if (name) {
            const map = Config.data.customMaps.find(m => m.name === name);
            if (map) {
                this.pushUndo();
                this.mapData = JSON.parse(JSON.stringify(map));
                this.applyLoadedMapData();
            } else { alert("Map not found."); }
        }
    },
    
    applyLoadedMapData() {
        if (!Array.isArray(this.mapData.waterBrushes)) this.mapData.waterBrushes = [];
        if (this.mapData.waterVisible === undefined) this.mapData.waterVisible = true; 
        if (this.mapData.propsVisible === undefined) this.mapData.propsVisible = true; 
        if (!this.mapData.imageScale) this.mapData.imageScale = 1.0;
        if (!this.mapData.imageOffsetX) this.mapData.imageOffsetX = 0;
        if (!this.mapData.imageOffsetY) this.mapData.imageOffsetY = 0;
        if (!this.mapData.imageMaintainRatio) this.mapData.imageMaintainRatio = false;
        if (!this.mapData.imageNight) this.mapData.imageNight = null;
        if (!Array.isArray(this.mapData.props)) this.mapData.props = [];
        if (!Array.isArray(this.mapData.paths)) this.mapData.paths = [];
        
        this.selectedPath = -1;
        this.selectedPoint = null;
        this.selectedProp = null;
        
        const nameInput = document.getElementById('editor-map-name');
        if (nameInput) nameInput.value = this.mapData.name || "Custom Map";
        
        const bgName = document.getElementById('bg-image-name');
        if (bgName) bgName.value = this.mapData.image || "";
        
        const nightName = document.getElementById('bg-night-image-name');
        if (nightName) nightName.value = this.mapData.imageNight || "";
        
        const bgMaintainRatio = document.getElementById('bg-maintain-ratio');
        if (bgMaintainRatio) bgMaintainRatio.checked = this.mapData.imageMaintainRatio;
        
        const bgImageScale = document.getElementById('bg-image-scale');
        if (bgImageScale) bgImageScale.value = this.mapData.imageScale;
        
        const bgImageX = document.getElementById('bg-image-x');
        if (bgImageX) bgImageX.value = this.mapData.imageOffsetX;
        
        const bgImageY = document.getElementById('bg-image-y');
        if (bgImageY) bgImageY.value = this.mapData.imageOffsetY;
        
        const bgScaleVal = document.getElementById('bg-scale-val');
        if (bgScaleVal) bgScaleVal.innerText = this.mapData.imageScale.toFixed(2);
        
        const bgXVal = document.getElementById('bg-x-val');
        if (bgXVal) bgXVal.innerText = this.mapData.imageOffsetX;
        
        const bgYVal = document.getElementById('bg-y-val');
        if (bgYVal) bgYVal.innerText = this.mapData.imageOffsetY;
        
        if (this.mapData.image) {
            this.loadBackgroundPreview();
        } else {
            this.bgImage.loaded = false;
        }
        
        if (this.mapData.imageNight) {
            this.loadNightBackgroundPreview();
        } else {
            this.bgNightImage.loaded = false;
        }
        
        this.updatePathDropdown();
    },

    importJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (!data || !Array.isArray(data.paths)) {
                    alert("Invalid map JSON: Missing 'paths' array.");
                    return;
                }

                this.pushUndo();
                this.mapData = data;
                this.applyLoadedMapData();
                UI.log("Map imported successfully!");
            } catch (err) {
                alert("Failed to import JSON: " + err.message);
            }
        };
        reader.readAsText(file);
        event.target.value = ""; 
    },
    
    toggleJSON() {
        const viewer = document.getElementById('editor-json-viewer');
        const textArea = document.getElementById('editor-json-text');
        if (!viewer || !textArea) return;
        if (viewer.classList.contains('hidden')) {
            textArea.value = JSON.stringify(this.mapData, null, 2);
            viewer.classList.remove('hidden');
        } else {
            viewer.classList.add('hidden');
        }
    },
    
    applyJSON() {
        try {
            const textArea = document.getElementById('editor-json-text');
            if (!textArea) return;
            this.mapData = JSON.parse(textArea.value);
            this.applyLoadedMapData();
            alert("JSON applied!");
        } catch (e) { alert("Invalid JSON: " + e.message); }
    }
};