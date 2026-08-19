// js/bosses/knight.js
import { GameEngine } from '../engine.js';
import { Enemy } from '../enemy.js';
import { EnemyTypes } from '../data.js';
import { BossHealthBarHandler } from '../BossHealthBarHandler.js';
import { Config } from '../config.js';
import { UI } from '../ui.js';
import { AudioEngine } from '../audio.js';
import { TUNING } from '../tuning.js';
import { getBossMusic } from './knightMusic.js';
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

        this.homeX = 200;
        this.homeY = 300;
        this.ballTravel = null;
        this.spriteAnimName = null;
        this.spriteAnimFrame = 1;
        this.spriteAnimTimer = 0;
        this.spriteAnimReverse = false; // point lowers back down once the throw is released
        this.pointRelease = false;      // set when sword_throw ends so the point anim reverses
        this.flyPhase = null;    // null | 'transition' | 'fly' (death exit)
        this.flyElapsed = 0;     // time since the fly-away started
        this.slashBackup = 0;    // 0..1 how far the knight has backed away while readying
        this.slashFired = false;   // set when the spinning slashes dash (wind-up ends)

        BossHealthBarHandler.registerBoss(this);
    }

    update(dt) {
        this.time += dt / 1.25; 

        // Flinch Tracking
        if (this.recentDamageTimer > 0) {
            this.recentDamageTimer -= dt;
            if (this.recentDamageTimer <= 0) this.recentDamage = 0;
        }

        // --- DEATH SEQUENCE ---
        if (this.state === 'dying') {
            this.stateTimer -= dt;
            this.alpha = Math.max(0, this.stateTimer / 3.0);
            
            // Shake violently
            this.x = this.homeX + (Math.random() - 0.5) * 15;
            this.y = this.homeY + (Math.random() - 0.5) * 15;

            // Spawn constant explosions
            if (Math.random() < 0.4) {
                let ex = this.x + (Math.random() - 0.5) * 120;
                let ey = this.y + (Math.random() - 0.5) * 120;
                GameEngine.explosions.push({ x: ex, y: ey, radius: 0, maxRadius: 80, life: 0.5, maxLife: 0.5, color: '#9b59b6' });
                GameEngine.spawnPopEffect(ex, ey, '#9b59b6');
            }

            // Final Detonation (Only runs once! The knight survives this so
            // he can play the fly-away exit before being removed.)
            if (this.stateTimer <= 0 && !this.isDyingComplete) {
                getBossMusic().pause(); 
                BossHealthBarHandler.unregisterBoss(this);
                
                // Massive final explosion
                GameEngine.explosions.push({ x: this.x, y: this.y, radius: 0, maxRadius: 400, life: 1.5, maxLife: 1.5, color: '#000000' });
                GameEngine.explosions.push({ x: this.x, y: this.y, radius: 0, maxRadius: 250, life: 1.0, maxLife: 1.0, color: '#9b59b6' });
                GameEngine.spawnPopEffect(this.x, this.y, '#000000');
                
                GameEngine.log("The Black Knight has been vanquished!");
                
                // Transition to the fly-away exit instead of disappearing.
                // Start invisible (the dying sequence already faded him out)
                // and let _updateFlyAway fade him back in as he ascends.
                this.state = 'flying_away';
                this.alpha = 0;
                this.flyPhase = null;
                this.flyElapsed = 0;
                this.knightTrail = [];
            }
            return; 
        }

        // --- FLY-AWAY (death exit) ---
        if (this.state === 'flying_away') {
            this._updateFlyAway(dt);
            return;
        }

        // Float constantly around homeX/homeY, unless teleporting
        if (this.isCinematic) {
            this.y = 300 + Math.cos(this.time * 3) * 20;
        } else if (this.state !== 'repositioning') {
            // Back up away from the cursor while readying the spinning
            // slashes (wind-up pose), then step back in once they're flying.
            const slashCfg = TUNING.bossAnim.sprites.slash;
            const targetBackup = this.state === 'spinning_slashes' ? 1 : 0;
            this.slashBackup += (targetBackup - this.slashBackup) * Math.min(1, dt * slashCfg.backupSpeed);
            const bx = this.x - GameEngine.mouse.x;
            const by = this.y - GameEngine.mouse.y;
            const bdist = Math.max(1, Math.hypot(bx, by));
            this.x = this.homeX + Math.sin(this.time * 2) * 30 - (bx / bdist) * slashCfg.backupDist * this.slashBackup;
            this.y = this.homeY + Math.cos(this.time * 3) * 20 - (by / bdist) * slashCfg.backupDist * this.slashBackup;
        }

        // Update Trail
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
        this._updateFightSprite(dt);
    }

    takeDamage(damage, dmgType, effects) {
        if (this.isCinematic) return 0; 
        if (this.invulnerable) return 0;
        if (this.state === 'dying') return 0; 
        if (this._isImmune(dmgType, effects)) return -1;
        
        this.hp -= damage;
        
        this.recentDamage += damage;
        this.recentDamageTimer = 2.0;
        
        if (this.recentDamage > this._maxHp * 0.02) {
            this._reposition();
        }

        // --- TRIGGER DEATH SEQUENCE ---
        if (this.hp <= 0) {
            this.hp = 0;
            this.state = 'dying';
            this.stateTimer = 3.0; 
            this.invulnerable = true;
            
            this.spinningSlashes = [];
            this.thrownSwords = [];
            this.screenSplitActive = false;
            this.targetOffset = 0;
            this.freezeMouse = false;
            
            GameEngine.log("Black Knight: Impossible... I am... defeated...");
            AudioEngine.playSfx('moab_destroy');
            
            Config.data.monkeyMoney = (Config.data.monkeyMoney || 0) + 250;
            Config.save();
            GameEngine.addCash(5000);
            GameEngine.updateUI();
            if (UI.updateMetaStats) UI.updateMetaStats();
        }
        return damage;
    }
}

Object.assign(KnightEnemy.prototype, KnightAttacks);

export { getBossMusic } from './knightMusic.js';
