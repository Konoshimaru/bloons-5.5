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
        document.getElementById('hero-model-view').innerText = hero.stats.name;
        const bioText = `Cost: $${hero.stats.cost}<br>Base Range: ${hero.stats.range}<br>Base Damage: ${hero.stats.damage}<br>Attack Rate: ${hero.stats.fireRate}s<br>Damage Type: ${hero.stats.dmgType}<br><br><i>${hero.stats.name} is ready for battle.</i>`;
        document.getElementById('hero-bio-text').innerHTML = bioText;
        document.querySelectorAll('.hm-carousel-item').forEach(item => {
            item.classList.toggle('active', item.dataset.hero === key);
        });
    },

    refreshHeroSelector() {
        const heroSelector = document.getElementById('hero-selector');
        if (!heroSelector) return;
        heroSelector.innerHTML = '';
        Object.entries(HeroRegistry).forEach(([key, hero]) => {
            const btn = document.createElement('button');
            btn.className = 'hm-carousel-item';
            btn.dataset.hero = key;
            btn.innerText = hero.stats.name.substring(0, 2);
            btn.title = hero.stats.name;
            if (Config.data.selectedHero === key) {
                btn.classList.add('active');
                this.updateHeroInfo(key);
            }
            btn.addEventListener('click', () => {
                Config.data.selectedHero = key;
                GameEngine.selectedHero = key;
                Config.save();
                this.updateHeroInfo(key);
                this.updateHeroShopCard();
            });
            heroSelector.appendChild(btn);
        });
    },

    // FIX: Updated to correctly target the cost element and change the background image
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