// js/towers/beast.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { Tower } from '../tower.js';
import { GLOBAL_SCALE } from '../constants.js';
import { Beast } from '../beastEntity.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

const LAND_BEASTS = [
    { name: "Microraptor", tier: 1, basePower: 1, maxPower: 1, damage: 1, pierce: 5, range: 20, fireRate: 1.0, dmgType: 'sharp', explosionRadius: 10, damageRange: 0, pierceRange: 0, rangeRange: 0, cooldownRange: 0 },
    { name: "Adasaurus", tier: 2, basePower: 3, maxPower: 6, damage: 2, pierce: 8, range: 20, fireRate: 1.0, dmgType: 'normal', explosionRadius: 15, ceramicDmg: 1, damageRange: 2, pierceRange: 4, rangeRange: 0, cooldownRange: 0 },
    { name: "Velociraptor", tier: 3, basePower: 8, maxPower: 24, damage: 4, pierce: 12, range: 24, fireRate: 1.0, dmgType: 'normal', explosionRadius: 18, ceramicDmg: 4, stunDmg: 3, damageRange: 6, pierceRange: 8, rangeRange: 6, cooldownRange: 0.2 },
    { name: "Tyrannosaurus Rex", tier: 4, basePower: 16, maxPower: 64, damage: 20, pierce: 22, range: 30, fireRate: 1.0, dmgType: 'normal', explosionRadius: 18, ceramicDmg: 5, stunDmg: 8, isAbility: true, abilityName: "T-Rex Stomp", abilityCd: 40, damageRange: 30, pierceRange: 10, rangeRange: 10, cooldownRange: 0.25 },
    { name: "Giganotosaurus", tier: 5, basePower: 36, maxPower: 132, damage: 750, pierce: 44, range: 50, fireRate: 1.25, dmgType: 'normal', explosionRadius: 24, stunDmg: 250, isAbility: true, abilityName: "Giganoto Stomp", abilityCd: 25, damageRange: 500, pierceRange: 20, rangeRange: 20, cooldownRange: 0.25 }
];

const WATER_BEASTS = [
    { name: "Piranha", tier: 1, basePower: 1, maxPower: 1, damage: 1, pierce: 1, range: 30, fireRate: 0.6, dmgType: 'shatter', explosionRadius: 4, damageRange: 0, pierceRange: 0, rangeRange: 0, cooldownRange: 0 },
    { name: "Barracuda", tier: 2, basePower: 3, maxPower: 6, damage: 2, pierce: 4, range: 35, fireRate: 0.6, dmgType: 'shatter', explosionRadius: 8, knockback: 20, damageRange: 2, pierceRange: 4, rangeRange: 0, cooldownRange: 0 },
    { name: "Great White", tier: 3, basePower: 8, maxPower: 24, damage: 0, pierce: 10, range: 40, fireRate: 1.1, dmgType: 'normal', explosionRadius: 15, knockback: 40, canHitLead: true, thrashDamage: 12, thrashFireRate: 0.6, thrashPierce: 10, thrashRadius: 15, damageRange: 6, pierceRange: 8, rangeRange: 6, cooldownRange: 0.2 },
    { name: "Orca", tier: 4, basePower: 16, maxPower: 64, damage: 0, pierce: 20, range: 50, fireRate: 1.1, dmgType: 'normal', explosionRadius: 24, knockback: 80, thrashDamage: 30, thrashFireRate: 0.6, thrashPierce: 20, thrashRadius: 24, moabDmg: 5, damageRange: 30, pierceRange: 10, rangeRange: 10, cooldownRange: 0.25 },
    { name: "Megalodon", tier: 5, basePower: 36, maxPower: 132, damage: 0, pierce: 50, range: 60, fireRate: 1.1, dmgType: 'normal', explosionRadius: 48, knockback: 150, thrashDamage: 600, thrashFireRate: 0.6, thrashPierce: 50, thrashRadius: 48, moabDmg: 50, damageRange: 500, pierceRange: 20, rangeRange: 20, cooldownRange: 0.25 }
];

const AIR_BEASTS = [
    { name: "Gyrfalcon", tier: 1, basePower: 1, maxPower: 1, damage: 1, pierce: 3, range: 60, fireRate: 1.0, dmgType: 'sharp', explosionRadius: 10, damageRange: 0, pierceRange: 0, rangeRange: 0, cooldownRange: 0 },
    { name: "Horned Owl", tier: 2, basePower: 3, maxPower: 6, damage: 1, pierce: 6, range: 60, fireRate: 1.0, dmgType: 'sharp', explosionRadius: 20, canSeeCamo: true, damageRange: 2, pierceRange: 4, rangeRange: 0, cooldownRange: 0 },
    { name: "Golden Eagle", tier: 3, basePower: 8, maxPower: 24, damage: 1, pierce: 30, range: 60, fireRate: 1.0, dmgType: 'sharp', explosionRadius: 25, damageRange: 6, pierceRange: 8, rangeRange: 6, cooldownRange: 0.2 },
    { name: "Giant Condor", tier: 4, basePower: 16, maxPower: 64, damage: 2, pierce: 30, range: 60, fireRate: 1.0, dmgType: 'sharp', explosionRadius: 25, moabDmg: 11, damageRange: 30, pierceRange: 10, rangeRange: 10, cooldownRange: 0.25 },
    { name: "Pouākai", tier: 5, basePower: 36, maxPower: 132, damage: 10, pierce: 150, range: 60, fireRate: 0.8, dmgType: 'normal', explosionRadius: 45, moabDmg: 80, damageRange: 500, pierceRange: 20, rangeRange: 20, cooldownRange: 0.25 }
];

export default {
    stats: { 
        name: "Beast Handler", cost: 250, range: 20, fireRate: 1.4, 
        damage: 1, pierce: 4, projectileSpeed: 800, 
        lifespan: 0.4, desc: "Trains land, water or air beasts.", 
        dmgType: 'energy', projectileType: 'beast_attack', hitRadius: 14, 
        category: 'Support',
        ignoresLOS: true, 
        canHitLead: false 
    },
    upgrades: {
        1: [ 
            {name:"Piranha", cost:160, desc:"Command a small but feisty little fish to leap from the water at the Bloons."},
            {name:"Barracuda", cost:810, desc:"The Barracuda slaps Bloons backwards and pops multiple layers with their razor sharp teeth."},
            {name:"Great White", cost:2010, desc:"The Great White will crush Bloons, including Lead Bloons in its jaws, dragging them back to the water if needed. At max Beast Power the Great White can drag down MOABs."},
            {name:"Orca", cost:12500, desc:"The mighty Orca's huge mouth can grab and drag all but the very largest Bloons into the depths. At max Beast Power the Orca can drag down ZOMGs."},
            {name:"Megalodon", cost:45000, desc:"A truly colossal shark with a taste for Bloon. Requires 3 additional Orca Handlers to control."}
        ],
        2: [ 
            {name:"Microraptor", cost:175, desc:"Command a sharp clawed little dinosaur."},
            {name:"Adasaurus", cost:830, desc:"The sharp teeth of the Adasaurus deal high short range damage that can tear through Lead."},
            {name:"Velociraptor", cost:2065, desc:"Velociraptor viciously slashes and chomps, dealing more damage to stunned Bloons."},
            {name:"Tyrannosaurus Rex", cost:9500, desc:"The Tyrannosaurus Rex's huge jaw and sharp teeth deal a ton of damage with each bite. T Rex Stomp ability: Stuns up to ZOMG Bloons in a wide area."},
            {name:"Giganotosaurus", cost:60000, desc:"The biggest and most fierce dinosaur of them all, Giganotosaurus can shred almost any Bloon instantly and with ease. Stomp ability hits the whole map and lasts longer. Requires 3 additional Tyrannosaurus Handlers to control."}
        ],
        3: [ 
            {name:"Gyrfalcon", cost:190, desc:"Command a noble little bird of prey that can grab and move Bloons to the drop-off target. Bloons up-track of the target get scratched."},
            {name:"Horned Owl", cost:860, desc:"The Horned Owl is strong enough to grab Ceramic Bloons, and has keen eyes that can detect Camo Bloons."},
            {name:"Golden Eagle", cost:2120, desc:"The Golden Eagle's huge talons make it an expert at grabbing large numbers of Bloons at once. At max Beast Power the Golden Eagle can grab lowest tiers of MOAB."},
            {name:"Giant Condor", cost:9000, desc:"The huge talons of the fearsome Giant Condor can pick up smaller MOAB-Class Bloons."},
            {name:"Pouākai", cost:30000, desc:"The legendary Pouākai: a bird so large that it can pick up, carry off and destroy almost any number of Bloons of almost any size. Requires 3 additional Condor Handlers to control."}
        ]
    },

    postUpgrade(tower, path) {
        if (tower.upgrades[path-1] > 0) {
            tower.hasBeast = true; 
            
            const tier = tower.upgrades[path-1];
            let terrain = '';
            let data = null;
            
            if (path === 1) { terrain = 'water'; data = WATER_BEASTS[tier - 1]; }
            else if (path === 2) { terrain = 'land'; data = LAND_BEASTS[tier - 1]; }
            else if (path === 3) { terrain = 'air'; data = AIR_BEASTS[tier - 1]; }
            
            if (!data) return;
            
            if (tower.beast) {
                if (tower.beast.terrain !== terrain) {
                    tower.beast.alive = false;
                    const idx = GameEngine.beasts.indexOf(tower.beast);
                    if (idx > -1) GameEngine.beasts.splice(idx, 1);
                    
                    let beast = new Beast(tower.x + 25, tower.y + 10, terrain, tier, tower);
                    GameEngine.beasts.push(beast);
                    tower.beast = beast;
                } else {
                    tower.beast.tier = tier;
                    tower.beast.data = data;
                    tower.beast.beastPower = data.basePower;
                    tower.beast.recalculateStats();
                }
            } else {
                let spawnX = tower.x + 25;
                let spawnY = tower.y + 10;
                
                if (terrain === 'water') {
                    let found = false;
                    for(let r=20; r<200 && !found; r+=20) {
                        for(let a=0; a<Math.PI*2; a+=Math.PI/4) {
                            let tx = tower.x + Math.cos(a)*r;
                            let ty = tower.y + Math.sin(a)*r;
                            if (GameEngine.map.isInWater(tx, ty)) { spawnX = tx; spawnY = ty; found = true; break; }
                        }
                    }
                } else if (terrain === 'air') {
                    let pt = GameEngine.map.getNearestPathPoint(tower.x, tower.y);
                    if(pt) { spawnX = pt.x; spawnY = pt.y; }
                } else {
                    if (GameEngine.map.isOnPath(spawnX, spawnY) || GameEngine.map.isInWater(spawnX, spawnY)) {
                        let found = false;
                        for(let r=20; r<100 && !found; r+=20) {
                            for(let a=0; a<Math.PI*2; a+=Math.PI/4) {
                                let tx = tower.x + Math.cos(a)*r;
                                let ty = tower.y + Math.sin(a)*r;
                                if (!GameEngine.map.isOnPath(tx, ty) && !GameEngine.map.isInWater(tx, ty) && !GameEngine.map.isOnProp(tx, ty)) { 
                                    spawnX = tx; spawnY = ty; found = true; break; 
                                }
                            }
                        }
                    }
                }
                
                let beast = new Beast(spawnX, spawnY, terrain, tier, tower);
                GameEngine.beasts.push(beast);
                tower.beast = beast;
            }
            
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
        // Handled by GameEngine.beasts
    },

    // FIX: Base handler now uses an AoE splash attack exactly like the wiki
    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        if (tower.hasBeast) return;
        const expR = 25; // 12 units radius
        engine.explosions.push({ x: target.x, y: target.y, radius: 0, maxRadius: expR, life: 0.4, maxLife: 0.4, color: '#f1c40f' });
        Utils.applyAoeDamage(engine, target.x, target.y, expR, damage, dmgType, tower, effects, { maxHits: tower.stats.pierce });
    },

    ability(tower, engine) {
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

export { LAND_BEASTS, WATER_BEASTS, AIR_BEASTS };