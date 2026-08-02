/**
 * SUB-ENTITY PATTERN: FULLY SEPARATE ENTITY
 * =========================================
 * The Beast Handler uses a "Fully Separate Entity" pattern for its minions.
 * Unlike Engineer Sentries or Mermonkey Tentacles which are simple objects 
 * stored in an array on the tower itself, the Beast is a full class instance.
 * 
 * - Lifecycle: Tracked in `GameEngine.beasts[]`, not inside the tower.
 * - Updates: Runs its own `update(dt, engine)` loop via `simulationLoop._updateBeasts()`.
 * - Targeting: Has its own `_findTarget()` and standard targeting modes.
 * - Rendering: Draws itself via `renderer._drawEntities()`.
 * - Data: Imports its stat tables (LAND_BEASTS, etc.) from `beastData.js` 
 *   to avoid circular imports with `towers/beast.js`.
 */

// js/towers/beast.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { Tower } from '../tower.js';
import { GLOBAL_SCALE } from '../constants.js';
import { Beast } from '../beastEntity.js';
import { LAND_BEASTS, WATER_BEASTS, AIR_BEASTS } from '../beastData.js';
import uiTowerPanel from '../uiTowerPanel.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

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

    preUpgrade(tower, path, engine) {
        if (path === 1) {
            let hasWater = false;
            for (let dx = -150; dx <= 150; dx += 30) {
                for (let dy = -150; dy <= 150; dy += 30) {
                    if (engine.map.isInWater(tower.x + dx, tower.y + dy)) { hasWater = true; break; }
                }
                if (hasWater) break;
            }
            if (!hasWater) { engine.log("No water nearby for fish!"); return false; }
        }
        return true;
    },

    onSell(tower, engine) {
        if (tower.beast) {
            tower.beast.alive = false;
            const idx = engine.beasts.indexOf(tower.beast);
            if (idx > -1) engine.beasts.splice(idx, 1);
        }
    },

    getAbilityTarget(tower, slot) {
        if (!tower.isMinion && tower.beast) return tower.beast;
        return tower;
    },
    
    setupCustomUI(panel, t, engine) {
        uiTowerPanel._setupBeastUI(panel, t, engine);
    },

    getCounterText(t) {
        if (t.beast) return `Power: ${t.beast.beastPower} / ${t.beast.data.maxPower}`;
        return `Dmg Dealt: ${Number(t.damageDealt) || 0}`;
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

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        if (tower.hasBeast) return;
        const expR = 25; 
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
