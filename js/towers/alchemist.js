// js/towers/alchemist.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { EnemyTypes } from '../data.js';
import { RANGE_SCALE } from '../config.js';
import { GLOBAL_SCALE } from '../constants.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

export default {
    stats: {
        name: "Alchemist", cost: 550, range: 45,
        baseCooldown: 2.0, fireRate: 2.0,
        damage: 1, pierce: 15, projectileSpeed: 300,
        lifespan: 1.0, desc: "Throws acid potions. Can buff nearby towers.",
        dmgType: 'acid', projectileType: 'potion', hitRadius: 18, isStaticRotation: true,
        brewCd: 8.0, brewTimer: 0, category: 'Magic'
    },
    upgrades: {
        1: [
            {name:"Larger Potions", cost:250, stat:"pierce", amount:5, desc:"Potions splash over more Bloons in a larger area.", extraMods:{explosionRadius: 20}},
            {name:"Acidic Mixture Dip", cost:350, stat:"canDip", amount:true, desc:"Throws a helpful potion at nearby Monkeys that allows them to pop Lead Bloons and do extra damage to Ceramic and MOAB-class Bloons."},
            {name:"Berserker Brew", cost:1400, stat:"canBrew", amount:true, desc:"Throws special brew to a nearby Monkey giving it increased damage, range, and attack speed briefly.", extraMods:{brewDmg:1, brewRange:0.10, brewSpeed:0.10, brewPierce:2, brewShots:25, brewTimer:5}},
            {name:"Stronger Stimulant", cost:2850, stat:"brewDmg", amount:1, desc:"Extra strong berserker brew has even more powerful effect on the target. Lasts even longer.", extraMods:{brewRange:0.05, brewSpeed:0.076, brewPierce:1, brewShots:40, brewTimer:12}},
            {name:"Permanent Brew", cost:48000, stat:"isPermBrew", amount:true, desc:"Berserker brew becomes PERMANENT on Monkeys who drink it."}
        ],
        2: [
            {name:"Stronger Acid", cost:250, stat:"dot", amount:1, desc:"Acid potions dissolve Bloons faster."},
            {name:"Perishing Potions", cost:475, stat:"moabDmg", amount:5, desc:"Attack potions deal more damage to MOAB-class Bloons and strip Fortified off smaller Bloons. Buff potions last longer.", extraMods:{brewShots:35, brewTimer:6}},
            {name:"Unstable Concoction", cost:2800, stat:"unstableConcoction", amount:true, desc:"Coats MOAB-Class in an explosive substance that causes a large explosion when they are popped."},
            {name:"Transforming Tonic", cost:4200, stat:"isAbility", amount:true, desc:"Transformation ability: Turns Alchemist into powerful attack Monster for 20 seconds.", extraMods:{unlocksAbility:true, abilityName:"Tonic", abilityCd:40}},
            {name:"Total Transformation", cost:45000, stat:"damage", amount:1, desc:"Transforms five Monkeys nearby into crazy attack monsters for 20 seconds."}
        ],
        3: [
            {name:"Faster Throwing", cost:650, desc:"Throws potions and attacks faster.", cooldownMult: 0.8},
            {name:"Acid Pool", cost:450, stat:"acidPool", amount:true, desc:"Every few attacks spills an acid pool on the track."},
            {name:"Lead to Gold", cost:1000, stat:"leadToGold", amount:true, desc:"Converts Lead Bloons to GOLD! Special solvents do extra damage to Lead Bloons, destroying them in one shot and generating cash."},
            {name:"Rubber to Gold", cost:2750, stat:"rubberToGold", amount:true, desc:"Converts all Bloons partially into gold, disabling Bloon immunity and getting more cash per pop from affected Bloons."},
            {name:"Bloon Master Alchemist", cost:40000, stat:"bloonMaster", amount:true, desc:"Secret shrink potion converts all affected Bloons to Red Bloons."}
        ]
    },
    update(tower, dt) {
        // 1. Transforming Tonic Monster Mode
        if (tower.isMonster) {
            tower.monsterTimer -= dt;
            if (tower.monsterTimer <= 0) {
                tower.isMonster = false;
            } else {
                tower.monsterFireTimer -= dt;
                if (tower.monsterFireTimer <= 0) {
                    tower.monsterFireTimer = 0.03;
                    let target = null, bestVal = -Infinity;
                    const effRange = Utils.getEffectiveRange(tower, GameEngine) + (27 * RANGE_SCALE * GS);
                    const candidates = GameEngine.enemyGrid.query(tower.x, tower.y, effRange);
                    for (let e of candidates) { 
                        if (!e || !e.alive) continue; 
                        if (e.distanceTraveled > bestVal) { bestVal = e.distanceTraveled; target = e; } 
                    }
                    if (target) {
                        let p = GameEngine.projectilePool.get();
                        p.init(tower.x, tower.y, 3, target, 'laser', 1000, 6, 0.2, null, null, 0, tower, { isEnergy: true, canHitLead: true });
                    }
                }
                return; // Skip normal attacks while monster
            }
        }

        // 2. Buff Throwing (Acidic Mixture Dip / Berserker Brew)
        if (tower.stats.canBrew || tower.stats.canDip) {
            tower.brewTimer -= dt;
            if (tower.brewTimer <= 0) {
                let effRange = Utils.getEffectiveRange(tower, GameEngine);
                let targetTower = null;
                let bestDistSq = Infinity;
                let effRangeSq = effRange * effRange;
                
                for (let ot of GameEngine.towers) {
                    if (!ot || ot === tower || ot.type === 'farm' || ot.type === 'village' || ot.type === 'alchemist' || ot.type === 'farmer' || ot.type === 'engineer') continue;
                    let distSq = Utils.distanceSq(tower.x, tower.y, ot.x, ot.y);
                    if (distSq < effRangeSq) {
                        if (tower.stats.canBrew && (!ot.alchBuff || (!ot.alchBuff.isPerm && ot.alchBuff.shotsLeft < 10))) { 
                            if (distSq < bestDistSq) { bestDistSq = distSq; targetTower = ot; } 
                        } else if (tower.stats.canDip && (!ot.alchDip || (!ot.alchDip.isPerm && ot.alchDip.shotsLeft < 5))) { 
                            if (distSq < bestDistSq) { bestDistSq = distSq; targetTower = ot; } 
                        }
                    }
                }
                
                if (targetTower) {
                    tower.brewTimer = tower.stats.brewCd || 8.0;
                    let buffType = tower.stats.canBrew ? 'brew' : 'dip';
                    
                    // FIX: Apply buff immediately and show icon!
                    if (buffType === 'brew') {
                        let duration = tower.stats.brewTimer || 5;
                        if (tower.stats.isPermBrew) duration = 9999;
                        targetTower.alchBuff = {
                            timer: duration,
                            shotsLeft: tower.stats.brewShots || 25,
                            dmg: tower.stats.brewDmg || 1,
                            range: tower.stats.brewRange || 0.1,
                            speed: tower.stats.brewSpeed || 0.1,
                            pierce: tower.stats.brewPierce || 2,
                            isPerm: tower.stats.isPermBrew || false
                        };
                        targetTower.addBuff('alch', 'Alch Buff', duration, 1, { type: 'alch' }, false);
                    } else {
                        let duration = 10;
                        if (tower.stats.isPermBrew) duration = 9999;
                        targetTower.alchDip = {
                            timer: duration,
                            shotsLeft: tower.stats.brewShots ? tower.stats.brewShots : 10,
                            isPerm: tower.stats.isPermBrew || false
                        };
                        targetTower.addBuff('alch_dip', 'Acid Dip', duration, 1, { type: 'alch' }, false); // Use same icon
                    }
                    
                    // Spawn visual potion
                    let p = GameEngine.projectilePool.get();
                    p.init(tower.x, tower.y, 0, null, 'buff_potion', 400, 1, 2.0, Utils.angle(tower.x, tower.y, targetTower.x, targetTower.y), null, 0, tower, { isAcid: true });
                    p.targetTower = targetTower; 
                    p.buffType = buffType;
                } else {
                    tower.brewTimer = 1.0; // Retry soon
                }
            }
        }

        // 3. Bloon Master Alchemist (Shrink Potion)
        if (tower.stats.bloonMaster) {
            tower.shrinkTimer -= dt;
            if (tower.shrinkTimer <= 0) {
                tower.shrinkTimer = 5.0;
                let target = null, bestVal = -Infinity;
                for (let e of GameEngine.enemies) { 
                    if (!e || !e.alive || e.data.isBAD) continue; 
                    if (e.data.rbe > bestVal) { bestVal = e.data.rbe; target = e; } 
                }
                if (target) {
                    // FIX: Instantly shrink all bloons in a radius around the target
                    Utils.applyAoeDamage(GameEngine, target.x, target.y, 60, 0, {isMagic: true, canHitLead: true}, tower, {}, {
                        maxHits: 200,
                        onHit: (e) => {
                            e.tier = 1;
                            e.data = { ...EnemyTypes[1] };
                            e.hp = 1;
                            e.alive = true; 
                            GameEngine.spawnPopEffect(e.x, e.y, '#f1c40f');
                        }
                    });
                    // Spawn visual potion
                    let p = GameEngine.projectilePool.get();
                    p.init(tower.x, tower.y, 0, target, 'potion', 600, 1, 1.0, null, {isExplosive: true, explosionRadius: 60, explosionDamage: 0, explosionPierce: 200}, 0, tower, { isMagic: true, canHitLead: true });
                }
            }
        }
    },

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        tower.shotCount = (tower.shotCount || 0) + 1;
        let expRadius = 40 + (tower.stats.explosionRadius || 0); 
        let expDmg = damage; 
        let expEffects = { ...effects };
        
        if (tower.stats.moabDmg) expEffects.moabDmg = tower.stats.moabDmg;
        if (tower.stats.unstableConcoction) expEffects.unstableConcoction = true;
        if (tower.upgrades[1] >= 2) expEffects.stripFortified = true;
        if (tower.stats.leadToGold) { expEffects.gold = 50; expEffects.leadToGold = true; expDmg += 9; }
        if (tower.stats.rubberToGold && tower.shotCount % 4 === 0) expEffects.rubberToGold = true;
        if (tower.stats.acidPool && tower.shotCount % 5 === 0) { 
            GameEngine.acidPools = GameEngine.acidPools || []; 
            GameEngine.acidPools.push({ x: target.x, y: target.y, life: 5.0, maxLife: 5.0, radius: 30, dmg: 1, tick: 0 }); 
        }
        
        expEffects.explosionRadius = expRadius; 
        expEffects.explosionDamage = expDmg; 
        expEffects.explosionPierce = tower.stats.pierce;
        expEffects.dot = 1 + (tower.stats.dot || 0); 
        expEffects.dotTimer = 4.0; 
        expEffects.isAcid = true;
        
        let p = engine.projectilePool.get();
        p.init(tower.x, tower.y, expDmg, target, 'potion', tower.stats.projectileSpeed, 1, 1.0, null, expEffects, 0, tower, dmgType);
    },

    ability(tower, engine) {
        engine.log("Transforming Tonic!"); 
        tower.isMonster = true; 
        tower.monsterTimer = 20.0; 
        tower.monsterFireTimer = 0;
        
        // Total Transformation (T5)
        if (tower.upgrades[1] === 5) {
            let count = 0;
            for (let ot of engine.towers) {
                if (ot && ot !== tower && ot.upgrades[0] <= 3 && ot.upgrades[1] <= 3 && ot.upgrades[2] <= 3) {
                    if (Utils.withinRange(tower.x, tower.y, ot.x, ot.y, 200)) { 
                        ot.isMonster = true; 
                        ot.monsterTimer = 20.0; 
                        ot.monsterFireTimer = 0; 
                        count++; 
                        if (count >= 5) break; 
                    }
                }
            }
        }
    },

    draw(ctx, tower, isPreview) {
        if (tower.isMonster) {
            ctx.save(); ctx.translate(tower.x, tower.y);
            ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
            ctx.restore(); return;
        }
        tower.drawBaseTower(ctx, isPreview);
    }
};