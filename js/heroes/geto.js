// js/heroes/geto.js
//
// This file defines "Geto", one of the playable Heroes in the game.
// A Hero is a special, one-of-a-kind tower: only one can be placed per game,
// and it gains XP/levels over the course of a match (instead of being
// upgraded with cash like a normal tower).
//
// Every hero/tower file in this codebase follows the same shape:
// it exports a plain JavaScript object with a few expected properties
// (stats, levels, update, draw, fire, ability, ability2, etc.).
// The rest of the game (engine.js, tower.js, towerBehavior.js) calls into
// these functions automatically at the right time — you never call them
// directly yourself.

import { GameEngine } from '../engine.js';
import { Utils, drawImageCentered } from '../utils.js';
import Assets from '../assets.js';
import { AudioEngine } from '../audio.js';

// ── HELPER CLASS: one curse-spirit wisp in the "Maximum: Uzumaki" vortex ──
// These are purely visual — they never touch gameplay/damage. A batch of
// these gets spawned around Geto whenever he charges his ultimate, and they
// spiral inward toward him (the "charging circle" look) while he channels.
// Unlike the standalone demo this was adapted from, these orbit around
// Geto's *current* position (tower.x/tower.y) rather than a fixed canvas
// center, since Geto can be placed anywhere on the map.
class _UzumakiSpirit {
    constructor(cx, cy, maxDim) {
        this.reset(cx, cy, maxDim, true);
    }

    // `initialSpread`: true only the very first time a batch is created —
    // it scatters spirits across the whole radius instead of all starting
    // at the rim at once, so the vortex doesn't look like a single popping ring.
    reset(cx, cy, maxDim, initialSpread = false) {
        this.angle = Math.random() * Math.PI * 2;   // Starting position around the circle, in radians.
        this.radius = initialSpread
            ? Math.random() * maxDim * 0.55           // Scattered anywhere within the charge radius...
            : (0.85 + Math.random() * 0.15) * maxDim; // ...or freshly spawned right at the outer rim.
        this.size = 6 + Math.random() * 6;
        this.faceType = _UZUMAKI_FACE_TYPES[Math.floor(Math.random() * _UZUMAKI_FACE_TYPES.length)];
        this.speedMultiplier = 0.85 + Math.random() * 0.55; // Slight per-spirit variation so they don't all move in lockstep.
        this.opacity = 0.75 + Math.random() * 0.25;
        // Dark ink-style charcoal/gray tones, occasionally a near-black one.
        this.color = Math.random() > 0.15 ? '#4b5563' : '#1f2937';
        this.active = true;
    }

    // `pullSpeed` controls how fast it spirals inward — a gentle drift while
    // idle-charging, or a much stronger yank once the condensation kicks in.
    update(dt, pullSpeed) {
        if (!this.active) return;
        this.angle += 0.05 * this.speedMultiplier * (dt * 60); // Orbit speed (frame-rate independent).
        this.radius -= pullSpeed * (dt * 60);                   // Spiral inward.
        if (this.radius < 8) this.active = false;               // Reached the center — done, hide it.
    }

    draw(ctx, cx, cy) {
        if (!this.active) return;

        // Trace a short curved "tail" backward along the spiral path, and
        // build a simple ribbon shape around that curve — this is what
        // gives each spirit its wispy, comet-like body instead of a plain dot.
        const segments = 5;
        const spine = [];
        const gravityIntensity = 140 / (this.radius + 30); // Stronger stretch the closer it is to the center.
        const stretch = 1.0 + gravityIntensity * 0.6;
        const angleStep = 0.07 * this.speedMultiplier * stretch;
        const radiusStep = 3 * stretch;

        for (let i = 0; i < segments; i++) {
            const r = this.radius + i * radiusStep;
            const a = this.angle - i * angleStep;
            spine.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
        }

        // Build the left/right edges of the ribbon by offsetting
        // perpendicular to the spine's direction at each point.
        const left = [], right = [];
        for (let i = 0; i < spine.length; i++) {
            let dx, dy;
            if (i === 0) { dx = spine[1].x - spine[0].x; dy = spine[1].y - spine[0].y; }
            else if (i === spine.length - 1) { dx = spine[i].x - spine[i - 1].x; dy = spine[i].y - spine[i - 1].y; }
            else { dx = spine[i + 1].x - spine[i - 1].x; dy = spine[i + 1].y - spine[i - 1].y; }
            const len = Math.hypot(dx, dy) || 1;
            const nx = -(dy / len), ny = (dx / len); // Perpendicular direction to the spine at this point.

            const t = i / (spine.length - 1);
            let w = t < 0.15
                ? this.size * 0.45 * Math.sin((t / 0.15) * Math.PI / 2)
                : this.size * 0.45 * Math.cos(((t - 0.15) / 0.85) * Math.PI / 2);
            w /= Math.sqrt(stretch); // Thin out the ribbon a bit as it stretches, so it doesn't look bloated near the center.

            left.push({ x: spine[i].x + nx * w, y: spine[i].y + ny * w });
            right.push({ x: spine[i].x - nx * w, y: spine[i].y - ny * w });
        }

        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(spine[0].x, spine[0].y);
        for (const p of left) ctx.lineTo(p.x, p.y);
        for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // A small dark face detail near the head of the ribbon.
        const facePt = spine[Math.min(1, spine.length - 1)];
        const faceAngle = Math.atan2(spine[2].y - spine[0].y, spine[2].x - spine[0].x) + Math.PI;
        ctx.save();
        ctx.translate(facePt.x, facePt.y);
        ctx.rotate(faceAngle);
        ctx.fillStyle = '#000000';
        const fx = this.size * 0.12;
        if (this.faceType === 'cyclops') {
            ctx.beginPath(); ctx.ellipse(fx, 0, this.size * 0.11, this.size * 0.16, 0, 0, Math.PI * 2); ctx.fill();
        } else if (this.faceType === 'screaming') {
            ctx.beginPath();
            ctx.arc(fx + this.size * 0.08, -this.size * 0.1, this.size * 0.07, 0, Math.PI * 2);
            ctx.arc(fx + this.size * 0.08, this.size * 0.1, this.size * 0.07, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath(); ctx.ellipse(fx - this.size * 0.08, 0, this.size * 0.08, this.size * 0.16, 0, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(fx + this.size * 0.08, -this.size * 0.09, this.size * 0.08, 0, Math.PI * 2);
            ctx.arc(fx + this.size * 0.08, this.size * 0.09, this.size * 0.08, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
        ctx.restore();
    }
}
const _UZUMAKI_FACE_TYPES = ['screaming', 'cyclops', 'hollow'];

// ── HELPER CLASS: one dark stretched "hand" fired during the beam phase ──
// Same idea as the squid/worm projectiles above, but purely visual — the
// actual damage during the firing phase is dealt by the screen-wide
// dps loop in update() (unchanged from before), so these hands are a stand-in
// for what the beam looks like, not a separate collision system. If you'd
// rather have each hand individually reach out and only hit whatever it
// touches, that's a bigger change — let me know and we can do that instead.
class _StretchedHand {
    constructor(startX, startY, angle) {
        this.x = startX; this.y = startY; this.angle = angle;
        this.length = 20 + Math.random() * 30;
        this.maxLength = 260 + Math.random() * 140; // Kept shorter than the original demo's 400-600, to fit this game's 900x600 map instead of a dedicated effect canvas.
        this.speed = 500 + Math.random() * 400;
        this.thickness = 5 + Math.random() * 7;
        this.waveOffset = Math.random() * 100;
        this.waveSpeed = 12 + Math.random() * 6;
        this.opacity = 1.0;
    }

    // Returns false once fully faded out, so the caller knows to remove it.
    update(dt) {
        this.length += this.speed * dt;
        this.waveOffset += dt * this.waveSpeed;
        if (this.length > this.maxLength) this.opacity -= dt * 6.5; // Fades quickly once it's reached full stretch.
        return this.opacity > 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = '#020203'; ctx.strokeStyle = '#020203'; // Near-black, manga-ink style.
        ctx.lineWidth = this.thickness;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.globalAlpha = this.opacity;

        // The arm itself: a curve that gently writhes over time via a sine/cosine offset on its control points.
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const c1 = Math.sin(this.waveOffset) * 20, c2 = Math.cos(this.waveOffset) * -20;
        ctx.bezierCurveTo(this.length * 0.3, c1, this.length * 0.6, c2, this.length, 0);
        ctx.stroke();

        // Wrist + 5 clawed fingers, drawn at the far end of the arm.
        ctx.save();
        ctx.translate(this.length, 0);
        ctx.beginPath(); ctx.arc(0, 0, this.thickness * 1.3, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 5; i++) {
            const fingerAngle = (i - 2) * 0.4; // Spreads 5 fingers symmetrically around straight-ahead.
            ctx.save();
            ctx.rotate(fingerAngle);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(this.thickness * 2, -this.thickness, this.thickness * 5, 0);
            ctx.lineWidth = this.thickness * 0.35;
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
        ctx.restore();
    }
}

export default {

    // ── BASE STATS ───────────────────────────────────────────────────────
    // These are Geto's starting numbers at Level 1, before any level-up
    // bonuses (see the `levels` object below) are applied.
    stats: {
        name: "Geto",                 // Display name shown in the shop/UI.
        cost: 720,                    // Cash cost to place Geto on the map.
        range: 40,                    // How far Geto can "see" enemies (in pixels, before scaling).
        fireRate: 1.2,                // Seconds between shots. Lower = faster.
        damage: 1,                    // Base damage per hit.
        pierce: 2,                    // How many enemies a single projectile can hit before disappearing.
        projectileSpeed: 0,           // Unused here — Geto manages his own custom projectiles ("squids"), so
                                       // the game's generic projectile-speed system doesn't apply to him.
        lifespan: 0.4,                // Unused for the same reason as above.
        desc: "Cursed Spirit Manipulator. Captures curses and unleashes them as resentment.",
        dmgType: 'magic',             // What kind of damage this is. "magic" damage type has its own
                                       // rules for which bloons it can/can't hurt (see damageTypes.js).
        projectileType: 'squid',      // A label used by other systems to know what to draw.
        hitRadius: 12,                // How close a projectile needs to be to an enemy to count as a "hit".
        isHero: true,                 // Marks this as a Hero (not a regular tower) — the game checks this
                                       // flag in several places to treat Geto differently from normal towers.
        maxLevel: 20,                 // Heroes cap out at level 20 in this game (matches the real game's cap).
        scale: 1.3                    // How big Geto is drawn on the map, relative to a normal tower.
    },

    // ── XP TABLE ─────────────────────────────────────────────────────────
    // xpTable[i] is how much *total* XP Geto needs to reach level (i + 2).
    // (Level 1 is free — you start there — so the first entry here is the
    // XP needed to go from level 1 to level 2, the second entry is the XP
    // needed to go from level 2 to level 3, and so on.)
    xpTable: [500, 1200, 2500, 4500, 7000, 10000, 14000, 19000, 25000, 32000, 40000, 50000, 62000, 75000, 90000, 110000, 130000, 160000, 200000, 250000],

    // ── LEVEL-UP BONUSES ─────────────────────────────────────────────────
    // Each key is a level number. The value is a list of stat changes that
    // get applied automatically the moment Geto reaches that level.
    // `stat` is the name of the property being changed on `tower.stats`,
    // and `amount` is either added to a number, or (for true/false flags)
    // just set directly. The game's shared levelling code (not in this file)
    // is what actually reads this table and applies it.
    levels: {
        1: [],                                                              // Nothing extra at level 1 — this is just the starting point.
        2: [{ stat: "fireRate", amount: -0.2 }],                            // Attacks a bit faster (lower fireRate = faster).
        3: [{ stat: "isAbility", amount: true }],                          // Unlocks Ability 1: "Curse Capture" (see ability() below).
        4: [{ stat: "range", amount: 10 }],                                // Can see/target enemies a bit further away.
        5: [{ stat: "damage", amount: 1 }, { stat: "pierce", amount: 1 }], // More damage and more pierce per shot.
        6: [{ stat: "fireRate", amount: -0.15 }, { stat: "slowOnHit", amount: true }], // Faster attacks, and hits now slow enemies briefly.
        7: [{ stat: "wormEvery8th", amount: true }],                       // Every 8th shot becomes a stronger "worm" attack instead of a normal squid.
        8: [{ stat: "range", amount: 10 }, { stat: "damage", amount: 1 }], // More range and more damage.
        9: [{ stat: "pierce", amount: 1 }, { stat: "fireRate", amount: -0.1 }], // More pierce, faster attacks.
        10: [{ stat: "isAbility2", amount: true }],                        // Unlocks Ability 2: "Maximum: Uzumaki" (the big beam ultimate).
        11: [{ stat: "damage", amount: 1 }, { stat: "range", amount: 10 }],// More damage and range.
        12: [{ stat: "twinSquid", amount: true }],                        // Now fires two squids at once instead of one.
        13: [{ stat: "pierce", amount: 1 }, { stat: "canSeeCamo", amount: true }], // More pierce, and can now see/target Camo bloons.
        14: [{ stat: "wormEvery5th", amount: true }, { stat: "wormDmgBonus", amount: 2 }], // Worm shots become more frequent (every 5th instead of 8th) and hit harder.
        15: [{ stat: "damage", amount: 1 }],                               // More damage.
        16: [{ stat: "fireRate", amount: -0.05 }],                         // Slightly faster attacks.
        17: [{ stat: "fireRate", amount: -0.1 }, { stat: "pierce", amount: 1 }], // Faster attacks, more pierce.
        18: [{ stat: "moabDmgBonus", amount: 2 }, { stat: "wormStun", amount: true }], // Extra damage vs MOAB-class bloons, and worm shots now briefly stun non-MOAB enemies.
        19: [{ stat: "damage", amount: 1 }, { stat: "range", amount: 5 }], // More damage and a little more range.
        20: [{ stat: "uzumakiUpgraded", amount: true }]                    // Max level bonus: upgrades the ultimate ability to be stronger and gain a bonus effect.
    },

    // ── UPDATE (runs every single frame, for every Geto on the map) ──────
    // This is where all of Geto's "ongoing" behavior lives: timers ticking
    // down, his homing projectiles moving and checking for hits, and his
    // ultimate ability's beam/aftermath effects.
    // `tower` is this specific Geto instance's data (position, level, etc.)
    // `dt` ("delta time") is how many seconds have passed since the last
    // update — using `dt` instead of a fixed number means the game behaves
    // the same whether it's running at 30fps, 60fps, or fast-forwarded.
    update(tower, dt) {
        // These two lines make sure Geto has the tracking properties he
        // needs before we use them. The very first time this function runs
        // for a brand new Geto, these won't exist yet, so we create them.
        if (!tower.shotCounter) tower.shotCounter = 0;   // Counts every shot fired, used to know when to fire a "worm" instead of a normal shot.
        if (!tower.squids) tower.squids = [];            // The list of Geto's currently-flying projectiles ("squids" and "worms").

        // --- Capture buff timer (granted after successfully using Ability 1) ---
        // When Geto successfully captures a curse, he gets a temporary damage
        // buff. `captureBuffTime` counts down from 5 seconds to 0.
        if (tower.captureBuffTime > 0) {
            tower.captureBuffTime -= dt;
            if (tower.captureBuffTime <= 0) tower.captureBuffTime = 0; // Clamp so it never goes negative.
        }

        // --- Curse Capture channeling (Ability 1 is in progress) ---
        // While capturing, Geto is "locked on" to one enemy for 1.5 seconds.
        // During that time we visually pull the target toward Geto and slow it down.
        if (tower.isCapturing) {
            tower.captureTime += dt; // Counts up toward the 1.5-second capture duration.

            if (tower.captureTarget && tower.captureTarget.alive) {
                // Figure out the direction from the target back to Geto...
                let dx = tower.x - tower.captureTarget.x, dy = tower.y - tower.captureTarget.y;
                let dist = Math.hypot(dx, dy); // Math.hypot(dx, dy) = the straight-line distance, same as sqrt(dx*dx + dy*dy).

                if (dist > 1) {
                    // ...and nudge the target's *visual* position toward Geto a little bit
                    // this frame. (offsetX/offsetY don't move the enemy off its real path —
                    // they're just a visual "being pulled" effect layered on top.)
                    tower.captureTarget.offsetX += (dx / dist) * 60 * dt;
                    tower.captureTarget.offsetY += (dy / dist) * 60 * dt;
                }
                // Also slow the target down slightly while it's being captured.
                tower.captureTarget.applySlow(0.0, 0.1, false);
            }

            // Once 1.5 seconds of channeling have passed, the capture completes:
            if (tower.captureTime >= 1.5) {
                if (tower.captureTarget && tower.captureTarget.alive) {
                    // Deal a huge amount of damage — effectively an instant kill on
                    // anything that was eligible to be captured (MOAB-class bloons
                    // are excluded from being valid targets in the first place —
                    // see the `ability()` function further down).
                    let dmg = tower.captureTarget.takeDamage(99999, { isMagic: true, canHitLead: true });
                    tower.damageDealt += dmg; // Keep a running total for stats/tracking.
                }
                tower.captureBuffTime = 5.0;   // Start the 5-second damage buff.
                tower.isCapturing = false;     // Capturing is done.
                tower.captureTarget = null;    // Forget the target so we don't keep referencing it.
                GameEngine.log("Curse captured!"); // Show a little message to the player.
            }
        }

        // --- Moving and updating Geto's projectiles ("squids" and "worms") ---
        // We loop backwards (from the end of the list to the start) because
        // we might remove items from the list while looping — looping
        // backwards means removing an item doesn't mess up the index of the
        // items we haven't looked at yet.
        for (let i = tower.squids.length - 1; i >= 0; i--) {
            let s = tower.squids[i]; // `s` = the current squid/worm we're updating.
            s.life -= dt;             // Count down its remaining lifetime.

            // Squids (regular shots) home in on the nearest enemy. Worms
            // (the special every-Nth shot) just fly in a straight line, so
            // they skip this whole homing block.
            if (!s.isWorm) {
                let nearest = null, nearestDist = Infinity;

                // Instead of checking distance to *every* enemy on the map
                // (which would get slow with hundreds of enemies), we ask
                // the spatial grid for only the enemies within 200 pixels —
                // much faster.
                const candidates = GameEngine.enemyGrid.query(s.x, s.y, 200);
                for (let e of candidates) {
                    if (!e.alive || s.hitEnemies.has(e)) continue; // Skip dead enemies, and ones we've already hit.
                    let d = Utils.distance(s.x, s.y, e.x, e.y);
                    if (d < nearestDist) { nearestDist = d; nearest = e; } // Keep track of whichever enemy is closest so far.
                }

                if (nearest) {
                    // Point the squid's velocity toward the nearest enemy.
                    let dx = nearest.x - s.x, dy = nearest.y - s.y;
                    let dist = Math.hypot(dx, dy);
                    if (dist > 1) {
                        s.vx = (dx / dist) * s.speed; // (dx/dist, dy/dist) is a "unit vector" — a direction
                        s.vy = (dy / dist) * s.speed;  // with length 1 — which we then scale up to the squid's speed.
                        s.angle = Math.atan2(s.vy, s.vx); // Used later just for drawing it facing the right way.
                    }
                }
            }

            // Move the squid/worm forward based on its current velocity.
            s.x += s.vx * dt;
            s.y += s.vy * dt;

            // Check if the squid/worm is now touching any enemy.
            const nearby = GameEngine.enemyGrid.query(s.x, s.y, s.hitRadius + 20);
            for (let e of nearby) {
                if (!e.alive || s.hitEnemies.has(e)) continue;

                if (Utils.distance(s.x, s.y, e.x, e.y) < e.data.radius + s.hitRadius) {
                    // It's a hit! Deal damage and remember we've hit this enemy
                    // (so a single projectile with pierce doesn't hit the same
                    // bloon twice in one pass).
                    let dmg = e.takeDamage(s.dmg, { isMagic: true, canHitLead: true });
                    tower.damageDealt += dmg;
                    s.hitEnemies.add(e);

                    // Level 6 bonus: apply a brief slow on hit, if unlocked.
                    if (s.slowOnHit) e.applySlow(0.85, 0.5, false);

                    // Level 18 bonus: worm shots briefly stun anything that
                    // ISN'T a MOAB-class bloon (MOAB/BFB/ZOMG/DDT/BAD are all
                    // flagged with `isMoab: true` in data.js, so checking
                    // that one flag is enough to correctly exclude all of them).
                    if (s.isWorm && s.wormStun && !e.data.isMoab) {
                        e.applySlow(0.0, 0.3, false);
                    }

                    s.pierce--; // Used up one pierce charge on this hit.
                    if (s.pierce <= 0 && !s.isWorm) {
                        // Out of pierce — remove this projectile from the list.
                        // (Worms are exempt: they have pierce:999, effectively unlimited,
                        // since they're meant to punch through a whole line of enemies.)
                        tower.squids.splice(i, 1);
                        break; // Stop checking this now-removed projectile against more enemies.
                    }
                }
            }

            // Also remove the squid/worm once its lifetime runs out, or if
            // it's flown off the visible play area (900x600 canvas, with a
            // little bit of margin so it doesn't just vanish right at the edge).
            if (s.life <= 0 || s.x < -50 || s.x > 1050 || s.y < -50 || s.y > 750) {
                tower.squids.splice(i, 1);
            }
        }

        // --- Ability 2: "Maximum: Uzumaki" (the big ultimate) ---
        // Two phases, both driven by `tower.uzumaki`:
        //   1. "condensing" — a ring of curse-spirit wisps spirals rapidly
        //      inward toward Geto (the "charging circle" visual). No damage yet.
        //   2. "firing" — the vortex collapses to a point and dark stretched
        //      hands burst outward. Damage during this phase uses the exact
        //      same numbers as before (dpsMult / moabDps hitting everyone on
        //      the map each frame) — only the *visual delivery* changed from
        //      a straight beam to a torrent of hands. If you'd rather have
        //      damage only land on enemies an individual hand actually
        //      reaches/touches, that's a separate, bigger change — just say so.
        if (tower.uzumaki) {
            const u = tower.uzumaki;

            if (u.phase === 'condensing') {
                u.condenseTime -= dt;

                // Spin every spirit inward faster and faster as the charge builds up.
                const pullSpeed = 1.5 + (1 - Math.max(u.condenseTime, 0) / u.condenseDuration) * 9; // Ramps from a light pull up to a violent yank.
                for (const spirit of u.spirits) spirit.update(dt, pullSpeed);

                if (u.condenseTime <= 0) {
                    // Charging finished — collapse into the firing phase.
                    u.phase = 'firing';
                    u.fireTime = u.fireDuration;
                    GameEngine.log(u.isUpgraded ? "Maximum Output: Uzumaki!" : "Maximum: Uzumaki!");
                }
            } else if (u.phase === 'firing') {
                u.fireTime -= dt;

                // Same damage-per-second math as the old straight beam, unchanged.
                const dpsMult = u.isUpgraded ? 12 : 8;
                const moabDps = u.isUpgraded ? 60 : 25;
                for (let e of GameEngine.enemies) {
                    if (!e.alive) continue;
                    let dmg = e.takeDamage(tower.stats.damage * dpsMult * dt, { isMagic: true, canHitLead: true });
                    tower.damageDealt += dmg;
                    if (e.data.isMoab) {
                        let moabDmg = e.takeDamage(moabDps * dt, { isMagic: true, canHitLead: true });
                        tower.damageDealt += moabDmg;
                    }
                }

                // Keep spawning new hands throughout most of the firing
                // window (not right at the very start/end, so they ease in
                // and out instead of switching on/off abruptly).
                const progress = 1 - Math.max(u.fireTime, 0) / u.fireDuration;
                if (progress > 0.05 && progress < 0.9 && Math.random() > 0.45) {
                    const spread = (Math.random() - 0.5) * 0.7; // Hands fan out around Geto's aimed direction rather than firing in one exact line.
                    u.hands.push(new _StretchedHand(tower.x, tower.y, u.angle + spread));
                }

                // Update and fade out existing hands, removing any that have fully faded.
                for (let i = u.hands.length - 1; i >= 0; i--) {
                    if (!u.hands[i].update(dt)) u.hands.splice(i, 1);
                }

                if (u.fireTime <= 0) {
                    // Level 20 bonus: leave behind a lingering slow field once the firing phase ends.
                    if (u.isUpgraded) tower.ceField = { life: 4.0, maxLife: 4.0 };
                    tower.uzumaki = null; // Ability fully finished — clean up so this block stops running.
                }
            }
        }

        // --- Level 20 residual field: slows every enemy on the map for a
        // few seconds after the ultimate ends. ---
        if (tower.ceField) {
            tower.ceField.life -= dt;
            for (let e of GameEngine.enemies) {
                if (!e.alive) continue;
                e.applySlow(0.7, 0.1, false); // Repeatedly re-applies a mild slow every frame while the field is up.
            }
            if (tower.ceField.life <= 0) tower.ceField = null; // Field's time is up — remove it.
        }
    },

    // ── DRAW (runs every frame, after update, to actually render Geto) ──
    // Order matters here: things drawn later appear "on top" of things
    // drawn earlier. We draw effects first, then Geto's own body last, so
    // his sprite/body always sits visually above his own effects.
    draw(ctx, tower, isPreview) {
        // Big ultimate: spiral vortex while charging, hand torrent while firing.
        if (tower.uzumaki) { this.drawUzumakiVFX(ctx, tower, tower.uzumaki); }
        // The lingering slow-field left behind after the upgraded ultimate.
        if (tower.ceField) { this.drawCEFieldVFX(ctx, tower); }
        // The "pulling" line effect while Ability 1 is channeling.
        if (tower.isCapturing && tower.captureTarget) {
            this.drawCaptureVFX(ctx, tower.x, tower.y, tower.captureTarget.x, tower.captureTarget.y, tower.captureTime / 1.5);
        }

        // Draw every squid/worm projectile currently in flight.
        // (Skipped in "preview" mode — the semi-transparent tower shown
        // while you're deciding where to place it — since it has no real projectiles yet.)
        if (!isPreview && tower.squids) {
            for (let s of tower.squids) {
                if (s.isWorm) { this.drawWormVFX(ctx, s.x, s.y, s.angle); }
                else { this.drawSquidVFX(ctx, s.x, s.y, s.angle); }
            }
        }

        // A pulsing ring around Geto while his post-capture damage buff is active.
        if (!isPreview && tower.captureBuffTime > 0) {
            let t = performance.now() / 1000; // Current time in seconds, used to animate the pulse.
            ctx.globalAlpha = 0.5 * (tower.captureBuffTime / 5.0); // Ring fades out as the buff runs out.
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(tower.x, tower.y, 18 + Math.sin(t * 8) * 3, 0, Math.PI * 2); // Ring radius wobbles slightly over time for a "pulsing" look.
            ctx.stroke();
            ctx.globalAlpha = 1; // Always reset globalAlpha back to fully-opaque afterward, so it doesn't leak into whatever draws next.
        }

        // Try to draw Geto's actual sprite image, if it's loaded.
        const baseAsset = Assets.get(`tower_geto_base`);
        if (baseAsset && baseAsset.loaded) {
            ctx.save(); // Remember the canvas's current state so we can restore it after.
            ctx.translate(tower.x, tower.y); // Move the drawing origin to Geto's position...
            if (!isPreview && !tower.stats.isStaticRotation) {
                ctx.rotate(tower.angle + Math.PI / 2); // ...and rotate to face his current target.
            }
            drawImageCentered(ctx, baseAsset, 45); // Draw the sprite centered on that origin.
            ctx.restore(); // Undo the translate/rotate so it doesn't affect anything drawn after this.
        } else {
            // Fallback: if the sprite image isn't available/loaded yet, draw
            // a simple placeholder shape instead, so Geto is never invisible.
            ctx.save();
            ctx.translate(tower.x, tower.y);
            if (!isPreview && !tower.stats.isStaticRotation) ctx.rotate(tower.angle + Math.PI / 2);

            // Body (dark purple robes)
            ctx.fillStyle = '#3a0060';
            ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
            // Head
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath(); ctx.arc(0, 2, 10, 0, Math.PI * 2); ctx.fill();
            // Topknot (a small golden dot)
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();

            ctx.restore();
        }
    },

    // ── VISUAL EFFECT HELPERS ────────────────────────────────────────────
    // Everything below this point is purely cosmetic — none of it affects
    // gameplay, it only draws things on screen. Each function follows the
    // same basic pattern: ctx.save() to remember canvas state, move/rotate
    // to the right spot, draw some shapes with a glow effect, then
    // ctx.restore() to put the canvas back the way it was.

    // Draws a small glowing purple "squid" for Geto's normal shots.
    drawSquidVFX(ctx, x, y, angle) {
        // First choice: use a real sprite image if one has been made and
        // has finished loading. `Assets.get('proj_squid')` looks for a file
        // at sprites/projectiles/squid.png (see the note above fire() for
        // exactly how that path gets built).
        const squidAsset = Assets.get('proj_squid');
        if (squidAsset && squidAsset.loaded) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle); // The sprite's default artwork should point rightward (+X) — see the notes below.
            drawImageCentered(ctx, squidAsset, 24); // 24px on-canvas size, matching the rough visual size of the old vector version.
            ctx.restore();
            return; // Sprite drew successfully, so skip the vector-art fallback below entirely.
        }

        // Fallback: no sprite yet (or it failed to load), so draw the
        // original hand-drawn glowing shape instead. This means you can
        // add the real art whenever it's ready — nothing breaks in the
        // meantime.
        let t = performance.now() / 1000; // Used to animate the tentacles spinning over time.
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(75, 0, 130, 0.8)'; // Soft purple glow around the shape.

        // A radial gradient (a circle of color that fades outward) gives
        // the squid body a glowing, soft-edged look instead of a flat circle.
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
        grad.addColorStop(0, '#a020f0');               // Center: bright purple.
        grad.addColorStop(0.6, '#4a0080');              // Middle: darker purple.
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');       // Edge: fully transparent, so it fades to nothing.
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();

        // Four small "tentacle" lines that slowly rotate around the body.
        ctx.strokeStyle = '#a020f0'; ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            let a = (i / 4) * Math.PI * 2 + t * 4; // Spread the 4 tentacles evenly around a circle, and spin them over time.
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); // Each tentacle points outward at angle `a`.
            ctx.stroke();
        }
        ctx.shadowBlur = 0; ctx.restore();
    },

    // Draws the flashier, rainbow, segmented "worm" projectile used every
    // 5th/8th shot (and always for stun-capable hits at level 18+).
    drawWormVFX(ctx, x, y, angle) {
        // Same sprite-first, vector-fallback pattern as drawSquidVFX above.
        const wormAsset = Assets.get('proj_worm');
        if (wormAsset && wormAsset.loaded) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            drawImageCentered(ctx, wormAsset, 50); // A bit bigger than the squid, matching the worm's larger vector-art footprint.
            ctx.restore();
            return;
        }

        let t = performance.now() / 1000;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.globalCompositeOperation = 'screen'; // "screen" blending makes overlapping bright colors glow instead of just covering each other up.
        ctx.shadowBlur = 20; ctx.shadowColor = 'rgba(0, 255, 200, 0.8)';

        // Draw 6 overlapping glowing circles in a row, each a slightly
        // different color, to create a segmented "dragon body" look.
        for (let i = 0; i < 6; i++) {
            let offset = Math.sin(t * 6 + i * 0.5) * 3;   // Each segment bobs up and down slightly, offset in time from its neighbors, for a slithering look.
            let hue = (i * 60 + t * 100) % 360;            // Cycles the color (hue) of each segment over time — this is what makes it look "rainbow".

            const grad = ctx.createRadialGradient(i * 9 - 22, offset, 0, i * 9 - 22, offset, 11);
            grad.addColorStop(0, `hsla(${hue}, 100%, 70%, 1)`);
            grad.addColorStop(0.5, `hsla(${hue}, 80%, 40%, 0.6)`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(i * 9 - 22, offset, 11, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over'; // Reset blending back to normal before we finish.
        ctx.shadowBlur = 0; ctx.restore();
    },

    // Draws the big "Maximum: Uzumaki" ultimate: a ring of curse spirits
    // spiraling inward while charging, then a burst of dark stretched hands
    // once it fires.
    drawUzumakiVFX(ctx, tower, u) {
        if (u.phase === 'condensing') {
            // Just draw every spirit at its current spiral position — the
            // "charging" look comes entirely from their update() logic
            // spinning them inward faster and faster each frame.
            for (const spirit of u.spirits) spirit.draw(ctx, tower.x, tower.y);
        } else if (u.phase === 'firing') {
            // A small bright flash at Geto's position marks the collapse point
            // the hands are erupting from.
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.shadowBlur = 30; ctx.shadowColor = u.isUpgraded ? 'rgba(255, 0, 100, 0.9)' : 'rgba(128, 0, 255, 0.9)';
            const grad = ctx.createRadialGradient(tower.x, tower.y, 0, tower.x, tower.y, 22);
            grad.addColorStop(0, 'rgba(255,255,255,0.9)');
            grad.addColorStop(0.5, u.isUpgraded ? 'rgba(255,0,100,0.6)' : 'rgba(128,0,255,0.6)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(tower.x, tower.y, 22, 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
            ctx.restore();

            // Then every currently-flying hand on top of that.
            for (const hand of u.hands) hand.draw(ctx);
        }
    },

    // Draws the screen-wide purple tint and wavy "curse lines" for the
    // level-20 lingering slow field left behind after the ultimate.
    drawCEFieldVFX(ctx, tower) {
        let t = performance.now() / 1000;
        let alpha = (tower.ceField.life / tower.ceField.maxLife) * 0.25; // Fades out smoothly as the field's remaining time runs down.

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = `rgba(150, 0, 255, ${alpha})`;
        ctx.fillRect(0, 0, 1000, 700); // Tint the whole visible play area purple.

        // A few horizontal wavy lines drifting across the screen for extra flair.
        ctx.strokeStyle = `rgba(200, 100, 255, ${alpha * 2.5})`; ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            let yBase = i * 140; // Spread the 5 lines evenly down the screen.
            for (let x = 0; x < 1000; x += 10) {
                let y = yBase + Math.sin(x * 0.02 + t * 3 + i) * 20;
                if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.restore();
    },

    // Draws the wavy "pulling" line between Geto and his capture target
    // while Ability 1 is channeling, plus small particles flowing along it.
    drawCaptureVFX(ctx, x1, y1, x2, y2, progress) {
        let t = performance.now() / 1000;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.shadowBlur = 15; ctx.shadowColor = 'rgba(200, 0, 255, 0.8)';
        ctx.strokeStyle = `rgba(200, 100, 255, ${progress})`; ctx.lineWidth = 3; // Line gets more opaque as the capture gets closer to finishing.
        ctx.setLineDash([5, 5]);            // Makes the line dashed instead of solid...
        ctx.lineDashOffset = -t * 30;        // ...and animates the dashes crawling along the line over time.

        ctx.beginPath();
        ctx.moveTo(x1, y1); // Start at Geto...
        // A "quadratic curve" bends the line through a control point instead
        // of drawing it perfectly straight — the control point itself wobbles
        // over time, giving the line a gentle wavering motion.
        let mx = (x1 + x2) / 2 + Math.sin(t * 3) * 20;
        let my = (y1 + y2) / 2 + Math.cos(t * 3) * 20;
        ctx.quadraticCurveTo(mx, my, x2, y2); // ...curve toward the target.
        ctx.stroke();
        ctx.setLineDash([]); // Reset back to a solid line for anything drawn after this.

        // A handful of small dots that appear to flow from the target back
        // toward Geto, to sell the idea of "pulling" the curse toward him.
        for (let i = 0; i < 4; i++) {
            let p = ((t * 2 + i * 0.25) % 1); // A value that cycles smoothly from 0 to 1, repeating, staggered slightly for each of the 4 particles.
            let px = x2 + (x1 - x2) * p; // Linearly interpolate position from the target (p=0) toward Geto (p=1).
            let py = y2 + (y1 - y2) * p;
            ctx.fillStyle = `rgba(255, 255, 255, ${1 - p})`; // Fades out as it gets closer to Geto.
            ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.restore();
    },

    // ── ABILITY 1: Curse Capture (unlocked at level 3) ───────────────────
    // Picks the best nearby non-MOAB-class enemy and begins channeling a
    // 1.5-second capture on it (handled in update() above). This function
    // only runs once, at the moment the player clicks the ability button —
    // it's responsible for choosing the target and starting the process.
    ability(tower, engine) {
        if (tower.isCapturing) { engine.log("Already capturing."); return; } // Can't start a second capture while one's already in progress.

        let target = null;
        let bestValue = -Infinity; // We'll keep replacing this with better and better candidates as we check each enemy.

        for (let e of engine.enemies) {
            if (!e.alive) continue;
            // MOAB-class bloons (and the two other big types) can't be captured —
            // capturing them would be far too strong, so they're filtered out here.
            if (e.data.isMoab || e.data.isDDT || e.data.isBAD) continue;

            const dist = Utils.distance(tower.x, tower.y, e.x, e.y);
            if (dist > tower.stats.range) continue; // Only consider enemies actually within range.

            // We want the toughest nearby enemy, slightly favoring closer
            // ones. `value` combines "how much HP does it have" with a small
            // penalty for being farther away, so Geto doesn't always just
            // grab the single toughest bloon on the whole map even if it's
            // clear across the screen.
            const hp = Number.isFinite(e.hp) ? e.hp : (e.data.maxHp || 0);
            const value = hp - dist * 0.2;
            if (value > bestValue) {
                bestValue = value;
                target = e;
            }
        }

        if (!target) { engine.log("No curse to capture."); return; } // Nothing valid in range.

        engine.log("Curse Capture!");
        tower.isCapturing = true;
        tower.captureTime = 0;
        tower.captureTarget = target;
    },

    // ── ABILITY 2: Maximum: Uzumaki (unlocked at level 10, upgraded at 20) ──
    // This just starts the beam — all of the actual damage-dealing and
    // visual effects happen over time inside update()/draw() above, driven
    // by the `tower.uzumaki` object created here.
    ability2(tower, engine) {
        let isUpgraded = tower.stats.uzumakiUpgraded;
        engine.log("Charging Maximum: Uzumaki..."); // The "fired" log now happens once charging finishes, in update() above.

        const angle = tower.angle || 0; // Lock in the direction the hands will fan out toward, based on wherever Geto is currently facing.

        // Spawn the initial ring of curse-spirit wisps, scattered around
        // Geto so the vortex looks like it's already "there" the instant
        // charging starts, rather than all popping in at the rim at once.
        const chargeRadius = 90; // How wide the charging circle is, in pixels — tune this to make the vortex bigger/smaller.
        const spiritCount = 90;  // Kept modest on purpose: this only runs for the ~1.5s charge window, but many spirits each doing their own spline-mesh math adds up, especially at higher game speeds.
        const spirits = [];
        for (let i = 0; i < spiritCount; i++) {
            spirits.push(new _UzumakiSpirit(tower.x, tower.y, chargeRadius));
        }

        tower.uzumaki = {
            phase: 'condensing',                 // 'condensing' (charging circle) → 'firing' (hand torrent) → cleared.
            condenseDuration: 1.5,                 // Same 1.5s wind-up as before.
            condenseTime: 1.5,
            fireDuration: isUpgraded ? 6.0 : 4.0,  // Same total firing duration as before.
            fireTime: 0,
            angle: angle,
            isUpgraded: isUpgraded,
            spirits: spirits,
            hands: []
        };
    },

    // ── NORMAL ATTACK (called automatically by the game whenever it's
    // time for Geto to take a regular shot, based on his fireRate) ──────
    fire(tower, target, damage, dmgType, isCrit, effects) {
        if (!tower.squids) tower.squids = [];
        tower.shotCounter = (tower.shotCounter || 0) + 1; // Track shot count, used below to decide if this shot should be a "worm".

        // Level 3+ bonus: while the post-capture buff is active, deal 1.5x damage.
        let actualDmg = damage;
        if (tower.captureBuffTime > 0) actualDmg = Math.floor(actualDmg * 1.5);

        let moabBonus = tower.stats.moabDmgBonus || 0;   // Level 18 bonus: extra flat damage vs MOAB-class bloons.
        let slowOnHit = !!tower.stats.slowOnHit;          // Level 6 bonus: apply a slow whenever a shot hits.
        let wormStun = !!tower.stats.wormStun;            // Level 18 bonus: worm shots stun on hit.

        // Decide whether this particular shot should be a "worm" (a
        // stronger, straight-flying attack) instead of a normal homing squid.
        // Level 14 makes worms happen more often (every 5th shot) than the
        // level 7 version (every 8th shot) — if both are unlocked, the
        // more frequent one takes priority.
        let wormEvery8th = !!tower.stats.wormEvery8th;
        let wormEvery5th = !!tower.stats.wormEvery5th;
        let isWorm = false;
        if (wormEvery5th) isWorm = (tower.shotCounter % 5 === 0);
        else if (wormEvery8th) isWorm = (tower.shotCounter % 8 === 0);

        if (isWorm) {
            // Worms fly straight at wherever the target currently is (no
            // homing correction afterward), so we just aim once, right now.
            let dx = target.x - tower.x, dy = target.y - tower.y;
            let dist = Math.hypot(dx, dy);
            let speed = 600;
            let vx = dist > 0 ? (dx / dist) * speed : 0;
            let vy = dist > 0 ? (dy / dist) * speed : 0;
            let wormDmg = 4 + (tower.stats.wormDmgBonus || 0); // Worms have their own flat damage value (not based on Geto's normal `damage` stat), boosted at level 14.

            tower.squids.push({
                x: tower.x, y: tower.y,
                vx: vx, vy: vy, speed: speed,
                life: 1.5,                     // Worms live a bit longer than normal squids, to travel further.
                dmg: wormDmg + moabBonus,
                pierce: 999,                    // Effectively unlimited pierce — worms are meant to punch through a whole line of enemies.
                hitRadius: 22,                  // Bigger hit radius than a normal squid, since it's a "dragon" flying through a line of enemies.
                hitEnemies: new Set(),          // Tracks which enemies this specific worm has already hit, so it doesn't double-hit the same one.
                isWorm: true,
                angle: Math.atan2(vy, vx),
                wormStun: wormStun,
                slowOnHit: false                // Worms use their own separate stun effect instead of the normal slow-on-hit.
            });
        } else {
            // Normal shot: fire one squid (or two, side-by-side, once
            // "Twin Squid" is unlocked at level 12).
            let squidCount = tower.stats.twinSquid ? 2 : 1;
            let baseAngle = Math.atan2(target.y - tower.y, target.x - tower.x);

            for (let i = 0; i < squidCount; i++) {
                // If firing two squids, angle them slightly apart (one a
                // bit left, one a bit right) instead of firing both
                // perfectly overlapping.
                let spread = squidCount > 1 ? (i === 0 ? -0.2 : 0.2) : 0;
                let a = baseAngle + spread;
                let speed = 450;

                tower.squids.push({
                    x: tower.x, y: tower.y,
                    vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                    speed: speed,
                    life: 1.0,
                    dmg: actualDmg + moabBonus,
                    pierce: tower.stats.pierce,
                    hitRadius: 12,
                    hitEnemies: new Set(),
                    isWorm: false,
                    angle: a,
                    slowOnHit: slowOnHit,
                    wormStun: false
                });
            }
        }
    }
};