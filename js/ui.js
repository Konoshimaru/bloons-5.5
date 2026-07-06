// ui.js
// Manages the HUD, shop, upgrade panel, and menus.

import { TowerStats, Upgrades } from './towers/index.js';
import { Config, HeroStats } from './config.js';
import { getEffectiveCooldown } from './towerBehavior.js';

// Cache DOM elements so the UI can update them quickly without repeatedly querying the page.
const elements = {};
function el(id) {
    if (!elements[id]) {
        elements[id] = document.getElementById(id);
    }
    return elements[id];
}

const MENUS = ['main-menu', 'maps-menu', 'settings-menu', 'pause-menu', 'game-over-menu', 'custom-maps-menu', 'difficulty-menu', 'hero-select-menu'];
const SPEED_TEXTS = ["Start Wave", "1x", "2x", "3x", "5x", "10x", "20x"];
const FLAVOR_OPACITY_VISIBLE = 1;
const FLAVOR_OPACITY_HIDDEN = 0;

// UI manages the on-screen panels, buttons, shop cards, upgrade panels, and message log.
export const UI = {
    _towerCardCache: null,

    toggleMenus(menuId) {
        // Menus are hidden and shown by toggling a shared CSS class, keeping the page structure simple.
        for (const id of MENUS) {
            const menu = el(id);
            if (menu) menu.classList.add('hidden');
        }
        const target = el(menuId);
        if (target) target.classList.remove('hidden');
    },

    showPause() {
        const pauseMenu = el('pause-menu');
        if (pauseMenu) pauseMenu.classList.remove('hidden');
    },

    hidePause() {
        const pauseMenu = el('pause-menu');
        if (pauseMenu) pauseMenu.classList.add('hidden');
    },

    updateMetaStats() {
        const levelEl = el('menu-player-level');
        const mmEl = el('menu-monkey-money');
        const continueBtn = el('continue-btn');
        const abandonBtn = el('abandon-btn');
        
        if (levelEl) levelEl.innerText = `Level ${Config.data.playerLevel}`;
        if (mmEl) mmEl.innerText = `$${Config.data.monkeyMoney}`;
        
        const hasSave = !!Config.data.savedRun;
        if (continueBtn) continueBtn.style.display = hasSave ? 'block' : 'none';
        if (abandonBtn) abandonBtn.style.display = hasSave ? 'block' : 'none';
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
        const panel = el('upgrade-panel');
        if (panel) panel.classList.add('hidden');
    },

    log(msg) {
        const logEl = el('message-log');
        if (logEl) logEl.innerText = msg;
    },

    updateLives(lives) {
        const livesEl = el('lives-display');
        if (livesEl) livesEl.innerText = `Lives: ${lives}`;
    },

    updateWave(wave) {
        const waveEl = el('wave-display');
        if (waveEl) waveEl.innerText = `Wave ${wave}`;
    },

    updateCash(cash, engine) {
        // The cash display and shop card availability both depend on the player economy, so they update together.
        const cashEl = el('cash-display');
        if (cashEl) cashEl.innerText = `$${cash}`;

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

        if (engine.selectedPlacedTower && !engine.selectedPlacedTower.stats.isHero) {
            this._updateUpgradeCards(engine.selectedPlacedTower, engine);
        }
    },

    refreshSelectedTower(engine) {
        const selected = engine.selectedPlacedTower;
        if (!selected) return;

        const panel = el('upgrade-panel');
        if (!panel || panel.classList.contains('hidden')) return;

        if (selected.stats.isHero) {
            this._showHeroUI(selected, engine);
        } else {
            this._showTowerUI(selected, engine);
        }
    },

    updateAbilityBar(engine) {
        const bar = el('ability-bar');
        if (!bar) return;
        
        if (engine.gameState !== 'playing') {
            bar.classList.add('hidden');
            return;
        }
        bar.classList.remove('hidden');

        const abilities = this._collectAbilities(engine);

        if (bar.children.length !== abilities.length) {
            bar.innerHTML = '';
            abilities.forEach(ab => {
                const icon = document.createElement('div');
                icon.className = 'ability-icon';
                icon.addEventListener('click', () => {
                    if (icon._tower && icon._slot) {
                        engine.activateAbility(icon._slot, icon._tower);
                    }
                });
                bar.appendChild(icon);
            });
        }

        for (let i = 0; i < abilities.length; i++) {
            const ab = abilities[i];
            const icon = bar.children[i];
            if (!icon) continue;
            
            icon.innerText = ab.name;
            icon._tower = ab.tower;
            icon._slot = ab.slot;
            
            let overlay = icon.querySelector('.cooldown-overlay');
            if (ab.cd > 0) {
                icon.classList.add('disabled');
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.className = 'cooldown-overlay';
                    icon.appendChild(overlay);
                }
                overlay.style.height = `${Math.min(100, (ab.cd / ab.maxCd) * 100)}%`;
                overlay.innerText = Math.ceil(ab.cd) + 's';
            } else {
                icon.classList.remove('disabled');
                if (overlay) overlay.remove();
            }
        }
    },

    _collectAbilities(engine) {
        const abilities = [];
        for (const t of engine.towers) {
            if (!t) continue;
            if (t.stats.isHero) {
                this._collectHeroAbilities(t, abilities);
            } else if (t.stats.isAbility) {
                let towerCd = t.stats.abilityCd || 45;
                let towerName = t.stats.abilityName || "Ability";
                if (t.type === 'tack') {
                    towerCd = 35;
                    towerName = t.upgrades[1] === 5 ? "Super Maelstrom" : "Blade Maelstrom";
                }
                abilities.push({ tower: t, slot: 1, cd: t.abilityCooldown || 0, maxCd: towerCd, name: towerName });
            }
        }
        return abilities;
    },

    _collectHeroAbilities(t, abilities) {
        let ab1Name = "Ability 1", ab2Name = "Ability 2";
        let ab1Cd = 60, ab2Cd = 70;
        
        if (t.type === 'quincy') {
            ab1Name = "Rapid"; ab2Name = "Storm";
            ab1Cd = t.stats.rapidShotCd || 60;
            ab2Cd = t.stats.stormCd || 70;
        } else if (t.type === 'gwendolin') {
            ab1Name = "Cocktail"; ab2Name = "Firestorm";
            ab1Cd = 30; ab2Cd = 60;
        } else if (t.type === 'gojo') {
            if (t.phase === 2) {
                ab1Name = "Reversal Red"; ab1Cd = 30;
                ab2Name = "Hollow Purple"; ab2Cd = 90;
            } else {
                ab1Name = "Fake Red"; ab1Cd = 10;
                ab2Name = "Max Blue"; ab2Cd = 45;
            }
        }
        
        if (t.stats.isAbility) {
            abilities.push({ tower: t, slot: 1, cd: t.abilityCooldown || 0, maxCd: ab1Cd, name: ab1Name });
        }
        if (t.stats.isAbility2) {
            abilities.push({ tower: t, slot: 2, cd: t.ability2Cooldown || 0, maxCd: ab2Cd, name: ab2Name });
        }
        if (t.stats.isAbility3) {
            const name = t.type === 'gojo' ? "0.2 Domain" : "Ability 3";
            abilities.push({ tower: t, slot: 3, cd: t.ability3Cooldown || 0, maxCd: 120, name });
        }
    },

    showUpgradeUI(t, engine) {
        // Selecting a tower opens the upgrade panel and populates it with tower-specific information and buttons.
        const panel = el('upgrade-panel');
        if (!panel) return;
        panel.classList.remove('hidden');
        
        this._setupSellAndBankButtons(panel, t);
        
        if (t.stats.isHero) {
            this._showHeroUI(t, engine);
        } else {
            this._showTowerUI(t, engine);
        }
        
        if (t.x > 360) {
            panel.style.left = '20px';
            panel.style.right = 'auto';
        } else {
            panel.style.right = '200px';
            panel.style.left = 'auto';
        }
    },

    _setupSellAndBankButtons(panel, t) {
        const sellBtn = el('up-sell');
        if (sellBtn && sellBtn.parentElement !== panel) {
            panel.appendChild(sellBtn);
        }
        if (sellBtn) sellBtn.classList.remove('hidden');
        
        const bankBtn = el('up-collect-bank');
        if (bankBtn) {
            const showBank = t.type === 'farm' && t.stats.isBank && t.bankBalance > 0;
            if (showBank) {
                bankBtn.classList.remove('hidden');
                bankBtn.innerText = `Collect Bank ($${Math.floor(t.bankBalance)})`;
            } else {
                bankBtn.classList.add('hidden');
            }
        }
    },

    _showHeroUI(t, engine) {
        const heroUI = el('hero-ui');
        const towerUI = el('tower-ui');
        if (heroUI) heroUI.classList.remove('hidden');
        if (towerUI) towerUI.classList.add('hidden');
        
        const heroTitle = el('hero-title');
        if (heroTitle) {
            let title = t.stats.name;
            if (t.type === 'gojo') title += t.phase === 2 ? " (Awakened)" : " (Teen)";
            heroTitle.innerText = title;
        }
        
        const heroPops = el('hero-pops');
        if (heroPops) heroPops.innerText = `Pops: ${t.damageDealt}`;
        
        const heroLevelText = el('hero-level-text');
        if (heroLevelText) {
            heroLevelText.innerText = `Level ${t.level} / 20 | XP: ${t.xp} / ${t.xpToNext}`;
        }
        
        const heroExpFill = el('hero-exp-fill');
        if (heroExpFill) {
            heroExpFill.style.width = `${(t.xp / t.xpToNext) * 100}%`;
        }
        
        const upTargeting = el('up-targeting');
        if (upTargeting) upTargeting.innerText = `Target: ${t.targetingMode}`;
        
        this._updateHeroBuyButton(t, engine);
    },

    _updateHeroBuyButton(t, engine) {
        const buyBtn = el('up-buy-level');
        if (!buyBtn) return;
        
        if (t.level < 20) {
            buyBtn.classList.remove('hidden');
            const cost = t.xpToNext - t.xp;
            buyBtn.innerText = `Buy Level ($${cost})`;
            if (engine.cash < cost) {
                buyBtn.classList.add('disabled');
            } else {
                buyBtn.classList.remove('disabled');
            }
        } else {
            buyBtn.classList.add('hidden');
        }
    },

    _showTowerUI(t, engine) {
        const heroUI = el('hero-ui');
        const towerUI = el('tower-ui');
        if (heroUI) heroUI.classList.add('hidden');
        if (towerUI) towerUI.classList.remove('hidden');
        
        const upTitle = el('up-title');
        if (upTitle) upTitle.innerText = TowerStats[t.type].name;
        
        this._updateTowerStats(t);
        this._updateTowerCounters(t);
        
        const upTargetingTower = el('up-targeting-tower');
        if (upTargetingTower) upTargetingTower.innerText = `Target: ${t.targetingMode}`;
        
        this._updateUpgradeCards(t, engine);
    },

    _updateTowerStats(t) {
        const upStats = el('up-stats');
        if (!upStats) return;
        
        const effRate = getEffectiveCooldown(t);
        const effPierce = t.stats.pierce + (t.buffedPierce || 0) + (t.alchBuff ? t.alchBuff.pierce : 0);
        const effDmg = t.stats.damage + (t.buffedDmg || 0) + (t.alchBuff ? t.alchBuff.dmg : 0);
        
        upStats.innerText = `DMG: ${effDmg} | RNG: ${t.stats.range === 9999 ? 'Global' : t.stats.range} | RATE: ${effRate.toFixed(2)}s | PRC: ${effPierce}`;
    },

    _updateTowerCounters(t) {
        const upCounters = el('up-counters');
        if (!upCounters) return;
        
        let counters = "";
        if (t.type === 'farm' && t.stats.isBank) {
            counters = `Bank: $${Math.floor(t.bankBalance)}`;
        } else if (t.type === 'farm') {
            counters = `Cash Gen: $${t.cashGenerated}`;
        } else if (t.type === 'engineer' && t.activeTrap) {
            counters = `Trap: ${t.activeTrap.rbe}/${t.activeTrap.maxRbe}`;
        } else {
            counters = `Dmg Dealt: ${t.damageDealt}`;
        }
        upCounters.innerText = counters;
    },

    _updateUpgradeCards(t, engine) {
        this._updateUpgradeCard('up-path1', t, 1, engine);
        this._updateUpgradeCard('up-path2', t, 2, engine);
        this._updateUpgradeCard('up-path3', t, 3, engine);
    },

    updateUpgradeCard(id, tower, path, engine) {
        this._updateUpgradeCard(id, tower, path, engine);
    },

    _updateUpgradeCard(id, tower, path, engine) {
        const card = el(id);
        if (!card) return;
        
        const tier = tower.upgrades[path - 1];
        const upgradeData = Upgrades[tower.type][path][tier];
        
        card.classList.remove('locked');
        
        if (!upgradeData) {
            const nameEl = card.querySelector('.up-name');
            const costEl = card.querySelector('.cost');
            if (nameEl) nameEl.innerText = "MAXED (5/5)";
            if (costEl) costEl.innerText = "";
            card.classList.add('locked');
            return;
        }
        
        const cost = engine.getCost(upgradeData.cost);
        const nameEl = card.querySelector('.up-name');
        const costEl = card.querySelector('.cost');
        
        if (nameEl) nameEl.innerText = `${upgradeData.name} (${tier + 1}/5)`;
        if (costEl) costEl.innerText = `$${cost}`;
        
        if (engine.cash < cost || !tower.canUpgrade(path, engine)) {
            card.classList.add('locked');
        }
    }
};
