// js/main.js
import { GameEngine } from './engine.js';
import { Config, HeroStats, CANVAS_WIDTH, CANVAS_HEIGHT, Difficulties } from './config.js';
import { TowerStats, Upgrades } from './towers/index.js';
import { HeroRegistry } from './heroes/index.js';
import { Maps } from './data.js';
import { AudioEngine } from './audio.js';
import { Enemy } from './enemy.js';
import { Hero } from './hero.js';
import { InputManager } from './input.js';
import { UI } from './ui.js';
import { MapEditor } from './mapEditor.js';
import { MonkeyKnowledge } from './monkeyKnowledge.js';
import { setupShopListeners, setupNudgeLogic, updateShopPrices } from './dragManager.js';
import selectorMenus from './selectorMenus.js';
import settingsMenu from './settingsMenu.js';

export const dom = {
    pauseBtn: document.getElementById('pause-btn'),
    resumeBtn: document.getElementById('resume-btn'),
    pauseSettingsBtn: document.getElementById('pause-settings-btn'),
    quitBtn: document.getElementById('quit-btn'),
    sbPrev: document.getElementById('sb-prev'),
    sbNext: document.getElementById('sb-next'),
    sbSpeedBtn: document.getElementById('sb-speed-btn'),
    sbResetCooldowns: document.getElementById('sb-reset-cooldowns'),
    sbViewToggle: document.getElementById('sb-view-toggle'),
    camoToggleBtn: document.getElementById('sb-toggle-camo'),
    regenToggleBtn: document.getElementById('sb-toggle-regen'),
    fortToggleBtn: document.getElementById('sb-toggle-fortified'),
    enemyCards: document.querySelectorAll('#enemy-view .tower-card[data-enemy]'),
    towerCards: document.querySelectorAll('.tower-card[data-tower]'),
    waveSpeedBtn: document.getElementById('wave-speed-btn'),
    upTargetPrev: document.getElementById('up-target-prev'),
    upTargetNext: document.getElementById('up-target-next'),
    upBuyLevel: document.getElementById('up-buy-level'),
    upPaths: [
        document.getElementById('up-path1'),
        document.getElementById('up-path2'),
        document.getElementById('up-path3')
    ],
    upSell: document.getElementById('up-sell'),
    upCollectBank: document.getElementById('up-collect-bank'),
    cashDisplay: document.getElementById('cash-display'),
    livesDisplay: document.getElementById('lives-display'),
    waveDisplay: document.getElementById('wave-display'),
    cancelBtn: document.getElementById('cancel-btn'),
    btnMonkeys: document.getElementById('btn-monkeys'),
    btnHeroes: document.getElementById('btn-heroes'),
    btnPlay: document.getElementById('btn-play'),
    btnSandbox: document.getElementById('btn-sandbox'),
    btnPowers: document.getElementById('btn-powers'),
    btnKnowledge: document.getElementById('btn-knowledge'),
    mmTopLeft: document.getElementById('mm-top-left'),
    btnSettings: document.getElementById('btn-settings'),
    btnMapEditor: document.getElementById('btn-map-editor'),
    btnContinue: document.getElementById('btn-continue'),
    btnAbandon: document.getElementById('btn-abandon'),
    diffBtns: document.querySelectorAll('.diff-btn[data-diff]'),
    hmPrevBtn: document.getElementById('hm-prev-btn'),
    hmNextBtn: document.getElementById('hm-next-btn'),
    heroSelector: document.getElementById('hero-selector'),
    settingsBackBtn: document.getElementById('settings-back-btn'),
    goMenuBtn: document.getElementById('go-menu-btn'),
    backBtns: document.querySelectorAll('.back-btn[data-target]'),
    volumeSlider: document.getElementById('volume-slider'),
    volDisplay: document.getElementById('vol-display'),
    musicSlider: document.getElementById('music-slider'),
    musicVolDisplay: document.getElementById('music-vol-display'),
    bgRunCheckbox: document.getElementById('bg-run-checkbox'),
    autoWaveMenu: document.getElementById('auto-wave-checkbox-menu'),
    autoWavePause: document.getElementById('auto-wave-checkbox-pause'),
    flavorTextCheckbox: document.getElementById('flavor-text-checkbox'),
    smoothingCheckbox: document.getElementById('smoothing-checkbox'),
    fpsCheckbox: document.getElementById('fps-checkbox'),
    fpsDisplay: document.getElementById('fps-display'),
    extremeSpeedCheckbox: document.getElementById('extreme-speed-checkbox'),
    shuffleMusicCheckbox: document.getElementById('shuffle-music-checkbox'),
    randomStartCheckbox: document.getElementById('random-start-checkbox'),
    showStatsCheckbox: document.getElementById('show-stats-checkbox'),
    uncapFpsCheckbox: document.getElementById('uncap-fps-checkbox'),
    prevSongBtn: document.getElementById('prev-song-btn'),
    nextSongBtn: document.getElementById('next-song-btn'),
    pausePrevSong: document.getElementById('pause-prev-song'),
    pauseNextSong: document.getElementById('pause-next-song')
};

export const Main = {};
Object.assign(Main, selectorMenus);
Object.assign(Main, settingsMenu);

// FIX: Unified Play Menu State
Main.playMenuState = {
    selectedMapIndex: 0,
    page: 0,
    mapsPerPage: 6
};

// FIX: Profile UI Update Logic
Main.updateProfileUI = function() {
    const stats = Config.data.stats || { gamesPlayed: 0, highestRound: 0, totalPops: 0 };
    const profileStats = document.getElementById('profile-stats');
    const nameInput = document.getElementById('profile-name-input');
    
    if (nameInput) nameInput.value = Config.data.playerName || "";
    
    if (profileStats) {
        profileStats.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #7f8c8d; padding-bottom: 5px;">
                <span>Level:</span> <span style="color: var(--gold);">${Config.data.playerLevel}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Monkey Money:</span> <span style="color: var(--gold);">$${Config.data.monkeyMoney}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Games Played:</span> <span>${stats.gamesPlayed}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Highest Round:</span> <span>${stats.highestRound}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Total Bloons Popped:</span> <span>${stats.totalPops}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Towers Unlocked:</span> <span>${Config.data.unlockedTowers.length}</span>
            </div>
        `;
    }
};

// FIX: Monkeys Encyclopedia Menu Logic
Main.updateMonkeysMenu = function() {
    const list = document.getElementById('mm-tower-list');
    if (!list) return;
    list.innerHTML = '';
    
    const categories = {
        'Primary': ['dart', 'boomerang', 'bomb', 'tack', 'ice', 'glue', 'desperado'],
        'Military': ['sniper', 'sub', 'buccaneer', 'ace', 'heli', 'mortar', 'dartling'],
        'Magic': ['wizard', 'super', 'ninja', 'alchemist', 'druid', 'mermonkey'],
        'Support': ['farm', 'spike', 'village', 'engineer', 'beast', 'farmer']
    };

    for (const [cat, types] of Object.entries(categories)) {
        const header = document.createElement('div');
        header.className = 'mm-cat-header';
        header.innerText = cat;
        list.appendChild(header);

        types.forEach(type => {
            const stats = TowerStats[type];
            if (!stats) return;
            
            const btn = document.createElement('div');
            btn.className = 'mm-tower-btn';
            btn.dataset.tower = type;
            btn.innerHTML = `
                <div class="mm-tower-icon" style="background-image: url('sprites/portraits/${type}_menuportrait.png');"></div>
                <span>${stats.name}</span>
            `;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mm-tower-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectMonkey(type);
            });
            list.appendChild(btn);
        });
    }
};

Main.selectMonkey = function(type) {
    const stats = TowerStats[type];
    const upgrades = Upgrades[type];
    if (!stats || !upgrades) return;

    const info = document.getElementById('mm-tower-info');
    let html = `
        <div class="mm-header">
            <div class="mm-portrait" style="background-image: url('sprites/portraits/${type}_menuportrait.png');"></div>
            <div class="mm-header-info">
                <h3>${stats.name}</h3>
                <p>${stats.desc || ''}</p>
            </div>
        </div>
        <div class="mm-stats-grid">
            <div class="mm-stat-box"><span>Cost</span><strong>$${stats.cost}</strong></div>
            <div class="mm-stat-box"><span>Damage</span><strong>${stats.damage || 0}</strong></div>
            <div class="mm-stat-box"><span>Range</span><strong>${stats.range || 0}</strong></div>
            <div class="mm-stat-box"><span>Pierce</span><strong>${stats.pierce || 0}</strong></div>
        </div>
        <div class="mm-paths-container">
    `;

    for (let p = 1; p <= 3; p++) {
        html += `<div class="mm-path-col">`;
        for (let t = 0; t < 5; t++) {
            const upg = upgrades[p][t];
            if (upg) {
                html += `
                    <div class="mm-upg-card">
                        <h4>${upg.name}</h4>
                        <span class="mm-upg-cost">$${upg.cost}</span>
                        <p>${upg.desc || ''}</p>
                    </div>
                `;
            }
        }
        html += `</div>`;
    }

    html += `</div>`;
    info.innerHTML = html;
    info.scrollTop = 0;
};

// FIX: Unified Play Menu Logic
Main.refreshPlayMaps = function() {
    const grid = document.getElementById('play-map-grid');
    const pageEl = document.getElementById('play-map-page');
    if (!grid) return;
    
    grid.innerHTML = '';
    const totalPages = Math.ceil(Maps.length / this.playMenuState.mapsPerPage);
    if (this.playMenuState.page >= totalPages) this.playMenuState.page = totalPages - 1;
    if (this.playMenuState.page < 0) this.playMenuState.page = 0;
    
    const start = this.playMenuState.page * this.playMenuState.mapsPerPage;
    const end = start + this.playMenuState.mapsPerPage;
    const mapsToShow = Maps.slice(start, end);

    mapsToShow.forEach((map, index) => {
        const actualIndex = start + index;
        const card = document.createElement('div');
        card.className = 'play-map-card';
        if (actualIndex === this.playMenuState.selectedMapIndex) card.classList.add('selected');
        
        let thumbUrl = map.bgImage ? `sprites/maps/${map.bgImage}` : '';
        card.innerHTML = `
            <div class="play-map-thumb" style="background-image: url('${thumbUrl}');"></div>
            <div class="play-map-name">${map.name || `Map ${actualIndex + 1}`}</div>
        `;
        
        card.addEventListener('click', () => {
            this.playMenuState.selectedMapIndex = actualIndex;
            this.showPlayDifficulties();
        });
        grid.appendChild(card);
    });

    if (pageEl) pageEl.innerText = `Page ${this.playMenuState.page + 1} / ${totalPages}`;
};

Main.showPlayDifficulties = function() {
    document.getElementById('play-menu-title').innerText = Maps[this.playMenuState.selectedMapIndex].name || "Select Difficulty";
    document.getElementById('play-map-view').classList.add('hidden');
    document.getElementById('play-difficulty-view').classList.remove('hidden');
    
    const grid = document.getElementById('play-difficulty-grid');
    grid.innerHTML = '';

    const categories = {
        'Easy': ['easy'],
        'Medium': ['medium'],
        'Hard': ['hard', 'impoppable', 'chimps'],
        'Post CHIMPS': ['postchimps']
    };

    for (const [cat, keys] of Object.entries(categories)) {
        const catDiv = document.createElement('div');
        catDiv.className = 'play-diff-category';
        catDiv.innerHTML = `<div class="play-diff-header">${cat}</div>`;

        keys.forEach(key => {
            const diff = Difficulties[key];
            if (!diff) return;
            
            const btn = document.createElement('button');
            btn.className = 'play-diff-btn';
            btn.innerHTML = `<b>${diff.name}</b><br><span style="font-size:12px; color:#bdc3c7;">${diff.lives} Lives | $${diff.cash} Cash</span>`;
            btn.addEventListener('click', () => {
                Config.data.currentDifficulty = key;
                GameEngine.currentMap = this.playMenuState.selectedMapIndex;
                Config.data.currentMap = this.playMenuState.selectedMapIndex;
                Config.save();
                startGameUI(false);
            });
            catDiv.appendChild(btn);
        });
        grid.appendChild(catDiv);
    }
};

Main.showPlayMaps = function() {
    document.getElementById('play-menu-title').innerText = "Select a Map";
    document.getElementById('play-map-view').classList.remove('hidden');
    document.getElementById('play-difficulty-view').classList.add('hidden');
    this.refreshPlayMaps();
};

window.addEventListener('error', (e) => {
    const errMsg = document.getElementById('error-message');
    if (errMsg) {
        errMsg.innerText = `Game Error: ${e.message}. Check console (F12) for details.`;
        errMsg.classList.remove('hidden');
    }
    console.error("Game Error:", e);
});

function resizeGame() {
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
window.addEventListener('resize', resizeGame);

function showMainMenuUI(show) {
    const ui = document.getElementById('main-menu-ui');
    if (show) {
        ui.classList.remove('hidden');
        UI.updateMetaStats();
    } else {
        ui.classList.add('hidden');
    }
}

function applyConfigToUI() {
    if (dom.shuffleMusicCheckbox) dom.shuffleMusicCheckbox.checked = Config.data.musicShuffle;
    if (dom.randomStartCheckbox) dom.randomStartCheckbox.checked = Config.data.musicRandomStart;
    if (dom.volumeSlider) dom.volumeSlider.value = Config.data.sfxVolume * 100;
    if (dom.volDisplay) dom.volDisplay.innerText = Math.round(Config.data.sfxVolume * 100) + '%';
    if (dom.musicSlider) dom.musicSlider.value = Config.data.musicVolume * 100;
    if (dom.musicVolDisplay) dom.musicVolDisplay.innerText = Math.round(Config.data.musicVolume * 100) + '%';
    if (dom.bgRunCheckbox) dom.bgRunCheckbox.checked = Config.data.runInBackground;
    if (dom.autoWaveMenu) dom.autoWaveMenu.checked = Config.data.autoStart;
    if (dom.autoWavePause) dom.autoWavePause.checked = Config.data.autoStart;
    if (dom.flavorTextCheckbox) dom.flavorTextCheckbox.checked = Config.data.showFlavor;
    if (dom.smoothingCheckbox) dom.smoothingCheckbox.checked = Config.data.smoothingEnabled;
    if (dom.fpsCheckbox) dom.fpsCheckbox.checked = Config.data.showFps;
    if (dom.fpsDisplay) dom.fpsDisplay.style.display = Config.data.showFps ? 'block' : 'none';
    if (dom.extremeSpeedCheckbox) dom.extremeSpeedCheckbox.checked = Config.data.extremeSpeedEnabled;
    if (dom.showStatsCheckbox) dom.showStatsCheckbox.checked = Config.data.showTowerStats;
    if (dom.uncapFpsCheckbox) dom.uncapFpsCheckbox.checked = Config.data.uncapFps;
    Main.refreshMapSelector();
    Main.refreshHeroSelector();
    Main.updateHeroShopCard();
    Main.updateShopUI();
    showMainMenuUI(true);
}

async function startGameUI(isSandbox) {
    showMainMenuUI(false);
    UI.toggleMenus(null);
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('top-ui-left').classList.remove('hidden');
    document.getElementById('top-ui-right').classList.remove('hidden');
    const sandboxControls = document.getElementById('sandbox-controls');
    const normControls = document.getElementById('norm-controls');
    if (isSandbox) {
        sandboxControls.classList.remove('hidden');
        normControls.classList.add('hidden');
    } else {
        sandboxControls.classList.add('hidden');
        normControls.classList.remove('hidden');
    }
    document.getElementById('shop-view').classList.remove('hidden');
    document.getElementById('enemy-view').classList.add('hidden');
    if (dom.sbViewToggle) dom.sbViewToggle.innerText = '🎈 Spawn Bloons';
    try {
        GameEngine.startGame(isSandbox);
        updateShopPrices();
        await AudioEngine.init();
        AudioEngine.playGameMusic();
    } catch (err) {
        console.error("Failed to start game:", err);
        GameEngine.gameState = 'gameover';
        UI.toggleMenus('game-over-menu');
        document.getElementById('go-wave-stat').innerText = `Game Crash: ${err.message}. Check console (F12).`;
    }
}

function _setupMenuListeners() {
    dom.btnSandbox?.addEventListener('click', () => startGameUI(true)); 
    dom.btnHeroes?.addEventListener('click', () => UI.toggleMenus('hero-select-menu'));
    dom.btnPowers?.addEventListener('click', () => UI.toggleMenus('powers-menu'));
    dom.btnKnowledge?.addEventListener('click', () => UI.toggleMenus('knowledge-menu'));
    
    // FIX: Unified Play Menu Listeners
    dom.btnPlay?.addEventListener('click', () => { 
        Main.playMenuState.selectedMapIndex = Config.data.currentMap;
        Main.showPlayMaps(); 
        UI.toggleMenus('play-menu'); 
    });
    
    document.getElementById('play-prev-maps')?.addEventListener('click', () => {
        Main.playMenuState.page--;
        Main.refreshPlayMaps();
    });
    document.getElementById('play-next-maps')?.addEventListener('click', () => {
        Main.playMenuState.page++;
        Main.refreshPlayMaps();
    });
    document.getElementById('play-back-btn')?.addEventListener('click', () => {
        const diffView = document.getElementById('play-difficulty-view');
        if (!diffView.classList.contains('hidden')) {
            Main.showPlayMaps();
        } else {
            UI.toggleMenus('main-menu-ui');
        }
    });

    dom.btnMonkeys?.addEventListener('click', () => { Main.updateMonkeysMenu(); UI.toggleMenus('monkeys-menu'); });
    dom.mmTopLeft?.addEventListener('click', () => { Main.updateProfileUI(); UI.toggleMenus('profile-menu'); });
    
    document.getElementById('profile-save-name')?.addEventListener('click', () => {
        const nameInput = document.getElementById('profile-name-input');
        if (nameInput) {
            Config.data.playerName = nameInput.value.trim().substring(0, 20);
            Config.save();
            UI.updateMetaStats();
            Main.updateProfileUI();
        }
    });

    dom.btnSettings?.addEventListener('click', () => { GameEngine.lastMenu = 'main-menu-ui'; UI.toggleMenus('settings-menu'); });
    dom.btnMapEditor?.addEventListener('click', () => { MapEditor.init(); UI.toggleMenus('map-editor-menu'); });
    dom.btnContinue?.addEventListener('click', () => {
        if (GameEngine.loadGame()) {
            startGameUI(false);
        }
    });
    dom.btnAbandon?.addEventListener('click', () => GameEngine.abandonRun());
    
    dom.backBtns.forEach(btn => btn.addEventListener('click', (e) => UI.toggleMenus(e.target.dataset.target)));
    dom.settingsBackBtn?.addEventListener('click', () => UI.toggleMenus(GameEngine.lastMenu));
    dom.goMenuBtn?.addEventListener('click', () => {
        UI.toggleMenus(null);
        GameEngine.deselectAll();
        GameEngine.gameState = 'menu';
        GameEngine.map = null;
        showMainMenuUI(true);
        document.getElementById('sidebar').classList.add('hidden');
        document.getElementById('top-ui-left').classList.add('hidden');
        document.getElementById('top-ui-right').classList.add('hidden');
        AudioEngine.playMenuMusic();
        Main.updateShopUI();
    });
    dom.hmPrevBtn?.addEventListener('click', () => dom.heroSelector?.scrollBy({ left: -300, behavior: 'smooth' }));
    dom.hmNextBtn?.addEventListener('click', () => dom.heroSelector?.scrollBy({ left: 300, behavior: 'smooth' }));
    document.querySelectorAll('.shop-item').forEach(item => {
        item.addEventListener('click', () => {
            const unlockKey = item.dataset.unlock;
            const cost = parseInt(item.dataset.cost);
            if (Config.data.unlocks[unlockKey]) {
                alert("Already purchased!");
                return;
            }
            if (Config.data.monkeyMoney >= cost) {
                Config.data.monkeyMoney -= cost;
                Config.data.unlocks[unlockKey] = true;
                Config.save();
                UI.updateMetaStats();
                Main.updateShopUI();
            } else {
                alert("Not enough Monkey Money!");
            }
        });
    });
}

function _setupGameListeners() {
    dom.pauseBtn?.addEventListener('click', () => GameEngine.pauseGame());
    dom.resumeBtn?.addEventListener('click', () => GameEngine.resumeGame());
    dom.pauseSettingsBtn?.addEventListener('click', () => { GameEngine.lastMenu = 'pause-menu'; UI.toggleMenus('settings-menu'); });
    dom.quitBtn?.addEventListener('click', () => {
        GameEngine.deselectAll();
        GameEngine.saveGame();
        GameEngine.gameState = 'menu';
        GameEngine.map = null; 
        UI.toggleMenus(null);
        showMainMenuUI(true);
        document.getElementById('sidebar').classList.add('hidden');
        document.getElementById('top-ui-left').classList.add('hidden');
        document.getElementById('top-ui-right').classList.add('hidden');
        AudioEngine.playMenuMusic();
        Main.updateShopUI();
    });
    dom.sbPrev?.addEventListener('click', () => GameEngine.skipWave(-1));
    dom.sbNext?.addEventListener('click', () => GameEngine.skipWave(1));
    dom.waveSpeedBtn?.addEventListener('click', () => GameEngine.handleWaveSpeedClick(1));
    dom.sbSpeedBtn?.addEventListener('click', () => GameEngine.handleWaveSpeedClick(1));
    const handleSpeedRightClick = (e) => {
        e.preventDefault();
        GameEngine.handleWaveSpeedClick(-1);
    };
    dom.waveSpeedBtn?.addEventListener('contextmenu', handleSpeedRightClick);
    dom.sbSpeedBtn?.addEventListener('contextmenu', handleSpeedRightClick);
    dom.sbResetCooldowns?.addEventListener('click', () => {
        if (!GameEngine.isSandbox) return;
        GameEngine.towers.forEach(t => {
            if (!t) return;
            t.abilityCooldown = 0;
            t.ability2Cooldown = 0;
            t.ability3Cooldown = 0;
        });
        GameEngine.log("Ability cooldowns reset!");
        UI.updateAbilityBar(GameEngine);
    });
    dom.cashDisplay?.addEventListener('click', () => {
        if (!GameEngine.isSandbox) return;
        const val = prompt("Set Cash Amount:", GameEngine.cash);
        if (val !== null && !isNaN(val)) { GameEngine.cash = Math.max(0, parseInt(val)); GameEngine.updateUI(); }
    });
    dom.livesDisplay?.addEventListener('click', () => {
        if (!GameEngine.isSandbox) return;
        const val = prompt("Set Lives Amount:", GameEngine.lives);
        if (val !== null && !isNaN(val)) { GameEngine.lives = Math.max(0, parseInt(val)); GameEngine.updateUI(); }
    });
    dom.waveDisplay?.addEventListener('click', () => {
        if (!GameEngine.isSandbox) return;
        const val = prompt("Set Round:", GameEngine.waveManager.currentWave);
        if (val !== null && !isNaN(val)) {
            GameEngine.waveManager.currentWave = Math.max(1, parseInt(val));
            GameEngine.updateUI();
        }
    });
    dom.cancelBtn?.addEventListener('click', () => GameEngine.deselectAll());
    dom.upTargetPrev?.addEventListener('click', () => GameEngine.cycleTargeting(-1));
    dom.upTargetNext?.addEventListener('click', () => GameEngine.cycleTargeting(1));
}

function setupEventListeners() {
    _setupMenuListeners();
    Main._setupSettingsListeners();
    _setupGameListeners();
    setupShopListeners(); 
    setupNudgeLogic(); 
    InputManager.init();
    GameEngine.updateShopPrices = updateShopPrices;
}

window.addEventListener('load', () => {
    GameEngine.init();
    setupEventListeners();
    applyConfigToUI();
    resizeGame();
    document.getElementById('main-menu-ui').classList.remove('hidden');
    AudioEngine.init().then(() => AudioEngine.playMenuMusic());
    MonkeyKnowledge.init(); 
});