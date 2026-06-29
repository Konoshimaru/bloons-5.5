import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

export default {
    stats: { 
        name: "Wizard Monkey", cost: 600, range: 35, 
        baseCooldown: 1.1, fireRate: 1.1, 
        damage: 1, pierce: 1, projectileSpeed: 500, 
        lifespan: 0.5, desc: "Shoots magic bolts.", 
        dmgType: 'magic', projectileType: 'wizard_bolt', hitRadius: 18 
    },
    upgrades: {
        1: [
            {name:"Arcane Blast", cost:300, stat:"pierce", amount:2, desc:"Magic bolts hit 2 extra bloons."},
            {name:"Arcane Mastery", cost:500, stat:"damage", amount:1, desc:"Deals 1 extra damage."},
            {name:"Dragon's Breath", cost:2000, desc:"Attacks faster.", cooldownMult: 0.75, extraMods:{dmgType:'fire', projectileType:'fire'}},
            {name:"Shimmer", cost:3000, stat:"canSeeCamo", amount:true, desc:"Can detect Camo bloons."},
            {name:"Phoenix", cost:30000, stat:"isAbility", amount:true, desc:"Ability: Summons a phoenix.", extraMods:{unlocksAbility:true, abilityName:"Phoenix", abilityCd:60}}
        ],
        2: [
            {name:"Fireball", cost:400, stat:"damage", amount:1, desc:"Shoots explosive fireballs.", extraMods:{isExplosive:true, explosionRadius:40, explosionDamage:1, explosionPierce:20}},
            {name:"Monkey Sense", cost:300, stat:"canSeeCamo", amount:true, desc:"Can detect Camo bloons."},
            {name:"Wall of Fire", cost:1500, stat:"isAbility", amount:true, desc:"Ability: Creates a wall of fire.", extraMods:{unlocksAbility:true, abilityName:"WoF", abilityCd:40}},
            {name:"Necromancer", cost:4000, stat:"damage", amount:2, desc:"Spawns undead bloons."},
            {name:"Prince of Darkness", cost:25000, stat:"damage", amount:5, desc:"Spawns powerful undead bloons."}
        ],
        3: [
            {name:"Faster Casting", cost:300, desc:"Attacks faster.", cooldownMult: 0.8},
            {name:"Nullify", cost:500, stat:"damage", amount:1, desc:"Deals 1 extra damage."},
            {name:"Lead to Gold", cost:2000, stat:"canHitLead", amount:true, desc:"Magic can pop Lead bloons."},
            {name:"Zombie MOABs", cost:5000, stat:"damage", amount:3, desc:"Spawns undead MOABs."},
            {name:"Bloon Master Alchemist", cost:30000, stat:"damage", amount:10, desc:"Massive damage boost."}
        ]
    },
    update(tower, dt) {
        if (tower.fireWells && tower.fireWells.length > 0) {
            for (let i = tower.fireWells.length - 1; i >= 0; i--) {
                let w = tower.fireWells[i];
                w.life -= dt;
                if (w.life <= 0) { tower.fireWells.splice(i, 1); continue; }
                const nearby = GameEngine.enemyGrid.query(w.x, w.y, w.radius);
                for (let e of nearby) {
                    if (!e.alive) continue;
                    if (Utils.distance(w.x, w.y, e.x, e.y) < w.radius) {
                        e.takeDamage(tower.stats.damage * dt * 5, { isFire: true, canHitLead: true });
                    }
                }
            }
        }
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        let p = GameEngine.projectilePool.get();
        p.init(tower.x, tower.y, damage, target, 'wizard_bolt', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, effects, 0, tower, dmgType);
    },
    ability(tower, engine) {
        engine.log("Wall of Fire!");
        let target = null;
        let bestVal = -Infinity;
        for (let e of engine.enemies) {
            if (!e.alive) continue;
            if (e.distanceTraveled > bestVal) { bestVal = e.distanceTraveled; target = e; }
        }
        if (target) {
            tower.fireWells = tower.fireWells || [];
            tower.fireWells.push({ x: target.x, y: target.y, life: 4.0, maxLife: 4.0, radius: 60 });
        }
    },
    draw(ctx, tower, isPreview) {
        if (!isPreview && tower.fireWells) {
            for (let w of tower.fireWells) {
                ctx.globalAlpha = Math.min(1, w.life / w.maxLife) * 0.6;
                const grad = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.radius);
                grad.addColorStop(0, 'rgba(255, 100, 0, 0.8)');
                grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
            }
        }
        tower.drawBaseTower(ctx, isPreview);
    }
};