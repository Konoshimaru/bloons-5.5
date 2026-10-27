// js/bosses/knightAttacks.js
import { GameEngine } from '../engineRef.js';
import { Utils } from '../utils.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants.js';
import { AudioEngine } from '../audio.js';
import { TUNING } from '../tuning.js';

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
            // Multi-volley chain: each volley spins up at the cursor for
            // spinTime, then releases (dash). The next cross spawns volleyGap
            // later (the released lines fade during that gap). Driven by
            // slashVolleyTimer, not stateTimer.
            this.slashVolleyTimer -= dt;
            if (this.slashVolleyTimer <= 0) {
                this._executeSpinningSlashes();
                this.slashVolley++;
                if (this.slashVolley < this.slashVolleys) {
                    const cfg = TUNING.bossAnim.sprites.slash;
                    this.slashVolleyTimer = cfg.volleyGap + cfg.spinTime;
                    this._spawnSlashVolley(cfg.volleyGap);
                } else {
                    this.state = 'idle';
                    this.stateTimer = 4.0;
                }
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
                // v1.3.2: the rift used to hang open for 5s; both the state
                // and the visual now share the shorter TUNING duration.
                this.stateTimer = TUNING.bossAnim.splitActive; 
                this.warningLineActive = false;
                this.freezeMouse = false;
                this.screenSplitActive = true;
                this.screenSplitTimer = TUNING.bossAnim.splitActive;
                this.splitDirection = Math.random() < 0.5 ? 1 : -1;
                this.targetOffset = this.screenSplitOffset * this.splitDirection;
                // The shatter IS the slash: release the held wind-up exactly
                // on this frame, then recover (hold the follow-through, lower
                // back down, stand).
                this.splitSlashFired = true;
                this.splitSlashTimer = TUNING.bossAnim.sprites.slash.recoverHold
                    + (TUNING.bossAnim.sprites.slash.frames - TUNING.bossAnim.sprites.slash.windupFrames)
                    / TUNING.bossAnim.sprites.slash.fps;
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
                // The point anim holds its peak frame during the throw, then
                // plays back down once the attack has been released.
                // [REGRESSION GUARD | upstream d29d4af] Release the point anim when the throw
                // state ends — pinned by tests/gitsniperfixes.test.js. DO NOT DELETE.
                this.pointRelease = true;
            }
        } else if (this.state === 'repositioning') {
            // Ball-morph reposition: the knight collapses into a ball, rolls
            // to the new spot, then reforms. Driven by _updateBallTravel.
            this._updateBallTravel(dt);
            if (this.stateTimer <= 0) {
                this.invulnerable = false;
                this.state = 'idle';
                this.stateTimer = 1.0;
                this.ballTravel = null;
                this.sprite = 'enemy_knight_front';
            }
        }
    },

    _updateProjectiles(dt) {
        const projectiles = GameEngine.projectilePool.active;

        // Update Spinning Slashes
        for (let i = this.spinningSlashes.length - 1; i >= 0; i--) {
            let s = this.spinningSlashes[i];
            if (s.phase === 'spin') {
                if (s.delay > 0) {
                    // Queued next volley: invisible and harmless until its
                    // delay elapses (no spin, no projectile erase, no hit).
                    s.delay -= dt;
                    continue;
                }
                s.spinTimer += dt;
                let progress = Math.min(1, s.spinTimer / s.maxSpinTime);
                s.alpha = progress; 
                s.currentSpeed = s.spinSpeed * progress; 
                s.angle += s.currentSpeed * dt;
            } else if (s.phase === 'dash') {
                s.pivotX += s.vx * dt;
                s.pivotY += s.vy * dt;
                s.life -= dt;
                s.alpha = Math.max(0, s.life / 0.5);
            }

            let p1x = s.pivotX - Math.cos(s.angle) * s.length;
            let p1y = s.pivotY - Math.sin(s.angle) * s.length;
            let p2x = s.pivotX + Math.cos(s.angle) * s.length;
            let p2y = s.pivotY + Math.sin(s.angle) * s.length;

            // Erase player projectiles that touch the slash
            for (let j = 0; j < projectiles.length; j++) {
                const p = projectiles[j];
                if (!p || !p.alive) continue;
                let dist = Utils.distToSegment(p.x, p.y, p1x, p1y, p2x, p2y);
                if (dist < 15) { 
                    p.alive = false; 
                    GameEngine.spawnPopEffect(p.x, p.y, '#e74c3c');
                }
            }

            if (s.phase === 'dash') {
                let distToMouse = Utils.distToSegment(GameEngine.mouse.x, GameEngine.mouse.y, p1x, p1y, p2x, p2y);
                if (distToMouse < 25 && !s.hit) {
                    s.hit = true;
                    // Both lines cross the pivot, so without this guard both
                    // would trigger on the same frame — doubled log, SFX and
                    // cash penalty. One punish per release; the flag resets
                    // with the next volley.
                    if (!this.slashCursorHit) {
                        this.slashCursorHit = true;
                        // v1.3.2: the punish scales with the player's wallet -
                        // 10% of CURRENT cash instead of the old flat $500 -
                        // and removeCash flashes the red "-$N" on the counter.
                        const cut = Math.floor((GameEngine.cash || 0) * 0.10);
                        GameEngine.log(`Cursor Slash! Towers near cursor stunned.${cut > 0 ? ` (-$${cut.toLocaleString('en-US')})` : ''}`);
                        AudioEngine.playSfx('moab_hit');
                        for (let t of GameEngine.towers) {
                            if (t && Utils.withinRange(t.x, t.y, GameEngine.mouse.x, GameEngine.mouse.y, 100)) {
                                t.stunTimer = 3.0;
                            }
                        }
                        GameEngine.removeCash(cut);
                    }
                }
            }

            if (s.life <= 0) {
                this.spinningSlashes.splice(i, 1);
            }
        }

        // Update Thrown Swords
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
                        if (t && Utils.withinRange(s.x, s.y, t.x, t.y, t.hitRadius + 20)) {
                            this._hitTower(t);
                            s.life = 0; 
                            break;
                        }
                    }
                }
            }

            // Erase player projectiles that touch the sword
            for (let j = 0; j < projectiles.length; j++) {
                const p = projectiles[j];
                if (!p || !p.alive) continue;
                if (Utils.withinRange(s.x, s.y, p.x, p.y, 20)) { 
                    p.alive = false;
                    GameEngine.spawnPopEffect(p.x, p.y, '#bdc3c7');
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
        const cfg = TUNING.bossAnim.sprites.slash;
        // Freeze the back-away direction for this windup: straight away from
        // where the cursor is RIGHT NOW. Moving the mouse afterwards only
        // re-aims the slash crosses — the knight keeps gliding along this one
        // line, so wiggling the cursor can't swing him around the screen.
        const bx = this.x - GameEngine.mouse.x;
        const by = this.y - GameEngine.mouse.y;
        const bd = Math.hypot(bx, by);
        if (bd >= 1) {
            this.slashBackupDirX = bx / bd;
            this.slashBackupDirY = by / bd;
        }
        this.state = 'spinning_slashes';
        this.stateTimer = 0; // volley timer drives this state
        this.slashVolley = 0;
        this.slashVolleyTimer = cfg.spinTime; // releases the first volley
        this._spawnSlashVolley(0);
    },

    // Spawn one spin→release volley: two screen-spanning lines crossing at
    // the CURRENT cursor position (re-aimed every volley), spinning up over
    // spinTime. `delay` defers the spin start so consecutive volleys chain
    // after the previous lines have flown.
    _spawnSlashVolley(delay = 0) {
        const cfg = TUNING.bossAnim.sprites.slash;
        this.slashFired = false;
        this.slashCursorHit = false;
        const dir = Math.random() < 0.5 ? 1 : -1;
        const base = Math.random() * Math.PI; // random cross orientation per volley
        for (let i = 0; i < 2; i++) {
            this.spinningSlashes.push({
                phase: 'spin',
                delay,
                pivotX: GameEngine.mouse.x,
                pivotY: GameEngine.mouse.y,
                angle: base + (i / 2) * Math.PI,
                spinSpeed: dir * cfg.spinSpeed, 
                currentSpeed: 0,
                length: CANVAS_WIDTH * 1.5,
                alpha: 0,
                vx: 0, vy: 0,
                life: cfg.dashTime, 
                hit: false,
                maxSpinTime: cfg.spinTime,
                spinTimer: 0
            });
        }
    },

    _executeSpinningSlashes() {
        this.slashFired = true;
        this.slashSwinging = true; // body swing plays out even after the next volley arms
        for (let s of this.spinningSlashes) {
            // Only release lines that are actually spinning — a queued next
            // volley (delay > 0) must keep waiting for its own slot.
            if (s.phase === 'spin' && !(s.delay > 0)) {
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
        // Fresh slash choreography: wind up while the rift preps/warns,
        // swing exactly when the screen shatters, then lower back down.
        this.splitSlashFired = false;
        this.splitSlashDone = false;
        this.splitSlashTimer = 0;
        this.spriteAnimReverse = false;
    },

    _startSwordThrow() {
        GameEngine.log("Black Knight: Sword Throw!");
        AudioEngine.playSfx('shoot');
        this.state = 'sword_throw';
        this.stateTimer = 3.0; 
        this.waveSpawnTimers = [2.8, 1.8, 0.8];
        this.pointRelease = false;
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
        let isHero = !!tower.stats.isHero;
        // v1.4.1: the Knight's Sword Strike can never SELL a Paragon. A paragon
        // is worth far too much to cash out at his 50% rate, so he falls
        // through to the stun like any other high-tier tower. (The player can
        // still sell their own paragons normally - this only bars the boss.)
        let isParagon = !!tower.isParagon;

        if (!isHighTier && !isHero && !isParagon && Math.random() < 0.5) {
            GameEngine.log("Sword Strike! " + tower.stats.name + " was sold!");
            AudioEngine.playSfx('cash');
            let resaleRate = 0.50;
            GameEngine.cash += Math.floor(tower.totalSpent * resaleRate);
            const idx = GameEngine.towers.indexOf(tower);
            if (idx > -1) GameEngine.towers.splice(idx, 1);
            if (GameEngine.selectedPlacedTower === tower) GameEngine.deselectAll();
            GameEngine.spawnPopEffect(tower.x, tower.y, '#f1c40f');
        } else {
            GameEngine.log("Sword Strike! " + tower.stats.name + " was stunned!");
            AudioEngine.playSfx('frozen_hit');
            tower.stunTimer = 8.0;
        }
    },

    _reposition() {
        GameEngine.log("Black Knight vanishes!");
        this.state = 'repositioning';
        this.invulnerable = true;
        this.recentDamage = 0;
        
        this.spinningSlashes = [];
        this.thrownSwords = [];
        this.waveSpawnTimers = [];
        this.slashFired = false;
        this.slashSwinging = false;
        this.slashVolley = 0;
        this.slashVolleyTimer = 0;
        this.slashCursorHit = false;
        this.splitSlashFired = false;
        this.splitSlashDone = false;
        this.splitSlashTimer = 0;
        this.pointRelease = false;
        this.warningLineActive = false;
        this.screenSplitActive = false;
        this.targetOffset = 0;
        this.freezeMouse = false;
        
        let attempts = 0;
        let nx = this.homeX;
        let ny = this.homeY;
        while (attempts < 10) {
            let angle = Math.random() * Math.PI * 2;
            let dist = 150 + Math.random() * 200; 
            let tx = this.homeX + Math.cos(angle) * dist;
            let ty = this.homeY + Math.sin(angle) * dist;
            
            tx = Math.max(200, Math.min(CANVAS_WIDTH - 330, tx));
            ty = Math.max(120, Math.min(CANVAS_HEIGHT - 120, ty));
            
            if (!GameEngine.map.isOnPath(tx, ty) && !GameEngine.map.isOnProp(tx, ty)) {
                nx = tx;
                ny = ty;
                break;
            }
            attempts++;
        }
        
        // Ball-morph travel instead of a hard teleport: a static flinch, then
        // collapse knight -> ball (ball_transition played in reverse, since
        // 1..4 is ball -> knight), roll across as ball_1..5, then reform
        // (ball_transition forward).
        const BALL = TUNING.bossAnim.ball;
        const SPRITES = TUNING.bossAnim.sprites;
        this.ballTravel = {
            fromX: this.x,
            fromY: this.y,
            toX: nx,
            toY: ny,
            elapsed: 0,
            duration: BALL.duration,
            flinchTime: SPRITES.flinchTime,
        };
        this.homeX = nx;
        this.homeY = ny;
        this.stateTimer = BALL.duration + SPRITES.flinchTime;
    },

    // Advances the ball-morph reposition: collapse (reverse transition),
    // roll (ball_1..5 loop while moving from -> to), reform (forward
    // transition). `knight.sprite` drives both renderers' body + trail.
_updateBallTravel(dt) {
        const move = this.ballTravel;
        if (!move) return;
        const BALL = TUNING.bossAnim.ball;
        const SPRITES = TUNING.bossAnim.sprites;

        // Static flinch phase: play static_1..N while he recoils from the hit,
        // before collapsing into the ball. Reuses the looped-anim helpers so
        // the trail ghosts follow the static frames too.
        if (move.flinchTime > 0) {
            move.flinchTime -= dt;
            if (move.flinchTime > 0) {
                this._advanceLoopedAnim(dt, 'static');
                this.x = move.fromX;
                this.y = move.fromY;
                return;
            }
        }

        move.elapsed += dt;
        const progress = Math.min(1, move.elapsed / move.duration);
        const collapseEnd = BALL.collapseFrac;
        const travelEnd = collapseEnd + BALL.travelFrac;

        if (progress < collapseEnd) {
            // Collapse: knight -> ball, play transition in reverse.
            const k = progress / collapseEnd;
            const frame = Math.max(1, BALL.transitionFrames - Math.floor(k * BALL.transitionFrames));
            this.sprite = `boss_ball_transition_${frame}`;
            this.x = move.fromX;
            this.y = move.fromY;
        } else if (progress < travelEnd) {
            // Roll: ball_1..5 loop while gliding to the destination.
            const k = (progress - collapseEnd) / (travelEnd - collapseEnd);
            this.x = move.fromX + (move.toX - move.fromX) * k;
            this.y = move.fromY + (move.toY - move.fromY) * k;
            const frame = Math.floor(k * BALL.ballFrames) % BALL.ballFrames + 1;
            this.sprite = `boss_ball_${frame}`;
        } else {
            // Reform: ball -> knight, play transition forward.
            const k = (progress - travelEnd) / (1 - travelEnd);
            const frame = Math.min(BALL.transitionFrames, 1 + Math.floor(k * BALL.transitionFrames));
            this.sprite = `boss_ball_transition_${frame}`;
            this.x = move.toX;
            this.y = move.toY;
        }
    },

    // Advances the death-exit fly-away: plays the fly transition once
    // (fly_transition_1..17), then loops the fly frames (fly_1..4) while the
    // knight rises off the top of the screen. When fully off-screen the death
    // finishes: isDyingComplete + alive=false so CutsceneManager resets, then
    // removes self. `knight.sprite` drives both renderers' body + trail.
    _updateFlyAway(dt) {
        const FLY = TUNING.bossAnim.fly;
        this.flyElapsed += dt;

        if (this.flyPhase === null) {
            this.flyPhase = 'transition';
            this.spriteAnimName = 'fly_transition';
            this.spriteAnimFrame = 1;
            this.spriteAnimTimer = 0;
        }

        this.spriteAnimTimer -= dt;
        while (this.spriteAnimTimer <= 0) {
            this.spriteAnimTimer += 1 / FLY.fps;
            if (this.flyPhase === 'transition') {
                this.sprite = `boss_fly_transition_${this.spriteAnimFrame}`;
                this.spriteAnimFrame++;
                if (this.spriteAnimFrame > FLY.transitionFrames) {
                    this.flyPhase = 'fly';
                    this.spriteAnimFrame = 1;
                }
            } else {
                this.sprite = `boss_fly_${this.spriteAnimFrame}`;
                this.spriteAnimFrame = (this.spriteAnimFrame % FLY.frames) + 1;
            }
        }

        // Rise off the top of the screen with a slight sway, fading back in
        // as he ascends (from the dying sequence's fade-out), then fading
        // out again as he leaves.
        this.x = this.homeX + Math.sin(this.time * 3) * FLY.sway;
        this.y -= FLY.riseSpeed * dt;
        const fadeIn = Math.min(1, this.flyElapsed / FLY.fadeInTime);
        const fadeOut = Math.min(1, Math.max(0, (this.y - FLY.exitY) / 200));
        this.alpha = fadeIn * fadeOut;

        if (this.y < FLY.exitY) {
            this.isDyingComplete = true;
            this.alive = false;
            const idx = GameEngine.enemies.indexOf(this);
            if (idx > -1) GameEngine.enemies.splice(idx, 1);
        }
    },

    // Wind-up positioning for the spinning slashes: while readying, the
    // knight eases back along the away-from-cursor direction captured when
    // the attack started, then steps back home once the volleys are flying.
    // The direction is FROZEN on purpose — only the slash crosses follow the
    // live cursor. (The old code recomputed the offset from the mouse every
    // frame AND pointed it toward the cursor, so the knight chased and swung
    // around wildly whenever the player moved the mouse.)
    _updateSlashBackup(dt) {
        const slashCfg = TUNING.bossAnim.sprites.slash;
        const targetBackup = this.state === 'spinning_slashes' ? 1 : 0;
        this.slashBackup += (targetBackup - this.slashBackup) * Math.min(1, dt * slashCfg.backupSpeed);
        const fx = this.homeX + Math.sin(this.time * 2) * 30;
        const fy = this.homeY + Math.cos(this.time * 3) * 20;
        if (this.slashBackup > 0.001) {
            this.x = fx + this.slashBackupDirX * slashCfg.backupDist * this.slashBackup;
            this.y = fy + this.slashBackupDirY * slashCfg.backupDist * this.slashBackup;
        } else {
            this.x = fx;
            this.y = fy;
        }
    },

    // Advances a looped sprite anim (`slash`, `point`, `static`...) one frame
    // when its timer elapses, wrapping back to frame 1. Resets when the anim
    // name changes. The renderer draws whatever `knight.sprite` is, so this
    // just advances that property.
    _advanceLoopedAnim(dt, animName) {
        if (this.spriteAnimName !== animName) {
            this.spriteAnimName = animName;
            this.spriteAnimFrame = 1;
            this.spriteAnimTimer = 0;
        }
        const cfg = TUNING.bossAnim.sprites[animName];
        this.spriteAnimTimer -= dt;
        if (this.spriteAnimTimer <= 0) {
            this.spriteAnimTimer += 1 / cfg.fps;
            this.sprite = `boss_${animName}_${this.spriteAnimFrame}`;
            this.spriteAnimFrame = (this.spriteAnimFrame % cfg.frames) + 1;
        }
    },

    // Advances a sprite anim through its frames once, holding the peak frame
    // until the attack is released, then plays it back down to frame 1. Used
    // by `point` so the knight raises his sword, holds the throw pose while
    // the swords are out, then lowers it again once the throw ends.
    _advanceOneShotAnim(dt, animName) {
        if (this.spriteAnimName !== animName) {
            this.spriteAnimName = animName;
            this.spriteAnimFrame = 1;
            this.spriteAnimTimer = 0;
            this.spriteAnimReverse = false;
        }
        // The reverse only begins once the throw has been released (state
        // exited); before that the peak frame simply holds in place.
        // [REGRESSION GUARD | upstream d29d4af] Hold-at-peak until released (no ping-pong
        // mid-throw) — pinned by tests/gitsniperfixes.test.js. DO NOT DELETE.
        if (this.pointRelease && !this.spriteAnimReverse) this.spriteAnimReverse = true;
        const cfg = TUNING.bossAnim.sprites[animName];
        this.spriteAnimTimer -= dt;
        if (this.spriteAnimTimer <= 0) {
            this.spriteAnimTimer += 1 / cfg.fps;
            if (!this.spriteAnimReverse) {
                this.sprite = `boss_${animName}_${this.spriteAnimFrame}`;
                if (this.spriteAnimFrame < cfg.frames) this.spriteAnimFrame++;
            } else if (this.spriteAnimFrame > 1) {
                this.spriteAnimFrame--;
                this.sprite = `boss_${animName}_${this.spriteAnimFrame}`;
            } else {
                // Fully lowered: back to the front view.
                this.spriteAnimName = null;
                this.pointRelease = false;
                this.sprite = 'enemy_knight_front';
            }
        }
    },

    // Wind-up / swing slash anim for the spinning slashes: while readying,
    // the animation eases to the wind-up hold frame (down from a previous
    // volley's follow-through, or up from standing) and pauses there. When a
    // volley releases (slashSwinging, set by _executeSpinningSlashes) the
    // swing plays through the remaining frames at anim fps, then the recover
    // walk returns to the ready pose for the next volley.
    _advanceSlashWindup(dt) {
        const cfg = TUNING.bossAnim.sprites.slash;
        if (this.spriteAnimName !== 'slash') {
            this.spriteAnimName = 'slash';
            this.spriteAnimFrame = 1;
            this.spriteAnimTimer = 0;
        }

        if (this.slashSwinging) {
            // Swing: jump to the first swing frame (held for one frame step
            // so the swing reads instead of snapping), play through, then
            // hand back to the recover walk.
            if (this.spriteAnimFrame < cfg.windupFrames + 1) {
                this.spriteAnimFrame = cfg.windupFrames + 1;
                this.spriteAnimTimer = 1 / cfg.fps;
            }
            this.spriteAnimTimer -= dt;
            if (this.spriteAnimTimer <= 0) {
                this.spriteAnimTimer += 1 / cfg.fps;
                if (this.spriteAnimFrame < cfg.frames) this.spriteAnimFrame++;
                else this.slashSwinging = false; // swing done → recover
            }
        } else {
            // Readying: ease toward the wind-up hold frame, then pause.
            if (this.spriteAnimFrame !== cfg.windupFrames) {
                this.spriteAnimTimer -= dt;
                if (this.spriteAnimTimer <= 0) {
                    this.spriteAnimTimer += 1 / cfg.fps;
                    this.spriteAnimFrame += this.spriteAnimFrame < cfg.windupFrames ? 1 : -1;
                }
            }
        }
        this.sprite = `boss_slash_${this.spriteAnimFrame}`;
    },

    // Screen-split slash choreography: wind up while the rift preps/warns,
    // swing exactly when the screen shatters (splitSlashFired is set by
    // _updateState on that frame), hold the follow-through briefly, then
    // lower back down to standing and stop animating for the rest of the
    // split. No looping — the shatter is the one slash. Branch selection is
    // flag-driven (like _advanceOneShotAnim), not frame-driven, so the
    // lowering pass can't re-enter the swing branch mid-way.
    _updateSplitSlash(dt) {
        const cfg = TUNING.bossAnim.sprites.slash;
        if (this.splitSlashDone) return;
        if (this.spriteAnimName !== 'slash') {
            this.spriteAnimName = 'slash';
            this.spriteAnimFrame = 1;
            this.spriteAnimTimer = 0;
            this.spriteAnimReverse = false;
        }

        if (!this.splitSlashFired) {
            // Readying: raise to the wind-up hold frame and pause there.
            if (this.spriteAnimFrame < cfg.windupFrames) {
                this.spriteAnimTimer -= dt;
                if (this.spriteAnimTimer <= 0) {
                    this.spriteAnimTimer += 1 / cfg.fps;
                    this.spriteAnimFrame++;
                }
            }
        } else if (!this.spriteAnimReverse) {
            // Swing through the remaining frames (first swing frame held for
            // one frame step so the swing reads instead of snapping).
            if (this.spriteAnimFrame < cfg.windupFrames + 1) {
                this.spriteAnimFrame = cfg.windupFrames + 1;
                this.spriteAnimTimer = 1 / cfg.fps;
            }
            this.spriteAnimTimer -= dt;
            if (this.spriteAnimTimer <= 0) {
                this.spriteAnimTimer += 1 / cfg.fps;
                if (this.spriteAnimFrame < cfg.frames) this.spriteAnimFrame++;
                if (this.spriteAnimFrame >= cfg.frames) this.spriteAnimReverse = true;
            }
        } else {
            // Follow-through done: hold it for splitSlashTimer, then lower
            // back to frame 1 and stand.
            this.splitSlashTimer -= dt;
            if (this.splitSlashTimer <= 0) {
                this.spriteAnimTimer -= dt;
                if (this.spriteAnimTimer <= 0) {
                    this.spriteAnimTimer += 1 / cfg.fps;
                    if (this.spriteAnimFrame > 1) {
                        this.spriteAnimFrame--;
                    } else {
                        // Fully lowered: back to standing and stop animating.
                        this.spriteAnimName = null;
                        this.spriteAnimReverse = false;
                        this.splitSlashDone = true;
                        this.sprite = 'enemy_knight_front';
                        return;
                    }
                }
            }
        }
        this.sprite = `boss_slash_${this.spriteAnimFrame}`;
    },

    // Drives the knight's in-fight sprite by state: spinning slashes -> the
    // slash wind-up (holds at the ready frame between volleys, swings through
    // on each release), screen-split attacks -> the synced split slash
    // (windup, one swing on the shatter, lower, then stand), sword throw ->
    // the point animation (ping-pongs back down). The damage reposition plays
    // a static flinch then the ball travel (which sets the sprite itself), so
    // this skips 'repositioning' entirely. Other states fall back to the
    // front view.
    _updateFightSprite(dt) {
        // The damage reposition owns the sprite (static flinch + ball travel),
        // so leave it alone entirely — including the looped-anim bookkeeping,
        // or the static flinch would be reset to frame 1 every frame.
        if (this.state === 'repositioning') return;

        // Keep the slash swing playing out after the state flips back to
        // idle the moment the final volley dashes.
        if (this.state === 'spinning_slashes' || this.slashSwinging || (this.slashFired && (this.spinningSlashes || []).length > 0)) {
            this._advanceSlashWindup(dt);
            return;
        }

        // The split slash owns all three rift states: windup during
        // prep/warning, one swing on the shatter, then stand for the rest.
        if (this.state === 'split_prep' || this.state === 'split_warning' || this.state === 'split_active') {
            this._updateSplitSlash(dt);
            return;
        }

        // Keep the sword-throw point anim playing back down after the throw
        // state ends, until it reaches the resting frame again.
        if (this.pointRelease && this.spriteAnimName === 'point') {
            this._advanceOneShotAnim(dt, 'point');
            return;
        }

        let animName = null;
        let oneShot = false;
        if (this.state === 'split_active') {
            animName = 'slash';
        } else if (this.state === 'sword_throw') {
            animName = 'point';
            oneShot = true;
        }

        if (!animName) {
            if (this.spriteAnimName !== null) {
                this.spriteAnimName = null;
                this.spriteAnimFrame = 1;
                this.spriteAnimTimer = 0;
                this.sprite = 'enemy_knight_front';
            }
            return;
        }

        if (oneShot) this._advanceOneShotAnim(dt, animName);
        else this._advanceLoopedAnim(dt, animName);
    }
};

export default KnightAttacks;
