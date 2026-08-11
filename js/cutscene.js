// js/cutscene.js
import { GameEngine } from './engine.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import Assets from './assets.js';
import { Config } from './config.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';
import { KnightEnemy, getBossMusic } from './bosses/knight.js'; 
import CutsceneBalls from './bosses/cutsceneBalls.js';
import { BossHealthBarHandler } from './BossHealthBarHandler.js';

// --- CONFIG ---
const slashScale = 1.5;  

const PHASE_TENSION_DURATION = 1.5; 
const PHASE_SLASH_DURATION = 0.7;
const PHASE_RIP_WAIT_DURATION = 0.4;
const PHASE_RIP_DURATION = 0.8;
const PHASE_PAN_DURATION = 1.2;
const PHASE_REVEAL_DURATION = 1.5;


Assets.get('enemy_knight_front');
Assets.get('enemy_knight_back');
for (let i = 1; i <= 14; i++) {
    Assets.get(`effect_slash_${i}`);
}

const offscreenCanvas = document.createElement('canvas');
offscreenCanvas.width = CANVAS_WIDTH;
offscreenCanvas.height = CANVAS_HEIGHT;
const offCtx = offscreenCanvas.getContext('2d');

export const CutsceneManager = {
    state: 'idle',
    timer: 0,
    target: null,
    knightEnemy: null, 
    ripProgress: 0,
    cameraOffsetX: 0,
    cameraTargetX: 500, 

    reset() {
        this.state = 'idle';
        this.timer = 0;
        this.target = null;
        this.ripProgress = 0;
        this.knightEnemy = null;
        this.cameraOffsetX = 0;
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
        this.timer = PHASE_TENSION_DURATION; 
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
            
            let progress = 1 - (this.timer / PHASE_TENSION_DURATION);
            let shakeAmount = progress * 25; 
            this.target.x += (Math.random() - 0.5) * shakeAmount;
            this.target.y += (Math.random() - 0.5) * shakeAmount;
            
            if (this.timer <= 0) {
                AudioEngine.pause(); 
                this.state = 'slashing';
                this.timer = PHASE_SLASH_DURATION;
                
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
                this.timer = PHASE_RIP_WAIT_DURATION; 
            }
        }
        else if (this.state === 'waiting_to_rip') {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.state = 'ripping';
                this.timer = PHASE_RIP_DURATION; 
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
                this.knightEnemy.sprite = 'enemy_knight_back';
                GameEngine.enemies.push(this.knightEnemy);
                
                this.state = 'panning_to_knight'; 
                this.timer = PHASE_PAN_DURATION; 
            }
        }
        else if (this.state === 'panning_to_knight') {
            this.timer -= dt;
            let progress = 1 - (this.timer / PHASE_PAN_DURATION); 
            this.cameraOffsetX = this.cameraTargetX * progress;
            
            if (this.timer <= 0) {
                this.cameraOffsetX = this.cameraTargetX;
                this.state = 'knight_revealed'; 
                this.timer = PHASE_REVEAL_DURATION; 
            }
        }
        else if (this.state === 'knight_revealed') {
            this.timer -= dt;
            if (this.timer < 0.75) {
                this.knightEnemy.sprite = 'enemy_knight_front';
            }
            if (this.timer <= 0) {
                this.state = 'panning_back';
                this.timer = PHASE_PAN_DURATION; 
            }
        }
        else if (this.state === 'panning_back') {
            this.timer -= dt;
            let progress = 1 - (this.timer / PHASE_PAN_DURATION); 
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

    drawBalls(ctx) {
        if (this.state === 'knight_floating') {
            CutsceneBalls.draw(ctx);
        }
    },

    draw(ctx) {
        if (this.state === 'idle') return;

        let originalSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;

        if (['slashing', 'waiting_to_rip', 'ripping'].includes(this.state)) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            if (this.target) {
                offCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                offCtx.imageSmoothingEnabled = false;
                
                let originalMaxHp = this.target._maxHp;
                this.target._maxHp = this.target.hp;
                this.target.draw(offCtx);
                this.target._maxHp = originalMaxHp;
                
                offCtx.globalCompositeOperation = 'source-in';
                offCtx.fillStyle = 'white';
                offCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                offCtx.globalCompositeOperation = 'source-over';

                if (this.state === 'slashing' || this.state === 'waiting_to_rip') {
                    ctx.drawImage(offscreenCanvas, 0, 0);
                } else if (this.state === 'ripping') {
                    let t = this.ripProgress;
                    let drop = t * t * 1000; 
                    let spread = t * 200;
                    let rot = t * 6;

                    ctx.save();
                    ctx.translate(this.target.x - spread, this.target.y + drop);
                    ctx.rotate(-rot);
                    ctx.beginPath();
                    ctx.rect(-200, -200, 200, 400); 
                    ctx.clip();
                    ctx.drawImage(offscreenCanvas, -this.target.x, -this.target.y);
                    ctx.restore();

                    ctx.save();
                    ctx.translate(this.target.x + spread, this.target.y + drop);
                    ctx.rotate(rot);
                    ctx.beginPath();
                    ctx.rect(0, -200, 200, 400); 
                    ctx.clip();
                    ctx.drawImage(offscreenCanvas, -this.target.x, -this.target.y);
                    ctx.restore();
                }
            }
        }

        if (this.state === 'slashing' && this.target) {
            let progress = 1 - (this.timer / PHASE_SLASH_DURATION); 
            let frame = Math.min(14, Math.floor(progress * 14) + 1);
            
            ctx.save();
            ctx.translate(this.target.x, this.target.y);
            ctx.scale(-1, 1);
            
            let slashAsset = Assets.get(`effect_slash_${frame}`);
            if (slashAsset && slashAsset.loaded) {
                let w = slashAsset.width * slashScale;
                let h = slashAsset.height * slashScale;
                ctx.drawImage(slashAsset, -w / 2, -h / 2, w, h);
            }
            ctx.restore();
        }
        
        if (this.knightEnemy) {
            this.knightEnemy.draw(ctx);
        }

        ctx.imageSmoothingEnabled = originalSmoothing;
    }
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

window.applyBallsConfig = function() {
    CutsceneBalls.init();
    console.log("✅ Balls config applied!");
};
