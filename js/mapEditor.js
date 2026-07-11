// js/mapEditor.js
import { Config } from './config.js';
import { Maps } from './data.js';
import { UI } from './ui.js';

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
    waterBrushSize: 30,
    currentObject: 'tree',
    mouse: { x: 0, y: 0 },
    _initialized: false,
    _rafId: null,
    undoStack: [], // PRO FIX: Added Undo Stack

    init() {
        if (this._initialized) {
            this.resetMapData();
            this.startLoop();
            return;
        }
        this._initialized = true;
        this.canvas = document.getElementById('editor-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resetMapData();
        
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
        });
        
        document.getElementById('editor-new-path').addEventListener('click', () => {
            this.pushUndo();
            this.newPath();
        });
        document.getElementById('editor-toggle-curve').addEventListener('click', () => {
            this.pushUndo();
            this.toggleCurve();
        });
        document.getElementById('editor-undo').addEventListener('click', () => this.undo()); // PRO FIX: Undo Button
        
        document.getElementById('water-brush-size').addEventListener('input', (e) => this.waterBrushSize = parseInt(e.target.value));
        document.getElementById('water-erase-toggle').addEventListener('click', (e) => {
            this.waterEraseMode = !this.waterEraseMode;
            e.target.classList.toggle('active', this.waterEraseMode);
        });
        
        document.querySelectorAll('.obj-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.obj-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentObject = btn.dataset.obj;
            });
        });
        
        document.getElementById('editor-save').addEventListener('click', () => this.saveMap());
        document.getElementById('editor-load').addEventListener('click', () => this.loadMap());
        document.getElementById('editor-toggle-json').addEventListener('click', () => this.toggleJSON());
        document.getElementById('editor-apply-json').addEventListener('click', () => {
            this.pushUndo();
            this.applyJSON();
        });
        
        this.startLoop();
    },
    
    pushUndo() {
        this.undoStack.push(JSON.parse(JSON.stringify(this.mapData)));
        if (this.undoStack.length > 25) this.undoStack.shift(); // Limit history
    },
    
    undo() {
        if (this.undoStack.length === 0) {
            UI.log("Nothing to undo.");
            return;
        }
        this.mapData = this.undoStack.pop();
        this.selectedPoint = null;
        this.selectedProp = null;
        UI.log("Undo performed.");
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
            props: []
        };
        this.selectedPath = -1;
        this.selectedPoint = null;
        this.selectedProp = null;
        this.undoStack = []; // Clear history on new map
        document.getElementById('editor-map-name').value = "New Custom Map";
    },
    
    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
        document.getElementById('track-options').classList.toggle('hidden', tool !== 'track');
        document.getElementById('water-options').classList.toggle('hidden', tool !== 'water');
        document.getElementById('objects-options').classList.toggle('hidden', tool !== 'objects');
        this.selectedPoint = null;
        this.selectedProp = null;
    },
    
    newPath() {
        this.mapData.paths.push({ waypoints: [] });
        this.selectedPath = this.mapData.paths.length - 1;
        this.selectedPoint = null;
    },
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        // PRO FIX: Proper scaling for responsive CSS canvas size
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    },
    
    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        this.mouse = pos;
        
        if (this.currentTool === 'track') {
            this.handleTrackMouseDown(pos, e.button);
        } else if (this.currentTool === 'water') {
            this.pushUndo(); // Save state before painting
            this.isDrawingWater = true;
            this.paintWater(pos);
        } else if (this.currentTool === 'objects') {
            this.handleObjectsMouseDown(pos);
        }
    },
    
    handleTrackMouseDown(pos, button) {
        if (this.selectedPath === -1 || !this.mapData.paths[this.selectedPath]) {
            this.newPath();
        }
        
        const path = this.mapData.paths[this.selectedPath];
        
        // Check curve handle drag
        if (this.selectedPoint && this.selectedPoint.curve) {
            const dx = pos.x - this.selectedPoint.curve.cx;
            const dy = pos.y - this.selectedPoint.curve.cy;
            if (Math.hypot(dx, dy) < 10) {
                this.pushUndo(); // Save state before dragging
                this.isDragging = 'curve';
                return;
            }
        }
        
        // Check existing point click
        let clickedPoint = null;
        let clickedPathIdx = -1;
        for (let p = 0; p < this.mapData.paths.length; p++) {
            for (let i = 0; i < this.mapData.paths[p].waypoints.length; i++) {
                const wp = this.mapData.paths[p].waypoints[i];
                if (Math.hypot(pos.x - wp.x, pos.y - wp.y) < 10) {
                    clickedPoint = wp;
                    clickedPathIdx = p;
                    break;
                }
            }
            if (clickedPoint) break;
        }
        
        if (clickedPoint) {
            this.selectedPath = clickedPathIdx;
            this.selectedPoint = clickedPoint;
            this.selectedProp = null;
            if (button === 2) { 
                this.pushUndo();
                this.insertPoint(clickedPoint);
            } else {
                this.pushUndo(); // Save state before dragging
                this.isDragging = 'point';
            }
            return;
        }
        
        // Add new point
        this.pushUndo();
        this.selectedPoint = null;
        path.waypoints.push({ x: pos.x, y: pos.y });
        this.selectedPoint = path.waypoints[path.waypoints.length - 1];
    },
    
    insertPoint(point) {
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
        if (!this.selectedPoint) return;
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
        let clickedProp = null;
        for (let i = this.mapData.props.length - 1; i >= 0; i--) {
            const p = this.mapData.props[i];
            if (p.type !== 'pond' && Math.hypot(pos.x - p.x, pos.y - p.y) < 15) {
                clickedProp = p;
                break;
            }
        }
        
        if (clickedProp) {
            this.selectedProp = clickedProp;
            this.selectedPoint = null;
            this.pushUndo(); // Save state before dragging
            this.isDragging = 'prop';
        } else {
            this.pushUndo(); // Save state before adding
            this.mapData.props.push({ type: this.currentObject, x: pos.x, y: pos.y });
            this.selectedProp = this.mapData.props[this.mapData.props.length - 1];
        }
    },
    
    paintWater(pos) {
        if (this.waterEraseMode) {
            this.mapData.props = this.mapData.props.filter(p => {
                if (p.type === 'pond') {
                    return Math.hypot(pos.x - p.x, pos.y - p.y) > this.waterBrushSize / 2;
                }
                return true;
            });
        } else {
            const lastPond = this.mapData.props.filter(p => p.type === 'pond').pop();
            if (!lastPond || Math.hypot(pos.x - lastPond.x, pos.y - lastPond.y) > 10) {
                this.mapData.props.push({ type: 'pond', x: pos.x, y: pos.y, r: this.waterBrushSize / 2 });
            }
        }
    },
    
    handleMouseMove(e) {
        const pos = this.getMousePos(e);
        this.mouse = pos;
        
        if (this.isDragging === 'point' && this.selectedPoint) {
            this.selectedPoint.x = pos.x;
            this.selectedPoint.y = pos.y;
        } else if (this.isDragging === 'curve' && this.selectedPoint) {
            this.selectedPoint.curve.cx = pos.x;
            this.selectedPoint.curve.cy = pos.y;
        } else if (this.isDragging === 'prop' && this.selectedProp) {
            this.selectedProp.x = pos.x;
            this.selectedProp.y = pos.y;
        }
        
        if (this.isDrawingWater) {
            this.paintWater(pos);
        }
    },
    
    handleMouseUp() {
        this.isDragging = false;
        this.isDrawingWater = false;
    },
    
    handleKeyDown(e) {
        // Only run if editor is open
        if (document.getElementById('map-editor-menu').classList.contains('hidden')) return;

        if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.undo();
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.selectedPoint) {
                this.pushUndo();
                const path = this.mapData.paths[this.selectedPath];
                const idx = path.waypoints.indexOf(this.selectedPoint);
                if (idx > -1) {
                    path.waypoints.splice(idx, 1);
                    this.selectedPoint = null;
                }
            } else if (this.selectedProp) {
                this.pushUndo();
                const idx = this.mapData.props.indexOf(this.selectedProp);
                if (idx > -1) {
                    this.mapData.props.splice(idx, 1);
                    this.selectedProp = null;
                }
            }
        }
    },
    
    saveMap() {
        this.mapData.name = document.getElementById('editor-map-name').value || "Custom Map";
        for (let p of this.mapData.paths) {
            if (p.waypoints.length < 2) {
                alert("Each path must have at least 2 waypoints.");
                return;
            }
        }
        
        const existingIdx = Config.data.customMaps.findIndex(m => m.name === this.mapData.name);
        const mapCopy = JSON.parse(JSON.stringify(this.mapData));
        if (existingIdx > -1) {
            Config.data.customMaps[existingIdx] = mapCopy;
            Maps[existingIdx + 5] = mapCopy; // Assuming 5 default maps
        } else {
            Config.data.customMaps.push(mapCopy);
            Maps.push(mapCopy);
        }
        Config.save();
        alert("Map saved!");
    },
    
    loadMap() {
        const names = Config.data.customMaps.map(m => m.name);
        if (names.length === 0) {
            alert("No custom maps saved.");
            return;
        }
        const name = prompt("Enter map name to load:\n" + names.join(", "));
        if (name) {
            const map = Config.data.customMaps.find(m => m.name === name);
            if (map) {
                this.pushUndo(); // Save current state before loading over it
                this.mapData = JSON.parse(JSON.stringify(map));
                this.selectedPath = -1;
                this.selectedPoint = null;
                this.selectedProp = null;
                document.getElementById('editor-map-name').value = this.mapData.name;
            } else {
                alert("Map not found.");
            }
        }
    },
    
    toggleJSON() {
        const viewer = document.getElementById('editor-json-viewer');
        const textArea = document.getElementById('editor-json-text');
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
            this.mapData = JSON.parse(textArea.value);
            this.selectedPath = -1;
            this.selectedPoint = null;
            this.selectedProp = null;
            document.getElementById('editor-map-name').value = this.mapData.name || "Custom Map";
            alert("JSON applied!");
        } catch (e) {
            alert("Invalid JSON: " + e.message);
        }
    },
    
    draw() {
        const ctx = this.ctx;
        ctx.fillStyle = '#8acc4d';
        ctx.fillRect(0, 0, 900, 600);
        
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        for (let x = 0; x < 900; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 600); ctx.stroke(); }
        for (let y = 0; y < 600; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(900, y); ctx.stroke(); }
        
        for (let p of this.mapData.props) {
            this.drawEditorProp(ctx, p);
        }
        
        for (let p = 0; p < this.mapData.paths.length; p++) {
            const path = this.mapData.paths[p];
            if (path.waypoints.length === 0) continue;
            
            ctx.strokeStyle = '#a8825a';
            ctx.lineWidth = 45;
            ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(path.waypoints[0].x, path.waypoints[0].y);
            for (let i = 1; i < path.waypoints.length; i++) {
                const wp = path.waypoints[i];
                if (wp.curve) {
                    ctx.quadraticCurveTo(wp.curve.cx, wp.curve.cy, wp.x, wp.y);
                } else {
                    ctx.lineTo(wp.x, wp.y);
                }
            }
            ctx.stroke();
            
            for (let i = 0; i < path.waypoints.length; i++) {
                const wp = path.waypoints[i];
                ctx.fillStyle = (i === 0) ? '#2ecc71' : (i === path.waypoints.length - 1) ? '#e74c3c' : '#fff';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(wp.x, wp.y, 8, 0, Math.PI * 2);
                ctx.fill(); ctx.stroke();
                
                if (wp.curve) {
                    ctx.strokeStyle = '#f1c40f';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo((i > 0 ? path.waypoints[i-1].x : wp.x), (i > 0 ? path.waypoints[i-1].y : wp.y));
                    ctx.lineTo(wp.curve.cx, wp.curve.cy);
                    ctx.lineTo(wp.x, wp.y);
                    ctx.stroke();
                    
                    ctx.fillStyle = '#f1c40f';
                    ctx.beginPath();
                    ctx.arc(wp.curve.cx, wp.curve.cy, 6, 0, Math.PI * 2);
                    ctx.fill(); ctx.stroke();
                }
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