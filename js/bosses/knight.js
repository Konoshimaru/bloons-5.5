// js/bosses/knight.js
import { GameEngine } from '../engine.js';
import { Enemy } from '../enemy.js';
import { EnemyTypes } from '../data.js';
import { BossHealthBarHandler } from '../BossHealthBarHandler.js';
import { Config } from '../config.js';
import { getBossMusic } from './knightMusic.js';
import KnightRenderer from './knightRenderer.js';
import KnightAttacks from './knightAttacks.js';

export class KnightEnemy extends Enemy {
    constructor(x, y) {
        super(); 
        this.init(13, GameEngine.map, false, false, 13, false, 1.0); 
        
        this.tier = 99; 
        this.x = x;
        this.y = y;
        this.alpha = 1; 
        this.sprite = 'enemy_knight_front'; 
        this.data = { ...EnemyTypes[13], name: "Black Knight", radius: 45, size: 90, isMoab: true, splitsInto: [] };
        this.hp = 60000; 
        this._maxHp = 60000;
        this.distanceTraveled = 0; 
        this.angle = 0;
        
        this.time = 0; 
        this.knightTrail = [];
        this.trailTimer = 0;
        this.isCinematic = true; 

        this.state = 'idle'; 
        this.stateTimer = 3.0; 
        this.attackIndex = 0;

        this.recentDamage = 0;
        this.recentDamageTimer = 0;
        this.invulnerable = false;

        this.spinningSlashes = [];
        this.thrownSwords = [];
        this.waveSpawnTimers = [];
        
        this.warningLineActive = false;
        this.screenSplitActive = false;
        this.screenSplitTimer = 0;
        this.splitDirection = 1; 
        this.screenSplitOffset = 100; 
        this.currentOffset = 0;
        this.targetOffset = 0;
        
        this.freezeMouse = false;
        this.freezeX = 0;
        this.freezeY = 0;

        BossHealthBarHandler.registerBoss(this);
    }

    update(dt) {
        this.time += dt / 1.25; 

        if (this.recentDamageTimer > 0) {
            this.recentDamageTimer -= dt;
            if (this.recentDamageTimer <= 0) this.recentDamage = 0;
        }

        if (this.isCinematic) {
            this.y = 300 + Math.cos(this.time * 3) * 20;
        } else if (this.state !== 'repositioning') {
            this.y = 300 + Math.cos(this.time * 3) * 20;
            this.x = 200 + Math.sin(this.time * 2) * 30;
        }

        this.trailTimer += dt;
        if (this.trailTimer > 0.04) {
            this.knightTrail.unshift({ x: this.x, y: this.y, alpha: 0.7 * this.alpha });
            this.trailTimer = 0;
        }
        if (this.knightTrail.length > 15) this.knightTrail.pop();

        for (let i = this.knightTrail.length - 1; i >= 0; i--) {
            let t = this.knightTrail[i];
            t.alpha -= dt * 1.5;
            if (t.alpha <= 0) this.knightTrail.splice(i, 1);
        }

        this.currentOffset += (this.targetOffset - this.currentOffset) * Math.min(1, dt * 6.0);

        if (this.screenSplitActive) {
            this.screenSplitTimer -= dt;
            if (this.screenSplitTimer <= 0) {
                this.screenSplitActive = false;
                this.targetOffset = 0; 
                GameEngine.log("The rift closes!");
            }
        }

        if (this.isCinematic) return;

        const music = getBossMusic();
        if (!music.paused) {
            music.volume = Config.data.musicVolume ?? 0.3;
        }

        this._updateState(dt);
        this._updateProjectiles(dt);
    }

    takeDamage(damage, dmgType, effects) {
        if (this.isCinematic) return 0; 
        if (this.invulnerable) return 0;
        if (this._isImmune(dmgType, effects)) return -1;
        
        this.hp -= damage;
        
        this.recentDamage += damage;
        this.recentDamageTimer = 2.0;
        if (this.recentDamage > this._maxHp * 0.15) {
            this._reposition();
        }

        if (this.hp <= 0) {
            this.alive = false;
            GameEngine.spawnPopEffect(this.x, this.y, '#000000');
            getBossMusic().pause(); 
            BossHealthBarHandler.unregisterBoss(this);
        }
        return damage;
    }
}

Object.assign(KnightEnemy.prototype, KnightRenderer);
Object.assign(KnightEnemy.prototype, KnightAttacks);

export { getBossMusic } from './knightMusic.js';