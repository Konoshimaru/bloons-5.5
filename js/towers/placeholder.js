import { GameEngine } from '../engine.js';

export function createPlaceholderTower(name, cost, desc) {
    return {
        stats: {
            name: name, cost: cost, range: 40, fireRate: 1.0, damage: 1, projectileSpeed: 600, pierce: 1,
            lifespan: 0.5, desc: desc,
            dmgType: 'sharp', projectileType: 'dart', hitRadius: 18
        },
        upgrades: {
            1: [
                {name: "Placeholder 1", cost: 100, stat: "damage", amount: 1, desc: "Placeholder upgrade."},
                {name: "Placeholder 2", cost: 200, stat: "pierce", amount: 1, desc: "Placeholder upgrade."},
                {name: "Placeholder 3", cost: 400, stat: "range", amount: 10, desc: "Placeholder upgrade."}
            ],
            2: [
                {name: "Placeholder 1", cost: 100, desc: "Placeholder upgrade.", cooldownMult: 0.8},
                {name: "Placeholder 2", cost: 200, stat: "damage", amount: 1, desc: "Placeholder upgrade."},
                {name: "Placeholder 3", cost: 400, stat: "pierce", amount: 2, desc: "Placeholder upgrade."}
            ],
            3: [
                {name: "Placeholder 1", cost: 100, stat: "range", amount: 5, desc: "Placeholder upgrade."},
                {name: "Placeholder 2", cost: 200, stat: "canSeeCamo", amount: true, desc: "Placeholder upgrade."},
                {name: "Placeholder 3", cost: 400, stat: "damage", amount: 2, desc: "Placeholder upgrade."}
            ]
        },
        update(tower, dt) {},
        draw(ctx, tower, isPreview) {
            tower.drawBaseTower(ctx, isPreview);
        },
        fire(tower, target, damage, dmgType, isCrit, effects) {
            let p = GameEngine.projectilePool.get();
            p.init(tower.x, tower.y, damage, target, 'dart', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, effects, 0, tower, dmgType);
        }
    };
}
