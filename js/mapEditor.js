import { Config, CANVAS_WIDTH, CANVAS_HEIGHT } from './config.js';
import { UI } from './ui.js';

// FIX: Import the extracted modules
import Renderer from './mapEditorRenderer.js';
import Input from './mapEditorInput.js';
import IO from './mapEditorIO.js';
import History from './mapEditorHistory.js';

export const MapEditor = {
    canvas: null,
    ctx: null,
    currentTool: 'track',
    mapData: null,
    selectedPath: -1,
    selectedPoint: null,
    selectedProp: null,
    isDragging: false,
    isDrawingWater: false,
    waterEraseMode: false,
    waterBrushSize: 60,
    currentWaterStroke: null,
    currentHitboxShape: 'circle',
    mouse: { x: 0, y: 0 },
    _initialized: false,
    _rafId: null,
    undoStack: [],
    redoStack: [],
    refImage: null,
    refX: 0,
    refY: 0,
    refScale: 1,
    isDraggingRef: false,
    snapToGrid: false,
    dragStartPos: null,
    bgImage: null,
    bgNightImage: null,
    previewNight: false,
    currentPathWidth: 45, // FIX: Controllable path width

    init() {
        if (this._initialized) {
            this.resetMapData();
            this.startLoop();
            return;
        }
        this._initialized = true;
        this.canvas = document.getElementById('editor-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.canvas.style.maxWidth = '100%';
        this.canvas.style.maxHeight = '100%';
        this.canvas.style.width = '100%';
        this.canvas.style.height = 'auto';
        this.canvas.style.aspectRatio = '16 / 9';
        this.canvas.style.objectFit = 'contain';
        
        this.resetMapData();
        
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
        });

        const shapeCircleBtn = document.getElementById('editor-shape-circle');
        const shapeBoxBtn = document.getElementById('editor-shape-box');
        if (shapeCircleBtn) shapeCircleBtn.addEventListener('click', () => {
            this.currentHitboxShape = 'circle';
            shapeCircleBtn.classList.add('active');
            shapeBoxBtn.classList.remove('active');
        });
        if (shapeBoxBtn) shapeBoxBtn.addEventListener('click', () => {
            this.currentHitboxShape = 'box';
            shapeBoxBtn.classList.add('active');
            shapeCircleBtn.classList.remove('active');
        });

        const refInput = document.getElementById('editor-ref-input');
        if (refInput) {
            refInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    this.refImage = new Image();
                    this.refImage.src = ev.target.result;
                    this.refX = CANVAS_WIDTH / 2;
                    this.refY = CANVAS_HEIGHT / 2;
                    this.refScale = 1;
                };
                reader.readAsDataURL(file);
            });
        }

        const activePathSelect = document.getElementById('editor-active-path');
        if (activePathSelect) {
            activePathSelect.addEventListener('change', (e) => {
                this.selectedPath = parseInt(e.target.value);
                this.selectedPoint = null;
            });
        }

        const newPathBtn = document.getElementById('editor-new-path');
        if (newPathBtn) newPathBtn.addEventListener('click', () => { this.pushUndo(); this.newPath(); });
        
        const hidePathBtn = document.getElementById('editor-hide-path');
        if (hidePathBtn) hidePathBtn.addEventListener('click', () => this.togglePathVisibility());
        
        const toggleCurveBtn = document.getElementById('editor-toggle-curve');
        if (toggleCurveBtn) toggleCurveBtn.addEventListener('click', () => { this.pushUndo(); this.toggleCurve(); });
        
        const reversePathBtn = document.getElementById('editor-reverse-path');
        if (reversePathBtn) reversePathBtn.addEventListener('click', () => { this.pushUndo(); this.reversePath(); });
        
        const snapGridBtn = document.getElementById('editor-snap-grid');
        if (snapGridBtn) {
            snapGridBtn.addEventListener('click', () => {
                this.snapToGrid = !this.snapToGrid;
                snapGridBtn.innerText = `Snap to Grid: ${this.snapToGrid ? 'On' : 'Off'}`;
                snapGridBtn.classList.toggle('active', this.snapToGrid);
            });
        }

        // FIX: Add Path Width slider listener
        const pathWidthSlider = document.getElementById('editor-path-width');
        if (pathWidthSlider) {
            pathWidthSlider.addEventListener('input', (e) => {
                this.currentPathWidth = parseInt(e.target.value);
                const widthVal = document.getElementById('path-width-val');
                if (widthVal) widthVal.innerText = this.currentPathWidth;
            });
        }
        
        const undoBtn = document.getElementById('editor-undo');
        if (undoBtn) undoBtn.addEventListener('click', () => this.undo());
        
        const redoBtn = document.getElementById('editor-redo');
        if (redoBtn) redoBtn.addEventListener('click', () => this.redo());
        
        const deleteSelBtn = document.getElementById('editor-delete-sel');
        if (deleteSelBtn) deleteSelBtn.addEventListener('click', () => this.deleteSelected());
        
        const waterBrushSize = document.getElementById('water-brush-size');
        if (waterBrushSize) waterBrushSize.addEventListener('input', (e) => this.waterBrushSize = parseInt(e.target.value));
        
        const waterEraseToggle = document.getElementById('water-erase-toggle');
        if (waterEraseToggle) {
            waterEraseToggle.addEventListener('click', (e) => {
                this.waterEraseMode = !this.waterEraseMode;
                e.target.classList.toggle('active', this.waterEraseMode);
            });
        }
        
        const hideWaterBtn = document.getElementById('editor-hide-water');
        if (hideWaterBtn) hideWaterBtn.addEventListener('click', () => this.toggleWaterVisibility());
        
        const hidePropsBtn = document.getElementById('editor-hide-props');
        if (hidePropsBtn) hidePropsBtn.addEventListener('click', () => this.togglePropsVisibility());

        const bgNameInput = document.getElementById('bg-image-name');
        if (bgNameInput) bgNameInput.addEventListener('input', (e) => this.mapData.image = e.target.value);
        
        const loadBgBtn = document.getElementById('editor-load-bg');
        if (loadBgBtn) loadBgBtn.addEventListener('click', () => this.loadBackgroundPreview());
        
        const clearBgBtn = document.getElementById('editor-clear-bg');
        if (clearBgBtn) clearBgBtn.addEventListener('click', () => this.clearBackground());
        
        const nightNameInput = document.getElementById('bg-night-image-name');
        if (nightNameInput) nightNameInput.addEventListener('input', (e) => this.mapData.imageNight = e.target.value);
        
        const loadNightBgBtn = document.getElementById('editor-load-night-bg');
        if (loadNightBgBtn) loadNightBgBtn.addEventListener('click', () => this.loadNightBackgroundPreview());
        
        const clearNightBgBtn = document.getElementById('editor-clear-night-bg');
        if (clearNightBgBtn) clearNightBgBtn.addEventListener('click', () => this.clearNightBackground());

        const toggleNightBtn = document.getElementById('editor-toggle-night-preview');
        if (toggleNightBtn) {
            toggleNightBtn.addEventListener('click', () => {
                this.previewNight = !this.previewNight;
                toggleNightBtn.classList.toggle('active', this.previewNight);
            });
        }

        const bgMaintainRatio = document.getElementById('bg-maintain-ratio');
        if (bgMaintainRatio) {
            bgMaintainRatio.addEventListener('change', (e) => {
                this.mapData.imageMaintainRatio = e.target.checked;
            });
        }
        
        const bgImageScale = document.getElementById('bg-image-scale');
        if (bgImageScale) {
            bgImageScale.addEventListener('input', (e) => {
                this.mapData.imageScale = parseFloat(e.target.value);
                const scaleVal = document.getElementById('bg-scale-val');
                if (scaleVal) scaleVal.innerText = this.mapData.imageScale.toFixed(2);
            });
        }
        
        const bgImageX = document.getElementById('bg-image-x');
        if (bgImageX) {
            bgImageX.addEventListener('input', (e) => {
                this.mapData.imageOffsetX = parseInt(e.target.value);
                const xVal = document.getElementById('bg-x-val');
                if (xVal) xVal.innerText = this.mapData.imageOffsetX;
            });
        }
        
        const bgImageY = document.getElementById('bg-image-y');
        if (bgImageY) {
            bgImageY.addEventListener('input', (e) => {
                this.mapData.imageOffsetY = parseInt(e.target.value);
                const yVal = document.getElementById('bg-y-val');
                if (yVal) yVal.innerText = this.mapData.imageOffsetY;
            });
        }

        this.bgImage = new Image();
        this.bgImage.loaded = false;
        
        this.bgNightImage = new Image();
        this.bgNightImage.loaded = false;

        const saveBtn = document.getElementById('editor-save');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveMap());
        
        const loadBtn = document.getElementById('editor-load');
        if (loadBtn) loadBtn.addEventListener('click', () => this.loadMap());
        
        const exitBtn = document.getElementById('editor-exit');
        if (exitBtn) exitBtn.addEventListener('click', () => this.exitEditor());
        
        const toggleJsonBtn = document.getElementById('editor-toggle-json');
        if (toggleJsonBtn) toggleJsonBtn.addEventListener('click', () => this.toggleJSON());
        
        const applyJsonBtn = document.getElementById('editor-apply-json');
        if (applyJsonBtn) applyJsonBtn.addEventListener('click', () => { this.pushUndo(); this.applyJSON(); });
        
        const importJsonBtn = document.getElementById('editor-import-json-btn');
        const importJsonInput = document.getElementById('editor-import-json');
        if (importJsonBtn && importJsonInput) {
            importJsonBtn.addEventListener('click', () => importJsonInput.click());
            importJsonInput.addEventListener('change', (e) => this.importJSON(e));
        }
        
        this.startLoop();
    },
    
    exitEditor() {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        UI.toggleMenus('main-menu-ui');
    },
    
    startLoop() {
        if (!this._rafId) {
            this._loop = this.loop.bind(this);
            this._rafId = requestAnimationFrame(this._loop);
        }
    },
    
    loop() {
        this.draw();
        if (!document.getElementById('map-editor-menu').classList.contains('hidden')) {
            this._rafId = requestAnimationFrame(this._loop);
        } else {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    },
    
    resetMapData() {
        this.mapData = {
            name: "New Custom Map",
            paths: [],
            props: [],
            waterBrushes: [],
            waterVisible: true,
            propsVisible: true,
            image: null,
            imageNight: null,
            imageScale: 1.0,
            imageOffsetX: 0,
            imageOffsetY: 0,
            imageMaintainRatio: false
        };
        this.selectedPath = -1;
        this.selectedPoint = null;
        this.selectedProp = null;
        this.undoStack = [];
        this.redoStack = [];
        this.previewNight = false;
        
        const nameInput = document.getElementById('editor-map-name');
        if (nameInput) nameInput.value = "New Custom Map";
        
        const bgName = document.getElementById('bg-image-name');
        if (bgName) bgName.value = "";
        
        const nightName = document.getElementById('bg-night-image-name');
        if (nightName) nightName.value = "";
        
        const bgMaintainRatio = document.getElementById('bg-maintain-ratio');
        if (bgMaintainRatio) bgMaintainRatio.checked = false;
        
        const bgImageScale = document.getElementById('bg-image-scale');
        if (bgImageScale) bgImageScale.value = 1;
        
        const bgImageX = document.getElementById('bg-image-x');
        if (bgImageX) bgImageX.value = 0;
        
        const bgImageY = document.getElementById('bg-image-y');
        if (bgImageY) bgImageY.value = 0;
        
        const bgScaleVal = document.getElementById('bg-scale-val');
        if (bgScaleVal) bgScaleVal.innerText = "1.00";
        
        const bgXVal = document.getElementById('bg-x-val');
        if (bgXVal) bgXVal.innerText = "0";
        
        const bgYVal = document.getElementById('bg-y-val');
        if (bgYVal) bgYVal.innerText = "0";
        
        if (this.bgImage) this.bgImage.loaded = false;
        if (this.bgNightImage) this.bgNightImage.loaded = false;
        
        this.updatePathDropdown();
    },
    
    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
        
        const trackOpts = document.getElementById('track-options');
        if (trackOpts) trackOpts.classList.toggle('hidden', tool !== 'track');
        
        const waterOpts = document.getElementById('water-options');
        if (waterOpts) waterOpts.classList.toggle('hidden', tool !== 'water');
        
        const objOpts = document.getElementById('objects-options');
        if (objOpts) objOpts.classList.toggle('hidden', tool !== 'objects');
        
        const refOpts = document.getElementById('reference-options');
        if (refOpts) refOpts.classList.toggle('hidden', tool !== 'reference');
        
        const bgOpts = document.getElementById('bg-options');
        if (bgOpts) bgOpts.classList.toggle('hidden', tool !== 'bg');
        
        this.selectedPoint = null;
        this.selectedProp = null;
    },
    
    updatePathDropdown() {
        const select = document.getElementById('editor-active-path');
        if (!select) return;
        select.innerHTML = '';
        
        if (!this.mapData || !Array.isArray(this.mapData.paths) || this.mapData.paths.length === 0) {
            let opt = document.createElement('option');
            opt.value = -1;
            opt.innerText = "No Paths";
            select.appendChild(opt);
            return;
        }
        
        for (let i = 0; i < this.mapData.paths.length; i++) {
            let opt = document.createElement('option');
            opt.value = i;
            let vis = this.mapData.paths[i].visible !== false ? 'Visible' : 'Hidden';
            opt.innerText = `Path ${i + 1} (${vis})`;
            select.appendChild(opt);
        }
        
        if (this.selectedPath === -1) this.selectedPath = 0;
        if (this.selectedPath >= this.mapData.paths.length) this.selectedPath = this.mapData.paths.length - 1;
        select.value = this.selectedPath;
    },
    
    newPath() {
        if (!this.mapData.paths) this.mapData.paths = [];
        // FIX: Initialize path with the currently selected width
        this.mapData.paths.push({ waypoints: [], visible: true, width: this.currentPathWidth });
        this.selectedPath = this.mapData.paths.length - 1;
        this.selectedPoint = null;
        this.updatePathDropdown();
        UI.log("New Path started. Click on the map to place the entrance (green flag).");
    },
    
    togglePathVisibility() {
        if (this.selectedPath === -1 || !this.mapData.paths[this.selectedPath]) return;
        this.pushUndo();
        this.mapData.paths[this.selectedPath].visible = !this.mapData.paths[this.selectedPath].visible;
        this.updatePathDropdown();
        UI.log(`Path ${this.selectedPath + 1} is now ${this.mapData.paths[this.selectedPath].visible ? 'visible' : 'hidden'}.`);
    },

    toggleWaterVisibility() {
        this.pushUndo();
        this.mapData.waterVisible = !this.mapData.waterVisible;
        UI.log(`Water is now ${this.mapData.waterVisible ? 'visible' : 'hidden'}.`);
    },

    togglePropsVisibility() {
        this.pushUndo();
        this.mapData.propsVisible = !this.mapData.propsVisible;
        UI.log(`Objects are now ${this.mapData.propsVisible ? 'visible' : 'hidden'}.`);
    },
    
    reversePath() {
        if (this.selectedPath === -1 || !this.mapData.paths[this.selectedPath]) return;
        this.mapData.paths[this.selectedPath].waypoints.reverse();
    },
    
    insertPoint(point) {
        if (this.selectedPath === -1 || !this.mapData.paths[this.selectedPath]) return;
        const path = this.mapData.paths[this.selectedPath];
        const idx = path.waypoints.indexOf(point);
        if (idx > 0) {
            const prev = path.waypoints[idx - 1];
            const newPoint = { x: (prev.x + point.x) / 2, y: (prev.y + point.y) / 2 };
            path.waypoints.splice(idx, 0, newPoint);
            this.selectedPoint = newPoint;
        } else if (idx === 0) {
            const newPoint = { x: point.x - 20, y: point.y };
            path.waypoints.unshift(newPoint);
            this.selectedPoint = newPoint;
        }
    },
    
    toggleCurve() {
        if (!this.selectedPoint || this.selectedPath === -1 || !this.mapData.paths[this.selectedPath]) return;
        const path = this.mapData.paths[this.selectedPath];
        const idx = path.waypoints.indexOf(this.selectedPoint);
        if (idx === 0) return;
        
        if (this.selectedPoint.curve) {
            delete this.selectedPoint.curve;
        } else {
            const prev = path.waypoints[idx - 1];
            const dx = this.selectedPoint.x - prev.x;
            const dy = this.selectedPoint.y - prev.y;
            this.selectedPoint.curve = {
                cx: (prev.x + this.selectedPoint.x) / 2 - dy * 0.2,
                cy: (prev.y + this.selectedPoint.y) / 2 + dx * 0.2
            };
        }
    },

    deleteSelected() {
        let deleted = false;
        if (this.selectedPoint) {
            this.pushUndo();
            const path = this.mapData.paths[this.selectedPath];
            const idx = path.waypoints.indexOf(this.selectedPoint);
            if (idx > -1) { path.waypoints.splice(idx, 1); this.selectedPoint = null; deleted = true; }
        } else if (this.selectedProp) {
            this.pushUndo();
            const idx = this.mapData.props.indexOf(this.selectedProp);
            if (idx > -1) { this.mapData.props.splice(idx, 1); this.selectedProp = null; deleted = true; }
        }
        if (deleted) UI.log("Selected item deleted.");
    },

    // FIX: Merge extracted modules into the MapEditor object
    ...Renderer,
    ...Input,
    ...IO,
    ...History
};