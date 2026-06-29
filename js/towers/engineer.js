// js/towers/engineer.js
import { GameEngine } from '../engine.js';
import { Utils, drawShadow } from '../utils.js';
import { RANGE_SCALE } from '../config.js';

export default {
    stats: { 
        name: "Engineer Monkey", scale:1.2, cost: 350, range: 35, 
        baseCooldown: 0.70, fireRate: 0.70, 
        damage: 1, pierce: 3, projectileSpeed: 600, 
        desc: "Wields a nailgun. Upgrades into sentries, foam, and traps.", 
        dmgType: 'sharp', projectileType: 'nail', hitRadius: 18, maxSentries: 0 
    },
    upgrades: {
        1: [
            {name:"Sentry Gun",cost:500,stat:"maxSentries",amount:1,desc:"Creates temporary sentry guns."},
            {name:"Faster Engineering",cost:400,stat:"sentrySpawnMod",amount:0.6,desc:"Produces sentries 66% faster."},
            {name:"Sprockets",cost:575,desc:"Nailgun and sentries attack twice as fast.", cooldownMult: 0.5, extraMods: {sentryFireRateMod: 0.5}},
            {name:"Sentry Expert",cost:2500,stat:"maxSentries",amount:3,desc:"Spawns 4 specialized sentries."},
            {name:"Sentry Champion",cost:32000,stat:"maxSentries",amount:0,desc:"Super-powerful unstable plasma sentries.", extraMods: {sentryDmg: 3, sentryPierce: 5, sentryFireRate: 0.06, sentryDmgType: 'plasma', sentryExplode: true}}
        ],
        2: [
            {name:"Larger Service Area",cost:250,stat:"range",amount:62.5,desc:"Shoots further and deploys sentries in a larger area.", extraMods: {sentryRange: 12.5}},
            {name:"Deconstruction",cost:350,stat:"moabDmg",amount:1,desc:"Nail gun and Sentries do +1 damage to MOABs and Fortified.", extraMods: {fortifiedDmg: 1}},
            {name:"Cleansing Foam",cost:900,stat:"canHitLead",amount:true,desc:"Sprays foam that removes Camo/Regrow and pops Lead.", extraMods: {canSeeCamo: true, applyFoam: true}},
            {name:"Overclock",cost:13500,stat:"isAbility",amount:true,desc:"Ability: Overclock a nearby tower."},
            {name:"Ultraboost",cost:72000,stat:"isAbility",amount:true,desc:"Ability: Permanent attack speed boost."}
        ],
        3: [
            {name:"Oversize Nails",cost:450,stat:"pierce",amount:5,desc:"Nails pop 8 bloons and can pop frozen."},
            {name:"Pin",cost:220,stat:"applyPin",amount:true,desc:"Pins non-MOAB bloons in place temporarily."},
            {name:"Double Gun",cost:450,desc:"Double nailgun attack speed.", cooldownMult: 0.5, extraMods: {sentryProjCount: 1}},
            {name:"Bloon Trap",cost:3600,stat:"trapRbe",amount:500,desc:"Bloon trap captures Bloons until full."},
            {name:"XXXL Trap",cost:45000,stat:"trapRbe",amount:9500,desc:"Huge trap can capture MOABs.", extraMods: {trapMoab: true}}
        ]
    },
    update(tower, dt) {
        let spawnMod = tower.stats.sentrySpawnMod || 1;
        let sentryFireRate = tower.stats.sentryFireRate || 0.6;
        if (tower.stats.sentryFireRateMod) sentryFireRate *= tower.stats.sentryFireRateMod;
        for (let i = tower.sentries.length - 1; i >= 0; i--) {
            let s = tower.sentries[i];
            s.life -= dt;
            if (s.life <= 0) {
                if (s.explode) {
                    GameEngine.explosions.push({ x: s.x, y: s.y, radius: 0, maxRadius: 40, life: 0.3, maxLife: 0.3, color: '#9b59b6' });
                    const nearby = GameEngine.enemyGrid.query(s.x, s.y, 40);
                    for (let e of nearby) { if (Utils.distance(s.x, s.y, e.x, e.y) < 40) e.takeDamage(5, { isPlasma: true, canHitLead: true }); }
                }
                tower.sentries.splice(i, 1); continue;
            }
            s.cooldown -= dt;
            if (s.cooldown <= 0) {
                let sTarget = null; let sBestVal = Infinity;
                const sCandidates = GameEngine.enemyGrid.query(s.x, s.y, s.range);
                for (let e of sCandidates) { if (!e.alive) continue; if (Utils.distance(s.x, s.y, e.x, e.y) < s.range) { if (e.distanceTraveled < sBestVal) { sBestVal = e.distanceTraveled; sTarget = e; } } }
                if (sTarget) {
                    let sDmgType = { canHitLead: s.dmgType === 'plasma' || s.dmgType === 'explosion', isExplosion: s.dmgType === 'explosion', isIce: s.dmgType === 'ice', isSharp: s.dmgType === 'sharp', isPlasma: s.dmgType === 'plasma', isEnergy: s.dmgType === 'energy', isFire: false, isMagic: false, moabDmg: tower.stats.moabDmg || 0, fortifiedDmg: tower.stats.fortifiedDmg || 0 };
                    let count = s.projCount || 1;
                    for(let j=0; j<count; j++) {
                        let p = GameEngine.projectilePool.get();
                        p.init(s.x, s.y, s.damage, sTarget, s.dmgType === 'plasma' ? 'super' : 'nail', 600, s.pierce, 0.5, null, null, 5 * (j - (count-1)/2), tower, sDmgType);
                    }
                    s.cooldown = s.fireRate;
                }
            }
        }
        if (tower.stats.maxSentries > 0 && tower.sentries.length < tower.stats.maxSentries) {
            tower.sentryCooldown -= dt * spawnMod;
            if (tower.sentryCooldown <= 0) {
                tower.sentryCooldown = 5;
                let ang = Math.random() * Math.PI * 2; let dist = Math.random() * tower.stats.range * RANGE_SCALE * 0.8;
                let sX = tower.x + Math.cos(ang) * dist; let sY = tower.y + Math.sin(ang) * dist;
                let type = 'sharp'; let color = '#7f8c8d';
                if (tower.upgrades[0] >= 4 && tower.upgrades[0] < 5) {
                    const types = ['sharp', 'explosion', 'ice', 'energy']; type = types[tower.sentries.length % 4];
                    if (type === 'explosion') color = '#e67e22'; if (type === 'ice') color = '#1abc9c'; if (type === 'energy') color = '#f1c40f';
                }
                if (tower.upgrades[0] >= 5) { type = 'plasma'; color = '#9b59b6'; }
                tower.sentries.push({ x: sX, y: sY, range: 100 + (tower.stats.sentryRange || 0), life: 25, cooldown: 0, damage: tower.stats.sentryDmg || 1, pierce: tower.stats.sentryPierce || 2, fireRate: tower.stats.sentryFireRate || 0.6, dmgType: type, color: color, projCount: tower.stats.sentryProjCount ? 2 : 1, explode: tower.stats.sentryExplode || false });
            }
        }
        if (tower.stats.trapRbe > 0 && !tower.activeTrap) { let point = GameEngine.map.getNearestPathPoint(tower.x, tower.y); tower.activeTrap = { x: point.x, y: point.y, rbe: 0, maxRbe: tower.stats.trapRbe, moab: tower.stats.trapMoab || false }; }
        if (tower.activeTrap) {
            const trap = tower.activeTrap; const nearby = GameEngine.enemyGrid.query(trap.x, trap.y, 25);
            for (let e of nearby) {
                if (!e.alive) continue;
                if (Utils.distance(trap.x, trap.y, e.x, e.y) < 25 + e.data.radius) {
                    if (!e.data.isMoab || trap.moab) { if (trap.rbe + e.data.rbe <= trap.maxRbe) { trap.rbe += e.data.rbe; e.alive = false; GameEngine.spawnPopEffect(e.x, e.y, e.data.color); } else { trap.rbe = trap.maxRbe; } }
                }
            }
        }
        
        // PRO FIX: Removed tower.acquireAndFire(dt). The ECS System handles this automatically!
    },
    draw(ctx, tower, isPreview) {
        for (let s of tower.sentries) { drawShadow(ctx, s.x, s.y, 15); ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(s.x, s.y, 8, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#34495e'; ctx.fillRect(s.x-3, s.y-15, 6, 8); }
        if (tower.activeTrap) { let trap = tower.activeTrap; ctx.fillStyle = trap.rbe >= trap.maxRbe ? '#e74c3c' : '#e67e22'; ctx.fillRect(trap.x - 12, trap.y - 12, 24, 24); ctx.fillStyle = '#000'; ctx.font = '10px Arial'; ctx.textAlign = 'center'; ctx.fillText(`${trap.rbe}/${trap.maxRbe}`, trap.x, trap.y + 3); }
        tower.drawBaseTower(ctx, isPreview);
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        let p = GameEngine.projectilePool.get();
        p.init(tower.x, tower.y, damage, target, 'nail', tower.stats.projectileSpeed, tower.stats.pierce, 0.5, null, effects, 0, tower, dmgType);
    },
    ability(tower, engine) {
        let target = null; let maxCost = 0; let effRange = tower.stats.range * RANGE_SCALE * 3.0;
        for (let ot of engine.towers) { if (ot === tower || ot.type === 'farm' || ot.type === 'village') continue; if (Utils.distance(tower.x, tower.y, ot.x, ot.y) < effRange) { if (ot.totalSpent > maxCost) { maxCost = ot.totalSpent; target = ot; } } }
        if (target) { target.overclockTimer = 10; if (tower.upgrades[1] === 5) { target.ultraboostStacks = Math.min(10, (target.ultraboostStacks || 0) + 1); } engine.log("Overclock Activated on " + target.type + "!"); } 
        else { engine.log("No valid towers in range for Overclock!"); }
    }
};