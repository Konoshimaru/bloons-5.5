// js/input.js
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
        canvas.addEventListener('click', (e) => {
            GameEngine.handleCanvasClick(e);
        });

        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            GameEngine.deselectAll();
        });
    },

    _updateMousePosFromClientCoords(clientX, clientY, canvas) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let mx = (clientX - rect.left) * scaleX;
        let my = (clientY - rect.top) * scaleY;

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
            GameEngine.handleCanvasClick(touch);
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

export function applyBossEffects(rawX, rawY) {
    const boss = GameEngine.enemies.find(e => e.tier === 99); 
    if (!boss) {
        return { x: rawX, y: rawY };
    }

    // 1. Full Freeze (2 seconds)
    if (boss.freezeMouse) {
        return { x: boss.freezeX, y: boss.freezeY };
    }

    // 2. Portal Offset: NO LOGICAL COMPENSATION!
    // By returning rawX, the tower is placed exactly where you click.
    // The visual shift in renderer.js will handle the teleport illusion.
    return { x: rawX, y: rawY };
}