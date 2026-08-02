// js/mobile.js
import { GameEngine } from './engine.js';

export const isMobile = {
    Android: function() { return navigator.userAgent.match(/Android/i); },
    iOS: function() { return navigator.userAgent.match(/iPhone|iPad|iPod/i); },
    Opera: function() { return navigator.userAgent.match(/Opera Mini/i); },
    Windows: function() { return navigator.userAgent.match(/IEMobile/i); },
    any: function() {
        const isMacTouch = navigator.userAgent.match(/Macintosh/i) && (navigator.maxTouchPoints > 1);
        return (this.Android() || this.iOS() || this.Opera() || this.Windows() || isMacTouch);
    }
};

export const MobileManager = {
    isActive: false,
    spriteScale: 1.0,
    
    init() {
        if (!isMobile.any()) return;
        this.toggle(true);
    },

    toggle(forceState) {
        this.isActive = (forceState !== undefined) ? forceState : !this.isActive;
        
        if (this.isActive) {
            console.log("Mobile Mode Activated.");
            this.spriteScale = 1.2;
            document.body.classList.add('mobile-mode');
            this._injectCSS();
            this._setupTouch();
        } else {
            console.log("Mobile Mode Deactivated.");
            this.spriteScale = 1.0;
            document.body.classList.remove('mobile-mode');
            this._removeCSS();
            this._removeTouch();
        }
    },

    _injectCSS() {
        if (document.getElementById('mobile-ui-overrides')) return;
        const mobileCSS = document.createElement('style');
        mobileCSS.id = 'mobile-ui-overrides';
        mobileCSS.innerHTML = `
            /* --- TOP UI SCALING --- */
            .mobile-mode #top-ui-left, .mobile-mode #top-ui-right {
                top: 15px; gap: 15px;
            }
            .mobile-mode #lives-display, .mobile-mode #cash-display, .mobile-mode #wave-display, .mobile-mode #pause-btn {
                padding: 12px 20px; font-size: 24px; border-radius: 10px; border-width: 2px;
            }
            .mobile-mode #fps-display {
                padding: 8px 15px; font-size: 18px;
            }

            /* --- ABILITY BAR SCALING --- */
            .mobile-mode #ability-bar {
                bottom: 20px; left: 20px; gap: 15px;
            }
            .mobile-mode .ability-icon {
                width: 70px; height: 70px; border-radius: 12px; border-width: 3px; font-size: 14px;
            }
            .mobile-mode .cooldown-overlay {
                font-size: 24px;
            }

            /* --- SHOP SIDEBAR SCALING --- */
            .mobile-mode #shop-header {
                font-size: 28px; padding: 15px 0;
            }
            .mobile-mode .sidebar-scroll {
                padding: 10px;
            }
            .mobile-mode .tower-shop {
                grid-template-columns: repeat(2, 1fr); gap: 10px;
            }
            .mobile-mode .tower-card {
                border-radius: 10px; border-width: 3px;
            }
            .mobile-mode .tower-card .cost {
                font-size: 16px; padding: 4px 0; font-weight: 900;
            }
            .mobile-mode .sidebar-bottom button {
                padding: 12px; font-size: 20px; border-radius: 8px; margin-bottom: 8px;
            }
            .mobile-mode #message-log {
                font-size: 16px; padding: 8px;
            }

            /* --- UPGRADE PANEL SCALING --- */
            .mobile-mode #upgrade-sidebar {
                width: 280px; padding: 15px; border-radius: 10px; gap: 12px;
            }
            .mobile-mode #up-title { font-size: 28px; }
            .mobile-mode #up-counters { font-size: 18px; }
            .mobile-mode #up-portrait { width: 130px; height: 130px; }
            .mobile-mode .up-card { padding: 12px; border-radius: 8px; }
            .mobile-mode .up-card-info .up-name { font-size: 18px; }
            .mobile-mode .up-card-info .cost { font-size: 16px; }
            .mobile-mode .tier-box { width: 18px; height: 18px; }
            .mobile-mode #up-sell, .mobile-mode #up-collect-bank, .mobile-mode #up-buy-level {
                padding: 12px; font-size: 18px; border-radius: 8px;
            }
            .mobile-mode .up-targeting-row button { font-size: 22px; padding: 8px; }
            .mobile-mode #up-target-text { font-size: 18px; }

            /* --- CANCEL BUTTON --- */
            .mobile-mode #cancel-btn {
                width: 70px; height: 70px; font-size: 28px; bottom: 30px;
            }

            /* --- TOUCH SCROLLING FIXES --- */
            /* FIX: Prevent browser scrolling/zooming ONLY on the canvas so aiming works */
            .mobile-mode #gameCanvas {
                touch-action: none !important;
            }
            /* FIX: Allow native vertical scrolling in the shop and menus */
            .mobile-mode #sidebar, .mobile-mode .sidebar-scroll,
            .mobile-mode .menu-content, .mobile-mode .editor-sidebar {
                touch-action: pan-y !important;
                -webkit-overflow-scrolling: touch;
            }
        `;
        document.head.appendChild(mobileCSS);
    },

    _removeCSS() {
        const css = document.getElementById('mobile-ui-overrides');
        if (css) css.remove();
    },

    _setupTouch() {
        const canvas = GameEngine.canvas;
        if (!canvas) return;

        this._touchStart = (e) => {
            e.preventDefault();
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                this._updateMousePos(touch);
                const mockEvent = { clientX: touch.clientX, clientY: touch.clientY, button: 0, preventDefault: () => {} };
                if (GameEngine._onCanvasMouseDown) GameEngine._onCanvasMouseDown(mockEvent);
            }
        };

        this._touchMove = (e) => {
            e.preventDefault();
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                this._updateMousePos(touch);
            }
        };

        this._touchEnd = (e) => {
            e.preventDefault();
            const mockEvent = { clientX: GameEngine.mouse.rawX, clientY: GameEngine.mouse.rawY, button: 0, preventDefault: () => {} };
            if (GameEngine._onCanvasMouseUp) GameEngine._onCanvasMouseUp(mockEvent);
        };

        canvas.addEventListener('touchstart', this._touchStart, { passive: false });
        canvas.addEventListener('touchmove', this._touchMove, { passive: false });
        canvas.addEventListener('touchend', this._touchEnd, { passive: false });
    },

    _removeTouch() {
        const canvas = GameEngine.canvas;
        if (!canvas) return;
        canvas.removeEventListener('touchstart', this._touchStart);
        canvas.removeEventListener('touchmove', this._touchMove);
        canvas.removeEventListener('touchend', this._touchEnd);
    },

    _updateMousePos(touch) {
        const rect = GameEngine.canvas.getBoundingClientRect();
        const scaleX = GameEngine.canvas.width / rect.width;
        const scaleY = GameEngine.canvas.height / rect.height;
        
        let mx = (touch.clientX - rect.left) * scaleX;
        let my = (touch.clientY - rect.top) * scaleY;
        
        GameEngine.mouse.rawX = mx;
        GameEngine.mouse.rawY = my;
        GameEngine.mouse.x = mx;
        GameEngine.mouse.y = my;
    }
};

window.toggleMobile = function() {
    MobileManager.toggle();
    console.log(`Mobile Mode is now ${MobileManager.isActive ? 'ON' : 'OFF'}`);
};
