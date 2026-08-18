// js/cutscene.js
import { GameEngine } from './engine.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import Assets from './assets.js';
import { Config } from './config.js';
import { KnightEnemy, getBossMusic } from './bosses/knight.js'; 
import CutsceneBalls from './bosses/cutsceneBalls.js';
import { BossHealthBarHandler } from './BossHealthBarHandler.js';
import { TUNING } from './tuning.js';

// --- CONFIG ---

// Cutscene pacing (phase durations + reveal animation fps) lives in
// js/tuning.js so it can be dialed in live from the console via `window.tuning`
// (e.g. `tuning.bossAnim.knight_back.fps = 6`). These are just aliases read at
// use time, so console tweaks apply immediately.
const P = TUNING.bossAnim.phases;
const KNIGHT_ANIM = TUNING.bossAnim;

function bossFrameKey(anim, frame) {
    // Every boss animation frame is numbered on disk (knight_back_1..19,
    // equip_sword_1..20), so the key is always `boss_<anim>_<frame>`.
    return `boss_${anim}_${frame}`;
}

Assets.get('enemy_knight_front');
for (let i = 1; i <= KNIGHT_ANIM.knight_back.frames; i++) {
    Assets.get(`boss_knight_back_${i}`);
}
for (let i = 1; i <= KNIGHT_ANIM.equip_sword.frames; i++) {
    Assets.get(`boss_equip_sword_${i}`);
}
for (let i = 1; i <= KNIGHT_ANIM.ball.transitionFrames; i++) {
    Assets.get(`boss_ball_transition_${i}`);
}
for (let i = 1; i <= KNIGHT_ANIM.ball.ballFrames; i++) {
    Assets.get(`boss_ball_${i}`);
}
for (const name of ['slash', 'point', 'static']) {
    for (let i = 1; i <= KNIGHT_ANIM.sprites[name].frames; i++) {
        Assets.get(`boss_${name}_${i}`);
    }
}
for (let i = 1; i <= KNIGHT_ANIM.fly.transitionFrames; i++) {
    Assets.get(`boss_fly_transition_${i}`);
}
for (let i = 1; i <= KNIGHT_ANIM.fly.frames; i++) {
    Assets.get(`boss_fly_${i}`);
}

export const CutsceneManager = {
    state: 'idle',
    timer: 0,
    target: null,
    knightEnemy: null, 
    ripProgress: 0,
    cameraOffsetX: 0,
    cameraTargetX: 500, 
    knightAnimName: null,
    knightAnimFrame: 0,
    knightAnimTimer: 0,
    knightAnimDone: false,

    reset() {
        this.state = 'idle';
        this.timer = 0;
        this.target = null;
        this.ripProgress = 0;
        this.knightEnemy = null;
        this.cameraOffsetX = 0;
        this.knightAnimName = null;
        this.knightAnimFrame = 0;
        this.knightAnimTimer = 0;
        this.knightAnimDone = false;
        CutsceneBalls.reset();
        
        for (let i = GameEngine.enemies.length - 1; i >= 0; i--) {
            if (GameEngine.enemies[i] instanceof KnightEnemy) {
                GameEngine.enemies.splice(i, 1);
                break;
            }
        }

        BossHealthBarHandler.activeBosses.length = 0;
        
        const music = getBossMusic();
        music.pause();
        music.currentTime = 0;
    },

    trigger(moabEnemy) {
        if (this.state !== 'idle') return;
        if (moabEnemy.tier !== 13) return; 
        
        moabEnemy.data.splitsInto = []; 
        
        GameEngine.speedState = 0;
        GameEngine.timeScale = 1;
        UI.updateWaveSpeedBtn(0);
        
        this.state = 'tension';
        this.timer = P.tension; 
        this.target = moabEnemy;
    },

    update(dt) {
        const music = getBossMusic();
        if (!music.paused) {
            music.volume = Config.data.musicVolume ?? 0.3;
        }

        if (this.state === 'idle') return false;

        if (this.knightEnemy) {
            if (this.knightEnemy.isDyingComplete || !this.knightEnemy.alive || GameEngine.enemies.indexOf(this.knightEnemy) === -1) {
                this.reset();
                return false;
            }
            this.knightEnemy.update(dt);
        }

        if (CutsceneBalls.blackBalls.length > 0) {
            CutsceneBalls.update(dt);
        }

        if (this.state === 'knight_floating') return false;

        if (this.state === 'tension') {
            this.timer -= dt;
            
            this.target.distanceTraveled += this.target.data.speed * dt;
            let pathIdx = this.target.pathIndex || 0;
            let totalLen = GameEngine.map.getTotalLength(pathIdx);
            
            if (this.target.distanceTraveled > totalLen - 50) {
                this.target.distanceTraveled = totalLen - 50;
            }
            
            const pos = GameEngine.map.getPositionAtDistance(this.target.distanceTraveled, pathIdx);
            this.target.x = pos.x;
            this.target.y = pos.y;
            
            let progress = 1 - (this.timer / P.tension);
            let shakeAmount = progress * 25; 
            this.target.x += (Math.random() - 0.5) * shakeAmount;
            this.target.y += (Math.random() - 0.5) * shakeAmount;
            
            if (this.timer <= 0) {
                AudioEngine.pause(); 
                this.state = 'slashing';
                this.timer = P.slash;
                
                AudioEngine.playSfx('knight_slash_moab');
            }
        }
        else if (this.state === 'slashing') {
            this.timer -= dt;
            if (this.timer <= 0) {
                if (this.target && this.target.alive) {
                    this.target.takeDamage(99999, { isExplosion: true, canHitLead: true });
                }
                this.state = 'waiting_to_rip'; 
                this.timer = P.ripWait; 
            }
        }
        else if (this.state === 'waiting_to_rip') {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.state = 'ripping';
                this.timer = P.rip; 
                this.ripProgress = 0;
            }
        }
        else if (this.state === 'ripping') {
            this.timer -= dt;
            this.ripProgress += dt;
            if (this.timer <= 0) {
                if (this.target) {
                    this.target.alive = false;
                    let idx = GameEngine.enemies.indexOf(this.target);
                    if (idx > -1) GameEngine.enemies.splice(idx, 1);
                }

                this.knightEnemy = new KnightEnemy(-400, 300);
                this.knightEnemy.sprite = bossFrameKey('knight_back', 1);
                GameEngine.enemies.push(this.knightEnemy);
                
                this.state = 'panning_to_knight'; 
                this.timer = P.pan; 
            }
        }
        else if (this.state === 'panning_to_knight') {
            this.timer -= dt;
            let progress = 1 - (this.timer / P.pan); 
            this.cameraOffsetX = this.cameraTargetX * progress;
            
            if (this.timer <= 0) {
                this.cameraOffsetX = this.cameraTargetX;
                this.state = 'knight_revealed'; 
            }
        }
        else if (this.state === 'knight_revealed') {
            this._advanceKnightAnim(dt);
            if (this.knightAnimDone) {
                // Roar -> equip-sword animation finished: turn to face the
                // player and head into the real fight.
                this.knightEnemy.sprite = 'enemy_knight_front';
                this.state = 'panning_back';
                this.timer = P.pan;
            }
        }
        else if (this.state === 'panning_back') {
            this.timer -= dt;
            let progress = 1 - (this.timer / P.pan); 
            this.cameraOffsetX = this.cameraTargetX * (1 - progress);
            
            this.knightEnemy.x = -400 + (600 * progress);
            
            if (this.timer <= 0) {
                this.cameraOffsetX = 0;
                this.knightEnemy.x = 200;
                this.knightEnemy.isCinematic = false; 
                this.state = 'knight_floating';
                
                CutsceneBalls.init();
                
                music.volume = Config.data.musicVolume ?? 0.3;
                music.play().catch(e => console.warn("Boss music blocked:", e));
            }
        }

        return this.state !== 'knight_floating'; 
    },

    _advanceKnightAnim(dt) {
        if (this.knightAnimDone) return;
        if (this.knightAnimName === null) {
            this.knightAnimName = 'knight_back';
            this.knightAnimFrame = 0;
            this.knightAnimTimer = 0;
        }
        this.knightAnimTimer -= dt;
        if (this.knightAnimTimer <= 0) {
            const cfg = KNIGHT_ANIM[this.knightAnimName];
            this.knightAnimTimer += 1 / cfg.fps;
            this.knightAnimFrame++;
            if (this.knightAnimFrame > cfg.frames) {
                if (this.knightAnimName === 'knight_back') {
                    this.knightAnimName = 'equip_sword';
                    this.knightAnimFrame = 1;
                } else {
                    this.knightAnimName = null;
                    this.knightAnimDone = true;
                    return;
                }
            }
        }
        if (this.knightAnimName) {
            this.knightEnemy.sprite = bossFrameKey(this.knightAnimName, this.knightAnimFrame);
        }
    },
};

// --- DEV COMMANDS ---
window.triggerBossCutscene = function() {
    if (!GameEngine.map || GameEngine.gameState !== 'playing') {
        console.error("❌ Cutscene Error: You must be in an active game (not the main menu) to trigger the cutscene!");
        return;
    }
    
    if (CutsceneManager.state !== 'idle') {
        console.error("❌ Cutscene Error: Cutscene is already playing!");
        return;
    }

    console.log("✅ Spawning dummy MOAB and triggering cutscene...");
    let e = GameEngine.enemyPool.get();
    e.init(13, GameEngine.map, false, false, 13, false, null, 0, false);
    e.x = 640;
    e.y = 360;
    GameEngine.enemies.push(e);
    
    CutsceneManager.trigger(e);
};

window.retryCutscene = function() {
    if (!GameEngine.map || GameEngine.gameState !== 'playing') {
        console.error("❌ Cutscene Error: You must be in an active game (not the main menu) to retry the cutscene!");
        return;
    }

    if (CutsceneManager.state !== 'idle') {
        console.log("↻ Resetting current cutscene...");
        CutsceneManager.reset();
    }
    triggerBossCutscene();
};

window.applyBallsConfig = function() {
    CutsceneBalls.init();
    console.log("✅ Balls config applied!");
};
