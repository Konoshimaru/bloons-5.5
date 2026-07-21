// js/mapEditorHistory.js
import { UI } from './ui.js';

export default {
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
    }
};