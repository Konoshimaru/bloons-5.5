import { GameEngine } from './engine.js';

export const InputManager = {
    init(canvas = GameEngine.canvas) {
        if (!canvas) return;
        
        this._setupMouseEvents(canvas);
        this._setupKeyboardEvents();
    },

    _setupMouseEvents(canvas) {
        canvas.addEventListener('mousemove', (e) => this._handleMouseMove(e, canvas));
        canvas.addEventListener('click', (e) => GameEngine.handleCanvasClick(e));
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            GameEngine.deselectAll();
        });
    },

    _handleMouseMove(e, canvas) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        GameEngine.mouse.x = (e.clientX - rect.left) * scaleX;
        GameEngine.mouse.y = (e.clientY - rect.top) * scaleY;
    },

    _setupKeyboardEvents() {
        window.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;

            if (GameEngine.gameState === 'playing') {
                GameEngine.pauseGame();
            } else if (GameEngine.gameState === 'paused') {
                GameEngine.resumeGame();
            }
        });
    }
};