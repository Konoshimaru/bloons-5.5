// tests/knightAttackChoreo.test.js
//
// Unit tests for the boss attack choreography rework (js/bosses/knightAttacks.js):
//  - spinning slashes fire MULTIPLE spin→release volleys per attack, each
//    re-aimed at the current cursor, with the next cross queued (delayed)
//    while the released lines fly;
//  - the cursor punish fires ONCE per release even though both lines cross
//    the cursor (the old code logged/stunned/charged cash twice per release);
//    since v1.3.2 it also scales: 10% of the player's CURRENT cash.
//  - the screen-split slash is choreographed: windup during prep/warning,
//    one swing exactly when the screen shatters, hold, lower, then stand for
//    the rest of the split (the old code looped the slash anim for 5s).
//
// The attack methods are pure state machines driven from `this` fields +
// GameEngine/AudioEngine, so they are tested on a bare object with the real
// methods mixed in — no DOM, no Pixi, audio mocked.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../js/audio.js', () => ({
    AudioEngine: { playSfx: vi.fn() },
}));

import { GameEngine } from '../js/engineRef.js';
import KnightAttacks from '../js/bosses/knightAttacks.js';
import { TUNING } from '../js/tuning.js';

const CFG = TUNING.bossAnim.sprites.slash;
const DT = 1 / 60;

function makeKnight() {
    const k = {
        state: 'idle', stateTimer: 0, attackIndex: 0,
        spinningSlashes: [], thrownSwords: [], waveSpawnTimers: [],
        slashFired: false, slashSwinging: false,
        slashVolley: 0, slashVolleys: CFG.volleys,
        slashVolleyTimer: 0, slashCursorHit: false,
        splitSlashFired: false, splitSlashDone: false, splitSlashTimer: 0,
        spriteAnimName: null, spriteAnimFrame: 1, spriteAnimTimer: 0,
        spriteAnimReverse: false, pointRelease: false,
        homeX: 200, homeY: 300, x: 200, y: 300, alpha: 1,
        sprite: 'enemy_knight_front', invulnerable: false,
        warningLineActive: false, screenSplitActive: false,
        screenSplitTimer: 0, splitDirection: 1, screenSplitOffset: 100,
        targetOffset: 0, currentOffset: 0, freezeMouse: false,
        ballTravel: null, slashBackup: 0,
        slashBackupDirX: 0, slashBackupDirY: -1, time: 0,
    };
    return Object.assign(k, KnightAttacks);
}

// Advance the state machine + projectile update like knight.update() does.
function step(k, seconds) {
    const n = Math.ceil(seconds / DT);
    for (let i = 0; i < n; i++) {
        k._updateState(DT);
        k._updateProjectiles(DT);
    }
}

beforeEach(() => {
    GameEngine.mouse = { x: 400, y: 300 };
    GameEngine.log = vi.fn();
    GameEngine.towers = [];
    GameEngine.addCash = vi.fn();
    GameEngine.removeCash = vi.fn();
    GameEngine.spawnPopEffect = vi.fn();
    GameEngine.projectilePool = { active: [] };
});

describe('spinning slashes: multi-volley chain', () => {
    it('starts with one volley armed at the cursor', () => {
        const k = makeKnight();
        k._startSpinningSlashes();
        expect(k.state).toBe('spinning_slashes');
        expect(k.slashVolley).toBe(0);
        expect(k.slashVolleyTimer).toBeCloseTo(CFG.spinTime);
        expect(k.spinningSlashes).toHaveLength(2);
        for (const s of k.spinningSlashes) {
            expect(s.phase).toBe('spin');
            expect(s.delay).toBe(0);
            expect(s.pivotX).toBe(400);
            expect(s.pivotY).toBe(300);
            expect(s.maxSpinTime).toBe(CFG.spinTime);
        }
        // the two lines cross at 90°
        const angles = k.spinningSlashes.map(s => s.angle).sort((a, b) => a - b);
        expect(angles[1] - angles[0]).toBeCloseTo(Math.PI / 2, 5);
    });

    it('releases each volley, queues the next with a delay, and ends in idle', () => {
        const k = makeKnight();
        k._startSpinningSlashes();

        step(k, CFG.spinTime + 0.05);
        expect(k.slashVolley).toBe(1);
        expect(k.slashSwinging).toBe(true); // body swing started
        expect(k.spinningSlashes.filter(s => s.phase === 'dash')).toHaveLength(2);
        const queued = k.spinningSlashes.filter(s => s.delay > 0);
        expect(queued).toHaveLength(2);
        // spawned with volleyGap; a few post-release ticks already ticked it down
        expect(queued[0].delay).toBeLessThan(CFG.volleyGap);
        expect(queued[0].delay).toBeGreaterThan(CFG.volleyGap - 0.1);
        expect(k.state).toBe('spinning_slashes');

        step(k, CFG.volleyGap + CFG.spinTime + 0.05);
        expect(k.slashVolley).toBe(2);
        expect(k.state).toBe('spinning_slashes');

        step(k, CFG.volleyGap + CFG.spinTime + 0.05);
        expect(k.slashVolley).toBe(3);
        expect(k.slashVolleys).toBe(3);
        expect(k.state).toBe('idle');
        // a few post-release ticks already ticked the fresh idle timer down
        expect(k.stateTimer).toBeGreaterThan(3.8);
    });

    it('spawns each new volley aimed at the cursor position at its spawn moment', () => {
        const k = makeKnight();
        k._startSpinningSlashes();
        // volley 1 captured the start position
        expect(k.spinningSlashes[0].pivotX).toBe(400);

        // the player moves the cursor before the first release → the volley
        // spawned at that release re-aims at the NEW position
        GameEngine.mouse = { x: 900, y: 150 };
        step(k, CFG.spinTime + 0.05);
        expect(k.slashVolley).toBe(1);
        const queued = k.spinningSlashes.filter(s => s.delay > 0);
        expect(queued).toHaveLength(2);
        for (const s of queued) {
            expect(s.pivotX).toBe(900);
            expect(s.pivotY).toBe(150);
        }
    });

    it('queued (delayed) lines are invisible, harmless, and release on their own slot only', () => {
        const k = makeKnight();
        k._startSpinningSlashes();
        step(k, CFG.spinTime + 0.05); // volley 1 dashes, volley 2 queued

        const queued = k.spinningSlashes.filter(s => s.delay > 0);
        k._updateProjectiles(0.1);
        expect(queued[0].phase).toBe('spin');
        expect(queued[0].alpha).toBe(0);                    // invisible while queued
        expect(queued[0].delay).toBeLessThan(CFG.volleyGap); // counting down

        // _executeSpinningSlashes must NOT dash lines that are still queued
        k._executeSpinningSlashes();
        expect(queued[0].phase).toBe('spin');
        expect(queued[1].phase).toBe('spin');

        // once the delay elapses they spin up visibly
        step(k, CFG.volleyGap + 0.2);
        const spinning = k.spinningSlashes.filter(s => s.phase === 'spin' && s.delay <= 0);
        expect(spinning).toHaveLength(2);
        for (const s of spinning) expect(s.alpha).toBeGreaterThan(0);
    });
});

describe('knight does not chase the cursor', () => {
    it('freezes the away-direction at attack start; later mouse moves cannot change it', () => {
        const k = makeKnight();
        k.x = 200; k.y = 300;
        GameEngine.mouse = { x: 500, y: 300 }; // cursor to his right
        k._startSpinningSlashes();
        expect(k.slashBackupDirX).toBeCloseTo(-1, 5); // away = left
        expect(k.slashBackupDirY).toBeCloseTo(0, 5);

        // hard cursor wiggles: the frozen direction must not move
        for (const m of [{ x: 100, y: 100 }, { x: 900, y: 500 }, { x: 210, y: 310 }]) {
            GameEngine.mouse = m;
            step(k, 0.2);
            expect(k.slashBackupDirX).toBeCloseTo(-1, 5);
            expect(k.slashBackupDirY).toBeCloseTo(0, 5);
        }
        // ...while the slashes themselves DID re-aim (covered above)
    });

    it('backs AWAY from the cursor along the frozen line while readying', () => {
        const k = makeKnight();
        k.x = 200; k.y = 300;
        GameEngine.mouse = { x: 500, y: 300 }; // cursor to his right
        k._startSpinningSlashes();

        k._updateSlashBackup(0.05);
        expect(k.slashBackup).toBeGreaterThan(0.1);
        // float wobble preserved; the backup pushes him LEFT (away), not
        // toward the cursor like the old inverted sign did
        expect(k.x).toBeCloseTo(k.homeX + Math.sin(k.time * 2) * 30 - CFG.backupDist * k.slashBackup, 5);
        expect(k.y).toBeCloseTo(k.homeY + Math.cos(k.time * 3) * 20, 5);

        // cursor flips to the other side mid-windup: he keeps gliding along
        // the SAME line (no flip, no chase)
        const xBefore = k.x;
        GameEngine.mouse = { x: 50, y: 300 }; // now on his left
        k._updateSlashBackup(0.05);
        expect(k.x).toBeLessThan(xBefore); // still gliding left along the frozen dir
        expect(k.slashBackupDirX).toBeCloseTo(-1, 5);
    });

    it('steps back home once the attack ends', () => {
        const k = makeKnight();
        k.x = 200; k.y = 300;
        GameEngine.mouse = { x: 500, y: 300 };
        k._startSpinningSlashes();
        k._updateSlashBackup(0.5);
        expect(k.slashBackup).toBeGreaterThan(0.5);

        k.state = 'idle';
        for (let i = 0; i < 200; i++) k._updateSlashBackup(DT);
        expect(k.slashBackup).toBeLessThan(0.001);
        expect(k.x).toBeCloseTo(k.homeX + Math.sin(k.time * 2) * 30, 5);
        expect(k.y).toBeCloseTo(k.homeY + Math.cos(k.time * 3) * 20, 5);
    });
});

describe('cursor punish: one per release', () => {
    function dashLine(angle) {
        return {
            phase: 'dash', delay: 0,
            pivotX: 400, pivotY: 300, angle,
            spinSpeed: 4, currentSpeed: 0,
            length: 2000, alpha: 1, vx: 0, vy: 0,
            life: CFG.dashTime, hit: false,
            maxSpinTime: CFG.spinTime, spinTimer: 0,
        };
    }

    it('both lines may cross the cursor but the punish fires once (10% of current cash)', () => {
        const k = makeKnight();
        GameEngine.cash = 23450; // v1.3.2: the punish scales with the wallet
        k.spinningSlashes = [dashLine(0), dashLine(Math.PI / 2)]; // both through (400,300)
        k._updateProjectiles(DT);
        expect(k.spinningSlashes[0].hit).toBe(true);
        expect(k.spinningSlashes[1].hit).toBe(true);
        expect(GameEngine.log).toHaveBeenCalledTimes(1);
        expect(GameEngine.removeCash).toHaveBeenCalledTimes(1);
        expect(GameEngine.removeCash).toHaveBeenCalledWith(Math.floor(23450 * 0.10));
        expect(k.slashCursorHit).toBe(true);
    });

    it('the cursor punish removes nothing when the player is broke', () => {
        const k = makeKnight();
        GameEngine.cash = 0;
        k.spinningSlashes = [dashLine(0)];
        k._updateProjectiles(DT);
        expect(GameEngine.removeCash).toHaveBeenCalledWith(0);
    });

    it('a new volley re-arms the punish', () => {
        const k = makeKnight();
        k.slashCursorHit = true;
        k._spawnSlashVolley(0);
        expect(k.slashCursorHit).toBe(false);
    });
});

describe('screen-split slash choreography', () => {
    it('winds up during prep, swings exactly at the shatter, then stands', () => {
        const k = makeKnight();
        k._startScreenSplit();
        expect(k.state).toBe('split_prep');
        expect(k.splitSlashFired).toBe(false);
        expect(k.splitSlashDone).toBe(false);

        // windup raises to the hold frame and pauses there
        for (let i = 0; i < 20; i++) k._updateFightSprite(DT);
        expect(k.sprite).toBe(`boss_slash_${CFG.windupFrames}`);

        // run the warning out → the shatter frame fires the slash
        k.state = 'split_warning';
        k.stateTimer = DT;
        k._updateState(DT);
        expect(k.state).toBe('split_active');
        expect(k.screenSplitActive).toBe(true);
        // v1.3.2: state + visual share the shortened TUNING duration.
        expect(k.stateTimer).toBe(TUNING.bossAnim.splitActive);
        expect(k.screenSplitTimer).toBe(TUNING.bossAnim.splitActive);
        expect(k.splitSlashFired).toBe(true);
        expect(k.splitSlashTimer).toBeCloseTo(
            CFG.recoverHold + (CFG.frames - CFG.windupFrames) / CFG.fps, 5);

        // swing: first swing frame visible, then the follow-through
        k._updateFightSprite(DT);
        expect(k.sprite).toBe(`boss_slash_${CFG.windupFrames + 1}`);
        for (let i = 0; i < 20; i++) k._updateFightSprite(DT);
        expect(k.sprite).toBe(`boss_slash_${CFG.frames}`);

        // recover: hold, lower back down, then stand for the rest of the split
        for (let i = 0; i < 100; i++) k._updateFightSprite(DT);
        expect(k.splitSlashDone).toBe(true);
        expect(k.spriteAnimName).toBeNull();
        expect(k.sprite).toBe('enemy_knight_front');
        for (let i = 0; i < 120; i++) k._updateFightSprite(DT);
        expect(k.sprite).toBe('enemy_knight_front');
    });

    it('a fresh split resets the choreography', () => {
        const k = makeKnight();
        k.splitSlashFired = true;
        k.splitSlashDone = true;
        k.splitSlashTimer = 1;
        k._startScreenSplit();
        expect(k.splitSlashFired).toBe(false);
        expect(k.splitSlashDone).toBe(false);
        expect(k.splitSlashTimer).toBe(0);
    });
});
