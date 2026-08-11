// js/enemyDamage.js
import { EnemyTypes } from './data.js';
import { AudioEngine } from './audio.js';
import { GameEngine } from './engine.js';
import { GLOBAL_SCALE } from './constants.js';

const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0;
const SAFETY_LOOP_LIMIT = 100;

const _enemyDmgScratch = [];

const EnemyDamage = {
    takeDamage(damage, dmgType, effects, killerTower = null) {
        if (!this.alive) return -1;
        
        // FIX: Big Squeeze immunity
        if (this.damageImmune) return -1;
        
        if (!dmgType) dmgType = {};
        if (!effects) effects = {};
        if (isNaN(damage)) damage = 0;
        
        if (this._isImmune(dmgType, effects)) return -1;
        
        if (effects && typeof effects.onHit === 'function') {
            effects.onHit(this, dmgType, effects);
        }
        
        if (this.brittle) damage += this.brittleBonus;
        
        if (dmgType.moabDmg && this.data.isMoab) damage += (dmgType.moabDmg || 0);
        if (dmgType.fortifiedDmg && this.isFortified) damage += (dmgType.fortifiedDmg || 0);
        if (this.dipped) damage += 1;
        
        if (effects.instakill && !this.data.isMoab && !this.data.isBAD) {
            this.alive = false;
            this.giveCash(true, killerTower);
            GameEngine.spawnPopEffect(this.x, this.y, this.data.color);
            AudioEngine.playSfx('pop');
            return 999;
        }
        if (effects.gold > 0) GameEngine.addCash(effects.gold);
        if (effects.dip) this.dipped = true;
        if (effects.dot > 0) { this.dotDmg = Math.max(this.dotDmg, effects.dot); this.dotTimer = 3.0; }
        if (effects.moabDot > 0 && this.data.isMoab) { this.dotDmg = Math.max(this.dotDmg, effects.moabDot); this.dotTimer = 5.0; }
        
        if (effects.stripCamo && this.isCamo) {
            this.isCamo = false;
            this._updateSpriteCache();
        }
        if (effects.foam) {
            if (this.isCamo || this.isRegen) {
                this.isCamo = false;
                this.isRegen = false;
                this._updateSpriteCache();
            }
        }
        
        if (effects.knockback) {
            if (this.knockbackCd === undefined || this.knockbackCd <= 0) {
                let kbAmount = effects.knockback;
                if (this.data.isMoab) kbAmount *= 0.2; // MOABs take 20% knockback
                if (this.data.isBAD) kbAmount = 0; // BADs are immune
                if (kbAmount > 0) {
                    this.distanceTraveled = Math.max(0, this.distanceTraveled - kbAmount);
                    this.knockbackCd = 0.5; // 0.5s internal cooldown per enemy
                }
            }
        }
        
        if (effects.stun) {
            let stunDur = effects.stun;
            const round = GameEngine.waveManager ? GameEngine.waveManager.currentWave : 1;
            if (round > 80) {
                stunDur *= (1 - (round - 80) * 0.01);
                if (stunDur < 0.1) stunDur = 0.1;
            }
            this.applySlow(0.0, stunDur, false);
        }
        if (effects.alchDip) {
            if (this.data.isCeramic || this.data.isMoab) damage += 1;
            if (this.data.isLead && this.isFortified) damage += 1;
        }
        if (effects.stripFortified && !this.data.isMoab) this.isFortified = false;
        if (effects.rubberToGold) this.isGoldified = true;
        
        const canSpawn = GameEngine.enemies.length < 3500;

        if (this.data.isMoab) return this._handleMoabDamage(damage, dmgType, effects, canSpawn, killerTower);
        if (this.data.isCeramic) return this._handleCeramicDamage(damage, dmgType, effects, canSpawn, killerTower);
        if (this.data.isLead && this.isFortified) return this._handleFortifiedLeadDamage(damage, dmgType, effects, canSpawn, killerTower);
        if (this.data.splitsInto) return this._handleSplitDamage(damage, dmgType, effects, canSpawn, killerTower);
        return this._handleStandardDamage(damage, dmgType, effects, killerTower);
    },

    _isImmune(dmgType, effects) {
        if (!dmgType) dmgType = {}; 

        // Lead coating (or DDT, which has a lead core) blocks Sharp/Energy/Fire
        // unless the attack can hit lead, or acid has stripped the coating.
        if (this.data.isLead && !this.leadStripped &&
            (dmgType.isSharp || dmgType.isEnergy || dmgType.isFire) &&
            !dmgType.canHitLead) {
            AudioEngine.playSfx('lead_hit');
            return true;
        }

        // Per-bloon immunity predicate (Black/White/Zebra/Purple/DDT explosion).
        if (this.data.blocksDamageType && this.data.blocksDamageType(dmgType)) {
            // Acid-stripped lead loses its coating immunity (DDT still keeps its
            // lead core, so it goes through the lead rule above before this).
            if ((this.data.isLead || this.data.isDDT) && this.leadStripped) return false;
            return true;
        }

        // Frozen bloons are immune to Sharp unless the attack can hit lead/frozen.
        if (this.isFrozen && !this.brittle && dmgType.isSharp && !dmgType.canHitLead) {
            AudioEngine.playSfx('frozen_hit');
            return true;
        }

        return false;
    },

    _handleMoabDamage(damage, dmgType, effects, canSpawn, killerTower) {
        const previousHp = this.hp;
        const dmgDealt = Math.max(0, Math.min(this.hp, damage));
        this.hp -= damage;
        
        if (this.hp <= 0) {
            this.alive = false;
            this.giveCash(canSpawn, killerTower);
            GameEngine.spawnPopEffect(this.x, this.y, this.data.color);
            AudioEngine.playSfx('moab_destroy');
            
            if (this.unstableConcoction) {
                const expDmg = this.data.maxHp * 0.10;
                GameEngine.explosions.push({ x: this.x, y: this.y, radius: 0, maxRadius: 100, life: 0.5, maxLife: 0.5, color: '#e67e22' });
                const nearby = GameEngine.enemyGrid.query(this.x, this.y, 100, _enemyDmgScratch);
                for (const e of nearby) {
                    if (e.alive && e !== this) e.takeDamage(expDmg, { isExplosion: true, canHitLead: true });
                }
            }
            if (effects && effects.unstableConcoction) this.unstableConcoction = true;
            
            const carryOver = damage - previousHp;
            this.spawnChildren(canSpawn, carryOver, dmgType);
        } else {
            if (dmgDealt > 0) AudioEngine.playSfx('moab_hit');
        }
        return Math.ceil(dmgDealt);
    },

    _handleCeramicDamage(damage, dmgType, effects, canSpawn, killerTower) {
        const shellHp = this.hp;
        const dmgDealt = Math.max(0, Math.min(this.hp, damage));
        this.hp -= damage;
        
        if (this.hp <= 0) {
            if (this.isFrozen) this._spawnIceShards();
            
            this.alive = false;
            this.giveCash(canSpawn, killerTower);
            GameEngine.spawnPopEffect(this.x, this.y, this.data.color);
            AudioEngine.playSfx('pop'); 
            const carryOver = damage - shellHp;
            this.spawnChildren(canSpawn, carryOver, dmgType);
        } else {
            if (dmgDealt > 0) AudioEngine.playSfx('ceramic_hit');
        }
        return Math.ceil(dmgDealt);
    },

    _handleFortifiedLeadDamage(damage, dmgType, effects, canSpawn, killerTower) {
        this.leadHp -= damage;
        if (this.leadHp > 0) {
            if (damage > 0) AudioEngine.playSfx('pop');
            return 0;
        }
        
        if (this.isFrozen) this._spawnIceShards();
        
        this.alive = false;
        this.giveCash(canSpawn, killerTower);
        GameEngine.spawnPopEffect(this.x, this.y, this.data.color);
        AudioEngine.playSfx('pop');
        const carryOver = damage - this.leadHp;
        this.spawnChildren(canSpawn, carryOver, dmgType);
        return 1;
    },

    _handleSplitDamage(damage, dmgType, effects, canSpawn, killerTower) {
        if (this.isFrozen) this._spawnIceShards();
        
        this.alive = false;
        this.giveCash(canSpawn, killerTower);
        GameEngine.spawnPopEffect(this.x, this.y, this.data.color);
        AudioEngine.playSfx('pop');
        const carryOver = damage - 1;
        this.spawnChildren(canSpawn, carryOver, dmgType);
        return 1;
    },

    _handleStandardDamage(damage, dmgType, effects, killerTower) {
        let currentTier = this.tier;
        let remainingDamage = damage;
        let layersPopped = 0;
        let safetyCounter = 0;
        
        while (remainingDamage > 0 && currentTier !== null) {
            remainingDamage -= 1;
            currentTier = EnemyTypes[currentTier].nextTier;
            layersPopped++;
            AudioEngine.playSfx('pop');
            if (layersPopped === 1) GameEngine.spawnPopEffect(this.x, this.y, this.data.color);
            if (++safetyCounter > SAFETY_LOOP_LIMIT) break;
        }
        
        if (currentTier === null) {
            if (this.isFrozen) this._spawnIceShards();
            
            this.alive = false;
            this.giveCash(true, killerTower);
        } else {
            this.tier = currentTier;
            this.data = { ...EnemyTypes[currentTier] };
            this.radius = (this.data.radius || 10) * GS;
            const diffSpeedMod = GameEngine.difficulty ? GameEngine.difficulty.speedMod : 1.0;
            this.data.speed *= diffSpeedMod;
            this._updateSpriteCache();
        }
        return layersPopped;
    }
};

export default EnemyDamage;