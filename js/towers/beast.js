// js/towers/beast.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { Tower } from '../tower.js';
import { GLOBAL_SCALE } from '../constants.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

export default {
    stats: { 
        name: "Beast Handler", cost: 250, range: 20, fireRate: 1.4, 
        damage: 1, pierce: 1, projectileSpeed: 800, 
        lifespan: 0.4, desc: "Trains land, water or air beasts.", 
        dmgType: 'energy', projectileType: 'beast_attack', hitRadius: 14, 
        explosionRadius: 12, explosionDamage: 1, explosionPierce: 4,
        category: 'Support' 
    },
    upgrades: {
        1: [ // Water Path
            {name:"Piranha", cost:160, desc:"Command a small fish to leap at Bloons.", extraMods:{projectileType: 'beast_water', damage: 1, pierce: 1, range: 30, fireRate: 0.6, lifespan: 0.1, dmgType: 'shatter'}},
            {name:"Barracuda", cost:810, desc:"Slaps Bloons backwards.", extraMods:{projectileType: 'beast_water', damage: 2, pierce: 4, range: 35, fireRate: 0.6, lifespan: 0.1, dmgType: 'shatter', knockback: 20}},
            {name:"Great White", cost:2010, desc:"Crushes Lead Bloons, dragging them back.", extraMods:{projectileType: 'beast_water', damage: 12, pierce: 10, range: 40, fireRate: 1.1, lifespan: 0.1, dmgType: 'normal', knockback: 40, canHitLead: true}},
            {name:"Orca", cost:12500, desc:"Huge mouth drags bloons into the depths.", extraMods:{projectileType: 'beast_water', damage: 30, pierce: 20, range: 50, fireRate: 1.1, lifespan: 0.1, dmgType: 'normal', knockback: 80, moabDmg: 5}},
            {name:"Megalodon", cost:45000, desc:"Colossal shark with a taste for Bloon.", extraMods:{projectileType: 'beast_water', damage: 600, pierce: 50, range: 60, fireRate: 1.1, lifespan: 0.1, dmgType: 'normal', knockback: 150, moabDmg: 50}}
        ],
        2: [ // Land Path
            {name:"Microraptor", cost:175, desc:"Sharp clawed little dinosaur.", extraMods:{projectileType: 'beast_land', damage: 1, pierce: 5, range: 20, fireRate: 1.0, lifespan: 0.05, dmgType: 'sharp'}},
            {name:"Adasaurus", cost:830, desc:"Sharp teeth tear through Lead.", extraMods:{projectileType: 'beast_land', damage: 2, pierce: 8, range: 20, fireRate: 1.0, lifespan: 0.05, dmgType: 'normal', ceramicDmg: 1}},
            {name:"Velociraptor", cost:2065, desc:"Slashes and chomps, dealing more damage to stunned Bloons.", extraMods:{projectileType: 'beast_land', damage: 4, pierce: 12, range: 24, fireRate: 1.0, lifespan: 0.05, dmgType: 'normal', ceramicDmg: 4, stun: 0.5}},
            {name:"Tyrannosaurus Rex", cost:9500, desc:"Huge jaw deals a ton of damage. Stomp Ability.", extraMods:{projectileType: 'beast_land', damage: 20, pierce: 22, range: 30, fireRate: 1.0, lifespan: 0.05, dmgType: 'normal', ceramicDmg: 5, isAbility: true, abilityName: "T-Rex Stomp", abilityCd: 40}},
            {name:"Giganotosaurus", cost:60000, desc:"Shreds almost any Bloon instantly. Stomp hits whole map.", extraMods:{projectileType: 'beast_land', damage: 750, pierce: 44, range: 50, fireRate: 1.25, lifespan: 0.05, dmgType: 'normal', isAbility: true, abilityName: "Giganoto Stomp", abilityCd: 25}}
        ],
        3: [ // Air Path
            {name:"Gyrfalcon", cost:190, desc:"Grabs and moves Bloons.", extraMods:{projectileType: 'beast_air', damage: 1, pierce: 3, range: 60, fireRate: 1.0, lifespan: 0.1, dmgType: 'sharp'}},
            {name:"Horned Owl", cost:860, desc:"Strong enough to grab Ceramics. Detects Camo.", extraMods:{projectileType: 'beast_air', damage: 1, pierce: 6, range: 60, fireRate: 1.0, lifespan: 0.1, dmgType: 'sharp', canSeeCamo: true}},
            {name:"Golden Eagle", cost:2120, desc:"Huge talons grab large numbers of Bloons.", extraMods:{projectileType: 'beast_air', damage: 1, pierce: 30, range: 60, fireRate: 1.0, lifespan: 0.1, dmgType: 'sharp'}},
            {name:"Giant Condor", cost:9000, desc:"Can pick up smaller MOAB-Class Bloons.", extraMods:{projectileType: 'beast_air', damage: 2, pierce: 30, range: 60, fireRate: 1.0, lifespan: 0.1, dmgType: 'sharp', moabDmg: 11}},
            {name:"Pouākai", cost:30000, desc:"Legendary bird that can carry off almost any Bloon.", extraMods:{projectileType: 'beast_air', damage: 10, pierce: 150, range: 60, fireRate: 0.8, lifespan: 0.1, dmgType: 'normal', moabDmg: 80}}
        ]
    },

    postUpgrade(tower, path) {
        if (tower.isMinion) return; // Minions don't run this

        let highestTier = 0;
        let highestPath = -1;
        for(let i=0; i<3; i++) {
            if (tower.upgrades[i] > highestTier) {
                highestTier = tower.upgrades[i];
                highestPath = i;
            }
        }
        
        if (highestTier > 0) {
            // If the active beast path changed, remove old minion
            if (tower.activeBeast && tower.beastPath !== highestPath) {
                tower.activeBeast.alive = false;
                const idx = GameEngine.towers.indexOf(tower.activeBeast);
                if (idx > -1) GameEngine.towers.splice(idx, 1);
                tower.activeBeast = null;
                tower.stats.isAbility = false; // Reset ability state on handler if path changed
            }
            
            tower.beastPath = highestPath;
            tower.beastTier = highestTier;
            const maxPowers = [0, 1, 6, 24, 64, 132];
            const basePowers = [0, 1, 3, 8, 16, 36];
            tower.maxBeastPower = maxPowers[highestTier];
            
            if (tower.beastPower === 0 || tower.beastPath !== highestPath) {
                tower.beastPower = basePowers[highestTier];
            }
            
            if (!tower.activeBeast) {
                let spawnX = tower.x + 25;
                let spawnY = tower.y + 10;
                
                // Find valid spawn position
                if (highestPath === 0) { // Water
                    let found = false;
                    for(let r=20; r<200 && !found; r+=20) {
                        for(let a=0; a<Math.PI*2; a+=Math.PI/4) {
                            let tx = tower.x + Math.cos(a)*r;
                            let ty = tower.y + Math.sin(a)*r;
                            if (GameEngine.map.isInWater(tx, ty)) { spawnX = tx; spawnY = ty; found = true; break; }
                        }
                    }
                } else if (highestPath === 2) { // Air (on track)
                    let pt = GameEngine.map.getNearestPathPoint(tower.x, tower.y);
                    if(pt) { spawnX = pt.x; spawnY = pt.y; }
                } else { // Land
                    let found = false;
                    for(let r=20; r<200 && !found; r+=20) {
                        for(let a=0; a<Math.PI*2; a+=Math.PI/4) {
                            let tx = tower.x + Math.cos(a)*r;
                            let ty = tower.y + Math.sin(a)*r;
                            if (!GameEngine.map.isOnPath(tx, ty) && !GameEngine.map.isInWater(tx, ty) && !GameEngine.map.isOnProp(tx, ty)) { 
                                spawnX = tx; spawnY = ty; found = true; break; 
                            }
                        }
                    }
                }
                
                let m = new Tower(spawnX, spawnY, 'beast');
                m.isMinion = true;
                m.parentTower = tower;
                GameEngine.towers.push(m);
                tower.activeBeast = m;
            }
            this._updateMinionStats(tower);
            
            // Sync ability state to handler so the UI knows it has an ability, but stats stay on minion
            const upgradeData = this.upgrades[highestPath+1][highestTier-1];
            if (upgradeData && upgradeData.extraMods && upgradeData.extraMods.isAbility) {
                tower.stats.isAbility = true;
                tower.stats.abilityName = upgradeData.extraMods.abilityName;
                tower.stats.abilityCd = upgradeData.extraMods.abilityCd;
            } else {
                tower.stats.isAbility = false;
            }
        }
    },

    _updateMinionStats(tower) {
        if (!tower.activeBeast) return;
        let percent = 0;
        if (tower.maxBeastPower > tower.beastTier) {
            percent = (tower.beastPower - tower.beastTier) / (tower.maxBeastPower - tower.beastTier);
        }
        percent = Math.max(0, Math.min(1, percent));
        
        let m = tower.activeBeast;
        const path = tower.beastPath;
        const tier = tower.beastTier;
        
        const upgradeData = this.upgrades[path+1][tier-1];
        if (!upgradeData || !upgradeData.extraMods) return;
        
        const mods = upgradeData.extraMods;
        let baseDmg = mods.damage || 1;
        let basePierce = mods.pierce || 1;
        let baseRange = mods.range || 30;
        
        m.stats.damage = baseDmg + Math.floor(baseDmg * 0.5 * percent);
        m.stats.pierce = basePierce + Math.floor(basePierce * 0.5 * percent);
        m.stats.range = baseRange + Math.floor(baseRange * 0.2 * percent);
        m.stats.projectileType = mods.projectileType || 'beast_attack';
        m.stats.projectileSpeed = 800;
        m.stats.lifespan = mods.lifespan || 0.5;
        m.stats.fireRate = mods.fireRate || 1.4;
        m.stats.knockback = mods.knockback || 0;
        m.stats.stun = mods.stun || 0;
        m.stats.canHitLead = mods.canHitLead || false;
        m.stats.canSeeCamo = mods.canSeeCamo || false;
        m.stats.dmgType = mods.dmgType || 'energy';
        m.stats.moabDmg = mods.moabDmg || 0;
        m.stats.ceramicDmg = mods.ceramicDmg || 0;
        m.stats.isAbility = mods.isAbility || false;
        m.stats.abilityName = mods.abilityName;
        m.stats.abilityCd = mods.abilityCd;
        
        m.hitRadius = 14 * GS;
    },

    update(tower, dt, engine) {
        if (tower.isMinion) return; // Minions use standard update
        
        // Update merge target highlight
        if (engine.isMergingBeast && engine.mergeSourceTower) {
            let source = engine.mergeSourceTower;
            if (tower !== source && tower.beastPath === source.beastPath && tower.beastTier >= source.beastTier) {
                tower.isMergeTarget = true;
            } else {
                tower.isMergeTarget = false;
            }
        } else {
            tower.isMergeTarget = false;
        }
        
        if (tower.activeBeast && !tower.activeBeast.alive) {
            tower.activeBeast = null;
        }
    },

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        let pEffects = { ...effects };
        if (tower.stats.knockback) pEffects.knockback = tower.stats.knockback;
        if (tower.stats.stun) pEffects.stun = tower.stats.stun;
        
        let p = engine.projectilePool.get();
        p.init(tower.x, tower.y, damage, target, tower.stats.projectileType, tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, pEffects, 0, tower, dmgType, isCrit);
    },

    ability(tower, engine) {
        // If this is the handler, forward to minion
        if (!tower.isMinion && tower.activeBeast) {
            this.ability(tower.activeBeast, engine);
            return;
        }
        
        // T-Rex Stomp
        if (tower.stats.abilityName === "T-Rex Stomp") {
            engine.log("T-Rex Stomp!");
            Utils.applyAoeDamage(engine, tower.x, tower.y, 100, 150, {isExplosion: true, canHitLead: true}, tower, {stun: 6.0}, {maxHits: 400});
            engine.explosions.push({ x: tower.x, y: tower.y, radius: 0, maxRadius: 100, life: 0.5, maxLife: 0.5, color: '#e67e22' });
        }
        
        // Giganotosaurus Stomp
        if (tower.stats.abilityName === "Giganoto Stomp") {
            engine.log("Giganotosaurus Stomp!");
            Utils.applyAoeDamage(engine, 640, 360, 2000, 300, {isExplosion: true, canHitLead: true}, tower, {stun: 12.0}, {maxHits: 600});
            engine.explosions.push({ x: 640, y: 360, radius: 0, maxRadius: 1500, life: 1.0, maxLife: 1.0, color: '#c0392b' });
        }
    }
};