// js/uiTowerPanel.js
import { TowerStats, Upgrades } from './towers/index.js';
import { Config } from './config.js';
import { canOfferParagon, PARAGON_POWER_RULES } from './paragonPower.js';
import { getEffectiveCooldown } from './towerBehavior.js';
import { HeroRegistry } from './heroes/index.js';
import { uiHooks } from './uiHooks.js';
import { getSellValue } from './towerEconomy.js';
import { getBehavior } from './registry.js';
import { GAME_AREA_WIDTH } from './constants.js';
import { writeThrottled, writeStyleThrottled } from './uiWriteThrottle.js';

const _elCache = {};
function el(id) {
    if (!_elCache[id]) {
        _elCache[id] = document.getElementById(id);
    }
    return _elCache[id];
}

const uiTowerPanel = {
    _lastHeroLevel: -1,

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

            // v1.4.3: these ran as unconditional innerText writes every
            // frame (a forced layout per ability icon); the values are
            // stable between cooldown seconds, so change-detect them.
            writeThrottled(icon, ab.name);
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
                writeThrottled(overlay, Math.ceil(ab.cd) + 's');
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
            } else if (t.stats.isAbility || t.stats.isAbility2 || t.stats.isAbility3) {
                const behavior = getBehavior(t.type);
                if (t.stats.isAbility) {
                    const towerCd = t.stats.abilityCd || 45;
                    const towerName = t.stats.abilityName || "Ability";
                    
                    let cd = t.abilityCooldown || 0;
                    if (behavior?.getAbilityTarget) {
                        let target = behavior.getAbilityTarget(t, 1);
                        if (target) cd = target.abilityCooldown || 0;
                    }
                    abilities.push({ tower: t, slot: 1, cd: cd, maxCd: towerCd, name: towerName });
                }
                if (t.stats.isAbility2) {
                    abilities.push({ tower: t, slot: 2, cd: t.ability2Cooldown || 0, maxCd: t.stats.ability2Cd || 70, name: t.stats.ability2Name || "Ability 2" });
                }
                if (t.stats.isAbility3) {
                    abilities.push({ tower: t, slot: 3, cd: t.ability3Cooldown || 0, maxCd: t.stats.ability3Cd || 120, name: t.stats.ability3Name || "Ability 3" });
                }
            }
        }
        return abilities;
    },

    _collectHeroAbilities(t, abilities) {
        let ab1Name = t.stats.abilityName || "Ability 1";
        let ab2Name = t.stats.ability2Name || "Ability 2";
        let ab3Name = t.stats.ability3Name || "Ability 3";
        let ab1Cd = t.stats.abilityCd || 60;
        let ab2Cd = t.stats.ability2Cd || 70;
        let ab3Cd = t.stats.ability3Cd || 120;
        
        if (t.type === 'gojo') {
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
            abilities.push({ tower: t, slot: 3, cd: t.ability3Cooldown || 0, maxCd: ab3Cd, name: ab3Name });
        }
    },

    showUpgradeUI(t, engine) {
        const panel = el('upgrade-sidebar');
        if (!panel) return;

        const shouldBeOnRight = t.x <= GAME_AREA_WIDTH / 2;
        const isCurrentlyOnRight = panel.classList.contains('sidebar-right');
        const isCurrentlyHidden = panel.classList.contains('hidden');

        if (isCurrentlyHidden || shouldBeOnRight !== isCurrentlyOnRight) {
            panel.style.transition = 'none';
            panel.classList.toggle('sidebar-right', shouldBeOnRight);
            panel.classList.add('hidden');
            void panel.offsetWidth; 
            panel.style.transition = '';
            requestAnimationFrame(() => {
                panel.classList.remove('hidden');
            });
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

        // v1.4.3: this wrote three style properties EVERY frame (style
        // recalc per frame). The path only changes on upgrade or selection
        // switch, so change-detect it.
        if (portrait._lastImgPath === imgPath) return;
        portrait._lastImgPath = imgPath;
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
            // v1.4.1: paragons are sellable again - they get a normal Sell
            // button priced by getSellValue (totalSpent now carries everything
            // the player paid for the paragon). Minions still have no Sell.
            if (t.isMinion) { sellBtn.classList.add('hidden'); return; }
            sellBtn.classList.remove('hidden');
            const sellValue = getSellValue(t, engine);
            writeThrottled(sellBtn, `Sell ($${sellValue})`);
        }
        
        const bankBtn = el('up-collect-bank');
        if (bankBtn && bankBtn.parentElement !== panel) {
            panel.appendChild(bankBtn);
        }
        if (bankBtn) {
            const showBank = t.stats.isBank && t.bankBalance > 0;
            if (showBank) {
                bankBtn.classList.remove('hidden');
                writeThrottled(bankBtn, `Collect Bank ($${Math.floor(t.bankBalance)})`);
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
            writeThrottled(title, titleStr);
        }
        
        const counters = el('up-counters');
        // v1.4.3: "Pops: N" ticks at hit rate for fast heroes - coalesce the
        // counter to 10Hz instead of one forced layout per frame.
        if (counters) writeThrottled(counters, `Pops: ${t.damageDealt}`, 100);
        
        const levelText = el('hero-level-text');
        if (levelText) {
            writeThrottled(levelText, `Level ${t.level} / 20 | XP: ${t.xp} / ${t.xpToNext}`, 100);
        }
        
        const expFill = el('hero-exp-fill');
        if (expFill) {
            writeStyleThrottled(expFill, 'width', `${(t.xp / t.xpToNext) * 100}%`, 100);
        }
        
        const currentDesc = el('hero-current-desc');
        if (currentDesc) {
            writeThrottled(currentDesc, this._getHeroLevelDescription(t.type, t.level));
        }
        
        const nextDesc = el('hero-next-desc');
        if (nextDesc) {
            writeThrottled(nextDesc, t.level < 20 ? `Next: ${this._getHeroLevelDescription(t.type, t.level + 1)}` : "Max Level Reached");
        }
        
        // FIX: Hero level up pop animation on the PORTRAIT
        const portrait = el('up-portrait');
        if (this._lastHeroLevel !== -1 && t.level > this._lastHeroLevel) {
            if (portrait) {
                portrait.classList.remove('pop-anim');
                void portrait.offsetWidth; // Force reflow to restart animation
                portrait.classList.add('pop-anim');
            }
        }
        this._lastHeroLevel = t.level;

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
            writeThrottled(buyBtn, `Buy Level ($${cost})`);
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
        
        if (pathsEl) pathsEl.classList.toggle('hidden', t.isMinion);
        // Minions never reach _updateUpgradeCards, so the paragon convergence
        // block would keep the PREVIOUS tower's state - hide it explicitly.
        if (t.isMinion) {
            const conv = el('paragon-convergence');
            if (conv) conv.classList.add('hidden');
        }
        
        const behavior = getBehavior(t.type);

        let canTarget = !t.isMinion;
        if (t.canChangeTargeting !== undefined) canTarget = t.canChangeTargeting;
        if (behavior?.canChangeTargeting) canTarget = behavior.canChangeTargeting(t);
        
        if (targetingRow) targetingRow.classList.toggle('hidden', !canTarget);

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
        const effPierce = Math.round(basePierce + buffedPierce + alchPierce);
        
        const baseDmg = Number(t.stats.damage) || 0;
        const buffedDmg = Number(t.buffedDmg) || 0;
        const alchDmg = (t.alchBuff && Number(t.alchBuff.dmg)) || 0;
        const effDmg = Math.round(baseDmg + buffedDmg + alchDmg);
        
        const rangeVal = Number(t.stats.range) || 0;
        const rangeStr = rangeVal === 9999 ? 'Global' : rangeVal.toFixed(1);
        
        // v1.4.3: change-detect (the RATE component wobbles a few times per
        // second with Elite Defender's track/frenzy speed modifiers).
        writeThrottled(upStats, `DMG: ${effDmg} | RNG: ${rangeStr} | RATE: ${effRate.toFixed(2)}s | PRC: ${effPierce}`);
    },

    _updateTargetingText(t) {
        const targetText = el('up-target-text');
        if (targetText) writeThrottled(targetText, t.targetingMode || 'First');
        
        const targetText2 = el('up-target-text-2');
        if (targetText2) writeThrottled(targetText2, t.targetingMode2 || 'First');
    },

    _updateUpgradeCards(t, engine) {
        if (!t || t.isMinion || t.stats.isHero || !Upgrades[t.type]) return;

        const title = el('up-title');
        if (title) {
            writeThrottled(title, t.isParagon
                ? `${t.stats.name || 'Paragon'} · Degree ${t.paragonDegree || 1}`
                : (t.stats.name || 'Tower'));
        }
        
        const counters = el('up-counters');
        // v1.4.3 (the reported bug): "Dmg Dealt" ticks up on EVERY shot, so a
        // fast-firing tower (Elite Defender vs the Knight: 12-100 hits/s)
        // forced a DOM layout every single frame. Coalesce the counter to
        // 10Hz - it still visibly counts up while shooting.
        if (counters) writeThrottled(counters, this._getTowerCounterText(t), 100);

        const paragonInfo = el('paragon-info');
        const pathsEl = el('up-paths');

        if (t.isParagon) {
            // Selected paragon: degree badge + power breakdown instead of the
            // three path cards.
            if (pathsEl) pathsEl.classList.add('hidden');
            const conv = el('paragon-convergence');
            if (conv) conv.classList.add('hidden');
            const pcard = el('up-paragon');
            if (pcard) pcard.classList.add('hidden');
            if (paragonInfo) {
                paragonInfo.classList.remove('hidden');
                const s = t.degreeInfo || {};
                const pb = t.powerBreakdown || {};
                // v1.4.3: Pop Power climbs with every pop while a paragon is
                // selected - throttle the innerHTML rebuild (parse + layout)
                // to 10Hz like the counters.
                writeThrottled(paragonInfo,
                    `<div class="paragon-degree-badge">DEGREE ${t.paragonDegree || 1}</div>` +
                    `<div class="paragon-power-lines">` +
                    `<div>Cash Power: ${Math.round(pb.cashPower || 0)} / 60,000</div>` +
                    (pb.extraCash ? `<div>Menu Investment: $${Math.round(pb.extraCash).toLocaleString('en-US')} (+${Math.round(pb.extraPower || 0)} power)</div>` : '') +
                    `<div>Upgrade Power: ${Math.round(pb.upgradePower || 0)} / 10,000</div>` +
                    `<div>Extra T5 Power: ${Math.round(pb.extraT5Power || 0)} / 50,000</div>` +
                    `<div>Pop Power: ${Math.round(pb.popsPower || 0)} / 90,000</div>` +
                    (pb.totemPower ? `<div>Totem Power: ${Math.round(pb.totemPower)}</div>` : '') +
                    `<div class="paragon-power-total">Total Power: ${Math.round(pb.total || 0)}</div>` +
                    `</div>` +
                    (s.interval ? `<div class="paragon-stats-line">DMG ${s.damage} | CER +${s.ceramicDmg} | BOSS +${s.bossDmg} | PRC ${s.pierce} | ${(s.interval).toFixed(3)}s</div>` : ''),
                    100, 'innerHTML');
            }
            this._updatePortrait(t);
            return;
        }

        if (paragonInfo) paragonInfo.classList.add('hidden');
        if (pathsEl) pathsEl.classList.remove('hidden');
        // v1.4.2: the separate 4th "paragon node" button is GONE (owner ask:
        // "the fourth paragon button should not exist") - the three path cards
        // of a Tier 5 monkey ARE the paragon purchase now. Keep both elements
        // hard-hidden in case a stale DOM ever carries them over.
        const pcard = el('up-paragon');
        if (pcard) { pcard.classList.add('hidden'); pcard._pSig = null; }
        const conv = el('paragon-convergence');
        if (conv) conv.classList.add('hidden');

        const statsEl = el('up-stats');
        if (statsEl) {
            if (Config.data.showTowerStats) {
                statsEl.classList.remove('hidden');
                
                // FIX: Pre-purchase upgrade previews
                if (window._hoveredUpgradePath) {
                    const path = window._hoveredUpgradePath;
                    const tier = t.upgrades[path - 1];
                    const data = Upgrades[t.type][path][tier];
                    
                    if (data) {
                        let projDmg = Number(t.stats.damage) || 0;
                        let projPierce = Number(t.stats.pierce) || 0;
                        let projRange = Number(t.stats.range) || 0;
                        let projRate = getEffectiveCooldown(t);
                        
                        if (data.stat === 'damage') projDmg += data.amount;
                        if (data.stat === 'pierce') projPierce += data.amount;
                        if (data.stat === 'range') projRange += data.amount;
                        if (data.cooldownMult) projRate *= data.cooldownMult;
                        
                        if (data.extraMods) {
                            if (data.extraMods.damage) projDmg += data.extraMods.damage;
                            if (data.extraMods.pierce) projPierce += data.extraMods.pierce;
                            if (data.extraMods.range) projRange += data.extraMods.range;
                        }
                        
                        // v1.4.3: hover preview - the string is stable while
                        // hovering, so change-detect instead of re-parsing
                        // HTML every frame.
                        writeThrottled(statsEl,
                            `<span style="color:#00ffff; font-weight:bold;">DMG: ${Math.round(projDmg)} | RNG: ${projRange.toFixed(1)} | RATE: ${projRate.toFixed(2)}s | PRC: ${Math.round(projPierce)}</span>`,
                            0, 'innerHTML');
                    } else {
                        this._updateTowerStats(t);
                    }
                } else {
                    this._updateTowerStats(t);
                }
            } else {
                statsEl.classList.add('hidden');
            }
        }

        // v1.4.2: once EVERY Tier 5 of this type is owned, the three upgrade
        // cards of a TIER 5 monkey turn into the Paragon purchase - purple,
        // named after the paragon, and clicking any of them opens the
        // pre-purchase menu (engineInput.handleUpgrade routes the click).
        // v1.4.1 showed the takeover on EVERY dart/boomerang; the owner asked
        // for the BTD6 rule back: the purple buttons only appear on valid
        // Tier 5 monkeys (a path maxed), not on every monkey of the type.
        // (Wiki: "the upgrade icon will become available on any of the tier 5
        // Boomerang Monkeys".)
        const parCfg = PARAGON_POWER_RULES[t.type];
        const isTier5 = (t.upgrades || []).some(u => u >= 5);
        let parTakeover = null;
        if (parCfg && isTier5) {
            const offer = canOfferParagon(engine, t, t.type);
            if (offer.eligible) parTakeover = offer;
        }

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

            if (parTakeover) {
                newName = parCfg.name.toUpperCase();
                newCost = `$${parTakeover.cost.toLocaleString('en-US')}`;
                newLocked = !parTakeover.affordable;
            }
            card.classList.toggle('paragon-active', !!parTakeover);

            if (!card._cache) card._cache = { tier: -1, name: "", cost: "", locked: null };
            const cache = card._cache;
            
            if (cache.tier !== tier && tierBoxes) {
                // FIX: Trigger the pop animation when an upgrade is successfully purchased!
                if (cache.tier !== -1 && tier > cache.tier) {
                    card.classList.remove('pop-anim');
                    void card.offsetWidth; // Force reflow to restart animation
                    card.classList.add('pop-anim');
                }
                
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

        if (window._hoveredUpgradePath) {
            const path = window._hoveredUpgradePath;
            const tier = t.upgrades[path - 1];
            const data = Upgrades[t.type][path][tier];
            const tip = document.getElementById('upgrade-tooltip');
            if (tip && tip.classList.contains('show')) {
                // v1.4.3: change-detect — the tooltip string is stable while
                // hovering one upgrade, this re-parsed it every frame.
                writeThrottled(tip,
                    parTakeover ? `<b>${parCfg.name} (Paragon)</b><br>Consumes every monkey of this type on the field to create the Paragon. Click to review its power and Degree.`
                    : (data ? `<b>${data.name} (${tier + 1}/5)</b><br>${data.desc}` : `<b>MAXED</b>`),
                    0, 'innerHTML');
            }
        }
    }
};

uiHooks.setupBeastUI = (panel, t, engine) => uiTowerPanel._setupBeastUI(panel, t, engine);

export default uiTowerPanel;