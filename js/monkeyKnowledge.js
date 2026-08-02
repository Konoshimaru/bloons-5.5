// js/monkeyKnowledge.js
import { Config } from './config.js';
import MonkeyKnowledgeData from './monkeyKnowledgeData.js';

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
        if (screen === 'primary') treeData = MonkeyKnowledgeData.getPrimaryTree();
        else if (screen === 'military') treeData = MonkeyKnowledgeData.getMilitaryTree();
        else if (screen === 'magic') treeData = MonkeyKnowledgeData.getMagicTree();
        else if (screen === 'support') treeData = MonkeyKnowledgeData.getSupportTree();
        else if (screen === 'heroes') treeData = MonkeyKnowledgeData.getHeroesTree();

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
        const menu = document.getElementById('knowledge-menu');
        if (menu && menu.classList.contains('hidden')) {
            this.rafId = requestAnimationFrame(() => this._animate());
            return;
        }

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
    }
};
