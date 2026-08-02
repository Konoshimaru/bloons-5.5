// js/mapEditorInput.js
import { MapEditorState } from './mapEditorState.js';
import { UI } from './ui.js';
import { Utils } from './utils.js';

export default {
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        let screenX = (e.clientX - rect.left) * scaleX;
        let screenY = (e.clientY - rect.top) * scaleY;
        let world = MapEditorState.screenToWorld(screenX, screenY);
        if (MapEditorState.snapToGrid) {
            world.x = Math.round(world.x / MapEditorState.gridSize) * MapEditorState.gridSize;
            world.y = Math.round(world.y / MapEditorState.gridSize) * MapEditorState.gridSize;
        }
        MapEditorState.mouseWorldX = world.x; MapEditorState.mouseWorldY = world.y;
        return world;
    },

    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        this.mouse = pos;
        if (e.button === 1 || (e.button === 0 && this.isSpaceDown)) {
            this.isPanning = true;
            this.panStart = { x: e.clientX, y: e.clientY, camX: MapEditorState.camera.x, camY: MapEditorState.camera.y };
            e.preventDefault(); return;
        }
        if (MapEditorState.currentTool === 'track') this.handleTrackMouseDown(pos, e.button);
        else if (MapEditorState.currentTool === 'water') {
            if (MapEditorState.waterEraseMode) {
                this.isErasingWater = true; 
                this.eraseWaterAt(pos);
            } else {
                this.pushUndo(); MapEditorState.markDirty();
                MapEditorState.currentWaterStroke = { thickness: MapEditorState.waterBrushSize, points: [{x: pos.x, y: pos.y}] };
                this.isDrawingWater = true;
            }
        } else if (MapEditorState.currentTool === 'objects') this.handleObjectsMouseDown(pos);
        else if (MapEditorState.currentTool === 'reference') {
            if (MapEditorState.refImage) { this.isDraggingRef = true; MapEditorState.refX = pos.x; MapEditorState.refY = pos.y; this.dragStartPos = { x: pos.x, y: pos.y }; }
            else { document.getElementById('editor-ref-input')?.click(); }
        }
    },

    handleTrackMouseDown(pos, button) {
        if (!MapEditorState.mapData || !Array.isArray(MapEditorState.mapData.paths)) return;
        if (MapEditorState.selectedPath === -1 || !MapEditorState.mapData.paths[MapEditorState.selectedPath]) { UI.log("Select a path from the dropdown first, or click 'New Path'."); return; }
        const path = MapEditorState.mapData.paths[MapEditorState.selectedPath];
        for (let i = 0; i < path.waypoints.length; i++) {
            const wp = path.waypoints[i];
            if (wp.curve && Math.hypot(pos.x - wp.curve.cx, pos.y - wp.curve.cy) < 15) { MapEditorState.selectedPoints = [wp]; this.isDragging = 'curve'; this.dragStartPos = { x: pos.x, y: pos.y }; return; }
        }
        for (let i = 0; i < path.waypoints.length; i++) {
            const wp = path.waypoints[i];
            if (Math.hypot(pos.x - wp.x, pos.y - wp.y) < 15) {
                MapEditorState.selectedPoints = [wp]; MapEditorState.selectedProps = [];
                if (button === 2) { this.pushUndo(); this.insertPoint(wp); MapEditorState.markDirty(); } 
                else { this.pushUndo(); this.isDragging = 'point'; this.dragStartPos = { x: pos.x, y: pos.y }; }
                const widthSlider = document.getElementById('editor-path-width');
                if (widthSlider) { widthSlider.value = path.width || 45; document.getElementById('path-width-val').innerText = path.width || 45; }
                return;
            }
        }
        this.pushUndo(); MapEditorState.markDirty(); MapEditorState.selectedPoints = [];
        path.waypoints.push({ x: pos.x, y: pos.y });
        MapEditorState.selectedPoints = [path.waypoints[path.waypoints.length - 1]];
    },

    handleObjectsMouseDown(pos) {
        if (!MapEditorState.mapData.props) MapEditorState.mapData.props = [];
        let clickedProp = null;
        for (let i = MapEditorState.mapData.props.length - 1; i >= 0; i--) {
            const p = MapEditorState.mapData.props[i];
            if (p.shape === 'box') {
                const w = p.w || 30, h = p.h || 30;
                if (Math.abs(pos.x - p.x) < w/2 && Math.abs(pos.y - p.y) < h/2) { clickedProp = p; break; }
            } else {
                const r = p.r || 15;
                if (Math.hypot(pos.x - p.x, pos.y - p.y) < r) { clickedProp = p; break; }
            }
        }
        if (clickedProp) {
            MapEditorState.selectedProps = [clickedProp]; MapEditorState.selectedPoints = [];
            this.pushUndo(); this.isDragging = 'prop'; this.dragStartPos = { x: pos.x, y: pos.y };
        } else {
            this.pushUndo(); MapEditorState.markDirty();
            let newProp = { type: 'hitbox', shape: MapEditorState.currentHitboxShape, x: pos.x, y: pos.y };
            if (MapEditorState.currentHitboxShape === 'box') { newProp.w = 30; newProp.h = 30; }
            else { newProp.r = 15; }
            MapEditorState.mapData.props.push(newProp);
            MapEditorState.selectedProps = [newProp];
        }
    },

    handleMouseMove(e) {
        let pos = this.getMousePos(e);
        if (e.shiftKey && this.dragStartPos && (this.isDragging || this.isDraggingRef)) {
            let dx = pos.x - this.dragStartPos.x; let dy = pos.y - this.dragStartPos.y;
            if (Math.abs(dx) > Math.abs(dy)) pos.y = this.dragStartPos.y; else pos.x = this.dragStartPos.x;
        }
        this.mouse = pos;
        if (this.isPanning && this.panStart) {
            MapEditorState.camera.x = this.panStart.camX + (e.clientX - this.panStart.x);
            MapEditorState.camera.y = this.panStart.camY + (e.clientY - this.panStart.y);
            return;
        }
        if (this.isDragging === 'point' && MapEditorState.selectedPoints.length > 0) { MapEditorState.selectedPoints.forEach(p => { p.x = pos.x; p.y = pos.y; }); MapEditorState.markDirty(); }
        else if (this.isDragging === 'curve' && MapEditorState.selectedPoints.length > 0) { MapEditorState.selectedPoints.forEach(p => { if (p.curve) { p.curve.cx = pos.x; p.curve.cy = pos.y; } }); MapEditorState.markDirty(); }
        else if (this.isDragging === 'prop' && MapEditorState.selectedProps.length > 0) { MapEditorState.selectedProps.forEach(p => { p.x = pos.x; p.y = pos.y; }); MapEditorState.markDirty(); }
        else if (this.isDraggingRef) { MapEditorState.refX = pos.x; MapEditorState.refY = pos.y; }
        
        if (this.isDrawingWater && MapEditorState.currentWaterStroke) {
            const lastPt = MapEditorState.currentWaterStroke.points[MapEditorState.currentWaterStroke.points.length - 1];
            if (Math.hypot(pos.x - lastPt.x, pos.y - lastPt.y) > 4) MapEditorState.currentWaterStroke.points.push({x: pos.x, y: pos.y});
        }
        if (this.isErasingWater) {
            this.eraseWaterAt(pos);
        }
    },

    handleMouseUp() {
        if (MapEditorState.currentWaterStroke) { MapEditorState.mapData.waterBrushes.push(MapEditorState.currentWaterStroke); MapEditorState.markDirty(); MapEditorState.currentWaterStroke = null; }
        this.isDragging = false; this.isDrawingWater = false; this.isErasingWater = false; this.isDraggingRef = false; this.isPanning = false; this.dragStartPos = null;
    },

    handleWheel(e) {
        if (MapEditorState.currentTool !== 'reference' && !this.isDragging) {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const screenX = (e.clientX - rect.left) * scaleX;
            const mouseWorldBefore = MapEditorState.screenToWorld(screenX, 0);
            let newZoom = Math.max(0.5, Math.min(4.0, MapEditorState.camera.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
            MapEditorState.camera.x = screenX - mouseWorldBefore.x * newZoom;
            MapEditorState.camera.zoom = newZoom;
            return;
        }
        if (MapEditorState.currentTool === 'reference' && MapEditorState.refImage) { e.preventDefault(); MapEditorState.refScale *= e.deltaY > 0 ? 0.9 : 1.1; }
        if (MapEditorState.currentTool === 'objects' && MapEditorState.selectedProps.length > 0) {
            e.preventDefault();
            MapEditorState.selectedProps.forEach(p => {
                if (p.shape === 'box') {
                    p.w = Math.max(10, (p.w || 30) + (e.deltaY > 0 ? -5 : 5));
                    p.h = Math.max(10, (p.h || 30) + (e.deltaY > 0 ? -5 : 5));
                } else {
                    p.r = Math.max(5, (p.r || 15) + (e.deltaY > 0 ? -2 : 2));
                }
            });
            MapEditorState.markDirty();
        }
    },

    eraseWaterAt(pos) {
        for (let i = MapEditorState.mapData.waterBrushes.length - 1; i >= 0; i--) {
            const brush = MapEditorState.mapData.waterBrushes[i];
            const r = brush.thickness / 2; let hit = false;
            if (brush.points.length === 1) { if (Math.hypot(pos.x - brush.points[0].x, pos.y - brush.points[0].y) < r) hit = true; }
            else { for (let j = 0; j < brush.points.length - 1; j++) { if (Utils.distToSegment(pos.x, pos.y, brush.points[j].x, brush.points[j].y, brush.points[j+1].x, brush.points[j+1].y) < r) { hit = true; break; } } }
            if (hit) { this.pushUndo(); MapEditorState.mapData.waterBrushes.splice(i, 1); MapEditorState.markDirty(); }
        }
    },

    handleKeyDown(e) {
        if (document.getElementById('map-editor-menu').classList.contains('hidden')) return;
        if (e.code === 'Space' && !this.isSpaceDown) { this.isSpaceDown = true; this.canvas.style.cursor = 'grab'; e.preventDefault(); }
        if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.undo(); } 
        else if ((e.key === 'y' || e.key === 'Y') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.redo(); } 
        else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.deleteSelected(); }
        else if (e.key && e.key.startsWith('Arrow')) {
            e.preventDefault();
            let step = e.shiftKey ? 10 : 1; let dx = 0, dy = 0;
            if (e.key === 'ArrowUp') dy = -step; if (e.key === 'ArrowDown') dy = step;
            if (e.key === 'ArrowLeft') dx = -step; if (e.key === 'ArrowRight') dx = step;
            if (MapEditorState.selectedPoints.length > 0 || MapEditorState.selectedProps.length > 0) {
                this.pushUndo(); MapEditorState.markDirty();
                MapEditorState.selectedPoints.forEach(p => { p.x += dx; p.y += dy; });
                MapEditorState.selectedProps.forEach(p => { p.x += dx; p.y += dy; });
            }
        }
    },
    handleKeyUp(e) { if (e.code === 'Space') { this.isSpaceDown = false; this.canvas.style.cursor = 'crosshair'; } }
};
