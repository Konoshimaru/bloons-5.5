// js/mapEditor.js
import { Config, CANVAS_WIDTH, CANVAS_HEIGHT } from './config.js';
import { Maps } from './data.js';
import { UI } from './ui.js';
import { Utils } from './utils.js';

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
    currentObject: 'tree',
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

    init() {
        if (this._initialized) {
            this.resetMapData();
            this.startLoop();
            return;
        }
        this._initialized = true;
        this.canvas = document.getElementById('editor-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // PRO FIX: Prevent canvas from stretching when menu options change
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
        
        document.querySelectorAll('.obj-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.obj-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentObject = btn.dataset.obj;
            });
        });
        
        // Day Background
        const bgNameInput = document.getElementById('bg-image-name');
        if (bgNameInput) bgNameInput.addEventListener('input', (e) => this.mapData.image = e.target.value);
        
        const loadBgBtn = document.getElementById('editor-load-bg');
        if (loadBgBtn) loadBgBtn.addEventListener('click', () => this.loadBackgroundPreview());
        
        const clearBgBtn = document.getElementById('editor-clear-bg');
        if (clearBgBtn) clearBgBtn.addEventListener('click', () => this.clearBackground());
        
        // Night Background
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
        
        this.startLoop();
    },
    
    handleWheel(e) {
        if (this.currentTool === 'reference' && this.refImage) {
            e.preventDefault();
            this.refScale *= e.deltaY > 0 ? 0.9 : 1.1;
        }
    },
    
    exitEditor() {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        UI.toggleMenus('main-menu-ui');
    },
    
    pushUndo() {
        if (!this.mapData) return;
        this.undoStack.push(JSON.parse(JSON.stringify(this.mapData)));
        if (this.undoStack.length > 25) this.undoStack.shift();
        this.redoStack = []; 
    },
    
    undo() {
        if (this.undoStack.length === 0) { UI.log("Nothing to undo."); return; }
        this.redoStack.push(JSON.parse(JSON.stringify(this.mapData)));
        this.mapData = this.undoStack.pop();
        this.selectedPoint = null;
        this.selectedProp = null;
        this.updatePathDropdown();
        UI.log("Undo performed.");
    },
    
    redo() {
        if (this.redoStack.length === 0) { UI.log("Nothing to redo."); return; }
        this.undoStack.push(JSON.parse(JSON.stringify(this.mapData)));
        this.mapData = this.redoStack.pop();
        this.selectedPoint = null;
        this.selectedProp = null;
        this.updatePathDropdown();
        UI.log("Redo performed.");
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
        this.mapData.paths.push({ waypoints: [], visible: true });
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
    
    reversePath() {
        if (this.selectedPath === -1 || !this.mapData.paths[this.selectedPath]) return;
        this.mapData.paths[this.selectedPath].waypoints.reverse();
    },
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        let x = (e.clientX - rect.left) * scaleX;
        let y = (e.clientY - rect.top) * scaleY;
        
        if (this.snapToGrid) {
            x = Math.round(x / 10) * 10;
            y = Math.round(y / 10) * 10;
        }
        
        return { x, y };
    },
    
    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        this.mouse = pos;
        
        if (this.currentTool === 'track') {
            this.handleTrackMouseDown(pos, e.button);
        } else if (this.currentTool === 'water') {
            if (this.waterEraseMode) { this.eraseWaterAt(pos); } 
            else {
                this.pushUndo();
                this.currentWaterStroke = { thickness: this.waterBrushSize, points: [{x: pos.x, y: pos.y}] };
                this.isDrawingWater = true;
            }
        } else if (this.currentTool === 'objects') {
            this.handleObjectsMouseDown(pos);
        } else if (this.currentTool === 'reference') {
            if (this.refImage) {
                this.isDraggingRef = true;
                this.refX = pos.x;
                this.refY = pos.y;
                this.dragStartPos = { x: pos.x, y: pos.y };
            } else {
                const refInput = document.getElementById('editor-ref-input');
                if (refInput) refInput.click();
            }
        }
    },
    
    handleTrackMouseDown(pos, button) {
        if (!this.mapData || !Array.isArray(this.mapData.paths)) return;
        
        for (let p = 0; p < this.mapData.paths.length; p++) {
            if (!this.mapData.paths[p] || !Array.isArray(this.mapData.paths[p].waypoints)) continue;
            for (let i = 0; i < this.mapData.paths[p].waypoints.length; i++) {
                const wp = this.mapData.paths[p].waypoints[i];
                if (!wp) continue;
                if (wp.curve) {
                    if (Math.hypot(pos.x - wp.curve.cx, pos.y - wp.curve.cy) < 12) {
                        this.selectedPath = p;
                        this.selectedPoint = wp;
                        this.isDragging = 'curve';
                        this.dragStartPos = { x: pos.x, y: pos.y };
                        this.updatePathDropdown();
                        return;
                    }
                }
            }
        }
        
        for (let p = 0; p < this.mapData.paths.length; p++) {
            if (!this.mapData.paths[p] || !Array.isArray(this.mapData.paths[p].waypoints)) continue;
            for (let i = 0; i < this.mapData.paths[p].waypoints.length; i++) {
                const wp = this.mapData.paths[p].waypoints[i];
                if (!wp) continue;
                if (Math.hypot(pos.x - wp.x, pos.y - wp.y) < 12) {
                    this.selectedPath = p;
                    this.selectedPoint = wp;
                    this.selectedProp = null;
                    if (button === 2) { this.pushUndo(); this.insertPoint(wp); } 
                    else { 
                        this.pushUndo(); 
                        this.isDragging = 'point'; 
                        this.dragStartPos = { x: pos.x, y: pos.y }; 
                    }
                    this.updatePathDropdown();
                    return;
                }
            }
        }
        
        if (this.selectedPath !== -1 && this.mapData.paths[this.selectedPath]) {
            this.pushUndo();
            this.selectedPoint = null;
            if (!this.mapData.paths[this.selectedPath].waypoints) this.mapData.paths[this.selectedPath].waypoints = [];
            this.mapData.paths[this.selectedPath].waypoints.push({ x: pos.x, y: pos.y });
            this.selectedPoint = this.mapData.paths[this.selectedPath].waypoints[this.mapData.paths[this.selectedPath].waypoints.length - 1];
        } else if (this.mapData.paths.length === 0) {
            this.newPath();
            this.pushUndo();
            this.selectedPoint = null;
            this.mapData.paths[this.selectedPath].waypoints.push({ x: pos.x, y: pos.y });
            this.selectedPoint = this.mapData.paths[this.selectedPath].waypoints[this.mapData.paths[this.selectedPath].waypoints.length - 1];
            this.updatePathDropdown();
        } else {
            UI.log("Select a path from the dropdown first, or click 'New Path'.");
        }
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
    
    handleObjectsMouseDown(pos) {
        if (!this.mapData.props) this.mapData.props = [];
        let clickedProp = null;
        for (let i = this.mapData.props.length - 1; i >= 0; i--) {
            const p = this.mapData.props[i];
            if (p && p.type !== 'pond' && Math.hypot(pos.x - p.x, pos.y - p.y) < 15) {
                clickedProp = p; break;
            }
        }
        
        if (clickedProp) {
            this.selectedProp = clickedProp;
            this.selectedPoint = null;
            this.pushUndo();
            this.isDragging = 'prop';
            this.dragStartPos = { x: pos.x, y: pos.y };
        } else {
            this.pushUndo();
            this.mapData.props.push({ type: this.currentObject, x: pos.x, y: pos.y });
            this.selectedProp = this.mapData.props[this.mapData.props.length - 1];
        }
    },
    
    eraseWaterAt(pos) {
        if (!this.mapData.waterBrushes) return;
        for (let i = this.mapData.waterBrushes.length - 1; i >= 0; i--) {
            const brush = this.mapData.waterBrushes[i];
            if (!brush || !brush.points) continue;
            const r = brush.thickness / 2;
            let hit = false;
            if (brush.points.length === 1) {
                if (Math.hypot(pos.x - brush.points[0].x, pos.y - brush.points[0].y) < r) hit = true;
            } else {
                for (let j = 0; j < brush.points.length - 1; j++) {
                    if (Utils.distToSegment(pos.x, pos.y, brush.points[j].x, brush.points[j].y, brush.points[j+1].x, brush.points[j+1].y) < r) {
                        hit = true; break;
                    }
                }
            }
            if (hit) { this.pushUndo(); this.mapData.waterBrushes.splice(i, 1); return; }
        }
    },
    
    handleMouseMove(e) {
        let pos = this.getMousePos(e);
        
        if (e.shiftKey && this.dragStartPos && (this.isDragging || this.isDraggingRef)) {
            let dx = pos.x - this.dragStartPos.x;
            let dy = pos.y - this.dragStartPos.y;
            if (Math.abs(dx) > Math.abs(dy)) {
                pos.y = this.dragStartPos.y;
            } else {
                pos.x = this.dragStartPos.x;
            }
        }
        
        this.mouse = pos;
        
        if (this.isDragging === 'point' && this.selectedPoint) {
            this.selectedPoint.x = pos.x; this.selectedPoint.y = pos.y;
        } else if (this.isDragging === 'curve' && this.selectedPoint) {
            this.selectedPoint.curve.cx = pos.x; this.selectedPoint.curve.cy = pos.y;
        } else if (this.isDragging === 'prop' && this.selectedProp) {
            this.selectedProp.x = pos.x; this.selectedProp.y = pos.y;
        } else if (this.isDraggingRef) {
            this.refX = pos.x; this.refY = pos.y;
        }
        
        if (this.isDrawingWater && this.currentWaterStroke) {
            const lastPt = this.currentWaterStroke.points[this.currentWaterStroke.points.length - 1];
            if (Math.hypot(pos.x - lastPt.x, pos.y - lastPt.y) > 4) {
                this.currentWaterStroke.points.push({x: pos.x, y: pos.y});
            }
        }
    },
    
    handleMouseUp() {
        if (this.currentWaterStroke) {
            if (!this.mapData.waterBrushes) this.mapData.waterBrushes = [];
            this.mapData.waterBrushes.push(this.currentWaterStroke);
            this.currentWaterStroke = null;
        }
        this.isDragging = false;
        this.isDrawingWater = false;
        this.isDraggingRef = false;
        this.dragStartPos = null;
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
    
    handleKeyDown(e) {
        const editorMenu = document.getElementById('map-editor-menu');
        if (!editorMenu || editorMenu.classList.contains('hidden')) return;

        if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.undo(); } 
        else if ((e.key === 'y' || e.key === 'Y') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.redo(); } 
        else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            this.deleteSelected();
        }
    },

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
        this.mapData.paths = this.mapData.paths.filter(p => p && p.waypoints && p.waypoints.length > 0);
        
        if (this.mapData.paths.length === 0) { alert("Please draw at least one path with 2 or more points."); return; }
        
        for (let p of this.mapData.paths) {
            if (p.waypoints.length < 2) { alert("Each path must have at least 2 waypoints."); return; }
        }
        
        const existingIdx = Config.data.customMaps.findIndex(m => m.name === this.mapData.name);
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
                if (!Array.isArray(this.mapData.waterBrushes)) this.mapData.waterBrushes = [];
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
                if (nameInput) nameInput.value = this.mapData.name;
                
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
            } else { alert("Map not found."); }
        }
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
            if (!Array.isArray(this.mapData.waterBrushes)) this.mapData.waterBrushes = [];
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
            alert("JSON applied!");
        } catch (e) { alert("Invalid JSON: " + e.message); }
    },
    
    drawWaterStroke(ctx, brush) {
        if (!brush || !brush.points || brush.points.length === 0) return;
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = brush.thickness;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(brush.points[0].x, brush.points[0].y);
        for (let i = 1; i < brush.points.length; i++) ctx.lineTo(brush.points[i].x, brush.points[i].y);
        if (brush.points.length === 1) ctx.arc(brush.points[0].x, brush.points[0].y, brush.thickness / 2, 0, Math.PI * 2);
        ctx.stroke();
    },
    
    draw() {
        if (!this.mapData) return;
        const ctx = this.ctx;
        const scale = this.mapData.imageScale || 1;
        const offX = this.mapData.imageOffsetX || 0;
        const offY = this.mapData.imageOffsetY || 0;
        let w = CANVAS_WIDTH * scale;
        let h = CANVAS_HEIGHT * scale;
        
        // PRO FIX: Added safety check for this.bgImage existing
        if (this.mapData.imageMaintainRatio && this.bgImage && this.bgImage.width > 0) {
            const ratio = this.bgImage.height / this.bgImage.width;
            h = w * ratio;
        }

        const drawDay = !this.previewNight && this.bgImage && this.bgImage.loaded && this.mapData.image;
        const drawNight = (this.previewNight || !drawDay) && this.bgNightImage && this.bgNightImage.loaded && this.mapData.imageNight;

        if (drawDay) {
            ctx.drawImage(this.bgImage, offX, offY, w, h);
        } else if (drawNight) {
            ctx.drawImage(this.bgNightImage, offX, offY, w, h);
        } else {
            ctx.fillStyle = '#8acc4d';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
        
        if (this.refImage) {
            ctx.globalAlpha = 0.5;
            const rw = this.refImage.width * this.refScale;
            const rh = this.refImage.height * this.refScale;
            ctx.drawImage(this.refImage, this.refX - rw/2, this.refY - rh/2, rw, rh);
            ctx.globalAlpha = 1.0;
        }
        
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        for (let x = 0; x < CANVAS_WIDTH; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); ctx.stroke(); }
        for (let y = 0; y < CANVAS_HEIGHT; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke(); }
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(CANVAS_WIDTH - 220, 0, 220, CANVAS_HEIGHT);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(CANVAS_WIDTH - 220, 0);
        ctx.lineTo(CANVAS_WIDTH - 220, CANVAS_HEIGHT);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.fillText('In-Game Sidebar', CANVAS_WIDTH - 210, 20);
        
        if (Array.isArray(this.mapData.waterBrushes)) {
            for (let brush of this.mapData.waterBrushes) this.drawWaterStroke(ctx, brush);
        }
        if (this.currentWaterStroke) this.drawWaterStroke(ctx, this.currentWaterStroke);

        if (Array.isArray(this.mapData.props)) {
            for (let p of this.mapData.props) {
                if (p && p.x !== undefined) this.drawEditorProp(ctx, p);
            }
        }
        
        if (Array.isArray(this.mapData.paths)) {
            for (let p = 0; p < this.mapData.paths.length; p++) {
                const path = this.mapData.paths[p];
                if (!path || !Array.isArray(path.waypoints)) continue;
                const isSelected = p === this.selectedPath;
                
                if (path.visible === false && !isSelected) continue;
                if (path.visible === false) ctx.globalAlpha = 0.3;
                
                ctx.strokeStyle = '#a8825a';
                ctx.lineWidth = 45;
                ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                
                // PRO FIX: Only draw the path if it has waypoints!
                if (path.waypoints.length > 0) {
                    ctx.beginPath();
                    ctx.moveTo(path.waypoints[0].x, path.waypoints[0].y);
                    for (let i = 1; i < path.waypoints.length; i++) {
                        const wp = path.waypoints[i];
                        if (!wp) continue;
                        if (wp.curve) ctx.quadraticCurveTo(wp.curve.cx, wp.curve.cy, wp.x, wp.y);
                        else ctx.lineTo(wp.x, wp.y);
                    }
                    ctx.stroke();
                }
                
                for (let i = 0; i < path.waypoints.length; i++) {
                    const wp = path.waypoints[i];
                    if (!wp) continue;
                    if (i === 0) {
                        ctx.fillStyle = '#2ecc70'; 
                        ctx.beginPath();
                        ctx.moveTo(wp.x - 6, wp.y - 15);
                        ctx.lineTo(wp.x + 6, wp.y - 10);
                        ctx.lineTo(wp.x - 6, wp.y - 5);
                        ctx.closePath();
                        ctx.fill();
                        ctx.fillRect(wp.x - 8, wp.y - 15, 2, 15);
                    } else if (i === path.waypoints.length - 1) {
                        ctx.fillStyle = '#e74c3c'; 
                        ctx.beginPath();
                        ctx.moveTo(wp.x - 6, wp.y - 15);
                        ctx.lineTo(wp.x + 6, wp.y - 10);
                        ctx.lineTo(wp.x - 6, wp.y - 5);
                        ctx.closePath();
                        ctx.fill();
                        ctx.fillRect(wp.x - 8, wp.y - 15, 2, 15);
                    }
                    
                    ctx.fillStyle = '#fff';
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(wp.x, wp.y, 8, 0, Math.PI * 2);
                    ctx.fill(); ctx.stroke();
                    
                    if (wp.curve) {
                        ctx.strokeStyle = '#f1c40f';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo((i > 0 && path.waypoints[i-1]) ? path.waypoints[i-1].x : wp.x, (i > 0 && path.waypoints[i-1]) ? path.waypoints[i-1].y : wp.y);
                        ctx.lineTo(wp.curve.cx, wp.curve.cy);
                        ctx.lineTo(wp.x, wp.y);
                        ctx.stroke();
                        
                        ctx.fillStyle = '#f1c40f';
                        ctx.beginPath();
                        ctx.arc(wp.curve.cx, wp.curve.cy, 6, 0, Math.PI * 2);
                        ctx.fill(); ctx.stroke();
                    }
                }
                ctx.globalAlpha = 1.0;
            }
        }
        
        if (this.selectedPoint) {
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.selectedPoint.x, this.selectedPoint.y, 12, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (this.selectedProp) {
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.selectedProp.x, this.selectedProp.y, 18, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        if (this.currentTool === 'water') {
            ctx.strokeStyle = this.waterEraseMode ? '#e74c3c' : '#3498db';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.mouse.x, this.mouse.y, this.waterBrushSize / 2, 0, Math.PI * 2);
            ctx.stroke();
        }
    },
    
    drawEditorProp(ctx, p) {
        if (p.type === 'tree') {
            ctx.fillStyle = '#6e552f'; ctx.fillRect(p.x - 3, p.y - 5, 6, 15);
            ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.arc(p.x, p.y - 10, 15, 0, Math.PI * 2); ctx.fill();
        } else if (p.type === 'bush') {
            ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill();
        } else if (p.type === 'rock') {
            ctx.fillStyle = '#7f8c8d'; ctx.beginPath(); ctx.moveTo(p.x - 15, p.y); ctx.lineTo(p.x - 5, p.y - 15); ctx.lineTo(p.x + 10, p.y - 10); ctx.lineTo(p.x + 15, p.y); ctx.fill();
        } else if (p.type === 'pond') {
            ctx.fillStyle = 'rgba(52, 152, 219, 0.5)'; 
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r || 25, 0, Math.PI * 2); ctx.fill();
        }
    }
};