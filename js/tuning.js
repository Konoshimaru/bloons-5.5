// js/tuning.js
// Feel/presentation knobs for the fiddly stuff that's easier to dial in by eye
// than by code review: the knight boss-cutscene animation pacing. Every value
// is read at use time (no destructuring), so you can tweak them live from the
// browser console via `window.tuning` (e.g. `tuning.bossAnim.knight_back.fps =
// 6`) — or just edit the numbers here and let Vite reload.
export const TUNING = {
    bossAnim: {
        // Knight reveal: roaring back animation (knight_back_1..19), then the
        // sword-equip animation (equip_sword.._20), before the knight turns to
        // fight. Frame counts are fixed by the art; `fps` sets the pacing.
        // `holds` adds authored extra seconds AFTER frame N (the re-timed
        // vanilla intro's dramatic pauses: mid-roar windup after back_3 and
        // roar peak after back_12) — used by buildVanillaIntroDoc().
        knight_back: { frames: 19, fps: 8, holds: { 3: 0.258, 12: 0.309 } },
        equip_sword: { frames: 20, fps: 8 },
        // Damage reposition: instead of teleporting, the knight collapses into
        // a ball, rolls to the new spot, then reforms. ball_transition_1..4
        // play ball -> knight (1 = ball, 4 = knight), so the collapse plays
        // them in reverse and the reform plays them forward. Fractions are
        // shares of the total reposition time.
        ball: {
            duration: 1.2,      // total collapse + roll + reform time
            collapseFrac: 0.22, // share spent collapsing knight -> ball
            travelFrac: 0.56,   // share spent rolling as the ball
            ballFrames: 5,      // ball_1..5 rolling loop
            transitionFrames: 4, // ball_transition_1..4
        },
        // In-fight sprite animations, driven by the knight's current state:
        // spinning slashes -> slash_1..5, sword throw -> point_1..5, and a
        // brief static flinch when a damage-threshold reposition triggers.
        sprites: {
            slash: {
                frames: 5,
                fps: 8,
                windupFrames: 2, // hold here while readying (raised wind-up pose; swing plays 3→4→5)
                backupDist: 80,  // px the knight backs away from the mouse while readying
                backupSpeed: 4,  // how fast he eases into/out of the backup
                // Spinning slashes volley chain: the attack is now several
                // spin→release cycles instead of one. Each volley re-aims at
                // the current cursor, spins up over spinTime, then releases;
                // the next cross spawns volleyGap later (the old lines fade
                // during that gap).
                volleys: 3,      // spin→release cycles per spinning-slashes attack
                spinTime: 1.4,   // spin-up duration per volley (was 2.5 for the single one)
                volleyGap: 0.9,  // pause between a release and the next cross
                dashTime: 0.5,   // dash/fade duration of released lines
                spinSpeed: 4,    // rad/s at full spin (ramps up linearly)
                // Screen-split sync: the knight winds up during prep/warning,
                // swings exactly when the screen shatters, holds the
                // follow-through this long, then lowers back to standing.
                recoverHold: 0.35,
            },
            point: { frames: 5, fps: 8 },
            static: { frames: 3, fps: 8 },
            flinchTime: 0.4, // how long the static flinch holds before the ball travel
        },
        // Death exit: after the final explosion the knight plays the fly
        // transition (fly_transition_1..17) once, then loops the fly frames
        // (fly_1..4) while rising off the top of the screen.
        fly: {
            transitionFrames: 17,
            frames: 4,
            fps: 10,       // both the transition and the fly loop
            riseSpeed: 160, // px/sec upward during the fly loop
            sway: 40,       // horizontal sway amplitude (around homeX)
            exitY: -160,    // y below which he's off-screen and gets removed
            fadeInTime: 0.6, // sec to fade back in after the dying fade-out
        },
        // Knight after-image trail: one ghost clone every trailInterval
        // seconds WHEN the knight has actually moved since the last ghost
        // (knight.js gates on displacement - the idle hover-bob used to spawn
        // a stacked pile of silhouettes). v1.4.2 (owner: "the knight should
        // have double the trail, so like, 1.5x more trail and it lasts 1.5x
        // times longer"): interval 0.11 -> 0.073 (~1.5x denser, ~13.6
        // ghosts/s), fade rate 1.5 -> 1.0/s (~0.7s per ghost, 1.5x longer),
        // and the ghost cap 15 -> 34 so the denser, longer trail is never
        // clipped mid-motion.
        trailInterval: 0.073,
        trailFadeRate: 1.0,
        trailCap: 34,
        // Screen-split ("Reality shatters!"): how long the split-screen rift
        // stays open. v1.3.2: 5.0s felt long, shortened to 3.5s (also set as
        // the split_active state duration so the fight keeps flowing).
        splitActive: 3.5,
        // Fixed-duration cutscene beats, in seconds.
        phases: {
            tension: 1.5,   // crackling energy while the MOAB shakes
            slash: 0.7,     // the glowing slash itself
            ripWait: 0.4,   // beat before the gap tears open
            rip: 0.8,       // the void rip opening
            pan: 1.2,       // camera drift onto the knight (in + out)
        },
    },

    // v1.3.5: the loading-screen sword-pull minigame is back (v1.3.4 deleted
    // it — over-pruned). It is a LONG-LOAD guest: loadGate.js shows the plain
    // status + bar immediately as usual, and only after the screen has been
    // up this long does the minigame fade in behind it. Quick loads (cold
    // cache excluded) never see it at all.
    minigame: {
        appearAfterMs: 1500,    // screen-time before the minigame joins a load
        swordCount: 20,
        pullMax: 1,          // momentum runs 0..1
        momentum: {
            gain: 0.032,     // base momentum gained per pull
            selfBoost: 0.4,  // how strongly current momentum boosts the gain
            drain: 0.22,     // per-second momentum drain, strongest at zero
            baseDrain: 0.02, // constant per-second drain, even at full momentum
        },
        pullProgress: 0.07,     // shake progress per pull at full momentum
        passiveProgress: 0.01,  // per-second idle extraction when not pulling
        xpFlashTime: 1.6,       // how long the +1 flash lingers over the counter
        sizeFracGround: 0.10,   // planted (in-ground) sword height
        sizeFracOut: 0.26,      // freed (out-of-ground) sword height
        freeTime: 0.35,  // sec a freed sword flashes sword_out
        respawnDelay: 0.8,      // gap between a sword popping and the next one
        xpMilestone: 20,        // swords taken per onComplete call
        holdRepeat: 0.12,       // seconds between held pulls while pointer is down
    },
};

// Console live-tweak handle (browser only — cutsceneRuntime imports this
// module in node-env vitest too, where `window` doesn't exist).
if (typeof window !== 'undefined') window.tuning = TUNING;
