// js/bosses/knightAttacks.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants.js';
import { AudioEngine } from '../audio.js';

const KnightAttacks = {
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
                
                // STUN LOGIC: Stun towers caught in the center line
                AudioEngine.playSfx('moab_hit');
                for (let t of GameEngine.towers) {
                    if (t && Math.abs(t.y - 360) < 60) {
                        t.stunTimer = 3.0;
                        t.buffedFireRate = -1; 
                    }
                }
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
    },

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
                    AudioEngine.playSfx('moab_hit');
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
                        AudioEngine.playSfx('shoot');
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
    },

    _startSpinningSlashes() {
        GameEngine.log("Black Knight: Spinning Slashes!");
        AudioEngine.playSfx('moab_hit');
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
    },

    _executeSpinningSlashes() {
        for (let s of this.spinningSlashes) {
            if (s.phase === 'spin') {
                s.phase = 'dash';
                s.vx = Math.cos(s.angle) * 1500;
                s.vy = Math.sin(s.angle) * 1500;
            }
        }
    },

    _startScreenSplit() {
        GameEngine.log("Black Knight: Dimensional Rift...");
        AudioEngine.playSfx('moab_destroy');
        this.state = 'split_prep';
        this.stateTimer = 1.0; 
    },

    _startSwordThrow() {
        GameEngine.log("Black Knight: Sword Throw!");
        AudioEngine.playSfx('shoot');
        this.state = 'sword_throw';
        this.stateTimer = 3.0; 
        this.waveSpawnTimers = [2.8, 1.8, 0.8];
    },

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
    },

    _hitTower(tower) {
        let isHighTier = tower.upgrades.some(u => u >= 4);
        
        if (!isHighTier && Math.random() < 0.5) {
            GameEngine.log("Sword Strike! " + tower.stats.name + " was sold!");
            AudioEngine.playSfx('cash');
            let resaleRate = 0.50;
            GameEngine.addCash(Math.floor(tower.totalSpent * resaleRate));
            const idx = GameEngine.towers.indexOf(tower);
            if (idx > -1) GameEngine.towers.splice(idx, 1);
            if (GameEngine.selectedPlacedTower === tower) GameEngine.deselectAll();
            GameEngine.spawnPopEffect(tower.x, tower.y, '#f1c40f');
        } else {
            GameEngine.log("Sword Strike! " + tower.stats.name + " was stunned!");
            AudioEngine.playSfx('frozen_hit');
            tower.stunTimer = 8.0;
            tower.buffedFireRate = -1; 
        }
    },

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
};

export default KnightAttacks;