// js/heroes/geraldo.js
// Geraldo - Mystic Shopkeeper
// Fires instant-hit energy lightning (can't pop Lead or Purple). Has no
// activated abilities - his kit is the travelling shop. The engine has no shop
// UI, so his shop is approximated as auto-purchased, auto-deployed items
// (Shooty Turret, Stack of Old Nails, Jar of Pickles) while a wave is active.

import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { AudioEngine } from '../audio.js';

const _geraldoScratch = [];

export default {
    stats: {
        name: "Geraldo", cost: 750, range: 40, fireRate: 1.1, damage: 1,
        projectileSpeed: 9000, pierce: 1, lifespan: 0.12, hitRadius: 18, scale: 1.3,
        desc: "Mystic shopkeeper who fires energy lightning and deploys shop items to help defend the track.",
        dmgType: 'energy', projectileType: 'dart', isHero: true, maxLevel: 20,
        canHitFrozen: true,
        explosionPierce: 4, blastRadius: 10,
        shopInterval: 5
    },
    xpTable: [180, 460, 1000, 1860, 3280, 5180, 8320, 9380, 13620, 16380, 14400, 16650, 14940, 16380, 17820, 19260, 20700, 16470, 17280],
    levels: {
        1: [],
        2: [],
        3: [{ stat: "range", amount: 5 }],
        4: [],
        5: [{ stat: "fireRate", amount: -0.1 }],
        6: [],
        7: [{ stat: "damage", amount: 1 }, { stat: "explosionPierce", amount: 5 }],
        8: [],
        9: [{ stat: "blastRadius", amount: 3 }],
        10: [],
        11: [{ stat: "explosionPierce", amount: 10 }],
        12: [],
        13: [],
        14: [],
        15: [],
        16: [],
        17: [{ stat: "damage", amount: 1 }],
        18: [],
        19: [{ stat: "fireRate", amount: -0.2 }, { stat: "range", amount: 3 }, { stat: "blastRadius", amount: 5 }, { stat: "explosionPierce", amount: 5 }, { stat: "damage", amount: 1 }],
        20: [{ stat: "damage", amount: 5 }]
    },
    update(tower, dt) {
        if (tower.shopTimer === undefined) {
            tower.shopTimer = tower.stats.shopInterval || 5;
            tower.shopStock = { turret: 2, nails: 4, pickles: 2 };
            tower.geraldoItems = [];
        }
        if (GameEngine.waveManager.waveActive) {
            tower.shopTimer -= dt;
            if (tower.shopTimer <= 0) {
                tower.shopTimer = tower.stats.shopInterval || 5;
                this._buyItem(tower);
            }
        }

        if (tower.geraldoItems) {
            for (let i = tower.geraldoItems.length - 1; i >= 0; i--) {
                const item = tower.geraldoItems[i];
                item.life -= dt;
                if (item.life <= 0) { tower.geraldoItems.splice(i, 1); continue; }
                this._updateItem(tower, item, dt);
            }
        }
    },
    _buyItem(tower) {
        const stock = tower.shopStock;
        const plan = [
            ['turret', 250, 2],
            ['nails', 50, 4],
            ['pickles', 150, 2]
        ];
        for (const [type, cost, maxStock] of plan) {
            if (stock[type] > 0 && GameEngine.cash >= cost + 100) {
                stock[type]--;
                GameEngine.cash -= cost;
                GameEngine.updateUI();
                this._deployItem(tower, type);
                GameEngine.log(`Geraldo's shop: ${type} deployed (-$${cost})`);
                return;
            }
        }
    },
    _deployItem(tower, type) {
        let best = null, bestDist = Infinity;
        const enemies = GameEngine.enemies;
        for (const e of enemies) {
            if (!e.alive) continue;
            const d = Utils.distance(tower.x, tower.y, e.x, e.y);
            if (d < bestDist) { bestDist = d; best = e; }
        }
        let x = tower.x, y = tower.y;
        if (best) {
            const pos = GameEngine.map.getPositionAtDistance(Math.max(0, best.distanceTraveled - 60), best.pathIndex);
            if (pos && !pos.finished) { x = pos.x; y = pos.y; }
        }
        let life = 999999;
        if (type === 'nails') life = 60;
        if (type === 'pickles') life = 60;
        tower.geraldoItems.push({ type, x, y, life, fireCd: 0 });
    },
    _updateItem(tower, item, dt) {
        if (item.type === 'turret') {
            item.fireCd -= dt;
            if (item.fireCd <= 0) {
                item.fireCd = 0.6;
                let target = null, bestVal = Infinity;
                const nearby = GameEngine.enemyGrid.query(item.x, item.y, 60, _geraldoScratch);
                for (const e of nearby) {
                    if (!e.alive) continue;
                    const d = Utils.distance(item.x, item.y, e.x, e.y);
                    if (d < bestVal) { bestVal = d; target = e; }
                }
                if (target) {
                    const p = GameEngine.projectilePool.get();
                    p.init(item.x, item.y, 1, target, 'dart', 700, 1, 1.2, null, null, 0, tower, { isSharp: true, canHitLead: true });
                }
            }
        } else if (item.type === 'nails') {
            item.dmgCd = (item.dmgCd || 0) - dt;
            if (item.dmgCd <= 0) {
                item.dmgCd = 0.4;
                const nearby = GameEngine.enemyGrid.query(item.x, item.y, 18, _geraldoScratch);
                for (const e of nearby) {
                    if (!e.alive) continue;
                    if (Utils.withinRange(item.x, item.y, e.x, e.y, 18)) {
                        e.takeDamage(1, { isSharp: true }, {}, tower);
                    }
                }
            }
        } else if (item.type === 'pickles') {
            const nearby = GameEngine.enemyGrid.query(item.x, item.y, 40, _geraldoScratch);
            const towers = GameEngine.towers;
            for (const t of towers) {
                if (!t || t.isMinion) continue;
                if (Utils.withinRange(item.x, item.y, t.x, t.y, 40)) {
                    t.addBuff('pickles', 'Pickles', 0.5, 1, { type: 'pickles' }, false);
                    t.buffedDmg = Math.max(t.buffedDmg || 0, 1);
                }
            }
        }
    },
    draw(ctx, tower, isPreview) {
        if (!isPreview && tower.geraldoItems) {
            for (const item of tower.geraldoItems) {
                if (item.type === 'turret') {
                    ctx.fillStyle = '#7f8c8d';
                    ctx.beginPath(); ctx.arc(item.x, item.y, 9, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#2c3e50';
                    ctx.beginPath(); ctx.arc(item.x, item.y, 5, 0, Math.PI * 2); ctx.fill();
                } else if (item.type === 'nails') {
                    ctx.fillStyle = 'rgba(127,140,141,0.8)';
                    for (let k = 0; k < 4; k++) {
                        ctx.beginPath(); ctx.arc(item.x + (k - 1.5) * 5, item.y, 3, 0, Math.PI * 2); ctx.fill();
                    }
                } else if (item.type === 'pickles') {
                    ctx.fillStyle = '#27ae60';
                    ctx.beginPath(); ctx.arc(item.x, item.y, 5, 0, Math.PI * 2); ctx.fill();
                }
            }
        }
        tower.drawBaseTower(ctx, isPreview);
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        if (!target) return;
        const p = GameEngine.projectilePool.get();
        const eff = {
            ...effects,
            isExplosive: true,
            explosionRadius: tower.stats.blastRadius || 10,
            explosionDamage: 1,
            explosionPierce: tower.stats.explosionPierce || 4,
            canHitLead: false
        };
        p.init(tower.x, tower.y, damage, target, 'dart', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, eff, 0, tower, dmgType);
        p.isCrit = isCrit;
    }
};
