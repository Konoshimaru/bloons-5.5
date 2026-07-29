import { UI } from './ui.js';
import { Utils } from './utils.js';

export default {
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
        
        // FIX: Lock editing to ONLY the selected path
        if (this.selectedPath === -1 || !this.mapData.paths[this.selectedPath]) {
            UI.log("Select a path from the dropdown first, or click 'New Path'.");
            return;
        }
        
        const path = this.mapData.paths[this.selectedPath];
        if (!path || !Array.isArray(path.waypoints)) return;
        
        // 1. Check for curve point clicks
        for (let i = 0; i < path.waypoints.length; i++) {
            const wp = path.waypoints[i];
            if (!wp) continue;
            if (wp.curve) {
                if (Math.hypot(pos.x - wp.curve.cx, pos.y - wp.curve.cy) < 12) {
                    this.selectedPoint = wp;
                    this.isDragging = 'curve';
                    this.dragStartPos = { x: pos.x, y: pos.y };
                    return;
                }
            }
        }
        
        // 2. Check for waypoint clicks
        for (let i = 0; i < path.waypoints.length; i++) {
            const wp = path.waypoints[i];
            if (!wp) continue;
            if (Math.hypot(pos.x - wp.x, pos.y - wp.y) < 12) {
                this.selectedPoint = wp;
                this.selectedProp = null;
                if (button === 2) { this.pushUndo(); this.insertPoint(wp); } 
                else { 
                    this.pushUndo(); 
                    this.isDragging = 'point'; 
                    this.dragStartPos = { x: pos.x, y: pos.y }; 
                }
                return;
            }
        }
        
        // 3. Add a new point
        this.pushUndo();
        this.selectedPoint = null;
        if (!path.waypoints) path.waypoints = [];
        path.waypoints.push({ x: pos.x, y: pos.y });
        this.selectedPoint = path.waypoints[path.waypoints.length - 1];
    },
    
    handleObjectsMouseDown(pos) {
        if (!this.mapData.props) this.mapData.props = [];
        let clickedProp = null;
        
        for (let i = this.mapData.props.length - 1; i >= 0; i--) {
            const p = this.mapData.props[i];
            if (p.shape === 'box') {
                const w = p.w || 30, h = p.h || 30;
                if (p && Math.abs(pos.x - p.x) < w/2 && Math.abs(pos.y - p.y) < h/2) {
                    clickedProp = p; break;
                }
            } else {
                const r = p.r || 15;
                if (p && Math.hypot(pos.x - p.x, pos.y - p.y) < r) {
                    clickedProp = p; break;
                }
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
            if (this.currentHitboxShape === 'box') {
                this.mapData.props.push({ type: 'hitbox', shape: 'box', x: pos.x, y: pos.y, w: 30, h: 30 });
            } else {
                this.mapData.props.push({ type: 'hitbox', shape: 'circle', x: pos.x, y: pos.y, r: 15 });
            }
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
    
    handleWheel(e) {
        if (this.currentTool === 'reference' && this.refImage) {
            e.preventDefault();
            this.refScale *= e.deltaY > 0 ? 0.9 : 1.1;
        }
        if (this.currentTool === 'objects' && this.selectedProp) {
            e.preventDefault();
            let delta = e.deltaY > 0 ? -5 : 5;
            if (this.selectedProp.shape === 'box') {
                this.selectedProp.w = Math.max(10, (this.selectedProp.w || 30) + delta);
                this.selectedProp.h = Math.max(10, (this.selectedProp.h || 30) + delta);
            } else {
                this.selectedProp.r = Math.max(5, (this.selectedProp.r || 15) + delta);
            }
        }
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
    }
};