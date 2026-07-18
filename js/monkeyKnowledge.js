import { Config } from './config.js';

export const MonkeyKnowledge = {
    viewport: null,
    isDragging: false,
    isFocused: false,
    targetBgX: 0,
    targetBgY: 0,
    currentBgX: 0,
    currentBgY: 0,
    targetNodeX: 0,
    targetNodeY: 0,
    currentNodeX: 0,
    currentNodeY: 0,
    lastTouchX: 0,
    lastTouchY: 0,
    rafId: null,
    treeSize: 5000,
    activeNode: null,
    activeNodeParent: null,
    activeNodeOrigStyle: null,
    targetZoom: 1,
    currentZoom: 1,
    currentlyFocusedNode: null,

    init() {
        this.viewport = document.getElementById('mk-viewport');
        if (!this.viewport) return;

        // Default MK to ON if undefined
        if (Config.data.mkActive === undefined) {
            Config.data.mkActive = true;
            Config.save();
        }

        this._updateCurrency();
        this._updateToggleButton();

        // Toggle Button Logic
        const toggleBtn = document.getElementById('mk-toggle-btn');
        toggleBtn.addEventListener('click', () => {
            Config.data.mkActive = !Config.data.mkActive;
            Config.save();
            this._updateToggleButton();
            
            // Visually dim nodes if MK is disabled
            document.querySelectorAll('.mk-node').forEach(n => {
                n.style.opacity = Config.data.mkActive ? '1' : '0.3';
            });
        });

        const tabs = document.querySelectorAll('.mk-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                if (this.isFocused) return;
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const screen = tab.dataset.screen;
                document.querySelectorAll('.mk-screen').forEach(s => s.classList.remove('active'));
                
                const activeScreen = document.getElementById(`mk-screen-${screen}`);
                if (activeScreen) activeScreen.classList.add('active');

                this._updateTint(screen);
                this._buildTree(screen);
                
                this.targetNodeX = 0;
                this.targetNodeY = 0;
                this.currentNodeX = 0;
                this.currentNodeY = 0;
                this.targetZoom = 1;
                this.currentZoom = 1;
            });
        });

        this.viewport.addEventListener('mousedown', (e) => {
            if (this.isFocused || e.target.tagName === 'BUTTON' || e.target.classList.contains('mk-node')) return;
            e.preventDefault();
            this.isDragging = true;
            this.viewport.style.cursor = 'grabbing';
        });
        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const dx = e.movementX / this.currentZoom;
            const dy = e.movementY / this.currentZoom;
            this.targetBgX += e.movementX;
            this.targetBgY += e.movementY;
            this.targetNodeX += dx;
            this.targetNodeY += dy;
        });
        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.viewport.style.cursor = 'grab';
        });

        this.viewport.addEventListener('touchstart', (e) => {
            if (this.isFocused || e.target.tagName === 'BUTTON' || e.target.classList.contains('mk-node')) return;
            e.preventDefault();
            this.isDragging = true;
            this.lastTouchX = e.touches[0].clientX;
            this.lastTouchY = e.touches[0].clientY;
        }, { passive: false });
        this.viewport.addEventListener('touchmove', (e) => {
            if (!this.isDragging) return;
            const touch = e.touches[0];
            const dx = touch.clientX - this.lastTouchX;
            const dy = touch.clientY - this.lastTouchY;
            this.targetBgX += dx;
            this.targetBgY += dy;
            this.targetNodeX += dx / this.currentZoom;
            this.targetNodeY += dy / this.currentZoom;
            this.lastTouchX = touch.clientX;
            this.lastTouchY = touch.clientY;
        }, { passive: false });
        this.viewport.addEventListener('touchend', () => { this.isDragging = false; });

        this.viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            
            const rect = this.viewport.getBoundingClientRect();
            const pivotX = rect.width / 2;
            const pivotY = rect.height * 0.3; 
            
            const mouseX = e.clientX - rect.left - pivotX;
            const mouseY = e.clientY - rect.top - pivotY;

            const oldZoom = this.currentZoom;
            this.targetZoom = Math.max(0.5, Math.min(2.5, this.targetZoom + delta));
            const newZoom = this.targetZoom;
            
            const dx = (mouseX - this.currentNodeX) / oldZoom * newZoom;
            const dy = (mouseY - this.currentNodeY) / oldZoom * newZoom;
            
            this.targetNodeX = mouseX - dx;
            this.targetNodeY = mouseY - dy;
        }, { passive: false });

        document.getElementById('mk-close-focus').addEventListener('click', () => this._exitFocusMode());
        document.getElementById('mk-focus-overlay').addEventListener('click', () => this._exitFocusMode());

        this._buildTree('primary');
        this._animate();
    },

    _updateToggleButton() {
        const btn = document.getElementById('mk-toggle-btn');
        if (!btn) return;
        const isActive = Config.data.mkActive;
        btn.innerText = `MK: ${isActive ? 'ON' : 'OFF'}`;
        btn.style.color = isActive ? '#f1c40f' : '#e74c3c';
        btn.style.borderColor = isActive ? '#f1c40f' : '#e74c3c';
    },

    _updateCurrency() {
        const kpEl = document.getElementById('mk-kp-count');
        const mmEl = document.getElementById('mk-mm-count');
        if (kpEl) kpEl.innerText = Config.data.knowledgePoints || 0;
        if (mmEl) mmEl.innerText = Config.data.monkeyMoney || 0;
    },

    _buildTree(screen) {
        const screenEl = document.getElementById(`mk-screen-${screen}`);
        if (!screenEl) return;
        screenEl.innerHTML = ''; 

        let treeData = [];
        if (screen === 'primary') {
            treeData = this._getPrimaryTree();
        } else if (screen === 'military') {
            treeData = this._getMilitaryTree();
        } else if (screen === 'magic') {
            treeData = this._getMagicTree();
        } else if (screen === 'support') {
            treeData = this._getSupportTree();
        } else if (screen === 'heroes') {
            treeData = this._getHeroesTree();
        }

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        treeData.forEach(node => {
            if (node.x < minX) minX = node.x;
            if (node.x > maxX) maxX = node.x;
            if (node.y < minY) minY = node.y;
            if (node.y > maxY) maxY = node.y;
        });
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        treeData.forEach(node => {
            node.x -= centerX;
            node.y -= centerY;
        });

        for (let i = 0; i < 9; i++) {
            const col = (i % 3) - 1;
            const row = Math.floor(i / 3) - 1;
            const offsetX = col * this.treeSize;
            const offsetY = row * this.treeSize;

            const container = document.createElement('div');
            container.className = 'mk-tree-container';
            container.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
            
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('mk-lines');
            svg.setAttribute('width', '3000');
            svg.setAttribute('height', '3000');
            svg.setAttribute('viewBox', '-1500 -1500 3000 3000');
            
            const nodesDiv = document.createElement('div');
            nodesDiv.classList.add('mk-nodes');

            treeData.forEach(node => {
                if (node.parent) {
                    const parents = Array.isArray(node.parent) ? node.parent : [node.parent];
                    parents.forEach(pId => {
                        const parent = treeData.find(n => n.id === pId);
                        if (parent) {
                            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                            line.setAttribute('x1', parent.x);
                            line.setAttribute('y1', parent.y);
                            line.setAttribute('x2', node.x);
                            line.setAttribute('y2', node.y);
                            line.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
                            line.setAttribute('stroke-width', '4');
                            line.setAttribute('stroke-linecap', 'round');
                            svg.appendChild(line);
                        }
                    });
                }
            });

            treeData.forEach((node, index) => {
                const div = document.createElement('div');
                div.className = 'mk-node';
                if (Config.data.monkeyKnowledge && Config.data.monkeyKnowledge[node.id]) {
                    div.classList.add('unlocked');
                }
                div.style.left = `${node.x}px`;
                div.style.top = `${node.y}px`;
                div.innerHTML = `<span>${node.name}</span>`;
                div.dataset.floatOffset = index * 0.7;
                
                div.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._enterFocusMode(node, div);
                });
                
                nodesDiv.appendChild(div);
            });

            container.appendChild(svg);
            container.appendChild(nodesDiv);
            screenEl.appendChild(container);
        }
    },

    _enterFocusMode(nodeData, el) {
        this.isFocused = true;
        this.isDragging = false;
        this.currentlyFocusedNode = nodeData;
        
        this.activeNode = el;
        this.activeNodeParent = el.parentNode;
        
        this.activeNodeOrigStyle = {
            position: el.style.position,
            left: el.style.left,
            top: el.style.top,
            transform: el.style.transform
        };

        document.getElementById('mk-detail-title').innerText = nodeData.name;
        document.getElementById('mk-detail-desc').innerText = nodeData.desc;
        document.getElementById('mk-detail-cost').innerText = nodeData.cost;
        document.getElementById('mk-detail-req').innerText = nodeData.req;

        const focusNodeContainer = document.getElementById('mk-focus-node');
        focusNodeContainer.innerHTML = '';
        
        el.style.position = 'relative';
        el.style.left = '0';
        el.style.top = '0';
        el.style.transform = 'scale(1.5)';
        focusNodeContainer.appendChild(el);

        document.getElementById('mk-focus-overlay').classList.add('active');
        document.getElementById('mk-focus-node').classList.add('active');
        document.getElementById('mk-detail-panel').classList.add('active');

        // --- Buy Button Logic ---
        const buyBtn = document.getElementById('mk-buy-btn');
        const newBuyBtn = buyBtn.cloneNode(true); // Clone to remove old listeners
        buyBtn.parentNode.replaceChild(newBuyBtn, buyBtn);
        
        const isUnlocked = Config.data.monkeyKnowledge && Config.data.monkeyKnowledge[nodeData.id];
        const statusEl = document.getElementById('mk-detail-status');
        
        if (isUnlocked) {
            newBuyBtn.innerText = "Unlocked";
            newBuyBtn.disabled = true;
            newBuyBtn.style.background = "#2c3e50";
            newBuyBtn.style.cursor = "default";
            statusEl.innerText = "Unlocked";
            statusEl.style.color = "#2ecc71";
        } else {
            newBuyBtn.innerText = "Unlock Upgrade";
            newBuyBtn.disabled = false;
            newBuyBtn.style.background = "#27ae60";
            newBuyBtn.style.cursor = "pointer";
            statusEl.innerText = "Locked";
            statusEl.style.color = "#e74c3c";
            newBuyBtn.addEventListener('click', () => this._purchaseNode());
        }
        // ------------------------
    },

       _purchaseNode() {
        if (!this.currentlyFocusedNode) return;
        const node = this.currentlyFocusedNode;
        const mk = Config.data.monkeyKnowledge || {};

        // --- Requirement Check ---
        if (node.parent) {
            const parents = Array.isArray(node.parent) ? node.parent : [node.parent];
            for (let p of parents) {
                if (!mk[p]) {
                    const buyBtn = document.getElementById('mk-buy-btn');
                    buyBtn.innerText = "Requirements not met!";
                    buyBtn.style.background = "#e74c3c";
                    setTimeout(() => { 
                        buyBtn.innerText = "Unlock Upgrade"; 
                        buyBtn.style.background = "#27ae60";
                    }, 1500);
                    return;
                }
            }
        }
        // -------------------------

        const kpMatch = node.cost.match(/(\d+)\s*KP/);
        const mmMatch = node.cost.match(/(\d+)\s*MM/);
        const kpCost = kpMatch ? parseInt(kpMatch[1]) : 0;
        const mmCost = mmMatch ? parseInt(mmMatch[1]) : 0;

        if (Config.data.knowledgePoints >= kpCost && Config.data.monkeyMoney >= mmCost) {
            Config.data.knowledgePoints -= kpCost;
            Config.data.monkeyMoney -= mmCost;
            if (!Config.data.monkeyKnowledge) Config.data.monkeyKnowledge = {};
            Config.data.monkeyKnowledge[node.id] = true;
            Config.save();
            this._updateCurrency();
            
            const buyBtn = document.getElementById('mk-buy-btn');
            buyBtn.innerText = "Unlocked!";
            buyBtn.disabled = true;
            buyBtn.style.background = "#2c3e50";
            
            const statusEl = document.getElementById('mk-detail-status');
            statusEl.innerText = "Unlocked";
            statusEl.style.color = "#2ecc71";
            
            if (this.activeNode) this.activeNode.classList.add('unlocked');
        } else {
            const buyBtn = document.getElementById('mk-buy-btn');
            buyBtn.innerText = "Not enough KP/MM!";
            buyBtn.style.background = "#e74c3c";
            setTimeout(() => { 
                buyBtn.innerText = "Unlock Upgrade"; 
                buyBtn.style.background = "#27ae60";
            }, 1500);
        }
    },

    _exitFocusMode() {
        this.isFocused = false;
        this.currentlyFocusedNode = null;
        
        if (this.activeNode && this.activeNodeParent) {
            const el = this.activeNode;
            el.style.position = this.activeNodeOrigStyle.position;
            el.style.left = this.activeNodeOrigStyle.left;
            el.style.top = this.activeNodeOrigStyle.top;
            el.style.transform = this.activeNodeOrigStyle.transform;
            this.activeNodeParent.appendChild(el);
        }
        
        this.activeNode = null;
        this.activeNodeParent = null;

        document.getElementById('mk-focus-overlay').classList.remove('active');
        document.getElementById('mk-focus-node').classList.remove('active');
        document.getElementById('mk-detail-panel').classList.remove('active');
    },

    _updateTint(screen) {
        const tints = {
            primary: 'rgba(52, 152, 219, 0.15)',
            military: 'rgba(39, 174, 96, 0.15)',
            magic: 'rgba(155, 89, 182, 0.15)',
            support: 'rgba(241, 196, 15, 0.15)',
            heroes: 'rgba(255, 255, 255, 0.15)'
        };
        this.viewport.style.setProperty('--mk-tint', tints[screen] || 'transparent');
    },

    _animate() {
        if (!this.isFocused) {
            if (!this.isDragging) {
                this.targetBgX -= 0.3;
                this.targetBgY -= 0.1;
            }

            this.currentZoom += (this.targetZoom - this.currentZoom) * 0.15;

            this.currentBgX += (this.targetBgX - this.currentBgX) * 0.1;
            this.currentBgY += (this.targetBgY - this.currentBgY) * 0.1;
            this.viewport.style.backgroundPosition = `${this.currentBgX}px ${this.currentBgY}px`;
            this.viewport.style.backgroundSize = `${400 * this.currentZoom}px ${400 * this.currentZoom}px`;

            this.currentNodeX += (this.targetNodeX - this.currentNodeX) * 0.1;
            this.currentNodeY += (this.targetNodeY - this.currentNodeY) * 0.1;

            const visualTreeSize = this.treeSize * this.currentZoom;
            let wrapX = this.currentNodeX % visualTreeSize;
            if (wrapX > visualTreeSize / 2) wrapX -= visualTreeSize;
            if (wrapX < -visualTreeSize / 2) wrapX += visualTreeSize;
            
            let wrapY = this.currentNodeY % visualTreeSize;
            if (wrapY > visualTreeSize / 2) wrapY -= visualTreeSize;
            if (wrapY < -visualTreeSize / 2) wrapY += visualTreeSize;

            const activeScreen = document.querySelector('.mk-screen.active');
            if (activeScreen) {
                activeScreen.style.transformOrigin = '50% 30%';
                activeScreen.style.transform = `translate3d(${wrapX}px, ${wrapY}px, 0) scale(${this.currentZoom})`;
                
                const time = performance.now() / 1000;
                const nodes = activeScreen.querySelectorAll('.mk-node');
                const vx = this.targetNodeX - this.currentNodeX;
                const vy = this.targetNodeY - this.currentNodeY;
                
                nodes.forEach(node => {
                    const offset = parseFloat(node.dataset.floatOffset) || 0;
                    const floatY = Math.sin(time * 1.5 + offset) * 8;
                    const floatX = Math.cos(time * 1.2 + offset) * 4;
                    const reactX = -vx * 0.2;
                    const reactY = -vy * 0.2;
                    node.style.transform = `translate(calc(-50% + ${floatX + reactX}px), calc(-50% + ${floatY + reactY}px))`;
                });
            }
        }

        this.rafId = requestAnimationFrame(() => this._animate());
    },

    // --- TREE DATA ---
    _getPrimaryTree() {
        return [
            { id: 'core', x: 0, y: 0, parent: null, name: 'Primary Core', desc: 'Unlocks the Primary Monkey Knowledge tree.', cost: '1 KP', req: 'Level 1' },
            { id: 'fast_tack', x: -400, y: 150, parent: 'core', name: 'Fast Tack Attacks', desc: 'Tack Shooter attack speed increased by 8%.', cost: '1 KP', req: 'None' },
            { id: 'inc_lifespan', x: 0, y: 150, parent: 'core', name: 'Increased Lifespan', desc: "Longer projectile lifespan for Dart Monkey, Bomb Shooter, Tack Shooter, and Glue Gunner.", cost: '1 KP', req: 'None' },
            { id: 'extra_darts', x: 400, y: 150, parent: 'core', name: 'Extra Dart Pops', desc: 'Dart Monkeys get +1 pierce to all shots.', cost: '1 KP', req: 'None' },
            { id: 'hard_tacks', x: -500, y: 300, parent: 'fast_tack', name: 'Hard Tacks', desc: 'Tack Shooter tacks can pop Frozen Bloons.', cost: '1 KP', req: 'Fast Tack Attacks' },
            { id: 'fast_glue', x: -300, y: 300, parent: 'fast_tack', name: 'Fast Glue', desc: 'Glue Gunner 10% increased attack speed.', cost: '1 KP', req: 'Fast Tack Attacks' },
            { id: 'fraggy_frags', x: -100, y: 300, parent: 'inc_lifespan', name: 'Fraggy Frags', desc: 'Frag bombs get 2 extra frags.', cost: '1 KP', req: 'Increased Lifespan' },
            { id: 'cheap_rangs', x: 100, y: 300, parent: 'inc_lifespan', name: "Cheap 'Rangs", desc: 'Base cost of Boomerang Thrower reduced by 50.', cost: '1 KP', req: 'Increased Lifespan' },
            { id: 'crossbow_reach', x: 500, y: 300, parent: 'extra_darts', name: 'Crossbow Reach', desc: 'Crossbow range increased.', cost: '1 KP', req: 'Extra Dart Pops' },
            { id: 'poppy_blades', x: -600, y: 450, parent: 'hard_tacks', name: 'Poppy Blades', desc: 'Blade Shooter upgrade gets +2 pierce.', cost: '1 KP', req: 'Hard Tacks' },
            { id: 'icy_chill', x: -400, y: 450, parent: 'hard_tacks', name: 'Icy Chill', desc: 'Freeze radius slightly increased.', cost: '5 KP', req: 'Hard Tacks' },
            { id: 'more_splatty', x: -200, y: 450, parent: 'fast_glue', name: 'More Splatty Glue', desc: 'Glue Splatter can affect up to 8 Bloons per shot.', cost: '5 KP', req: 'Fast Glue' },
            { id: 'budget_clusters', x: 0, y: 450, parent: 'fraggy_frags', name: 'Budget Clusters', desc: "Bomb Shooter's Cluster Bombs cost reduced by 100.", cost: '5 KP', req: 'Fraggy Frags' },
            { id: 'extra_bounce', x: 200, y: 450, parent: 'cheap_rangs', name: 'Extra Bounce', desc: 'Increase Boomerang Ricochet to bounce up to 80 times.', cost: '5 KP', req: "Cheap 'Rangs" },
            { id: 'recurring_rangs', x: 400, y: 600, parent: 'extra_bounce', name: "Recurring 'Rangs", desc: 'Boomerangs that return will be thrown a second time.', cost: '5 KP', req: 'Extra Bounce' },
            { id: 'four_and_four', x: 500, y: 450, parent: 'crossbow_reach', name: '4 And 4', desc: "Dart Monkey's triple shot gets 4 darts every 4th shot.", cost: '5 KP', req: 'Crossbow Reach' },
            { id: 'force_vs_force', x: 600, y: 450, parent: 'crossbow_reach', name: 'Force vs Force', desc: 'Juggernaut does +2 damage per shot to MOAB-Class Bloons.', cost: '5 KP', req: 'Crossbow Reach' },
            { id: 'big_inferno', x: -700, y: 600, parent: 'poppy_blades', name: 'Big Inferno', desc: 'Inferno Ring upgrade gets +3 burst radius.', cost: '5 KP', req: 'Poppy Blades' },
            { id: 'so_cold', x: -500, y: 600, parent: 'icy_chill', name: 'So... Cold...', desc: "Ice Monkey's Permafrost upgrade slows by 60%.", cost: '8 KP + 250 MM', req: 'Icy Chill' },
            { id: 'aviation_glue', x: -200, y: 600, parent: 'more_splatty', name: 'Aviation Grade Glue', desc: 'MOAB Glue slows more than normal.', cost: '8 KP + 250 MM', req: 'More Splatty Glue' },
            { id: 'violent_impact', x: 0, y: 600, parent: 'budget_clusters', name: 'Violent Impact', desc: "Bomb Shooter's Bloon Impact stuns for 25% longer.", cost: '8 KP + 250 MM', req: 'Budget Clusters' },
            { id: 'hard_press', x: 200, y: 600, parent: 'extra_bounce', name: 'Hard Press', desc: 'MOAB Press special knockback boomerangs push back 30% further.', cost: '8 KP + 250 MM', req: 'Extra Bounce' },
            { id: 'master_double', x: 500, y: 600, parent: 'four_and_four', name: 'Master Double Cross', desc: 'Allows you to have TWO Crossbow Masters.', cost: '8 KP + 250 MM', req: '4 And 4' },
            { id: 'big_cryo', x: -600, y: 750, parent: 'so_cold', name: 'Big Cryo Blast', desc: 'Cryo Cannon gets increased blast radius.', cost: '10 KP + 500 MM', req: 'So... Cold...' },
            { id: 'hypothermia', x: -400, y: 750, parent: 'so_cold', name: 'Hypothermia', desc: 'Snowstorm freezes Bloons for longer.', cost: '10 KP + 500 MM', req: 'So... Cold...' },
            { id: 'cheaper_solution', x: -200, y: 750, parent: 'aviation_glue', name: 'Cheaper Solution', desc: 'Bloon Liquifier cost reduced by 1000.', cost: '10 KP + 500 MM', req: 'Aviation Grade Glue' },
            { id: 'mega_mauler', x: 0, y: 750, parent: ['aviation_glue', 'hard_press'], name: 'Mega Mauler', desc: 'MOAB Mauler does more damage per hit.', cost: '8 KP + 250 MM', req: 'Aviation Grade Glue, Hard Press' },
            { id: 'long_turbo', x: 300, y: 750, parent: 'hard_press', name: 'Long Turbo', desc: 'Boomerang Turbo Charge ability lasts 15 seconds.', cost: '10 KP + 500 MM', req: 'Hard Press' },
            { id: 'come_on_everybody', x: 500, y: 750, parent: 'master_double', name: 'Come On Everybody!', desc: 'Primary towers attack 5% faster if all are below tier 3, and cost 5% less if all are tier 3 or 4.', cost: '10 KP + 500 MM', req: 'Master Double Cross' },
            { id: 'bonus_glue', x: -300, y: 900, parent: 'cheaper_solution', name: 'Bonus Glue Gunner', desc: 'Start each game with 1 free Glue Gunner!', cost: '10 KP + 1000 MM', req: 'Cheaper Solution' },
            { id: 'bionic_aug', x: 300, y: 900, parent: 'long_turbo', name: 'Bionic Augmentation', desc: 'While Turbo Charge is active, Bionic Boomerang is able to target Camo Bloons.', cost: '10 KP + 500 MM', req: 'Long Turbo' },
            { id: 'bonus_monkey', x: 500, y: 900, parent: 'come_on_everybody', name: 'Bonus Monkey!', desc: 'Start each game with a free Dart Monkey!', cost: '10 KP + 1000 MM', req: 'Come On Everybody!' },
            { id: 'more_cash', x: 100, y: 1050, parent: ['cheaper_solution', 'bonus_monkey'], name: 'More Cash', desc: 'Increase starting cash by 200.', cost: '10 KP + 1000 MM', req: 'Cheaper Solution, Bonus Monkey!' }
        ];
    },

    _getMilitaryTree() {
        return [
            { id: 'core', x: 0, y: 0, parent: null, name: 'Military Core', desc: 'Unlocks the Military Monkey Knowledge tree.', cost: '1 KP', req: 'Level 1' },
            { id: 'naval_upgrades', x: -600, y: 150, parent: 'core', name: 'Naval Upgrades', desc: 'Monkey Buccaneer and Monkey Sub get +1 pierce per shot.', cost: '1 KP', req: 'None' },
            { id: 'airforce_upgrades', x: -200, y: 150, parent: 'core', name: 'Airforce Upgrades', desc: 'Monkey Ace and Heli Pilot get +1 pierce per shot.', cost: '1 KP', req: 'None' },
            { id: 'elite_mil_training', x: 200, y: 150, parent: 'core', name: 'Elite Military Training', desc: 'All Military Monkeys get a one-off +1000 XP and earn XP in-game 5% faster permanently.', cost: '1 KP', req: 'None' },
            { id: 'emergency_unlock', x: 600, y: 150, parent: 'core', name: 'Emergency Unlock', desc: 'Activated ability: unlocks locked Dartling Gunners and boost their swivel speed for a short time.', cost: '1 KP', req: 'None' },
            { id: 'big_bunch', x: -700, y: 300, parent: 'naval_upgrades', name: 'Big Bunch', desc: 'Grape Shot shoots 6 grapes.', cost: '1 KP', req: 'Naval Upgrades' },
            { id: 'breaking_ballistic', x: -500, y: 300, parent: 'naval_upgrades', name: 'Breaking Ballistic', desc: 'Ballistic Missiles do more damage to Ceramic Bloons.', cost: '4 KP', req: 'Naval Upgrades' },
            { id: 'accel_aerodarts', x: -300, y: 300, parent: 'airforce_upgrades', name: 'Accelerated Aerodarts', desc: 'Darts from Monkey Aces fly faster.', cost: '1 KP', req: 'Airforce Upgrades' },
            { id: 'targeted_pineapples', x: -100, y: 300, parent: 'airforce_upgrades', name: 'Targeted Pineapples', desc: 'Pineapples are only dropped near tracks.', cost: '4 KP', req: 'Accelerated Aerodarts' },
            { id: 'rapid_razors', x: 100, y: 300, parent: 'airforce_upgrades', name: 'Rapid Razors', desc: 'Razor Rotors pop Bloons faster.', cost: '4 KP', req: 'Airforce Upgrades' },
            { id: 'ceramic_shock', x: 300, y: 300, parent: 'elite_mil_training', name: 'Ceramic Shock', desc: 'Sniper hits on Ceramic Bloons slow them down briefly.', cost: '1 KP', req: 'Elite Military Training' },
            { id: 'cheaper_maiming', x: 500, y: 300, parent: 'elite_mil_training', name: 'Cheaper Maiming', desc: 'Maim MOAB cost reduced by 1000.', cost: '4 KP', req: 'Ceramic Shock' },
            { id: 'extra_burny_stuff', x: 700, y: 300, parent: 'emergency_unlock', name: 'Extra Burny Stuff', desc: 'Burny Stuff pops every second.', cost: '4 KP', req: 'Emergency Unlock' },
            { id: 'gorgon_storm', x: 900, y: 300, parent: 'emergency_unlock', name: 'Gorgon Storm', desc: 'Hydra Rocket Storm stuns damaged Bloons for a short time.', cost: '4 KP', req: 'Emergency Unlock' },
            { id: 'faster_takedowns', x: -700, y: 450, parent: 'big_bunch', name: 'Faster Takedowns', desc: 'MOAB Takedown Ability has 5 second faster cooldown.', cost: '4 KP', req: 'Big Bunch' },
            { id: 'quad_burst', x: -500, y: 450, parent: 'breaking_ballistic', name: 'Quad Burst', desc: 'Airburst Darts split into 4 instead of 3.', cost: '8 KP + 250 MM', req: 'Breaking Ballistic' },
            { id: 'gun_coolant', x: -100, y: 450, parent: 'targeted_pineapples', name: 'Gun Coolant', desc: 'Monkey Aces attack 10% faster.', cost: '8 KP + 250 MM', req: 'Targeted Pineapples' },
            { id: 'paint_stripper', x: 700, y: 450, parent: 'extra_burny_stuff', name: 'Paint Stripper', desc: 'Mortar shattering shells removes Fortification from DDT Bloons.', cost: '8 KP + 250 MM', req: 'Extra Burny Stuff' },
            { id: 'cross_the_streams', x: 900, y: 450, parent: 'gorgon_storm', name: 'Cross the Streams', desc: 'Where Plasma or Doom beams cross on the track they create temporary plasma pools.', cost: '8 KP + 250 MM', req: 'Gorgon Storm' },
            { id: 'trade_agreements', x: -700, y: 600, parent: 'faster_takedowns', name: 'Trade Agreements', desc: 'Merchantman generates +$20 per round.', cost: '8 KP + 250 MM', req: 'Faster Takedowns' },
            { id: 'flanking_maneuvers', x: -600, y: 750, parent: ['quad_burst', 'trade_agreements'], name: 'Flanking Maneuvers', desc: 'Sniper, Monkey Sub & Monkey Buccaneer attack 10% faster when set to \'Last\' targeting priority.', cost: '8 KP + 500 MM', req: 'Quad Burst, Trade Agreements' },
            { id: 'aeronautic_subsidy', x: -100, y: 600, parent: 'gun_coolant', name: 'Aeronautic Subsidy', desc: 'Monkey Ace tier 5 upgrades cost 10% less.', cost: '8 KP + 500 MM', req: 'Gun Coolant' },
            { id: 'charged_chinooks', x: 100, y: 600, parent: 'rapid_razors', name: 'Charged Chinooks', desc: 'Chinook Activated Abilities give 25% more lives and cash.', cost: '8 KP + 500 MM', req: 'Rapid Razors' },
            { id: 'budget_battery', x: 700, y: 600, parent: 'paint_stripper', name: 'Budget Battery', desc: 'Artillery Battery cost reduced by 600.', cost: '8 KP + 500 MM', req: 'Paint Stripper' },
            { id: 'master_defender', x: 500, y: 600, parent: 'cheaper_maiming', name: 'Master Defender', desc: 'Elite Defender has no cooldown.', cost: '8 KP + 500 MM', req: 'Cheaper Maiming' },
            { id: 'military_conscription', x: -700, y: 750, parent: 'trade_agreements', name: 'Military Conscription', desc: 'Purchase price of first Military Monkey each game is two thirds the normal.', cost: '14 KP + 1000 MM', req: 'Trade Agreements' },
            { id: 'sub_admiral', x: -600, y: 900, parent: 'flanking_maneuvers', name: 'Sub Admiral', desc: 'Sub Commander affects all Monkey Subs on screen.', cost: '14 KP + 1000 MM', req: 'Flanking Maneuvers' },
            { id: 'door_gunner', x: 100, y: 750, parent: 'charged_chinooks', name: 'Door Gunner', desc: 'Special Poperations Heli allows tier 4 and below Monkey Towers to attack Bloons while in transit.', cost: '14 KP + 1000 MM', req: 'Charged Chinooks' },
            { id: 'advanced_logistics', x: 0, y: 900, parent: ['aeronautic_subsidy', 'door_gunner'], name: 'Advanced Logistics', desc: 'All Military Monkeys base costs reduced by 5%.', cost: '14 KP + 1000 MM', req: 'Aeronautic Subsidy, Door Gunner' },
            { id: 'big_bloon_sabotage', x: -300, y: 1050, parent: ['sub_admiral', 'master_defender'], name: 'Big Bloon Sabotage', desc: 'All MOAB-Class Bloons spawn in a partially damaged state.', cost: '14 KP + 1000 MM', req: 'Sub Admiral, Master Defender' }
        ];
    },

    _getMagicTree() {
        return [
            { id: 'core', x: 0, y: 0, parent: null, name: 'Magic Core', desc: 'Unlocks the Magic Monkey Knowledge tree.', cost: '1 KP', req: 'Level 1' },
            { id: 'super_range', x: -400, y: 200, parent: 'core', name: 'SUPER Range', desc: 'Increased range for the Super Range upgrade. Increases range by 3.', cost: '1 KP', req: 'None' },
            { id: 'lingering_magic', x: 0, y: 200, parent: 'core', name: 'Lingering Magic', desc: 'Longer projectile lifespan for Wizard Monkey, Super Monkey, Ninja Monkey, and Druid. Projectiles last 20% longer.', cost: '1 KP', req: 'None' },
            { id: 'magic_tricks', x: 400, y: 200, parent: 'core', name: 'Magic Tricks', desc: 'Guided Magic and Intense Magic cost 25 less.', cost: '1 KP', req: 'None' },
            { id: 'cheaper_doubles', x: -500, y: 400, parent: 'super_range', name: 'Cheaper Doubles', desc: 'Ninja Double Shot cost reduced by 100.', cost: '1 KP', req: 'SUPER Range' },
            { id: 'heavy_knockback', x: -300, y: 400, parent: 'super_range', name: 'Heavy Knockback', desc: 'Bloons hit by Knockback from Super Monkey are knocked back slightly harder. Increases knockback potency by 5%.', cost: '1 KP', req: 'SUPER Range' },
            { id: 'hot_magic', x: 0, y: 400, parent: 'lingering_magic', name: 'Hot Magic', desc: 'All Magic type towers can pop Frozen Bloons, regardless of types of attack.', cost: '1 KP', req: 'Lingering Magic' },
            { id: 'speedy_brewing', x: 400, y: 400, parent: 'magic_tricks', name: 'Speedy Brewing', desc: "All Alchemist's potions have 5% faster reload time.", cost: '1 KP', req: 'Magic Tricks' },
            { id: 'mo_monkey_money', x: 500, y: 600, parent: 'speedy_brewing', name: "Mo' Monkey Money", desc: 'Earn 10% extra Monkey Money from game wins on any difficulty.', cost: '1 KP', req: 'Speedy Brewing' },
            { id: 'diversion_tactics', x: -600, y: 600, parent: 'cheaper_doubles', name: 'Diversion Tactics', desc: 'Increased chance to distract Bloons from Distraction upgrade. Increases chance by 2.5%.', cost: '4 KP', req: 'Cheaper Doubles' },
            { id: 'strike_down_false', x: -400, y: 600, parent: 'heavy_knockback', name: 'Strike Down The False', desc: 'Sun Avatar can pop Purple Bloons.', cost: '4 KP', req: 'Heavy Knockback' },
            { id: 'warm_oak', x: -100, y: 600, parent: 'hot_magic', name: 'Warm Oak', desc: 'Heart of Oak cost reduced by 100.', cost: '4 KP', req: 'Hot Magic' },
            { id: 'flame_jet', x: 100, y: 600, parent: 'hot_magic', name: 'Flame Jet', desc: "Dragon's Breath flame projectiles move much faster. Flies 50% faster.", cost: '4 KP', req: 'Hot Magic' },
            { id: 'strong_tonic', x: 300, y: 600, parent: 'speedy_brewing', name: 'Strong Tonic', desc: 'Transforming Tonic lasts longer. Increases duration from 20s to 24s.', cost: '4 KP', req: 'Speedy Brewing' },
            { id: 'cold_front', x: -100, y: 800, parent: 'warm_oak', name: 'Cold Front', desc: "Ball Lightning's additional lightning bolts also freeze Bloons. Freeze chance is 100%.", cost: '4 KP + 250 MM', req: 'Warm Oak' },
            { id: 'arcane_impale', x: 100, y: 800, parent: 'flame_jet', name: 'Arcane Impale', desc: 'Arcane Spike does extra damage to MOAB-Class and Ceramic Bloons. Also affects Archmage.', cost: '4 KP + 250 MM', req: 'Flame Jet' },
            { id: 'acid_stability', x: 300, y: 800, parent: 'strong_tonic', name: 'Acid Stability', desc: "Alchemists' acid pools last 5 second longer. Now lasts 12s instead of 7s.", cost: '4 KP + 250 MM', req: 'Strong Tonic' },
            { id: 'xray_ultra', x: -400, y: 800, parent: 'strike_down_false', name: 'X-Ray Ultra', desc: 'Ultravision allows Super Monkeys to see through and fire through blocking objects.', cost: '4 KP + 250 MM', req: 'Strike Down The False' },
            { id: 'deadly_tranquility', x: -600, y: 1000, parent: 'diversion_tactics', name: 'Deadly Tranquility', desc: 'Bloonjitsu and Grandmaster Ninja get an extra shuriken per throw.', cost: '8 KP + 500 MM', req: 'Diversion Tactics' },
            { id: 'there_can_be_only_one', x: -400, y: 1000, parent: 'xray_ultra', name: 'There Can Be Only One', desc: 'There can be only one. A newly upgraded True Sun God with maximized sacrifices will sacrifice the other two Tier 5 Super Monkeys to become a Vengeful True Sun God.', cost: '8 KP + 500 MM', req: 'X-Ray Ultra' },
            { id: 'vine_rupture', x: -100, y: 1000, parent: 'cold_front', name: 'Vine Rupture', desc: 'Grants Spirit of the Forest Druid a new ability to burst all track vines, doing big damage to all non-lead Bloons.', cost: '8 KP + 500 MM', req: 'Cold Front' },
            { id: 'tiny_tornadoes', x: -300, y: 1200, parent: ['deadly_tranquility', 'vine_rupture'], name: 'Tiny Tornadoes', desc: 'Druid tornadoes spawn 3 smaller tornadoes when they expire.', cost: '8 KP + 1000 MM', req: 'Deadly Tranquility, Vine Rupture' },
            { id: 'mana_shield', x: 100, y: 1000, parent: 'arcane_impale', name: 'Mana Shield', desc: 'Creates a special shield that absorbs up to 25 lives for free. Recharges slowly each round if no Bloons leak.', cost: '8 KP + 1000 MM', req: 'Arcane Impale' }
        ];
    },

    _getSupportTree() {
        return [
            { id: 'core', x: 0, y: 0, parent: null, name: 'Support Core', desc: 'Unlocks the Support Monkey Knowledge tree.', cost: '1 KP', req: 'Level 1' },
            { id: 'flat_pack', x: -300, y: 150, parent: 'core', name: 'Flat Pack Buildings', desc: 'Banana Farms and Monkey Village cost 2% less and sell for 2% more. Discount and sell values are additive, making the sellback 72% of the original cost.', cost: '1 KP', req: 'None' },
            { id: 'one_more_spike', x: 300, y: 150, parent: 'core', name: 'One More Spike', desc: 'Spike Factory stacks get +1 spike. Spike stacks can pop up to 6 bloons instead of 5, Bigger Stacks from 10 to 11, Spiked Balls/Spiked Mines/Super Mines from 14 to 15, and Perma-Spike from 50 (90) to 51 (91).', cost: '1 KP', req: 'None' },
            { id: 'insider_trades', x: -500, y: 300, parent: 'flat_pack', name: 'Insider Trades', desc: 'Monkey Business discount increases by 2%. Increases discount via the Monkey Business bonus from 10% to 12%.', cost: '1 KP', req: 'Flat Pack Buildings' },
            { id: 'more_valuable_bananas', x: -100, y: 300, parent: 'flat_pack', name: 'More Valuable Bananas', desc: 'Valuable Bananas upgrade increases to 30%. This is a 5% increase from what the upgrade usually provides, granting $26 per banana.', cost: '1 KP', req: 'Flat Pack Buildings' },
            { id: 'first_line_of_defense', x: 100, y: 300, parent: 'one_more_spike', name: 'First Last Line of Defense', desc: 'Purchased price of first Spike Factory each game is $150 less. Applies after difficulty discounts.', cost: '1 KP', req: 'One More Spike' },
            { id: 'vigilant_sentries', x: 500, y: 300, parent: 'one_more_spike', name: 'Vigilant Sentries', desc: 'Sentry Turrets last longer than normal. Increases Sentry Gun lifespan from 25 seconds to 30 seconds. Applies to all Sentries.', cost: '1 KP', req: 'One More Spike' },
            { id: 'bigger_banks', x: -700, y: 450, parent: 'insider_trades', name: 'Bigger Banks', desc: 'Monkey Banks can hold 2500 extra money. Increases maximum capacity to $9,500 for Banks. Increases max capacity of IMF Loan and Monkey-Nomics to $12,500.', cost: '3 KP', req: 'Insider Trades' },
            { id: 'monkey_education', x: -500, y: 450, parent: 'insider_trades', name: 'Monkey Education', desc: 'All Monkeys XP earn rate increased by 8%. Applies to Experience for tower upgrades and Heroes in-game level ups.', cost: '3 KP', req: 'Insider Trades' },
            { id: 'farm_subsidy', x: -300, y: 450, parent: 'more_valuable_bananas', name: 'Farm Subsidy', desc: 'First Banana Farm each game costs 100 less. Once first Banana Farm is bought, this discount will be voided.', cost: '3 KP', req: 'More Valuable Bananas' },
            { id: 'thicker_foams', x: 300, y: 450, parent: 'vigilant_sentries', name: 'Thicker Foams', desc: 'Cleansing Foam can hit 3 more Bloons before expiring. Increases pierce of each base cleansing foam blob from 10 to 13.', cost: '3 KP', req: 'Vigilant Sentries' },
            { id: 'very_shreddy', x: 500, y: 450, parent: 'first_line_of_defense', name: 'Very Shreddy', desc: 'MOAB-SHREDR spikes deal +1 extra damage to MOAB-Class Bloons. Increases damage dealt to MOAB-class bloons by +1, from 9 to 10.', cost: '3 KP', req: 'First Last Line of Defense' },
            { id: 'backroom_deals', x: -700, y: 600, parent: 'bigger_banks', name: 'Backroom Deals', desc: 'IMF Loan grants $1000 more and repay rate is 40%. The increase in profit also applies to Monkey-Nomics.', cost: '3 KP + 250 MM', req: 'Bigger Banks' },
            { id: 'to_arms', x: -500, y: 600, parent: 'monkey_education', name: 'To ARMS!', desc: 'Call to Arms duration increased by 3 seconds. Increases duration from 15s to 18s. Also applies to Homeland Defense.', cost: '3 KP + 250 MM', req: 'Monkey Education' },
            { id: 'inland_revenue', x: -300, y: 600, parent: 'farm_subsidy', name: 'Inland Revenue Streams', desc: 'Monkey Town cash bonus increased by 10%. Increases cash bonus for bloon pops from 50% to 60%.', cost: '3 KP + 250 MM', req: 'Farm Subsidy' },
            { id: 'big_traps', x: 300, y: 600, parent: 'thicker_foams', name: 'Big Traps', desc: 'Bloon Trap can hold up to 530 RBE. Increased from 500 RBE to 530 RBE. Can also affect XXXL Traps.', cost: '3 KP + 250 MM', req: 'Thicker Foams' },
            { id: 'hi_value_mines', x: 500, y: 600, parent: 'very_shreddy', name: 'Hi-Value Mines', desc: 'Spiked Mines cost reduced by 1500. Discount is applied after price multiplier for other difficulties.', cost: '3 KP + 250 MM', req: 'Very Shreddy' },
            { id: 'better_sell_deals', x: -700, y: 750, parent: 'backroom_deals', name: 'Better Sell Deals', desc: 'All Monkeys sell for 5% more. Increases sell potency from 70% to 75%. Better Sell Deals will increase sell potency of Banana Farms and Monkey Villages from 72% to 77% instead.', cost: '8 KP + 500 MM', req: 'Backroom Deals' },
            { id: 'veteran_training', x: -500, y: 750, parent: 'to_arms', name: 'Veteran Monkey Training', desc: 'All Monkeys reload time reduced by 3%. Attack cooldown of all towers are decreased by 0.97x, increasing attack speed by ~3%.', cost: '8 KP + 500 MM', req: 'To ARMS!' },
            { id: 'global_cooldowns', x: -300, y: 750, parent: 'to_arms', name: 'Global Ability Cooldowns', desc: 'All Ability cooldowns for all Monkeys reduced by 3%. Reduces cooldowns of all abilities by 3% of their usual cooldown. Can stack with other cooldown reduction benefits.', cost: '8 KP + 500 MM', req: 'To ARMS!' },
            { id: 'healthy_bananas', x: -100, y: 750, parent: 'inland_revenue', name: 'Healthy Bananas', desc: 'Marketplaces now produce 1 life per round and Central Markets produce 3.', cost: '8 KP + 500 MM', req: 'Inland Revenue Streams' },
            { id: 'bank_deposits', x: -700, y: 900, parent: 'better_sell_deals', name: 'Bank Deposits', desc: 'Tier 4 and above Monkey Banks can take deposits from available in game cash. Allows IMF Loans and above to deposit a sum of money into the account via a new "deposit" button. Deposits up to half its remaining capacity per deposit.', cost: '14 KP + 1000 MM', req: 'Better Sell Deals' },
            { id: 'paragon_of_power', x: -500, y: 900, parent: 'veteran_training', name: 'Paragon of Power', desc: 'Paragons attack faster if there are no Tier 5 of the same tower. Increases attack speed of Paragon by ~20% if no T5 of the same tower type is on screen.', cost: '14 KP + 1000 MM', req: 'Veteran Monkey Training' }
        ];
    },

    _getHeroesTree() {
        return [
            { id: 'core', x: 0, y: 0, parent: null, name: 'Heroes Core', desc: 'Unlocks the Heroes Monkey Knowledge tree.', cost: '1 KP', req: 'Level 1' },
            { id: 'heroic_reach', x: -300, y: 150, parent: 'core', name: 'Heroic Reach', desc: 'All heroes get slightly increased range. Adds approximately +3 range for all Heroes.', cost: '1 KP', req: 'None' },
            { id: 'more_splody', x: 0, y: 150, parent: 'core', name: "More 'Splody", desc: "Heroes' explosives get +2 pierce per shot. Applies only to explosions, benefiting Striker Jones and Captain Churchill much more than other heroes.", cost: '1 KP', req: 'None' },
            { id: 'ability_discipline', x: 300, y: 150, parent: 'core', name: 'Ability Discipline', desc: "Hero level 10 Ability cooldowns reduced by 10%.", cost: '1 KP', req: 'None' },
            { id: 'heroic_velocity', x: -400, y: 300, parent: 'heroic_reach', name: 'Heroic Velocity', desc: "All Heroes' projectile speeds increased slightly.", cost: '1 KP', req: 'Heroic Reach' },
            { id: 'scholarships', x: -100, y: 300, parent: 'more_splody', name: 'Scholarships', desc: "Hero training costs reduced by 10%. Applies only to the amount of money needed to instantly level a hero up, not the heroes' base cost.", cost: '1 KP', req: "More 'Splody" },
            { id: 'quick_hands', x: -500, y: 450, parent: 'heroic_velocity', name: 'Quick Hands', desc: 'Makes all heroes attack 4% faster.', cost: '3 KP', req: 'Heroic Velocity' },
            { id: 'self_taught', x: -200, y: 450, parent: 'scholarships', name: 'Self Taught Heroes', desc: 'Heroes earn XP 10% faster.', cost: '3 KP', req: 'Scholarships' },
            { id: 'ability_mastery', x: 300, y: 300, parent: 'ability_discipline', name: 'Ability Mastery', desc: "At level 20, Heroes' level 3 Ability cooldown reduced by 30%.", cost: '3 KP', req: 'Ability Discipline' },
            { id: 'hero_favors', x: -350, y: 600, parent: ['quick_hands', 'self_taught'], name: 'Hero Favors', desc: "Heroes' base cost reduced by 10%.", cost: '3 KP + 250 MM', req: 'Quick Hands, Self Taught Heroes' },
            { id: 'empowered_heroes', x: -450, y: 750, parent: 'hero_favors', name: 'Empowered Heroes', desc: 'Heroes start each game at level 3.', cost: '8 KP + 500 MM', req: 'Hero Favors' },
            { id: 'big_bloon_blueprints', x: 300, y: 450, parent: 'ability_mastery', name: 'Big Bloon Blueprints', desc: "Heroes do +1 extra damage to MOAB-Class Bloons with their base attack. Applies to base projectiles, benefiting Level 8+ Gwendolin, Level 6+ Quincy and Level 4+ Adora much more than other heroes.", cost: '8 KP + 500 MM', req: 'Ability Mastery' },
            { id: 'monkeys_together', x: -450, y: 900, parent: 'empowered_heroes', name: 'Monkeys Together Strong', desc: 'Heroes receive 5% more experience per each Hero placed. Can work on any game mode including non-Co-Op games.', cost: '8 KP + 1000 MM', req: 'Empowered Heroes' },
            { id: 'weak_point', x: -100, y: 1050, parent: ['big_bloon_blueprints', 'monkeys_together'], name: 'Weak Point', desc: 'All Heroes deal +1 damage to Ceramic & Fortified Bloons.', cost: '8 KP + 1000 MM', req: 'Big Bloon Blueprints, Monkeys Together Strong' }
        ];
    }
};