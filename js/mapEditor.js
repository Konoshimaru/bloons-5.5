// js/mapEditor.js
import { CANVAS_WIDTH, CANVAS_HEIGHT, GAME_AREA_WIDTH } from './constants.js';
import { UI } from './ui.js';
import { MapEditorState } from './mapEditorState.js';
import Renderer from './mapEditorRenderer.js';
import Input from './mapEditorInput.js';
import IO from './mapEditorIO.js';
import History from './mapEditorHistory.js';

export const MapEditor = {
    canvas: null,
    ctx: null,
    _initialized: false,
    _rafId: null,
    undoStack: [],
    redoStack: [],
    isSpaceDown: false,

    init() {
        if (this._initialized) { this.resetMapData(); this.startLoop(); return; }
        this._initialized = true;
        this.canvas = document.getElementById('editor-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
        this.resetMapData();
        
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
        this._setupDOMListeners();
        this.startLoop();
    },

    _setupDOMListeners() {
        document.querySelectorAll('.tool-btn').forEach(btn => btn.addEventListener('click', () => this.setTool(btn.dataset.tool)));
        document.querySelectorAll('.shape-btn').forEach(btn => btn.addEventListener('click', () => { MapEditorState.currentHitboxShape = btn.dataset.shape; document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }));

        document.getElementById('editor-active-path')?.addEventListener('change', (e) => { MapEditorState.selectedPath = parseInt(e.target.value); MapEditorState.selectedPoints = []; });
        document.getElementById('editor-new-path')?.addEventListener('click', () => { this.pushUndo(); this.newPath(); });
        document.getElementById('editor-hide-path')?.addEventListener('click', () => this.togglePathVisibility());
        document.getElementById('editor-toggle-curve')?.addEventListener('click', () => { this.pushUndo(); this.toggleCurve(); });
        document.getElementById('editor-reverse-path')?.addEventListener('click', () => { this.pushUndo(); this.reversePath(); });
        document.getElementById('editor-snap-grid')?.addEventListener('click', () => { MapEditorState.snapToGrid = !MapEditorState.snapToGrid; const btn = document.getElementById('editor-snap-grid'); btn.innerText = `Snap to Grid: ${MapEditorState.snapToGrid ? 'On' : 'Off'}`; btn.classList.toggle('active', MapEditorState.snapToGrid); });
        document.getElementById('editor-path-width')?.addEventListener('input', (e) => { MapEditorState.pathWidth = parseInt(e.target.value); document.getElementById('path-width-val').innerText = MapEditorState.pathWidth; if (MapEditorState.selectedPath !== -1 && MapEditorState.mapData.paths[MapEditorState.selectedPath]) { MapEditorState.mapData.paths[MapEditorState.selectedPath].width = MapEditorState.pathWidth; MapEditorState.markDirty(); } });
        
        document.getElementById('water-brush-size')?.addEventListener('input', (e) => MapEditorState.waterBrushSize = parseInt(e.target.value));
        document.getElementById('water-erase-toggle')?.addEventListener('click', (e) => { MapEditorState.waterEraseMode = !MapEditorState.waterEraseMode; e.target.classList.toggle('active', MapEditorState.waterEraseMode); });
        
        const waterBtn = document.getElementById('editor-hide-water');
        if (waterBtn) {
            waterBtn.addEventListener('click', () => {
                MapEditorState.mapData.waterVisible = !MapEditorState.mapData.waterVisible;
                waterBtn.innerText = MapEditorState.mapData.waterVisible ? 'Hide Water' : 'Show Water';
                MapEditorState.markDirty();
            });
        }
        
        const propsBtn = document.getElementById('editor-hide-props');
        if (propsBtn) {
            propsBtn.addEventListener('click', () => {
                MapEditorState.mapData.propsVisible = !MapEditorState.mapData.propsVisible;
                propsBtn.innerText = MapEditorState.mapData.propsVisible ? 'Hide Objects' : 'Show Objects';
                MapEditorState.markDirty();
            });
        }

        document.getElementById('editor-ref-input')?.addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => { MapEditorState.refImage = new Image(); MapEditorState.refImage.src = ev.target.result; MapEditorState.refX = CANVAS_WIDTH / 2; MapEditorState.refY = CANVAS_HEIGHT / 2; MapEditorState.refScale = 1; };
            reader.readAsDataURL(file);
        });
        
        document.getElementById('editor-load-bg')?.addEventListener('click', () => this.loadBackgroundPreview());
        document.getElementById('editor-clear-bg')?.addEventListener('click', () => this.clearBackground());
        document.getElementById('editor-load-night-bg')?.addEventListener('click', () => this.loadNightBackgroundPreview());
        document.getElementById('editor-clear-night-bg')?.addEventListener('click', () => this.clearNightBackground());
        document.getElementById('editor-toggle-night-preview')?.addEventListener('click', (e) => { MapEditorState.previewNight = !MapEditorState.previewNight; e.target.classList.toggle('active', MapEditorState.previewNight); });
        
        const bgScale = document.getElementById('bg-image-scale');
        if (bgScale) bgScale.addEventListener('input', (e) => { MapEditorState.mapData.imageScale = parseFloat(e.target.value); document.getElementById('bg-scale-val').innerText = MapEditorState.mapData.imageScale.toFixed(2); MapEditorState.markDirty(); });

        const bgX = document.getElementById('bg-image-x');
        if (bgX) bgX.addEventListener('input', (e) => { MapEditorState.mapData.imageOffsetX = parseInt(e.target.value); document.getElementById('bg-x-val').innerText = MapEditorState.mapData.imageOffsetX; MapEditorState.markDirty(); });

        const bgY = document.getElementById('bg-image-y');
        if (bgY) bgY.addEventListener('input', (e) => { MapEditorState.mapData.imageOffsetY = parseInt(e.target.value); document.getElementById('bg-y-val').innerText = MapEditorState.mapData.imageOffsetY; MapEditorState.markDirty(); });

        const bgRatio = document.getElementById('bg-maintain-ratio');
        if (bgRatio) bgRatio.addEventListener('change', (e) => { MapEditorState.mapData.imageMaintainRatio = e.target.checked; MapEditorState.markDirty(); });

        document.getElementById('editor-save')?.addEventListener('click', () => this.saveMap());
        document.getElementById('editor-load')?.addEventListener('click', () => this.loadMap());
        document.getElementById('editor-exit')?.addEventListener('click', () => this.exitEditor());
        document.getElementById('editor-undo')?.addEventListener('click', () => this.undo());
        document.getElementById('editor-redo')?.addEventListener('click', () => this.redo());
        document.getElementById('editor-delete-sel')?.addEventListener('click', () => this.deleteSelected());
        document.getElementById('editor-toggle-json')?.addEventListener('click', () => this.toggleJSON());
        document.getElementById('editor-apply-json')?.addEventListener('click', () => { this.pushUndo(); this.applyJSON(); });
        document.getElementById('editor-import-json-btn')?.addEventListener('click', () => document.getElementById('editor-import-json')?.click());
        document.getElementById('editor-import-json')?.addEventListener('change', (e) => this.importJSON(e));
    },

    exitEditor() {
        if (MapEditorState.isDirty) { if (!confirm("You have unsaved changes. Are you sure you want to exit?")) return; }
        if (this._rafId) cancelAnimationFrame(this._rafId);
        this._rafId = null;
        UI.toggleMenus('main-menu-ui');
    },
    startLoop() { if (!this._rafId) { this._loop = this.loop.bind(this); this._rafId = requestAnimationFrame(this._loop); } },
    loop() { this.draw(); if (!document.getElementById('map-editor-menu').classList.contains('hidden')) { this._rafId = requestAnimationFrame(this._loop); } else { cancelAnimationFrame(this._rafId); this._rafId = null; } },
    resetMapData() { MapEditorState.reset(); this.undoStack = []; this.redoStack = []; document.getElementById('editor-map-name').value = "New Custom Map"; this.updatePathDropdown(); },
    setTool(tool) {
        MapEditorState.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
        document.getElementById('track-options').classList.toggle('hidden', tool !== 'track');
        document.getElementById('water-options').classList.toggle('hidden', tool !== 'water');
        document.getElementById('objects-options').classList.toggle('hidden', tool !== 'objects');
        document.getElementById('reference-options').classList.toggle('hidden', tool !== 'reference');
        document.getElementById('bg-options').classList.toggle('hidden', tool !== 'bg');
        MapEditorState.selectedPoints = []; MapEditorState.selectedProps = [];
    },
    updatePathDropdown() {
        const select = document.getElementById('editor-active-path');
        if (!select) return;
        select.innerHTML = '';
        if (!MapEditorState.mapData.paths || MapEditorState.mapData.paths.length === 0) { select.innerHTML = '<option value="-1">No Paths</option>'; return; }
        for (let i = 0; i < MapEditorState.mapData.paths.length; i++) {
            let opt = document.createElement('option');
            opt.value = i;
            let vis = MapEditorState.mapData.paths[i].visible !== false ? 'Visible' : 'Hidden';
            opt.innerText = `Path ${i + 1} (${vis})`;
            select.appendChild(opt);
        }
        if (MapEditorState.selectedPath === -1) MapEditorState.selectedPath = 0;
        if (MapEditorState.selectedPath >= MapEditorState.mapData.paths.length) MapEditorState.selectedPath = MapEditorState.mapData.paths.length - 1;
        select.value = MapEditorState.selectedPath;
    },
    newPath() {
        if (!MapEditorState.mapData.paths) MapEditorState.mapData.paths = [];
        MapEditorState.mapData.paths.push({ waypoints: [], visible: true, width: MapEditorState.pathWidth });
        MapEditorState.selectedPath = MapEditorState.mapData.paths.length - 1;
        MapEditorState.selectedPoints = [];
        MapEditorState.markDirty();
        this.updatePathDropdown();
        UI.log("New Path started. Click on the map to place the entrance (green flag).");
    },
    togglePathVisibility() { if (MapEditorState.selectedPath === -1) return; this.pushUndo(); let path = MapEditorState.mapData.paths[MapEditorState.selectedPath]; path.visible = !path.visible; MapEditorState.markDirty(); this.updatePathDropdown(); },
    reversePath() { if (MapEditorState.selectedPath === -1) return; this.pushUndo(); MapEditorState.mapData.paths[MapEditorState.selectedPath].waypoints.reverse(); MapEditorState.markDirty(); },
    insertPoint(point) {
        if (MapEditorState.selectedPath === -1) return;
        const path = MapEditorState.mapData.paths[MapEditorState.selectedPath];
        const idx = path.waypoints.indexOf(point);
        if (idx > 0) { const prev = path.waypoints[idx - 1]; const newPoint = { x: (prev.x + point.x) / 2, y: (prev.y + point.y) / 2 }; path.waypoints.splice(idx, 0, newPoint); MapEditorState.selectedPoints = [newPoint]; MapEditorState.markDirty(); }
    },
    toggleCurve() {
        if (MapEditorState.selectedPoints.length === 0 || MapEditorState.selectedPath === -1) return;
        const path = MapEditorState.mapData.paths[MapEditorState.selectedPath];
        const pt = MapEditorState.selectedPoints[0];
        const idx = path.waypoints.indexOf(pt);
        if (idx === 0) return;
        if (pt.curve) { delete pt.curve; } else { const prev = path.waypoints[idx - 1]; pt.curve = { cx: (prev.x + pt.x) / 2, cy: (prev.y + pt.y) / 2 }; }
        MapEditorState.markDirty();
    },
    deleteSelected() {
        let deleted = false;
        if (MapEditorState.selectedPoints.length > 0) {
            this.pushUndo();
            const path = MapEditorState.mapData.paths[MapEditorState.selectedPath];
            MapEditorState.selectedPoints.forEach(pt => { const idx = path.waypoints.indexOf(pt); if (idx > -1) path.waypoints.splice(idx, 1); });
            MapEditorState.selectedPoints = [];
            deleted = true;
        } else if (MapEditorState.selectedProps.length > 0) {
            this.pushUndo();
            MapEditorState.selectedProps.forEach(prop => { const idx = MapEditorState.mapData.props.indexOf(prop); if (idx > -1) MapEditorState.mapData.props.splice(idx, 1); });
            MapEditorState.selectedProps = [];
            deleted = true;
        }
        if (deleted) MapEditorState.markDirty();
    },

    ...Renderer,
    ...Input,
    ...IO,
    ...History
};
