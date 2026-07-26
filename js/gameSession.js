// js/gameSession.js
import { Config, Difficulties, HeroStats } from './config.js';
import { TowerStats } from './towers/index.js';
import { Hero } from './hero.js';
import { Tower } from './tower.js';
import { UI } from './ui.js';
import { MKEffects } from './monkeyKnowledgeEffects.js'; // FIX: Added missing import

const GameSession = {
    saveGame() {
        if (this.gameState !== 'playing' && this.gameState !== 'paused') return;
        const state = { 
            mapIndex: this.currentMap, 
            difficultyKey: Config.data.currentDifficulty, 
            lives: this.lives, 
            cash: this.cash, 
            wave: this.waveManager.currentWave,
            towers: this.towers.map(t => ({ x: t.x, y: t.y, type: t.type, upgrades: [...t.upgrades], targeting: t.targetingMode, heroLevel: t.level || 0 })) 
        };
        Config.data.savedRun = state; 
        Config.save();
    },

    loadGame() {
        if (!Config.data.savedRun) return false;
        const state = Config.data.savedRun;
        this.currentMap = state.mapIndex;
        
        if (state.difficultyKey) {
            Config.data.currentDifficulty = state.difficultyKey;
        } else if (state.difficulty) {
            Config.data.currentDifficulty = state.difficulty.toLowerCase().replace(/\s+/g, '');
        } else {
            Config.data.currentDifficulty = 'medium';
        }
        
        this.startGame(false);
        this.lives = state.lives; this.cash = state.cash;
        this.waveManager.currentWave = state.wave - 1;
        for (const tData of state.towers) {
            const stats = TowerStats[tData.type] || HeroStats[tData.type];
            let t;
            if (stats.isHero) { t = new Hero(tData.x, tData.y, tData.type); this.hero = t; } 
            else { t = new Tower(tData.x, tData.y, tData.type); }
            t.upgrades = [...tData.upgrades]; t.targetingMode = tData.targeting; t.applyUpgradesForLoad();
            if (t.stats.isHero && tData.heroLevel > 1) { while (t.level < tData.heroLevel) t.levelUp(); }
            this.towers.push(t);
        }
        this.updateUI(); 
        return true;
    },

    abandonRun() {
        Config.data.savedRun = null; Config.save(); this.gameState = 'menu'; this.map = null;
        UI.toggleMenus(null); document.getElementById('main-menu-ui').classList.remove('hidden'); UI.updateMetaStats();
    },

    giveRewards() {
        const wavesSurvived = this.waveManager.currentWave;
        const xpEarned = wavesSurvived * 15;
        let mmEarned = Math.floor(wavesSurvived / 3) + 5;
        
        const mk = Config.data.mkActive === false ? {} : (Config.data.monkeyKnowledge || {});
        let mmMult = 1.0;
        // FIX: Apply economy MK effects generically using stat/amount
        for (const eff of MKEffects.economy) {
            if (!mk[eff.id]) continue;
            if (eff.stat === 'mmRewardMult') mmMult = eff.amount;
        }
        mmEarned = Math.floor(mmEarned * mmMult);
        
        Config.data.playerXP += xpEarned; Config.data.monkeyMoney += mmEarned;
        
        while (Config.data.playerXP >= Config.data.playerXPToNext) {
            Config.data.playerXP -= Config.data.playerXPToNext; 
            Config.data.playerLevel++;
            Config.data.playerXPToNext = Math.floor(Config.data.playerXPToNext * 1.25);
            if (Config.data.playerLevel > 25) {
                Config.data.knowledgePoints = (Config.data.knowledgePoints || 0) + 1;
            }
        }
        
        Config.data.savedRun = null; Config.save();
        const rewardsEl = document.getElementById('go-rewards');
        if (rewardsEl) rewardsEl.innerHTML = `+${xpEarned} XP<br>+${mmEarned} Monkey Money`;
    },

    skipWave(amount) {
        this.waveManager.clearField();
        const floorWave = this.difficulty ? this.difficulty.startRound : 1;
        if (amount > 0) { this.waveManager.startWave(); } 
        else if (amount < 0) {
            if (this.waveManager.currentWave <= floorWave) {
                this.log("Already at the first wave!"); this.waveManager.currentWave = floorWave - 1; this.waveManager.startWave(); return;
            }
            this.waveManager.currentWave -= 2;
            if (this.waveManager.currentWave < floorWave - 1) this.waveManager.currentWave = floorWave - 1;
            this.waveManager.startWave();
        }
        this.updateUI();
    }
};

export default GameSession;