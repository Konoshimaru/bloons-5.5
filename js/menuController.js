// js/menuController.js
import { GameEngine } from './engineRef.js';
import { Config, Difficulties } from './config.js';
import { TowerStats, Upgrades, TOWER_CATEGORIES } from './towers/index.js';
import { PARAGON_POWER_RULES } from './paragonPower.js';
import { Maps } from './data.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { MapEditor } from './mapEditor.js';
import { dom } from './dom.js';
import { isCheater, unlockEverything } from './cheats.js';
import { updateShopPrices } from './dragManager.js';
import { controllers } from './controllers.js';
import selectorMenus from './selectorMenus.js';
import { LoadGate } from './loadGate.js';
import { FadeVeil } from './fadeVeil.js';
import { MAP_TIERS, getMapTier, getTierInfo, getMapThumbUrl, getMapFullUrl } from './mapMeta.js';
import { GAME_VERSION } from './constants.js';

export const menuController = {
    playMenuState: {
        selectedMapIndex: 0,
        page: 0,
        mapsPerPage: 6,
        tab: 'beginner'
    },

    showMainMenuUI(show) {
        const ui = document.getElementById('main-menu-ui');
        if (show) {
            ui.classList.remove('hidden');
            UI.updateMetaStats();
            // v1.4.4: the badge always reflects the RUNNING code (constants.js
            // is bundled into whatever build is loaded), so a stale cached
            // bundle can never display the new version number.
            const badge = document.getElementById('mm-version-badge');
            if (badge) badge.textContent = `v${GAME_VERSION}`;
        } else {
            ui.classList.add('hidden');
        }
    },

    // v1.4.2: the shared battle -> menu swap behind the fade veil (quit,
    // game-over and victory all land here now - one cohesive sequence
    // instead of three near-identical click handlers).
    _returnToMenu() {
        UI.toggleMenus(null);
        GameEngine.deselectAll();
        GameEngine.gameState = 'menu';
        GameEngine.map = null;
        this.showMainMenuUI(true);
        document.getElementById('sidebar').classList.add('hidden');
        document.getElementById('top-ui-left').classList.add('hidden');
        document.getElementById('top-ui-right').classList.add('hidden');
        document.getElementById('level-bar').classList.add('hidden');
        AudioEngine.playMenuMusic();
        updateShopPrices();
    },

    applyConfigToUI() {
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
        if (dom.showHitboxesCheckbox) dom.showHitboxesCheckbox.checked = Config.data.showHitboxes;
        this.refreshMapSelector();
        this.refreshHeroSelector();
        this.updateHeroShopCard();
        updateShopPrices();
    },

    // These selectors live on selectorMenus; expose them here so applyConfigToUI
    // works even when invoked with this = menuController (e.g. settingsMenu).
    refreshMapSelector() { selectorMenus.refreshMapSelector(); },
    refreshHeroSelector() { selectorMenus.refreshHeroSelector(); },
    updateHeroShopCard() { selectorMenus.updateHeroShopCard(); },

    updateProfileUI() {
        const stats = Config.data.stats || { gamesPlayed: 0, highestRound: 0, totalPops: 0 };
        const profileStats = document.getElementById('profile-stats');
        const nameInput = document.getElementById('profile-name-input');
        
        if (nameInput) nameInput.value = Config.data.playerName || "";

        // Owner cheat reveal: the unlock panel exists ONLY for the Konoshi
        // profile. Toggled here so it appears/disappears live when the name
        // is saved or the profile menu is opened.
        const cheatSection = document.getElementById('cheat-section');
        if (cheatSection) cheatSection.classList.toggle('hidden', !isCheater(Config));
        
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
    },

    updateMonkeysMenu() {
        const list = document.getElementById('mm-tower-list');
        if (!list) return;
        list.innerHTML = '';
        
        const categories = {
            'Primary': [],
            'Military': [],
            'Magic': [],
            'Support': []
        };

        for (const type in TowerStats) {
            if (type.startsWith('paragon_')) continue; // paragons live in the Paragons menu, not MONKEYS
            const cat = TowerStats[type].category || TOWER_CATEGORIES[type];
            if (cat && categories[cat]) {
                categories[cat].push(type);
            }
        }

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
    },

    selectMonkey(type) {
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

        // Skill-tree convergence: if this tower has a paragon, the three paths
        // visually flow into its golden node right below the path columns.
        const pcfg = PARAGON_POWER_RULES[type];
        if (pcfg) html += this._paragonTreeSection(type, pcfg);

        info.innerHTML = html;
        if (pcfg) this._wireMonkeysParagonUnlock(type);
        info.scrollTop = 0;
    },

    // BTD6-style map select: difficulty tabs along the bottom, a 3x2 page of
    // tier-coloured cards, arrows either side to page within a tab.
    refreshPlayMaps() {
        const grid = document.getElementById('play-map-grid');
        const pageEl = document.getElementById('play-map-page');
        const tabsEl = document.getElementById('play-tabs');
        if (!grid) return;

        const st = this.playMenuState;
        const customIds = new Set((Config.data.customMaps || []).map(cm => cm.id));
        const entries = Maps.map((map, idx) => {
            const isCustom = !!map.id && customIds.has(map.id);
            return { map, idx, isCustom, tier: getMapTier(map, isCustom) };
        });

        // Tabs (the Custom tab only exists once the player has made a map).
        const tiers = MAP_TIERS.filter(t => entries.some(e => e.tier === t.id));
        if (!tiers.some(t => t.id === st.tab)) st.tab = tiers.length ? tiers[0].id : 'beginner';

        if (tabsEl) {
            tabsEl.innerHTML = '';
            tiers.forEach(t => {
                const count = entries.filter(e => e.tier === t.id).length;
                const btn = document.createElement('button');
                btn.className = 'play-tab' + (t.id === st.tab ? ' active' : '');
                btn.style.setProperty('--tier', t.color);
                btn.innerHTML = `<span class="play-tab-dot"></span>${t.label}<span class="play-tab-count">${count}</span>`;
                btn.addEventListener('click', () => { st.tab = t.id; st.page = 0; this.refreshPlayMaps(); });
                tabsEl.appendChild(btn);
            });
        }

        const visible = entries.filter(e => e.tier === st.tab);
        const totalPages = Math.max(1, Math.ceil(visible.length / st.mapsPerPage));
        if (st.page >= totalPages) st.page = totalPages - 1;
        if (st.page < 0) st.page = 0;

        const prevBtn = document.getElementById('play-prev-maps');
        const nextBtn = document.getElementById('play-next-maps');
        if (prevBtn) prevBtn.style.visibility = st.page > 0 ? 'visible' : 'hidden';
        if (nextBtn) nextBtn.style.visibility = st.page < totalPages - 1 ? 'visible' : 'hidden';

        grid.innerHTML = '';
        const start = st.page * st.mapsPerPage;
        visible.slice(start, start + st.mapsPerPage).forEach(({ map, idx, isCustom, tier }) => {
            const tierInfo = getTierInfo(tier);
            const card = document.createElement('div');
            card.className = 'play-map-card';
            card.style.setProperty('--tier', tierInfo.color);
            if (idx === st.selectedMapIndex) card.classList.add('selected');

            const thumb = document.createElement('div');
            thumb.className = 'play-map-thumb';
            const img = document.createElement('img');
            img.alt = '';
            img.loading = 'lazy';
            img.draggable = false;
            img.src = getMapThumbUrl(map);
            // No generated thumbnail yet (new/custom map)? Use the full image.
            img.onerror = () => { img.onerror = null; img.src = getMapFullUrl(map); };
            thumb.appendChild(img);

            const ribbon = document.createElement('div');
            ribbon.className = 'play-map-ribbon';
            ribbon.textContent = tierInfo.label;
            thumb.appendChild(ribbon);

            const name = document.createElement('div');
            name.className = 'play-map-name';
            name.textContent = map.name || `Map ${idx + 1}`;

            card.appendChild(thumb);
            card.appendChild(name);

            if (isCustom) {
                const delBtn = document.createElement('button');
                delBtn.className = 'map-delete-btn';
                delBtn.innerHTML = '🗑';
                delBtn.title = "Delete Custom Map";
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete custom map "${map.name}"?`)) {
                        Config.data.customMaps = Config.data.customMaps.filter(cm => cm.id !== map.id);
                        Config.save();
                        const mapIdx = Maps.indexOf(map);
                        if (mapIdx > -1) Maps.splice(mapIdx, 1);
                        if (st.selectedMapIndex >= mapIdx) st.selectedMapIndex = Math.max(0, st.selectedMapIndex - 1);
                        this.refreshPlayMaps();
                    }
                });
                card.appendChild(delBtn);
            }

            card.addEventListener('click', () => {
                st.selectedMapIndex = idx;
                this.showPlayDifficulties();
            });
            grid.appendChild(card);
        });

        if (pageEl) pageEl.innerText = totalPages > 1 ? `Page ${st.page + 1} / ${totalPages}` : '';
    },

    showPlayDifficulties() {
        LoadGate.prefetch('map', Maps[this.playMenuState.selectedMapIndex]);
        document.getElementById('play-menu-title').innerText = Maps[this.playMenuState.selectedMapIndex].name || "Select Difficulty";
        document.getElementById('play-map-view').classList.add('hidden');
        document.getElementById('play-difficulty-view').classList.remove('hidden');
        
        const grid = document.getElementById('play-difficulty-grid');
        grid.innerHTML = '';

        const categories = {
            'Easy': ['easy', 'deflation'],
            'Medium': ['medium'],
            'Hard': ['hard', 'halfcash', 'dhm', 'abr', 'impoppable', 'chimps'],
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
                    controllers.game.startGameUI(false);
                });
                catDiv.appendChild(btn);
            });
            grid.appendChild(catDiv);
        }
    },

    // Open the menu on the tab + page that contains the last-played map.
    _focusPlayTabOnSelectedMap() {
        const st = this.playMenuState;
        const map = Maps[st.selectedMapIndex];
        if (!map) return;
        const customIds = new Set((Config.data.customMaps || []).map(cm => cm.id));
        st.tab = getMapTier(map, !!map.id && customIds.has(map.id));
        const sameTab = Maps.filter(m => getMapTier(m, !!m.id && customIds.has(m.id)) === st.tab);
        st.page = Math.max(0, Math.floor(sameTab.indexOf(map) / st.mapsPerPage));
    },

    showPlayMaps() {
        document.getElementById('play-menu-title').innerText = "Maps";
        document.getElementById('play-map-view').classList.remove('hidden');
        document.getElementById('play-difficulty-view').classList.add('hidden');
        this.refreshPlayMaps();
    },

    // MONKEYS-menu paragon section: the tower's three upgrade paths converge
    // into its Paragon node (replaces the retired PARAGONS main-menu hub).
    // Shows live tower-XP progress toward the mastery badge. v1.3.2: the XP
    // unlock is a MILESTONE only - in-game creation follows BTD6 rules
    // (v1.4.0: all three T5s owned, then ANY tower of the type can buy, cash
    // permitting) with no XP requirement. Later paragons appear automatically
    // as PARAGON_POWER_RULES grows.
    _paragonTreeSection(type, cfg) {
        const xp = (Config.data.towerXp && Config.data.towerXp[type]) || 0;
        const needed = cfg.xpToUnlock || 500000;
        const unlocked = !!(Config.data.paragonUnlocks && Config.data.paragonUnlocks[type]);
        const pct = Math.min(100, (xp / needed) * 100);
        const baseName = TowerStats[type] ? TowerStats[type].name : type;

        let action;
        if (unlocked) {
            action = `<span class="mm-paragon-unlocked-tag">MASTERED</span>`;
        } else if (xp >= needed) {
            action = `<button class="mm-paragon-unlock-btn" data-paragon="${type}">MASTER</button>`;
        } else {
            action = `<span class="mm-paragon-locked-tag">MASTERY &mdash; pop bloons with the ${baseName} to earn XP</span>`;
        }

        return `
            <div class="mm-paragon-section" data-tower="${type}">
                <div class="mm-paragon-caption">The three paths converge:</div>
                <svg class="mm-paragon-fan" viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M16 0 C 16 11, 50 6, 50 20" />
                    <path d="M50 0 L 50 20" />
                    <path d="M84 0 C 84 11, 50 6, 50 20" />
                </svg>
                <div class="mm-paragon-node ${unlocked ? 'unlocked' : 'locked'}">
                    <div class="mm-paragon-name">${cfg.name}</div>
                    <div class="mm-paragon-sub">Paragon &middot; $${cfg.baseCost.toLocaleString('en-US')} &middot; in-game: own all 3 Tier 5s, then any Tier 5 of these monkeys can buy it</div>
                    <div class="mm-exp-bar-container mm-paragon-bar"><div class="mm-exp-bar-fill mm-paragon-xp-fill" style="width: ${pct.toFixed(2)}%;"></div></div>
                    <div class="mm-paragon-xp-text">${xp.toLocaleString('en-US')} / ${needed.toLocaleString('en-US')} XP</div>
                    <div class="mm-paragon-action">${action}</div>
                </div>
            </div>`;
    },

    _wireMonkeysParagonUnlock(type) {
        const btn = document.querySelector(`.mm-paragon-unlock-btn[data-paragon="${type}"]`);
        if (!btn) return;
        btn.addEventListener('click', () => {
            const cfg = PARAGON_POWER_RULES[type];
            if (!cfg) return;
            const xp = (Config.data.towerXp && Config.data.towerXp[type]) || 0;
            const needed = cfg.xpToUnlock || 500000;
            if ((Config.data.paragonUnlocks && Config.data.paragonUnlocks[type]) || xp < needed) return;
            if (!Config.data.paragonUnlocks) Config.data.paragonUnlocks = {};
            Config.data.paragonUnlocks[type] = true;
            Config.save();
            UI.updateMetaStats();
            this.selectMonkey(type); // re-render the section in its unlocked state
        });
    },

    setupMenuListeners() {
        dom.btnSandbox?.addEventListener('click', () => controllers.game.startGameUI(true));
        dom.btnHeroes?.addEventListener('click', async () => {
            await LoadGate.ensure('portraits', { label: 'Loading heroes...' });
            UI.toggleMenus('hero-select-menu');
        });
        dom.btnPowers?.addEventListener('click', () => UI.toggleMenus('powers-menu'));
        dom.btnKnowledge?.addEventListener('click', () => UI.toggleMenus('knowledge-menu'));
        dom.btnUpdateLog?.addEventListener('click', () => UI.toggleMenus('update-log-menu'));
        // Changelog X: always visible in the top-right of the window (the Back
        // button sits below the last entry, which forced scrolling to close).
        document.getElementById('update-log-close')?.addEventListener('click', () => UI.toggleMenus('main-menu-ui'));
        // Owner cheat: the section itself is toggled by updateProfileUI and only
        // exists for the Konoshi profile; the guard here is a second lock.
        document.getElementById('cheat-unlock-btn')?.addEventListener('click', () => {
            if (!isCheater(Config)) return;
            const res = unlockEverything(Config);
            UI.updateMetaStats();
            this.updateProfileUI();
            const status = document.getElementById('cheat-status');
            if (status) status.textContent = `Unlocked ${res.towers} towers & heroes, ${res.paragons} paragon(s) and ${res.knowledge} knowledge perks.`;
        });
        
        dom.btnPlay?.addEventListener('click', () => { 
            this.playMenuState.selectedMapIndex = Config.data.currentMap;
            this._focusPlayTabOnSelectedMap();
            this.showPlayMaps(); 
            UI.toggleMenus('play-menu'); 
        });
        
        document.getElementById('play-prev-maps')?.addEventListener('click', () => {
            this.playMenuState.page--;
            this.refreshPlayMaps();
        });
        document.getElementById('play-next-maps')?.addEventListener('click', () => {
            this.playMenuState.page++;
            this.refreshPlayMaps();
        });
        document.getElementById('play-back-btn')?.addEventListener('click', () => {
            const diffView = document.getElementById('play-difficulty-view');
            if (!diffView.classList.contains('hidden')) {
                this.showPlayMaps();
            } else {
                UI.toggleMenus('main-menu-ui');
            }
        });

        dom.btnMonkeys?.addEventListener('click', async () => {
            await LoadGate.ensure('portraits', { label: 'Loading monkeys...' });
            this.updateMonkeysMenu();
            UI.toggleMenus('monkeys-menu');
        });
        dom.mmTopLeft?.addEventListener('click', () => { this.updateProfileUI(); UI.toggleMenus('profile-menu'); });
        
        document.getElementById('profile-save-name')?.addEventListener('click', () => {
            const nameInput = document.getElementById('profile-name-input');
            if (nameInput) {
                Config.data.playerName = nameInput.value.trim().substring(0, 20);
                Config.save();
                UI.updateMetaStats();
                this.updateProfileUI();
            }
        });

        dom.btnSettings?.addEventListener('click', () => { GameEngine.lastMenu = 'main-menu-ui'; UI.toggleMenus('settings-menu'); });
        dom.btnMapEditor?.addEventListener('click', () => { MapEditor.init(); UI.toggleMenus('map-editor-menu'); });
        dom.btnContinue?.addEventListener('click', () => {
            if (GameEngine.loadGame()) {
                controllers.game.startGameUI(false);
            }
        });
        dom.btnAbandon?.addEventListener('click', () => GameEngine.abandonRun());
        
        // Back buttons: read the target off the BUTTON, not e.target. A nested
        // <span>/icon inside the button used to make e.target the child, whose
        // dataset.target is undefined - toggleMenus(undefined) then hid every
        // overlay INCLUDING the main menu (black screen). Same bug family as
        // the unregistered-menu close failure; fixed together.
        dom.backBtns.forEach(btn => btn.addEventListener('click', () => UI.toggleMenus(btn.dataset.target)));
        dom.settingsBackBtn?.addEventListener('click', () => UI.toggleMenus(GameEngine.lastMenu));
        dom.goMenuBtn?.addEventListener('click', () => {
            // v1.4.2: game-over/victory -> menu now fades through black like
            // every other menu return (cohesion) instead of a hard cut.
            FadeVeil.through(() => this._returnToMenu());
        });
        dom.vicMenuBtn?.addEventListener('click', () => {
            // v1.4.2: same fade for the victory screen's menu button.
            FadeVeil.through(() => this._returnToMenu());
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
                    this.updateShopUI();
                    updateShopPrices(); 
                } else {
                    alert("Not enough Monkey Money!");
                }
            });
        });
    }
};
