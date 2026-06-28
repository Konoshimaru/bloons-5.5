import { GameEngine } from '../engine.js';
import { Projectile } from '../projectile.js';

export function createPlaceholderHero(name, cost, desc) {
    return {
        stats: { 
            name: name, cost: cost, range: 40, fireRate: 1.0, damage: 1, projectileSpeed: 600, pierce: 2, 
            lifespan: 0.5, desc: desc, 
            dmgType: 'sharp', projectileType: 'arrow', hitRadius: 18, isHero: true, maxLevel: 20, scale: 1.3
        },
        xpTable: [180, 460, 1000, 1860, 3280, 5180, 8320, 9380, 13620, 16380, 14400, 16650, 14940, 16380, 17820, 19260, 20700, 16470, 17280],
        levels: {
            1: [], 2: [{ stat: "pierce", amount: 1 }], 
            3: [{ stat: "isAbility", amount: true }], 
            10: [{ stat: "isAbility2", amount: true }]
        },
        update(tower, dt) {},
        draw(ctx, tower, isPreview) {
            tower.drawBaseTower(ctx, isPreview);
        },
        ability(tower, engine) { engine.log(`${name} ability activated! (Placeholder)`); },
        ability2(tower, engine) { engine.log(`${name} ability 2 activated! (Placeholder)`); },
        fire(tower, target, damage, dmgType, isCrit, effects) {
            GameEngine.projectiles.push(new Projectile(tower.x, tower.y, damage, target, 'arrow', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, effects, 0, tower, dmgType));
        }
    };
}
