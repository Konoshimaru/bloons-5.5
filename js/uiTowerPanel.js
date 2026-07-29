// js/uiTowerPanel.js
import { TowerStats, Upgrades } from './towers/index.js';
import { Config } from './config.js';
import { getEffectiveCooldown } from './towerBehavior.js';
import { HeroRegistry } from './heroes/index.js';
import { getSellRate } from './towerEconomy.js';
import { getBehavior } from './registry.js'; // FIX: Import getBehavior

const _elCache = {};
function el(id) {
    if (!_elCache[id]) {
        _elCache[id] = document.getElementById(id);
    }
    return _elCache[id];
}

const uiTowerPanel = {
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
            if (!t || t.isMinion) continue; 
            if (t.stats.isHero) {
                this._collectHeroAbilities(t, abilities);
            } else if (t.stats.isAbility) {
                let towerCd = t.stats.abilityCd || 45;
                let towerName = t.stats.abilityName || "Ability";
                if (t.type === 'tack') {
                    towerCd = 35;
                    towerName = t.upgrades[1] === 5 ? "Super Maelstrom" : "Blade Maelstrom";
                }
                
                let cd = t.abilityCooldown || 0;
                const behavior = getBehavior(t.type);
                // FIX: Let the tower module decide which entity's cooldown to check
                if (behavior?.getAbilityTarget) {
                    let target = behavior.getAbilityTarget(t, 1);
                    if (target) cd = target.abilityCooldown || 0;
                }
                abilities.push({ tower: t, slot: 1, cd: cd, maxCd: towerCd, name: towerName });
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
        
        if (t.x > 640) {
            panel.classList.remove('sidebar-right'); 
        } else {
            panel.classList.add('sidebar-right'); 
        }
        
        this._setupSellAndBankButtons(panel, t, engine);
        this._updatePortrait(t);
        
        if (t.stats.isHero) {
            this._showHeroUI(t, engine);
        } else {
            this._showTowerUI(t, engine);
        }
    },

    _updatePortrait(t) {
        const portrait = el('up-portrait');
        if (!portrait) return;

        // FIX: Use duck-typing for minion portraits instead of checking type strings
        if (t.isMinion && typeof t.drawPortrait === 'function') {
            t.drawPortrait(portrait);
            return;
        }

        let bestTier = 0, bestPath = 0;
        for (let p = 1; p <= 3; p++) {
            if (t.upgrades && t.upgrades[p - 1] > bestTier) {
                bestTier = t.upgrades[p - 1];
                bestPath = p;
            }
        }

        let imgPath = '';
        if (bestTier > 0) {
            imgPath = `sprites/portraits/${t.type}_p${bestPath}_t${bestTier}.png`;
        } else {
            imgPath = `sprites/portraits/${t.type}_menuportrait.png`;
        }

        portrait.style.backgroundImage = `url('${imgPath}')`;
        portrait.style.backgroundSize = 'cover';
        portrait.style.backgroundPosition = 'center';
    },

    _setupSellAndBankButtons(panel, t, engine) {
        const sellBtn = el('up-sell');
        if (sellBtn && sellBtn.parentElement !== panel) {
            panel.appendChild(sellBtn);
        }
        if (sellBtn) {
            if (t.isMinion) { sellBtn.classList.add('hidden'); return; }
            sellBtn.classList.remove('hidden');
            const resaleRate = getSellRate(t, engine);
            const sellValue = Math.floor(t.totalSpent * resaleRate);
            sellBtn.innerText = `Sell ($${sellValue})`;
        }
        
        const bankBtn = el('up-collect-bank');
        if (bankBtn && bankBtn.parentElement !== panel) {
            panel.appendChild(bankBtn);
        }
        if (bankBtn) {
            // FIX: Use stats.isBank instead of type === 'farm'
            const showBank = t.stats.isBank && t.bankBalance > 0;
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
        const targetingRow = el('up-targeting-row');
        
        // Minions never show upgrade paths
        if (pathsEl) pathsEl.classList.toggle('hidden', t.isMinion);
        
        const behavior = getBehavior(t.type);

        // FIX: Generic targeting row visibility check
        let canTarget = !t.isMinion; // Default: non-minions can target
        if (t.canChangeTargeting !== undefined) canTarget = t.canChangeTargeting; // For Sentry/Beast instances
        if (behavior?.canChangeTargeting) canTarget = behavior.canChangeTargeting(t); // For Village/Spike
        
        if (targetingRow) targetingRow.classList.toggle('hidden', !canTarget);

        // FIX: Generic secondary targeting row (Super Monkey)
        let targetingRow2 = el('up-targeting-row-2');
        let hasSecondary = !t.isMinion && behavior?.hasSecondaryTargeting && behavior.hasSecondaryTargeting(t);
        
        if (hasSecondary) {
            if (!targetingRow2 && targetingRow) {
                targetingRow2 = targetingRow.cloneNode(true);
                targetingRow2.id = 'up-targeting-row-2';
                
                const prev2 = targetingRow2.querySelector('#up-target-prev');
                const next2 = targetingRow2.querySelector('#up-target-next');
                const text2 = targetingRow2.querySelector('#up-target-text');
                
                if (prev2) prev2.id = 'up-target-prev-2';
                if (next2) next2.id = 'up-target-next-2';
                if (text2) text2.id = 'up-target-text-2';
                
                targetingRow.parentNode.insertBefore(targetingRow2, targetingRow.nextSibling);
                
                const newPrev2 = targetingRow2.querySelector('#up-target-prev-2');
                const newNext2 = targetingRow2.querySelector('#up-target-next-2');
                
                if (newPrev2) newPrev2.addEventListener('click', () => engine.cycleTargeting(-1, 2));
                if (newNext2) newNext2.addEventListener('click', () => engine.cycleTargeting(1, 2));
                
                _elCache['up-targeting-row-2'] = targetingRow2;
                _elCache['up-target-prev-2'] = newPrev2;
                _elCache['up-target-next-2'] = newNext2;
                _elCache['up-target-text-2'] = targetingRow2.querySelector('#up-target-text-2');
            }
            if (targetingRow2) targetingRow2.classList.remove('hidden');
        } else if (targetingRow2) {
            targetingRow2.classList.add('hidden');
        }
        
        this._updateTargetingText(t);

        // FIX: Let the tower module setup its own custom UI (e.g. Beast buttons)
        if (behavior?.setupCustomUI) {
            behavior.setupCustomUI(el('upgrade-sidebar'), t, engine);
        } else {
            el('beast-place-btn')?.classList.add('hidden');
            el('beast-merge-btn')?.classList.add('hidden');
        }

        if (!t.isMinion) {
            this._updateUpgradeCards(t, engine);
        }
    },

    _setupBeastUI(pathsEl, t, engine) {
        // This method is now only called internally by beast.js via setupCustomUI
        const panel = el('upgrade-sidebar');
        
        let placeBtn = el('beast-place-btn');
        if (!placeBtn) {
            placeBtn = document.createElement('button');
            placeBtn.id = 'beast-place-btn';
            placeBtn.innerText = 'Place';
            placeBtn.style.position = 'absolute';
            placeBtn.style.background = '#2ecc71';
            placeBtn.style.color = 'white';
            placeBtn.style.border = 'none';
            placeBtn.style.borderRadius = '4px';
            placeBtn.style.cursor = 'pointer';
            placeBtn.style.fontWeight = 'bold';
            placeBtn.style.width = '60px';
            placeBtn.style.height = '30px';
            placeBtn.style.top = '15px';
            placeBtn.style.right = '15px';
            panel.appendChild(placeBtn);
            _elCache['beast-place-btn'] = placeBtn;
            
            placeBtn.addEventListener('click', () => {
                if (engine.selectedPlacedTower) {
                    engine.placingBeastFor = engine.selectedPlacedTower; 
                    engine.log("Click anywhere in range to place your beast.");
                }
            });
        }
        
        if (!t.beast) placeBtn.classList.add('hidden');
        else placeBtn.classList.remove('hidden');

        let mergeBtn = el('beast-merge-btn');
        if (!mergeBtn) {
            mergeBtn = document.createElement('button');
            mergeBtn.id = 'beast-merge-btn';
            mergeBtn.innerText = 'Merge';
            mergeBtn.style.position = 'absolute';
            mergeBtn.style.background = '#f1c40f';
            mergeBtn.style.color = 'black';
            mergeBtn.style.border = 'none';
            mergeBtn.style.borderRadius = '4px';
            mergeBtn.style.cursor = 'pointer';
            mergeBtn.style.fontWeight = 'bold';
            mergeBtn.style.width = '60px';
            mergeBtn.style.height = '30px';
            mergeBtn.style.top = '50px';
            mergeBtn.style.right = '15px';
            panel.appendChild(mergeBtn);
            _elCache['beast-merge-btn'] = mergeBtn;
            
            mergeBtn.addEventListener('click', () => {
                if (engine.selectedPlacedTower) {
                    engine.isMergingBeast = true; 
                    engine.mergeSourceTower = engine.selectedPlacedTower; 
                    engine.log("Select another Beast Handler to merge into!");
                }
            });
        }
        
        if (!t.beast) mergeBtn.classList.add('hidden');
        else mergeBtn.classList.remove('hidden');
    },

    _getTowerCounterText(t) {
        // FIX: Let the tower module or instance provide its own counter text
        if (typeof t.getCounterText === 'function') return t.getCounterText();
        const behavior = getBehavior(t.type);
        if (behavior?.getCounterText) return behavior.getCounterText(t);
        
        return `Dmg Dealt: ${Number(t.damageDealt) || 0}`;
    },

    _updateTowerStats(t) {
        const upStats = el('up-stats');
        if (!upStats) return;
        const effRate = getEffectiveCooldown(t);
        
        const basePierce = Number(t.stats.pierce) || 0;
        const buffedPierce = Number(t.buffedPierce) || 0;
        const alchPierce = (t.alchBuff && Number(t.alchBuff.pierce)) || 0;
        const effPierce = basePierce + buffedPierce + alchPierce;
        
        const baseDmg = Number(t.stats.damage) || 0;
        const buffedDmg = Number(t.buffedDmg) || 0;
        const alchDmg = (t.alchBuff && Number(t.alchBuff.dmg)) || 0;
        const effDmg = baseDmg + buffedDmg + alchDmg;
        
        upStats.innerText = `DMG: ${effDmg} | RNG: ${t.stats.range === 9999 ? 'Global' : t.stats.range} | RATE: ${effRate.toFixed(2)}s | PRC: ${effPierce}`;
    },

    _updateTargetingText(t) {
        const targetText = el('up-target-text');
        if (targetText) targetText.innerText = t.targetingMode || 'First';
        
        const targetText2 = el('up-target-text-2');
        if (targetText2) targetText2.innerText = t.targetingMode2 || 'First';
    },

    _updateUpgradeCards(t, engine) {
        if (!t || t.isMinion || t.stats.isHero || !Upgrades[t.type]) return;

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

            if (!card._cache) card._cache = { tier: -1, name: "", cost: "", locked: null };
            const cache = card._cache;
            
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
        
        this._updatePortrait(t);
    }
};

export default uiTowerPanel;