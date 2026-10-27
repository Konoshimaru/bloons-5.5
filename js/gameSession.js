// js/gameSession.js
import { Config, Difficulties } from './config.js';
import { HeroStats } from './heroes/index.js';
import { TowerStats } from './towers/index.js';
import { applyApexStats } from './towers/paragon_dart.js';
import { applyGlaiveStats } from './towers/paragon_boomerang.js';

// v1.4.1: per-paragon stat restorers, keyed by the tower's paragonBaseType.
// Legacy saves (v1.4.0) predate the saved field and only ever contained dart
// paragons, so they fall back to 'dart'.
const PARAGON_STAT_APPLIERS = { dart: applyApexStats, boomerang: applyGlaiveStats };
import { Hero } from './hero.js';
import { Tower } from './tower.js';
import { UI } from './ui.js';
import { MKEffects } from './monkeyKnowledgeEffects.js'; 
import { LevelManager } from './levelManager.js'; 

const GameSession = {
    saveGame() {
        if (this.gameState !== 'playing' && this.gameState !== 'paused') return;
        // Audit C-6 (v1.3.3): sandbox runs must never become the Continue
        // save. The engine autosaves on every visibilitychange-to-hidden and
        // pause-menu quit; a sandbox session (999,999 lives / $10M cash)
        // used to silently overwrite the player's legitimate saved run.
        // Sandbox simply doesn't persist - an existing Continue save made
        // BEFORE sandbox is left untouched.
        if (this.isSandbox) return;
        const state = { 
            mapIndex: this.currentMap, 
            difficultyKey: Config.data.currentDifficulty, 
            lives: this.lives, 
            cash: this.cash, 
            wave: this.waveManager.currentWave,
            towers: this.towers.map(t => {
                const data = { x: t.x, y: t.y, type: t.type, upgrades: [...t.upgrades], targeting: t.targetingMode, heroLevel: t.level || 0 };
                // Paragon persistence (plan ch.5): degree + base type + exact
                // cash value, so a loaded paragon keeps its stats and its
                // v1.4.1 sell value.
                if (t.isParagon) {
                    data.isParagon = true;
                    data.paragonDegree = t.paragonDegree || 1;
                    data.paragonBaseType = t.paragonBaseType || 'dart'; // v1.4.1
                    data.totalSpent = t.totalSpent || 0;
                }
                return data;
            }) 
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
            if (stats && stats.isHero) { t = new Hero(tData.x, tData.y, tData.type); this.hero = t; } 
            else { t = new Tower(tData.x, tData.y, tData.type); }
            t.upgrades = [...tData.upgrades]; t.targetingMode = tData.targeting;
            if (tData.isParagon) {
                // Paragons reconstruct from their degree, not from upgrades.
                // v1.4.1: the base type is saved with the tower, so a Glaive
                // Dominus reloads with glaive stats, not dart stats.
                const baseType = PARAGON_STAT_APPLIERS[tData.paragonBaseType] ? tData.paragonBaseType : 'dart';
                t.isParagon = true;
                t.paragonBaseType = baseType;
                PARAGON_STAT_APPLIERS[baseType](t, tData.paragonDegree || 1);
                if (typeof tData.totalSpent === 'number') t.totalSpent = tData.totalSpent;
            } else {
                t.applyUpgradesForLoad();
            }
            if (t.stats.isHero && tData.heroLevel > 1) { while (t.level < tData.heroLevel) t.levelUp(); }
            // P0 save repair: re-mark Tier-5 ownership so a loaded game restores
            // the exact paragon-eligibility state (and can never buy a duplicate
            // T5 of a path that already has one on the field).
            for (let i = 0; i < 3; i++) {
                if (t.upgrades[i] === 5) this.tier5Bought[`${t.type}-${i + 1}`] = true;
            }
            this.towers.push(t);
        }
        this.updateUI(); 
        return true;
    },

    abandonRun() {
        Config.data.savedRun = null; Config.save(); this.gameState = 'menu'; this.map = null;
        UI.toggleMenus(null); document.getElementById('main-menu-ui').classList.remove('hidden'); UI.updateMetaStats();
    },

    // Flushes per-pop player XP banked by addSessionXp() into the persistent
    // LevelManager pipeline. Placed here (not engine.js) because GameSession
    // already imports LevelManager; engine.js importing it would create a
    // circular dependency (levelManager -> dragManager -> engine).
    flushSessionXp() {
        if (this.sessionXp <= 0) return;
        const amount = Math.floor(this.sessionXp);
        this.sessionXp = 0;
        this.sessionXpFlushTimer = 0;
        LevelManager.addXP(amount, { inGame: this.gameState === 'playing' });
    },

    // Flushes per-pop TOWER XP (paragon unlock progress, keyed by base tower
    // type) banked by addTowerXp() into Config.data.towerXp. Same batching
    // pattern as flushSessionXp so per-pop adds never touch localStorage.
    flushTowerXp() {
        const session = this.towerXpSession;
        if (!session) return;
        let dirty = false;
        for (const type of Object.keys(session)) {
            const amount = Math.floor(session[type]);
            if (amount <= 0) continue;
            if (!Config.data.towerXp) Config.data.towerXp = {};
            Config.data.towerXp[type] = (Config.data.towerXp[type] || 0) + amount;
            delete session[type];
            dirty = true;
        }
        if (dirty) Config.save();
    },

    giveRewards() {
        const wavesSurvived = this.waveManager.currentWave;
        // Bank any un-flushed per-pop XP first so nothing is lost at game end.
        const sessionXp = Math.floor(this.sessionXp || 0);
        this.sessionXp = 0; this.sessionXpFlushTimer = 0;
        if (sessionXp > 0) LevelManager.addXP(sessionXp, { inGame: false });
        this.flushTowerXp();
        const xpEarned = wavesSurvived * 15;
        let mmEarned = Math.floor(wavesSurvived / 3) + 5;
        
        const mk = Config.data.mkActive === false ? {} : (Config.data.monkeyKnowledge || {});
        let mmMult = 1.0;
        for (const eff of MKEffects.economy) {
            if (!mk[eff.id]) continue;
            if (eff.stat === 'mmRewardMult') mmMult = eff.amount;
        }
        mmEarned = Math.floor(mmEarned * mmMult);
        
        Config.data.monkeyMoney += mmEarned;
        LevelManager.addXP(xpEarned);
        
        if (!Config.data.stats) Config.data.stats = { gamesPlayed: 0, highestRound: 0, totalPops: 0 };
        Config.data.stats.gamesPlayed = (Config.data.stats.gamesPlayed || 0) + 1;
        Config.data.stats.highestRound = Math.max(Config.data.stats.highestRound || 0, wavesSurvived);
        
        Config.data.savedRun = null; 
        Config.save();
        
        const rewardsEl = document.getElementById(this.gameState === 'victory' ? 'vic-rewards' : 'go-rewards');
        if (rewardsEl) rewardsEl.innerHTML = `+${xpEarned} XP<br>+${mmEarned} Monkey Money`;
        
        UI.updateMetaStats();
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
