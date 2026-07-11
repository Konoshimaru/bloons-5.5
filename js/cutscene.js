// js/cutscene.js
import { GameEngine } from './engine.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import Assets from './assets.js';
import { Enemy } from './enemy.js';
import { EnemyTypes } from './data.js';
import { Config, CANVAS_WIDTH, CANVAS_HEIGHT } from './config.js'; // PRO FIX: Import Constants

// --- CONFIG ---
const knightScale = 1.5; 
const trailScale = 1.1; 
const slashScale = 1.5;  

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

// PRO FIX: Use shared constants for offscreen canvas size
const offscreenCanvas = document.createElement('canvas');
offscreenCanvas.width = CANVAS_WIDTH;
offscreenCanvas.height = CANVAS_HEIGHT;
const offCtx = offscreenCanvas.getContext('2d');

const bossMusic = new Audio('music/boss/blackknife.mp3');
bossMusic.loop = true;

export class KnightEnemy extends Enemy {
    constructor(x, y) {
        super(13, GameEngine.map, false, false, 13, false, 1.0);
        this.tier = 99; 
        this.x = x;
        this.y = y;
        this.alpha = 1; 
        this.sprite = 'enemy_knight_back'; 
        this.data = { ...EnemyTypes[13], name: "Black Knight", radius: 45, size: 90, isMoab: true, splitsInto: [] };
        this.hp = 50000; 
        this._maxHp = 50000;
        this.distanceTraveled = 0; 
        this.angle = 0;
        
        this.time = 0; 
        this.knightTrail = [];
        this.trailTimer = 0;
        this.isCinematic = true; 
    }

    update(dt) {
        this.time += dt;
        this.y = 300 + Math.cos(this.time * 3) * 20;

        if (!this.isCinematic) {
            this.x = 200 + Math.sin(this.time * 2) * 30;
        }

        this.trailTimer += dt;
        if (this.trailTimer > 0.04) {
            this.knightTrail.unshift({ x: this.x, y: this.y, alpha: 0.7 * this.alpha });
            this.trailTimer = 0;
        }
        
        if (this.knightTrail.length > 25) this.knightTrail.pop();

        for (let i = this.knightTrail.length - 1; i >= 0; i--) {
            let t = this.knightTrail[i];
            t.x -= 120 * dt; 
            t.y -= 20 * dt;  
            t.alpha -= dt * 0.8;
            if (t.alpha <= 0) this.knightTrail.splice(i, 1);
        }
    }

    takeDamage(damage, dmgType, effects) {
        if (this._isImmune(dmgType, effects)) return -1;
        this.hp -= damage;
        if (this.hp <= 0) {
            this.alive = false;
            GameEngine.spawnPopEffect(this.x, this.y, '#000000');
            bossMusic.pause();
        }
        return damage;
    }

    draw(ctx) {
        let originalSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;

        for (let t of this.knightTrail) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, t.alpha);
            ctx.translate(t.x, t.y);
            ctx.scale(-1, 1);
            let asset = Assets.get('enemy_knight_front');
            if (asset && asset.loaded) {
                let w = asset.width * trailScale;
                let h = asset.height * trailScale;
                ctx.drawImage(asset, -w / 2, -h / 2, w, h);
            }
            ctx.restore();
        }

        ctx.save();
        ctx.globalAlpha = Math.min(1, this.alpha);
        ctx.translate(this.x, this.y);
        ctx.scale(-1, 1);
        let asset = Assets.get(this.sprite);
        if (asset && asset.loaded) {
            let w = asset.width * knightScale;
            let h = asset.height * knightScale;
            ctx.drawImage(asset, -w / 2, -h / 2, w, h);
        }
        ctx.restore();

        ctx.imageSmoothingEnabled = originalSmoothing;
    }
}

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
        
        for (let i = GameEngine.enemies.length - 1; i >= 0; i--) {
            if (GameEngine.enemies[i] instanceof KnightEnemy) {
                GameEngine.enemies.splice(i, 1);
                break;
            }
        }
        
        bossMusic.pause();
        bossMusic.currentTime = 0;
    },

    trigger(moabEnemy) {
        if (this.state !== 'idle') return;
        if (moabEnemy.tier !== 13) return; 
        
        moabEnemy.data.splitsInto = []; 
        
        GameEngine.speedState = 0;
        GameEngine.timeScale = 1;
        UI.updateWaveSpeedBtn(0);
        AudioEngine.pause();
        
        this.state = 'slashing';
        this.timer = PHASE_SLASH_DURATION; 
        this.target = moabEnemy;
    },

    update(dt) {
        if (!bossMusic.paused) {
            bossMusic.volume = Config.data.musicVolume ?? 0.3;
        }

        if (this.state === 'idle' || this.state === 'knight_floating') return false;

        if (this.knightEnemy) {
            this.knightEnemy.update(dt);
        }

        if (this.state === 'slashing') {
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
                
                bossMusic.volume = Config.data.musicVolume ?? 0.3;
                bossMusic.play().catch(e => console.warn("Boss music blocked:", e));
            }
        }

        return this.state !== 'knight_floating'; 
    },

    draw(ctx) {
        if (this.state === 'idle') return;

        let originalSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;

        if (['slashing', 'waiting_to_rip', 'ripping'].includes(this.state)) {
            ctx.fillStyle = '#000000';
            // PRO FIX: Use shared constants
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

        ctx.imageSmoothingEnabled = originalSmoothing;
    }
};