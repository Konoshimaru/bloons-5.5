// js/levelManager.js
import { Config } from './config.js';
import { LevelProgression } from './levelData.js';
import { TowerStats } from './towers/index.js';
import { HeroStats } from './heroes/index.js';
import { HeroRegistry } from './heroes/index.js';
import { UI } from './ui.js';

const TOWER_CATEGORIES = {
    'Primary': ['dart', 'boomerang', 'bomb', 'tack', 'ice', 'glue'],
    'Military': ['sniper', 'sub', 'buccaneer', 'ace', 'heli', 'mortar'],
    'Magic': ['wizard', 'super', 'ninja', 'alchemist', 'druid'],
    'Support': ['farm', 'spike', 'village', 'engineer']
};

export const LevelManager = {
    addXP(amount) {
        Config.data.playerXP += amount;
        
        while (Config.data.playerXP >= Config.data.playerXPToNext) {
            Config.data.playerXP -= Config.data.playerXPToNext;
            Config.data.playerLevel++;
            
            // Calculate next level XP requirement
            const nextLevelData = LevelProgression[Config.data.playerLevel + 1];
            const currentLevelData = LevelProgression[Config.data.playerLevel];
            
            if (currentLevelData) {
                Config.data.playerXPToNext = currentLevelData.xpFromPrev;
            }
            if (nextLevelData) {
                // If we need to look ahead, do so here. For now, xpFromPrev is the requirement to reach the *next* level.
                // Wait, the table says "From prev." which means XP needed to go from Lvl X to Lvl X+1.
                // So to reach Level 3, you need 1100 XP. 
                // So when we hit Level 3, the *next* requirement is Level 4's xpFromPrev (620).
                Config.data.playerXPToNext = nextLevelData.xpFromPrev;
            }

            this._processLevelUp(Config.data.playerLevel);
        }
        
        Config.save();
        UI.updateMetaStats();
    },

    _processLevelUp(level) {
        const data = LevelProgression[level];
        if (!data || !data.unlocks) return;

        const unlockText = data.unlocks;
        
        if (unlockText.includes("Primary tower")) {
            this._showSelectionScreen('Primary', level);
        } else if (unlockText.includes("Military tower")) {
            this._showSelectionScreen('Military', level);
        } else if (unlockText.includes("Magic tower")) {
            this._showSelectionScreen('Magic', level);
        } else if (unlockText.includes("Support tower")) {
            this._showSelectionScreen('Support', level);
        } else if (unlockText.includes("Monkey Money 50")) {
            Config.data.monkeyMoney += 50;
        } else if (unlockText.includes("Monkey Money 200")) {
            Config.data.monkeyMoney += 200;
        } else if (unlockText.includes("Monkey Knowledge Point")) {
            Config.data.knowledgePoints += 1;
        } else if (unlockText.includes("Gift Box")) {
            // Desperado, Dartling Gunner, Mermonkey, Beast Handler
            ['desperado', 'dartling', 'mermonkey', 'beast'].forEach(t => {
                if (!Config.data.unlockedTowers.includes(t)) {
                    Config.data.unlockedTowers.push(t);
                }
            });
        } else {
            // Check for specific heroes or towers mentioned by name
            this._unlockSpecificByName(unlockText);
        }
    },

    _unlockSpecificByName(text) {
        const allKeys = [...Object.keys(TowerStats), ...Object.keys(HeroRegistry)];
        for (const key of allKeys) {
            const stats = TowerStats[key] || HeroRegistry[key];
            if (stats && text.includes(stats.name)) {
                if (!Config.data.unlockedTowers.includes(key)) {
                    Config.data.unlockedTowers.push(key);
                }
            }
        }
    },

    _showSelectionScreen(category, level) {
        const existingOverlay = document.getElementById('level-up-select-menu');
        if (existingOverlay) existingOverlay.remove();

        const overlay = document.createElement('div');
        overlay.id = 'level-up-select-menu';
        overlay.className = 'overlay';
        overlay.style.zIndex = 100;

        const content = document.createElement('div');
        content.className = 'menu-content';
        content.innerHTML = `<h2>Level ${level} Reached!</h2><p>Select a ${category} tower to unlock:</p>`;
        
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
        grid.style.gap = '15px';
        grid.style.marginTop = '20px';

        const options = TOWER_CATEGORIES[category] || [];
        let availableOptions = [];

        options.forEach(type => {
            if (!Config.data.unlockedTowers.includes(type)) {
                availableOptions.push(type);
                const stats = TowerStats[type] || HeroStats[type];
                if (!stats) return;

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
                    Config.save();
                    overlay.remove();
                    // Refresh UI if game is running
                    if (UI._towerCardCache) UI._towerCardCache = null; 
                    if (typeof updateShopPrices === 'function') updateShopPrices();
                });

                grid.appendChild(card);
            }
        });

        if (availableOptions.length === 0) {
            // All unlocked for this category, give MK point instead
            Config.data.knowledgePoints += 1;
            content.innerHTML += `<p>All ${category} towers already unlocked! +1 Monkey Knowledge Point granted.</p>`;
        } else {
            content.appendChild(grid);
        }

        overlay.appendChild(content);
        document.getElementById('game-container').appendChild(overlay);
    }
};