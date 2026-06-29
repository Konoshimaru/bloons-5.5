// js/towers/alchemist.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { RANGE_SCALE } from '../config.js';

export default {
    stats: { 
        name: "Alchemist", cost: 550, range: 45, 
        baseCooldown: 2.0, fireRate: 2.0, 
        damage: 1, pierce: 15, projectileSpeed: 300, 
        lifespan: 1.0, desc: "Throws acid potions. Can buff nearby towers.", 
        dmgType: 'acid', projectileType: 'potion', hitRadius: 18, isStaticRotation: true,
        brewCd: 8.0, brewTimer: 0
    },
    upgrades: {
        1: [
            {name:"Larger Potions", cost:250, stat:"pierce", amount:5, desc:"Potions splash over more Bloons.", extraMods:{explosionRadius: 20}},
            {name:"Acidic Mixture Dip", cost:350, stat:"canDip", amount:true, desc:"Throws potions at monkeys to buff them vs Ceramics/MOABs/Leads."},
            {name:"Berserker Brew", cost:1250, stat:"canBrew", amount:true, desc:"Throws brew at monkeys for +1 dmg, +10% range/speed, +2 pierce."},
            {name:"Stronger Stimulant", cost:3000, stat:"brewDmg", amount:1, desc:"Better brew: +15% range, +17.6% speed, +3 pierce.", extraMods:{brewRange:0.15, brewSpeed:0.176, brewPierce:3, brewShots:40, brewTimer:12}},
            {name:"Permanent Brew", cost:60000, stat:"isPermBrew", amount:true, desc:"Brew and Dip become permanent."}
        ],
        2: [
            {name:"Stronger Acid", cost:250, stat:"dotTick", amount:-0.5, desc:"Acid dissolves Bloons faster.", extraMods:{dotTimer:4.5}},
            {name:"Perishing Potions", cost:475, stat:"moabDmg", amount:5, desc:"Deals 5 dmg to MOABs, 20 to Fortified. Strips Fortified off non-blimps.", extraMods:{brewShots:35, brewTimer:6}},
            {name:"Unstable Concoction", cost:3000, stat:"unstableConcoction", amount:true, desc:"Coats MOABs. Explodes on death for 10% base health."},
            {name:"Transforming Tonic", cost:4500, stat:"isAbility", amount:true, desc:"Ability: Turns into a laser monster for 20s.", extraMods:{unlocksAbility:true, abilityName:"Tonic", abilityCd:40}},
            {name:"Total Transformation", cost:45000, stat:"damage", amount:1, desc:"Ability affects 5 nearby monkeys."}
        ],
        3: [
            {name:"Faster Throwing", cost:650, desc:"Throws potions 25% faster.", cooldownMult: 0.8},
            {name:"Acid Pool", cost:450, stat:"acidPool", amount:true, desc:"Every 5th attack spills an acid pool."},
            {name:"Lead To Gold", cost:1000, stat:"leadToGold", amount:true, desc:"Instakills Leads for $50."},
            {name:"Rubber to Gold", cost:2750, stat:"rubberToGold", amount:true, desc:"Goldifies bloons for +100% cash."},
            {name:"Bloon Master Alchemist", cost:40000, stat:"bloonMaster", amount:true, desc:"Throws shrink potion, converts bloons to Red."}
        ]
    },
    update(tower, dt) {
        if (tower.isMonster) {
            tower.monsterTimer -= dt;
            if (tower.monsterTimer <= 0) tower.isMonster = false;
            else {
                tower.monsterFireTimer -= dt;
                if (tower.monsterFireTimer <= 0) {
                    tower.monsterFireTimer = 0.03;
                    let target = null, bestVal = -Infinity, effRange = (tower.stats.range + 27) * RANGE_SCALE;
                    const candidates = GameEngine.enemyGrid.query(tower.x, tower.y, effRange);
                    for (let e of candidates) { if (!e.alive) continue; if (e.distanceTraveled > bestVal) { bestVal = e.distanceTraveled; target = e; } }
                    if (target) {
                        let p = GameEngine.projectilePool.get();
                        p.init(tower.x, tower.y, 3, target, 'laser', 1000, 6, 0.2, null, null, 0, tower, { isEnergy: true, canHitLead: true });
                    }
                }
                return; 
            }
        }
        if (tower.stats.canBrew || tower.stats.canDip) {
            tower.brewTimer -= dt;
            if (tower.brewTimer <= 0) {
                let effRange = tower.stats.range * RANGE_SCALE; let targetTower = null; let bestDist = Infinity;
                for (let ot of GameEngine.towers) {
                    if (!ot || ot === tower || ot.type === 'farm' || ot.type === 'village' || ot.type === 'alchemist' || ot.type === 'farmer') continue;
                    let dist = Utils.distance(tower.x, tower.y, ot.x, ot.y);
                    if (dist < effRange) {
                        if (tower.stats.canBrew && (!ot.alchBuff || (!ot.alchBuff.isPerm && ot.alchBuff.shotsLeft < 10))) { if (dist < bestDist) { bestDist = dist; targetTower = ot; } } 
                        else if (tower.stats.canDip && (!ot.alchDip || (!ot.alchDip.isPerm && ot.alchDip.shotsLeft < 5))) { if (dist < bestDist) { bestDist = dist; targetTower = ot; } }
                    }
                }
                if (targetTower) {
                    tower.brewTimer = tower.stats.brewCd || 8.0; let buffType = tower.stats.canBrew ? 'brew' : 'dip';
                    let p = GameEngine.projectilePool.get();
                    p.init(tower.x, tower.y, 0, null, 'buff_potion', 400, 1, 2.0, Utils.angle(tower.x, tower.y, targetTower.x, targetTower.y), null, 0, tower, { isAcid: true });
                    p.targetTower = targetTower; p.buffType = buffType;
                } else { tower.brewTimer = 1.0; }
            }
        }
        if (tower.stats.bloonMaster) {
            tower.shrinkTimer -= dt;
            if (tower.shrinkTimer <= 0) {
                tower.shrinkTimer = 5.0; let target = null, bestVal = -Infinity;
                for (let e of GameEngine.enemies) { if (!e.alive || e.data.isBAD) continue; if (e.data.rbe > bestVal) { bestVal = e.data.rbe; target = e; } }
                if (target) {
                    let p = GameEngine.projectilePool.get();
                    p.init(tower.x, tower.y, 0, null, 'shrink_potion', 600, 200, 5.0, null, null, 0, tower, { isMagic: true, canHitLead: true });
                    p.targetX = target.x; p.targetY = target.y;
                }
            }
        }
        
        // PRO FIX: Removed tower.acquireAndFire(dt). The ECS System handles this automatically!
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        tower.shotCount = (tower.shotCount || 0) + 1;
        let expRadius = 40 + (tower.stats.explosionRadius || 0); let expDmg = damage; let expEffects = { ...effects };
        if (tower.stats.moabDmg) expEffects.moabDmg = tower.stats.moabDmg;
        if (tower.stats.unstableConcoction) expEffects.unstableConcoction = true;
        if (tower.upgrades[1] >= 2) expEffects.stripFortified = true; 
        if (tower.stats.leadToGold) { expEffects.leadToGold = true; expDmg += 9; }
        if (tower.stats.rubberToGold && tower.shotCount % 4 === 0) expEffects.rubberToGold = true;
        if (tower.stats.acidPool && tower.shotCount % 5 === 0) { GameEngine.acidPools = GameEngine.acidPools || []; GameEngine.acidPools.push({ x: target.x, y: target.y, life: 5.0, maxLife: 5.0, radius: 30, dmg: 1, tick: 0 }); }
        expEffects.explosionRadius = expRadius; expEffects.explosionDamage = expDmg; expEffects.explosionPierce = tower.stats.pierce;
        expEffects.dot = 1; expEffects.dotTimer = tower.stats.dotTimer || 4.0; expEffects.isAcid = true;
        let p = GameEngine.projectilePool.get();
        p.init(tower.x, tower.y, expDmg, target, 'potion', tower.stats.projectileSpeed, 1, 1.0, null, expEffects, 0, tower, dmgType);
    },
    ability(tower, engine) {
        engine.log("Transforming Tonic!"); tower.isMonster = true; tower.monsterTimer = 20.0; tower.monsterFireTimer = 0;
        if (tower.upgrades[1] === 5) {
            let count = 0;
            for (let ot of engine.towers) {
                if (ot && ot !== tower && ot.upgrades[0] <= 3 && ot.upgrades[1] <= 3 && ot.upgrades[2] <= 3) {
                    if (Utils.distance(tower.x, tower.y, ot.x, ot.y) < 200) { ot.isMonster = true; ot.monsterTimer = 20.0; ot.monsterFireTimer = 0; count++; if (count >= 5) break; }
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