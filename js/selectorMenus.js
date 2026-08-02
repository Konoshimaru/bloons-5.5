// js/selectorMenus.js
import { Config } from './config.js';
import { GameEngine } from './engine.js';
import { HeroRegistry } from './heroes/index.js';
import { Maps } from './data.js';

const selectorMenus = {
    refreshMapSelector() {
        const mapSelector = document.getElementById('map-selector');
        if (!mapSelector) return;
        mapSelector.innerHTML = '';
        Maps.forEach((map, index) => {
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.alignItems = 'center';
            wrapper.style.gap = '5px';
            wrapper.style.margin = '5px 0';
            const btn = document.createElement('button');
            btn.className = 'diff-btn';
            btn.style.flex = '1';
            btn.style.margin = '0';
            btn.innerText = map.name || `Map ${index + 1}`;
            if (Config.data.currentMap === index) btn.style.borderColor = '#f1c40f';
            btn.addEventListener('click', () => {
                document.querySelectorAll('#map-selector .diff-btn').forEach(c => c.style.borderColor = '#7f8c8d');
                btn.style.borderColor = '#f1c40f';
                GameEngine.currentMap = index;
                Config.data.currentMap = index;
                Config.save();
            });
            wrapper.appendChild(btn);
            let customMapData = null;
            for (let m of Config.data.customMaps) {
                if ((map.id && m.id === map.id) || (!map.id && m.name === map.name)) {
                    customMapData = m;
                    break;
                }
            }
            if (customMapData) {
                const delBtn = document.createElement('button');
                delBtn.className = 'diff-btn';
                delBtn.style.background = '#e74c3c';
                delBtn.style.border = '1px solid #c0392b';
                delBtn.style.margin = '0';
                delBtn.style.width = '40px';
                delBtn.innerText = '🗑';
                delBtn.title = "Delete Custom Map";
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete custom map "${map.name}"?`)) {
                        Config.data.customMaps = Config.data.customMaps.filter(m => m !== customMapData);
                        Config.save();
                        const mapIdx = Maps.indexOf(map);
                        if (mapIdx > -1) Maps.splice(mapIdx, 1);
                        if (GameEngine.currentMap >= mapIdx) {
                            GameEngine.currentMap = Math.max(0, GameEngine.currentMap - 1);
                            Config.data.currentMap = GameEngine.currentMap;
                            Config.save();
                        }
                        this.refreshMapSelector();
                    }
                });
                wrapper.appendChild(delBtn);
            }
            mapSelector.appendChild(wrapper);
        });
    },

    updateHeroInfo(key) {
        const hero = HeroRegistry[key];
        if (!hero) return;
        
        document.getElementById('hero-select-title').innerText = hero.stats.name;
        document.getElementById('hero-select-subtitle').innerText = hero.stats.desc;
        
        const largePortrait = document.getElementById('hero-portrait-large');
        if (largePortrait) {
            largePortrait.style.backgroundImage = `url('sprites/portraits/${key}_menuportrait.png')`;
        }
        
        const bioText = `Cost: $${hero.stats.cost}<br>Base Range: ${hero.stats.range}<br>Base Damage: ${hero.stats.damage}<br>Attack Rate: ${hero.stats.fireRate}s<br>Damage Type: ${hero.stats.dmgType}<br><br><i>${hero.stats.name} is ready for battle.</i>`;
        document.getElementById('hero-bio-text').innerHTML = bioText;
        
        const abContainer = document.getElementById('hero-abilities-container');
        if (abContainer) {
            abContainer.innerHTML = '';
            // FIX: Read abilities directly from the hero stats object!
            const abilities = hero.stats.abilities || [];
            if (abilities.length === 0) {
                abContainer.innerHTML = `<div style="font-size:13px; color:#95a5a6;">No abilities documented.</div>`;
            } else {
                abilities.forEach(ab => {
                    abContainer.innerHTML += `
                        <div class="hm-ability-box">
                            <div class="hm-ability-icon">L${ab.lvl}</div>
                            <div class="hm-ability-info">
                                <h5>${ab.name}</h5>
                                <span>${ab.desc}</span>
                            </div>
                        </div>
                    `;
                });
            }
        }
        
        // Populate Level Upgrades list
        const upList = document.getElementById('hm-upgrades-list');
        if (upList) {
            upList.innerHTML = '';
            for (let lvl = 1; lvl <= 20; lvl++) {
                const data = hero.levels[lvl];
                let desc = `Base Stats`;
                if (data && data.length > 0) {
                    desc = data.map(mod => {
                        if (typeof mod.amount === 'boolean') return `Unlocks ${mod.stat}`;
                        if (mod.amount > 0) return `+${mod.amount} ${mod.stat}`;
                        return `${mod.amount} ${mod.stat}`;
                    }).join(', ');
                }
                upList.innerHTML += `<div class="hm-upgrade-tier"><b>Lvl ${lvl}:</b> ${desc}</div>`;
            }
        }

        // Update active class for the grid
        document.querySelectorAll('.hm-hero-item').forEach(item => {
            item.classList.toggle('active', item.dataset.hero === key);
        });
    },

    refreshHeroSelector() {
        const heroSelector = document.getElementById('hero-selector');
        if (!heroSelector) return;
        heroSelector.innerHTML = '';
        
        Object.entries(HeroRegistry).forEach(([key, hero]) => {
            const item = document.createElement('div');
            item.className = 'hm-hero-item';
            item.dataset.hero = key;
            item.style.backgroundImage = `url('sprites/portraits/${key}_menuportrait.png')`;
            
            const isLocked = !Config.data.unlockedTowers.includes(key);

            const nameOverlay = document.createElement('div');
            nameOverlay.className = 'hm-hero-name-overlay';
            nameOverlay.innerText = isLocked ? 'Locked' : hero.stats.name;
            item.appendChild(nameOverlay);

            if (isLocked) {
                item.classList.add('locked');
                item.title = `Locked`;
            } else {
                item.addEventListener('click', () => {
                    Config.data.selectedHero = key;
                    GameEngine.selectedHero = key;
                    Config.save();
                    this.updateHeroInfo(key);
                    this.updateHeroShopCard();
                });
            }

            if (Config.data.selectedHero === key && !isLocked) {
                item.classList.add('active');
                this.updateHeroInfo(key);
            } else if (Config.data.selectedHero === key && isLocked) {
                Config.data.selectedHero = 'quincy';
                Config.save();
                if (key === 'quincy') {
                    item.classList.add('active');
                    this.updateHeroInfo(key);
                }
            }
            heroSelector.appendChild(item);
        });

        // Hook up the toggle button for upgrades
        const toggleBtn = document.getElementById('hm-toggle-upgrades');
        if (toggleBtn && !toggleBtn.dataset.hooked) {
            toggleBtn.dataset.hooked = 'true';
            toggleBtn.addEventListener('click', () => {
                const list = document.getElementById('hm-upgrades-list');
                const isHidden = list.classList.contains('hidden');
                list.classList.toggle('hidden');
                toggleBtn.innerText = isHidden ? 'Hide Level Upgrades' : 'Show Level Upgrades';
            });
        }
    },

    updateHeroShopCard() {
        const card = document.getElementById('hero-shop-card');
        const heroKey = Config.data.selectedHero || 'quincy';
        const hero = HeroRegistry[heroKey];
        if (card && hero) {
            card.dataset.tower = heroKey;
            card.style.backgroundImage = `url('sprites/portraits/${heroKey}_menuportrait.png')`;
            const costEl = card.querySelector('.cost');
            if (costEl) {
                costEl.innerText = `$${hero.stats.cost}`;
            }
        }
    },

    updateShopUI() {
        document.querySelectorAll('.shop-item').forEach(item => {
            const unlockKey = item.dataset.unlock;
            if (Config.data.unlocks[unlockKey]) {
                item.classList.add('purchased');
                item.querySelector('.cost').innerText = "Purchased";
            } else {
                item.classList.remove('purchased');
                const cost = item.dataset.cost;
                item.querySelector('.cost').innerText = `$${cost}`;
            }
        });
    }
};

export default selectorMenus;