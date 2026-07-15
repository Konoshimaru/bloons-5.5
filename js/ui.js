// ui.js
import { TowerStats, Upgrades } from './towers/index.js';
import { Config, HeroStats } from './config.js';
import { getEffectiveCooldown } from './towerBehavior.js';
import { HeroRegistry } from './heroes/index.js';

const elements = {};
function el(id) {
    if (!elements[id]) {
        elements[id] = document.getElementById(id);
    }
    return elements[id];
}

const MENUS = ['play-menu', 'hero-select-menu', 'knowledge-menu', 'powers-menu', 'difficulty-menu', 'maps-menu', 'settings-menu', 'pause-menu', 'game-over-menu', 'map-editor-menu', 'custom-maps-menu'];
const SPEED_TEXTS = ["Start Wave", "1x", "2x", "3x", "5x", "10x", "20x"];

export const UI = {
    _towerCardCache: null,

    toggleMenus(menuId) {
        let anyOverlayVisible = false;
        for (const id of MENUS) {
            const menu = el(id);
            if (menu) menu.classList.add('hidden');
        }
        
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

    hidePause() {
        const pauseMenu = el('pause-menu');
        if (pauseMenu) pauseMenu.classList.add('hidden');
    },

    updateMetaStats() {
        const levelEl = el('mm-level-text');
        const xpEl = el('mm-xp-text');
        const expFill = el('mm-exp-fill');
        const mmEl = el('mm-top-right');
        const continueBtn = el('btn-continue');
        const abandonBtn = el('btn-abandon');
        
        if (levelEl) levelEl.innerText = `Level ${Config.data.playerLevel}`;
        if (xpEl) xpEl.innerText = `${Config.data.playerXP} / ${Config.data.playerXPToNext} XP`;
        if (expFill) expFill.style.width = `${(Config.data.playerXP / Config.data.playerXPToNext) * 100}%`;
        if (mmEl) mmEl.innerText = `🐵 $${Config.data.monkeyMoney}`;
        
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
        const panel = el('upgrade-sidebar');
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

        const panel = el('upgrade-sidebar');
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
        const panel = el('upgrade-sidebar');
        if (!panel) return;
        panel.classList.remove('hidden');
        
        this._setupSellAndBankButtons(panel, t);
        
        if (t.stats.isHero) {
            this._showHeroUI(t, engine);
        } else {
            this._showTowerUI(t, engine);
        }
    },

    _setupSellAndBankButtons(panel, t) {
        const sellBtn = el('up-sell');
        if (sellBtn && sellBtn.parentElement !== panel) {
            panel.appendChild(sellBtn);
        }
        if (sellBtn) {
            sellBtn.classList.remove('hidden');
            let resaleRate = 0.70;
            if (t.type === 'farm' && t.upgrades[2] >= 2) resaleRate = 0.80;
            const sellValue = Math.floor(t.totalSpent * resaleRate);
            sellBtn.innerText = `Sell ($${sellValue})`;
        }
        
        const bankBtn = el('up-collect-bank');
        if (bankBtn && bankBtn.parentElement !== panel) {
            panel.appendChild(bankBtn);
        }
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
        if (heroUI) heroUI.classList.remove('hidden');
        
        const pathsEl = el('up-paths');
        if (pathsEl) pathsEl.classList.add('hidden');
        
        const statsEl = el('up-stats');
        if (statsEl) statsEl.classList.add('hidden');
        
        const title = el('up-title');
        if (title) {
            let titleStr = t.stats.name;
            if (t.type === 'gojo') titleStr += t.phase === 2 ? " (Awakened)" : " (Teen)";
            title.innerText = titleStr;
        }
        
        const counters = el('up-counters');
        if (counters) counters.innerText = `Pops: ${t.damageDealt}`;
        
        const levelText = el('hero-level-text');
        if (levelText) {
            levelText.innerText = `Level ${t.level} / 20 | XP: ${t.xp} / ${t.xpToNext}`;
        }
        
        const expFill = el('hero-exp-fill');
        if (expFill) {
            expFill.style.width = `${(t.xp / t.xpToNext) * 100}%`;
        }
        
        const currentDesc = el('hero-current-desc');
        if (currentDesc) {
            currentDesc.innerText = this._getHeroLevelDescription(t.type, t.level);
        }
        
        const nextDesc = el('hero-next-desc');
        if (nextDesc) {
            nextDesc.innerText = t.level < 20 ? `Next: ${this._getHeroLevelDescription(t.type, t.level + 1)}` : "Max Level Reached";
        }
        
        this._updateHeroBuyButton(t, engine);
        this._updateTargetingText(t);
    },

    _getHeroLevelDescription(type, level) {
        const levelData = HeroRegistry[type].levels[level];
        if (!levelData || levelData.length === 0) return `Level ${level}: Base Stats`;
        return `Level ${level}: ` + levelData.map(mod => {
            if (typeof mod.amount === 'boolean') return `Unlocks ${mod.stat}`;
            if (mod.amount > 0) return `+${mod.amount} ${mod.stat}`;
            return `${mod.amount} ${mod.stat}`;
        }).join(', ');
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
        if (heroUI) heroUI.classList.add('hidden');
        
        const pathsEl = el('up-paths');
        if (pathsEl) pathsEl.classList.remove('hidden');
        
        const title = el('up-title');
        if (title) title.innerText = TowerStats[t.type].name;
        
        const counters = el('up-counters');
        if (counters) counters.innerText = this._getTowerCounterText(t);
        
        const statsEl = el('up-stats');
        if (Config.data.showTowerStats) {
            if (statsEl) {
                statsEl.classList.remove('hidden');
                this._updateTowerStats(t);
            }
        } else {
            if (statsEl) statsEl.classList.add('hidden');
        }
        
        // PRO FIX: Hide targeting row for Spike Factory without Smart Spikes
        const targetingRow = el('up-targeting-row');
        if (targetingRow) {
            if (t.type === 'spike' && !t.stats.smartSpikes) {
                targetingRow.classList.add('hidden');
            } else {
                targetingRow.classList.remove('hidden');
            }
        }
        
        this._updateTargetingText(t);
        this._updateUpgradeCards(t, engine);
    },

    _getTowerCounterText(t) {
        if (t.type === 'farm' && t.stats.isBank) return `Bank: $${Math.floor(t.bankBalance)}`;
        if (t.type === 'farm') return `Cash Gen: $${t.cashGenerated}`;
        if (t.type === 'engineer' && t.activeTrap) return `Trap: ${t.activeTrap.rbe}/${t.activeTrap.maxRbe}`;
        return `Dmg Dealt: ${t.damageDealt}`;
    },

    _updateTowerStats(t) {
        const upStats = el('up-stats');
        if (!upStats) return;
        const effRate = getEffectiveCooldown(t);
        const effPierce = t.stats.pierce + (t.buffedPierce || 0) + (t.alchBuff ? t.alchBuff.pierce : 0);
        const effDmg = t.stats.damage + (t.buffedDmg || 0) + (t.alchBuff ? t.alchBuff.dmg : 0);
        upStats.innerText = `DMG: ${effDmg} | RNG: ${t.stats.range === 9999 ? 'Global' : t.stats.range} | RATE: ${effRate.toFixed(2)}s | PRC: ${effPierce}`;
    },

    _updateTargetingText(t) {
        const targetText = el('up-target-text');
        if (targetText) targetText.innerText = t.targetingMode;
    },

    _updateUpgradeCards(t, engine) {
        for (let i = 1; i <= 3; i++) {
            const card = el(`up-path${i}`);
            if (!card) continue;
            
            const tierBoxes = el(`tier-boxes-${i}`);
            const tier = t.upgrades[i - 1];
            const upgradeData = Upgrades[t.type][i][tier];

            let newName = "";
            let newCost = "";
            let newLocked = false;

            if (!upgradeData) {
                newName = "MAXED";
                newCost = "";
                newLocked = true;
            } else {
                const cost = engine.getCost(upgradeData.cost);
                newName = upgradeData.name;
                newCost = `$${cost}`;
                if (engine.cash < cost || !t.canUpgrade(i, engine)) {
                    newLocked = true;
                }
            }

            // ISSUE 1 FIX: Cache state to prevent unnecessary DOM updates
            if (!card._cache) card._cache = { tier: -1, name: "", cost: "", locked: null };
            const cache = card._cache;
            
            // Rebuild tier boxes only if tier changed
            if (cache.tier !== tier && tierBoxes) {
                tierBoxes.innerHTML = '';
                for (let j = 0; j < 5; j++) {
                    const box = document.createElement('div');
                    box.className = 'tier-box';
                    if (j < tier) box.classList.add('filled');
                    tierBoxes.appendChild(box);
                }
                cache.tier = tier;
            }

            // Update text and locked state only if changed
            if (cache.name !== newName || cache.cost !== newCost || cache.locked !== newLocked) {
                const nameEl = card.querySelector('.up-name');
                const costEl = card.querySelector('.cost');
                if (nameEl) nameEl.innerText = newName;
                if (costEl) costEl.innerText = newCost;
                
                card.classList.remove('locked');
                if (newLocked) card.classList.add('locked');
                
                cache.name = newName;
                cache.cost = newCost;
                cache.locked = newLocked;
            }
        }
    }
};