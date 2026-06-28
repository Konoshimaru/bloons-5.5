import { TowerStats, Upgrades } from './towers/index.js';
import { HeroStats } from './config.js';

export const UI = {
    _towerCardCache: null,
    
    toggleMenus(menuId) {
        ['main-menu', 'maps-menu', 'settings-menu', 'pause-menu', 'game-over-menu', 'custom-maps-menu', 'difficulty-menu', 'hero-select-menu'].forEach(id => document.getElementById(id).classList.add('hidden'));
        document.getElementById(menuId).classList.remove('hidden');
    },
    showPause() { document.getElementById('pause-menu').classList.remove('hidden'); },
    hidePause() { document.getElementById('pause-menu').classList.add('hidden'); },
    updateWaveSpeedBtn(speedState) {
        const btn = document.getElementById('wave-speed-btn'); const sbBtn = document.getElementById('sb-speed-btn'); const targets = [btn, sbBtn].filter(Boolean);
        if (targets.length === 0) return;
        let text, active;
        if (speedState === 0) { text = "Start Wave"; active = false; }
        else if (speedState === 1) { text = "➤ 1x"; active = true; }
        else if (speedState === 2) { text = "➤➤ 2x"; active = true; }
        else { text = "➤➤➤ 3x"; active = true; }
        targets.forEach(b => { b.innerText = text; b.classList.toggle('speed-active', active); });
    },
    hideUpgradePanel() {
        document.querySelectorAll('.tower-card[data-tower]').forEach(c => c.classList.remove('selected'));
        document.getElementById('upgrade-panel').classList.add('hidden');
    },
    log(msg) { const el = document.getElementById('message-log'); if (el) el.innerText = msg; },
    updateLives(lives) { const el = document.getElementById('lives-display'); if (el) el.innerText = `❤️ ${lives}`; },
    updateWave(wave) { const el = document.getElementById('wave-display'); if (el) el.innerText = `🌊 Wave ${wave}`; },
    updateCash(cash, engine) {
        const el = document.getElementById('cash-display'); if (el) el.innerText = `💰 ${cash}`;
        if (!this._towerCardCache) this._towerCardCache = document.querySelectorAll('.tower-card[data-tower]');
        this._towerCardCache.forEach(card => { 
            const stats = TowerStats[card.dataset.tower] || HeroStats[card.dataset.tower];
            if (!stats) return; const cost = engine.getCost(stats.cost);
            if (cash < cost) card.classList.add('disabled'); else card.classList.remove('disabled'); 
        });
        if (engine.selectedPlacedTower) this.showUpgradeUI(engine.selectedPlacedTower, engine);
    },
    updateAbilityBar(engine) {
        const bar = document.getElementById('ability-bar');
        if (!bar) return;
           // NEW: Show cancel button only if holding a tower or selecting one
        const cancelBtn = document.getElementById('cancel-btn');
        if (cancelBtn) {
            if (engine.selectedPlacedTower || engine.selectedTowerType) {
                cancelBtn.classList.remove('hidden');
            } else {
                cancelBtn.classList.add('hidden');
            }
        }

        if (engine.gameState !== 'playing') {
            bar.classList.add('hidden');
            return;
        }
        if (engine.gameState !== 'playing') { bar.classList.add('hidden'); return; }
        bar.classList.remove('hidden');

        const abilities = [];
        for (let t of engine.towers) {
            if (!t) continue;
            if (t.stats.isHero) {
                let ab1Name = "Ability 1", ab2Name = "Ability 2"; let ab1Cd = 60, ab2Cd = 70;
                if (t.type === 'quincy') { ab1Name = "Rapid"; ab2Name = "Storm"; ab1Cd = t.stats.rapidShotCd || 60; ab2Cd = t.stats.stormCd || 70; } 
                else if (t.type === 'gwendolin') { ab1Name = "Cocktail"; ab2Name = "Firestorm"; ab1Cd = 30; ab2Cd = 60; }
                else if (t.type === 'gojo') {
                    if (t.phase === 2) { ab1Name = "Reversal Red"; ab1Cd = 30; ab2Name = "Hollow Purple"; ab2Cd = 90; } 
                    else { ab1Name = "Fake Red"; ab1Cd = 10; ab2Name = "Max Blue"; ab2Cd = 45; }
                }
                if (t.stats.isAbility) abilities.push({ tower: t, slot: 1, cd: t.abilityCooldown || 0, maxCd: ab1Cd, name: ab1Name });
                if (t.stats.isAbility2) abilities.push({ tower: t, slot: 2, cd: t.ability2Cooldown || 0, maxCd: ab2Cd, name: ab2Name });
                if (t.stats.isAbility3) abilities.push({ tower: t, slot: 3, cd: t.ability3Cooldown || 0, maxCd: 120, name: "0.2 Domain" });
            } else if (t.stats.isAbility) {
                let towerCd = t.stats.abilityCd || 45; let towerName = t.stats.abilityName || "Ability";
                if (t.type === 'tack') { towerCd = 35; towerName = t.upgrades[1] === 5 ? "Super Maelstrom" : "Blade Maelstrom"; }
                abilities.push({ tower: t, slot: 1, cd: t.abilityCooldown || 0, maxCd: towerCd, name: towerName });
            }
        }

        if (bar.children.length !== abilities.length) {
            bar.innerHTML = '';
            abilities.forEach(ab => {
                const icon = document.createElement('div');
                icon.className = 'ability-icon';
                icon.addEventListener('click', () => { if (icon._tower && icon._slot) engine.activateAbility(icon._slot, icon._tower); });
                bar.appendChild(icon);
            });
        }

        for (let i = 0; i < abilities.length; i++) {
            const ab = abilities[i]; const icon = bar.children[i]; if (!icon) continue;
            icon.innerText = ab.name; icon._tower = ab.tower; icon._slot = ab.slot;
            let overlay = icon.querySelector('.cooldown-overlay');
            if (ab.cd > 0) {
                icon.classList.add('disabled');
                if (!overlay) { overlay = document.createElement('div'); overlay.className = 'cooldown-overlay'; icon.appendChild(overlay); }
                overlay.style.height = `${Math.min(100, (ab.cd / ab.maxCd) * 100)}%`;
                overlay.innerText = Math.ceil(ab.cd) + 's';
            } else { icon.classList.remove('disabled'); if (overlay) overlay.remove(); }
        }
    },
    showUpgradeUI(t, engine) {
        const panel = document.getElementById('upgrade-panel'); 
        if (!panel) return;
        panel.classList.remove('hidden'); 
        
        const heroUI = document.getElementById('hero-ui');
        const towerUI = document.getElementById('tower-ui');
        const sellBtn = document.getElementById('up-sell');
        const bankBtn = document.getElementById('up-collect-bank'); // NEW
        
        if (sellBtn && sellBtn.parentElement.id !== 'upgrade-panel') { panel.appendChild(sellBtn); }
        if (sellBtn) sellBtn.classList.remove('hidden');

        // PRO FIX: Show Bank Collect button only if it's a bank with money
        if (bankBtn) {
            if (t.type === 'farm' && t.stats.isBank && t.bankBalance > 0) {
                bankBtn.classList.remove('hidden');
                bankBtn.innerText = `Collect Bank ($${Math.floor(t.bankBalance)})`;
            } else {
                bankBtn.classList.add('hidden');
            }
        }

        if (t.stats.isHero) {
            if (heroUI) heroUI.classList.remove('hidden'); if (towerUI) towerUI.classList.add('hidden');
            const heroTitle = document.getElementById('hero-title');
            if (heroTitle) { let title = t.stats.name; if (t.type === 'gojo') title += t.phase === 2 ? " (Awakened)" : " (Teen)"; heroTitle.innerText = title; }
            const heroPops = document.getElementById('hero-pops'); if (heroPops) heroPops.innerText = `Pops: ${t.damageDealt}`;
            const heroLevelText = document.getElementById('hero-level-text'); if (heroLevelText) heroLevelText.innerText = `Level ${t.level} / 20 | XP: ${t.xp} / ${t.xpToNext}`;
            const heroExpFill = document.getElementById('hero-exp-fill'); if (heroExpFill) heroExpFill.style.width = `${(t.xp / t.xpToNext) * 100}%`;
            const upTargeting = document.getElementById('up-targeting'); if (upTargeting) upTargeting.innerText = `Target: ${t.targetingMode}`;
            const buyBtn = document.getElementById('up-buy-level');
            if (buyBtn) {
                if (t.level < 20) {
                    buyBtn.classList.remove('hidden'); const cost = t.xpToNext - t.xp; buyBtn.innerText = `Buy Level ($${cost})`;
                    if (engine.cash < cost) { buyBtn.classList.add('disabled'); } else { buyBtn.classList.remove('disabled'); }
                } else { buyBtn.classList.add('hidden'); }
            }
        } else {
            if (heroUI) heroUI.classList.add('hidden'); if (towerUI) towerUI.classList.remove('hidden');
            const upTitle = document.getElementById('up-title'); if (upTitle) upTitle.innerText = TowerStats[t.type].name; 
            const upStats = document.getElementById('up-stats'); if (upStats) upStats.innerText = `DMG: ${t.stats.damage} | RNG: ${t.stats.range === 9999 ? 'Global' : t.stats.range} | RATE: ${t.stats.fireRate.toFixed(2)}`; 
            let counters = "";
            if (t.type === 'farm' && t.stats.isBank) counters = `🏦 Bank: $${Math.floor(t.bankBalance)}`;
            else if (t.type === 'farm') counters = `💰 Cash Gen: ${t.cashGenerated}`;
            else if (t.type === 'engineer' && t.activeTrap) counters = `🪤 Trap: ${t.activeTrap.rbe}/${t.activeTrap.maxRbe}`;
            else counters = `💥 Dmg Dealt: ${t.damageDealt}`;
            const upCounters = document.getElementById('up-counters'); if (upCounters) upCounters.innerText = counters; 
            const upTargetingTower = document.getElementById('up-targeting-tower'); if (upTargetingTower) upTargetingTower.innerText = `Target: ${t.targetingMode}`; 
            this.updateUpgradeCard('up-path1', t, 1, engine); this.updateUpgradeCard('up-path2', t, 2, engine); this.updateUpgradeCard('up-path3', t, 3, engine); 
        }
        if (t.x > 360) { panel.style.left = '20px'; panel.style.right = 'auto'; } else { panel.style.right = '200px'; panel.style.left = 'auto'; } 
    },
    updateUpgradeCard(id, tower, path, engine) { 
        const card = document.getElementById(id); if (!card) return; const tier = tower.upgrades[path - 1]; const upgradeData = Upgrades[tower.type][path][tier]; 
        card.classList.remove('locked'); 
        if (!upgradeData) { card.querySelector('.up-name').innerText = "MAXED (5/5)"; card.querySelector('.cost').innerText = ""; card.classList.add('locked'); } 
        else { 
            let cost = engine.getCost(upgradeData.cost); card.querySelector('.up-name').innerText = `${upgradeData.name} (${tier+1}/5)`; card.querySelector('.cost').innerText = `$${cost}`; 
            if (engine.cash < cost || !tower.canUpgrade(path)) card.classList.add('locked'); 
        } 
    }
};