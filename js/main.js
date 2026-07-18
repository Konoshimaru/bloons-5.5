import { GameEngine } from './engine.js';
import { Config, HeroStats, CANVAS_WIDTH, CANVAS_HEIGHT } from './config.js';
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

const dom = {
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
    btnSettings: document.getElementById('btn-settings'),
    btnMapEditor: document.getElementById('btn-map-editor'),
    btnContinue: document.getElementById('btn-continue'),
    btnAbandon: document.getElementById('btn-abandon'),
    btnMaps: document.getElementById('btn-maps'),
    btnDifficulty: document.getElementById('btn-difficulty'),
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

function refreshMapSelector() {
    const mapSelector = document.getElementById('map-selector');
    if (!mapSelector) return;
    mapSelector.innerHTML = '';
    Maps.forEach((map, index) => {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '5px';
        wrapper.style.margin = '5px 0';
        const btn = document.createElement('button');
        btn.className = 'diff-btn';
        btn.style.flex = '1';
        btn.style.margin = '0';
        btn.innerText = map.name || `Map ${index + 1}`;
        if (Config.data.currentMap === index) btn.style.borderColor = '#f1c40f';
        btn.addEventListener('click', () => {
            document.querySelectorAll('#map-selector .diff-btn').forEach(c => c.style.borderColor = '#7f8c8d');
            btn.style.borderColor = '#f1c40f';
            GameEngine.currentMap = index;
            Config.data.currentMap = index;
            Config.save();
        });
        wrapper.appendChild(btn);
        let customMapData = null;
        for (let m of Config.data.customMaps) {
            if ((map.id && m.id === map.id) || (!map.id && m.name === map.name)) {
                customMapData = m;
                break;
            }
        }
        if (customMapData) {
            const delBtn = document.createElement('button');
            delBtn.className = 'diff-btn';
            delBtn.style.background = '#e74c3c';
            delBtn.style.border = '1px solid #c0392b';
            delBtn.style.margin = '0';
            delBtn.style.width = '40px';
            delBtn.innerText = '🗑';
            delBtn.title = "Delete Custom Map";
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete custom map "${map.name}"?`)) {
                    Config.data.customMaps = Config.data.customMaps.filter(m => m !== customMapData);
                    Config.save();
                    const mapIdx = Maps.indexOf(map);
                    if (mapIdx > -1) Maps.splice(mapIdx, 1);
                    if (GameEngine.currentMap >= mapIdx) {
                        GameEngine.currentMap = Math.max(0, GameEngine.currentMap - 1);
                        Config.data.currentMap = GameEngine.currentMap;
                        Config.save();
                    }
                    refreshMapSelector();
                }
            });
            wrapper.appendChild(delBtn);
        }
        mapSelector.appendChild(wrapper);
    });
}

function updateHeroInfo(key) {
    const hero = HeroRegistry[key];
    if (!hero) return;
    document.getElementById('hero-select-title').innerText = hero.stats.name;
    document.getElementById('hero-select-subtitle').innerText = hero.stats.desc;
    document.getElementById('hero-model-view').innerText = hero.stats.name;
    const bioText = `Cost: $${hero.stats.cost}<br>Base Range: ${hero.stats.range}<br>Base Damage: ${hero.stats.damage}<br>Attack Rate: ${hero.stats.fireRate}s<br>Damage Type: ${hero.stats.dmgType}<br><br><i>${hero.stats.name} is ready for battle.</i>`;
    document.getElementById('hero-bio-text').innerHTML = bioText;
    document.querySelectorAll('.hm-carousel-item').forEach(item => {
        item.classList.toggle('active', item.dataset.hero === key);
    });
}

function refreshHeroSelector() {
    if (!dom.heroSelector) return;
    dom.heroSelector.innerHTML = '';
    Object.entries(HeroRegistry).forEach(([key, hero]) => {
        const btn = document.createElement('button');
        btn.className = 'hm-carousel-item';
        btn.dataset.hero = key;
        btn.innerText = hero.stats.name.substring(0, 2);
        btn.title = hero.stats.name;
        if (Config.data.selectedHero === key) {
            btn.classList.add('active');
            updateHeroInfo(key);
        }
        btn.addEventListener('click', () => {
            Config.data.selectedHero = key;
            GameEngine.selectedHero = key;
            Config.save();
            updateHeroInfo(key);
            updateHeroShopCard();
        });
        dom.heroSelector.appendChild(btn);
    });
}

function updateHeroShopCard() {
    const card = document.getElementById('hero-shop-card');
    const heroKey = Config.data.selectedHero || 'quincy';
    const hero = HeroRegistry[heroKey];
    if (card && hero) {
        card.dataset.tower = heroKey;
        card.querySelector('span').innerText = hero.stats.name;
        card.querySelector('.cost').innerText = `$${hero.stats.cost}`;
    }
}

function updateShopPrices() {
    const costMod = GameEngine.difficulty ? GameEngine.difficulty.costMod : 1.0;
    dom.towerCards.forEach(card => {
        const type = card.dataset.tower;
        const stats = TowerStats[type] || HeroStats[type];
        if (stats) {
            let cost = Math.floor(stats.cost * costMod);
            const costEl = card.querySelector('.cost');
            
            // --- FREE DART MONKEY LOGIC ---
            if (type === 'dart' && !GameEngine.isSandbox && GameEngine.difficulty && !GameEngine.difficulty.noSelling) {
                const mkActive = Config.data.mkActive !== false;
                const hasFreeMonkey = Config.data.unlocks.freeFirstDartMonkey || (mkActive && Config.data.monkeyKnowledge && Config.data.monkeyKnowledge.bonus_monkey);
                if (hasFreeMonkey && !GameEngine.towers.some(t => t.type === 'dart')) {
                    cost = 0;
                }
            }
            // ------------------------------

            if (costEl) costEl.innerText = cost === 0 ? "Free!" : `$${cost}`;
        }
    });
}

function updateShopUI() {
    document.querySelectorAll('.shop-item').forEach(item => {
        const unlockKey = item.dataset.unlock;
        if (Config.data.unlocks[unlockKey]) {
            item.classList.add('purchased');
            item.querySelector('.cost').innerText = "Purchased";
        } else {
            item.classList.remove('purchased');
            const cost = item.dataset.cost;
            item.querySelector('.cost').innerText = `$${cost}`;
        }
    });
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
    refreshMapSelector();
    refreshHeroSelector();
    updateHeroShopCard();
    updateShopUI();
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
    dom.btnPlay?.addEventListener('click', () => UI.toggleMenus('play-menu'));
    dom.btnSandbox?.addEventListener('click', () => startGameUI(true)); 
    dom.btnHeroes?.addEventListener('click', () => UI.toggleMenus('hero-select-menu'));
    dom.btnPowers?.addEventListener('click', () => UI.toggleMenus('powers-menu'));
    dom.btnKnowledge?.addEventListener('click', () => UI.toggleMenus('knowledge-menu'));
    dom.btnSettings?.addEventListener('click', () => { GameEngine.lastMenu = 'main-menu-ui'; UI.toggleMenus('settings-menu'); });
    dom.btnMapEditor?.addEventListener('click', () => { MapEditor.init(); UI.toggleMenus('map-editor-menu'); });
    dom.btnMonkeys?.addEventListener('click', () => alert('Monkeys menu coming soon!'));
    dom.btnContinue?.addEventListener('click', () => {
        if (GameEngine.loadGame()) {
            startGameUI(false);
        }
    });
    dom.btnAbandon?.addEventListener('click', () => GameEngine.abandonRun());
    dom.btnMaps?.addEventListener('click', () => { refreshMapSelector(); UI.toggleMenus('maps-menu'); });
    dom.btnDifficulty?.addEventListener('click', () => UI.toggleMenus('difficulty-menu'));
    dom.diffBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            Config.data.currentDifficulty = btn.dataset.diff;
            Config.save();
            startGameUI(false);
        });
    });
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
        updateShopUI();
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
                updateShopUI();
            } else {
                alert("Not enough Monkey Money!");
            }
        });
    });
}

function _setupSettingsListeners() {
    dom.volumeSlider?.addEventListener('input', (e) => { dom.volDisplay.innerText = e.target.value + '%'; AudioEngine.setSfxVolume(e.target.value / 100); });
    dom.musicSlider?.addEventListener('input', (e) => { dom.musicVolDisplay.innerText = e.target.value + '%'; AudioEngine.setMusicVolume(e.target.value / 100); });
    dom.bgRunCheckbox?.addEventListener('change', (e) => { GameEngine.runInBackground = e.target.checked; Config.data.runInBackground = e.target.checked; Config.save(); });
    dom.flavorTextCheckbox?.addEventListener('change', (e) => { Config.data.showFlavor = e.target.checked; Config.save(); });
    dom.smoothingCheckbox?.addEventListener('change', (e) => { Config.data.smoothingEnabled = e.target.checked; Config.save(); });
    dom.fpsCheckbox?.addEventListener('change', (e) => { Config.data.showFps = e.target.checked; Config.save(); if (dom.fpsDisplay) dom.fpsDisplay.style.display = e.target.checked ? 'block' : 'none'; });
    dom.extremeSpeedCheckbox?.addEventListener('change', (e) => { Config.data.extremeSpeedEnabled = e.target.checked; Config.save(); });
    dom.shuffleMusicCheckbox?.addEventListener('change', (e) => { Config.data.musicShuffle = e.target.checked; Config.save(); });
    dom.randomStartCheckbox?.addEventListener('change', (e) => { Config.data.musicRandomStart = e.target.checked; Config.save(); });
    dom.showStatsCheckbox?.addEventListener('change', (e) => { Config.data.showTowerStats = e.target.checked; Config.save(); });
    dom.uncapFpsCheckbox?.addEventListener('change', (e) => { 
        Config.data.uncapFps = e.target.checked; 
        Config.save(); 
        GameEngine.restartLoop(); 
    });
    const autoToggle = (e) => {
        GameEngine.waveManager.autoWaveEnabled = e.target.checked;
        Config.data.autoStart = e.target.checked;
        Config.save();
        if (dom.autoWaveMenu) dom.autoWaveMenu.checked = e.target.checked;
        if (dom.autoWavePause) dom.autoWavePause.checked = e.target.checked;
    };
    dom.autoWaveMenu?.addEventListener('change', autoToggle);
    dom.autoWavePause?.addEventListener('change', autoToggle);
    dom.prevSongBtn?.addEventListener('click', () => AudioEngine.prevTrack());
    dom.nextSongBtn?.addEventListener('click', () => AudioEngine.nextTrack());
    dom.pausePrevSong?.addEventListener('click', () => AudioEngine.prevTrack());
    dom.pauseNextSong?.addEventListener('click', () => AudioEngine.nextTrack());
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
        updateShopUI();
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

function _setupShopListeners() {
    let sandboxCamoOn = false, sandboxRegenOn = false, sandboxFortifiedOn = false;
    const shopView = document.getElementById('shop-view');
    const enemyView = document.getElementById('enemy-view');
    
    if (dom.sbViewToggle) {
        dom.sbViewToggle.addEventListener('click', () => {
            const showingEnemies = enemyView && !enemyView.classList.contains('hidden');
            if (showingEnemies) {
                enemyView.classList.add('hidden');
                shopView.classList.remove('hidden');
                dom.sbViewToggle.innerText = '🎈 Spawn Bloons';
            } else {
                shopView.classList.add('hidden');
                enemyView.classList.remove('hidden');
                dom.sbViewToggle.innerText = '🐵 Back to Shop';
            }
        });
    }

    dom.camoToggleBtn?.addEventListener('click', () => {
        sandboxCamoOn = !sandboxCamoOn;
        dom.camoToggleBtn.classList.toggle('active', sandboxCamoOn);
        dom.camoToggleBtn.innerText = `Camo: ${sandboxCamoOn ? 'On' : 'Off'}`;
    });
    dom.regenToggleBtn?.addEventListener('click', () => {
        sandboxRegenOn = !sandboxRegenOn;
        dom.regenToggleBtn.classList.toggle('active', sandboxRegenOn);
        dom.regenToggleBtn.innerText = `Regen: ${sandboxRegenOn ? 'On' : 'Off'}`;
    });
    dom.fortToggleBtn?.addEventListener('click', () => {
        sandboxFortifiedOn = !sandboxFortifiedOn;
        dom.fortToggleBtn.classList.toggle('active', sandboxFortifiedOn);
        dom.fortToggleBtn.innerText = `Fortified: ${sandboxFortifiedOn ? 'On' : 'Off'}`;
    });

    dom.enemyCards.forEach(card => {
        card.addEventListener('click', () => {
            if (!GameEngine.isSandbox || !GameEngine.map) return;
            const tier = parseInt(card.dataset.enemy, 10);
            let isCamo = sandboxCamoOn || tier === 16;
            let e = GameEngine.enemyPool.get();
            e.init(tier, GameEngine.map, isCamo, sandboxRegenOn, tier, sandboxFortifiedOn, null, 0, false);
            GameEngine.enemies.push(e);
        });
    });

    // --- REWRITTEN DRAG AND DROP LOGIC ---
    dom.towerCards.forEach(card => {
        card.addEventListener('pointerdown', (e) => {
            e.preventDefault(); 
            
            const stats = TowerStats[card.dataset.tower] || HeroStats[card.dataset.tower];
            if (GameEngine.cash < GameEngine.getCost(stats.cost)) {
                GameEngine.log("Not enough cash!");
                return;
            }
            
            GameEngine.deselectAll();
            dom.towerCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            GameEngine.selectedTowerType = card.dataset.tower;
            document.getElementById('cancel-btn').classList.remove('hidden');

            let isDragging = false;
            const startX = e.clientX;
            const startY = e.clientY;

            const onMove = (ev) => {
                const dx = Math.abs(ev.clientX - startX);
                const dy = Math.abs(ev.clientY - startY);
                if (dx > 5 || dy > 5) {
                    isDragging = true;
                }
                if (isDragging) {
                    const rect = GameEngine.canvas.getBoundingClientRect();
                    const scaleX = GameEngine.canvas.width / rect.width;
                    const scaleY = GameEngine.canvas.height / rect.height;
                    GameEngine.mouse.x = (ev.clientX - rect.left) * scaleX;
                    GameEngine.mouse.y = (ev.clientY - rect.top) * scaleY;
                }
            };

            const onUp = (ev) => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);

                if (isDragging) {
                    const rect = GameEngine.canvas.getBoundingClientRect();
                    const sidebarRect = document.getElementById('sidebar').getBoundingClientRect();

                    if (ev.clientX >= sidebarRect.left && ev.clientX <= sidebarRect.right) {
                        GameEngine.deselectAll();
                    } else if (ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
                        GameEngine.handleCanvasClick({ clientX: ev.clientX, clientY: ev.clientY });
                    } else {
                        GameEngine.deselectAll();
                    }
                }
                // If not dragging, we leave it selected so the user can click the map via InputManager
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        });

        card.addEventListener('mouseenter', () => {
            const tip = document.getElementById('shop-tooltip');
            const stats = TowerStats[card.dataset.tower] || HeroStats[card.dataset.tower];
            if (tip && stats) tip.innerText = stats.desc;
        });
    });

    // Update prices immediately after a map click (fixes "Free!" disappearing after placing the free dart)
    GameEngine.canvas.addEventListener('click', () => {
        setTimeout(updateShopPrices, 10);
    });

    const upHover = (el, path) => {
        if (!el) return;
        el.addEventListener('mouseenter', () => {
            if (!GameEngine.selectedPlacedTower) return;
            const t = GameEngine.selectedPlacedTower;
            if (t.stats.isHero) return; 
            const tier = t.upgrades[path - 1];
            const data = Upgrades[t.type][path][tier];
            const tip = document.getElementById('upgrade-tooltip');
            if (data && tip) {
                tip.innerHTML = `<b>${data.name} (${tier + 1}/5)</b><br>${data.desc}`;
                const rect = el.getBoundingClientRect();
                const containerRect = document.getElementById('game-container').getBoundingClientRect();
                tip.style.left = (rect.right - containerRect.left + 5) + 'px';
                tip.style.top = (rect.top - containerRect.top) + 'px';
                tip.style.opacity = 1;
            }
        });
        el.addEventListener('mouseleave', () => {
            const tip = document.getElementById('upgrade-tooltip');
            if (tip) tip.style.opacity = 0;
        });
    };
    
    dom.upPaths.forEach((el, i) => upHover(el, i + 1));
    dom.upBuyLevel?.addEventListener('click', () => GameEngine.buyHeroLevel());
    dom.upPaths.forEach((el, i) => el?.addEventListener('click', () => GameEngine.handleUpgrade(i + 1)));
    dom.upSell?.addEventListener('click', () => GameEngine.sellTower());
    dom.upCollectBank?.addEventListener('click', () => {
        if (GameEngine.selectedPlacedTower && GameEngine.selectedPlacedTower.bankBalance > 0) {
            GameEngine.addCash(Math.floor(GameEngine.selectedPlacedTower.bankBalance));
            GameEngine.selectedPlacedTower.bankBalance = 0;
            AudioEngine.playSfx('cash');
            UI.showUpgradeUI(GameEngine.selectedPlacedTower, GameEngine);
        }
    });
}

function setupEventListeners() {
    _setupMenuListeners();
    _setupSettingsListeners();
    _setupGameListeners();
    _setupShopListeners();
    InputManager.init();
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