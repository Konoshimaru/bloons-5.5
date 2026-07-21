// js/bosses/knight.js
import { GameEngine } from '../engine.js';
import { Enemy } from '../enemy.js';
import { EnemyTypes } from '../data.js';
import Assets from '../assets.js';
import { BossHealthBarHandler } from '../BossHealthBarHandler.js';
import { Utils } from '../utils.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants.js';
import { AudioEngine } from '../audio.js'; // FIX: Import AudioEngine for SFX
import { Config } from '../config.js'; // FIX: Import Config for volume sliders

// --- KNIGHT CONFIG ---
export const knightScale = 1.65; 
export const trailScale = 1.21;  

let _bossMusic = null;
export function getBossMusic() {
    if (!_bossMusic) {
        _bossMusic = new Audio('music/boss/blackknife.mp3');
        _bossMusic.loop = true;
    }
    return _bossMusic;
}

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

        // Boss State Machine
        this.state = 'idle'; 
        this.stateTimer = 3.0; 
        this.attackIndex = 0;

        // Flinch / Repositioning
        this.recentDamage = 0;
        this.recentDamageTimer = 0;
        this.invulnerable = false;

        // Attack Specifics
        this.spinningSlashes = [];
        this.thrownSwords = [];
        this.waveSpawnTimers = [];
        
        // Screen Split Effect
        this.warningLineActive = false;
        this.screenSplitActive = false;
        this.screenSplitTimer = 0;
        this.splitDirection = 1; 
        this.screenSplitOffset = 100; 
        this.currentOffset = 0;
        this.targetOffset = 0;
        
        // Mouse Freeze
        this.freezeMouse = false;
        this.freezeX = 0;
        this.freezeY = 0;

        BossHealthBarHandler.registerBoss(this);
    }

    update(dt) {
        this.time += dt / 1.25; 

        // Flinch Tracking
        if (this.recentDamageTimer > 0) {
            this.recentDamageTimer -= dt;
            if (this.recentDamageTimer <= 0) this.recentDamage = 0;
        }

        // Float constantly, unless teleporting
        if (this.isCinematic) {
            this.y = 300 + Math.cos(this.time * 3) * 20;
        } else if (this.state !== 'repositioning') {
            this.y = 300 + Math.cos(this.time * 3) * 20;
            this.x = 200 + Math.sin(this.time * 2) * 30;
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

        // Smoothly ease the screen split offset
        this.currentOffset += (this.targetOffset - this.currentOffset) * Math.min(1, dt * 6.0);

        // Screen Split Timer
        if (this.screenSplitActive) {
            this.screenSplitTimer -= dt;
            if (this.screenSplitTimer <= 0) {
                this.screenSplitActive = false;
                this.targetOffset = 0; // Ease back to normal
                GameEngine.log("The rift closes!");
            }
        }

        if (this.isCinematic) return;

        // FIX: Sync boss music volume with slider
        const music = getBossMusic();
        if (!music.paused) {
            music.volume = Config.data.musicVolume ?? 0.3;
        }

        this._updateState(dt);
        this._updateProjectiles(dt);
    }

    _updateState(dt) {
        this.stateTimer -= dt;

        if (this.state === 'idle') {
            if (this.stateTimer <= 0) {
                this.attackIndex = (this.attackIndex + 1) % 3;
                if (this.attackIndex === 0) this._startSpinningSlashes();
                else if (this.attackIndex === 1) this._startScreenSplit();
                else this._startSwordThrow();
            }
        } else if (this.state === 'spinning_slashes') {
            if (this.stateTimer <= 0) {
                this._executeSpinningSlashes();
                this.state = 'idle';
                this.stateTimer = 4.0; 
            }
        } else if (this.state === 'split_prep') {
            if (this.stateTimer <= 0) {
                this.state = 'split_warning';
                this.stateTimer = 2.0; 
                this.warningLineActive = true;
                if (Math.abs(GameEngine.mouse.y - 360) < 40) {
                    this.freezeMouse = true;
                    this.freezeX = GameEngine.mouse.x;
                    this.freezeY = GameEngine.mouse.y;
                }
                GameEngine.log("The rift opens!");
            }
        } else if (this.state === 'split_warning') {
            if (this.stateTimer <= 0) {
                this.state = 'split_active';
                this.stateTimer = 5.0; 
                this.warningLineActive = false;
                this.freezeMouse = false;
                this.screenSplitActive = true;
                this.screenSplitTimer = 5.0;
                this.splitDirection = Math.random() < 0.5 ? 1 : -1;
                this.targetOffset = this.screenSplitOffset * this.splitDirection;
                GameEngine.log("Reality shatters!");
            }
        } else if (this.state === 'split_active') {
            if (this.stateTimer <= 0) {
                this.state = 'idle';
                this.stateTimer = 5.0;
                this.screenSplitActive = false;
            }
        } else if (this.state === 'sword_throw') {
            for (let i = this.waveSpawnTimers.length - 1; i >= 0; i--) {
                if (this.stateTimer <= this.waveSpawnTimers[i]) {
                    this._spawnSwordWave(i + 1); 
                    this.waveSpawnTimers.splice(i, 1);
                }
            }
            if (this.stateTimer <= 0) {
                this.state = 'idle';
                this.stateTimer = 4.0;
            }
        } else if (this.state === 'repositioning') {
            if (this.stateTimer <= 0) {
                this.invulnerable = false;
                this.state = 'idle';
                this.stateTimer = 1.0;
            }
        }
    }

    _updateProjectiles(dt) {
        for (let i = this.spinningSlashes.length - 1; i >= 0; i--) {
            let s = this.spinningSlashes[i];
            if (s.phase === 'spin') {
                s.spinTimer += dt;
                let progress = Math.min(1, s.spinTimer / s.maxSpinTime);
                s.alpha = progress; 
                s.currentSpeed = s.spinSpeed * progress; 
                s.angle += s.currentSpeed * dt;
            } else if (s.phase === 'dash') {
                s.pivotX += s.vx * dt;
                s.pivotY += s.vy * dt;
                s.life -= dt;
                
                let p1x = s.pivotX - Math.cos(s.angle) * s.length;
                let p1y = s.pivotY - Math.sin(s.angle) * s.length;
                let p2x = s.pivotX + Math.cos(s.angle) * s.length;
                let p2y = s.pivotY + Math.sin(s.angle) * s.length;
                let distToMouse = Utils.distToSegment(GameEngine.mouse.x, GameEngine.mouse.y, p1x, p1y, p2x, p2y);
                
                if (distToMouse < 25 && !s.hit) {
                    s.hit = true;
                    GameEngine.log("Cursor Slash! Towers near cursor stunned.");
                    AudioEngine.playSfx('moab_hit'); // SFX
                    for (let t of GameEngine.towers) {
                        if (t && Utils.withinRange(t.x, t.y, GameEngine.mouse.x, GameEngine.mouse.y, 100)) {
                            t.buffedFireRate = -1; 
                            t.stunTimer = 3.0;
                        }
                    }
                    GameEngine.addCash(-500); 
                }

                s.alpha = Math.max(0, s.life / 0.5);

                if (s.life <= 0) {
                    this.spinningSlashes.splice(i, 1);
                }
            }
        }

        for (let i = this.thrownSwords.length - 1; i >= 0; i--) {
            let s = this.thrownSwords[i];
            s.life -= dt;

            if (s.isCursorSword) {
                if (s.phase === 'track') {
                    s.timer -= dt;
                    let targetY = GameEngine.mouse.y;
                    s.y += (targetY - s.y) * Math.min(1, dt * 10.0);
                    
                    if (s.timer <= 0.2) s.phase = 'lock';
                } else if (s.phase === 'lock') {
                    s.timer -= dt;
                    if (s.timer <= 0) {
                        s.phase = 'dash';
                        s.vx = 1800;
                        AudioEngine.playSfx('shoot'); // SFX
                    }
                } else if (s.phase === 'dash') {
                    s.x += s.vx * dt;
                    
                    for (let t of GameEngine.towers) {
                        if (t && t.alive && Utils.withinRange(s.x, s.y, t.x, t.y, t.hitRadius + 20)) {
                            this._hitTower(t);
                            s.life = 0; 
                            break;
                        }
                    }
                }
            }

            if (s.life <= 0 || s.x > CANVAS_WIDTH + 100) {
                this.thrownSwords.splice(i, 1);
            }
        }
    }

    _startSpinningSlashes() {
        GameEngine.log("Black Knight: Spinning Slashes!");
        AudioEngine.playSfx('moab_hit'); // SFX
        this.state = 'spinning_slashes';
        this.stateTimer = 2.5; 
        let dir = Math.random() < 0.5 ? 1 : -1;
        
        for (let i = 0; i < 2; i++) {
            this.spinningSlashes.push({
                phase: 'spin',
                pivotX: GameEngine.mouse.x,
                pivotY: GameEngine.mouse.y,
                angle: (i / 2) * Math.PI,
                spinSpeed: dir * 4, 
                currentSpeed: 0,
                length: CANVAS_WIDTH * 1.5,
                alpha: 0,
                vx: 0, vy: 0,
                life: 0.5, 
                hit: false,
                maxSpinTime: 2.5,
                spinTimer: 0
            });
        }
    }

    _executeSpinningSlashes() {
        for (let s of this.spinningSlashes) {
            if (s.phase === 'spin') {
                s.phase = 'dash';
                s.vx = Math.cos(s.angle) * 1500;
                s.vy = Math.sin(s.angle) * 1500;
            }
        }
    }

    _startScreenSplit() {
        GameEngine.log("Black Knight: Dimensional Rift...");
        AudioEngine.playSfx('moab_destroy'); // SFX
        this.state = 'split_prep';
        this.stateTimer = 1.0; 
    }

    _startSwordThrow() {
        GameEngine.log("Black Knight: Sword Throw!");
        AudioEngine.playSfx('shoot'); // SFX
        this.state = 'sword_throw';
        this.stateTimer = 3.0; 
        this.waveSpawnTimers = [2.8, 1.8, 0.8];
    }

    _spawnSwordWave(count) {
        for (let i = 0; i < count; i++) {
            let yOffset = (i - (count - 1) / 2) * 50; 
            this.thrownSwords.push({
                phase: 'track',
                timer: 1.2, 
                x: -50 - i * 40,
                y: GameEngine.mouse.y + yOffset,
                vx: 0,
                angle: 0,
                life: 5.0,
                isCursorSword: true
            });
        }
    }

    _hitTower(tower) {
        // FIX: Only sell tier 3 and below. Tier 4/5 are immune to sell.
        let isHighTier = tower.upgrades.some(u => u >= 4);
        
        if (!isHighTier && Math.random() < 0.5) {
            GameEngine.log("Sword Strike! " + tower.stats.name + " was sold!");
            AudioEngine.playSfx('cash'); // SFX
            let resaleRate = 0.50;
            GameEngine.addCash(Math.floor(tower.totalSpent * resaleRate));
            const idx = GameEngine.towers.indexOf(tower);
            if (idx > -1) GameEngine.towers.splice(idx, 1);
            if (GameEngine.selectedPlacedTower === tower) GameEngine.deselectAll();
            GameEngine.spawnPopEffect(tower.x, tower.y, '#f1c40f');
        } else {
            GameEngine.log("Sword Strike! " + tower.stats.name + " was stunned!");
            AudioEngine.playSfx('frozen_hit'); // SFX
            tower.stunTimer = 8.0;
            tower.buffedFireRate = -1; 
        }
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

    _reposition() {
        GameEngine.log("Black Knight vanishes!");
        this.invulnerable = true;
        this.state = 'repositioning';
        this.stateTimer = 1.0;
        this.recentDamage = 0;
        
        let attempts = 0;
        while (attempts < 10) {
            let nx = 100 + Math.random() * (CANVAS_WIDTH - 400);
            let ny = 100 + Math.random() * (CANVAS_HEIGHT - 200);
            if (!GameEngine.map.isOnPath(nx, ny) && !GameEngine.map.isOnProp(nx, ny)) {
                this.x = nx;
                this.y = ny;
                break;
            }
            attempts++;
        }
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

        for (let s of this.spinningSlashes) {
            ctx.save();
            ctx.globalAlpha = s.alpha;
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
            ctx.lineWidth = 8;
            ctx.shadowColor = '#e74c3c';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            let p1x = s.pivotX - Math.cos(s.angle) * s.length;
            let p1y = s.pivotY - Math.sin(s.angle) * s.length;
            let p2x = s.pivotX + Math.cos(s.angle) * s.length;
            let p2y = s.pivotY + Math.sin(s.angle) * s.length;
            ctx.moveTo(p1x, p1y);
            ctx.lineTo(p2x, p2y);
            ctx.stroke();
            
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(p1x, p1y);
            ctx.lineTo(p2x, p2y);
            ctx.stroke();
            ctx.restore();
        }

        for (let s of this.thrownSwords) {
            if (s.isCursorSword && (s.phase === 'track' || s.phase === 'lock')) {
                ctx.save();
                ctx.strokeStyle = s.phase === 'lock' ? 'rgba(231, 76, 60, 1)' : 'rgba(231, 76, 60, 0.5)';
                ctx.lineWidth = 3;
                ctx.setLineDash([15, 10]);
                ctx.beginPath();
                ctx.moveTo(s.x + 20, s.y);
                ctx.lineTo(CANVAS_WIDTH, s.y);
                ctx.stroke();
                ctx.restore();
            }

            let swordAsset = Assets.get('proj_knightsword');
            if (swordAsset && swordAsset.loaded) {
                ctx.save();
                ctx.translate(s.x, s.y);
                ctx.rotate(0); 
                let w = swordAsset.width * 1.5;
                let h = swordAsset.height * 1.5;
                ctx.drawImage(swordAsset, -w / 2, -h / 2, w, h);
                ctx.restore();
            } else {
                ctx.save();
                ctx.translate(s.x, s.y);
                ctx.fillStyle = '#bdc3c7';
                ctx.fillRect(-20, -4, 40, 8);
                ctx.fillStyle = '#7f8c8d';
                ctx.fillRect(15, -8, 10, 16);
                ctx.restore();
            }
        }

        ctx.imageSmoothingEnabled = originalSmoothing;
    }
}