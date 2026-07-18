// input.js
import { GameEngine } from './engine.js';

export const InputManager = {
    canvas: null,
    canvasRect: null,

    init(canvas = GameEngine.canvas) {
        if (!canvas) return;
        this.canvas = canvas;
        this._updateCanvasRect();
        
        // PRO FIX: Recompute rect on resize/orientationchange instead of every mousemove
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
        canvas.addEventListener('click', (e) => GameEngine.handleCanvasClick(e));
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            GameEngine.deselectAll();
        });
    },

    _updateMousePosFromClientCoords(clientX, clientY, canvas) {
        // PRO FIX: Use cached rect
        const rect = this.canvasRect || canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        GameEngine.mouse.x = (clientX - rect.left) * scaleX;
        GameEngine.mouse.y = (clientY - rect.top) * scaleY;
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