// js/loadingMinigame.js
// Harmless interactive loading-screen minigame (Budokai Tenkaichi style):
// mash/click/tap to shake swords loose. Swords are scattered around the
// screen; each pull makes the current one budge, and once it's shaken out it
// pops and a fresh one spawns in its place (continuous, no batches). Momentum
// ramps with clicks, so later swords budge harder and pop faster. Purely
// decorative — the loading sequence never waits on it. The caller may set
// `onComplete`, fired once per xpMilestone swords taken (e.g. to grant +1 XP).
import { AudioEngine } from './audio.js';
import { TUNING } from './tuning.js';

// Feel knobs live in js/tuning.js (exposed as window.tuning) so they can be
// dialed in live from the console; these are just thin aliases into that
// object (read at use time, so console tweaks apply immediately).
const T = TUNING.minigame;

const SPRITES = {
    ground: 'sprites/menu/sword_ground.png',
    out: 'sprites/menu/sword_out.png',
};

const BG = '#16351c';
const DIRT = '#4a3620';
const SPARK = '#ffd766';
const ACCENT = '#e67e22';
const GOLD = '#f1c40f';

let canvas = null;
let ctx = null;
let running = false;
let rafId = 0;
let lastTs = 0;

let W = 1280;
let H = 720;

let swords = [];
let currentIdx = 0;
let clicks = 0;
let taken = 0;
let xpFlashT = 0;
let jolt = 0;
let shake = 0;
let hintAlpha = 1;
let motes = [];
let particles = [];
let imgs = {};
let holdTimer = null;
let time = 0;
let tapX = null;
let tapY = null;

let completeCb = null;

function makeImage(src) {
    const img = new Image();
    img.loaded = false;
    img.onload = () => { img.loaded = true; };
    img.onerror = () => { img.loaded = false; };
    img.src = src;
    return img;
}

function loadSprites() {
    for (const key of Object.keys(SPRITES)) {
        if (!imgs[key]) imgs[key] = makeImage(SPRITES[key]);
    }
}

function baseSize() {
    return Math.min(W, H) * T.sizeFracGround;
}

function outSize() {
    return Math.min(W, H) * T.sizeFracOut;
}

function spawnSwords() {
    swords = [];
    currentIdx = 0;
    taken = 0;
    for (let i = 0; i < T.swordCount; i++) {
        swords.push(makeSword(i === 0));
    }
}

function makeSword(forceSpawn) {
    const spot = randomFreeSpot(forceSpawn);
    return {
        fx: spot.fx,
        fy: spot.fy,
        scaleK: 0.9 + Math.random() * 0.2,
        rot: 0,                                      // all planted blade-down
        wobblePhase: Math.random() * Math.PI * 2,
        t: 0,                                       // shake progress 0..1
        res: 0.85 + Math.random() * 0.3,            // resistance (pop order varies)
        budge: 0,                                   // visual shake energy
        sparkle: 0,
        freeT: 0,                                   // seconds left shown as sword_out
        removed: false,
        respawnT: 0,
    };
}

function randomFreeSpot(forceSpawn) {
    const m = 0.08; // margin as fraction, keeps swords fully on-screen-ish
    const minDist = baseSize() * 1.3;
    for (let tries = 0; tries < 50; tries++) {
        const fx = m + Math.random() * (1 - m * 2);
        const fy = m + Math.random() * (1 - m * 2);
        if (!forceSpawn) {
            let ok = true;
            for (const s of swords) {
                if (s.removed) continue;
                const dx = (s.fx - fx) * W;
                const dy = (s.fy - fy) * H;
                if (Math.hypot(dx, dy) < minDist) { ok = false; break; }
            }
            if (ok) return { fx, fy };
        } else {
            return { fx, fy };
        }
    }
    return { fx: 0.5, fy: 0.5 };
}

function resetMotes() {
    motes = [];
    for (let i = 0; i < 26; i++) {
        motes.push({
            x: Math.random() * W,
            y: Math.random() * H,
            r: 0.6 + Math.random() * 1.6,
            vy: -(4 + Math.random() * 10),
            vx: (Math.random() - 0.5) * 6,
            a: 0.05 + Math.random() * 0.18,
            phase: Math.random() * Math.PI * 2,
        });
    }
}

let momentum = 0;   // 0..1; more momentum = bigger gains, less = faster drain

function pullPower() {
    return momentum;
}

function spawnParticles(sx, sy, n, color, opts = {}) {
    for (let i = 0; i < n; i++) {
        const a = opts.angle !== undefined ? opts.angle + (Math.random() - 0.5) * 1.2 : -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
        const speed = (opts.speed || 90) * (0.5 + Math.random() * 1.1);
        particles.push({
            x: sx,
            y: sy,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed - (opts.lift || 0),
            size: opts.size || 2.5,
            color,
            life: opts.life || 0.6,
            maxLife: opts.life || 0.6,
            ring: !!opts.ring,
            gravity: opts.gravity !== undefined ? opts.gravity : 220,
        });
    }
}

function selectNextSword() {
    // Advance the current sword to the next one that can actually be pulled
    // (not removed, not mid-pop). Wraps around; on the rare case nothing is
    // pullable it just leaves the index wherever the scan stopped.
    for (let i = 0; i < T.swordCount; i++) {
        currentIdx = (currentIdx + 1) % T.swordCount;
        const s = swords[currentIdx];
        if (s && !s.removed && s.freeT <= 0) return;
    }
}

function takeOut(s) {
    s.freeT = T.freeTime;
    s.sparkle = 1;
    taken++;
    const px = s.fx * W;
    const py = s.fy * H;
    spawnParticles(px, py, 10, DIRT, { lift: 70 });
    spawnParticles(px, py, 6, SPARK, { speed: 140, lift: 40, gravity: 60, size: 2 });
    AudioEngine.playSfx('pop');
    if (taken % T.xpMilestone === 0) {
        // Silent reward: just flash a +1 by the counter, no banner.
        xpFlashT = T.xpFlashTime;
        if (completeCb) completeCb();
    }
}

function pull() {
    clicks++;
    jolt = 1;
    // Momentum is self-reinforcing: gain scales with what you already have,
    // and the decay (see update) bites harder the lower you are.
    momentum = Math.min(1, momentum + T.momentum.gain * (1 + momentum * T.momentum.selfBoost));
    if (momentum >= T.pullMax) shake = Math.min(shake + 2.5, 6);
    // The click effect lands at a random spot just around the cursor, so the
    // feedback feels alive instead of stacking in one exact pixel. Ring and
    // sparks each get their own random offset.
    const ringX = (tapX !== null && tapY !== null) ? tapX + (Math.random() - 0.5) * 34 : W / 2;
    const ringY = (tapX !== null && tapY !== null) ? tapY + (Math.random() - 0.5) * 34 : H / 2;
    const sparkX = (tapX !== null && tapY !== null) ? tapX + (Math.random() - 0.5) * 28 : W / 2;
    const sparkY = (tapX !== null && tapY !== null) ? tapY + (Math.random() - 0.5) * 28 : H / 2;
    spawnParticles(ringX, ringY, 1, '#ffffff', { ring: true, life: 0.45, speed: 60, size: 3 });
    spawnParticles(sparkX, sparkY, 4, SPARK, { speed: 90, lift: 20, gravity: 80, size: 1.8, life: 0.35 });

    const s = swords[currentIdx];
    if (s && !s.removed && s.freeT <= 0) {
        const power = (0.04 + momentum * T.pullProgress) * (0.85 + Math.random() * 0.3) / s.res;
        s.t += power;
        s.budge = 1;
        if (s.t >= 1) {
            s.t = 1;
            takeOut(s);
        }
    }
    // A popped sword is no longer pullable, so jump the selection straight to
    // the next sword instead of waiting for it to respawn and re-select.
    if (s && (s.removed || s.freeT > 0)) selectNextSword();
}

function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    tapX = e.clientX - rect.left;
    tapY = e.clientY - rect.top;
    pull();
    clearInterval(holdTimer);
    holdTimer = setInterval(pull, 120);
}

function onPointerMove(e) {
    // Keep the effect anchored to wherever the cursor is now, so held pulls
    // follow the mouse instead of piling up at the press point.
    const rect = canvas.getBoundingClientRect();
    tapX = e.clientX - rect.left;
    tapY = e.clientY - rect.top;
}

function onPointerEnd() {
    clearInterval(holdTimer);
    holdTimer = null;
    tapX = null;
    tapY = null;
}

function onKeyDown(e) {
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        const s = swords[currentIdx];
        tapX = s ? s.fx * W : W / 2;
        tapY = s ? s.fy * H : H / 2;
        pull();
    }
}

function update(dt) {
    time += dt;
    // Momentum drains, and the drain bites harder the lower it is — so low
    // momentum crumbles away while high momentum mostly holds itself up. A
    // small constant drain means even full momentum slowly decays, so max is
    // something you have to keep pulling to hold onto.
    momentum = Math.max(0, momentum - (T.momentum.drain * (1 - momentum) + T.momentum.baseDrain) * dt);
    jolt = Math.max(0, jolt - dt * 5);
    shake = Math.max(0, shake - dt * 26);
    if (hintAlpha > 0 && clicks > 3) hintAlpha = Math.max(0, hintAlpha - dt * 0.5);

    if (xpFlashT > 0) xpFlashT = Math.max(0, xpFlashT - dt);

    for (const s of swords) {
        if (s.freeT > 0) {
            s.freeT -= dt;
            if (s.freeT <= 0) {
                s.freeT = 0;
                s.removed = true;
                s.respawnT = T.respawnDelay;
            }
        }
        // Idle extraction: swords come out on their own, very slowly, even
        // when the player isn't pulling.
        if (!s.removed && s.freeT <= 0 && s.t < 1) {
            s.t = Math.min(1, s.t + T.passiveProgress * dt / s.res);
            if (s.t >= 1) takeOut(s);
        }
        if (s.removed) {
            s.respawnT -= dt;
            if (s.respawnT <= 0) {
                const fresh = makeSword(false);
                s.fx = fresh.fx;
                s.fy = fresh.fy;
                s.rot = fresh.rot;
                s.scaleK = fresh.scaleK;
                s.wobblePhase = fresh.wobblePhase;
                s.t = 0;
                s.res = fresh.res;
                s.freeT = 0;
                s.removed = false;
            }
        }
        s.sparkle = Math.max(0, s.sparkle - dt * 3);
        s.budge = Math.max(0, s.budge - dt * 6);
    }

    // Keep the selection on a pullable sword: if the current one popped (from
    // a pull OR idle extraction) or is mid-pop-flash, jump straight to the
    // next one rather than pulling dead air until it respawns.
    const cur = swords[currentIdx];
    if (cur && (cur.removed || cur.freeT > 0)) selectNextSword();

    for (const m of motes) {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.phase += dt * 2;
        if (m.y < -4) { m.y = H + 4; m.x = Math.random() * W; }
        if (m.x < -4) m.x = W + 4;
        if (m.x > W + 4) m.x = -4;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.vy += (p.ring ? 0 : p.gravity) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
    }
}

function drawSwordFallback(cx, cy, imgW, imgH, rot) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = '#c9d2d9';
    ctx.beginPath();
    ctx.moveTo(-imgW * 0.16, imgH / 2);
    ctx.lineTo(imgW * 0.16, imgH / 2);
    ctx.lineTo(imgW * 0.05, -imgH / 2);
    ctx.lineTo(-imgW * 0.05, -imgH / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7a5a2e';
    ctx.fillRect(-imgW * 0.3, -imgH * 0.23, imgW * 0.6, imgH * 0.08);
    ctx.restore();
}

function spriteFor(s) {
    const free = s.freeT > 0;
    const img = free ? imgs.out : imgs.ground;
    const loaded = img && img.loaded;
    const aspect = loaded && img.height ? img.width / img.height : 0.24;
    return { img, loaded, free, aspect };
}

function swordSize(s) {
    const { aspect } = spriteFor(s);
    const h = (s.freeT > 0 ? outSize() : baseSize()) * s.scaleK;
    return { w: h * aspect, h };
}

function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (shake > 0.2) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    const isPulling = jolt > 0;
    const power = pullPower();
    for (let i = 0; i < T.swordCount; i++) {
        const s = swords[i];
        const x = s.fx * W;
        const y = s.fy * H;
        const { img, loaded, free, aspect } = spriteFor(s);
        const { w: imgW, h: imgH } = swordSize(s);

        if (!s.removed) {
            let rot = s.rot;
            let alpha = 1;
            let lift = 0;
            let scale = 1;
            if (free) {
                // Freed flash: slide up out of the ground and fade out.
                const k = 1 - s.freeT / T.freeTime;
                alpha = 1 - k * k;
                lift = -Math.sin(k * Math.PI / 2) * 42;
                scale = 1;
            } else if (i === currentIdx) {
                // Violent shake on a pull, plus a growing pre-pop tremble.
                if (isPulling) {
                    rot += Math.sin(time * 45 + s.wobblePhase) * jolt * 0.12 * (1 + power * 0.6);
                    rot += (Math.random() - 0.5) * 0.015 * jolt;
                }
                rot += Math.sin(time * (16 + power * 34) + s.wobblePhase) * s.t * 0.03;
                scale = 1 + jolt * 0.03;
            }
            const w2 = imgW * scale;
            const h2 = imgH * scale;
            if (loaded) {
                ctx.save();
                ctx.globalAlpha *= alpha;
                ctx.translate(x, y + lift);
                ctx.rotate(rot);
                ctx.drawImage(img, -w2 / 2, -h2 / 2, w2, h2);
                ctx.restore();
            } else {
                ctx.save();
                ctx.globalAlpha *= alpha;
                drawSwordFallback(x, y + lift, w2, h2, rot);
                ctx.restore();
            }
        }

        // Sparkles where a sword just popped.
        if (s.removed && s.sparkle > 0.05) {
            ctx.globalAlpha = s.sparkle;
            ctx.fillStyle = SPARK;
            for (let k = 0; k < 4; k++) {
                const a = time * 3 + k * 1.6;
                ctx.beginPath();
                ctx.arc(x + Math.cos(a) * 22 * s.sparkle, y + Math.sin(a * 1.3) * 16, 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        // Current-sword marker ring.
        if (i === currentIdx && !s.removed && s.freeT <= 0) {
            ctx.strokeStyle = `rgba(230, 126, 34, ${0.35 + 0.3 * Math.sin(time * 6)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, imgW * 0.85 + Math.sin(time * 6) * 3, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // Particles (dirt, sparks, pull rings).
    for (const p of particles) {
        const a = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = a;
        if (p.ring) {
            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4 + (1 - a) * 46, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;

    ctx.restore(); // end shake

    // HUD (no shake).
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(10, 10, 150, 32);
    ctx.fillStyle = '#fff';
    ctx.font = '700 18px "Luckiest Guy", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(`SWORDS  ${taken}`, 22, 27);

    // Silent +1 flash next to the pulled count (fades and drifts up).
    if (xpFlashT > 0) {
        const k = 1 - xpFlashT / T.xpFlashTime;
        ctx.globalAlpha = (1 - k) * (1 - k);
        ctx.fillStyle = GOLD;
        ctx.font = '700 20px "Luckiest Guy", sans-serif';
        ctx.fillText('+1', 22 + ctx.measureText(`SWORDS  ${taken}`).width + 14, 27 - k * 14);
        ctx.globalAlpha = 1;
    }

    const mp = power / T.pullMax;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(W - 190, 10, 180, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '700 13px "Luckiest Guy", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('MOMENTUM', W - 24, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(W - 178, 30, 150, 8);
    ctx.fillStyle = mp >= 0.95 ? GOLD : ACCENT;
    ctx.fillRect(W - 178, 30, 150 * mp, 8);
    ctx.textAlign = 'left';

    if (hintAlpha > 0) {
        ctx.globalAlpha = hintAlpha;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '700 16px "Luckiest Guy", sans-serif';
        ctx.fillText('CLICK / TAP / SPACE — SHAKE THEM LOOSE', W / 2, H * 0.88);
        ctx.globalAlpha = 1;
    }

    // Ambient motes + vignette.
    for (const m of motes) {
        ctx.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(m.phase));
        ctx.fillStyle = '#8fd694';
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
}

function fitCanvas() {
    const overlay = document.getElementById('loading-screen');
    const w = overlay ? overlay.clientWidth : 0;
    const h = overlay ? overlay.clientHeight : 0;
    W = w > 0 ? w : 1280;
    H = h > 0 ? h : 720;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function tick(ts) {
    if (!running) return;
    const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0.016;
    lastTs = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(tick);
}

export const LoadingMinigame = {
    start() {
        if (running) return;
        canvas = document.getElementById('loading-minigame');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        loadSprites();
clicks = 0;
        momentum = 0;
        time = 0;
        particles = [];
        hintAlpha = 1;
        xpFlashT = 0;
        jolt = 0;
        shake = 0;
        resetMotes();
        spawnSwords();
        fitCanvas();
        running = true;
        lastTs = 0;
        window.addEventListener('pointerdown', onPointerDown, { passive: false });
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerEnd);
        window.addEventListener('pointercancel', onPointerEnd);
        window.addEventListener('blur', onPointerEnd);
        window.addEventListener('resize', fitCanvas);
        document.addEventListener('keydown', onKeyDown);
        rafId = requestAnimationFrame(tick);
    },

    stop() {
        if (!running) return;
        running = false;
        cancelAnimationFrame(rafId);
        clearInterval(holdTimer);
        holdTimer = null;
        window.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerEnd);
        window.removeEventListener('pointercancel', onPointerEnd);
        window.removeEventListener('blur', onPointerEnd);
        window.removeEventListener('resize', fitCanvas);
        document.removeEventListener('keydown', onKeyDown);
    },

    set onComplete(fn) { completeCb = fn; },
};

// Dev/console commands to play the minigame on demand (e.g. from the browser
// devtools): forceMinigame() pops it over the current screen; closeMinigame()
// (or the Back button) dismisses it. Mirrors the existing window.* debug
// helpers (triggerBossCutscene, toggleNight, ...).
let closeBtnWired = false;
function _overlay() {
    return document.getElementById('loading-screen');
}
function _closeBtn() {
    return document.getElementById('minigame-close');
}

window.forceMinigame = function () {
    const overlay = _overlay();
    if (!overlay) return 'No loading-screen overlay found.';
    LoadingMinigame.stop();
    overlay.classList.remove('hidden');
    overlay.classList.add('minigame-only');
    const closeBtn = _closeBtn();
    if (closeBtn) {
        closeBtn.classList.remove('hidden');
        if (!closeBtnWired) {
            closeBtn.addEventListener('click', () => window.closeMinigame());
            closeBtnWired = true;
        }
    }
    LoadingMinigame.start();
    return 'Minigame started. Dismiss with closeMinigame() or the Back button.';
};

window.closeMinigame = function () {
    LoadingMinigame.stop();
    const overlay = _overlay();
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('minigame-only');
    }
    const closeBtn = _closeBtn();
    if (closeBtn) closeBtn.classList.add('hidden');
};