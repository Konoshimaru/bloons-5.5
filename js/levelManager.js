// js/levelManager.js
import { Config } from './config.js';
import { LevelProgression } from './levelData.js';
import { TowerStats, TOWER_CATEGORIES } from './towers/index.js';
import { HeroStats } from './heroes/index.js';
import { HeroRegistry } from './heroes/index.js';
import { UI } from './ui.js';
import { updateShopPrices } from './dragManager.js';
import { GameEngine } from './engineRef.js';

const GIFT_BOX_TOWERS = ['desperado', 'dartling', 'mermonkey', 'beast'];

// Single source of truth for what a level's unlock text pays out. Replaces the ad-hoc
// `includes("Monkey Money 50")` / `includes("Monkey Knowledge Point")` checks (which hard-coded
// two money amounts and always paid exactly +1 knowledge regardless of the "×N").
export function parseRewards(text = '') {
    const monkeyMoney = [...text.matchAll(/Monkey Money\s*(\d+)/gi)].reduce((sum, m) => sum + Number(m[1]), 0);
    const mk = text.match(/Monkey Knowledge Points?\s*(?:[×x]\s*(\d+))?/i);
    return {
        monkeyMoney,
        knowledge: mk ? (mk[1] ? Number(mk[1]) : 1) : 0,
        giftBox: /Gift Box/i.test(text)
    };
}

export const LevelManager = {
    // Queue of player levels reached but not yet presented (each may need an
    // interactive "pick a tower" screen). Drained one at a time so multiple
    // simultaneous level-ups pause the game sequentially instead of stacking
    // DOM overlays on top of each other.
    _pendingLevels: [],
    _levelUpActive: false,
    _pausedForLevelUp: false,
    _prevGameState: null,
    _shownInteractive: 0,   // interactive screens already presented in the current queue run

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

        // Persist the new level/XP right away; the drain below commits again after every reward
        // it hands out (previously the save + UI refresh happened BEFORE the rewards were granted,
        // so they were neither saved nor shown until some later save).
        this._commit();
        if (this._pendingLevels.length > 0) this._drainPendingLevels(opts);
    },

    // Save + refresh the HUD. Always called AFTER state changes.
    _commit() {
        Config.save();
        UI.updateMetaStats();
    },

    // Re-queues levels the player already reached but whose rewards were never claimed (the game
    // was closed while a pick screen was open, or an older version saved before granting).
    // Called once at boot. Category levels show the normal pick screen.
    resumeUnclaimed(opts = {}) {
        let queued = false;
        for (let level = 2; level <= Config.data.playerLevel; level++) {
            if (Config.data.claimedLevels.includes(level)) continue;
            if (!(LevelProgression[level] && LevelProgression[level].unlocks)) continue;
            if (this._pendingLevels.includes(level)) continue;
            this._pendingLevels.push(level);
            queued = true;
        }
        if (queued) this._drainPendingLevels(opts);
        return queued;
    },

    // Presents each queued level-up in order. Levels that only pay currency are granted
    // immediately and announced in one toast; category levels (and levels that unlock a hero)
    // show a screen and pause the round. Reconcile-style calls auto-grant categories.
    _drainPendingLevels(opts = {}) {
        if (this._levelUpActive) return;
        this._levelUpActive = true;
        const batch = [];
        try {
            while (this._pendingLevels.length > 0) {
                const level = this._pendingLevels[0];
                if (Config.data.claimedLevels.includes(level)) { this._pendingLevels.shift(); continue; }
                const category = this._categoryOfLevel(level);
                const resume = () => { this._levelUpActive = false; this._drainPendingLevels(opts); };
                if (category && !opts.autoGrantCategory) {
                    this._flushBatchToast(batch);
                    this._shownInteractive++;
                    this._pauseForLevelUp();
                    this._showSelectionScreen(category, level, resume);
                    return;
                }
                this._pendingLevels.shift();
                const summary = this._processLevelUp(level, { autoGrantCategory: !!opts.autoGrantCategory });
                if (!summary) continue;
                if (summary.newHeroes.length > 0 && this._host()) {
                    this._flushBatchToast(batch);
                    this._shownInteractive++;
                    this._pauseForLevelUp();
                    this._showHeroUnlockedPopup(summary.newHeroes, resume, summary.level);
                    return;
                }
                batch.push(summary);
            }
            this._flushBatchToast(batch);
            this._shownInteractive = 0;
            this._levelUpActive = false;
            this._resumeFromLevelUp();
        } catch (e) {
            this._levelUpActive = false;
            this._shownInteractive = 0;
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

    // Grants a non-interactive level. Returns the reward summary (or null if nothing to do).
    _processLevelUp(level, opts = {}) {
        const data = LevelProgression[level];
        if (!data || !data.unlocks) return null;
        if (Config.data.claimedLevels.includes(level)) return null;

        const unlockText = data.unlocks;
        const excluded = this._excludedNames(unlockText);
        const category = this._categoryOfLevel(level);
        const extra = {};

        if (category && opts.autoGrantCategory) {
            // Reconciliation mode: no interactive choice, just grant everything missed.
            extra.autoTowers = [];
            for (const type in TowerStats) {
                if (type.startsWith('paragon_')) continue; // paragons are never category unlocks
                const cat = TowerStats[type].category || TOWER_CATEGORIES[type];
                if (cat !== category) continue;
                if (Config.data.unlockedTowers.includes(type)) continue;
                if (excluded.includes((TowerStats[type] || {}).name)) continue;
                Config.data.unlockedTowers.push(type);
                extra.autoTowers.push(type);
            }
        } else if (category) {
            return null; // interactive: the selection screen grants it
        }

        return this._grantLevelRewards(level, unlockText, extra);
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

    // What a level will hand out, without touching any state (used by the level-up screen).
    _previewRewards(level) {
        const text = (LevelProgression[level] || {}).unlocks || '';
        const r = parseRewards(text);
        const giftTowers = r.giftBox ? GIFT_BOX_TOWERS.filter(t => !Config.data.unlockedTowers.includes(t)) : [];
        const named = this._namedUnlockKeys(text, this._excludedNames(text))
            .filter(k => !Config.data.unlockedTowers.includes(k));
        return { ...r, giftTowers, named, heroes: named.filter(k => !!HeroRegistry[k]) };
    },

    // Applies a level's non-category rewards (money, knowledge, gift box, named towers/heroes),
    // marks the level claimed and COMMITS (save + HUD refresh). Shared by the auto-grant path and
    // the selection screen's completion. Returns a summary used for the toast / popups.
    //   extra.picked           tower the player chose on the selection screen
    //   extra.bonusKnowledge   +MK for categories with nothing left to pick
    //   extra.autoTowers       towers auto-granted by reconcile-style mode
    _grantLevelRewards(level, unlockText, extra = {}) {
        const data = LevelProgression[level];
        if (!data || !data.unlocks) return null;
        if (!unlockText) unlockText = data.unlocks;

        const r = parseRewards(unlockText);
        const summary = {
            level,
            text: unlockText,
            monkeyMoney: r.monkeyMoney,
            knowledge: r.knowledge + (extra.bonusKnowledge || 0),
            newTowers: [...(extra.autoTowers || [])],
            newHeroes: []
        };
        if (extra.picked) summary.newTowers.push(extra.picked);

        Config.data.monkeyMoney += r.monkeyMoney;
        Config.data.knowledgePoints += summary.knowledge;
        if (r.giftBox) {
            GIFT_BOX_TOWERS.forEach(t => {
                if (!Config.data.unlockedTowers.includes(t)) {
                    Config.data.unlockedTowers.push(t);
                    summary.newTowers.push(t);
                }
            });
        }

        // Always attempt to unlock specific heroes/towers by name
        const newlyUnlocked = this._unlockSpecificByName(unlockText, this._excludedNames(unlockText));
        newlyUnlocked.forEach(key => (HeroRegistry[key] ? summary.newHeroes : summary.newTowers).push(key));

        if (!Config.data.claimedLevels.includes(level)) Config.data.claimedLevels.push(level);
        updateShopPrices();
        this._commit();
        return summary;
    },

    // Scans every level up to the player's current level and grants any rewards
    // that were never actually applied (e.g. from the level-up screen getting stuck).
    // Safe to run repeatedly: already-claimed levels are skipped.
    //
    // Reward order: category towers first (all Primary, then all Military, then
    // all Magic, then all Support — anything still locked gets unlocked, since the
    // interactive pick screen can only hand out a few towers per category), THEN
    // monkey knowledge. Heroes stay hardcoded by name in levelData and are granted
    // on their own levels, which are skipped by the category pass.
    reconcileLevel() {
        const before = { mm: Config.data.monkeyMoney, mk: Config.data.knowledgePoints, towers: Config.data.unlockedTowers.length };
        let fixedLevels = 0;
        const knowledgeLevels = [];
        const heroUnlocks = [];
        for (let level = 2; level <= Config.data.playerLevel; level++) {
            if (Config.data.claimedLevels.includes(level)) continue;
            if (!LevelProgression[level]) continue;
            const unlockText = LevelProgression[level].unlocks || '';
            const kp = parseRewards(unlockText).knowledge;
            if (kp > 0) knowledgeLevels.push(kp);
            // Heroes are still hardcoded by name in levelData; unlock them here.
            const newly = this._unlockSpecificByName(unlockText, this._excludedNames(unlockText));
            heroUnlocks.push(...newly.filter(key => !!HeroRegistry[key]));
            const paid = parseRewards(unlockText);
            Config.data.monkeyMoney += paid.monkeyMoney;
            if (paid.giftBox) {
                GIFT_BOX_TOWERS.forEach(t => {
                    if (!Config.data.unlockedTowers.includes(t)) {
                        Config.data.unlockedTowers.push(t);
                    }
                });
            }
            Config.data.claimedLevels.push(level);
            fixedLevels++;
        }
        // Category towers: check each category in order and unlock anything still
        // missing. No per-level gating — if a tower in the category is locked, the
        // player hasn't got everything they should, so grant it.
        this._grantRemainingCategoryTowers();
        // THEN monkey knowledge.
        knowledgeLevels.forEach((kp) => { Config.data.knowledgePoints += kp; });
        Config.save();
        updateShopPrices();
        UI.updateMetaStats();
        if (heroUnlocks.length > 0) this._showHeroUnlockedPopup([...new Set(heroUnlocks)]);
        return {
            fixedLevels,
            mmGained: Config.data.monkeyMoney - before.mm,
            mkGained: Config.data.knowledgePoints - before.mk,
            towersGained: Config.data.unlockedTowers.length - before.towers
        };
    },

    _grantRemainingCategoryTowers() {
        // Check category by category, in order: Primary, Military, Magic, Support.
        for (const cat of ['Primary', 'Military', 'Magic', 'Support']) {
            const excluded = this._categoryExcludedNames(cat);
            for (const type in TowerStats) {
                if (type.startsWith('paragon_')) continue; // paragons are never category unlocks
                const stats = TowerStats[type];
                if (!stats) continue;
                if ((stats.category || TOWER_CATEGORIES[type]) !== cat) continue;
                if (Config.data.unlockedTowers.includes(type)) continue;
                if (stats.unlockKey) continue; // money-gated (e.g. Banana Farmer)
                if (excluded.includes(stats.name)) continue; // Gift Box towers (Desperado, Dartling, Mermonkey, Beast Handler)
                Config.data.unlockedTowers.push(type);
            }
        }
    },

    // The "except X" clause for a category, taken from its pick levels in
    // levelData (all levels of a category share the same exception).
    _categoryExcludedNames(category) {
        for (const key in LevelProgression) {
            const text = LevelProgression[key].unlocks || '';
            if (text.includes(category)) {
                return this._excludedNames(text);
            }
        }
        return [];
    },

    // Keys of the towers/heroes named in a level's text (pure lookup, changes nothing).
    _namedUnlockKeys(text, excluded = []) {
        const allKeys = [...Object.keys(TowerStats), ...Object.keys(HeroRegistry)];
        const keys = [];
        for (const key of allKeys) {
            // Tower stats live flat on TowerStats[key]; hero objects keep their
            // stats under HeroRegistry[key].stats.
            const towerStats = TowerStats[key];
            const heroObj = towerStats ? null : HeroRegistry[key];
            const stats = towerStats || (heroObj ? heroObj.stats : null);
            if (!stats) continue;
            if (excluded.includes(stats.name)) continue;
            if (text.includes(stats.name)) keys.push(key);
        }
        return keys;
    },

    // Unlocks towers/heroes named in the level text. Returns the list of keys
    // that were newly unlocked this call, so callers can surface them.
    _unlockSpecificByName(text, excluded = []) {
        const unlocked = [];
        for (const key of this._namedUnlockKeys(text, excluded)) {
            if (!Config.data.unlockedTowers.includes(key)) {
                Config.data.unlockedTowers.push(key);
                unlocked.push(key);
            }
        }
        return unlocked;
    },

    // ---------------------------------------------------------------------------------------
    // UI
    // ---------------------------------------------------------------------------------------
    _host() {
        if (typeof document === 'undefined') return null;
        return document.getElementById('game-container') || document.body;
    },

    _nameOf(key) {
        return ((TowerStats[key] || (HeroRegistry[key] || {}).stats || {}).name) || key;
    },

    // Lines such as "+1 Monkey Knowledge Point", "+50 Monkey Money", "Unlocked: Ninja Monkey".
    _summaryLines(summaries) {
        const mm = summaries.reduce((n, s) => n + (s.monkeyMoney || 0), 0);
        const mk = summaries.reduce((n, s) => n + (s.knowledge || 0), 0);
        const keys = summaries.flatMap(s => [...(s.newTowers || []), ...(s.newHeroes || [])]);
        const lines = [];
        if (mk > 0) lines.push(`+${mk} Monkey Knowledge Point${mk > 1 ? 's' : ''}`);
        if (mm > 0) lines.push(`+${mm} Monkey Money`);
        if (keys.length) lines.push(`Unlocked: ${keys.map(k => this._nameOf(k)).join(', ')}`);
        if (!lines.length) {
            const text = summaries.map(s => s.text).filter(Boolean).join(' · ');
            if (text) lines.push(text);
        }
        return lines;
    },

    _levelTitle(summaries) {
        const first = summaries[0].level, last = summaries[summaries.length - 1].level;
        return first === last ? `Level ${first} reached!` : `Levels ${first}–${last} reached!`;
    },

    // Non-blocking announcement for levels that only pay currency (no screen, no pause), so the
    // player can see the reward arrive instead of it happening silently.
    _flushBatchToast(batch) {
        if (!batch.length) return;
        const summaries = batch.splice(0, batch.length);
        this._showToast(this._levelTitle(summaries), this._summaryLines(summaries));
    },

    _showToast(title, lines) {
        const host = this._host();
        if (!host || !lines.length) return;
        let box = document.getElementById('levelup-toasts');
        if (!box) {
            box = document.createElement('div');
            box.id = 'levelup-toasts';
            box.style.cssText = 'position:absolute; top:64px; left:50%; transform:translateX(-50%); z-index:95; ' +
                'display:flex; flex-direction:column; gap:8px; align-items:center; pointer-events:none;';
            host.appendChild(box);
        }
        const toast = document.createElement('div');
        toast.className = 'levelup-toast';
        toast.style.cssText = 'background:#2c3e50; border:2px solid var(--gold, #f1c40f); border-radius:10px; ' +
            'padding:10px 18px; color:white; text-align:center; box-shadow:0 6px 18px rgba(0,0,0,0.5); font-weight:700;';
        toast.innerHTML = `<div style="font-weight:900; color:var(--gold, #f1c40f); margin-bottom:2px;">${title}</div>` +
            lines.map(l => `<div style="font-size:14px;">${l}</div>`).join('');
        box.appendChild(toast);
        while (box.children.length > 4) box.firstChild.remove();
        setTimeout(() => toast.remove(), 4500);
    },

    _portrait(key, size = 80) {
        return `<div style="width:${size}px; height:${size}px; margin:0 auto 8px; background-image:url('sprites/portraits/${key}_menuportrait.png'); background-size:cover; border-radius:8px;"></div>`;
    },

    _showSelectionScreen(category, level, onDone) {
        const host = this._host();
        if (!host) throw new Error('No DOM available for the level-up screen');
        const existingOverlay = document.getElementById('level-up-select-menu');
        if (existingOverlay) existingOverlay.remove();

        const unlockText = (LevelProgression[level] || {}).unlocks || '';
        const excluded = this._excludedNames(unlockText);
        const preview = this._previewRewards(level);

        const options = [];
        for (const type in TowerStats) {
            if (type.startsWith('paragon_')) continue; // paragons are never pick options
            const stats = TowerStats[type];
            if ((stats.category || TOWER_CATEGORIES[type]) !== category) continue;
            if (Config.data.unlockedTowers.includes(type)) continue;
            if (excluded.includes(stats.name)) continue;
            options.push(type);
        }

        const overlay = document.createElement('div');
        overlay.id = 'level-up-select-menu';
        overlay.className = 'overlay';
        overlay.style.zIndex = 100;

        const content = document.createElement('div');
        content.className = 'menu-content';

        // "Level-up 2 of 3" when several screens are queued back to back.
        const remaining = this._pendingLevels.slice(1)
            .filter(l => !Config.data.claimedLevels.includes(l) && this._categoryOfLevel(l)).length;
        const total = this._shownInteractive + remaining;
        const counter = total > 1 ? `<div style="color:#bdc3c7; font-size:13px;">Level-up ${this._shownInteractive} of ${total}</div>` : '';
        content.innerHTML = `<h2>Level ${level} Reached!</h2>${counter}`;

        // Everything else this level pays (so nothing arrives unannounced).
        const extras = [];
        if (preview.knowledge) extras.push(`+${preview.knowledge} Monkey Knowledge Point${preview.knowledge > 1 ? 's' : ''}`);
        if (preview.monkeyMoney) extras.push(`+${preview.monkeyMoney} Monkey Money`);
        preview.giftTowers.forEach(t => extras.push(`Gift Box: ${this._nameOf(t)}`));
        preview.named.forEach(k => extras.push(`${HeroRegistry[k] ? 'New hero' : 'Unlocks'}: ${this._nameOf(k)}`));
        if (extras.length) {
            const box = document.createElement('div');
            box.className = 'level-up-extras';
            box.style.cssText = 'display:flex; flex-wrap:wrap; gap:8px; justify-content:center;';
            box.innerHTML = extras.map(t => `<span style="background:#2c3e50; border:1px solid var(--gold, #f1c40f); border-radius:14px; padding:4px 12px; font-size:13px; color:white;">${t}</span>`).join('');
            content.appendChild(box);
        }

        let finished = false;
        const finish = (picked) => {
            if (finished) return;
            finished = true;
            if (picked && !Config.data.unlockedTowers.includes(picked)) Config.data.unlockedTowers.push(picked);
            // Grant -> claim -> save -> refresh HUD (all inside _grantLevelRewards), THEN close.
            const summary = this._grantLevelRewards(level, undefined, {
                picked,
                bonusKnowledge: options.length === 0 ? 1 : 0
            });
            overlay.remove();
            if (summary) this._showToast(`Level ${level} reward`, this._summaryLines([summary]));
            if (typeof onDone === 'function') onDone();
        };

        if (options.length === 0) {
            const note = document.createElement('p');
            note.textContent = `All ${category} towers are already unlocked! You get +1 Monkey Knowledge Point instead.`;
            const continueBtn = document.createElement('button');
            continueBtn.textContent = 'Continue';
            continueBtn.className = 'back-btn';
            continueBtn.id = 'level-up-confirm';
            continueBtn.addEventListener('click', () => finish(null));
            content.appendChild(note);
            content.appendChild(continueBtn);
        } else {
            const prompt = document.createElement('p');
            prompt.textContent = `Select a ${category} tower to unlock:`;
            content.appendChild(prompt);

            const grid = document.createElement('div');
            grid.style.cssText = 'display:grid; grid-template-columns:repeat(3, 1fr); gap:15px; margin-top:5px;';

            const confirmBtn = document.createElement('button');
            confirmBtn.id = 'level-up-confirm';
            confirmBtn.className = 'back-btn';
            confirmBtn.textContent = 'Select a tower';
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.5';

            let selected = null;
            const cards = new Map();
            const choose = (type) => {
                selected = type;
                cards.forEach((card, t) => {
                    const on = t === type;
                    card.style.borderColor = on ? '#f1c40f' : '#7f8c8d';
                    card.style.transform = on ? 'scale(1.05)' : 'scale(1)';
                    card.style.background = on ? '#3e5771' : '#34495e';
                    card.setAttribute('aria-pressed', on ? 'true' : 'false');
                });
                confirmBtn.disabled = false;
                confirmBtn.style.opacity = '1';
                confirmBtn.textContent = `Unlock ${this._nameOf(type)}`;
            };

            options.forEach(type => {
                const stats = TowerStats[type] || HeroStats[type];
                const card = document.createElement('div');
                card.className = 'level-up-card';
                card.dataset.tower = type;
                card.setAttribute('role', 'button');
                card.setAttribute('aria-pressed', 'false');
                card.style.cssText = 'background:#34495e; border:2px solid #7f8c8d; border-radius:8px; padding:10px; text-align:center; cursor:pointer; transition:all 0.15s;';
                card.innerHTML = `${this._portrait(type)}
                    <div style="font-weight:900; color:white; margin-bottom:5px;">${stats.name}</div>
                    <div style="font-size:12px; color:#bdc3c7;">$${stats.cost}</div>`;
                card.addEventListener('click', () => choose(type));
                card.addEventListener('dblclick', () => { choose(type); finish(type); });
                cards.set(type, card);
                grid.appendChild(card);
            });

            confirmBtn.addEventListener('click', () => { if (selected) finish(selected); });
            content.appendChild(grid);
            content.appendChild(confirmBtn);
        }

        overlay.appendChild(content);
        host.appendChild(overlay);
    },

    // Popup announcing newly unlocked hero(es). Closing it continues the level-up queue
    // (onClose), so it never stacks on top of the next level's screen.
    _showHeroUnlockedPopup(heroKeys, onClose, level) {
        const host = this._host();
        if (!host) { if (typeof onClose === 'function') onClose(); return; }
        const existing = document.getElementById('hero-unlocked-popup');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'hero-unlocked-popup';
        overlay.className = 'overlay';
        overlay.style.zIndex = 100;

        const cards = heroKeys.map(key => `
                <div style="background:#34495e; border:2px solid var(--gold); border-radius:8px; padding:12px; text-align:center; min-width:120px;">
                    ${this._portrait(key)}
                    <div style="font-weight:900; color:white;">${this._nameOf(key)}</div>
                </div>`).join('');

        const content = document.createElement('div');
        content.className = 'menu-content';
        content.innerHTML = `
            <h2>${heroKeys.length > 1 ? 'New Heroes Unlocked!' : 'New Hero Unlocked!'}</h2>
            ${level ? `<div style="color:#bdc3c7; font-size:13px;">Level ${level} reward</div>` : ''}
            <div style="display:flex; gap:15px; justify-content:center; margin-top:15px; flex-wrap:wrap;">${cards}</div>
            <button class="back-btn" id="hero-unlocked-close" style="margin-top:18px;">Continue</button>`;

        content.querySelector('#hero-unlocked-close').addEventListener('click', () => {
            overlay.remove();
            if (typeof onClose === 'function') onClose();
        });
        overlay.appendChild(content);
        host.appendChild(overlay);
    }
};

// Dev console helper: gain levels instantly.
//   levelUp()   -> +1 level
//   levelUp(5)  -> +5 levels
//   levelUp(0)  -> no-op
// Category towers go through the normal interactive pick screen (one tower per
// category level); heroes/money/knowledge flow through the normal pipeline and
// the level-up queue drains sequentially. Config is saved by addXP.
if (typeof window !== 'undefined') {
    window.levelUp = function (levels = 1) {
        const n = Math.max(1, Math.floor(levels));
        if (Config.data.playerLevel >= 155) return 'Already at max level (155).';

        let xp = 0;
        let xpNow = Config.data.playerXP;
        let toNext = Config.data.playerXPToNext;
        let level = Config.data.playerLevel;
        for (let i = 0; i < n; i++) {
            if (level >= 155) break;
            xp += toNext - xpNow;
            xpNow = 0;
            level++;
            const next = LevelProgression[level + 1];
            toNext = next ? next.xpFromPrev : toNext;
        }

        const before = Config.data.playerLevel;
        LevelManager.addXP(xp);
        return `Gained ${Config.data.playerLevel - before} level(s) -> now level ${Config.data.playerLevel}.`;
    };
}
