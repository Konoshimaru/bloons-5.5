// js/towers/wizard.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

const _wizAuraScratch = [];
const _wizWellScratch = [];
const _wizFireScratch = [];
const _wizTargetScratch = [];

// Target selection matching towerBehavior._findTarget: queries the enemy grid
// within effective range, respects camo detection and the tower's targeting
// mode (First/Last/Strong/Close). Fireball/Necromancer/Phoenix must not pick
// a random enemy anywhere on the map.
function _findWizardTarget(tower, engine) {
    const effRange = Utils.getEffectiveRange(tower, engine);
    const candidates = engine.enemyGrid.query(tower.x, tower.y, effRange, _wizTargetScratch);
    const mode = tower.targetingMode || 'First';
    let best = null;
    let bestVal = (mode === 'First' || mode === 'Strong') ? -Infinity : Infinity;
    const isBetter = (v, o) => (mode === 'First' || mode === 'Strong') ? v > o : v < o;

    for (const e of candidates) {
        if (!e.alive) continue;
        if (e.isCamo && !tower.stats.canSeeCamo && !tower.buffedCamo) continue;
        const eRad = e.radius || 10;
        if (Utils.distanceSq(tower.x, tower.y, e.x, e.y) > (effRange + eRad) * (effRange + eRad)) continue;
        let val;
        if (mode === 'First' || mode === 'Last') val = e.distanceTraveled;
        else if (mode === 'Strong') val = e.data.rbe;
        else val = Math.sqrt(Utils.distanceSq(tower.x, tower.y, e.x, e.y));
        if (isBetter(val, bestVal)) { bestVal = val; best = e; }
    }
    return best;
}

export default {
    stats: { 
        name: "Wizard Monkey", cost: 250, range: 40, 
        baseCooldown: 1.1, fireRate: 1.1, 
        damage: 1, pierce: 3, projectileSpeed: 600, 
        lifespan: 0.4, desc: "Hurls magical bolts of energy at the Bloons.", 
        dmgType: 'energy', projectileType: 'wizard_bolt', hitRadius: 12,
        category: 'Magic' 
    },
    upgrades: {
        1: [
            {name:"Guided Magic", cost:175, desc:"Magic shots last longer and seek out the Bloons, even behind cover.", extraMods:{lifespan: 0.2, homing: true}},
            {name:"Arcane Blast", cost:450, stat:"damage", amount:1, desc:"Bigger, more powerful magic blasts pop through 2 layers of Bloon.", extraMods:{pierce: 2}},
            {name:"Arcane Mastery", cost:1450, stat:"damage", amount:1, desc:"Faster attacks with increased range, damage, and popping power.", extraMods:{range: 10, pierce: 2, cooldownMult: 0.5}},
            {name:"Arcane Spike", cost:10000, stat:"damage", amount:3, desc:"Faster firing magic does huge damage to most Bloon types, especially to MOABs.", extraMods:{cooldownMult: 0.5, moabDmg: 10}},
            {name:"Archmage", cost:32000, stat:"damage", amount:1, desc:"A true master of magical wizardry. Attacks faster and does more damage to MOAB-class Bloons.", extraMods:{cooldownMult: 0.5, moabDmg: 19, pierce: 8}}
        ],
        2: [
            {name:"Fireball", cost:300, desc:"Every few seconds casts an explosive fireball spell.", extraMods:{fireballCd: 2.2, fireballDmg: 1, explosionRadius: 30, explosionPierce: 15}},
            {name:"Wall of Fire", cost:800, desc:"Creates a super hot wall of fire across the track to roast the Bloons as they pass.", extraMods:{fireWellCd: 4.0, fireWellDmg: 2}},
            {name:"Dragon's Breath", cost:3300, stat:"dmgType", amount:'fire', desc:"Spews endless flames at nearby Bloons and enhances Fireball and Wall of Fire.", extraMods:{projectileType: 'fire', cooldownMult: 0.5, explosionRadius: 50, fireWellDmg: 4, fireballDmg: 2}},
            {name:"Summon Phoenix", cost:6000, desc:"Summon Phoenix ability: Powerful phoenix wreaks Bloon havoc for 20 seconds.", extraMods:{isAbility: true, abilityName: "Summon Phoenix", abilityCd: 45}},
            {name:"Wizard Lord Phoenix", cost:50000, stat:"damage", amount:5, desc:"Wizard Lord becomes a master of the flame, permanently transforming into a super powerful Lava Phoenix.", extraMods:{moabDmg: 10}}
        ],
        3: [
            {name:"Intense Magic", cost:300, stat:"pierce", amount:2, desc:"More powerful magic shots move faster and can pop more Bloons.", extraMods:{projectileSpeed: 200}},
            {name:"Monkey Sense", cost:300, stat:"canSeeCamo", amount:true, desc:"Increases range slightly and allows the Wizard to hit Camo Bloons.", extraMods:{range: 5}},
            {name:"Shimmer", cost:1500, desc:"Gains a dark magic attack that periodically reveals location of all nearby Camo Bloons permanently.", extraMods:{shimmerCd: 1.0, stripCamo: true}},
            {name:"Necromancer: Unpopped Army", cost:2800, stat:"damage", amount:3, desc:"Reanimate recently popped enemies as servants that can destroy Bloons of any type.", extraMods:{necroCd: 1.5, necroDmg: 5, moabDmg: 5}},
            {name:"Prince of Darkness", cost:26500, stat:"damage", amount:10, desc:"Reanimate even more powerful Bloon servants to obliterate the enemy.", extraMods:{necroCd: 0.5, necroDmg: 25, moabDmg: 50, pierce: 5}}
        ]
    },

    update(tower, dt, engine) {
        // 1. Wall of Fire Passive Spawn
        if (tower.stats.fireWellCd) {
            tower.fireWellTimer = (tower.fireWellTimer || 0) - dt;
            if (tower.fireWellTimer <= 0) {
                tower.fireWellTimer = tower.stats.fireWellCd;
                const nearby = engine.enemyGrid.query(tower.x, tower.y, Utils.getEffectiveRange(tower, engine), _wizAuraScratch);
                if (nearby.length > 0) {
                    let target = nearby[Math.floor(Math.random() * nearby.length)];
                    if (target && target.alive) {
                        tower.fireWells = tower.fireWells || [];
                        tower.fireWells.push({ x: target.x, y: target.y, life: 4.0, maxLife: 4.0, radius: 40, dmg: tower.stats.fireWellDmg || 2 });
                    }
                }
            }
        }

        // Update Fire Wells
        if (tower.fireWells && tower.fireWells.length > 0) {
            for (let i = tower.fireWells.length - 1; i >= 0; i--) {
                let w = tower.fireWells[i];
                w.life -= dt;
                if (w.life <= 0) { tower.fireWells.splice(i, 1); continue; }
                const wNearby = engine.enemyGrid.query(w.x, w.y, w.radius, _wizWellScratch);
                for (let e of wNearby) {
                    if (!e || !e.alive) continue;
                    if (Utils.withinRange(w.x, w.y, e.x, e.y, w.radius)) {
                        e.takeDamage(w.dmg * dt * 5, { isFire: true, canHitLead: true }, {}, tower);
                    }
                }
            }
        }

        // 2. Fireball Secondary Attack
        if (tower.stats.fireballCd) {
            tower.fireballTimer = (tower.fireballTimer || 0) - dt;
            if (tower.fireballTimer <= 0) {
                tower.fireballTimer = tower.stats.fireballCd;
                let target = _findWizardTarget(tower, engine);
                if (target) {
                    let p = engine.projectilePool.get();
                    p.init(tower.x, tower.y - 10, tower.stats.fireballDmg, target, 'bomb', 500, 1, 1.0, null, { isExplosive: true, explosionRadius: tower.stats.explosionRadius, explosionDamage: tower.stats.fireballDmg, explosionPierce: tower.stats.explosionPierce, canHitLead: true }, 0, tower, { isFire: true, isExplosion: true, canHitLead: true });
                }
            }
        }

        // 3. Shimmer (Decamo Aura)
        if (tower.stats.shimmerCd) {
            tower.shimmerTimer = (tower.shimmerTimer || 0) - dt;
            if (tower.shimmerTimer <= 0) {
                tower.shimmerTimer = tower.stats.shimmerCd;
                const range = Utils.getEffectiveRange(tower, engine);
                const nearby = engine.enemyGrid.query(tower.x, tower.y, range, _wizFireScratch);
                for (const e of nearby) {
                    if (e && e.alive && e.isCamo) {
                        e.isCamo = false;
                    }
                }
                engine.explosions.push({ x: tower.x, y: tower.y, radius: 0, maxRadius: range, life: 0.3, maxLife: 0.3, color: 'rgba(155, 89, 182, 0.3)' });
            }
        }

        // 4. Necromancer (Spawn Undead)
        if (tower.stats.necroCd) {
            tower.necroTimer = (tower.necroTimer || 0) - dt;
            if (tower.necroTimer <= 0) {
                tower.necroTimer = tower.stats.necroCd;
                // Spawn 3 homing projectiles
                for (let i = 0; i < 3; i++) {
                    let target = _findWizardTarget(tower, engine);
                    if (target) {
                        let p = engine.projectilePool.get();
                        p.init(tower.x, tower.y, tower.stats.necroDmg, target, 'wizard_bolt', 800, 5, 2.0, null, { canHitLead: true, canHitMoab: true }, 0, tower, { isMagic: true, canHitLead: true });
                    }
                }
            }
        }

        // 5. Phoenix Ability Active Effect
        // Wizard Lord Phoenix (T5): the phoenix is permanent, so keep it active
        // at all times instead of requiring the ability.
        if (tower.upgrades[1] === 5) {
            tower.phoenixActive = Math.max(tower.phoenixActive || 0, 1.0);
        }
        if (tower.phoenixActive > 0) {
            tower.phoenixActive -= dt;
            tower.phoenixTimer = (tower.phoenixTimer || 0) - dt;
            if (tower.phoenixTimer <= 0) {
                tower.phoenixTimer = 0.1; // Fire 10 times a second
                let target = _findWizardTarget(tower, engine);
                if (target) {
                    let p = engine.projectilePool.get();
                    let dmg = 5;
                    p.init(tower.x, tower.y - 20, dmg, target, 'bomb', 1000, 8, 2.0, null, { isExplosive: true, explosionRadius: 50, explosionDamage: dmg, explosionPierce: 8, canHitLead: true, moabDmg: tower.stats.moabDmg || 0 }, 0, tower, { isFire: true, isExplosion: true, canHitLead: true });
                }
            }
        }
    },

    fire(tower, target, damage, dmgType, isCrit, effects, engine) {
        let pEffects = { ...effects };
        if (tower.stats.stripCamo) pEffects.stripCamo = true;
        
        let p = engine.projectilePool.get();
        p.init(tower.x, tower.y, damage, target, tower.stats.projectileType, tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, pEffects, 0, tower, dmgType, isCrit);
    },

    ability(tower, engine) {
        if (tower.stats.abilityName === "Summon Phoenix") {
            engine.log("Summon Phoenix!");
            tower.phoenixActive = 20.0; // 20 seconds of chaos
            tower.phoenixTimer = 0;
        }
    },

    draw(ctx, tower, isPreview) {
        if (!isPreview && tower.fireWells) {
            for (let w of tower.fireWells) {
                ctx.globalAlpha = Math.min(1, w.life / w.maxLife) * 0.6;
                const grad = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.radius);
                grad.addColorStop(0, 'rgba(255, 100, 0, 0.8)');
                grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
            }
        }
        tower.drawBaseTower(ctx, isPreview);
    }
};
