// js/levelManager.js
import { Config } from './config.js';
import { LevelProgression } from './levelData.js';
import { TowerStats, TOWER_CATEGORIES } from './towers/index.js';
import { HeroStats } from './heroes/index.js';
import { HeroRegistry } from './heroes/index.js';
import { UI } from './ui.js';
import { updateShopPrices } from './dragManager.js';
import { GameEngine } from './engine.js';

export const LevelManager = {
    // Queue of player levels reached but not yet presented (each may need an
    // interactive "pick a tower" screen). Drained one at a time so multiple
    // simultaneous level-ups pause the game sequentially instead of stacking
    // DOM overlays on top of each other.
    _pendingLevels: [],
    _levelUpActive: false,
    _pausedForLevelUp: false,
    _prevGameState: null,

    addXP(amount, opts = {}) {
        Config.data.playerXP += amount;

        while (Config.data.playerXP >= Config.data.playerXPToNext) {
            Config.data.playerXP -= Config.data.playerXPToNext;
            Config.data.playerLevel++;

            const nextLevelData = LevelProgression[Config.data.playerLevel + 1];
            const currentLevelData = LevelProgression[Config.data.playerLevel];

            if (currentLevelData) {
                Config.data.playerXPToNext = currentLevelData.xpFromPrev;
            }
            if (nextLevelData) {
                Config.data.playerXPToNext = nextLevelData.xpFromPrev;
            }

            this._pendingLevels.push(Config.data.playerLevel);
        }

        Config.save();
        UI.updateMetaStats();
        if (this._pendingLevels.length > 0) this._drainPendingLevels(opts);
    },

    // Presents each queued level-up in order. Non-interactive levels are
    // granted silently; category levels show the tower-choice screen (pausing
    // the game if we're mid-round). Falls back to auto-granting everything for
    // reconcile-style calls.
    _drainPendingLevels(opts = {}) {
        if (this._levelUpActive) return;
        this._levelUpActive = true;
        try {
            while (this._pendingLevels.length > 0) {
                const level = this._pendingLevels[0];
                if (Config.data.claimedLevels.includes(level)) { this._pendingLevels.shift(); continue; }
                const category = this._categoryOfLevel(level);
                if (category && !opts.autoGrantCategory) {
                    this._pauseForLevelUp();
                    this._showSelectionScreen(category, level, () => {
                        this._levelUpActive = false;
                        this._drainPendingLevels(opts);
                    });
                    return;
                }
                this._pendingLevels.shift();
                this._processLevelUp(level, { autoGrantCategory: !!opts.autoGrantCategory });
            }
            this._levelUpActive = false;
            this._resumeFromLevelUp();
        } catch (e) {
            this._levelUpActive = false;
            console.error('[LevelManager] level-up queue error:', e);
            this._resumeFromLevelUp();
        }
    },

    _categoryOfLevel(level) {
        const unlockText = (LevelProgression[level] || {}).unlocks || '';
        if (unlockText.includes("Primary tower")) return 'Primary';
        if (unlockText.includes("Military tower")) return 'Military';
        if (unlockText.includes("Magic tower")) return 'Magic';
        if (unlockText.includes("Support tower")) return 'Support';
        return null;
    },

    // Freezes the simulation (gameState 'levelup') while a level-up screen is
    // open during an active run. The loop only updates on 'playing', so this
    // pauses the round without showing the pause menu. No-op at game over.
    _pauseForLevelUp() {
        if (GameEngine.gameState === 'playing') {
            this._prevGameState = GameEngine.gameState;
            GameEngine.gameState = 'levelup';
            this._pausedForLevelUp = true;
        }
    },

    _resumeFromLevelUp() {
        if (this._pausedForLevelUp) {
            GameEngine.gameState = this._prevGameState || 'playing';
            this._pausedForLevelUp = false;
            this._prevGameState = null;
            UI.updateMetaStats();
        }
    },

    _processLevelUp(level, opts = {}) {
        const data = LevelProgression[level];
        if (!data || !data.unlocks) return;
        if (Config.data.claimedLevels.includes(level)) return;

        const unlockText = data.unlocks;
        const autoGrantCategory = !!opts.autoGrantCategory;
        const excluded = this._excludedNames(unlockText);

        let category = null;
        if (unlockText.includes("Primary tower")) category = 'Primary';
        else if (unlockText.includes("Military tower")) category = 'Military';
        else if (unlockText.includes("Magic tower")) category = 'Magic';
        else if (unlockText.includes("Support tower")) category = 'Support';

        if (category && autoGrantCategory) {
            // Reconciliation mode: no interactive choice, just grant everything missed.
            for (const type in TowerStats) {
                const cat = TowerStats[type].category || TOWER_CATEGORIES[type];
                if (cat !== category) continue;
                if (Config.data.unlockedTowers.includes(type)) continue;
                if (excluded.includes((TowerStats[type] || {}).name)) continue;
                Config.data.unlockedTowers.push(type);
            }
        } else if (category) {
            // Interactive category choice: the queue shows the selection screen
            // and applies this via _grantLevelRewards when the player picks.
            return;
        }

        this._grantLevelRewards(level, unlockText);
    },

    // Names to exclude from a category unlock (e.g. "Primary tower (except
    // Desperado)"). These towers are only obtainable through other means
    // (Gift Box) and must never be offered or auto-granted by the category pick.
    _excludedNames(text) {
        const names = [];
        if (!text) return names;
        const m = text.match(/except\s+([^)]*)\)?/i);
        if (!m) return names;
        m[1].split(',').forEach(part => {
            const t = part.trim();
            if (t) names.push(t);
        });
        return names;
    },

    // Applies the non-category rewards for a level (money, knowledge, gift box,
    // named towers/heroes) and marks the level claimed. Shared by both the
    // auto-grant path and the interactive selection screen's completion.
    _grantLevelRewards(level, unlockText) {
        const data = LevelProgression[level];
        if (!data || !data.unlocks) return;
        if (!unlockText) unlockText = data.unlocks;

        if (unlockText.includes("Monkey Money 50")) {
            Config.data.monkeyMoney += 50;
        }
        if (unlockText.includes("Monkey Money 200")) {
            Config.data.monkeyMoney += 200;
        }
        if (unlockText.includes("Monkey Knowledge Point")) {
            Config.data.knowledgePoints += 1;
        }
        if (unlockText.includes("Gift Box")) {
            ['desperado', 'dartling', 'mermonkey', 'beast'].forEach(t => {
                if (!Config.data.unlockedTowers.includes(t)) {
                    Config.data.unlockedTowers.push(t);
                }
            });
            updateShopPrices();
        }

        // Always attempt to unlock specific heroes/towers by name
        this._unlockSpecificByName(unlockText, this._excludedNames(unlockText));
        updateShopPrices();

        if (!Config.data.claimedLevels.includes(level)) Config.data.claimedLevels.push(level);
    },

    // Scans every level up to the player's current level and grants any rewards
    // that were never actually applied (e.g. from the level-up screen getting stuck).
    // Safe to run repeatedly: already-claimed levels are skipped.
    reconcileLevel() {
        const before = { mm: Config.data.monkeyMoney, mk: Config.data.knowledgePoints, towers: Config.data.unlockedTowers.length };
        let fixedLevels = 0;
        for (let level = 2; level <= Config.data.playerLevel; level++) {
            if (Config.data.claimedLevels.includes(level)) continue;
            if (!LevelProgression[level]) continue;
            this._processLevelUp(level, { autoGrantCategory: true });
            fixedLevels++;
        }
        Config.save();
        updateShopPrices();
        UI.updateMetaStats();
        return {
            fixedLevels,
            mmGained: Config.data.monkeyMoney - before.mm,
            mkGained: Config.data.knowledgePoints - before.mk,
            towersGained: Config.data.unlockedTowers.length - before.towers
        };
    },

    _unlockSpecificByName(text, excluded = []) {
        const allKeys = [...Object.keys(TowerStats), ...Object.keys(HeroRegistry)];
        for (const key of allKeys) {
            const stats = TowerStats[key] || HeroRegistry[key];
            if (!stats) continue;
            if (excluded.includes(stats.name)) continue;
            if (text.includes(stats.name)) {
                if (!Config.data.unlockedTowers.includes(key)) {
                    Config.data.unlockedTowers.push(key);
                }
            }
        }
    },

    _showSelectionScreen(category, level, onDone) {
        const existingOverlay = document.getElementById('level-up-select-menu');
        if (existingOverlay) existingOverlay.remove();

        const overlay = document.createElement('div');
        overlay.id = 'level-up-select-menu';
        overlay.className = 'overlay';
        overlay.style.zIndex = 100;

        const finish = () => {
            this._grantLevelRewards(level);
            Config.save();
            overlay.remove();
            updateShopPrices();
            if (typeof onDone === 'function') onDone();
        };

        const content = document.createElement('div');
        content.className = 'menu-content';
        content.innerHTML = `<h2>Level ${level} Reached!</h2><p>Select a ${category} tower to unlock:</p>`;
        
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
        grid.style.gap = '15px';
        grid.style.marginTop = '20px';

        const excluded = this._excludedNames(LevelProgression[level]?.unlocks || '');
        const options = [];
        for (const type in TowerStats) {
            const cat = TowerStats[type].category || TOWER_CATEGORIES[type];
            if (cat === category) {
                options.push(type);
            }
        }

        let availableOptions = [];

        options.forEach(type => {
            const stats = TowerStats[type] || HeroStats[type];
            if (!stats) return;
            if (Config.data.unlockedTowers.includes(type)) return;
            if (excluded.includes(stats.name)) return;
            {
                availableOptions.push(type);

                const card = document.createElement('div');
                card.style.background = '#34495e';
                card.style.border = '2px solid #7f8c8d';
                card.style.borderRadius = '8px';
                card.style.padding = '10px';
                card.style.textAlign = 'center';
                card.style.cursor = 'pointer';
                card.style.transition = 'all 0.2s';
                
                card.innerHTML = `
                    <div style="width: 80px; height: 80px; margin: 0 auto 10px; background-image: url('sprites/portraits/${type}_menuportrait.png'); background-size: cover; border-radius: 8px;"></div>
                    <div style="font-weight: 900; color: white; margin-bottom: 5px;">${stats.name}</div>
                    <div style="font-size: 12px; color: #bdc3c7;">$${stats.cost}</div>
                `;

                card.addEventListener('mouseenter', () => {
                    card.style.borderColor = '#f1c40f';
                    card.style.transform = 'scale(1.05)';
                });
                card.addEventListener('mouseleave', () => {
                    card.style.borderColor = '#7f8c8d';
                    card.style.transform = 'scale(1)';
                });

                card.addEventListener('click', () => {
                    Config.data.unlockedTowers.push(type);
                    finish();
                });

                grid.appendChild(card);
            }
        });

        if (availableOptions.length === 0) {
            Config.data.knowledgePoints += 1;
            Config.save();
            content.innerHTML += `<p>All ${category} towers already unlocked! +1 Monkey Knowledge Point granted.</p>`;

            const continueBtn = document.createElement('button');
            continueBtn.textContent = 'Continue';
            continueBtn.className = 'back-btn';
            continueBtn.style.marginTop = '15px';
            continueBtn.addEventListener('click', finish);
            content.appendChild(continueBtn);
        } else {
            content.appendChild(grid);
        }

        overlay.appendChild(content);
        document.getElementById('game-container').appendChild(overlay);
    }
};
