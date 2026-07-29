// js/windowLayout.js
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './config.js';

export const windowLayout = {
    init() {
        this.resizeGame();
        window.addEventListener('resize', () => this.resizeGame());
    },
    
    resizeGame() {
        const container = document.getElementById('game-container');
        const tooSmallOverlay = document.getElementById('screen-too-small-overlay');
        if (!container) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const scale = Math.min(w / CANVAS_WIDTH, h / CANVAS_HEIGHT);
        const MIN_PLAYABLE_SCALE = 0.3; 
        if (scale < MIN_PLAYABLE_SCALE) {
            container.style.visibility = 'hidden';
            tooSmallOverlay?.classList.remove('hidden');
            return;
        }
        container.style.visibility = 'visible';
        tooSmallOverlay?.classList.add('hidden');
        container.style.transformOrigin = 'top left';
        container.style.transform = `scale(${scale})`;
        const scaledWidth = CANVAS_WIDTH * scale;
        const scaledHeight = CANVAS_HEIGHT * scale;
        container.style.position = 'absolute';
        container.style.left = `${(w - scaledWidth) / 2}px`;
        container.style.top = `${(h - scaledHeight) / 2}px`;
    }
};