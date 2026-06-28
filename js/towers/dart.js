// js/towers/dart.js
import { GameEngine } from '../engine.js';
import { Projectile } from '../projectile.js';
import Assets from '../assets.js';
import { drawImageCentered, Utils } from '../utils.js';

export default {
    // BASE STATS: Exactly matches BTD6 base Dart Monkey.
    stats: { 
        name: "Dart Monkey", cost: 200, range: 32, fireRate: 0.95, damage: 1, pierce: 2, projectileSpeed: 350, 
        lifespan: 0.5, desc: "Shoots a single dart. Low range, but cheap.", 
        dmgType: 'sharp', projectileType: 'dart', hitRadius: 18, 
        // IMPORTANT: projectileCount MUST be explicitly 1 here. 
        // If undefined, JS math treats (undefined + 2) as NaN, breaking Triple Shot.
        projectileCount: 1 
    },
    upgrades: {
        // PATH 1: Sharp Shots -> Spike-o-pult -> Juggernaut
        1: [
            {name:"Sharp Shots", cost:140, stat:"pierce", amount:1, desc:"Can pop 1 extra Bloon per shot."},
            {name:"Razor Sharp Shots", cost:200, stat:"pierce", amount:2, desc:"Can pop 2 more bloons per shot."},
            {name:"Spike-o-pult", cost:320, stat:"projectileType", amount:"spike_opult", desc:"Hurls large spiked balls.", extraMods:{damage:1, pierce:16, fireRate:1.15, range:5, projectileSpeed:400, lifespan:0.8, scale:1.2}},
            {name:"Juggernaut", cost:1800, stat:"projectileType", amount:"juggernaut", desc:"Giant spiked ball crushes Ceramics.", extraMods:{damage:0, pierce:42, fireRate:0.85, dmgType:'heavy', bonusCeramic:3, fortifiedDmg:2, canHitLead:true, scale:1.4, projectileSpeed:800}},
            {name:"Ultra-Juggernaut", cost:15000, stat:"projectileType", amount:"ultra_juggernaut", desc:"Gigantic spiked ball splits twice.", extraMods:{damage:3, pierce:150, bonusCeramic:5, fortifiedDmg:3, canHitLead:true, scale:1.6, projectileSpeed:900}}
        ],
        // PATH 2: Quick Shots -> Fan Club
        2: [
            {name:"Quick Shots", cost:100, stat:"fireRate", amount:-0.1425, desc:"Shoots 15% faster."},
            {name:"Very Quick Shots", cost:190, stat:"fireRate", amount:-0.1745, desc:"Shoots 33% faster!"},
            {name:"Triple Shot", cost:450, stat:"projectileCount", amount:2, desc:"Throws 3 darts at a time.", extraMods:{fireRate:-0.15825}},
            // Ability CD is 50s. The engine automatically starts it on 2/3 cooldown (33.3s) when bought.
            {name:"Super Monkey Fan Club", cost:7200, stat:"fireRate", amount:-0.23475, desc:"Ability: Converts up to 10 nearby Dart Monkeys into Super Monkeys.", extraMods:{unlocksAbility:true, abilityName:"Fan Club", abilityCd:50}},
            {name:"Plasma Monkey Fan Club", cost:45000, stat:"damage", amount:1, desc:"Ability: Transforms up to 21 Dart Monkeys into Plasma Monkeys.", extraMods:{unlocksAbility:true, abilityName:"Plasma Club", abilityCd:50}}
        ],
        // PATH 3: Long Range -> Crossbow -> Crossbow Master
        3: [
            {name:"Long Range Darts", cost:90, stat:"range", amount:8, desc:"Shoots further than normal.", extraMods:{lifespan:0.175}},
            {name:"Enhanced Eyesight", cost:200, stat:"canSeeCamo", amount:true, desc:"Shoots even further and detects Camo.", extraMods:{range:8, lifespan:0.125, projectileSpeed:60}},
            {name:"Crossbow", cost:575, stat:"damage", amount:2, desc:"Pops 3 layers of Bloon per hit.", extraMods:{pierce:1, range:12, projectileSpeed:100, projectileType:"arrow"}},
            {name:"Sharp Shooter", cost:2050, stat:"fireRate", amount:-0.475, desc:"Attacks faster and does powerful Crit shots.", extraMods:{damage:3, critChance:0.1, critDmg:50, range:10}},
            {name:"Crossbow Master", cost:21500, stat:"fireRate", amount:-0.2375, desc:"Devastates most Bloon types with ease.", extraMods:{damage:2, pierce:4, range:20, critChance:0.2, critDmg:30, dmgType:'sharp'}}
        ]
    },
    
    // ABILITY: Fan Club logic (BTD6 Accurate)
    ability(tower, engine) {
        let isPlasma = (tower.upgrades[1] === 5); // Path 2 Tier 5
        let maxCount = isPlasma ? 21 : 10; // Super=10, Plasma=21
        
        // Buff the caster first
        tower.fanClubBuffTimer = 15; // Lasts 15 seconds
        tower.fanClubType = isPlasma ? 'plasma' : 'super';
        let transformedCount = 1;
        
        // Find valid nearby Dart Monkeys
        let validTargets = [];
        for (let ot of engine.towers) {
            if (!ot || ot === tower || ot.type !== 'dart') continue;
            
            // Target Restrictions: Disallow Path 1 (Catapults) and Path 3 (Crossbows)
            if (ot.upgrades[0] >= 3 || ot.upgrades[2] >= 3) continue;
            // Disallow other Fan Club leaders
            if (ot.upgrades[1] >= 4) continue;
            
            let dist = Utils.distance(tower.x, tower.y, ot.x, ot.y);
            // BTD6 range for Fan Club is roughly 100px, but we use 300px to make it useful in our engine
            if (dist < 300) {
                validTargets.push({ t: ot, d: dist });
            }
        }
        
        // Sort by nearest (closest to caster come first)
        validTargets.sort((a, b) => a.d - b.d);
        
        // Transform the nearest ones up to the cap
        for (let v of validTargets) {
            if (transformedCount >= maxCount) break;
            v.t.fanClubBuffTimer = 15;
            v.t.fanClubType = isPlasma ? 'plasma' : 'super';
            transformedCount++;
        }
        
        engine.log(isPlasma ? "Plasma Monkey Fan Club Activated!" : "Super Monkey Fan Club Activated!");
    },

    // FIRE LOGIC: Handles Fan Club transformations, standard darts, and crossbow arrows
    fire(tower, target, damage, dmgType, isCrit, effects) {
        // FAN CLUB OVERRIDE: If transformed, ignore normal upgrades and shoot Super/Plasma blasts!
        if (tower.fanClubBuffTimer > 0) {
            let isPlasma = tower.fanClubType === 'plasma';
            let dmg = isPlasma ? 2 : 1;           // Plasma: 2 dmg. Super: 1 dmg.
            let pierce = isPlasma ? 5 : 1;        // Plasma: 5 pierce. Super: 1 pierce.
            let projType = 'super';               // Uses the Super Monkey dart sprite
            let fanDmgType = isPlasma ? { isPlasma: true, canHitLead: true } : { isSharp: true };
            
            let p = new Projectile(tower.x, tower.y, dmg, target, projType, 800, pierce, 0.4, null, effects, 0, tower, fanDmgType);
            GameEngine.projectiles.push(p);
            return;
        }

        // Standard Firing Logic
        let count = tower.stats.projectileCount || 1;
        for(let i=0; i<count; i++) {
            // Angle offset creates the spread for Triple Shot
            let p = new Projectile(tower.x, tower.y, damage, target, tower.stats.projectileType, tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, effects, 15 * (i - (count-1)/2), tower, dmgType);
            p.isCrit = isCrit;
            GameEngine.projectiles.push(p);
        }
    },

    // DRAW LOGIC: Handles Sprites, Catapult fallback, and Fan Club transformation visuals
    draw(ctx, tower, isPreview) {
        let dartOffsetX = 1;
        ctx.save(); ctx.translate(tower.x, tower.y); 
        
        // Fan Club Transformation Visual
        if (tower.fanClubBuffTimer > 0) { 
            ctx.fillStyle = '#34495e'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#D7BCA3'; ctx.beginPath(); ctx.arc(0, 2, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#34495e'; ctx.beginPath(); ctx.arc(-12, -8, 5, 0, Math.PI * 2); ctx.arc(12, -8, 5, 0, Math.PI * 2); ctx.fill();
            ctx.rotate(tower.angle);
            // Plasma vs Super visual
            if (tower.fanClubType === 'plasma') {
                ctx.fillStyle = '#9b59b6'; ctx.fillRect(0, -4, 20, 8); ctx.fillStyle = '#e74c3c'; ctx.fillRect(0, -2, 15, 4);
            } else {
                ctx.fillStyle = '#34495e'; ctx.fillRect(0, -4, 20, 8); ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(15, -5); ctx.lineTo(15, 5); ctx.fill();
            }
            ctx.restore(); return; 
        }

        const { baseAsset, armAsset, targetSize, isCustomBase } = tower.getActiveAssets();
        const catapultAsset = Assets.get('tower_dart_catapult');

        // Attempt to draw Full Body Animation
        if (tower.attackAnimActive && tower.isFullAnim) {
            let animAsset = Assets.get(`${tower.attackPrefix}attack_full_${tower.attackAnimFrame}`);
            if (animAsset && animAsset.loaded) {
                ctx.rotate(tower.angle + Math.PI / 2);
                drawImageCentered(ctx, animAsset, targetSize, dartOffsetX, 0);
                ctx.restore();
                if (!isCustomBase) {
                    ctx.save(); ctx.translate(tower.x, tower.y);
                    for (let p=1; p<=3; p++) {
                        let t = tower.upgrades[p-1];
                        if (t > 0) {
                            let ovAsset = Assets.get(`tower_dart_p${p}_t${t}`);
                            if (ovAsset && ovAsset.loaded) drawImageCentered(ctx, ovAsset, targetSize, dartOffsetX, 0);
                        }
                    }
                    ctx.restore();
                }
                return;
            }
        }

        // Attempt to draw Arm Animation
        let activeArmAsset = armAsset;
        if (tower.attackAnimActive && !tower.isFullAnim) {
            let animAsset = Assets.get(`${tower.attackPrefix}attack_${tower.attackAnimFrame}`);
            if (animAsset && animAsset.loaded) activeArmAsset = animAsset;
        }

        let useCustomBase = baseAsset && baseAsset.loaded && baseAsset !== Assets.get('tower_dart_base');
        
        // Catapult Sprite Fallback (Spike-o-pult+)
        if (tower.upgrades[0] >= 3 && !useCustomBase && catapultAsset && catapultAsset.loaded) {
            ctx.rotate(tower.angle + Math.PI / 2); 
            drawImageCentered(ctx, catapultAsset, targetSize, dartOffsetX, 0);
            ctx.restore(); return;
        }
        
        // Standard Sprite Drawing
        if (baseAsset && baseAsset.loaded) {
            ctx.rotate(tower.angle + Math.PI / 2); 
            if (armAsset) drawImageCentered(ctx, activeArmAsset, targetSize, dartOffsetX, 0);
            if (!isCustomBase) {
                for (let p=1; p<=3; p++) {
                    let t = tower.upgrades[p-1];
                    if (t > 0) {
                        let ovAsset = Assets.get(`tower_dart_p${p}_t${t}_a`);
                        if (ovAsset && ovAsset.loaded) drawImageCentered(ctx, ovAsset, targetSize, dartOffsetX, 0);
                    }
                }
            }
            drawImageCentered(ctx, baseAsset, targetSize, dartOffsetX, 0);
            if (!isCustomBase) {
                for (let p=1; p<=3; p++) {
                    let t = tower.upgrades[p-1];
                    if (t > 0) {
                        let ovAsset = Assets.get(`tower_dart_p${p}_t${t}`);
                        if (ovAsset && ovAsset.loaded) drawImageCentered(ctx, ovAsset, targetSize, dartOffsetX, 0);
                    }
                }
            }
            ctx.restore(); 
            return;
        }

        // Vector Fallback Drawing (If no sprites exist)
        ctx.rotate(tower.angle);
        if (tower.upgrades[0] >= 3) { 
            let size = (tower.stats.scale || 1.0);
            if (tower.upgrades[0] === 4) size *= 1.3;
            if (tower.upgrades[0] === 5) size *= 1.6;
            ctx.fillStyle = '#8B4513'; ctx.fillRect(-10*size, 5*size, 20*size, 5*size);
            ctx.beginPath(); ctx.moveTo(-10*size, 5*size); ctx.lineTo(-15*size, 15*size); ctx.lineTo(-5*size, 15*size); ctx.fill();
            ctx.beginPath(); ctx.moveTo(10*size, 5*size); ctx.lineTo(15*size, 15*size); ctx.lineTo(5*size, 15*size); ctx.fill();
            ctx.save(); ctx.rotate(-Math.PI/4);
            ctx.fillStyle = '#8B4513'; ctx.fillRect(0, -2*size, 20*size, 4*size);
            ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.arc(20*size, 0, 8*size, 0, Math.PI*2); ctx.fill();
            ctx.restore();
            ctx.restore(); return; 
        }
        
        let bodyColor = '#795548';
        if (tower.upgrades[2] >= 4) bodyColor = '#2c3e50'; // Sharp Shooter dark color
        ctx.fillStyle = bodyColor; ctx.beginPath(); ctx.arc(0, 0, 15 * (tower.stats.scale || 1.0), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#D7BCA3'; ctx.beginPath(); ctx.arc(0, 2, 10 * (tower.stats.scale || 1.0), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = bodyColor; ctx.beginPath(); ctx.arc(-12, -8, 5, 0, Math.PI * 2); ctx.arc(12, -8, 5, 0, Math.PI * 2); ctx.fill();
        
        if (tower.upgrades[2] >= 3) { 
            // Crossbow vector
            ctx.strokeStyle = '#8B4513'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(15, 0); ctx.lineTo(0, 10); ctx.stroke(); 
            ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(25, 0); ctx.stroke(); 
        }
        else { 
            // Standard Dart vector
            ctx.fillStyle = '#8B4513'; ctx.fillRect(0, -2, 15, 4); 
            ctx.fillStyle = '#95a5a6'; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(10, -3); ctx.lineTo(10, 3); ctx.fill(); 
            ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-5, -3); ctx.lineTo(-5, 3); ctx.fill(); 
        }
        ctx.restore();
    }
};