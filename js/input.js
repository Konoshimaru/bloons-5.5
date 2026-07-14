import { GameEngine } from './engine.js';
export const InputManager = {
    init(canvas = GameEngine.canvas) {
        if (!canvas) return;
        this._setupMouseEvents(canvas);
        this._setupTouchEvents(canvas);
        this._setupKeyboardEvents();
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
        const rect = canvas.getBoundingClientRect();
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