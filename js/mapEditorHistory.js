// js/mapEditorHistory.js
import { MapEditorState } from './mapEditorState.js';
import { UI } from './ui.js';

export default {
    pushUndo() {
        if (!MapEditorState.mapData) return;
        this.undoStack.push(JSON.parse(JSON.stringify(MapEditorState.mapData)));
        if (this.undoStack.length > 25) this.undoStack.shift();
        this.redoStack = []; 
    },
    undo() {
        if (this.undoStack.length === 0) { UI.log("Nothing to undo."); return; }
        this.redoStack.push(JSON.parse(JSON.stringify(MapEditorState.mapData)));
        MapEditorState.mapData = this.undoStack.pop();
        MapEditorState.selectedPoints = []; MapEditorState.selectedProps = [];
        this.updatePathDropdown();
        UI.log("Undo performed.");
    },
    redo() {
        if (this.redoStack.length === 0) { UI.log("Nothing to redo."); return; }
        this.undoStack.push(JSON.parse(JSON.stringify(MapEditorState.mapData)));
        MapEditorState.mapData = this.redoStack.pop();
        MapEditorState.selectedPoints = []; MapEditorState.selectedProps = [];
        this.updatePathDropdown();
        UI.log("Redo performed.");
    }
};