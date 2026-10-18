// js/cutsceneEditor.js — keyframe animator for the knight cutscene.
// Plays the cutscene (built-in beats + your keyframe track) and edits the
// track live. Save persists to localStorage; the game loads it on boot.

import { TUNING, BOSS_KEYS, bossKeyEndTime, sampleBossKeys } from './tuning.js';

// ---------- persistence ----------
const KEYS_STORE = 'kilo_boss_keys_v1';
function loadKeys() {
    try {
        const raw = localStorage.getItem(KEYS_STORE);
        if (raw) {
            const saved = JSON.parse(raw);
            BOSS_KEYS.keys = saved.keys || [];
            BOSS_KEYS.tail = saved.tail ?? 0.8;
        }
    } catch (e) { console.warn('bad keys store', e); }
}
function saveKeys() {
    BOSS_KEYS.keys.sort((a, b) => a.t - b.t);
    localStorage.setItem(KEYS_STORE, JSON.stringify({ tail: BOSS_KEYS.tail, keys: BOSS_KEYS.keys }));
}
loadKeys();

// ---------- sprite options ----------
const SPRITE_OPTIONS = [];
for (let i = 1; i <= 19; i++) SPRITE_OPTIONS.push(`boss_knight_back_${i}`);
for (let i = 1; i <= 20; i++) SPRITE_OPTIONS.push(`boss_equip_sword_${i}`);
for (let i = 1; i <= 5; i++) SPRITE_OPTIONS.push(`boss_ball_${i}`);
for (let i = 1; i <= 4; i++) SPRITE_OPTIONS.push(`boss_ball_transition_${i}`);
SPRITE_OPTIONS.push('enemy_knight_front');

function spriteUrl(key) {
    if (!key) return null;
    if (key === 'enemy_knight_front') return 'sprites/sheets/enemies/knight_front.png';
    if (key.startsWith('boss_')) return `sprites/boss/${key.slice(5)}.png`;
    return null;
}

// ---------- toast ----------
let toastTimer = null;
function toast(msg, isErr) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ''; }, 2400);
}

// ---------- state ----------
const KF = BOSS_KEYS;      // { tail, keys }
const builtInPhases = () => TUNING.bossAnim.phases;
const builtInPre = () => {
    const p = builtInPhases();
    return p.tension + p.slash + p.ripWait + p.rip;
};
const trackEnd = () => bossKeyEndTime();
const totalDur = () => builtInPre() + Math.max(trackEnd(), 2.5); // + at least a beat of fight

const stage = {
    t: 0,
    playing: false,   // starts paused on first frame
    loop: true,
    selected: -1,     // index into KF.keys
    view: { start: 0, end: 1 }, // timeline viewport, fractions of total duration
};

// Viewport helpers: f is a 0..1 fraction across the VISIBLE bar.
function viewSpan() { return stage.view.end - stage.view.start; }
function fracToTime(f) { return (stage.view.start + f * viewSpan()) * totalDur(); }
function timeToViewFrac(t) {
    const total = totalDur();
    if (total <= 0) return 0;
    return (t / total - stage.view.start) / viewSpan();
}
function zoomAt(viewFrac, factor) {
    const span = viewSpan();
    const anchor = stage.view.start + viewFrac * span;
    let newSpan = Math.min(1, Math.max(0.02, span * factor));
    let start = anchor - viewFrac * newSpan;
    start = Math.min(1 - newSpan, Math.max(0, start));
    stage.view = { start, end: start + newSpan };
    rebuildBeatBar();
    updateZoomLabel();
}
function panBy(dirFrac) {
    const shift = dirFrac * viewSpan();
    const span = viewSpan();
    let start = Math.min(1 - span, Math.max(0, stage.view.start + shift));
    stage.view = { start, end: start + span };
    rebuildBeatBar();
}
function updateZoomLabel() {
    const el = document.getElementById('zoom-label');
    if (el) el.textContent = `${Math.round(100 / viewSpan())}%`;
}

// ---------- timeline UI ----------
const beatBar = document.getElementById('beat-bar');
const scrubber = document.getElementById('scrubber');
const timeLabel = document.getElementById('time-label');

function rebuildBeatBar() {
    beatBar.innerHTML = '';
    const total = totalDur();
    const pre = builtInPre();
    const L = (t) => `${Math.max(0, Math.min(100, timeToViewFrac(t) * 100))}%`;
    const Wt = (a, b) => `${Math.max(0, (timeToViewFrac(b) - timeToViewFrac(a)) * 100)}%`;
    // Built-in region
    const bi = document.createElement('div');
    bi.className = 'beat rip';
    bi.style.left = L(0);
    bi.style.width = Wt(0, pre);
    bi.textContent = 'MOAB (built-in)';
    beatBar.appendChild(bi);
    // Keyframe region
    const kf = document.createElement('div');
    kf.className = 'beat reveal';
    kf.style.left = L(pre);
    kf.style.width = Wt(pre, Math.max(pre, trackEnd()));
    kf.textContent = KF.keys.length ? `Knight keyframes (${KF.keys.length})` : 'Knight: built-in';
    beatBar.appendChild(kf);
    // Key diamonds
    for (let i = 0; i < KF.keys.length; i++) {
        const k = KF.keys[i];
        const d = document.createElement('div');
        d.className = 'key-diamond' + (i === stage.selected ? ' sel' : '');
        d.style.left = `${Math.max(0, Math.min(100, timeToViewFrac(pre + k.t) * 100))}%`;
        d.title = `t=${k.t.toFixed(2)} ${k.sprite || ''}`;
        d.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            stage.selected = i;
            renderKeyList();
            stage.t = pre + k.t;
        });
        // Drag to retime (position → time goes through the viewport)
        let dragging = false;
        d.addEventListener('pointermove', (e) => {
            if (!dragging && e.buttons === 1) dragging = true;
            if (dragging) {
                const rect = beatBar.getBoundingClientRect();
                const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                const t = fracToTime(frac) - pre;
                if (t >= 0) { k.t = Math.round(t * 20) / 20; renderKeyList(); }
            }
        });
        d.addEventListener('pointerup', () => { dragging = false; renderKeyList(); });
        beatBar.appendChild(d);
    }
    if (trackEnd() > 0) {
        const end = document.createElement('div');
        end.className = 'beat tail';
        end.style.left = L(pre + trackEnd());
        end.style.width = Wt(pre + trackEnd(), Math.max(pre + trackEnd(), total));
        end.textContent = 'fight';
        beatBar.appendChild(end);
    }
}

scrubber.addEventListener('input', () => {
    stage.playing = false;
    stage.t = (parseFloat(scrubber.value) / 1000) * totalDur();
});
beatBar.addEventListener('pointerdown', (e) => {
    if (e.target.classList.contains('key-diamond')) return;
    const rect = beatBar.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    stage.t = fracToTime(frac);
    stage.playing = false;
    updatePlayBtn();
});

// --- Zoom & pan controls ---
document.getElementById('zoom-in').addEventListener('click', () => zoomAt(0.5, 0.5));
document.getElementById('zoom-out').addEventListener('click', () => zoomAt(0.5, 2));
document.getElementById('zoom-fit').addEventListener('click', () => { stage.view = { start: 0, end: 1 }; rebuildBeatBar(); updateZoomLabel(); });
document.getElementById('zoom-left').addEventListener('click', () => panBy(-0.25));
document.getElementById('zoom-right').addEventListener('click', () => panBy(0.25));
// Wheel over the timeline: zoom centered on the cursor; shift+wheel pans.
document.getElementById('timeline').addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.shiftKey) {
        panBy(e.deltaY > 0 ? 0.1 : -0.1);
    } else {
        const rect = beatBar.getBoundingClientRect();
        const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        zoomAt(frac, e.deltaY > 0 ? 1.15 : 1 / 1.15);
    }
}, { passive: false });
// Middle-drag pans.
let panDrag = null;
beatBar.addEventListener('pointerdown', (e) => {
    if (e.button === 1) {
        e.preventDefault();
        panDrag = { x: e.clientX, start: stage.view.start, end: stage.view.end };
    }
});
window.addEventListener('pointermove', (e) => {
    if (!panDrag) return;
    const rect = beatBar.getBoundingClientRect();
    const delta = (e.clientX - panDrag.x) / rect.width * viewSpan();
    const span = panDrag.end - panDrag.start;
    let start = Math.min(1 - span, Math.max(0, panDrag.start - delta));
    stage.view = { start, end: start + span };
    rebuildBeatBar();
});
window.addEventListener('pointerup', () => { panDrag = null; });

// ---------- key list UI ----------
const keyList = document.getElementById('key-list');
function renderKeyList() {
    rebuildBeatBar();
    keyList.innerHTML = '';
    document.getElementById('empty-hint').style.display = KF.keys.length ? 'none' : 'block';
    KF.keys.sort((a, b) => a.t - b.t);
    KF.keys.forEach((k, i) => {
        const card = document.createElement('div');
        card.className = 'key-card' + (i === stage.selected ? ' sel' : '');
        card.addEventListener('click', () => { stage.selected = i; renderKeyList(); });

        const head = document.createElement('div');
        head.className = 'key-head';
        head.innerHTML = `<b>Key ${i + 1}</b>`;
        const tWrap = document.createElement('span');
        tWrap.className = 'key-t';
        tWrap.textContent = `t=${k.t.toFixed(2)}s`;
        head.appendChild(tWrap);
        const del = document.createElement('button');
        del.textContent = '✕';
        del.className = 'mini danger';
        del.addEventListener('click', (e) => {
            e.stopPropagation();
            KF.keys.splice(i, 1);
            stage.selected = -1;
            renderKeyList();
        });
        head.appendChild(del);
        card.appendChild(head);

        // time
        card.appendChild(fieldRow('t (s)', k.t, 'number', (v) => { k.t = Math.max(0, v); }));

        // sprite dropdown
        const spr = document.createElement('select');
        spr.innerHTML = `<option value="">— hold sprite —</option>` +
            SPRITE_OPTIONS.map(s => `<option value="${s}" ${k.sprite === s ? 'selected' : ''}>${s.replace('boss_', '').replace(/_/g, ' ')}</option>`).join('');
        spr.addEventListener('change', () => { k.sprite = spr.value || undefined; renderKeyList(); });
        card.appendChild(spr);

        // x / y / cam
        card.appendChild(fieldRow('X', k.x, 'px (blank=hold)', (v) => { k.x = v; }));
        card.appendChild(fieldRow('Y', k.y, 'px (blank=hold)', (v) => { k.y = v; }));
        card.appendChild(fieldRow('Camera', k.cam, 'px (blank=hold)', (v) => { k.cam = v; }));

        keyList.appendChild(card);
    });
}

function fieldRow(label, value, hint, onSet) {
    const row = document.createElement('div');
    row.className = 'row compact';
    const l = document.createElement('label');
    l.innerHTML = `${label} <span class="hint">${hint}</span>`;
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = 'any';
    if (value != null) inp.value = value;
    inp.addEventListener('input', () => {
        const v = parseFloat(inp.value);
        onSet(isNaN(v) ? null : v);
        rebuildBeatBar();
    });
    row.appendChild(l);
    row.appendChild(inp);
    return row;
}

function addKeyAtPlayhead() {
    const pre = builtInPre();
    const t = Math.max(0, stage.t - pre);
    const s = sampleBossKeys(t);
    KF.keys.push({ t: Math.round(t * 20) / 20, sprite: s.sprite || undefined, x: s.x ?? undefined, y: s.y ?? undefined, cam: s.cam ?? undefined });
    stage.selected = KF.keys.length - 1;
    renderKeyList();
    toast(`Keyframe added at t=${t.toFixed(2)}s`);
}

document.getElementById('btn-add').addEventListener('click', addKeyAtPlayhead);
document.getElementById('btn-add-here').addEventListener('click', addKeyAtPlayhead);

// Build the built-in reveal (pan → roar → equip → turn → walk-in) as an
// editable keyframe track, using the live tuning values.
document.getElementById('btn-builtin').addEventListener('click', () => {
    const P = TUNING.bossAnim.phases;
    const kb = TUNING.bossAnim.knight_back;
    const es = TUNING.bossAnim.equip_sword;
    const KE = TUNING.bossAnim.knightEntry;
    const keys = [];
    const push = (t, props) => keys.push({ t: Math.round(t * 20) / 20, ...props });

    // Pan to the knight (camera 0 → target); he holds frame 1 off-screen.
    push(0, { x: KE.startX, y: KE.floatY, cam: 0, sprite: `boss_knight_back_1` });
    push(P.pan, { cam: KE.cameraTargetX });

    // Roar: knight_back frames 1..frames at fps (frame 1 already set).
    const roarEnd = P.pan + (kb.frames - 1) / kb.fps;
    for (let i = 2; i <= kb.frames; i++) push(P.pan + (i - 1) / kb.fps, { sprite: `boss_knight_back_${i}` });

    // Sword equip: equip_sword frames 1..frames at fps.
    const equipStart = roarEnd;
    const equipEnd = equipStart + (es.frames - 1) / es.fps;
    for (let i = 1; i <= es.frames; i++) push(equipStart + (i - 1) / es.fps, { sprite: `boss_equip_sword_${i}` });

    // Turn to face the player, then pan back home while he walks in.
    push(equipEnd, { sprite: 'enemy_knight_front' });
    push(equipEnd + P.pan, { cam: 0, x: KE.walkToX });

    KF.keys = keys;
    stage.selected = -1;
    renderKeyList();
    toast(`Built ${keys.length} keyframes from the current animation — tweak, then Save.`);
});
document.getElementById('btn-save').addEventListener('click', () => {
    saveKeys();
    toast(`Saved ${KF.keys.length} keyframes — the game plays this track now.`);
});
document.getElementById('btn-clear').addEventListener('click', () => {
    if (!KF.keys.length) { toast('Track already empty.'); return; }
    KF.keys = [];
    stage.selected = -1;
    saveKeys();
    renderKeyList();
    toast('Track cleared — cutscene falls back to built-in reveal.');
});

// ---------- transport ----------
const btnPlay = document.getElementById('btn-play');
function updatePlayBtn() { btnPlay.textContent = stage.playing ? '⏸ Pause' : '▶ Play'; }
btnPlay.addEventListener('click', () => { stage.playing = !stage.playing; updatePlayBtn(); });
document.getElementById('btn-restart')?.addEventListener('click', () => { stage.t = 0; stage.playing = true; updatePlayBtn(); });
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); btnPlay.click(); }
    if (e.code === 'KeyR') { stage.t = 0; stage.playing = true; updatePlayBtn(); }
});

// ---------- sprite cache ----------
const imgCache = new Map();
function img(url) {
    if (imgCache.has(url)) return imgCache.get(url);
    const im = new Image();
    im.src = url;
    imgCache.set(url, im);
    return im;
}
const moabImg = new Image(); moabImg.src = 'sprites/enemies/moab.png';
const slashImgs = Array.from({ length: 14 }, (_, i) => {
    const im = new Image(); im.src = `sprites/effects/slash_${i + 1}.png`; return im;
});

// ---------- preview rendering ----------
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

function drawSprite(im, x, y, scale, mirror) {
    if (!im || !im.complete || !im.naturalWidth) return;
    ctx.save();
    ctx.translate(x, y);
    if (mirror) ctx.scale(-scale, scale); else ctx.scale(scale, scale);
    ctx.drawImage(im, -im.width / 2, -im.height / 2);
    ctx.restore();
}

// White silhouette of the MOAB (source-in recolor, like the real cutscene).
const silCanvas = document.createElement('canvas');
silCanvas.width = W; silCanvas.height = H;
function drawSilhouette(moabX, moabY) {
    const sctx = silCanvas.getContext('2d');
    sctx.clearRect(0, 0, W, H);
    if (moabImg.complete && moabImg.naturalWidth) {
        sctx.drawImage(moabImg, moabX - 55, moabY - 55, 110, 110);
        sctx.globalCompositeOperation = 'source-in';
        sctx.fillStyle = '#fff';
        sctx.fillRect(0, 0, W, H);
        sctx.globalCompositeOperation = 'source-over';
    }
}

function drawBalls(cx) {
    const cfg = window.BallsConfig || {};
    if (!drawBalls.inited) { initBallsForPreview(); drawBalls.inited = true; }
    const outline = cfg.outlineWidth ?? 4;
    const time = performance.now() / 1000;
    for (const b of previewBalls) {
        if (b.type === 'drifter') {
            b.ox += b.vx / 60;
            if (b.ox > 200) {
                b.r -= (cfg.drifterShrinkRate ?? 50) / 60;
                b.alpha -= (cfg.drifterFadeRate ?? 2) / 60;
                if (b.r <= 0 || b.alpha <= 0) {
                    b.ox = -300;
                    b.r = (cfg.drifterMinR ?? 10) + Math.random() * ((cfg.drifterMaxR ?? 40) - (cfg.drifterMinR ?? 10));
                    b.alpha = 1;
                }
            }
        }
        const sx = cx + b.ox + Math.sin(time * b.speed + b.phase) * 10;
        const sy = H / 2 + b.oy + Math.cos(time * b.speed + b.phase) * 10;
        if (b.r <= 0 || b.alpha <= 0) continue;
        ctx.globalAlpha = b.alpha;
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(sx, sy, b.r, 0, Math.PI * 2); ctx.fill();
        const ringR = b.r - outline / 2;
        if (ringR > 0) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = outline;
            ctx.beginPath(); ctx.arc(sx, sy, ringR, 0, Math.PI * 2); ctx.stroke();
        }
    }
    ctx.globalAlpha = 1;
}
let previewBalls = [];
function initBallsForPreview() {
    const cfg = window.BallsConfig || {};
    previewBalls = [];
    const spread = cfg.spreadX ?? 200;
    const mk = (n, minR, maxR, offX, type, spd) => {
        for (let i = 0; i < n; i++) previewBalls.push({
            ox: (Math.random() - 0.5) * spread - offX,
            oy: Math.random() * H - H / 2,
            r: minR + Math.random() * (maxR - minR),
            phase: Math.random() * Math.PI * 2,
            speed: spd + Math.random(),
            type, alpha: 1,
            vx: (cfg.drifterSpeed ?? 60) + Math.random() * 50,
        });
    };
    mk(cfg.giantCount ?? 30, cfg.giantMinR ?? 80, cfg.giantMaxR ?? 100, cfg.giantOffsetX ?? 10, 'giant', 0.5);
    mk(cfg.massCount ?? 2000, cfg.massMinR ?? 10, cfg.massMaxR ?? 40, cfg.massOffsetX ?? 50, 'mass', 1);
    mk(cfg.drifterCount ?? 100, cfg.drifterMinR ?? 10, cfg.drifterMaxR ?? 40, 0, 'drifter', 2);
}

function render() {
    const p = builtInPhases();
    const pre = builtInPre();
    const t = stage.t;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // faint ground line
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();

    const moabX = 100 + Math.min(1, t / Math.max(0.001, p.tension)) * 250;

    if (t < p.tension) {
        // Tension walk + shake
        const prog = t / Math.max(0.001, p.tension);
        const shake = prog * 25;
        ctx.save();
        ctx.translate(moabX + (Math.random() - 0.5) * shake, H / 2 + (Math.random() - 0.5) * shake);
        ctx.drawImage(moabImg, -55, -55, 110, 110);
        ctx.restore();
    } else if (t < p.tension + p.slash) {
        const prog = (t - p.tension) / Math.max(0.001, p.slash);
        drawSilhouette(moabX, H / 2);
        ctx.drawImage(silCanvas, 0, 0);
        const frame = Math.min(slashImgs.length - 1, Math.floor(prog * slashImgs.length));
        const im = slashImgs[frame];
        if (im && im.complete) drawSprite(im, moabX, H / 2, 1.5, true);
    } else if (t < p.tension + p.slash + p.ripWait) {
        drawSilhouette(moabX, H / 2);
        ctx.drawImage(silCanvas, 0, 0);
    } else if (t < pre) {
        // Rip: silhouette halves split
        const t01 = (t - p.tension - p.slash - p.ripWait) / Math.max(0.001, p.rip);
        drawSilhouette(moabX, H / 2);
        const drop = t01 * t01 * 1000;
        const spreadX = t01 * 200;
        const rot = t01 * 6;
        const half = (side) => {
            ctx.save();
            ctx.translate(moabX + side * spreadX, H / 2 + drop);
            ctx.rotate(side * rot);
            const sx0 = side < 0 ? moabX - 100 : moabX;
            ctx.drawImage(silCanvas, sx0, H / 2 - 200, 100, 400, side < 0 ? -100 : 0, -200, 100, 400);
            ctx.restore();
        };
        half(-1); half(1);
    } else {
        // Knight segment: keyframes (or built-in fallback) — camera pan applies
        const kt = t - pre;
        let spriteKey, kx, ky, cam;
        if (KF.keys.length > 0) {
            const s = sampleBossKeys(Math.min(kt, trackEnd()));
            spriteKey = s.sprite;
            kx = s.x ?? 200;
            ky = s.y ?? 300;
            cam = s.cam ?? 0;
            if (kt > trackEnd()) {
                // fight tail: balls + last sprite, camera reset like the game
                cam = 0;
                spriteKey = KF.keys[KF.keys.length - 1].sprite || 'enemy_knight_front';
            }
        } else {
            // built-in fallback preview: pan → roar → equip → walk in
            const pan = TUNING.bossAnim.phases.pan;
            const kb = TUNING.bossAnim.knight_back, es = TUNING.bossAnim.equip_sword;
            const kbDur = kb.frames / kb.fps, esDur = es.frames / es.fps;
            if (kt < pan) {
                cam = 500 * (kt / pan);
                spriteKey = 'boss_knight_back_1';
                kx = -400; ky = 300;
            } else if (kt < pan + kbDur + esDur) {
                cam = 500;
                kx = -400; ky = 300;
                const rt = kt - pan;
                spriteKey = rt < kbDur
                    ? `boss_knight_back_${Math.min(kb.frames, Math.floor(rt * kb.fps) + 1)}`
                    : `boss_equip_sword_${Math.min(es.frames, Math.floor((rt - kbDur) * es.fps) + 1)}`;
            } else {
                const rt = kt - pan - kbDur - esDur;
                cam = 500 * (1 - Math.min(1, rt / pan));
                kx = -400 + 600 * Math.min(1, rt / pan);
                ky = 300;
                spriteKey = 'enemy_knight_front';
            }
            if (kt > pan * 2 + kbDur + esDur) {
                cam = 0; kx = 200; spriteKey = 'enemy_knight_front';
            }
        }

        // Ball storm once we're near/into the fight tail
        if (t >= pre + Math.max(trackEnd() - 1.5, 0) || (KF.keys.length === 0 && t >= pre + pan * 1.8)) {
            drawBalls(0);
        }

        // Camera: black reveal bar on the left + world shifted right
        if (cam > 0.5) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, cam, H);
        }
        const im = img(spriteUrl(spriteKey));
        drawSprite(im, kx + cam, ky, 1.65, true);
    }

    // HUD
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 14px system-ui';
    const total = totalDur();
    ctx.fillText(`t=${t.toFixed(2)}s / ${total.toFixed(2)}s`, 14, 24);
    if (t >= builtInPre()) {
        const kt = t - builtInPre();
        const s = KF.keys.length ? sampleBossKeys(Math.min(kt, trackEnd())) : null;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '12px monospace';
        if (s) ctx.fillText(`key: ${s.sprite || '(hold)'} x=${s.x?.toFixed(0) ?? '—'} y=${s.y?.toFixed(0) ?? '—'} cam=${s.cam?.toFixed(0) ?? '—'}`, 14, 44);
        else ctx.fillText('built-in reveal (no keys)', 14, 44);
    }

    // scrubber + playhead
    scrubber.value = String(Math.round((t / total) * 1000));
    timeLabel.textContent = `${t.toFixed(2)}s`;
}

function loop() {
    if (stage.playing) {
        stage.t += 1 / 60;
        if (stage.t >= totalDur()) {
            if (stage.loop) stage.t = 0;
            else { stage.t = totalDur(); stage.playing = false; updatePlayBtn(); }
        }
    }
    render();
    requestAnimationFrame(loop);
}

renderKeyList();
updatePlayBtn();
updateZoomLabel();
requestAnimationFrame(loop);
