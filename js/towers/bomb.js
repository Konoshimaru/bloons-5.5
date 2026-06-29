// js/towers/bomb.js
import { GameEngine } from '../engine.js';

export default {
    stats: { 
        name: "Bomb Shooter", cost: 375, range: 40, 
        baseCooldown: 1.5, fireRate: 1.5, 
        damage: 1, pierce: 1, projectileSpeed: 300, 
        explosionRadius: 36, explosionDamage: 1, explosionPierce: 40, 
        lifespan: 1.0, canHitLead: true, 
        desc: "Launches a powerful bomb at the Bloons. Slow rate of fire but affects a radius around the explosion.", 
        dmgType: 'explosion', hitRadius: 18 
    },
    upgrades: {
        1: [ 
            { name: "Bigger Bombs", cost: 250, stat: "explosionRadius", amount: 6, desc: "Shoots larger bombs, they have a larger blast area and more popping power." },
            { name: "Frag Bombs", cost: 650, stat: "explosionDamage", amount: 1, desc: "Deals 1 extra explosion damage." },
            { name: "Bloon Impact", cost: 1100, stat: "explosionRadius", amount: 30, desc: "Huge explosion radius." }, 
            { name: "Cluster Bombs", cost: 2800, stat: "explosionDamage", amount: 2, desc: "Deals 2 extra explosion damage." },
            { name: "Bloon Crush", cost: 55000, stat: "explosionDamage", amount: 10, desc: "Colossal explosion damage." }
        ],
        2: [ 
            { name: "Faster Reload", cost: 250, desc: "Reloads faster.", cooldownMult: 0.75 }, 
            { name: "Missile Launcher", cost: 400, desc: "Exchanges bombs for missiles, which fire faster, fly faster, and increase range.", cooldownMult: 0.8, extraMods: { projectileSpeed: 50, range: 4}},
            { name: "MOAB Mauler", cost: 1000, stat: "range", amount: 40, desc: "Huge range increase." }, 
            { name: "MOAB Assassin", cost: 3450, desc: "Reloads even faster.", cooldownMult: 0.75 }, 
            { name: "MOAB Eliminator", cost: 28000, desc: "Maximum reload speed.", cooldownMult: 0.74 }
        ],
        3: [ 
            { name: "Extra Range", cost: 200, stat: "canSeeCamo", amount: true, desc: "Can detect Camo bloons." }, 
            { name: "Frag Bombs", cost: 300, stat: "explosionDamage", amount: 2, desc: "Deals 2 extra explosion damage." }, 
            { name: "Cluster Bombs", cost: 700, stat: "explosionDamage", amount: 5, desc: "Deals colossal explosion damage." }, 
            { name: "Recursive Cluster", cost: 2500, stat: "explosionRadius", amount: 50, desc: "Massive explosion radius." }, 
            { name: "Bomb Blitz", cost: 23000, stat: "explosionDamage", amount: 20, desc: "Apocalyptic damage." }
        ]
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        let p = GameEngine.projectilePool.get();
        p.init(tower.x, tower.y, damage, target, 'bomb', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, null, 0, tower, dmgType);
    }
};