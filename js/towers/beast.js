// js/towers/beast.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { Tower } from '../tower.js';
import { GLOBAL_SCALE } from '../constants.js';
import { Beast } from '../beastEntity.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

// Land Beast Stats Data (Base + Range for scaling)
const LAND_BEASTS = [
    { name: "Microraptor", tier: 1, basePower: 1, maxPower: 1, damage: 1, pierce: 5, range: 20, fireRate: 1.0, dmgType: 'sharp', damageRange: 0, pierceRange: 0, rangeRange: 0 },
    { name: "Adasaurus", tier: 2, basePower: 3, maxPower: 6, damage: 2, pierce: 8, range: 20, fireRate: 1.0, dmgType: 'normal', ceramicDmg: 1, damageRange: 2, pierceRange: 4, rangeRange: 0 },
    { name: "Velociraptor", tier: 3, basePower: 8, maxPower: 24, damage: 4, pierce: 12, range: 24, fireRate: 1.0, dmgType: 'normal', ceramicDmg: 4, stunDmg: 3, damageRange: 6, pierceRange: 8, rangeRange: 6 },
    { name: "Tyrannosaurus Rex", tier: 4, basePower: 16, maxPower: 64, damage: 20, pierce: 22, range: 30, fireRate: 1.0, dmgType: 'normal', ceramicDmg: 5, stunDmg: 8, isAbility: true, abilityName: "T-Rex Stomp", abilityCd: 40, damageRange: 30, pierceRange: 10, rangeRange: 10 },
    { name: "Giganotosaurus", tier: 5, basePower: 36, maxPower: 132, damage: 750, pierce: 44, range: 50, fireRate: 1.25, dmgType: 'normal', stunDmg: 250, isAbility: true, abilityName: "Giganoto Stomp", abilityCd: 25, damageRange: 500, pierceRange: 20, rangeRange: 20 }
];

export default {
    stats: { 
        name: "Beast Handler", cost: 250, range: 20, fireRate: 1.4, 
        damage: 1, pierce: 4, projectileSpeed: 800, 
        lifespan: 0.4, desc: "Trains land, water or air beasts.", 
        dmgType: 'energy', projectileType: 'beast_attack', hitRadius: 14, 
        category: 'Support' 
    },
    upgrades: {
        1: [ // Water Path (Placeholder)
            {name:"Piranha", cost:160, desc:"Command a small fish to leap at Bloons."}
        ],
        2: [ // Land Path
            {name:"Microraptor", cost:175, desc:"Command a sharp clawed little dinosaur."},
            {name:"Adasaurus", cost:830, desc:"Sharp teeth tear through Lead."},
            {name:"Velociraptor", cost:2065, desc:"Slashes and chomps, dealing more damage to stunned Bloons."},
            {name:"Tyrannosaurus Rex", cost:9500, desc:"Huge jaw deals a ton of damage. Stomp Ability."},
            {name:"Giganotosaurus", cost:60000, desc:"Shreds almost any Bloon instantly. Stomp hits whole map."}
        ],
        3: [ // Air Path (Placeholder)
            {name:"Gyrfalcon", cost:190, desc:"Grabs and moves Bloons."}
        ]
    },

    postUpgrade(tower, path) {
        if (path === 2 && tower.upgrades[1] > 0) {
            tower.hasBeast = true; // Disable base attack
            
            const tier = tower.upgrades[1];
            const data = LAND_BEASTS[tier - 1];
            
            if (tower.beast) {
                // Update existing beast tier and reset power to base on manual upgrade
                tower.beast.tier = tier;
                tower.beast.data = data;
                tower.beast.beastPower = data.basePower;
                tower.beast.recalculateStats();
            } else {
                // Spawn new beast
                let spawnX = tower.x + 25;
                let spawnY = tower.y + 10;
                let beast = new Beast(spawnX, spawnY, 'land', tier, tower);
                GameEngine.beasts.push(beast);
                tower.beast = beast;
            }
            
            // Sync ability state to handler so UI knows it has an ability
            if (data.isAbility) {
                tower.stats.isAbility = true;
                tower.stats.abilityName = data.abilityName;
                tower.stats.abilityCd = data.abilityCd;
            } else {
                tower.stats.isAbility = false;
            }
        }
    },

    update(tower, dt, engine) {
        // Beasts handle their own updates in GameEngine.beasts
    },

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        if (tower.hasBeast) return;
        let p = engine.projectilePool.get();
        p.init(tower.x, tower.y, damage, target, tower.stats.projectileType, tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, effects, 0, tower, dmgType, isCrit);
    },

    ability(tower, engine) {
        if (!tower.isMinion && tower.beast) {
            this.ability(tower.beast, engine);
            return;
        }
        
        if (tower.stats.abilityName === "T-Rex Stomp") {
            engine.log("T-Rex Stomp!");
            Utils.applyAoeDamage(engine, tower.x, tower.y, 100, 150, {isExplosion: true, canHitLead: true}, tower, {stun: 6.0}, {maxHits: 400});
            engine.explosions.push({ x: tower.x, y: tower.y, radius: 0, maxRadius: 100, life: 0.5, maxLife: 0.5, color: '#e67e22' });
        }
        
        if (tower.stats.abilityName === "Giganoto Stomp") {
            engine.log("Giganotosaurus Stomp!");
            Utils.applyAoeDamage(engine, 640, 360, 2000, 300, {isExplosion: true, canHitLead: true}, tower, {stun: 12.0}, {maxHits: 600});
            engine.explosions.push({ x: 640, y: 360, radius: 0, maxRadius: 1500, life: 1.0, maxLife: 1.0, color: '#c0392b' });
        }
    }
};

export { LAND_BEASTS };