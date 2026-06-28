import { GameEngine } from './engine.js';
import { Config } from './config.js';
import { HeroStats } from './heroes/index.js';
import { TowerStats, Upgrades } from './towers/index.js';
import { HeroRegistry } from './heroes/index.js';
import { Maps } from './data.js';
import { AudioEngine } from './audio.js';
import { Enemy } from './enemy.js';
import { Hero } from './hero.js';
import { InputManager } from './input.js';
import { UI } from './ui.js'; // IMPORTANT: Added missing UI import

// DYNAMIC RESIZING LOGIC
function resizeGame() {
    const container = document.getElementById('game-container');
    if (!container) return;
    const scaleX = window.innerWidth / 900;
    const scaleY = window.innerHeight / 600;
    const scale = Math.min(scaleX, scaleY) * 0.95; // 95% to leave a slight margin
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
    
    let bioText = `Cost: $${hero.stats.cost}<br>`;
    bioText += `Base Range: ${hero.stats.range}<br>`;
    bioText += `Base Damage: ${hero.stats.damage}<br>`;
    bioText += `Attack Rate: ${hero.stats.fireRate}s<br>`;
    bioText += `Damage Type: ${hero.stats.dmgType}<br><br>`;
    bioText += `<i>${hero.stats.name} is ready for battle. More lore details can be added here later.</i>`;
    
    document.getElementById('hero-bio-text').innerHTML = bioText;
    
    document.querySelectorAll('.hm-carousel-item').forEach(item => {
        item.classList.toggle('active', item.dataset.hero === key);
    });
}

function refreshHeroSelector() {
    const heroSelector = document.getElementById('hero-selector');
    if (!heroSelector) return;
    heroSelector.innerHTML = '';
    
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
        heroSelector.appendChild(btn);
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
    document.querySelectorAll('#shop-view .tower-card[data-tower]').forEach(card => {
        const type = card.dataset.tower;
        const stats = TowerStats[type] || HeroStats[type];
        if (stats) {
            const cost = Math.floor(stats.cost * costMod);
            const costEl = card.querySelector('.cost');
            if (costEl) costEl.innerText = `$${cost}`;
        }
    });
}

function applyConfigToUI() {
    const shuffleCb = document.getElementById('shuffle-music-checkbox');
    if (shuffleCb) shuffleCb.checked = Config.data.musicShuffle;
    
    const randomStartCb = document.getElementById('random-start-checkbox');
    if (randomStartCb) randomStartCb.checked = Config.data.musicRandomStart;
    
    const volSlider = document.getElementById('volume-slider');
    if (volSlider) volSlider.value = Config.data.sfxVolume * 100;
    const volDisp = document.getElementById('vol-display');
    if (volDisp) volDisp.innerText = Math.round(Config.data.sfxVolume * 100) + '%';
    
    const musicSlider = document.getElementById('music-slider');
    if (musicSlider) musicSlider.value = Config.data.musicVolume * 100;
    const musicDisp = document.getElementById('music-vol-display');
    if (musicDisp) musicDisp.innerText = Math.round(Config.data.musicVolume * 100) + '%';
    
    const bgRun = document.getElementById('bg-run-checkbox');
    if (bgRun) bgRun.checked = Config.data.runInBackground;
    
    const autoWaveMenu = document.getElementById('auto-wave-checkbox-menu');
    if (autoWaveMenu) autoWaveMenu.checked = Config.data.autoStart;
    
    const autoWavePause = document.getElementById('auto-wave-checkbox-pause');
    if (autoWavePause) autoWavePause.checked = Config.data.autoStart;
    
    const flavorText = document.getElementById('flavor-text-checkbox');
    if (flavorText) flavorText.checked = Config.data.showFlavor;
    
    const smoothing = document.getElementById('smoothing-checkbox');
    if (smoothing) smoothing.checked = Config.data.smoothingEnabled;
    
    const fpsCheckbox = document.getElementById('fps-checkbox');
    if (fpsCheckbox) fpsCheckbox.checked = Config.data.showFps;
    
    const fpsDisplay = document.getElementById('fps-display');
    if (fpsDisplay) fpsDisplay.style.display = Config.data.showFps ? 'block' : 'none';
    
    refreshMapSelector();
    refreshHeroSelector();
    updateHeroShopCard();
}

async function startGameUI(isSandbox) {
    await AudioEngine.init(); // WAIT for music folder to fetch!
    AudioEngine.play(); 
    GameEngine.startGame(isSandbox); 
    updateShopPrices();
    
    document.getElementById('main-menu')?.classList.add('hidden');
    document.getElementById('difficulty-menu')?.classList.add('hidden'); 
    document.getElementById('maps-menu')?.classList.add('hidden');
    document.getElementById('settings-menu')?.classList.add('hidden');
    
    document.getElementById('sidebar')?.classList.remove('hidden'); 
    document.getElementById('top-ui-left')?.classList.remove('hidden'); 
    document.getElementById('top-ui-right')?.classList.remove('hidden');
    
    if (isSandbox) { 
        document.getElementById('sandbox-controls')?.classList.remove('hidden'); 
        document.getElementById('norm-controls')?.classList.add('hidden'); 
    } else { 
        document.getElementById('sandbox-controls')?.classList.add('hidden'); 
        document.getElementById('norm-controls')?.classList.remove('hidden'); 
    }

    document.getElementById('shop-view')?.classList.remove('hidden');
    document.getElementById('enemy-view')?.classList.add('hidden');
    const viewToggleBtn = document.getElementById('sb-view-toggle');
    if (viewToggleBtn) viewToggleBtn.innerText = '🎈 Spawn Bloons';
}

function setupEventListeners() {
    document.getElementById('play-btn')?.addEventListener('click', () => GameEngine.toggleMenus('difficulty-menu'));
    document.getElementById('sandbox-btn')?.addEventListener('click', () => startGameUI(true));
    document.getElementById('hero-btn')?.addEventListener('click', () => GameEngine.toggleMenus('hero-select-menu'));
    
    document.querySelectorAll('.diff-btn[data-diff]').forEach(btn => {
        btn.addEventListener('click', () => {
            Config.data.currentDifficulty = btn.dataset.diff;
            Config.save();
            startGameUI(false);
        });
    });

    document.getElementById('maps-btn')?.addEventListener('click', () => { refreshMapSelector(); GameEngine.toggleMenus('maps-menu'); });
    document.getElementById('custom-maps-btn')?.addEventListener('click', () => GameEngine.toggleMenus('custom-maps-menu'));
    document.getElementById('settings-btn')?.addEventListener('click', () => { GameEngine.lastMenu = 'main-menu'; GameEngine.toggleMenus('settings-menu'); });
    
    document.querySelectorAll('.back-btn[data-target]').forEach(btn => btn.addEventListener('click', (e) => GameEngine.toggleMenus(e.target.dataset.target)));
    document.getElementById('settings-back-btn')?.addEventListener('click', () => GameEngine.toggleMenus(GameEngine.lastMenu));
    document.getElementById('go-menu-btn')?.addEventListener('click', () => { GameEngine.toggleMenus('main-menu'); document.getElementById('sidebar')?.classList.add('hidden'); document.getElementById('top-ui-left')?.classList.add('hidden'); document.getElementById('top-ui-right')?.classList.add('hidden'); AudioEngine.pause(); });
    
    document.getElementById('hm-prev-btn')?.addEventListener('click', () => {
        const sel = document.getElementById('hero-selector');
        if (sel) sel.scrollBy({ left: -300, behavior: 'smooth' });
    });
    document.getElementById('hm-next-btn')?.addEventListener('click', () => {
        const sel = document.getElementById('hero-selector');
        if (sel) sel.scrollBy({ left: 300, behavior: 'smooth' });
    });

    document.getElementById('volume-slider')?.addEventListener('input', (e) => { document.getElementById('vol-display').innerText = e.target.value + '%'; AudioEngine.setSfxVolume(e.target.value / 100); });
    document.getElementById('music-slider')?.addEventListener('input', (e) => { document.getElementById('music-vol-display').innerText = e.target.value + '%'; AudioEngine.setMusicVolume(e.target.value / 100); });
    document.getElementById('bg-run-checkbox')?.addEventListener('change', (e) => { GameEngine.runInBackground = e.target.checked; Config.data.runInBackground = e.target.checked; Config.save(); });
    document.getElementById('flavor-text-checkbox')?.addEventListener('change', (e) => { Config.data.showFlavor = e.target.checked; Config.save(); });
    document.getElementById('smoothing-checkbox')?.addEventListener('change', (e) => { Config.data.smoothingEnabled = e.target.checked; Config.save(); });
    document.getElementById('fps-checkbox')?.addEventListener('change', (e) => { Config.data.showFps = e.target.checked; Config.save(); const fpsDisp = document.getElementById('fps-display'); if (fpsDisp) fpsDisp.style.display = e.target.checked ? 'block' : 'none'; });
    
    document.getElementById('add-map-btn')?.addEventListener('click', () => {
        try {
            const json = document.getElementById('map-json-input').value;
            const mapData = JSON.parse(json);
            let isValid = true;
            if (!mapData.waypoints || mapData.waypoints.length < 2) isValid = false;
            else {
                for(let wp of mapData.waypoints) {
                    if (typeof wp.x !== 'number' || typeof wp.y !== 'number') { isValid = false; break; }
                }
            }
            if (!isValid) { alert('Invalid map JSON. Must contain a "waypoints" array of {x, y} numbers.'); return; }
            Config.data.customMaps.push(mapData);
            Config.save();
            Maps.push(mapData);
            refreshMapSelector();
            alert('Map added successfully! Go to "Select Map" to play it.');
            document.getElementById('map-json-input').value = '';
        } catch (err) { alert('Error parsing JSON: ' + err.message); }
    });

    const autoToggle = (e) => { 
        GameEngine.waveManager.autoWaveEnabled = e.target.checked; 
        Config.data.autoStart = e.target.checked; Config.save(); 
        const menuCb = document.getElementById('auto-wave-checkbox-menu');
        const pauseCb = document.getElementById('auto-wave-checkbox-pause');
        if (menuCb) menuCb.checked = e.target.checked;
        if (pauseCb) pauseCb.checked = e.target.checked;
    };
    document.getElementById('auto-wave-checkbox-menu')?.addEventListener('change', autoToggle);
    document.getElementById('auto-wave-checkbox-pause')?.addEventListener('change', autoToggle);
    
    document.getElementById('prev-song-btn')?.addEventListener('click', () => AudioEngine.prevTrack());
    document.getElementById('next-song-btn')?.addEventListener('click', () => AudioEngine.nextTrack());
    document.getElementById('pause-prev-song')?.addEventListener('click', () => AudioEngine.prevTrack());
    document.getElementById('pause-next-song')?.addEventListener('click', () => AudioEngine.nextTrack());
    
    document.getElementById('pause-btn')?.addEventListener('click', () => GameEngine.pauseGame());
    
    // PRO FEATURE: Clickable HUD for Sandbox Mode
    document.getElementById('cash-display')?.addEventListener('click', () => {
        if (!GameEngine.isSandbox) return;
        const val = prompt("Set Cash Amount:", GameEngine.cash);
        if (val !== null && !isNaN(val)) {
            GameEngine.cash = Math.max(0, parseInt(val));
            GameEngine.updateUI();
        }
    });

    document.getElementById('lives-display')?.addEventListener('click', () => {
        if (!GameEngine.isSandbox) return;
        const val = prompt("Set Lives Amount:", GameEngine.lives);
        if (val !== null && !isNaN(val)) {
            GameEngine.lives = Math.max(0, parseInt(val));
            GameEngine.updateUI();
        }
    });
    
    document.getElementById('resume-btn')?.addEventListener('click', () => GameEngine.resumeGame());
    document.getElementById('pause-settings-btn')?.addEventListener('click', () => { GameEngine.lastMenu = 'pause-menu'; GameEngine.toggleMenus('settings-menu'); });
    document.getElementById('quit-btn')?.addEventListener('click', () => { GameEngine.gameState = 'menu'; GameEngine.toggleMenus('main-menu'); document.getElementById('sidebar')?.classList.add('hidden'); document.getElementById('top-ui-left')?.classList.add('hidden'); document.getElementById('top-ui-right')?.classList.add('hidden'); AudioEngine.pause(); });
    document.getElementById('sb-prev')?.addEventListener('click', () => GameEngine.skipWave(-1));
    document.getElementById('sb-next')?.addEventListener('click', () => GameEngine.skipWave(1));
    document.getElementById('sb-speed-btn')?.addEventListener('click', () => GameEngine.handleWaveSpeedClick());
    
    document.getElementById('sb-reset-cooldowns')?.addEventListener('click', () => {
        if (!GameEngine.isSandbox) return; // Only works in sandbox
        
        GameEngine.towers.forEach(t => {
            if (!t) return;
            t.abilityCooldown = 0;
            t.ability2Cooldown = 0;
            t.ability3Cooldown = 0;
        });
        
        GameEngine.log("Ability cooldowns reset!");
        UI.updateAbilityBar(GameEngine); // Instantly update the UI
    });
    
    document.getElementById('shuffle-music-checkbox')?.addEventListener('change', (e) => { 
        Config.data.musicShuffle = e.target.checked; 
        Config.save(); 
    });
    document.getElementById('random-start-checkbox')?.addEventListener('change', (e) => { 
        Config.data.musicRandomStart = e.target.checked; 
        Config.save(); 
    });

    let sandboxCamoOn = false, sandboxRegenOn = false, sandboxFortifiedOn = false;
    const shopView = document.getElementById('shop-view');
    const enemyView = document.getElementById('enemy-view');
    const viewToggleBtn = document.getElementById('sb-view-toggle');
    if (viewToggleBtn) {
        viewToggleBtn.addEventListener('click', () => {
            const showingEnemies = enemyView && !enemyView.classList.contains('hidden');
            if (showingEnemies) {
                enemyView?.classList.add('hidden');
                shopView?.classList.remove('hidden');
                viewToggleBtn.innerText = '🎈 Spawn Bloons';
            } else {
                shopView?.classList.add('hidden');
                enemyView?.classList.remove('hidden');
                viewToggleBtn.innerText = '🐵 Back to Shop';
            }
        });
    }

    const camoToggleBtn = document.getElementById('sb-toggle-camo');
    const regenToggleBtn = document.getElementById('sb-toggle-regen');
    const fortToggleBtn = document.getElementById('sb-toggle-fortified');

    if (camoToggleBtn) {
        camoToggleBtn.addEventListener('click', () => {
            sandboxCamoOn = !sandboxCamoOn;
            camoToggleBtn.classList.toggle('active', sandboxCamoOn);
            camoToggleBtn.innerText = `Camo: ${sandboxCamoOn ? 'On' : 'Off'}`;
        });
    }
    if (regenToggleBtn) {
        regenToggleBtn.addEventListener('click', () => {
            sandboxRegenOn = !sandboxRegenOn;
            regenToggleBtn.classList.toggle('active', sandboxRegenOn);
            regenToggleBtn.innerText = `Regen: ${sandboxRegenOn ? 'On' : 'Off'}`;
        });
    }
    if (fortToggleBtn) {
        fortToggleBtn.addEventListener('click', () => {
            sandboxFortifiedOn = !sandboxFortifiedOn;
            fortToggleBtn.classList.toggle('active', sandboxFortifiedOn);
            fortToggleBtn.innerText = `Fortified: ${sandboxFortifiedOn ? 'On' : 'Off'}`;
        });
    }

    document.querySelectorAll('#enemy-view .tower-card[data-enemy]').forEach(card => {
        card.addEventListener('click', () => {
            if (!GameEngine.isSandbox || !GameEngine.map) return;
            const tier = parseInt(card.dataset.enemy, 10);
            GameEngine.enemies.push(new Enemy(tier, GameEngine.map, sandboxCamoOn, sandboxRegenOn, tier, sandboxFortifiedOn));
        });
    });

    InputManager.init();
      // NEW: Wire the cancel button to deselect
    document.getElementById('cancel-btn')?.addEventListener('click', () => GameEngine.deselectAll());
    
    // PRO FEATURE: Drag and Drop Tower Placement
    document.querySelectorAll('.tower-card[data-tower]').forEach(card => { 
        card.addEventListener('mousedown', (e) => { 
            e.preventDefault(); // Prevent text selection while dragging
            const stats = TowerStats[card.dataset.tower] || HeroStats[card.dataset.tower];
            if (GameEngine.cash < GameEngine.getCost(stats.cost)) { GameEngine.log("Not enough cash!"); return; } 
            
            GameEngine.deselectAll(); 
            document.querySelectorAll('.tower-card[data-tower]').forEach(c => c.classList.remove('selected')); 
            card.classList.add('selected'); 
            GameEngine.selectedTowerType = card.dataset.tower; 

            // Listen for mouse release globally to allow dragging outside the sidebar
            const handleMouseUp = (ev) => {
                window.removeEventListener('mouseup', handleMouseUp);
                const rect = GameEngine.canvas.getBoundingClientRect();
                
                // If released over the canvas, place it immediately
                if (ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
                    GameEngine.handleCanvasClick({ clientX: ev.clientX, clientY: ev.clientY });
                }
            };
            window.addEventListener('mouseup', handleMouseUp);
        }); 

        // Keep hover tooltip
        card.addEventListener('mouseenter', (e) => { 
            const tip = document.getElementById('shop-tooltip'); 
            const stats = TowerStats[card.dataset.tower] || HeroStats[card.dataset.tower];
            if (tip && stats) tip.innerText = stats.desc; 
        });
    });
    
    const upHover = (id, path) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('mouseenter', (e) => {
            if (!GameEngine.selectedPlacedTower) return;
            const t = GameEngine.selectedPlacedTower;
            const tier = t.upgrades[path - 1];
            const data = Upgrades[t.type][path][tier];
            const tip = document.getElementById('upgrade-tooltip');
            if (data && tip) {
                tip.innerHTML = `<b>${data.name} (${tier+1}/5)</b><br>${data.desc}`;
                const rect = el.getBoundingClientRect();
                const containerRect = document.getElementById('game-container').getBoundingClientRect();
                tip.style.left = (rect.right - containerRect.left + 5) + 'px';
                tip.style.top = (rect.top - containerRect.top) + 'px';
                tip.style.opacity = 1;
            }
        });
        el.addEventListener('mouseleave', (e) => { const tip = document.getElementById('upgrade-tooltip'); if (tip) tip.style.opacity = 0; });
    };
    upHover('up-path1', 1); upHover('up-path2', 2); upHover('up-path3', 3);
    
    document.getElementById('wave-speed-btn')?.addEventListener('click', () => GameEngine.handleWaveSpeedClick());
    document.getElementById('up-targeting')?.addEventListener('click', () => GameEngine.cycleTargeting());
    document.getElementById('up-targeting-tower')?.addEventListener('click', () => GameEngine.cycleTargeting());
    document.getElementById('up-buy-level')?.addEventListener('click', () => GameEngine.buyHeroLevel()); 
    document.getElementById('up-path1')?.addEventListener('click', () => GameEngine.handleUpgrade(1));
    document.getElementById('up-path2')?.addEventListener('click', () => GameEngine.handleUpgrade(2));
    document.getElementById('up-path3')?.addEventListener('click', () => GameEngine.handleUpgrade(3));
    document.getElementById('up-sell')?.addEventListener('click', () => GameEngine.sellTower());
    document.getElementById('up-collect-bank')?.addEventListener('click', () => {
        if (GameEngine.selectedPlacedTower && GameEngine.selectedPlacedTower.bankBalance > 0) {
            GameEngine.addCash(Math.floor(GameEngine.selectedPlacedTower.bankBalance));
            GameEngine.selectedPlacedTower.bankBalance = 0;
            AudioEngine.playSfx('cash');
            UI.showUpgradeUI(GameEngine.selectedPlacedTower, GameEngine); // Refresh UI to hide button
        }
    });
}

window.addEventListener('load', () => {
    GameEngine.init();
    setupEventListeners();
    applyConfigToUI();
    resizeGame(); // Call once on load
    document.getElementById('main-menu')?.classList.remove('hidden');
});