// input.js
// Handles mouse and keyboard input for the game UI and controls.

import { GameEngine } from './engine.js';

// InputManager translates mouse and keyboard actions into game commands.
export const InputManager = {
    init(canvas = GameEngine.canvas) {
        if (!canvas) return;
        
        // Register mouse and keyboard handlers once so input is always routed to the engine.
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
        // The canvas uses its own coordinate system, so mouse movement has to be mapped from screen space to game space.
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        GameEngine.mouse.x = (e.clientX - rect.left) * scaleX;
        GameEngine.mouse.y = (e.clientY - rect.top) * scaleY;
    },

    _setupKeyboardEvents() {
        // Escape is used as the pause/resume shortcut while the game is running.
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
