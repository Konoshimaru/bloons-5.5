// input.js
import { GameEngine } from './engine.js';

export const InputManager = {
    canvas: null,
    canvasRect: null, // Kept for compatibility, but we fetch live now

    init(canvas = GameEngine.canvas) {
        if (!canvas) return;
        this.canvas = canvas;
        this._updateCanvasRect();
        
        window.addEventListener('resize', () => this._updateCanvasRect());
        window.addEventListener('orientationchange', () => this._updateCanvasRect());
        
        this._setupMouseEvents(canvas);
        this._setupTouchEvents(canvas);
        this._setupKeyboardEvents();
    },

    _updateCanvasRect() {
        if (this.canvas) {
            this.canvasRect = this.canvas.getBoundingClientRect();
        }
    },

    _setupMouseEvents(canvas) {
        canvas.addEventListener('mousemove', (e) => this._updateMousePosFromClientCoords(e.clientX, e.clientY, canvas));
        
        // FIX: Adjust clientX/Y before passing to handleCanvasClick to prevent cursor snapping and offset bugs
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            let mx = (e.clientX - rect.left) * scaleX;
            let my = (e.clientY - rect.top) * scaleY;
            const adj = applyBossEffects(mx, my);
            const fakeClientX = rect.left + (adj.x / scaleX);
            const fakeClientY = rect.top + (adj.y / scaleY);
            GameEngine.handleCanvasClick({ clientX: fakeClientX, clientY: fakeClientY });
        });

        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            GameEngine.deselectAll();
        });
    },

    _updateMousePosFromClientCoords(clientX, clientY, canvas) {
        // FIX: Fetch rect live to prevent 20px drift when scrollbars appear or layout shifts
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let mx = (clientX - rect.left) * scaleX;
        let my = (clientY - rect.top) * scaleY;

        // FIX: Store raw coordinates for drawing the visual cursor accurately
        GameEngine.mouse.rawX = mx;
        GameEngine.mouse.rawY = my;

        const adj = applyBossEffects(mx, my);
        GameEngine.mouse.x = adj.x;
        GameEngine.mouse.y = adj.y;
    },

    _setupTouchEvents(canvas) {
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length > 1) return;
            const touch = e.touches[0];
            this._updateMousePosFromClientCoords(touch.clientX, touch.clientY, canvas);
            GameEngine.handleCanvasClick({ clientX: touch.clientX, clientY: touch.clientY });
        }, { passive: false });
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length > 1) return;
            const touch = e.touches[0];
            this._updateMousePosFromClientCoords(touch.clientX, touch.clientY, canvas);
        }, { passive: false });
    },

    _setupKeyboardEvents() {
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            if (e.code === 'Space') {
                e.preventDefault();
                if (GameEngine.gameState === 'playing') {
                    GameEngine.handleWaveSpeedClick(1);
                }
                return;
            }
            
            if (e.key !== 'Escape') return;
            if (GameEngine.gameState === 'playing') GameEngine.pauseGame();
            else if (GameEngine.gameState === 'paused') GameEngine.resumeGame();
        });
    }
};

// Central function to apply boss mouse kidnapping effects
export function applyBossEffects(rawX, rawY) {
    const boss = GameEngine.enemies.find(e => e.tier === 99); // KnightEnemy is tier 99
    if (!boss) {
        return { x: rawX, y: rawY };
    }

    // 1. Full Freeze (2 seconds)
    if (boss.freezeMouse) {
        return { x: boss.freezeX, y: boss.freezeY };
    }

    let x = rawX;
    let y = rawY;

    // 2. Portal Offset
    if (boss.screenSplitActive || boss.currentOffset !== 0) {
        // FIX: If the visual screen shifts right (+offset), the logical coordinate must shift left (-offset) 
        // to place the tower at the correct logical position on the map.
        if (y < 360) {
            x -= boss.currentOffset;
        } else {
            x += boss.currentOffset;
        }
    }

    return { x, y };
}