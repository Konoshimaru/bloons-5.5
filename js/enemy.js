// js/enemy.js
import { EnemyTypes } from './data.js';
import { AudioEngine } from './audio.js';
import { GameEngine } from './engineRef.js';
import Assets from './assets.js';
import { Names } from './names.js';
import { Utils } from './utils.js';
import { Config } from './config.js';
import { GLOBAL_SCALE, GS } from './constants.js';
import EnemyDamage from './enemyDamage.js';
import { MKEffects } from './monkeyKnowledgeEffects.js';
import { updateTimedEffects } from './statusEffects.js';
import { roundSpeedRamp, moabHpRamp, statusDurationFactor, cashMultForRound, treeLayers, leakLives, singleChildSplit } from './btd6Rules.js';


const ENEMY_NAMES = [null, 'red', 'blue', 'green', 'yellow', 'pink', 'black', 'white', 'lead', 'zebra', 'purple', 'rainbow', 'ceramic', 'moab', 'bfb', 'zomg', 'ddt', 'bad'];
const REGEN_INTERVAL = 2.0;

// ---------------------------------------------------------------------------
// REGEN chart (audit C-2 revival, v1.3.3). The old climb was _applyTier(tier+1)
// against a numeric maxTier gate, which is wrong twice over: black(6)/white(7)
// sit BELOW pink(5) in the pop hierarchy despite the higher tier number (so
// black children could never regrow back to pink), and zebra must go straight
// to rainbow (purple(10) is a side branch, not a regrow step - climbing
// through it gave regen bloons a one-tick wrong sprite plus plasma immunity).
// REGEN_NEXT is BTD6's canonical regrow chart; _REGEN_DEPTH orders side
// branches (purple 8.5 between zebra/rainbow, DDT 11.5 between MOAB/BFB) so
// the ceiling gate can never overshoot onto a branch above the wave's bloon.
// ---------------------------------------------------------------------------
const _REGEN_DEPTH = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 8.5, 9, 10, 11, 12, 13, 11.5, 14];
const _REGEN_NEXT = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 11, 11: 12, 12: 13, 13: 14, 14: 15, 15: 17, 16: 17 };

function _regenNextTier(tier, maxTier) {
    const d = _REGEN_DEPTH;
    if (d[tier] === undefined || d[maxTier] === undefined) return null;
    if (d[tier] >= d[maxTier]) return null;   // at/above the wave's bloon: fully regrown
    const next = _REGEN_NEXT[tier];
    if (next === undefined || d[next] > d[maxTier]) return null; // no on-chart step below the ceiling
    return next;
}
const STORM_HIT_INTERVAL = 0.05;
const FORTIFIED_LEAD_HP = 3;

// Scratch results for getPositionAtDistance. The movement hot path runs once
// per enemy per substep (3000+ × up to 10 substeps/frame), and a fresh
// {x,y,finished} per call was ~30k allocations/frame. Two scratches are
// needed because _updateMovement makes two lookups per MOAB — line 1 is fully
// consumed before line 2 runs, so they never overlap.
const _pathPosA = { x: 0, y: 0, finished: false };
const _pathPosB = { x: 0, y: 0, finished: false };

export class Enemy {
    constructor() {}

    init(tier, map, isCamo = false, isRegen = false, maxTier = tier, isFortified = false, hpMod = null, pathIndex = 0, isSuperCeramic = false) {
        this.tier = tier;
        this.map = map;
        this.isCamo = isCamo;
        this.isRegen = isRegen;
        this.maxTier = maxTier;
        // Audit C-2 (v1.3.3): the regen accumulator was never initialized
        // anywhere - undefined + dt = NaN forever, so `NaN > REGEN_INTERVAL`
        // was always false and NO regrow bloon ever regenerated. init() is
        // the pool-reuse reset point, so this covers recycled objects too.
        this.regenTimer = 0;
        // Pooled-flag sweep (audit v1.3.3): Skywarden combo state lives on
        // the enemy (_skyC_wind/storm/ice). A recycled pool object used to
        // respawn still carrying the previous bloon's combo counters, giving
        // the new bloon free combo stages (and the tower a stale watch ref).
        this._skyC_wind = null;
        this._skyC_storm = null;
        this._skyC_ice = null;
        this.isFortified = isFortified;
        this.pathIndex = pathIndex;
        this.isSuperCeramic = isSuperCeramic;

        this._applyTier(tier);

        if (hpMod == null) {
            hpMod = GameEngine.difficulty ? (GameEngine.difficulty.hpMod || 1.0) : 1.0;
        }
        this.hpMod = hpMod;

        this.distanceTraveled = 0;
        this.x = map.paths[pathIndex].segments[0].p1.x;
        this.y = map.paths[pathIndex].segments[0].p1.y;
        this.alive = true;
        // Monotonic per-spawn identity. Enemies are object-pooled and reused,
        // so a tower's cached target reference can't tell a dead bloon from a
        // recycled pool entry — this changes on every spawn and lets cached
        // targets be invalidated safely.
        this._spawnId = (Enemy._spawnCounter = (Enemy._spawnCounter || 0) + 1);
        this.angle = 0;

        this._initializeStats();
        this._updateSpriteCache();

        const round = GameEngine.waveManager ? GameEngine.waveManager.currentWave : 1;
        if (round > 80 && this.data.isMoab) {
            this._maxHp *= moabHpRamp(round);
            this.hp = this._maxHp;
        }
    }

    // Single place that (re)builds per-tier data. Used by init(), regrow, layer pops and
    // the shrink ray. Previously each of those had its own copy and only init() applied
    // the round-81+ speed ramp, so bloons lost their late-game speed after losing a layer.
    _applyTier(tier) {
        this.tier = tier;
        this.data = { ...EnemyTypes[tier] };
        this.radius = (this.data.radius || 10) * GS;
        this.data.speed *= this._speedScale();
    }

    _speedScale() {
        const diff = GameEngine.difficulty ? GameEngine.difficulty.speedMod : 1.0;
        const round = GameEngine.waveManager ? GameEngine.waveManager.currentWave : 1;
        return diff * roundSpeedRamp(round);
    }

    _updateSpriteCache() {
        const assetKey = Names.getEnemyWithModifiers(this.tier, this.isCamo, this.isRegen);
        let asset = Assets.get(assetKey);
        if (asset && asset.loaded) {
            this._spriteAsset = asset;
            this._usedModifierSprite = true;
        } else {
            this._spriteAsset = Assets.get(Names.getEnemy(this.tier));
            this._usedModifierSprite = false;
        }
        
        if (this._spriteAsset && this._spriteAsset.loaded) {
            const targetSize = (this.data.size || (this.data.radius * 2)) * GS;
            const maxDim = Math.max(this._spriteAsset.width, this._spriteAsset.height);
            const scale = targetSize / maxDim;
            this._spriteW = this._spriteAsset.width * scale;
            this._spriteH = this._spriteAsset.height * scale;
        } else {
            this._spriteW = (this.data.radius || 10) * 2 * GS;
            this._spriteH = (this.data.radius || 10) * 2 * GS;
        }
    }

    _initializeStats() {
        this.slowFactor = 1.0;
        this.slowTimer = 0;
        this.isFrozen = false;
        this.dotTimer = 0;
        this.dotDmg = 0;
        this.dotTick = 0;
        this.dipped = false;
        this.stormHitTimer = 0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.gojoSlow = 1.0;
        this.infinityTint = 0;
        this.unstableConcoction = false;
        this.isGoldified = false;
        
        this.permafrostSlow = 1.0;     
        this.brittle = false;           
        this.brittleTimer = 0;
        this.brittleBonus = 0;          
        this.deepFreezeLayers = 0;      
        this.leadStripped = false;      
        this._maxHp = this.data.maxHp;
        if (this.isFortified && (this.data.isMoab || this.data.isCeramic)) {
            this._maxHp *= 2;
        }
        
        this.bladeAnimTimer = 0;
        this.bladeFrame = 0;
        
        // FIX: Pat Fusty states
        this.patSlapKnockbackTimer = 0;
        this.isSqueezed = false;
        this.damageImmune = false;
        this.collisionImmune = false;
        this.untargetable = false;
        
        const mk = Config.data.mkActive === false ? {} : (Config.data.monkeyKnowledge || {});
        for (const eff of MKEffects.enemyInit) {
            if (!mk[eff.id]) continue;
            if (eff.condition && !eff.condition(this)) continue;

            if (eff.action) {
                eff.action(this);
            } else if (eff.stat) {
                if (eff.mode === 'mult') {
                    this[eff.stat] = Math.floor((this[eff.stat] || 1) * eff.amount);
                } else if (typeof eff.amount === 'number') {
                    this[eff.stat] = (this[eff.stat] || 0) + eff.amount;
                } else {
                    this[eff.stat] = eff.amount;
                }
            }
        }
        
        if (this.isSuperCeramic) {
            if (this.tier === 12) { 
                this._maxHp = this.isFortified ? 120 : 60;
                this.data.livesLost = this.isFortified ? 75 : 65;
                this.data.splitsInto = [{tier: 11, count: 1}]; 
            } else if (this.tier === 11) { 
                this.data.livesLost = 0;
                this.data.splitsInto = [{tier: 9, count: 1}]; 
            } else if (this.tier === 9) { 
                this.data.livesLost = 0;
                this.data.splitsInto = [{tier: 7, count: 1}]; 
            } else if (this.tier === 16) { 
                this.data.livesLost = this.isFortified ? 1100 : 660;
            }
        }

        // Round 81+: one child per layer for every non-MOAB-class bloon (also Lead, Black, White,
        // Purple... that were spawned directly by the wave, not only the Super Ceramic chain).
        if (GameEngine.waveManager && GameEngine.waveManager.currentWave >= 81) {
            const single = singleChildSplit(this.tier);
            if (single) this.data.splitsInto = single;
        }

        if (this.hpMod && this.hpMod !== 1) {
            this._maxHp = Math.max(1, Math.ceil(this._maxHp * this.hpMod));
        }
        if (this.data.isMoab && GameEngine.difficulty && GameEngine.difficulty.moabHpMod) {
            this._maxHp = Math.ceil(this._maxHp * GameEngine.difficulty.moabHpMod);
        }
        this.hp = this._maxHp;
        
        if (this.data.isLead && this.isFortified) {
            this.leadHp = FORTIFIED_LEAD_HP;
        }
    }

    update(dt) {
        this._updateTimers(dt);
        this._updateRegen(dt);
        this._updateMovement(dt);
    }

    _updateTimers(dt) {
        if (this.stormHitTimer > 0) this.stormHitTimer -= dt;
        if (this.knockbackCd > 0) this.knockbackCd -= dt; 
        updateTimedEffects(this, dt);
        
        // FIX: Pat Fusty Sustained Knockback Timer
        if (this.patSlapKnockbackTimer > 0) {
            this.patSlapKnockbackTimer -= dt;
        }
        
        if (this.tier >= 13 && this.tier <= 15) {
            this.bladeAnimTimer += dt;
            if (this.bladeAnimTimer >= 0.1) { 
                this.bladeAnimTimer = 0;
                this.bladeFrame++;
            }
        }
    }
    _updateRegen(dt) {
        if (!this.isRegen) return;
        this.regenTimer += dt;
        if (this.regenTimer > REGEN_INTERVAL) {
            this.regenTimer = 0;
            // BTD6 canonical chart step (see _REGEN_NEXT above) instead of
            // tier+1: black children regrow to their wave lineage and zebra
            // skips the purple side branch.
            const next = _regenNextTier(this.tier, this.maxTier);
            if (next == null) return;
            this._applyTier(next);
            if (this.data.isMoab) {
                let moabHp = this.data.maxHp * (this.isFortified ? 2 : 1);
                if (GameEngine.difficulty && GameEngine.difficulty.moabHpMod) moabHp *= GameEngine.difficulty.moabHpMod;
                this.hp = moabHp;
            }
            if (this.data.isCeramic) this.hp = this.data.maxHp * (this.isFortified ? 2 : 1);
            this._updateSpriteCache();
        }
    }

    _updateMovement(dt) {
        // FIX: Big Squeeze stops movement entirely
        if (this.isSqueezed) return;
        
        // FIX: Pat Fusty Slap Sustained Knockback (3x backwards for 1 second)
        if (this.patSlapKnockbackTimer > 0) {
            this.distanceTraveled -= this.data.speed * 3 * dt;
            if (this.distanceTraveled < 0) this.distanceTraveled = 0;
        } else {
            this.distanceTraveled += this.data.speed * this.slowFactor * this.gojoSlow * this.permafrostSlow * dt;
        }
        
        const pos = this.map.getPositionAtDistance(this.distanceTraveled, this.pathIndex, _pathPosA);
        this.x = pos.x + this.offsetX;
        this.y = pos.y + this.offsetY;
        this.offsetX *= 0.9;
        this.offsetY *= 0.9;
        
        if (this.tier >= 13 && !pos.finished) {
            const nextPos = this.map.getPositionAtDistance(this.distanceTraveled + 5, this.pathIndex, _pathPosB);
            if (nextPos && !nextPos.finished) {
                this.angle = Utils.angle(pos.x, pos.y, nextPos.x, nextPos.y);
            }
        }
        
        this.gojoSlow = Math.min(1.0, this.gojoSlow + dt * 0.5);
        this.infinityTint = Math.max(0, this.infinityTint - dt * 0.5);
        
        if (pos.finished) {
            this.alive = false;
            let lost = this.getLivesLost();
            if (isFinite(lost) && lost > 0) {
                if (GameEngine.manaShield > 0) {
                    const absorbed = Math.min(GameEngine.manaShield, lost);
                    GameEngine.manaShield -= absorbed;
                    lost -= absorbed;
                }
                if (lost > 0 && !(GameEngine.blackHoleTimer > 0)) GameEngine.lives -= lost;
            }
            GameEngine.updateUI();
        }
    }

    getLivesLost() {
        // Explicit overrides (Super Ceramic chain, set in _initializeStats) win.
        if (this.data.livesLost !== undefined) return this.data.livesLost;
        const round = GameEngine.waveManager ? GameEngine.waveManager.currentWave : 1;
        const hpRatio = this._maxHp > 0 ? Math.max(0, this.hp / this._maxHp) : 0;
        const lives = leakLives(this.tier, { round, fortified: this.isFortified, hpRatio });
        return isFinite(lives) ? lives : 0;
    }

    applySlow(factor, duration, isIce = true) {
        if (this.data.isBAD) return;
        if (isIce && (this.data.isWhite || this.data.isZebra || this.data.isLead) && !this.leadStripped) return;
        
        const round = GameEngine.waveManager ? GameEngine.waveManager.currentWave : 1;
        const actualDuration = duration * statusDurationFactor(round);

        if (factor <= this.slowFactor || this.slowTimer <= 0) {
            this.slowFactor = factor;
            this.slowTimer = actualDuration;
            this.isFrozen = isIce;
        }
    }

    _popCashMult(killerTower) {
        const round = GameEngine.waveManager ? GameEngine.waveManager.currentWave : 1;
        let m = cashMultForRound(round);
        if (killerTower && killerTower.buffedCashMult > 0) m += killerTower.buffedCashMult;
        return m;
    }

    // Pays for the layers a single hit popped on a plain (nextTier-chain) bloon.
    // BTD6: $1 per layer, scaled by the round modifier (fractions accumulate in the engine).
    payLayers(layers, killerTower = null) {
        if (layers <= 0) return;
        GameEngine.addPopCash(layers * this._popCashMult(killerTower));
        GameEngine.addSessionXp(layers);
        this._creditTowerXp(layers, killerTower);
    }

    // Per-pop TOWER XP (paragon unlock progress): 1 XP per popped layer,
    // credited to the killer tower's base type. Sentries credit their engineer
    // via parentTower; heroes have their own XP system and are skipped.
    _creditTowerXp(layers, killerTower) {
        if (!killerTower || layers <= 0) return;
        const base = killerTower.parentTower || killerTower;
        if (!base || (base.stats && base.stats.isHero)) return;
        GameEngine.addTowerXp(base.type, layers);
    }

    // Pays for this bloon's own layer (1). If its children cannot spawn (entity cap) their
    // whole subtree is paid immediately so the cap never costs the player money.
    giveCash(canSpawn = true, killerTower = null) {
        let layers = 1;
        let childRbeTotal = 0;
        for (const child of (EnemyTypes[this.tier].splitsInto || [])) {
            childRbeTotal += (EnemyTypes[child.tier].rbe || 0) * child.count;
        }
        if (!canSpawn) {
            for (const child of (this.data.splitsInto || [])) layers += treeLayers(child.tier) * child.count;
        }
        GameEngine.addPopCash(layers * this._popCashMult(killerTower));

        // Per-pop player XP: the bloon's own layer value (RBE minus children, which give
        // their own XP when they pop), so a full clear sums to the run's total RBE.
        const ownLayers = Math.max(1, this.data.rbe - childRbeTotal);
        GameEngine.addSessionXp(ownLayers);
        this._creditTowerXp(ownLayers, killerTower);
    }

    spawnChildren(canSpawn, carryOverDamage = 0, dmgType) {
        if (!canSpawn || !this.data.splitsInto) return;
        
        let totalChildren = 0;
        for (const child of this.data.splitsInto) {
            totalChildren += child.count;
        }
        if (totalChildren === 0) totalChildren = 1; 
        
        const dmgPerChild = Math.floor(carryOverDamage / totalChildren);
        let remainder = carryOverDamage % totalChildren;
        
        for (const child of this.data.splitsInto) {
            for (let i = 0; i < child.count; i++) {
                const childCamo = child.forceCamo !== undefined ? child.forceCamo : this.isCamo;
                const childRegen = child.forceRegen !== undefined ? child.forceRegen : this.isRegen;
                const c = GameEngine.enemyPool.get();
                // Audit C-2 (v1.3.3): children inherit the parent's REGEN
                // ceiling (the type the WAVE spawned), not their own tier -
                // a regen ceramic's zebras must be able to climb back to
                // ceramic. Non-regen bloons ignore maxTier entirely.
                c.init(child.tier, this.map, childCamo, childRegen, this.maxTier, this.isFortified, this.hpMod, this.pathIndex, this.isSuperCeramic);
                c.distanceTraveled = Math.max(0, this.distanceTraveled - i * 15);
                
                if (this.deepFreezeLayers > 0) {
                    c.deepFreezeLayers = this.deepFreezeLayers - 1;
                    c.applySlow(0.0, 1.5, true);
                }
                if (this.permafrostSlow < 1.0) c.permafrostSlow = this.permafrostSlow;
                if (this.leadStripped) c.leadStripped = true;
                
                if (carryOverDamage > 0) {
                    let dmg = dmgPerChild;
                    if (remainder > 0) { dmg++; remainder--; }
                    if (dmg > 0) c.takeDamage(dmg, dmgType);
                }
                GameEngine.enemies.push(c);
            }
        }
    }

    _spawnIceShards() {
        if (!this.isFrozen) return;
        if (!GameEngine.hasIceShardTower) return; 
        if (GameEngine.projectilePool.active.length > 1200) return; 
        
        for (let t of GameEngine.towers) {
            if (t && t.type === 'ice' && t.upgrades[0] >= 3) {
                let shardCount = t.stats.superBrittle ? 6 : 3;
                let shardDmg = 2;
                let shardPierce = 3;
                
                if (t.upgrades[1] >= 2) {
                    shardDmg = 3;
                    shardPierce = 5;
                }
                
                for (let i = 0; i < shardCount; i++) {
                    let angle = (i / shardCount) * Math.PI * 2;
                    let p = GameEngine.projectilePool.get();
                    p.init(this.x, this.y, shardDmg, null, 'nail', 400, shardPierce, 0.5, angle, null, 0, t, { isSharp: true, canHitLead: false });
                }
                break;
            }
        }
    }
}

Object.assign(Enemy.prototype, EnemyDamage);