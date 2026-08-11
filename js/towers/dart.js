import { GameEngine } from '../engine.js';
import Assets from '../assets.js';
import { drawImageCentered, Utils } from '../utils.js';
import { SpriteConfig } from '../spriteConfig.js';
import { GLOBAL_SCALE } from '../constants.js';
import { MobileManager } from '../mobile.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

export default {
    stats: {
        name: "Dart Monkey", cost: 200, range: 32,
        baseCooldown: 0.95, fireRate: 0.95,
        damage: 1, pierce: 2, projectileSpeed: 1000, 
        lifespan: 0.25, desc: "Shoots a single dart. Low range, but cheap.",
        dmgType: 'sharp', projectileType: 'dart', hitRadius: 18,
        projectileCount: 1,
        category: 'Primary'
    },
    upgrades: {
        1: [
            {name:"Sharp Shots", cost:140, stat:"pierce", amount:1, desc:"Can pop 1 extra Bloon per shot."},
            {name:"Razor Sharp Shots", cost:200, stat:"pierce", amount:2, desc:"Can pop 2 more bloons per shot."},
            {name:"Spike-o-pult", cost:320, stat:"projectileType", amount:"spike_opult", desc:"Hurls large spiked balls.", cooldownMult: 1.2105, extraMods:{damage:1, pierce:13, range:4.8, dmgType: 'shatter', projectileSpeed:500, lifespan:1.0, scale:1.2}},
            {name:"Juggernaut", cost:1800, stat:"projectileType", amount:"juggernaut", desc:"Giant spiked ball crushes Ceramics.", cooldownMult: 0.8695, extraMods:{damage:0, pierce:42, dmgType:'heavy', ceramicDmg:3, fortifiedDmg:2, canHitLead:true, scale:1.4, projectileSpeed:1000, lifespan:1.0}},
            {name:"Ultra-Juggernaut", cost:15000, stat:"projectileType", amount:"ultra_juggernaut", desc:"Gigantic spiked ball splits twice.", extraMods:{damage:3, pierce:150, ceramicDmg:5, fortifiedDmg:3, leadDmg:20, canHitLead:true, scale:1.6, projectileSpeed:1000, lifespan:1.0}}
        ],
        2: [
            {name:"Quick Shots", cost:100, desc:"Shoots 15% faster.", cooldownMult: 0.85},
            {name:"Very Quick Shots", cost:190, desc:"Shoots 33% faster!", cooldownMult: 0.7882},
            {name:"Triple Darts", cost:450, desc:"Throws 3 darts at a time.", cooldownMult: 0.75, extraMods: { projectileCount: 2 }},
            {name:"Super Monkey Fan Club", cost:7200, desc:"Ability: Converts up to 10 nearby Dart Monkeys into Super Monkeys.", cooldownMult: 0.5, extraMods: { unlocksAbility: true, abilityName: "Fan Club", abilityCd: 50 }},
            {name:"Plasma Monkey Fan Club", cost:45000, desc:"Ability: Transforms up to 21 Dart Monkeys into Plasma Monkeys.", extraMods: { unlocksAbility: true, abilityName: "Plasma Club", abilityCd: 50 }}
        ],
        3: [
            {name:"Long Range Darts", cost:90, stat:"range", amount:8, desc:"Shoots further than normal.", extraMods:{lifespan:0.3375}},
            {name:"Enhanced Eyesight", cost:200, stat:"canSeeCamo", amount:true, desc:"Shoots even further and detects Camo.", extraMods:{range:8, lifespan:0.3616, projectileSpeed:1100}},
            {name:"Crossbow", cost:575, stat:"damage", amount:2, desc:"Pops 3 layers of Bloon per hit.", extraMods:{pierce:2, range:12, projectileSpeed:1200, lifespan:0.3164, projectileType:"arrow"}},
            {name:"Sharp Shooter", cost:2050, desc:"Attacks faster and does powerful Crit shots.", cooldownMult: 0.5, extraMods: { damage: 3, critChance: 0.1, critDmg: 50, projectileSpeed: 2000, lifespan: 0.2109 }},
            {name:"Crossbow Master", cost:21500, desc:"Devastates most Bloon types with ease.", cooldownMult: 0.5, extraMods: { damage: 2, pierce: 4, range: 20, critChance: 0.2, critDmg: 80, dmgType: 'normal', projectileSpeed: 2000, lifespan: 0.2109 }}
        ]
    },
    
    canBuyTier5(tower, path, engine) {
        if (path === 3) { // Master Double crosspath limit
            const mk = engine.config.data.mkActive === false ? {} : (engine.config.data.monkeyKnowledge || {});
            if (mk['master_double']) {
                let count = 0;
                for(let t of engine.towers) { if(t && t.type === 'dart' && t.upgrades[2] === 5) count++; }
                if (count < 2) return true; 
            }
        }
        return false;
    },

    getPlacementCostModifier(stats, cost, engine) {
        if (!engine.isSandbox && engine.difficulty && !engine.difficulty.noSelling) {
            const mkActive = engine.config.data.mkActive !== false;
            const hasFreeMonkey = engine.config.data.unlocks.freeFirstDartMonkey || (mkActive && engine.config.data.monkeyKnowledge && engine.config.data.monkeyKnowledge.bonus_monkey);
            const hasNoDarts = !engine.towers.some(t => t.type === 'dart');
            const hasMonkeyCity = engine.towers.some(t => t && t.type === 'village' && t.upgrades[2] >= 4);

            if ((hasFreeMonkey && hasNoDarts) || (hasMonkeyCity && !engine.freeDartMonkeyClaimed)) {
                return 0;
            }
        }
        return cost;
    },

    ability(tower, engine) {
        let isPlasma = (tower.upgrades[1] === 5);
        let count = 0; let maxCount = isPlasma ? 21 : 10;
        tower.fanClubBuffTimer = 15; tower.fanClubType = isPlasma ? 'plasma' : 'super'; count++;
        for (let ot of engine.towers) {
            if (!ot || ot === tower || ot.type === 'farm' || ot.type === 'village') continue;
            if (ot.type === 'dart' && Utils.withinRange(tower.x, tower.y, ot.x, ot.y, 300)) {
                ot.fanClubBuffTimer = 15; ot.fanClubType = isPlasma ? 'plasma' : 'super'; count++;
                if (count >= maxCount) break;
            }
        }
        engine.log(isPlasma ? "Plasma Monkey Fan Club Activated!" : "Super Monkey Fan Club Activated!");
    },
    fire(tower, target, damage, dmgType, isCrit, effects) {
        let count = tower.stats.projectileCount || 1;
        let projType = tower.stats.projectileType;
        if (tower.fanClubBuffTimer > 0) {
            projType = tower.fanClubType === 'plasma' ? 'plasma' : 'super_dart';
        }
        for(let i=0; i<count; i++) {
            let p = GameEngine.projectilePool.get();
            p.init(tower.x, tower.y, damage, target, projType, tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, effects, 15 * (i - (count-1)/2), tower, dmgType, isCrit);
        }
    },
    draw(ctx, tower, isPreview) {
        const mScale = MobileManager.isActive ? MobileManager.spriteScale : 1.0;
        
        ctx.save(); ctx.translate(tower.x, tower.y);
        ctx.scale(mScale, mScale); // Scale the local coordinate system
        
        if (tower.fanClubBuffTimer > 0) {
            const s = (tower.stats.scale || 1.0) * GS;
            ctx.fillStyle = '#34495e'; ctx.beginPath(); ctx.arc(0, 0, 15 * s, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#D7BCA3'; ctx.beginPath(); ctx.arc(0, 2 * s, 10 * s, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#34495e'; ctx.beginPath(); ctx.arc(-12 * s, -8 * s, 5 * s, 0, Math.PI * 2); ctx.arc(12 * s, -8 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
            ctx.rotate(tower.angle);
            if (tower.fanClubType === 'plasma') { ctx.fillStyle = '#9b59b6'; ctx.fillRect(0, -4 * s, 20 * s, 8 * s); ctx.fillStyle = '#e74c3c'; ctx.fillRect(0, -2 * s, 15 * s, 4 * s); }
            else { ctx.fillStyle = '#34495e'; ctx.fillRect(0, -4 * s, 20 * s, 8 * s); ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.moveTo(20 * s, 0); ctx.lineTo(15 * s, -5 * s); ctx.lineTo(15 * s, 5 * s); ctx.fill(); }
            ctx.restore(); return;
        }

        const { baseAsset, armAsset, targetSize, isCustomBase } = tower.getActiveAssets();
        const catapultAsset = Assets.get('tower_dart_catapult');
        
        const getDrawParams = (key) => {
            let bestTier = 0, bestPath = 0;
            for (let p = 1; p <= 3; p++) {
                if (tower.upgrades[p - 1] > bestTier) { bestTier = tower.upgrades[p - 1]; bestPath = p; }
            }
            const configKey = bestTier > 0 ? `dart_p${bestPath}_t${bestTier}` : 'dart';
            const off = SpriteConfig[configKey]?.[key] || { x: 0, y: 0, scale: 1 };
            const size = 45 * (off.scale || 1) * GS;
            return { size, x: off.x || 0, y: off.y || 0 };
        };

        if (tower.attackAnimActive && tower.isFullAnim) {
            let animAsset = Assets.get(`${tower.attackPrefix}attack_full_${tower.attackAnimFrame}`);
            if (animAsset && animAsset.loaded) {
                const p = getDrawParams(`attack_full_${tower.attackAnimFrame}`);
                ctx.rotate(tower.angle + Math.PI / 2); 
                drawImageCentered(ctx, animAsset, p.size, p.x, p.y); 
                ctx.restore();
                
                if (!isCustomBase) { 
                    ctx.save(); ctx.translate(tower.x, tower.y); 
                    ctx.scale(mScale, mScale);
                    if (!isPreview && !tower.stats.isStaticRotation) ctx.rotate(tower.angle + Math.PI / 2); 
                    for (let i=1; i<=3; i++) { 
                        let t = tower.upgrades[i-1]; 
                        if (t > 0) { 
                            let ovAsset = Assets.get(`tower_dart_p${i}_t${t}`); 
                            if (ovAsset && ovAsset.loaded) { 
                                const op = getDrawParams('base'); 
                                drawImageCentered(ctx, ovAsset, op.size, op.x, op.y); 
                            } 
                        } 
                    } 
                    ctx.restore(); 
                }
                return;
            }
        }
        
        let activeArmAsset = armAsset;
        if (tower.attackAnimActive && !tower.isFullAnim) { 
            let animAsset = Assets.get(`${tower.attackPrefix}attack_${tower.attackAnimFrame}`); 
            if (animAsset && animAsset.loaded) { activeArmAsset = animAsset; } 
        }
        
        let useCustomBase = baseAsset && baseAsset.loaded && baseAsset !== Assets.get('tower_dart_base');
        if (tower.upgrades[0] >= 3 && !useCustomBase && catapultAsset && catapultAsset.loaded) { 
            const p = getDrawParams('base');
            ctx.rotate(tower.angle + Math.PI / 2); 
            drawImageCentered(ctx, catapultAsset, p.size, p.x, p.y); 
            ctx.restore(); return; 
        }
        
        if (baseAsset && baseAsset.loaded) {
            ctx.rotate(tower.angle + Math.PI / 2);
            
            if (activeArmAsset && activeArmAsset.loaded) {
                const armP = getDrawParams(tower.attackAnimFrame === 0 ? "arm" : `attack_${tower.attackAnimFrame}`);
                drawImageCentered(ctx, activeArmAsset, armP.size, armP.x, armP.y);
            }
            
            if (!isCustomBase) { 
                for (let i=1; i<=3; i++) { 
                    let t = tower.upgrades[i-1]; 
                    if (t > 0) { 
                        let ovAsset = Assets.get(`tower_dart_p${i}_t${t}_a`); 
                        if (ovAsset && ovAsset.loaded) { 
                            const op = getDrawParams('base'); 
                            drawImageCentered(ctx, ovAsset, op.size, op.x, op.y); 
                        } 
                    } 
                } 
            }
            
            const baseP = getDrawParams("base");
            drawImageCentered(ctx, baseAsset, baseP.size, baseP.x, baseP.y);
            
            if (!isCustomBase) { 
                for (let i=1; i<=3; i++) { 
                    let t = tower.upgrades[i-1]; 
                    if (t > 0) { 
                        let ovAsset = Assets.get(`tower_dart_p${i}_t${t}`); 
                        if (ovAsset && ovAsset.loaded) { 
                            const op = getDrawParams('base'); 
                            drawImageCentered(ctx, ovAsset, op.size, op.x, op.y); 
                        } 
                    } 
                } 
            }
            ctx.restore(); return;
        }
        
        ctx.restore();
    }
};
