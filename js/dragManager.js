// js/dragManager.js
import { GameEngine } from './engine.js';
import { Config, HeroStats } from './config.js';
import { TowerStats, Upgrades } from './towers/index.js';
import { UI } from './ui.js';
import { AudioEngine } from './audio.js';

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

export function updateShopPrices() {
    const costMod = GameEngine.difficulty ? GameEngine.difficulty.costMod : 1.0;
    dom.towerCards.forEach(card => {
        const type = card.dataset.tower;
        const stats = TowerStats[type] || HeroStats[type];
        if (stats) {
            let cost = Math.floor(stats.cost * costMod);
            const costEl = card.querySelector('.cost');
            
            if (type === 'dart' && !GameEngine.isSandbox && GameEngine.difficulty && !GameEngine.difficulty.noSelling) {
                const mkActive = Config.data.mkActive !== false;
                const hasFreeMonkey = Config.data.unlocks.freeFirstDartMonkey || (mkActive && Config.data.monkeyKnowledge && Config.data.monkeyKnowledge.bonus_monkey);
                if (hasFreeMonkey && !GameEngine.towers.some(t => t.type === 'dart')) {
                    cost = 0;
                }
            }

            if (costEl) costEl.innerText = cost === 0 ? "Free!" : `$${cost}`;
        }
    });
}

export function setupShopListeners() {
    let sandboxCamoOn = false, sandboxRegenOn = false, sandboxFortifiedOn = false;
    const shopView = document.getElementById('shop-view');
    const enemyView = document.getElementById('enemy-view');
    
    // Helper to update the header text
    const updateShopHeader = (name) => {
        if (dom.shopHeader) {
            dom.shopHeader.innerText = name || "Shop";
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
            const tier = parseInt(card.dataset.enemy, 10);
            let isCamo = sandboxCamoOn || tier === 16;
            let e = GameEngine.enemyPool.get();
            e.init(tier, GameEngine.map, isCamo, sandboxRegenOn, tier, sandboxFortifiedOn, null, 0, false);
            GameEngine.enemies.push(e);
        });
    });

    // --- REWRITTEN DRAG AND DROP LOGIC ---
    dom.towerCards.forEach(card => {
        card.addEventListener('pointerdown', (e) => {
            e.preventDefault(); 
            
            const type = card.dataset.tower;
            const stats = TowerStats[type] || HeroStats[type];
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

            // Update header on click/select
            updateShopHeader(stats.name);

            let isDragging = false;
            const startX = e.clientX;
            const startY = e.clientY;

            const rect = GameEngine.canvas.getBoundingClientRect();
            const scaleX = GameEngine.canvas.width / rect.width;
            const scaleY = GameEngine.canvas.height / rect.height;
            GameEngine.mouse.x = (e.clientX - rect.left) * scaleX;
            GameEngine.mouse.y = (e.clientY - rect.top) * scaleY;

            const onMove = (ev) => {
                const dx = Math.abs(ev.clientX - startX);
                const dy = Math.abs(ev.clientY - startY);
                if (dx > 5 || dy > 5) {
                    isDragging = true;
                }
                if (isDragging) {
                    GameEngine.mouse.x = (ev.clientX - rect.left) * scaleX;
                    GameEngine.mouse.y = (ev.clientY - rect.top) * scaleY;
                }
            };

            const onUp = (ev) => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);

                if (isDragging) {
                    const sidebarRect = document.getElementById('sidebar').getBoundingClientRect();

                    if (ev.clientX >= sidebarRect.left && ev.clientX <= sidebarRect.right) {
                        GameEngine.deselectAll();
                        updateShopHeader(); // Revert to "Shop" if dropped on sidebar
                        return;
                    } else if (ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
                        const dropX = (ev.clientX - rect.left) * scaleX;
                        const dropY = (ev.clientY - rect.top) * scaleY;
                        
                        GameEngine._ignoreNextClick = true; // Prevent native click event from double-firing
                        GameEngine.handleCanvasClick({ clientX: ev.clientX, clientY: ev.clientY });
                        
                        if (GameEngine.selectedTowerType) {
                            GameEngine.stuckPlacement = { x: dropX, y: dropY };
                        } else {
                            updateShopHeader(); // Revert to "Shop" if placed successfully
                        }
                    } else {
                        GameEngine.deselectAll();
                        updateShopHeader(); // Revert to "Shop" if dropped outside
                    }
                }
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        });

        card.addEventListener('mouseenter', () => {
            const stats = TowerStats[card.dataset.tower] || HeroStats[card.dataset.tower];
            if (stats) updateShopHeader(stats.name);
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

    // Capture phase click handler to intercept native canvas clicks
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
                e.clientX = rect.left + (GameEngine.stuckPlacement.x / scaleX);
                e.clientY = rect.top + (GameEngine.stuckPlacement.y / scaleY);
            }
        }
    }, true);

    GameEngine.canvas.addEventListener('pointerdown', (e) => {
        if (GameEngine.gameState !== 'playing' || !GameEngine.selectedTowerType || !GameEngine.stuckPlacement) return;
        
        e.preventDefault();
        const pos = getCanvasPos(e.clientX, e.clientY);
        const dx = pos.x - GameEngine.stuckPlacement.x;
        const dy = pos.y - GameEngine.stuckPlacement.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 60) {
            isCanvasDragging = true;
            GameEngine.stuckPlacement = null;
            GameEngine.mouse.x = pos.x;
            GameEngine.mouse.y = pos.y;
        } else {
            isNudging = true;
            nudgeStart = { mouseX: pos.x, mouseY: pos.y, stuckX: GameEngine.stuckPlacement.x, stuckY: GameEngine.stuckPlacement.y };
        }
    });

    window.addEventListener('pointermove', (e) => {
        if (GameEngine.gameState !== 'playing' || !GameEngine.selectedTowerType) return;

        const pos = getCanvasPos(e.clientX, e.clientY);
        const sidebarRect = document.getElementById('sidebar').getBoundingClientRect();
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
                GameEngine.mouse.x = pos.x;
                GameEngine.mouse.y = pos.y;
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
            GameEngine.mouse.x = pos.x;
            GameEngine.mouse.y = pos.y;
        }
    });

    window.addEventListener('pointerup', (e) => {
        if (GameEngine.gameState !== 'playing' || !GameEngine.selectedTowerType) {
            isNudging = false;
            isCanvasDragging = false;
            return;
        }

        const pos = getCanvasPos(e.clientX, e.clientY);
        const sidebarRect = document.getElementById('sidebar').getBoundingClientRect();
        const overSidebar = (e.clientX >= sidebarRect.left && e.clientX <= sidebarRect.right);

        if (overSidebar) {
            GameEngine.deselectAll();
            GameEngine.stuckPlacement = null;
            isNudging = false;
            isCanvasDragging = false;
            return;
        }

        if (isNudging) {
            isNudging = false;
            GameEngine._ignoreNextClick = true; // Prevent native click from firing
            
            // Attempt to place at the NUDGED position!
            const rect = GameEngine.canvas.getBoundingClientRect();
            const scaleX = GameEngine.canvas.width / rect.width;
            const scaleY = GameEngine.canvas.height / rect.height;
            const fakeClientX = rect.left + (GameEngine.stuckPlacement.x / scaleX);
            const fakeClientY = rect.top + (GameEngine.stuckPlacement.y / scaleY);
            
            GameEngine.handleCanvasClick({ clientX: fakeClientX, clientY: fakeClientY });
            
            // If placement failed, it stays stuck at the nudged position
            if (!GameEngine.selectedTowerType) {
                GameEngine.stuckPlacement = null;
            }
        } else if (isCanvasDragging) {
            isCanvasDragging = false;
            GameEngine._ignoreNextClick = true; // Prevent native click from double-firing
            
            // Attempt to place where the mouse is
            GameEngine.handleCanvasClick(e);
            
            // If placement failed, stick it to the drop spot
            if (GameEngine.selectedTowerType) {
                GameEngine.stuckPlacement = { x: pos.x, y: pos.y };
            } else {
                GameEngine.stuckPlacement = null;
            }
        }
    });
}