// js/mapEditorIO.js
import { Config } from './config.js';
import { Maps } from './data.js';
import { UI } from './ui.js';
import { MapEditorState } from './mapEditorState.js';

export default {
    loadBackgroundPreview() {
        const nameInput = document.getElementById('bg-image-name');
        if (!nameInput) return;
        const name = nameInput.value.trim();
        if (!name) { this.clearBackground(); return; }
        
        MapEditorState.mapData.image = name;
        MapEditorState.bgImage = new Image();
        MapEditorState.bgImage.onload = () => { MapEditorState.bgImage.loaded = true; };
        MapEditorState.bgImage.onerror = () => { alert('Could not load day image. Make sure it is in the sprites/maps/ folder!'); };
        MapEditorState.bgImage.src = `sprites/maps/${name}.png`;
        MapEditorState.markDirty();
    },
    clearBackground() { 
        MapEditorState.mapData.image = null; 
        MapEditorState.bgImage = null; 
        document.getElementById('bg-image-name').value = ""; 
        MapEditorState.markDirty(); 
    },
    
    loadNightBackgroundPreview() {
        const nameInput = document.getElementById('bg-night-image-name');
        if (!nameInput) return;
        const name = nameInput.value.trim();
        if (!name) { this.clearNightBackground(); return; }
        
        MapEditorState.mapData.imageNight = name;
        MapEditorState.bgNightImage = new Image();
        MapEditorState.bgNightImage.onload = () => { MapEditorState.bgNightImage.loaded = true; };
        MapEditorState.bgNightImage.onerror = () => { alert('Could not load night image.'); };
        MapEditorState.bgNightImage.src = `sprites/maps/${name}.png`;
        MapEditorState.markDirty();
    },
    clearNightBackground() { 
        MapEditorState.mapData.imageNight = null; 
        MapEditorState.bgNightImage = null; 
        document.getElementById('bg-night-image-name').value = ""; 
        MapEditorState.markDirty(); 
    },

    saveMap() {
        const nameInput = document.getElementById('editor-map-name');
        MapEditorState.mapData.name = (nameInput && nameInput.value) ? nameInput.value : "Custom Map";
        if (!MapEditorState.mapData.id) MapEditorState.mapData.id = crypto.randomUUID();
        MapEditorState.mapData.paths = MapEditorState.mapData.paths.filter(p => p && p.waypoints && p.waypoints.length > 0);
        
        for (let p of MapEditorState.mapData.paths) {
            // Paths keep their visibility state!
            if (p.waypoints.length < 2) { alert("Each path must have at least 2 waypoints."); return; }
            for (let wp of p.waypoints) {
                if (typeof wp.x !== 'number' || typeof wp.y !== 'number') { alert("Invalid waypoint coordinates."); return; }
                if (wp.curve && (typeof wp.curve.cx !== 'number' || typeof wp.curve.cy !== 'number')) { alert("Invalid curve coordinates."); return; }
            }
        }
        if (MapEditorState.mapData.paths.length === 0) { alert("Please draw at least one path."); return; }
        
        const existingIdx = Config.data.customMaps.findIndex(m => m.id === MapEditorState.mapData.id);
        const mapCopy = JSON.parse(JSON.stringify(MapEditorState.mapData));
        if (existingIdx > -1) { Config.data.customMaps[existingIdx] = mapCopy; if (Maps[existingIdx + 6]) Maps[existingIdx + 6] = mapCopy; }
        else { Config.data.customMaps.push(mapCopy); Maps.push(mapCopy); }
        Config.save();
        MapEditorState.markClean();
        alert("Map saved successfully!");
    },
    
    loadMap() {
        const names = Config.data.customMaps.map(m => m.name);
        if (names.length === 0) { alert("No custom maps saved."); return; }
        const name = prompt("Enter map name to load:\n" + names.join(", "));
        if (name) {
            const map = Config.data.customMaps.find(m => m.name === name);
            if (map) { this.pushUndo(); MapEditorState.mapData = JSON.parse(JSON.stringify(map)); this.applyLoadedMapData(); }
            else { alert("Map not found."); }
        }
    },
    
    applyLoadedMapData() {
        MapEditorState.selectedPath = -1; MapEditorState.selectedPoints = []; MapEditorState.selectedProps = [];
        document.getElementById('editor-map-name').value = MapEditorState.mapData.name || "Custom Map";
        document.getElementById('bg-image-name').value = MapEditorState.mapData.image || "";
        document.getElementById('bg-night-image-name').value = MapEditorState.mapData.imageNight || "";
        document.getElementById('bg-maintain-ratio').checked = MapEditorState.mapData.imageMaintainRatio || false;
        document.getElementById('bg-image-scale').value = MapEditorState.mapData.imageScale || 1;
        document.getElementById('bg-image-x').value = MapEditorState.mapData.imageOffsetX || 0;
        document.getElementById('bg-image-y').value = MapEditorState.mapData.imageOffsetY || 0;
        document.getElementById('bg-scale-val').innerText = (MapEditorState.mapData.imageScale || 1).toFixed(2);
        document.getElementById('bg-x-val').innerText = MapEditorState.mapData.imageOffsetX || 0;
        document.getElementById('bg-y-val').innerText = MapEditorState.mapData.imageOffsetY || 0;
        
        if (MapEditorState.mapData.image) this.loadBackgroundPreview();
        else MapEditorState.bgImage = null;
        if (MapEditorState.mapData.imageNight) this.loadNightBackgroundPreview();
        else MapEditorState.bgNightImage = null;
        
        this.updatePathDropdown();
        MapEditorState.markClean();
    },

    importJSON(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data || !Array.isArray(data.paths)) { alert("Invalid map JSON."); return; }
                this.pushUndo(); MapEditorState.mapData = data; this.applyLoadedMapData();
            } catch (err) { alert("Failed to import: " + err.message); }
        };
        reader.readAsText(file);
        event.target.value = ""; 
    },
    
    toggleJSON() {
        const viewer = document.getElementById('editor-json-viewer');
        const textArea = document.getElementById('editor-json-text');
        if (!viewer || !textArea) return;
        if (viewer.classList.contains('hidden')) { textArea.value = JSON.stringify(MapEditorState.mapData, null, 2); viewer.classList.remove('hidden'); }
        else { viewer.classList.add('hidden'); }
    },
    
    applyJSON() {
        try {
            const textArea = document.getElementById('editor-json-text');
            MapEditorState.mapData = JSON.parse(textArea.value);
            this.applyLoadedMapData();
            alert("JSON applied!");
        } catch (e) { alert("Invalid JSON: " + e.message); }
    }
};