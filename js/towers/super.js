// super.js
// Defines the Super tower and its upgraded combat behavior.

import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { TowerStats } from './index.js'; 
import { GLOBAL_SCALE } from '../constants.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

export default {
    stats: { 
        name: "Super Monkey", cost: 2500, range: 50, 
        baseCooldown: 0.045, fireRate: 0.045, 
        damage: 1, pierce: 1, projectileSpeed: 800, 
        lifespan: 0.5, desc: "Shoots incredibly fast. Does not pop Lead or Camo by default.", 
        dmgType: 'sharp', projectileType: 'super_dart', hitRadius: 18,
        category: 'Magic' 
    },
    upgrades: {
        1: [
            {name:"Laser Blasts", cost:2000, stat:"dmgType", amount:'energy', desc:"Shoots powerful blasts of laser instead of darts. Pops frozen, cannot pop purple or lead.", extraMods:{projectileType:'laser', pierce:1}},
            {name:"Plasma Blasts", cost:2500, stat:"dmgType", amount:'plasma', desc:"Plasma vaporizes almost everything it touches. Attacks 1.5x faster.", extraMods:{projectileType:'plasma', cooldownMult:0.66, canHitLead:true}},
            {name:"Sun Avatar", cost:20000, stat:"damage", amount:2, desc:"Channels power from the core of the Sun. Shoots 3 sunbeams in a cone.", extraMods:{projectileCount:3, pierce:5}},
            {name:"Sun Temple", cost:100000, stat:"damage", amount:2, desc:"Tower sacrifices enhance and modify the Temple's attacks. Base: 5 dmg, 20 pierce.", extraMods:{pierce:15, dmgType:'normal', projectileType:'sun_ball'}},
            {name:"True Sun God", cost:500000, stat:"damage", amount:5, desc:"Tremble before the AWESOME power of the TRUE Sun God!! Base: 10 dmg, 50 pierce.", extraMods:{pierce:30, range:20, projectileCount:3, dmgType:'normal', projectileType:'sun_ball'}}
        ],
        2: [
            {name:"Super Range", cost:1500, stat:"range", amount:10, desc:"Super Monkeys need Super Range.", extraMods:{pierce:1}},
            {name:"Epic Range", cost:1900, stat:"range", amount:12, desc:"Why settle for super when you can have EPIC?", extraMods:{pierce:2, projectileSpeed:600}}, // +600 to base 800 = 1400 (+75%)
            {name:"Robo Monkey", cost:7500, stat:"projectileCount", amount:2, desc:"Half Super Monkey, half killer robot of death. Shoots from 2 guns and can crit!", extraMods:{canCrit:true, critChance:0.06, critDmg:10, pierce:2}},
            {name:"Tech Terror", cost:25000, stat:"dmgType", amount:'plasma', desc:"Annihilation ability: Destroys most Bloons completely within blast radius.", extraMods:{projectileType:'plasma', pierce:3, isAbility:true, abilityName:"Annihilate", abilityCd:40}},
            {name:"The Anti-Bloon", cost:70000, stat:"damage", amount:4, desc:"<Program Directive> <Eradicate Bloons> <INITIATE>", extraMods:{pierce:5, range:10, isAbility:true, abilityName:"Annihilate 2.0", abilityCd:30, critChance:0.07, critDmg:50, dmgType:'normal', canHitLead:true}}
        ],
        3: [
            {name:"Knockback", cost:3000, stat:"dmgType", amount:'sharp', desc:"Bloons get pushed backwards or slowed after each hit.", extraMods:{knockback:25, slow:0.4, slowDuration:0.5}},
            {name:"Ultravision", cost:1200, stat:"canSeeCamo", amount:true, desc:"Enables Super Monkey to shoot slightly further, see and do more damage to Camo Bloons.", extraMods:{range:3, camoDmg:1}},
            {name:"Dark Knight", cost:5600, stat:"dmgType", amount:'plasma', desc:"Dark blades increase knockback and pierce and deal extra damage to MOAB-class Bloons. Gains Darkshift ability.", extraMods:{projectileType:'dark_blade', moabDmg:2, pierce:3, slow:0.1, slowDuration:0.5, isAbility:true, abilityName:"Darkshift", abilityCd:15}},
            {name:"Dark Champion", cost:55555, stat:"damage", amount:1, desc:"Champion dark blades excel at puncturing and ruining all Bloon types. Darkshift ability extends mapwide.", extraMods:{camoDmg:1, moabDmg:1, ceramicDmg:2, cooldownMult:0.5, pierce:4, canHitLead:true}},
            {name:"Legend of the Night", cost:165650, stat:"damage", amount:8, desc:"We turn to him, when all hope is lost... Unlocks Portal ability.", extraMods:{pierce:15, moabDmg:16, ceramicDmg:2, camoDmg:2, isAbility2:true, abilityName:"Portal", abilityCd2:90}}
        ]
    },

    // FIX: Hook to determine if secondary targeting row should be visible
    hasSecondaryTargeting(tower) {
        return tower.upgrades[1] >= 3; // Robo Monkey gets a second targeting arm
    },

    postUpgrade(tower, path) {
        if (path === 1 && tower.upgrades[0] === 4) {
            this._performSacrifice(tower, false);
        } else if (path === 1 && tower.upgrades[0] === 5) {
            this._performSacrifice(tower, true);
        }
    },

    _performSacrifice(tower, isTrueSunGod) {
        const range = Utils.getEffectiveRange(tower, GameEngine);
        const inRange = GameEngine.towers.filter(t => t !== tower && !t.stats.isHero && Utils.distanceSq(tower.x, tower.y, t.x, t.y) < range * range);
        
        const categoryMap = {
            dart: 'Primary', tack: 'Primary', ice: 'Primary', bomb: 'Primary', boomerang: 'Primary', glue: 'Primary',
            sniper: 'Military', sub: 'Military', buccaneer: 'Military', ace: 'Military', heli: 'Military', mortar: 'Military', dartling: 'Military',
            wizard: 'Magic', super: 'Magic', ninja: 'Magic', alchemist: 'Magic', druid: 'Magic',
            farm: 'Support', spike: 'Support', village: 'Support', engineer: 'Support'
        };

        const sacrifices = { Primary: 0, Military: 0, Magic: 0, Support: 0 };
        let totalSacrificed = 0;

        for (const t of inRange) {
            const cat = categoryMap[t.type] || TowerStats[t.type]?.category || 'Primary';
            const cost = t.totalSpent || 0;
            sacrifices[cat] += cost;
            totalSacrificed += cost;
        }

        const sortedCats = Object.entries(sacrifices).filter(([k, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);

        for (const t of inRange) {
            const idx = GameEngine.towers.indexOf(t);
            if (idx > -1) GameEngine.towers.splice(idx, 1);
            if (GameEngine.selectedPlacedTower === t) GameEngine.deselectAll();
            GameEngine.spawnPopEffect(t.x, t.y, '#f1c40f');
        }

        if (totalSacrificed === 0) return;

        for (const [cat, amount] of sortedCats) {
            this._applySacrificeBuffs(tower, cat, amount, isTrueSunGod);
        }

        GameEngine.log(`${isTrueSunGod ? "True Sun God" : "Sun Temple"} absorbed $${totalSacrificed} worth of towers!`);
        GameEngine.updateUI();
    },

    _applySacrificeBuffs(tower, cat, amount, isTrueSunGod) {
        const tsgMult = isTrueSunGod ? 2 : 1; 
        const amt = amount * tsgMult;
        const statMult = isTrueSunGod ? 2 : 1; 

        if (cat === 'Primary') {
            if (amt > 50000) {
                tower._cooldownMult *= 0.6;
                tower.stats.pierce += 10;
                tower.stats.damage += 5 * statMult;
                tower.priGlaive = { dmg: 150 * statMult, pierce: 50, cd: 0.5, timer: 0 };
                tower.priBlade = { dmg: 250 * statMult, pierce: 200, cd: 1.5, timer: 0 };
            } else if (amt > 30000) {
                tower._cooldownMult *= 0.7;
                tower.priGlaive = { dmg: 100 * statMult, pierce: 50, cd: 0.8, timer: 0 };
                tower.priBlade = { dmg: 100 * statMult, pierce: 100, cd: 2.0, timer: 0 };
            } else if (amt > 10000) {
                tower.priGlaive = { dmg: 50 * statMult, pierce: 50, cd: 1.3, timer: 0 };
            }
        } else if (cat === 'Military') {
            if (amt > 50000) {
                tower.stats.projectileSpeed *= 1.45;
                tower.stats.pierce += 10;
                tower.milMissile = { dmg: 1 * statMult, moabDmg: 1999 * statMult, pierce: 40, cd: 1.0, timer: 0 };
                tower.milSpectre = { cd: 0.15, timer: 0, count: 2 * statMult, dartDmg: 25 * statMult, bombDmg: 10 * statMult };
            } else if (amt > 30000) {
                tower.stats.projectileSpeed *= 1.36;
                tower.stats.damage += 2 * statMult;
                tower.milMissile = { dmg: 2000 * statMult, pierce: 40, cd: 3.0, timer: 0 };
                tower.milSpectre = { cd: 0.15, timer: 0, count: 1 * statMult, dartDmg: 25 * statMult, bombDmg: 10 * statMult };
            } else if (amt > 10000) {
                tower.stats.projectileSpeed *= 1.12;
                tower.stats.damage += 2 * statMult;
                tower.milMissile = { dmg: 2000 * statMult, pierce: 40, cd: 12.0, timer: 0 };
            }
        } else if (cat === 'Magic') {
            if (amt > 50000) {
                tower.stats.pierce += 10;
                tower.magArcane = { dmg: 70 * statMult, pierce: 15, cd: 2.0, count: 6, timer: 0 };
                tower.magDistraction = 0.2;
                tower.magStorm = { cd: 5.0, timer: 0, pierce: 500, affectsBFB: true };
                tower.magMiniAvatar = { cd: 0.03, timer: 0 };
            } else if (amt > 30000) {
                tower.stats.pierce += 5;
                tower.magArcane = { dmg: 60 * statMult, pierce: 15, cd: 2.0, count: 4, timer: 0 };
                tower.magDistraction = 0.1;
                tower.magStorm = { cd: 5.0, timer: 0, pierce: 500, affectsBFB: false };
            } else if (amt > 10000) {
                tower.magArcane = { dmg: 40 * statMult, pierce: 15, cd: 2.0, count: 4, timer: 0 };
            }
        } else if (cat === 'Support') {
            tower.stats.range += 5;
            if (amt > 50000) {
                tower.supRoundCash = 5000 * statMult;
                tower.supBuff = { dmg: 2 * statMult, cdMult: 0.81, pierce: 3, rangeMult: 1.2 };
                tower.supDiscount = 0.2;
            } else if (amt > 30000) {
                tower.supRoundCash = 2000 * statMult;
                tower.supBuff = { dmg: 1 * statMult, cdMult: 0.9, pierce: 3, rangeMult: 1.2 };
                tower.supDiscount = 0.1;
            } else if (amt > 10000) {
                tower.supRoundCash = 500 * statMult;
            }
        }
    },

    update(tower, dt, engine) {
        // Support Sacrifice: Generate passive income
        if (tower.supRoundCash > 0) {
            tower.supCashTimer = (tower.supCashTimer || 0) + dt;
            if (tower.supCashTimer >= 15) {
                tower.supCashTimer = 0;
                engine.addCash(tower.supRoundCash);
                engine.spawnPopEffect(tower.x, tower.y - 30, '#f1c40f');
            }
        }

        // Support Sacrifice: Buff nearby towers
        if (tower.supBuff) {
            const range = Utils.getEffectiveRange(tower, engine);
            for (const t of engine.towers) {
                if (t !== tower && Utils.distanceSq(tower.x, tower.y, t.x, t.y) < range * range) {
                    t.buffedDmg = Math.max(t.buffedDmg || 0, tower.supBuff.dmg);
                    t.buffedPierce = Math.max(t.buffedPierce || 0, tower.supBuff.pierce);
                    t.buffedRange = Math.max(t.buffedRange || 0, tower.supBuff.rangeMult - 1);
                    t.buffedFireRate = Math.max(t.buffedFireRate || 0, (1 / tower.supBuff.cdMult) - 1);
                }
            }
        }

        // Primary Sacrifice: Golden Glaive
        if (tower.priGlaive) {
            tower.priGlaive.timer -= dt;
            if (tower.priGlaive.timer <= 0) {
                tower.priGlaive.timer = tower.priGlaive.cd;
                const target = engine.enemies.find(e => e.alive);
                if (target) {
                    const p = engine.projectilePool.get();
                    p.init(tower.x, tower.y, tower.priGlaive.dmg, target, 'boomerang', 600, tower.priGlaive.pierce, 2.0, null, {}, 0, tower, {isSharp: true, canHitLead: true});
                }
            }
        }

        // Primary Sacrifice: Blade Shooter
        if (tower.priBlade) {
            tower.priBlade.timer -= dt;
            if (tower.priBlade.timer <= 0) {
                tower.priBlade.timer = tower.priBlade.cd;
                for(let i=0; i<8; i++) {
                    const p = engine.projectilePool.get();
                    p.init(tower.x, tower.y, tower.priBlade.dmg, null, 'tack', 500, tower.priBlade.pierce, 1.0, (i/8)*Math.PI*2, {}, 0, tower, {isSharp: true, canHitLead: true});
                }
            }
        }

        // Military Sacrifice: Ballistic Missile
        if (tower.milMissile) {
            tower.milMissile.timer -= dt;
            if (tower.milMissile.timer <= 0) {
                let best = null; let maxRbe = -1;
                for(const e of engine.enemies) {
                    if (e.alive && e.data.isMoab && e.data.rbe > maxRbe) { maxRbe = e.data.rbe; best = e; }
                }
                if (best) {
                    tower.milMissile.timer = tower.milMissile.cd;
                    const p = engine.projectilePool.get();
                    const dmgType = { isExplosion: true, canHitLead: true, moabDmg: tower.milMissile.moabDmg || 0 };
                    p.init(tower.x, tower.y, tower.milMissile.dmg, best, 'bomb', 1000, tower.milMissile.pierce, 5.0, null, {isExplosive: true, explosionRadius: 60, canHitLead: true}, 0, tower, dmgType);
                }
            }
        }

        // Military Sacrifice: Golden Spectre
        if (tower.milSpectre) {
            tower.milSpectre.timer -= dt;
            if (tower.milSpectre.timer <= 0) {
                tower.milSpectre.timer = tower.milSpectre.cd;
                for (let i = 0; i < tower.milSpectre.count; i++) {
                    const target = engine.enemies[Math.floor(Math.random() * engine.enemies.length)];
                    if (target && target.alive) {
                        let p1 = engine.projectilePool.get();
                        p1.init(tower.x, tower.y, tower.milSpectre.dartDmg, target, 'dart', 800, 6, 1.0, null, {}, 0, tower, {isSharp: true});
                        
                        let p2 = engine.projectilePool.get();
                        p2.init(tower.x, tower.y, tower.milSpectre.bombDmg, target, 'bomb', 800, 30, 1.0, null, {isExplosive: true, explosionRadius: 40, ceramicDmg: 20, canHitLead: true}, 0, tower, {isExplosion: true, canHitLead: true});
                    }
                }
            }
        }

        // Magic Sacrifice: Arcane Blast
        if (tower.magArcane) {
            tower.magArcane.timer -= dt;
            if (tower.magArcane.timer <= 0) {
                tower.magArcane.timer = tower.magArcane.cd;
                for (let i=0; i<tower.magArcane.count; i++) {
                    const target = engine.enemies[Math.floor(Math.random() * engine.enemies.length)];
                    if (target && target.alive) {
                        const p = engine.projectilePool.get();
                        p.init(tower.x, tower.y, tower.magArcane.dmg, target, 'wizard_bolt', 600, tower.magArcane.pierce, 2.0, null, {}, 0, tower, {isEnergy: true, canHitLead: true});
                    }
                }
            }
        }

        // Magic Sacrifice: Storm Blast
        if (tower.magStorm) {
            tower.magStorm.timer -= dt;
            if (tower.magStorm.timer <= 0) {
                tower.magStorm.timer = tower.magStorm.cd;
                const nearby = engine.enemyGrid.query(tower.x, tower.y, Utils.getEffectiveRange(tower, engine));
                let hits = 0;
                for (const e of nearby) {
                    if (e.alive && hits < tower.magStorm.pierce) {
                        if (e.data.isMoab && (!tower.magStorm.affectsBFB || !e.data.isBFB)) continue;
                        e.distanceTraveled -= 50; 
                        hits++;
                    }
                }
                engine.explosions.push({ x: tower.x, y: tower.y, radius: 0, maxRadius: 100, life: 0.3, maxLife: 0.3, color: '#9b59b6' });
            }
        }

        // Magic Sacrifice: Mini Sun Avatars
        if (tower.magMiniAvatar) {
            tower.magMiniAvatar.timer -= dt;
            if (tower.magMiniAvatar.timer <= 0) {
                tower.magMiniAvatar.timer = 0.03;
                for(let i=0; i<3; i++) {
                    const target = engine.enemies[Math.floor(Math.random() * engine.enemies.length)];
                    if (target && target.alive) {
                        const p = engine.projectilePool.get();
                        const dmgMult = tower.upgrades[0] === 5 ? 2 : 1;
                        p.init(tower.x + (i-1)*20, tower.y + (i-1)*20, 4 * dmgMult, target, 'plasma', 800, 6, 0.5, null, {}, 15 * (i - 1), tower, {isPlasma: true, canHitLead: true});
                    }
                }
            }
        }
    },

    _findSecondTarget(tower, engine, primaryTarget) {
        const scale = 3.0; // RANGE_SCALE
        const baseRange = typeof tower.stats.range === 'number' ? tower.stats.range : 100;
        const buffMult = typeof tower.buffedRange === 'number' ? tower.buffedRange : 0;
        const alchRange = tower.alchBuff ? tower.alchBuff.range : 0;
        
        const nightMod = 1.0 - (0.5 * (engine.nightAlpha || 0));
        const effRange = baseRange === 9999 ? 9999 : baseRange * scale * (1 + buffMult + alchRange) * nightMod * GS;
        const effRangeSq = effRange * effRange;
        
        let mode = tower.targetingMode2 || 'First';
        let best = null;
        let bestVal = (mode === 'First' || mode === 'Strong') ? -Infinity : Infinity;
        
        for (const e of engine.enemies) {
            if (!e.alive || e === primaryTarget) continue;
            if (e.isCamo && !tower.stats.canSeeCamo && !tower.buffedCamo) continue; 
            
            const distSq = Utils.distanceSq(tower.x, tower.y, e.x, e.y);
            if (baseRange !== 9999 && distSq > effRangeSq) continue;
            
            let val;
            if (mode === 'First' || mode === 'Last') val = e.distanceTraveled; 
            else if (mode === 'Strong') val = e.data.rbe; 
            else val = distSq; // Close
            
            if ((mode === 'First' || mode === 'Strong') ? val > bestVal : val < bestVal) {
                bestVal = val;
                best = e;
            }
        }
        return best;
    },

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        if (tower.stats.knockback) effects.knockback = tower.stats.knockback;
        if (tower.stats.slow) effects.slow = tower.stats.slow;
        if (tower.stats.slowDuration) effects.slowDuration = tower.stats.slowDuration;
        if (tower.stats.camoDmg) effects.camoDmg = tower.stats.camoDmg;
        if (tower.stats.ceramicDmg) effects.ceramicDmg = tower.stats.ceramicDmg;
        
        if (tower.magDistraction && Math.random() < tower.magDistraction) {
            effects.knockback = 100; 
        }

        let count = tower.stats.projectileCount || 1;
        let spreadAngle = 0;
        if (count === 3) spreadAngle = 15;  // Sun Avatar / True Sun God
        else if (count === 2 && !tower.stats.canCrit) spreadAngle = 7.5; // Tech Terror (shoots same target, spread)
        
        let target2 = target;
        // Robo Monkey / Anti-Bloon (canCrit === true) target independently
        if (count === 2 && tower.stats.canCrit) {
            target2 = this._findSecondTarget(tower, engine, target) || target;
        }

        const baseDmg = tower.stats.damage + (tower.buffedDmg || 0) + (tower.alchBuff ? tower.alchBuff.dmg : 0);
        
        // FIX: Calculate perpendicular offsets so arms shoot from different spots!
        const perpX = Math.cos(tower.angle + Math.PI / 2);
        const perpY = Math.sin(tower.angle + Math.PI / 2);

        for(let i=0; i<count; i++) {
            let armDmg = baseDmg;
            let armCrit = false;
            
            // Roll crit independently for this arm
            if (tower.stats.canCrit && Math.random() < (tower.stats.critChance || 0)) {
                armDmg = tower.stats.critDmg;
                armCrit = true;
            }

            let p = engine.projectilePool.get();
            // Robo arms don't use a forced spread angle; they aim at their respective targets
            let offset = (count > 1 && !tower.stats.canCrit) ? (spreadAngle * (i - (count-1)/2)) : 0;
            
            // Arm 0 shoots primary target, Arm 1 shoots secondary target
            let currentTarget = (i === 0) ? target : target2;
            
            // FIX: Visually offset the spawn position for Robo Monkey's two arms
            let spawnX = tower.x;
            let spawnY = tower.y;
            if (count === 2 && tower.stats.canCrit) {
                const armOffset = 12; // 12 pixels apart
                spawnX = tower.x + (i === 0 ? -perpX * armOffset : perpX * armOffset);
                spawnY = tower.y + (i === 0 ? -perpY * armOffset : perpY * armOffset);
            }
            
            p.init(spawnX, spawnY, armDmg, currentTarget, tower.stats.projectileType, tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, effects, offset, tower, dmgType, armCrit);
        }
    },
    
    ability(tower, engine) {
        const name = tower.stats.abilityName;
        
        if (name === "Annihilate" || name === "Annihilate 2.0") {
            const isUpgraded = name === "Annihilate 2.0";
            let pulseDmg = isUpgraded ? 10400 : 2600; 
            const expRadius = isUpgraded ? 800 : 500;
            
            // FIX: Tech Terror every 3rd use is a crit for 3900 damage
            if (!isUpgraded) {
                tower.annihilateUseCount = (tower.annihilateUseCount || 0) + 1;
                if (tower.annihilateUseCount % 3 === 0) {
                    pulseDmg = 3900;
                }
            }
            
            engine.explosions.push({ x: tower.x, y: tower.y, radius: 0, maxRadius: expRadius, life: 0.5, maxLife: 0.5, color: '#3498db' });
            const nearby = engine.enemyGrid.query(tower.x, tower.y, expRadius);
            let hits = 0;
            for (const e of nearby) {
                if (hits >= 2000) break; // Max 2000 bloons
                if (e.alive) {
                    e.takeDamage(pulseDmg, { isExplosion: true, canHitLead: true });
                    hits++;
                }
            }
            // FIX: Removed AudioEngine.playSfx('moab_destroy') as requested
        } else if (name === "Darkshift") {
            let tx = engine.mouse.x;
            let ty = engine.mouse.y;
            
            const isMapwide = tower.upgrades[2] >= 4; 
            if (isMapwide) {
                if (!engine.map.isOnPath(tx, ty) && !engine.map.isOnProp(tx, ty) && !engine.map.isInWater(tx, ty)) {
                    tower.x = tx;
                    tower.y = ty;
                }
            } else {
                const dist = Math.hypot(tx - tower.x, ty - tower.y);
                if (dist <= tower.stats.range * 3) {
                    if (!engine.map.isOnPath(tx, ty) && !engine.map.isOnProp(tx, ty) && !engine.map.isInWater(tx, ty)) {
                        tower.x = tx;
                        tower.y = ty;
                    }
                }
            }
        }
    },
    
    ability2(tower, engine) {
        const pathIdx = 0; 
        const totalLen = engine.map.getTotalLength(pathIdx);
        const pos = engine.map.getPositionAtDistance(totalLen - 10, pathIdx);
        
        const expRadius = 150;
        engine.explosions.push({ x: pos.x, y: pos.y, radius: 0, maxRadius: expRadius, life: 2.0, maxLife: 2.0, color: '#9b59b6' });
        
        const nearby = engine.enemyGrid.query(pos.x, pos.y, expRadius);
        for (const e of nearby) {
            if (e.alive) {
                e.takeDamage(99999, { isExplosion: true, canHitLead: true });
            }
        }
        // FIX: Removed AudioEngine.playSfx('moab_destroy') as requested
    }
};