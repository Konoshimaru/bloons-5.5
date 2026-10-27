// js/bosses/knight.js
import { spawnExplosion } from '../combat.js';
import { GameEngine } from '../engineRef.js';
import { Enemy } from '../enemy.js';
import { EnemyTypes } from '../data.js';
import { BossHealthBarHandler } from '../BossHealthBarHandler.js';
import { Config } from '../config.js';
import { UI } from '../ui.js';
import { AudioEngine } from '../audio.js';
import { TUNING } from '../tuning.js';
import { getBossMusic } from './knightMusic.js';
import KnightAttacks from './knightAttacks.js';

// Silhouette tuning (v1.3.2): a ghost only spawns when the knight has moved
// at least GHOST_MIN_DISPLACEMENT px since the previous ghost (the idle
// hover-bob peaks at ~66 px/s = ~7px per 0.11s interval, so 9px filters the
// bob out while real walks/rolls still trail), and every ghost drifts
// sideways up to GHOST_LATERAL_DRIFT px/s while fading.
const GHOST_MIN_DISPLACEMENT = 9;
const GHOST_MIN_DISPLACEMENT_SQ = GHOST_MIN_DISPLACEMENT * GHOST_MIN_DISPLACEMENT;
const GHOST_LATERAL_DRIFT = 15; // px/s

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
        // Silhouette gating (v1.3.2): ghosts only spawn when the knight has
        // actually displaced since the previous one - the idle hover-bob and
        // the cutscene's in-place animation frames used to spawn a flickering
        // pile of stacked silhouettes because the game "thought" he was moving.
        this._lastGhostX = this.x;
        this._lastGhostY = this.y;
        this.isCinematic = true; 
        // [REGRESSION GUARD | upstream 4e2bd10 "confirming knight fix update"] The Knight moves
        // on his own — without this flag every tower aims at the START OF THE PATH instead of
        // at him (see computeLeadAim in towerBehavior.js). Pinned by tests/gitsniperfixes.test.js.
        this.followsPath = false;   // he moves on his own: towers must aim at him, not along the map path

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
        // [REGRESSION GUARD | upstream d29d4af] Point-anim hold-and-release (sword-throw pose
        // holds at peak until the throw ends) — pinned by tests/gitsniperfixes.test.js.
        this.pointRelease = false;      // set when sword_throw ends so the point anim reverses
        this.flyPhase = null;    // null | 'transition' | 'fly' (death exit)
        this.flyElapsed = 0;     // time since the fly-away started
        this.slashBackup = 0;    // 0..1 how far the knight has backed away while readying
        this.slashBackupDirX = 0;  // away-from-cursor direction, captured ONCE at attack
        this.slashBackupDirY = -1; // start and frozen (the knight never chases the cursor)
        this.slashFired = false;   // set when a spinning-slashes volley dashes
        this.slashSwinging = false; // body swing in progress (set per release, cleared at the last swing frame)
        // Multi-volley spinning slashes: the attack chains volleys of
        // spin→release instead of a single 2.5s spin (see knightAttacks.js).
        this.slashVolley = 0;      // volleys released so far this attack
        this.slashVolleys = TUNING.bossAnim.sprites.slash.volleys;
        this.slashVolleyTimer = 0; // time until the current volley releases
        this.slashCursorHit = false; // one cursor punish per release (shared by both lines)
        // Screen-split slash choreography: windup during prep/warning, swing
        // on the shatter, hold, lower, stand.
        this.splitSlashFired = false;
        this.splitSlashDone = false;
        this.splitSlashTimer = 0;

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
                spawnExplosion(GameEngine, ex, ey, 80, 0.5, '#9b59b6');
                GameEngine.spawnPopEffect(ex, ey, '#9b59b6');
            }

            // Final Detonation (Only runs once! The knight survives this so
            // he can play the fly-away exit before being removed.)
            if (this.stateTimer <= 0 && !this.isDyingComplete) {
                getBossMusic().pause(); 
                BossHealthBarHandler.unregisterBoss(this);
                
                // Massive final explosion
                spawnExplosion(GameEngine, this.x, this.y, 400, 1.5, '#000000');
                spawnExplosion(GameEngine, this.x, this.y, 250, 1.0, '#9b59b6');
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
            // slashes (wind-up pose), then step back in once they're flying
            // — along the direction frozen when the attack started. Only the
            // slash crosses follow the live cursor; the knight must not.
            this._updateSlashBackup(dt);
        }

        // Update Trail: a ghost spawns only after trailInterval has elapsed
        // AND the knight has moved GHOST_MIN_DISPLACEMENT px since the last
        // ghost (v1.3.2). Each ghost drifts sideways a little while it fades
        // so the trail reads as motion, not a stack.
        this.trailTimer += dt;
        const gdx = this.x - this._lastGhostX;
        const gdy = this.y - this._lastGhostY;
        if (this.trailTimer > TUNING.bossAnim.trailInterval &&
            (gdx * gdx + gdy * gdy) >= GHOST_MIN_DISPLACEMENT_SQ) {
            this.knightTrail.unshift({
                x: this.x, y: this.y, alpha: 0.7 * this.alpha,
                vx: (Math.random() - 0.5) * 2 * GHOST_LATERAL_DRIFT, // ±15 px/s sideways
                vy: (Math.random() - 0.5) * 2 * (GHOST_LATERAL_DRIFT * 0.4),
            });
            this.trailTimer = 0;
            this._lastGhostX = this.x;
            this._lastGhostY = this.y;
        }
        if (this.knightTrail.length > (TUNING.bossAnim.trailCap ?? 15)) this.knightTrail.pop();

        for (let i = this.knightTrail.length - 1; i >= 0; i--) {
            let t = this.knightTrail[i];
            t.x += (t.vx || 0) * dt;
            t.y += (t.vy || 0) * dt;
            // v1.4.2: fade rate from TUNING (1.0/s - ghosts last 1.5x longer
            // than the old hardcoded 1.5, owner ask).
            t.alpha -= dt * (TUNING.bossAnim.trailFadeRate ?? 1.5);
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
