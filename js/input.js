// js/input.js
import { GameEngine } from './engine.js';

export const InputManager = {
    init() {
        if (!GameEngine.canvas) return;
        
        GameEngine.canvas.addEventListener('mousemove', (e) => {
            const rect = GameEngine.canvas.getBoundingClientRect();
            const scaleX = GameEngine.canvas.width / rect.width;
            const scaleY = GameEngine.canvas.height / rect.height;
            GameEngine.mouse.x = (e.clientX - rect.left) * scaleX;
            GameEngine.mouse.y = (e.clientY - rect.top) * scaleY;
        });
        
        GameEngine.canvas.addEventListener('click', (e) => GameEngine.handleCanvasClick(e));
        GameEngine.canvas.addEventListener('contextmenu', (e) => { 
            e.preventDefault(); 
            GameEngine.deselectAll(); 
        });
        
        window.addEventListener('keydown', (e) => { 
            if (e.key === 'Escape' && GameEngine.gameState === 'playing') GameEngine.pauseGame(); 
            else if (e.key === 'Escape' && GameEngine.gameState === 'paused') GameEngine.resumeGame(); 
        });
    }
};