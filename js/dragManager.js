// js/dragManager.js
import { GameEngine } from './engine.js';
import { Config, HeroStats } from './config.js';
import { TowerStats, Upgrades } from './towers/index.js';
import { UI } from './ui.js';
import { AudioEngine } from './audio.js';
import { applyBossEffects } from './input.js';
import { getBehavior } from './registry.js'; // FIX: Import getBehavior
import { TowerRegistry, TOWER_CATEGORIES } from './towers/index.js';
import { HeroRegistry } from './heroes/index.js';
import { CutsceneManager } from './cutscene.js'; // FIX: Import Cutscene Manager

export function generateShopUI() {
    const shopView = document.getElementById('shop-view');
    if (!shopView) return;
    shopView.innerHTML = ''; // Clear out any old HTML

    // 1. Add Hero Card first
    const selectedHero = Config.data.selectedHero || 'quincy';
    if (HeroRegistry[selectedHero]) {
        const heroCard = document.createElement('div');
        heroCard.className = 'tower-card cat-hero';
        heroCard.id = 'hero-shop-card';
        heroCard.dataset.tower = selectedHero;
        heroCard.style.backgroundImage = `url('sprites/portraits/${selectedHero}_menuportrait.png')`;
        heroCard.innerHTML = `<span class="cost">$${HeroRegistry[selectedHero].stats.cost}</span>`;
        shopView.appendChild(heroCard);
    }

    // 2. Get all towers and sort them by category so they stay grouped nicely
    const categoryOrder = ['Primary', 'Military', 'Magic', 'Support'];
    const sortedTowers = Object.keys(TowerRegistry).sort((a, b) => {
        const catA = TOWER_CATEGORIES[a] || 'Support';
        const catB = TOWER_CATEGORIES[b] || 'Support';
        return categoryOrder.indexOf(catA) - categoryOrder.indexOf(catB);
    });

    // 3. Add Tower Cards in the correct sorted order
    for (const type of sortedTowers) {
        const stats = TowerRegistry[type].stats;
        if (!stats) continue;

        const card = document.createElement('div');
        const category = TOWER_CATEGORIES[type] || 'Support'; 
        card.className = `tower-card cat-${category.toLowerCase()}`;
        card.dataset.tower = type;
        
        card.style.backgroundImage = `url('sprites/portraits/${type}_menuportrait.png')`;
        card.innerHTML = `<span class="cost">$${stats.cost}</span>`;
        
        shopView.appendChild(card);
    }
}

const dom = {
    towerCards: document.querySelectorAll('.tower-card[data-tower]'),
    sbViewToggle: document.getElementById('sb-view-toggle'),
    enemyCards: document.querySelectorAll('#enemy-view .tower-card[data-enemy]'),
    camoToggleBtn: document.getElementById('sb-toggle-camo'),
    regenToggleBtn: document.getElementById('sb-toggle-regen'),
    fortToggleBtn: document.getElementById('sb-toggle-fortified'),
    upPaths: [
        document.getElementById('up-path1'),
        document.getElementById('up-path2'),
        document.getElementById('up-path3')
    ],
    upBuyLevel: document.getElementById('up-buy-level'),
    upSell: document.getElementById('up-sell'),
    upCollectBank: document.getElementById('up-collect-bank'),
    shopHeader: document.getElementById('shop-header')
};

let cachedSidebarRect = null;
function getSidebarRect() {
    if (!cachedSidebarRect) {
        cachedSidebarRect = document.getElementById('sidebar').getBoundingClientRect();
    }
    return cachedSidebarRect;
}
window.addEventListener('resize', () => { cachedSidebarRect = null; });

export function updateShopPrices() {
    // FIX: Re-query the cards here, just in case it's called before setupShopListeners finishes
    dom.towerCards = document.querySelectorAll('.tower-card[data-tower]');
    
    const costMod = GameEngine.difficulty ? GameEngine.difficulty.costMod : 1.0;
    dom.towerCards.forEach(card => {
        const type = card.dataset.tower;
        const stats = TowerStats[type] || HeroStats[type];
        if (stats) {
            let cost = Math.floor(stats.cost * costMod);
            const costEl = card.querySelector('.cost');
            
            // FIX: Generic unlock key check instead of hardcoding 'farmer'
            let isLocked = !Config.data.unlockedTowers.includes(type);
            if (stats.unlockKey) {
                isLocked = !Config.data.unlocks[stats.unlockKey];
            }

            // FIX: Let the tower module modify the placement cost (e.g. Dart Monkey freebie)
            const behavior = getBehavior(type);
            if (behavior?.getPlacementCostModifier) {
                cost = behavior.getPlacementCostModifier(stats, cost, GameEngine);
            }

            if (isLocked) {
                card.classList.add('locked');
                if (costEl) costEl.innerText = '🔒 Locked';
            } else {
                card.classList.remove('locked');
                if (costEl) costEl.innerText = cost === 0 ? "Free!" : `$${cost}`;
            }
        }
    });
}

export function setupShopListeners() {
    generateShopUI(); 
    
    // FIX: Re-query the DOM elements AFTER they are generated!
    dom.towerCards = document.querySelectorAll('.tower-card[data-tower]');
    // FIX: Re-query enemy cards to include the newly added Knight card
    dom.enemyCards = document.querySelectorAll('#enemy-view .tower-card[data-enemy]');
    
    let sandboxCamoOn = false, sandboxRegenOn = false, sandboxFortifiedOn = false;
    const shopView = document.getElementById('shop-view');
    const enemyView = document.getElementById('enemy-view');
    
    const updateShopHeader = (name) => {
        if (dom.shopHeader) {
            const text = name || "Shop";
            dom.shopHeader.innerText = text;
            dom.shopHeader.style.fontSize = '22px'; 
            let fontSize = 22;
            while (dom.shopHeader.scrollWidth > dom.shopHeader.clientWidth && fontSize > 12) {
                fontSize--;
                dom.shopHeader.style.fontSize = `${fontSize}px`;
            }
        }
    };

    if (dom.sbViewToggle) {
        dom.sbViewToggle.addEventListener('click', () => {
            const showingEnemies = enemyView && !enemyView.classList.contains('hidden');
            if (showingEnemies) {
                enemyView.classList.add('hidden');
                shopView.classList.remove('hidden');
                dom.sbViewToggle.innerText = '🎈 Spawn Bloons';
                updateShopHeader("Shop");
            } else {
                shopView.classList.add('hidden');
                enemyView.classList.remove('hidden');
                dom.sbViewToggle.innerText = '🐵 Back to Shop';
                updateShopHeader("Spawn Bloons");
            }
        });
    }

    dom.camoToggleBtn?.addEventListener('click', () => {
        sandboxCamoOn = !sandboxCamoOn;
        dom.camoToggleBtn.classList.toggle('active', sandboxCamoOn);
        dom.camoToggleBtn.innerText = `Camo: ${sandboxCamoOn ? 'On' : 'Off'}`;
    });
    dom.regenToggleBtn?.addEventListener('click', () => {
        sandboxRegenOn = !sandboxRegenOn;
        dom.regenToggleBtn.classList.toggle('active', sandboxRegenOn);
        dom.regenToggleBtn.innerText = `Regen: ${sandboxRegenOn ? 'On' : 'Off'}`;
    });
    dom.fortToggleBtn?.addEventListener('click', () => {
        sandboxFortifiedOn = !sandboxFortifiedOn;
        dom.fortToggleBtn.classList.toggle('active', sandboxFortifiedOn);
        dom.fortToggleBtn.innerText = `Fortified: ${sandboxFortifiedOn ? 'On' : 'Off'}`;
    });

    dom.enemyCards.forEach(card => {
        card.addEventListener('click', () => {
            if (!GameEngine.isSandbox || !GameEngine.map) return;
            const enemyType = card.dataset.enemy;
            
            // FIX: Handle Knight Boss cutscene trigger
            if (enemyType === 'knight') {
                let boss = null;
                let bestRbe = 0;
                // Find the strongest MOAB-class bloon currently on screen
                for (let e of GameEngine.enemies) {
                    if (e && e.alive && e.data.isMoab && e.data.rbe > bestRbe) {
                        bestRbe = e.data.rbe;
                        boss = e;
                    }
                }
                
                // If none exists, spawn a MOAB (Tier 13) so the cutscene has something to play on
                if (!boss) {
                    boss = GameEngine.enemyPool.get();
                    boss.init(13, GameEngine.map, false, false, 13, false, null, 0, false);
                    GameEngine.enemies.push(boss);
                }
                
                // Trigger the cutscene!
                CutsceneManager.trigger(boss);
                return;
            }

            const tier = parseInt(enemyType, 10);
            let isCamo = sandboxCamoOn || tier === 16;
            let e = GameEngine.enemyPool.get();
            e.init(tier, GameEngine.map, isCamo, sandboxRegenOn, tier, sandboxFortifiedOn, null, 0, false);
            GameEngine.enemies.push(e);
        });
    });

    dom.towerCards.forEach(card => {
        card.addEventListener('pointerdown', (e) => {
            e.preventDefault(); 
            
            const type = card.dataset.tower;
            const stats = TowerStats[type] || HeroStats[type];
            if (!stats) return;

            if (card.classList.contains('locked')) {
                GameEngine.log(`${stats.name} is locked!`);
                return;
            }

            if (GameEngine.cash < GameEngine.getCost(stats.cost)) {
                GameEngine.log("Not enough cash!");
                return;
            }
            
            GameEngine.deselectAll();
            GameEngine.stuckPlacement = null;
            dom.towerCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            GameEngine.selectedTowerType = type;
            document.getElementById('cancel-btn').classList.remove('hidden');

            updateShopHeader(stats.name);

            let isDragging = false;
            const startX = e.clientX;
            const startY = e.clientY;

            const rect = GameEngine.canvas.getBoundingClientRect();
            const scaleX = GameEngine.canvas.width / rect.width;
            const scaleY = GameEngine.canvas.height / rect.height;
            
            let initMx = (e.clientX - rect.left) * scaleX;
            let initMy = (e.clientY - rect.top) * scaleY;
            
            GameEngine.mouse.rawX = initMx;
            GameEngine.mouse.rawY = initMy;
            
            const initAdj = applyBossEffects(initMx, initMy);
            GameEngine.mouse.x = initAdj.x;
            GameEngine.mouse.y = initAdj.y;

            const onMove = (ev) => {
                const dx = Math.abs(ev.clientX - startX);
                const dy = Math.abs(ev.clientY - startY);
                if (dx > 5 || dy > 5) {
                    isDragging = true;
                }
                if (isDragging) {
                    let mx = (ev.clientX - rect.left) * scaleX;
                    let my = (ev.clientY - rect.top) * scaleY;
                    
                    GameEngine.mouse.rawX = mx;
                    GameEngine.mouse.rawY = my;
                    
                    const adj = applyBossEffects(mx, my);
                    GameEngine.mouse.x = adj.x;
                    GameEngine.mouse.y = adj.y;
                }
            };

            const onUp = (ev) => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);

                if (isDragging) {
                    const sidebarRect = getSidebarRect();

                    if (ev.clientX >= sidebarRect.left && ev.clientX <= sidebarRect.right) {
                        GameEngine.deselectAll();
                        updateShopHeader(); 
                        return;
                    } else if (ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
                        const dropX = (ev.clientX - rect.left) * scaleX;
                        const dropY = (ev.clientY - rect.top) * scaleY;
                        
                        GameEngine.mouse.rawX = dropX;
                        GameEngine.mouse.rawY = dropY;
                        
                        GameEngine._ignoreNextClick = true; 
                        GameEngine.handleCanvasClick(ev); 
                        
                        if (GameEngine.selectedTowerType) {
                            GameEngine.stuckPlacement = { x: dropX, y: dropY };
                        } else {
                            updateShopHeader(); 
                        }
                    } else {
                        GameEngine.deselectAll();
                        updateShopHeader(); 
                    }
                }
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        });

        card.addEventListener('mouseenter', () => {
            const stats = TowerStats[card.dataset.tower] || HeroStats[card.dataset.tower];
            if (stats) {
                if (card.classList.contains('locked')) {
                    updateShopHeader(`🔒 ${stats.name} (Locked)`);
                } else {
                    updateShopHeader(stats.name);
                }
            }
        });

        card.addEventListener('mouseleave', () => {
            if (!GameEngine.selectedTowerType) {
                updateShopHeader();
            } else {
                const stats = TowerStats[GameEngine.selectedTowerType] || HeroStats[GameEngine.selectedTowerType];
                if (stats) updateShopHeader(stats.name);
                else updateShopHeader();
            }
        });
    });

    GameEngine.canvas.addEventListener('click', () => {
        setTimeout(updateShopPrices, 10);
    });

    const upHover = (el, path) => {
        if (!el) return;
        el.addEventListener('mouseenter', () => {
            if (!GameEngine.selectedPlacedTower) return;
            const t = GameEngine.selectedPlacedTower;
            if (t.stats.isHero) return; 
            const tier = t.upgrades[path - 1];
            const data = Upgrades[t.type][path][tier];
            const tip = document.getElementById('upgrade-tooltip');
            if (data && tip) {
                tip.innerHTML = `<b>${data.name} (${tier + 1}/5)</b><br>${data.desc}`;
                const rect = el.getBoundingClientRect();
                const containerRect = document.getElementById('game-container').getBoundingClientRect();
                tip.style.left = (rect.right - containerRect.left + 5) + 'px';
                tip.style.top = (rect.top - containerRect.top) + 'px';
                tip.style.opacity = 1;
            }
        });
        el.addEventListener('mouseleave', () => {
            const tip = document.getElementById('upgrade-tooltip');
            if (tip) tip.style.opacity = 0;
        });
    };
    
    dom.upPaths.forEach((el, i) => upHover(el, i + 1));
    dom.upBuyLevel?.addEventListener('click', () => GameEngine.buyHeroLevel());
    dom.upPaths.forEach((el, i) => el?.addEventListener('click', () => GameEngine.handleUpgrade(i + 1)));
    dom.upSell?.addEventListener('click', () => GameEngine.sellTower());
    dom.upCollectBank?.addEventListener('click', () => {
        if (GameEngine.selectedPlacedTower && GameEngine.selectedPlacedTower.bankBalance > 0) {
            GameEngine.addCash(Math.floor(GameEngine.selectedPlacedTower.bankBalance));
            GameEngine.selectedPlacedTower.bankBalance = 0;
            AudioEngine.playSfx('cash');
            UI.showUpgradeUI(GameEngine.selectedPlacedTower, GameEngine);
        }
    });
}

export function setupNudgeLogic() {
    GameEngine.stuckPlacement = null;
    GameEngine._ignoreNextClick = false;
    if (GameEngine._nudgeHooked) return;
    GameEngine._nudgeHooked = true;
    
    let isNudging = false;
    let isCanvasDragging = false;
    let nudgeStart = {};

    const getCanvasPos = (clientX, clientY) => {
        const rect = GameEngine.canvas.getBoundingClientRect();
        const scaleX = GameEngine.canvas.width / rect.width;
        const scaleY = GameEngine.canvas.height / rect.height;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };

    GameEngine.canvas.addEventListener('click', (e) => {
        if (GameEngine._ignoreNextClick) {
            GameEngine._ignoreNextClick = false;
            e.stopImmediatePropagation();
            return;
        }
        
        if (GameEngine.selectedTowerType && GameEngine.stuckPlacement) {
            const rect = GameEngine.canvas.getBoundingClientRect();
            const scaleX = GameEngine.canvas.width / rect.width;
            const scaleY = GameEngine.canvas.height / rect.height;
            const mx = (e.clientX - rect.left) * scaleX;
            const my = (e.clientY - rect.top) * scaleY;
            const dx = mx - GameEngine.stuckPlacement.x;
            const dy = my - GameEngine.stuckPlacement.y;
            const dist = Math.hypot(dx, dy);

            if (dist > 50) {
                GameEngine.deselectAll();
                GameEngine.stuckPlacement = null;
                e.stopImmediatePropagation();
                return;
            } else {
                e.stopImmediatePropagation();
                const fakeClientX = rect.left + (GameEngine.stuckPlacement.x / scaleX);
                const fakeClientY = rect.top + (GameEngine.stuckPlacement.y / scaleY);
                GameEngine.handleCanvasClick({ clientX: fakeClientX, clientY: fakeClientY });
            }
        }
    }, true);

    GameEngine.canvas.addEventListener('pointerdown', (e) => {
        if (GameEngine.gameState !== 'playing' || !GameEngine.selectedTowerType || !GameEngine.stuckPlacement) return;
        
        e.preventDefault();
        const pos = getCanvasPos(e.clientX, e.clientY);
        
        GameEngine.mouse.rawX = pos.x;
        GameEngine.mouse.rawY = pos.y;
        
        const adj = applyBossEffects(pos.x, pos.y);
        const dx = pos.x - GameEngine.stuckPlacement.x;
        const dy = pos.y - GameEngine.stuckPlacement.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 60) {
            isCanvasDragging = true;
            GameEngine.stuckPlacement = null;
            GameEngine.mouse.x = adj.x;
            GameEngine.mouse.y = adj.y;
        } else {
            isNudging = true;
            nudgeStart = { mouseX: pos.x, mouseY: pos.y, stuckX: GameEngine.stuckPlacement.x, stuckY: GameEngine.stuckPlacement.y };
        }
    });

    window.addEventListener('pointermove', (e) => {
        if (GameEngine.gameState !== 'playing' || !GameEngine.selectedTowerType) return;

        const pos = getCanvasPos(e.clientX, e.clientY);
        
        GameEngine.mouse.rawX = pos.x;
        GameEngine.mouse.rawY = pos.y;
        
        const adj = applyBossEffects(pos.x, pos.y);
        const sidebarRect = getSidebarRect();
        const overSidebar = (e.clientX >= sidebarRect.left && e.clientX <= sidebarRect.right);

        if (isNudging) {
            if (overSidebar) {
                GameEngine.deselectAll();
                isNudging = false;
                return;
            }
            
            const dx = pos.x - GameEngine.stuckPlacement.x;
            const dy = pos.y - GameEngine.stuckPlacement.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 60) {
                isNudging = false;
                isCanvasDragging = true;
                GameEngine.stuckPlacement = null;
                GameEngine.mouse.x = adj.x;
                GameEngine.mouse.y = adj.y;
            } else {
                const mdx = pos.x - nudgeStart.mouseX;
                const mdy = pos.y - nudgeStart.mouseY;
                GameEngine.stuckPlacement = {
                    x: nudgeStart.stuckX + (mdx / 10),
                    y: nudgeStart.stuckY + (mdy / 10)
                };
            }
        } else if (isCanvasDragging) {
            if (overSidebar) {
                GameEngine.deselectAll();
                isCanvasDragging = false;
                return;
            }
            GameEngine.mouse.x = adj.x;
            GameEngine.mouse.y = adj.y;
        }
    });

    window.addEventListener('pointerup', (e) => {
        if (GameEngine.gameState !== 'playing' || !GameEngine.selectedTowerType) {
            isNudging = false;
            isCanvasDragging = false;
            return;
        }

        const pos = getCanvasPos(e.clientX, e.clientY);
        const sidebarRect = getSidebarRect();
        const overSidebar = (e.clientX >= sidebarRect.left && e.clientX <= sidebarRect.right);

        if (overSidebar) {
            GameEngine.deselectAll();
            GameEngine.stuckPlacement = null;
            isNudging = false;
            isCanvasDragging = false;
            return;
        }

        const rect = GameEngine.canvas.getBoundingClientRect();
        const scaleX = GameEngine.canvas.width / rect.width;
        const scaleY = GameEngine.canvas.height / rect.height;

        GameEngine.mouse.rawX = pos.x;
        GameEngine.mouse.rawY = pos.y;

        if (isNudging) {
            isNudging = false;
            GameEngine._ignoreNextClick = true; 
            
            const fakeClientX = rect.left + (GameEngine.stuckPlacement.x / scaleX);
            const fakeClientY = rect.top + (GameEngine.stuckPlacement.y / scaleY);
            GameEngine.handleCanvasClick({ clientX: fakeClientX, clientY: fakeClientY });
            
            if (!GameEngine.selectedTowerType) {
                GameEngine.stuckPlacement = null;
            }
        } else if (isCanvasDragging) {
            isCanvasDragging = false;
            GameEngine._ignoreNextClick = true; 
            GameEngine.handleCanvasClick(e);
            
            if (GameEngine.selectedTowerType) {
                const dropX = (e.clientX - rect.left) * scaleX;
                const dropY = (e.clientY - rect.top) * scaleY;
                GameEngine.stuckPlacement = { x: dropX, y: dropY };
            } else {
                GameEngine.stuckPlacement = null;
            }
        }
    });
}