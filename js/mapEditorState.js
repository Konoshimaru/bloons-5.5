// js/mapEditorState.js
export const MapEditorState = {
    mapData: null,
    selectedPath: -1,
    selectedPoints: [],
    selectedProps: [],
    currentTool: 'track',
    camera: { x: 0, y: 0, zoom: 1.0 },
    isDirty: false,
    snapToGrid: false,
    gridSize: 20,
    pathWidth: 45,
    
    waterEraseMode: false,
    waterBrushSize: 60,
    currentWaterStroke: null, 
    currentHitboxShape: 'circle', 
    
    mouseWorldX: 0,
    mouseWorldY: 0,
    refImage: null,
    refX: 0, refY: 0, refScale: 1,
    bgImage: null,
    bgNightImage: null,
    previewNight: false,

    reset() {
        this.mapData = {
            name: "New Custom Map", paths: [], props: [], waterBrushes: [],
            waterVisible: true, propsVisible: true,
            image: null, imageNight: null, imageScale: 1.0, imageOffsetX: 0, imageOffsetY: 0, imageMaintainRatio: false
        };
        this.selectedPath = -1; this.selectedPoints = []; this.selectedProps = [];
        this.isDirty = false; this.camera = { x: 0, y: 0, zoom: 1.0 };
    },
    markDirty() { this.isDirty = true; },
    markClean() { this.isDirty = false; },
    screenToWorld(screenX, screenY) {
        return { x: (screenX - this.camera.x) / this.camera.zoom, y: (screenY - this.camera.y) / this.camera.zoom };
    }
};