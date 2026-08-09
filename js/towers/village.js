/**
 * SUB-ENTITY PATTERN: PASSIVE AURA / UPDATE SUPPORT
 * =================================================
 * The Village (and Farm, Ninja, Sniper) uses the `updateSupport(tower, dt, engine)` hook.
 * 
 * - Lifecycle: Has no sub-entities. The tower itself is the aura.
 * - Updates: `updateSupport()` is called every frame by `simulationLoop._updateTowers()`
 *   *before* the standard `update()` method.
 * - Purpose: Used for logic that must run continuously regardless of attack state, 
 *   such as scanning for nearby towers to buff (Village), generating cash (Farm), 
 *   or applying global modifiers (Ninja/Sniper).
 */

// js/towers/village.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { RANGE_SCALE } from '../config.js';
import { Tower } from '../tower.js';
import { MKEffects } from '../monkeyKnowledgeEffects.js';

const _villageScratchA = [];
const _villageScratchB = [];
const _villageTowerScratch = [];

export default {
    stats: { 
        name: "Monkey Village", cost: 1200, range: 40, fireRate: 0, 
        desc: "Buff towers in range. Grants range, attack speed, camo, and lead.", 
        dmgType: 'none', hitRadius: 18,
        rangeBuff: 0.1,
        isStaticRotation: true 
    },
    upgrades: {
        1: [
            {name:"Bigger Radius",cost:400,stat:"range",amount:8,desc:"Increases influence radius of the village."},
            {name:"Jungle Drums",cost:1500,stat:"fireRateBuff",amount:0.18,desc:"Increases attack speed of all Monkeys in the radius."},
            {name:"Primary Training",cost:800,desc:"All Primary Monkeys in radius get more range, pierce and projectile speed."},
            {name:"Primary Mentoring",cost:2500,desc:"All Primary Monkeys in radius get tier 1 upgrades for free, increased range and reduced ability cooldowns."},
            {name:"Primary Expertise",cost:25000,stat:"damage",amount:10,desc:"Adds Mega Ballista attack, plus all Primary Monkeys in radius get more popping power and tier 1 and 2 upgrades for free.", extraMods:{fireRate: 2.5, pierce: 100, dmgType: 'energy', range: 8, bonusCeramic: 190}}
        ],
        2: [
            {name:"Grow Blocker",cost:250,desc:"Prevents Regrow Bloons from working while in the radius of the Village."},
            {name:"Radar Scanner",cost:2000,stat:"grantsCamo",amount:true,desc:"Allows all Monkeys in the radius to attack Camo Bloons."},
            {name:"Monkey Intelligence Bureau",cost:7500,stat:"grantsLead",amount:true,desc:"Allows nearby Monkeys to pop all Bloon types."},
            {name:"Call to Arms",cost:20000,desc:"Call to Arms ability: Gives all monkeys +50% attack speed and pops for a short time.", extraMods:{unlocksAbility:true, abilityName:"Call to Arms", abilityCd:30}},
            {name:"Homeland Defense",cost:40000,desc:"Ability now increases attack speed and pops by 100% for all Monkeys for 20 seconds.", extraMods:{unlocksAbility:true, abilityName:"Homeland Defense", abilityCd:40}}
        ],
        3: [
            {name:"Monkey Business",cost:500,stat:"discount",amount:0.1,desc:"Provides 10% discount on all Monkeys and upgrades tier 3 or less purchased in the radius."},
            {name:"Monkey Commerce",cost:500,stat:"discount",amount:0.05,desc:"An additional 5% discount that can stack with up to 2 other Villages with this upgrade."},
            {name:"Monkey Town",cost:10000,stat:"cashMult",amount:0.5,desc:"All Monkeys within the radius of the Monkey Town get extra cash per Bloon pop."},
            {name:"Monkey City",cost:3000,stat:"range",amount:10,desc:"Increases influence radius, cash generation in radius, and gives you a free Dart Monkey every round."},
            {name:"Monkeyopolis",cost:5000,stat:"income",amount:1000,desc:"Absorbs all nearby Banana Farms and their income, freeing up space for new Monkeys."}
        ]
    },
    
    canUpgrade(tower, path, engine) {
        if (path === 3 && tower.upgrades[2] === 4) { 
            const effRange = tower.stats.range * RANGE_SCALE;
            let hasFarm = false;
            for (let t of engine.towers) {
                if (t && t !== tower && t.type === 'farm' && t.upgrades[0] < 5) {
                    if (Utils.withinRange(tower.x, tower.y, t.x, t.y, effRange)) {
                        hasFarm = true;
                        break;
                    }
                }
            }
            if (!hasFarm) return false;
        }
        return true;
    },

    getUpgradeCostModifier(tower, baseCost, path, tier, engine) {
        if (path === 3 && tier === 4) { 
            const effRange = tower.stats.range * RANGE_SCALE;
            for (let t of engine.towers) {
                if (t && t !== tower && t.type === 'farm' && t.upgrades[0] < 5) {
                    if (Utils.withinRange(tower.x, tower.y, t.x, t.y, effRange)) {
                        baseCost += 5000;
                    }
                }
            }
        }
        return baseCost;
    },

    canChangeTargeting(tower) {
        return tower.upgrades[0] >= 5; // Can only target with Primary Expertise
    },

    getCounterText(t) {
        return `Dmg Dealt: ${Number(t.damageDealt) || 0}`;
    },
    
    updateSupport(tower, dt) {
        const effRange = tower.stats.range * RANGE_SCALE;
        const nearbyTowers = GameEngine.towerGrid.query(tower.x, tower.y, effRange, _villageTowerScratch);
        const mk = GameEngine.config.data.mkActive === false ? {} : (GameEngine.config.data.monkeyKnowledge || {});
        
        for (let t of nearbyTowers) {
            if (t === tower) continue;
            
            if (Utils.withinRange(tower.x, tower.y, t.x, t.y, effRange)) {
                let totalRangeBuff = tower.stats.rangeBuff || 0;
                let totalPierceBuff = 0;
                let projSpeedBuff = 1.0;
                let abilityCdBuff = 1.0;
                
                if (t.stats.category === 'Primary') {
                    if (tower.upgrades[0] >= 3) {
                        totalRangeBuff += 0.1;
                        totalPierceBuff += 1;
                        projSpeedBuff = 1.25;
                    }
                    if (tower.upgrades[0] >= 4) {
                        totalRangeBuff += 0.05; 
                        totalPierceBuff += 1;   
                        abilityCdBuff = 0.9;
                    }
                    if (tower.upgrades[0] >= 5) {
                        totalPierceBuff += 2;   
                        abilityCdBuff = 0.8;
                    }
                }
                
                t.buffedRange = Math.max(t.buffedRange, totalRangeBuff);
                t.buffedFireRate = Math.max(t.buffedFireRate, tower.stats.fireRateBuff || 0);
                t.buffedPierce = Math.max(t.buffedPierce, totalPierceBuff);
                t.buffedProjSpeed = Math.max(t.buffedProjSpeed || 1.0, projSpeedBuff);
                t.abilityCdMult = Math.min(t.abilityCdMult || 1.0, abilityCdBuff);
                
                if (tower.stats.grantsCamo) t.buffedCamo = true;
                if (tower.stats.grantsLead) t.buffedLead = true;
                
                if (tower.stats.discount) {
                    t.discount = Math.max(t.discount, tower.stats.discount);
                }
                
                if (tower.upgrades[2] >= 3) {
                    let cashMult = 0.5;
                    for (const eff of MKEffects.villageBuff) {
                        if (!mk[eff.id]) continue;
                        if (eff.condition && !eff.condition(tower)) continue;
                        if (eff.stat === 'cashMult') cashMult += eff.amount;
                    }
                    t.buffedCashMult = Math.max(t.buffedCashMult || 0, cashMult);
                }

                if (tower.stats.rangeBuff > 0 || tower.stats.discount > 0) {
                    t.addBuff('village', 'Village Buff', 0.5, 1, { type: 'village' }, false);
                }
                if (tower.upgrades[0] >= 2) {
                    t.addBuff('jd', 'Jungle Drums', 0.5, 1, { type: 'jd' }, false);
                }
                if (tower.upgrades[0] >= 3 && t.stats.category === 'Primary') {
                    t.addBuff('ptr', 'Primary Training', 0.5, 1, { type: 'ptr' }, false);
                }
                if (tower.upgrades[0] >= 4 && t.stats.category === 'Primary') {
                    t.addBuff('pm', 'Primary Mentoring', 0.5, 1, { type: 'pm' }, false);
                }
                if (tower.upgrades[0] >= 5 && t.stats.category === 'Primary') {
                    t.addBuff('pe', 'Primary Expertise', 0.5, 1, { type: 'pe' }, false);
                }

                if (tower.upgrades[1] >= 2) {
                    t.addBuff('radar', 'Radar Scanner', 0.5, 1, { type: 'radar' }, false);
                }
                if (tower.upgrades[1] >= 3) {
                    t.addBuff('mib', 'MIB', 0.5, 1, { type: 'mib' }, false);
                }
            }
        }
    },

    update(tower, dt) {
        const effRange = tower.stats.range * RANGE_SCALE;

        if (tower.upgrades[2] >= 4) {
            if (!tower._waveActive && GameEngine.waveManager.waveActive) {
                tower._waveActive = true;
                if (GameEngine.waveManager.currentWave > 0 && !tower._freeDartSpawnedThisWave) {
                    tower._freeDartSpawnedThisWave = true;
                    let angle = Math.random() * Math.PI * 2;
                    let dist = 45;
                    let x = tower.x + Math.cos(angle) * dist;
                    let y = tower.y + Math.sin(angle) * dist;
                    let canPlace = !GameEngine.map.isOnPath(x, y) && !GameEngine.map.isOnProp(x, y) && y < 720 && x < 1280 - 300;
                    if (canPlace) {
                        let t = new Tower(x, y, 'dart');
                        GameEngine.towers.push(t);
                        GameEngine.log("Monkey City: Free Dart Monkey placed!");
                    }
                }
            } else if (tower._waveActive && !GameEngine.waveManager.waveActive) {
                tower._waveActive = false;
                tower._freeDartSpawnedThisWave = false;
            }
        }

        if (tower.upgrades[2] >= 5 && tower.stats.income) {
            tower.incomeTimer = (tower.incomeTimer || 0) - dt;
            if (tower.incomeTimer <= 0) {
                tower.incomeTimer = 6.0; 
                if (!tower.bananas) tower.bananas = [];
                let angle = Math.random() * Math.PI * 2;
                let dist = 10 + Math.random() * 30;
                let targetX = tower.x + Math.cos(angle) * dist;
                let targetY = tower.y + Math.sin(angle) * dist;
                tower.bananas.push({
                    startX: tower.x, startY: tower.y, targetX, targetY,
                    x: tower.x, y: tower.y, arc: 0, progress: 0,
                    life: 15, maxLife: 15,
                    value: Math.floor(tower.stats.income / 5),
                    isCrate: true
                });
            }
        }

        if (tower.upgrades[1] >= 1) {
            const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, effRange, _villageScratchB);
            for (let e of nearby) {
                if (e.alive && e.isRegen && Utils.withinRange(tower.x, tower.y, e.x, e.y, effRange)) {
                    e.isRegen = false;
                }
            }
        }

        if (tower.upgrades[2] >= 5 && !tower._opolisInit) {
            tower._opolisInit = true;
            let farmVal = 0;
            for (let i = GameEngine.towers.length - 1; i >= 0; i--) {
                let t = GameEngine.towers[i];
                if (t && t !== tower && t.type === 'farm' && t.upgrades[0] < 5) {
                    if (Utils.withinRange(tower.x, tower.y, t.x, t.y, effRange)) {
                        farmVal += t.totalSpent;
                        GameEngine.towers.splice(i, 1);
                    }
                }
            }
            let bonusIncome = Math.floor(farmVal / 2000) * 200;
            tower.stats.income = 1000 + bonusIncome;
            if (farmVal > 0) GameEngine.log("Monkeyopolis absorbed " + farmVal + " worth of farms!");
        }

        if (tower.upgrades[0] >= 5 && tower.stats.fireRate > 0) {
            tower.cooldown -= dt;
            if (tower.cooldown <= 0) {
                tower.cooldown = tower.stats.fireRate;
                let target = null, bestVal = -Infinity;
                if (tower.targetingMode === 'Close') {
                    bestVal = Infinity;
                }
            const nearby = GameEngine.enemyGrid.query(tower.x, tower.y, effRange, _villageScratchA);
                for (let e of nearby) {
                    if (!e.alive) continue;
                    let val = 0;
                    if (tower.targetingMode === 'First' || tower.targetingMode === 'Last') {
                        val = e.distanceTraveled;
                    } else if (tower.targetingMode === 'Strong') {
                        val = e.data.rbe;
                    } else if (tower.targetingMode === 'Close') {
                        val = Utils.distanceSq(tower.x, tower.y, e.x, e.y);
                    }
                    
                    let isBetter = false;
                    if (tower.targetingMode === 'Last' || tower.targetingMode === 'Close') {
                        isBetter = val < bestVal;
                    } else {
                        isBetter = val > bestVal;
                    }

                    if (isBetter) {
                        bestVal = val;
                        target = e;
                    }
                }
                if (target) {
                    let p = GameEngine.projectilePool.get();
                    p.init(tower.x, tower.y - 20, 10, target, 'nail', 800, 100, 10.0, null, { homing: true, ricochet: 5, ricochetRange: 150 }, 0, tower, { isEnergy: true, canHitLead: true, moabDmg: 190 });
                }
            }
        }
    },

    fire(tower, target, damage, dmgType, isCrit, effects) {
        // Handled manually in update for better control over the ballista
    },

    ability(tower, engine) {
        let isHomeland = tower.upgrades[1] === 5;
        let duration = (isHomeland ? 20 : 15) + (tower.stats.abilityDuration || 0);
        
        for (let t of engine.towers) {
            if (!t || t.type === 'village') continue;
            t.abilityActiveTime = Math.max(t.abilityActiveTime, duration);
            t.rapidShotMult = isHomeland ? 2 : 1.5;
            let pierceBuffAmount = (t.stats.pierce || 1) * (isHomeland ? 1.0 : 0.5);
            if (pierceBuffAmount > 0) {
                t.addBuff('cta', 'Call to Arms', duration, 1, { type: 'cta', pierce: Math.floor(pierceBuffAmount) }, false);
            }
        }
        engine.log(isHomeland ? "Homeland Defense Activated!" : "Call to Arms Activated!");
    }
};
