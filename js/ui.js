// js/ui.js
import { TowerStats } from './towers/index.js';
import { Config } from './config.js';
import { HeroStats } from './heroes/index.js';
import uiTowerPanel from './uiTowerPanel.js';
import { writeThrottled } from './uiWriteThrottle.js';

const elements = {};
function el(id) {
    if (!elements[id]) {
        elements[id] = document.getElementById(id);
    }
    return elements[id];
}

// Every menu overlay closes through the DOM, not a hand-maintained list. The
// old hardcoded MENUS array was the root cause of the recurring "new menu
// won't close" bug: each menu added to index.html also had to be remembered
// here, and one that wasn't (paragons-menu) stayed open forever when any
// toggleMenus() call hid only the registered IDs around it. Every full-screen
// menu uses class="overlay", so query the live DOM — future menus close
// themselves with zero extra wiring.
const SPEED_TEXTS = ["Start Wave", "1x", "2x", "3x", "5x", "10x", "20x"];

export const UI = {
    _towerCardCache: null,
    _prevLives: -1,

    toggleMenus(menuId) {
        let anyOverlayVisible = false;
        document.querySelectorAll('.overlay').forEach(menu => menu.classList.add('hidden'));
        
        const mainUI = el('main-menu-ui');
        
        if (menuId) {
            const target = el(menuId);
            if (target) {
                target.classList.remove('hidden');
                anyOverlayVisible = true;
            }
            
            if (mainUI) {
                if (anyOverlayVisible && menuId !== 'main-menu-ui') {
                    mainUI.classList.add('hidden');
                } else if (menuId === 'main-menu-ui') {
                    mainUI.classList.remove('hidden');
                }
            }
        } else {
            if (mainUI) mainUI.classList.add('hidden');
        }
    },

    showPause() {
        const pauseMenu = el('pause-menu');
        if (pauseMenu) pauseMenu.classList.remove('hidden');
    },

    // Red "-$N" that floats up off the cash counter when a punishment docks
    // the player's cash (knight Cursor Slash, v1.3.2). Multiple simultaneous
    // deductions each get their own floater; all self-remove after the anim.
    showCashDeduction(amount) {
        const cash = el('cash-display');
        const amt = Math.floor(amount);
        if (!cash || !Number.isFinite(amt) || amt <= 0) return;
        const prev = cash.querySelector('.cash-deduction:last-of-type');
        const span = document.createElement('span');
        span.className = 'cash-deduction';
        span.innerText = `-$${amt.toLocaleString('en-US')}`;
        // Stack consecutive floaters so two quick hits don't overlap exactly.
        if (prev) {
            const n = cash.querySelectorAll('.cash-deduction').length;
            span.style.marginTop = `${n * -14}px`;
        }
        cash.appendChild(span);
        setTimeout(() => span.remove(), 1200);
    },

    hidePause() {
        const pauseMenu = el('pause-menu');
        if (pauseMenu) pauseMenu.classList.add('hidden');
    },

    updateMetaStats() {
        const levelEl = el('mm-level-text');
        const xpEl = el('mm-xp-text');
        const expFill = el('mm-exp-fill');
        const mmEl = el('mm-top-right');
        const nameEl = el('mm-player-name'); 
        
        if (nameEl) nameEl.innerText = Config.data.playerName || "Player"; 
        if (levelEl) levelEl.innerText = `Level ${Config.data.playerLevel}`;
        if (xpEl) xpEl.innerText = `${Config.data.playerXP} / ${Config.data.playerXPToNext} XP`;
        if (expFill) expFill.style.width = `${(Config.data.playerXP / Config.data.playerXPToNext) * 100}%`;
        if (mmEl) mmEl.innerText = `🐵 $${Config.data.monkeyMoney}`;

        const barLevel = el('level-bar-level');
        const barFill = el('level-bar-xp-fill');
        const barText = el('level-bar-xp-text');
        if (barLevel) barLevel.innerText = Config.data.playerLevel;
        if (barFill) {
            const pct = Config.data.playerXPToNext > 0
                ? (Config.data.playerXP / Config.data.playerXPToNext) * 100
                : 0;
            barFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
        }
        if (barText) barText.innerText = `${Config.data.playerXP} / ${Config.data.playerXPToNext} XP`;

        const hasSave = !!Config.data.savedRun;
        const continueBtn = el('btn-continue');
        const abandonBtn = el('btn-abandon');
        if (continueBtn) continueBtn.style.display = hasSave ? 'block' : 'none';
        if (abandonBtn) abandonBtn.style.display = hasSave ? 'block' : 'none';
    },

    // Toggles the collapsible bottom-right level panel. Pass an explicit
    // collapsed state, or flip the current one when undefined.
    toggleLevelBar(collapsed) {
        const bar = el('level-bar');
        if (!bar) return;
        const nowCollapsed = collapsed !== undefined ? collapsed : !bar.classList.contains('collapsed');
        bar.classList.toggle('collapsed', nowCollapsed);
        const toggle = el('level-bar-toggle');
        if (toggle) toggle.innerText = nowCollapsed ? '⬇' : '⬆';
    },

    updateWaveSpeedBtn(speedState) {
        const btn = el('wave-speed-btn');
        const sbBtn = el('sb-speed-btn');
        const targets = [btn, sbBtn].filter(Boolean);
        if (targets.length === 0) return;
        
        const text = SPEED_TEXTS[speedState] || "Start Wave";
        const active = speedState > 0;
        
        targets.forEach(b => {
            b.innerText = text;
            b.classList.toggle('speed-active', active);
        });
    },

    hideUpgradePanel() {
        const cards = document.querySelectorAll('.tower-card[data-tower]');
        cards.forEach(c => c.classList.remove('selected'));
        const panel = el('upgrade-sidebar');
        if (panel) panel.classList.add('hidden');

        // The upgrade tooltip is only hidden by `mouseleave`, which never fires
        // when the element under the cursor disappears (sell / deselect /
        // tower destroyed while hovering an upgrade button) — that left a
        // stranded "floating text box" on screen. Always clear it here.
        window._hoveredUpgradePath = null;
        const upgradeTip = el('upgrade-tooltip');
        if (upgradeTip) upgradeTip.classList.remove('show');
        
        const abilityBar = el('ability-bar');
        if (abilityBar) abilityBar.classList.add('hidden');
        
        const cancelBtn = el('cancel-btn');
        if (cancelBtn) cancelBtn.classList.add('hidden');
        
        const sidebar = el('sidebar');
        if (sidebar) sidebar.classList.remove('hidden');
        
        const shopHeader = el('shop-header');
        if (shopHeader) {
            shopHeader.innerText = 'Shop';
            shopHeader.style.fontSize = '22px'; 
        }
    },

    log(msg) {
        const logEl = el('message-log');
        if (logEl) logEl.innerText = msg;
    },

    updateLives(lives) {
        const livesEl = el('lives-display');
        if (livesEl) {
            if (this._prevLives !== -1 && lives < this._prevLives) {
                livesEl.classList.remove('pulse');
                void livesEl.offsetWidth;
                livesEl.classList.add('pulse');
            }
            this._prevLives = lives;
            // v1.4.3: mass-leak waves changed this every frame (one forced
            // layout per leak). The pulse animation above stays immediate;
            // only the number coalesces to 10Hz.
            writeThrottled(livesEl, `Lives: ${lives}`, 100);
        }
    },

    updateWave(wave) {
        // [REGRESSION GUARD | upstream d29d4af] Change-gate: DOM wave text only rewrites on
        // real change — pinned by tests/gitsniperfixes.test.js. DO NOT DELETE.
        if (wave === this._prevWave) return;
        this._prevWave = wave;
        const waveEl = el('wave-display');
        if (waveEl) waveEl.innerText = `Wave ${wave}`;
    },

    updateCash(cash, engine) {
        const cashEl = el('cash-display');
        // v1.4.3: during heavy popping cash changes EVERY frame (one forced
        // layout per frame). 20Hz reads identically to a human; purchases and
        // affordability logic all read engine.cash directly, so nothing can
        // act on a <=50ms-stale display.
        if (cashEl) writeThrottled(cashEl, `$${cash}`, 50);

        if (!this._towerCardCache) {
            this._towerCardCache = document.querySelectorAll('.tower-card[data-tower]');
        }
        
        this._towerCardCache.forEach(card => {
            const stats = TowerStats[card.dataset.tower] || HeroStats[card.dataset.tower];
            if (!stats) return;
            const cost = engine.getCost(stats.cost);
            if (cash < cost) {
                card.classList.add('disabled');
            } else {
                card.classList.remove('disabled');
            }
        });

        if (engine.selectedPlacedTower && !engine.selectedPlacedTower.stats.isHero && !engine.selectedPlacedTower.isMinion) {
            this._updateUpgradeCards(engine.selectedPlacedTower, engine);
        }
    }
};

Object.assign(UI, uiTowerPanel);