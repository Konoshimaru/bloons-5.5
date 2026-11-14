// js/mapEditorIO.js
import { Config } from './config.js';
import { Maps } from './data.js';
import { MapEditorState } from './mapEditorState.js';
import { normalizeMapEditorDocument } from './mapEditorValidation.js';

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
        const name = (nameInput && nameInput.value) ? nameInput.value : "Custom Map";
        const validation = normalizeMapEditorDocument({
            ...MapEditorState.mapData,
            name
        });
        if (!validation.valid) {
            alert(`Cannot save map: ${validation.error}`);
            return;
        }
        MapEditorState.mapData = validation.mapData;
        if (!MapEditorState.mapData.id) MapEditorState.mapData.id = crypto.randomUUID();
        MapEditorState.mapData.paths = MapEditorState.mapData.paths.filter(
            path => path.waypoints.length > 0
        );
        
        for (const path of MapEditorState.mapData.paths) {
            if (path.waypoints.length < 2) {
                alert("Each path must have at least 2 waypoints.");
                return;
            }
        }
        if (MapEditorState.mapData.paths.length === 0) {
            alert("Please draw at least one path.");
            return;
        }
        
        const existingIdx = Config.data.customMaps.findIndex(m => m.id === MapEditorState.mapData.id);
        const mapCopy = JSON.parse(JSON.stringify(MapEditorState.mapData));
        if (existingIdx > -1) {
            Config.data.customMaps[existingIdx] = mapCopy;
            if (Maps[existingIdx + 6]) Maps[existingIdx + 6] = mapCopy;
        } else {
            Config.data.customMaps.push(mapCopy);
            Maps.push(mapCopy);
        }
        Config.save();
        MapEditorState.markClean();
        alert("Map saved successfully!");
    },
    
    loadMap() {
        const names = Config.data.customMaps.map(map => map.name);
        if (names.length === 0) {
            alert("No custom maps saved.");
            return;
        }
        const name = prompt("Enter map name to load:\n" + names.join(", "));
        if (!name) return;

        const map = Config.data.customMaps.find(entry => entry.name === name);
        if (!map) {
            alert("Map not found.");
            return;
        }

        const validation = normalizeMapEditorDocument(map);
        if (!validation.valid) {
            alert(`Saved map is invalid: ${validation.error}`);
            return;
        }

        this.pushUndo();
        MapEditorState.mapData = validation.mapData;
        this.applyLoadedMapData();
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
                const parsed = JSON.parse(e.target.result);
                const validation = normalizeMapEditorDocument(parsed);
                if (!validation.valid) {
                    alert(`Invalid map JSON: ${validation.error}`);
                    return;
                }
                this.pushUndo();
                MapEditorState.mapData = validation.mapData;
                this.applyLoadedMapData();
            } catch (error) {
                alert(`Failed to import: ${error.message}`);
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
            textArea.value = JSON.stringify(MapEditorState.mapData, null, 2);
            viewer.classList.remove('hidden');
        } else {
            viewer.classList.add('hidden');
        }
    },
    
    applyJSON() {
        try {
            const textArea = document.getElementById('editor-json-text');
            if (!textArea) throw new Error('JSON editor is not available.');
            const parsed = JSON.parse(textArea.value);
            const validation = normalizeMapEditorDocument(parsed);
            if (!validation.valid) {
                alert(`Invalid JSON: ${validation.error}`);
                return;
            }
            this.pushUndo();
            MapEditorState.mapData = validation.mapData;
            this.applyLoadedMapData();
            alert("JSON applied!");
        } catch (error) {
            alert(`Invalid JSON: ${error.message}`);
        }
    }
};
