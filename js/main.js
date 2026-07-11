// main.js
import { GameEngine } from './engine.js';
import { Config, HeroStats } from './config.js';
import { TowerStats, Upgrades } from './towers/index.js';
import { HeroRegistry } from './heroes/index.js';
import { Maps } from './data.js';
import { AudioEngine } from './audio.js';
import { Enemy } from './enemy.js';
import { Hero } from './hero.js';
import { InputManager } from './input.js';
import { UI } from './ui.js';
import { MapEditor } from './mapEditor.js'; // PRO FIX: Import Map Editor

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 600;
const SCALE_MARGIN = 0.98;

const dom = {
    playBtn: document.getElementById('play-btn'),
    sandboxBtn: document.getElementById('sandbox-btn'),
    heroBtn: document.getElementById('hero-btn'),
    mapsBtn: document.getElementById('maps-btn'),
    customMapsBtn: document.getElementById('custom-maps-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    continueBtn: document.getElementById('continue-btn'),
    abandonBtn: document.getElementById('abandon-btn'),
    goMenuBtn: document.getElementById('go-menu-btn'),
    shopBtn: document.getElementById('shop-btn'),
    mapEditorBtn: document.getElementById('map-editor-btn'), // PRO FIX: Map Editor Button
    
    hmPrevBtn: document.getElementById('hm-prev-btn'),
    hmNextBtn: document.getElementById('hm-next-btn'),
    heroSelector: document.getElementById('hero-selector'),
    
    diffBtns: document.querySelectorAll('.diff-btn[data-diff]'),
    backBtns: document.querySelectorAll('.back-btn[data-target]'),
    settingsBackBtn: document.getElementById('settings-back-btn'),
    
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
    prevSongBtn: document.getElementById('prev-song-btn'),
    nextSongBtn: document.getElementById('next-song-btn'),
    pausePrevSong: document.getElementById('pause-prev-song'),
    pauseNextSong: document.getElementById('pause-next-song'),
    addMapBtn: document.getElementById('add-map-btn'),
    mapJsonInput: document.getElementById('map-json-input'),
    
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
    upTargeting: document.getElementById('up-targeting'),
    upTargetingTower: document.getElementById('up-targeting-tower'),
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
    cancelBtn: document.getElementById('cancel-btn')
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
    if (!container) return;
    
    const scaleX = window.innerWidth / CANVAS_WIDTH;
    const scaleY = window.innerHeight / CANVAS_HEIGHT;
    const scale = Math.min(scaleX, scaleY) * SCALE_MARGIN;
    container.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', resizeGame);

function refreshMapSelector() {
    const mapSelector = document.getElementById('map-selector');
    if (!mapSelector) return;
    
    mapSelector.innerHTML = '';
    Maps.forEach((map, index) => {
        const btn = document.createElement('button');
        btn.className = 'diff-btn';
        btn.style.margin = '5px';
        btn.innerText = map.name || `Map ${index + 1}`;
        if (Config.data.currentMap === index) btn.style.borderColor = '#f1c40f';
        
        btn.addEventListener('click', () => {
            document.querySelectorAll('#map-selector button').forEach(c => c.style.borderColor = '#7f8c8d');
            btn.style.borderColor = '#f1c40f';
            GameEngine.currentMap = index;
            Config.data.currentMap = index;
            Config.save();
        });
        mapSelector.appendChild(btn);
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
            const cost = Math.floor(stats.cost * costMod);
            const costEl = card.querySelector('.cost');
            if (costEl) costEl.innerText = `$${cost}`;
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
    
    refreshMapSelector();
    refreshHeroSelector();
    updateHeroShopCard();
    updateShopUI();
}

async function startGameUI(isSandbox) {
    await AudioEngine.init();
    AudioEngine.play();
    GameEngine.startGame(isSandbox);
    updateShopPrices();
    
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('difficulty-menu').classList.add('hidden');
    document.getElementById('maps-menu').classList.add('hidden');
    document.getElementById('settings-menu').classList.add('hidden');
    
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
}

function _setupMenuListeners() {
    dom.continueBtn?.addEventListener('click', () => {
        if (GameEngine.loadGame()) {
            AudioEngine.init();
            AudioEngine.play();
            
            document.getElementById('main-menu').classList.add('hidden');
            document.getElementById('sidebar').classList.remove('hidden');
            document.getElementById('top-ui-left').classList.remove('hidden');
            document.getElementById('top-ui-right').classList.remove('hidden');
            document.getElementById('sandbox-controls').classList.add('hidden');
            document.getElementById('norm-controls').classList.remove('hidden');
            document.getElementById('shop-view').classList.remove('hidden');
            document.getElementById('enemy-view').classList.add('hidden');
            
            GameEngine.gameState = 'playing';
            updateShopPrices();
        }
    });
    
    dom.abandonBtn?.addEventListener('click', () => GameEngine.abandonRun());
    dom.playBtn?.addEventListener('click', () => GameEngine.toggleMenus('difficulty-menu'));
    dom.sandboxBtn?.addEventListener('click', () => startGameUI(true));
    dom.heroBtn?.addEventListener('click', () => GameEngine.toggleMenus('hero-select-menu'));
    dom.shopBtn?.addEventListener('click', () => GameEngine.toggleMenus('shop-menu'));
    dom.mapEditorBtn?.addEventListener('click', () => { // PRO FIX: Map Editor Listener
        MapEditor.init();
        UI.toggleMenus('map-editor-menu');
    });
    
    dom.diffBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            Config.data.currentDifficulty = btn.dataset.diff;
            Config.save();
            startGameUI(false);
        });
    });

    dom.mapsBtn?.addEventListener('click', () => { refreshMapSelector(); GameEngine.toggleMenus('maps-menu'); });
    dom.customMapsBtn?.addEventListener('click', () => GameEngine.toggleMenus('custom-maps-menu'));
    dom.settingsBtn?.addEventListener('click', () => { GameEngine.lastMenu = 'main-menu'; GameEngine.toggleMenus('settings-menu'); });
    
    dom.backBtns.forEach(btn => btn.addEventListener('click', (e) => GameEngine.toggleMenus(e.target.dataset.target)));
    dom.settingsBackBtn?.addEventListener('click', () => GameEngine.toggleMenus(GameEngine.lastMenu));
    
    dom.goMenuBtn?.addEventListener('click', () => {
        GameEngine.toggleMenus('main-menu');
        document.getElementById('sidebar').classList.add('hidden');
        document.getElementById('top-ui-left').classList.add('hidden');
        document.getElementById('top-ui-right').classList.add('hidden');
        AudioEngine.pause();
        UI.updateMetaStats();
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

    dom.addMapBtn?.addEventListener('click', () => {
        try {
            const json = dom.mapJsonInput.value;
            const mapData = JSON.parse(json);
            let isValid = true;
            
            // Backward compatibility: convert old 'waypoints' to 'paths'
            if (mapData.waypoints && !mapData.paths) {
                mapData.paths = [{ waypoints: mapData.waypoints }];
                delete mapData.waypoints;
            }
            
            if (!mapData.paths || mapData.paths.length === 0) isValid = false;
            else {
                for (let p of mapData.paths) {
                    if (!p.waypoints || p.waypoints.length < 2) { isValid = false; break; }
                    for (let wp of p.waypoints) {
                        if (typeof wp.x !== 'number' || typeof wp.y !== 'number') { isValid = false; break; }
                    }
                }
            }
            if (!isValid) { alert('Invalid map JSON. Must contain a "paths" array with at least one path of 2+ {x, y} waypoints.'); return; }
            
            Config.data.customMaps.push(mapData);
            Config.save();
            Maps.push(mapData);
            refreshMapSelector();
            alert('Map added successfully! Go to "Select Map" to play it.');
            dom.mapJsonInput.value = '';
        } catch (err) {
            alert('Error parsing JSON: ' + err.message);
        }
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
    dom.pauseSettingsBtn?.addEventListener('click', () => { GameEngine.lastMenu = 'pause-menu'; GameEngine.toggleMenus('settings-menu'); });
    dom.quitBtn?.addEventListener('click', () => {
        GameEngine.saveGame();
        GameEngine.gameState = 'menu';
        GameEngine.toggleMenus('main-menu');
        document.getElementById('sidebar').classList.add('hidden');
        document.getElementById('top-ui-left').classList.add('hidden');
        document.getElementById('top-ui-right').classList.add('hidden');
        AudioEngine.pause();
        UI.updateMetaStats();
        updateShopUI();
    });
    
    dom.sbPrev?.addEventListener('click', () => GameEngine.skipWave(-1));
    dom.sbNext?.addEventListener('click', () => GameEngine.skipWave(1));
    dom.sbSpeedBtn?.addEventListener('click', () => GameEngine.handleWaveSpeedClick());
    dom.waveSpeedBtn?.addEventListener('click', () => GameEngine.handleWaveSpeedClick());
    
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
    dom.cancelBtn?.addEventListener('click', () => GameEngine.deselectAll());
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
            // PRO FIX: Pass pathIndex 0 to Enemy constructor for sandbox
            GameEngine.enemies.push(new Enemy(tier, GameEngine.map, sandboxCamoOn, sandboxRegenOn, tier, sandboxFortifiedOn, null, 0));
        });
    });

    dom.towerCards.forEach(card => {
        card.addEventListener('mousedown', (e) => {
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

            const handleMouseUp = (ev) => {
                window.removeEventListener('mouseup', handleMouseUp);
                const rect = GameEngine.canvas.getBoundingClientRect();
                
                if (ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
                    GameEngine.handleCanvasClick({ clientX: ev.clientX, clientY: ev.clientY });
                } else {
                    GameEngine.deselectAll();
                }
            };
            window.addEventListener('mouseup', handleMouseUp);
        });

        card.addEventListener('mouseenter', () => {
            const tip = document.getElementById('shop-tooltip');
            const stats = TowerStats[card.dataset.tower] || HeroStats[card.dataset.tower];
            if (tip && stats) tip.innerText = stats.desc;
        });
    });

    const upHover = (el, path) => {
        if (!el) return;
        el.addEventListener('mouseenter', () => {
            if (!GameEngine.selectedPlacedTower) return;
            const t = GameEngine.selectedPlacedTower;
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
    
    dom.upTargeting?.addEventListener('click', () => GameEngine.cycleTargeting());
    dom.upTargetingTower?.addEventListener('click', () => GameEngine.cycleTargeting());
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
    UI.updateMetaStats();
    document.getElementById('main-menu').classList.remove('hidden');
});