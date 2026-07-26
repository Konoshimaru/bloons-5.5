// js/enemy.js
import { EnemyTypes } from './data.js';
import { AudioEngine } from './audio.js';
import { GameEngine } from './engine.js';
import Assets from './assets.js';
import { Names } from './names.js';
import { Utils } from './utils.js';
import { Config } from './config.js';
import { GLOBAL_SCALE } from './constants.js';
import { EnemyRenderer } from './enemyRenderer.js';
import EnemyDamage from './enemyDamage.js';
import { MKEffects } from './monkeyKnowledgeEffects.js';
import { updateTimedEffects } from './statusEffects.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;

const ENEMY_NAMES = [null, 'red', 'blue', 'green', 'yellow', 'pink', 'black', 'white', 'lead', 'zebra', 'purple', 'rainbow', 'ceramic', 'moab', 'bfb', 'zomg', 'ddt', 'bad'];
const CASH_REWARD_MODIFIER = 0.15;
const REGEN_INTERVAL = 2.0;
const STORM_HIT_INTERVAL = 0.05;
const FORTIFIED_LEAD_HP = 3;
const LIVES_LOST_CERAMIC_BASE = 94;
const LIVES_LOST_FORTIFIED_LEAD = 26;

export class Enemy {
    constructor() {}

    init(tier, map, isCamo = false, isRegen = false, maxTier = tier, isFortified = false, hpMod = null, pathIndex = 0, isSuperCeramic = false) {
        this.tier = tier;
        this.map = map;
        this.isCamo = isCamo;
        this.isRegen = isRegen;
        this.maxTier = maxTier;
        this.isFortified = isFortified;
        this.pathIndex = pathIndex;
        this.isSuperCeramic = isSuperCeramic;

        this.data = { ...EnemyTypes[tier] };
        this.radius = (this.data.radius || 10) * GS;
        
        const diffSpeedMod = GameEngine.difficulty ? GameEngine.difficulty.speedMod : 1.0;
        this.data.speed *= diffSpeedMod;

        if (hpMod == null) {
            hpMod = GameEngine.difficulty ? (GameEngine.difficulty.hpMod || 1.0) : 1.0;
        }
        this.hpMod = hpMod;

        this.distanceTraveled = 0;
        this.x = map.paths[pathIndex].segments[0].p1.x;
        this.y = map.paths[pathIndex].segments[0].p1.y;
        this.alive = true;
        this.angle = 0;

        this._initializeStats();
        this._updateSpriteCache();

        const round = GameEngine.waveManager ? GameEngine.waveManager.currentWave : 1;
        if (round > 80) {
            let speedMult = 1.0;
            if (round <= 100) speedMult = 1 + (round - 80) * 0.02;
            else if (round <= 150) speedMult = 1.6 + (round - 101) * 0.02;
            else if (round <= 200) speedMult = 3.0 + (round - 151) * 0.02;
            else if (round <= 251) speedMult = 4.5 + (round - 201) * 0.02;
            else speedMult = 6.0 + (round - 252) * 0.02;
            this.data.speed *= speedMult;

            if (this.data.isMoab) {
                let hpMult = 1.0;
                if (round <= 100) hpMult = 1.0 + (round - 80) * 0.02;
                else if (round <= 124) hpMult = 1.4 + (round - 100) * 0.05;
                else if (round <= 150) hpMult = 2.6 + (round - 124) * 0.15;
                else if (round <= 250) hpMult = 6.5 + (round - 150) * 0.35;
                else if (round <= 300) hpMult = 41.5 + (round - 250) * 1.0;
                else if (round <= 400) hpMult = 91.5 + (round - 300) * 1.5;
                else if (round <= 500) hpMult = 241.5 + (round - 400) * 2.5;
                else hpMult = 5 * round - 2008.5;
                
                this._maxHp *= hpMult;
                this.hp = this._maxHp;
            }
        }
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
                this._maxHp = 60 + (GameEngine.waveManager.currentWave - 81) * 2;
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

        if (this.hpMod && this.hpMod !== 1) {
            this._maxHp = Math.max(1, Math.ceil(this._maxHp * this.hpMod));
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
        if (this.knockbackCd > 0) this.knockbackCd -= dt; // FIX: Tick knockback cooldown
        updateTimedEffects(this, dt);
    }
    _updateRegen(dt) {
        if (!this.isRegen || this.tier >= this.maxTier) return;
        this.regenTimer += dt;
        if (this.regenTimer > REGEN_INTERVAL) {
            this.regenTimer = 0;
            this.tier++;
            this.data = { ...EnemyTypes[this.tier] };
            this.radius = (this.data.radius || 10) * GS;
            const diffSpeedMod = GameEngine.difficulty ? GameEngine.difficulty.speedMod : 1.0;
            this.data.speed *= diffSpeedMod;
            if (this.data.isMoab) this.hp = this.data.maxHp * (this.isFortified ? 2 : 1);
            if (this.data.isCeramic) this.hp = this.data.maxHp * (this.isFortified ? 2 : 1);
            this._updateSpriteCache();
        }
    }

    _updateMovement(dt) {
        this.distanceTraveled += this.data.speed * this.slowFactor * this.gojoSlow * this.permafrostSlow * dt;
        const pos = this.map.getPositionAtDistance(this.distanceTraveled, this.pathIndex);
        this.x = pos.x + this.offsetX;
        this.y = pos.y + this.offsetY;
        this.offsetX *= 0.9;
        this.offsetY *= 0.9;
        
        if (this.tier >= 13 && !pos.finished) {
            const nextPos = this.map.getPositionAtDistance(this.distanceTraveled + 5, this.pathIndex);
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
                if (lost > 0) GameEngine.lives -= lost;
            }
            GameEngine.updateUI();
        }
    }

    getLivesLost() {
        if (this.data.livesLost !== undefined) {
            return this.data.livesLost;
        }

        const round = GameEngine.waveManager ? GameEngine.waveManager.currentWave : 1;
        if (round > 80 && !this.isSuperCeramic) {
            if (this.data.isCeramic) return 47;
            if (this.data.isLead) return 11;
            if (this.data.isPurple) return 2;
        }

        if (this.data.isMoab || this.data.isBAD) {
            let childrenRbe = 0;
            if (this.data.splitsInto) {
                for (const child of this.data.splitsInto) {
                    const childData = EnemyTypes[child.tier];
                    if (childData) childrenRbe += (childData.rbe || 0) * child.count;
                }
            }
            
            let baseMaxHp = this.data.maxHp;
            if (this.isFortified && (this.data.isMoab || this.data.isCeramic)) {
                baseMaxHp *= 2;
            }
            const hpRatio = this._maxHp > 0 ? (this.hp / this._maxHp) : 0;
            const currentHp = Math.max(0, Math.ceil(baseMaxHp * hpRatio)) || 0;
            
            return isFinite(currentHp + childrenRbe) ? currentHp + childrenRbe : 0;
        }
        if (this.data.isCeramic) {
            const currentHp = Math.max(0, Math.ceil(this.hp)) || 0;
            return isFinite(LIVES_LOST_CERAMIC_BASE + currentHp) ? LIVES_LOST_CERAMIC_BASE + currentHp : 0;
        }
        if (this.data.isLead && this.isFortified) return LIVES_LOST_FORTIFIED_LEAD;
        const rbe = this.data.rbe || 0;
        return isFinite(rbe) ? rbe : 0;
    }

    applySlow(factor, duration, isIce = true) {
        if (this.data.isBAD) return;
        if (isIce && (this.data.isWhite || this.data.isZebra || this.data.isLead) && !this.leadStripped) return;
        
        let actualDuration = duration;
        const round = GameEngine.waveManager ? GameEngine.waveManager.currentWave : 1;
        if (round > 80) {
            actualDuration *= (1 - (round - 80) * 0.01);
            if (actualDuration < 0.1) actualDuration = 0.1; 
        }

        if (factor <= this.slowFactor || this.slowTimer <= 0) {
            this.slowFactor = factor;
            this.slowTimer = actualDuration;
            this.isFrozen = isIce;
        }
    }

    // FIX: Removed the _dying flag entirely. The !this.alive guard in takeDamage is sufficient.
    giveCash(canSpawn = true, killerTower = null) {
        let childRbeTotal = 0;
        if (this.data.splitsInto) {
            for (const child of this.data.splitsInto) {
                const childData = EnemyTypes[child.tier];
                if (childData) childRbeTotal += (childData.rbe || 0) * child.count;
            }
        }

        let cashMult = 1.0;
        const round = GameEngine.waveManager ? GameEngine.waveManager.currentWave : 1;
        if (round >= 141) cashMult = 0.02;
        else if (round >= 121) cashMult = 0.04;
        else if (round >= 101) cashMult = 0.05;
        else if (round >= 86) cashMult = 0.10;
        else if (round >= 61) cashMult = 0.20;
        else if (round >= 51) cashMult = 0.50;

        if (killerTower && killerTower.buffedCashMult > 0) {
            cashMult += killerTower.buffedCashMult;
        }

        const layerCash = Math.max(1, Math.floor((this.data.rbe - childRbeTotal) * CASH_REWARD_MODIFIER * cashMult));
        GameEngine.addCash(layerCash);
        if (!canSpawn && childRbeTotal > 0) {
            const childCash = Math.max(1, Math.floor(childRbeTotal * CASH_REWARD_MODIFIER * cashMult));
            GameEngine.addCash(childCash);
        }
    }

    // FIX: Removed the _dying flag check. It was blocking spawnChildren because giveCash ran first.
    spawnChildren(canSpawn, carryOverDamage = 0, dmgType) {
        if (!canSpawn || !this.data.splitsInto) return;
        
        const childCount = this.data.splitsInto.length;
        const dmgPerChild = Math.floor(carryOverDamage / childCount);
        let remainder = carryOverDamage % childCount;
        for (const child of this.data.splitsInto) {
            for (let i = 0; i < child.count; i++) {
                const childCamo = child.forceCamo !== undefined ? child.forceCamo : this.isCamo;
                const childRegen = child.forceRegen !== undefined ? child.forceRegen : this.isRegen;
                const c = GameEngine.enemyPool.get();
                c.init(child.tier, this.map, childCamo, childRegen, child.tier, this.isFortified, this.hpMod, this.pathIndex, this.isSuperCeramic);
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

Object.assign(Enemy.prototype, EnemyRenderer);
Object.assign(Enemy.prototype, EnemyDamage);