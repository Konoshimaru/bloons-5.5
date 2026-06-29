// js/towers/dart.js
import { GameEngine } from '../engine.js';
import Assets from '../assets.js';
import { drawImageCentered, Utils } from '../utils.js';

export default {
    stats: { 
        name: "Dart Monkey", cost: 200, range: 32, 
        baseCooldown: 0.95, fireRate: 0.95, 
        damage: 1, pierce: 2, projectileSpeed: 350, 
        lifespan: 0.5, desc: "Shoots a single dart. Low range, but cheap.", 
        dmgType: 'sharp', projectileType: 'dart', hitRadius: 18, 
        projectileCount: 1 
    },
    upgrades: {
        1: [
            {name:"Sharp Shots", cost:140, stat:"pierce", amount:1, desc:"Can pop 1 extra Bloon per shot."},
            {name:"Razor Sharp Shots", cost:200, stat:"pierce", amount:2, desc:"Can pop 2 more bloons per shot."},
            {name:"Spike-o-pult", cost:320, stat:"projectileType", amount:"spike_opult", desc:"Hurls large spiked balls.", cooldownMult: 1.2105, extraMods:{damage:1, pierce:16, range:5, projectileSpeed:400, lifespan:0.8, scale:1.2}},
            {name:"Juggernaut", cost:1800, stat:"projectileType", amount:"juggernaut", desc:"Giant spiked ball crushes Ceramics.", cooldownMult: 0.8695, extraMods:{damage:0, pierce:42, dmgType:'heavy', bonusCeramic:3, fortifiedDmg:2, canHitLead:true, scale:1.4, projectileSpeed:800}},
            {name:"Ultra-Juggernaut", cost:15000, stat:"projectileType", amount:"ultra_juggernaut", desc:"Gigantic spiked ball splits twice.", extraMods:{damage:3, pierce:150, bonusCeramic:5, fortifiedDmg:3, canHitLead:true, scale:1.6, projectileSpeed:900}}
        ],
        2: [
            {name:"Quick Shots", cost:100, desc:"Shoots 15% faster.", cooldownMult: 0.85},
            {name:"Very Quick Shots", cost:190, desc:"Shoots 33% faster!", cooldownMult: 0.7843},
            {name:"Triple Darts", cost:430, desc:"Throws 3 darts at a time.", cooldownMult: 0.75, extraMods: { projectileCount: 2 }},
            {name:"Super Monkey Fan Club", cost:3200, desc:"Ability: Converts up to 10 nearby Dart Monkeys into Super Monkeys.", cooldownMult: 0.5, extraMods: { unlocksAbility: true, abilityName: "Fan Club", abilityCd: 45 }},
            {name:"Plasma Monkey Fan Club", cost:24000, desc:"Ability: Transforms up to 21 Dart Monkeys into Plasma Monkeys.", cooldownMult: 1.0, extraMods: { unlocksAbility: true, abilityName: "Plasma Club", abilityCd: 45 }}
        ],
        3: [
            {name:"Long Range Darts", cost:75, stat:"range", amount:8, desc:"Shoots further than normal.", extraMods:{lifespan:0.175}},
            {name:"Enhanced Eyesight", cost:200, stat:"canSeeCamo", amount:true, desc:"Shoots even further and detects Camo.", extraMods:{range:8, lifespan:0.125, projectileSpeed:60}},
            {name:"Crossbow", cost:575, stat:"damage", amount:2, desc:"Pops 3 layers of Bloon per hit.", extraMods:{pierce:1, range:12, projectileSpeed:100, projectileType:"arrow"}},
            {name:"Sharp Shooter", cost:2050, desc:"Attacks faster and does powerful Crit shots.", cooldownMult: 0.5, extraMods: { critChance: 0.1, critDmg: 50, range: 10 }},
            {name:"Crossbow Master", cost:21500, desc:"Devastates most Bloon types with ease.", cooldownMult: 0.5, extraMods: { damage: 2, pierce: 4, range: 20, critChance: 0.2, critDmg: 30, dmgType: 'sharp' }}
        ]
    },
    ability(tower, engine) {
        let isPlasma = (tower.upgrades[1] === 5); 
        let count = 0; let maxCount = isPlasma ? 21 : 10; 
        tower.fanClubBuffTimer = 15; tower.fanClubType = isPlasma ? 'plasma' : 'super'; count++;
        for (let ot of engine.towers) {
            if (!ot || ot === tower || ot.type === 'farm' || ot.type === 'village') continue;
            if (ot.type === 'dart' && Utils.distance(tower.x, tower.y, ot.x, ot.y) < 300) {
                ot.fanClubBuffTimer = 15; ot.fanClubType = isPlasma ? 'plasma' : 'super'; count++;
                if (count >= maxCount) break;
            }
        }
        engine.log(isPlasma ? "Plasma Monkey Fan Club Activated!" : "Super Monkey Fan Club Activated!");
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        let count = tower.stats.projectileCount || 1;
        
        // PRO FIX: Shoot super_darts when Fan Club is active
        let projType = tower.stats.projectileType;
        if (tower.fanClubBuffTimer > 0) {
            projType = tower.fanClubType === 'plasma' ? 'plasma' : 'super_dart';
        }
        
        for(let i=0; i<count; i++) {
            let p = GameEngine.projectilePool.get();
            p.init(tower.x, tower.y, damage, target, projType, tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, effects, 15 * (i - (count-1)/2), tower, dmgType);
            p.isCrit = isCrit;
        }
    },
    draw(ctx, tower, isPreview) {
        let dartOffsetX = 1; ctx.save(); ctx.translate(tower.x, tower.y); 
        if (tower.fanClubBuffTimer > 0) { 
            ctx.fillStyle = '#34495e'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#D7BCA3'; ctx.beginPath(); ctx.arc(0, 2, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#34495e'; ctx.beginPath(); ctx.arc(-12, -8, 5, 0, Math.PI * 2); ctx.arc(12, -8, 5, 0, Math.PI * 2); ctx.fill();
            ctx.rotate(tower.angle);
            if (tower.fanClubType === 'plasma') { ctx.fillStyle = '#9b59b6'; ctx.fillRect(0, -4, 20, 8); ctx.fillStyle = '#e74c3c'; ctx.fillRect(0, -2, 15, 4); } 
            else { ctx.fillStyle = '#34495e'; ctx.fillRect(0, -4, 20, 8); ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(15, -5); ctx.lineTo(15, 5); ctx.fill(); }
            ctx.restore(); return; 
        }
        const { baseAsset, armAsset, targetSize, isCustomBase } = tower.getActiveAssets();
        const catapultAsset = Assets.get('tower_dart_catapult');
        if (tower.attackAnimActive && tower.isFullAnim) {
            let animAsset = Assets.get(`${tower.attackPrefix}attack_full_${tower.attackAnimFrame}`);
            if (animAsset && animAsset.loaded) {
                ctx.rotate(tower.angle + Math.PI / 2); drawImageCentered(ctx, animAsset, targetSize, dartOffsetX, 0); ctx.restore();
                if (!isCustomBase) { ctx.save(); ctx.translate(tower.x, tower.y); for (let p=1; p<=3; p++) { let t = tower.upgrades[p-1]; if (t > 0) { let ovAsset = Assets.get(`tower_dart_p${p}_t${t}`); if (ovAsset && ovAsset.loaded) drawImageCentered(ctx, ovAsset, targetSize, dartOffsetX, 0); } } ctx.restore(); }
                return;
            }
        }
        let activeArmAsset = armAsset;
        if (tower.attackAnimActive && !tower.isFullAnim) { let animAsset = Assets.get(`${tower.attackPrefix}attack_${tower.attackAnimFrame}`); if (animAsset && animAsset.loaded) activeArmAsset = animAsset; }
        let useCustomBase = baseAsset && baseAsset.loaded && baseAsset !== Assets.get('tower_dart_base');
        if (tower.upgrades[0] >= 3 && !useCustomBase && catapultAsset && catapultAsset.loaded) { ctx.rotate(tower.angle + Math.PI / 2); drawImageCentered(ctx, catapultAsset, targetSize, dartOffsetX, 0); ctx.restore(); return; }
        if (baseAsset && baseAsset.loaded) {
            ctx.rotate(tower.angle + Math.PI / 2); 
            if (armAsset) drawImageCentered(ctx, activeArmAsset, targetSize, dartOffsetX, 0);
            if (!isCustomBase) { for (let p=1; p<=3; p++) { let t = tower.upgrades[p-1]; if (t > 0) { let ovAsset = Assets.get(`tower_dart_p${p}_t${t}_a`); if (ovAsset && ovAsset.loaded) drawImageCentered(ctx, ovAsset, targetSize, dartOffsetX, 0); } } }
            drawImageCentered(ctx, baseAsset, targetSize, dartOffsetX, 0);
            if (!isCustomBase) { for (let p=1; p<=3; p++) { let t = tower.upgrades[p-1]; if (t > 0) { let ovAsset = Assets.get(`tower_dart_p${p}_t${t}`); if (ovAsset && ovAsset.loaded) drawImageCentered(ctx, ovAsset, targetSize, dartOffsetX, 0); } } }
            ctx.restore(); return;
        }
        ctx.rotate(tower.angle);
        if (tower.upgrades[0] >= 3) { 
            let size = (tower.stats.scale || 1.0); if (tower.upgrades[0] === 4) size *= 1.3; if (tower.upgrades[0] === 5) size *= 1.6;
            ctx.fillStyle = '#8B4513'; ctx.fillRect(-10*size, 5*size, 20*size, 5*size);
            ctx.beginPath(); ctx.moveTo(-10*size, 5*size); ctx.lineTo(-15*size, 15*size); ctx.lineTo(-5*size, 15*size); ctx.fill();
            ctx.beginPath(); ctx.moveTo(10*size, 5*size); ctx.lineTo(15*size, 15*size); ctx.lineTo(5*size, 15*size); ctx.fill();
            ctx.save(); ctx.rotate(-Math.PI/4); ctx.fillStyle = '#8B4513'; ctx.fillRect(0, -2*size, 20*size, 4*size); ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.arc(20*size, 0, 8*size, 0, Math.PI*2); ctx.fill(); ctx.restore();
            ctx.restore(); return; 
        }
        let bodyColor = '#795548'; if (tower.upgrades[2] >= 4) bodyColor = '#2c3e50'; 
        ctx.fillStyle = bodyColor; ctx.beginPath(); ctx.arc(0, 0, 15 * (tower.stats.scale || 1.0), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#D7BCA3'; ctx.beginPath(); ctx.arc(0, 2, 10 * (tower.stats.scale || 1.0), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = bodyColor; ctx.beginPath(); ctx.arc(-12, -8, 5, 0, Math.PI * 2); ctx.arc(12, -8, 5, 0, Math.PI * 2); ctx.fill();
        if (tower.upgrades[2] >= 3) { ctx.strokeStyle = '#8B4513'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(15, 0); ctx.lineTo(0, 10); ctx.stroke(); ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(25, 0); ctx.stroke(); } 
        else { ctx.fillStyle = '#8B4513'; ctx.fillRect(0, -2, 15, 4); ctx.fillStyle = '#95a5a6'; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(10, -3); ctx.lineTo(10, 3); ctx.fill(); ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-5, -3); ctx.lineTo(-5, 3); ctx.fill(); }
        ctx.restore();
    }
};