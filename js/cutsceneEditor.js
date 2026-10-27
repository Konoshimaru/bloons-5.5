// js/cutsceneEditor.js
//
// Blockbench-style cutscene animator for the boss intro.
//
//  - Left panel: scene settings, actor outliner, key inspector, sprite library
//  - Center: 1280x720 stage preview with zoom/pan and the SELECTED MAP as the
//    backdrop (background image + enemy paths, panned by the camera channel
//    exactly like the real game shifts the world via CutsceneManager.cameraOffsetX)
//  - Bottom: per-actor keyframe timeline (camera lane included)
//
// Everything authored here autosaves to localStorage['kilo_cutscene_v1'] — the
// same key js/cutscene.js reads at trigger() time when "Use as boss intro" is
// ticked. The doc format + sampling math live in js/cutsceneRuntime.js (shared
// with the in-game player, unit-tested).
//
// Coordinate spaces (IMPORTANT):
//   world   — what you author; actor keys live here; the map bg lives here.
//   plate   — the game screen (1280x720). plate = world + camera.x  (in-game
//             the renderer shifts the panned world by +cameraOffsetX).
//   view    — editor canvas px. canvas = plate * zoom + pan. Wheel zooms the
//             plate; the camera pan is drawn INSIDE the plate like the game.

import { CANVAS_WIDTH, CANVAS_HEIGHT, GLOBAL_SCALE } from './constants.js';
import { Maps } from './data.js';
import { TUNING } from './tuning.js';
import { SPRITESHEETS } from './spriteSheets.js';
import {
    normalizeDoc, sampleActor, sampleScene, sampleCamera, sceneDuration,
    findCameraActor, isKnightActor, sortKeys, buildVanillaIntroDoc,
    EASING_NAMES, DOC_VERSION, effectiveMirror, KNIGHT_SCALE,
} from './cutsceneRuntime.js';
import { findEntry as findIndexedSprite } from './spriteIndex.js';

const DOC_STORE = 'kilo_cutscene_v1';
const PREFS_STORE = 'kilo_editor_stage_v1';

const $ = (id) => document.getElementById(id);
const stageCanvas = $('stage');
const sctx = stageCanvas.getContext('2d');
const tlCanvas = $('tl');
const tctx = tlCanvas.getContext('2d');

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const r3 = (v) => Math.round(v * 1000) / 1000;

// ---------------- state ----------------

const state = {
    doc: null,
    sel: { actorId: null, keyIdx: null },   // primary key (last clicked)
    selKeys: new Set(),                     // multi-selection: Set of key objects
    t: 0,
    playing: false,
    view: { zoom: 1, x: 0, y: 0 },      // plate -> canvas
    tl: { start: 0, end: 1 },            // visible time window
    mapIdx: 0,
    showMap: true,
    showPaths: true,
    snap: true,
    libSelKey: null,                     // last library entry key clicked
};

function defaultPrefs() {
    return { mapIdx: 0, showMap: true, showPaths: true, snap: true };
}

function loadPrefs() {
    try {
        const p = JSON.parse(localStorage.getItem(PREFS_STORE) || '{}');
        state.mapIdx = Number.isInteger(p.mapIdx) && Maps[p.mapIdx] ? p.mapIdx : 0;
        state.showMap = p.showMap !== false;
        state.showPaths = p.showPaths !== false;
        state.snap = p.snap !== false;
    } catch (e) { Object.assign(state, defaultPrefs()); }
}

function savePrefs() {
    try {
        localStorage.setItem(PREFS_STORE, JSON.stringify({
            mapIdx: state.mapIdx, showMap: state.showMap,
            showPaths: state.showPaths, snap: state.snap,
        }));
    } catch (e) { /* private mode — prefs just won't persist */ }
}

// ---------------- doc model ----------------

let autosaveTimer = null;
function autosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
        try { localStorage.setItem(DOC_STORE, JSON.stringify(state.doc)); } catch (e) {}
    }, 400);
}

function setDoc(doc, { fit = true, save = true } = {}) {
    state.doc = doc;
    state.t = 0;
    state.playing = false;
    state.tl = { start: 0, end: Math.max(1, sceneDuration(doc)) };
    state.sel = { actorId: doc.actors[0]?.id ?? null, keyIdx: null };
    state.selKeys.clear();
    undoStack.length = 0;
    redoStack.length = 0;
    syncSceneUI();
    if (fit) fitViewToContent();
    if (save) autosave();
    renderAll();
}

function selectedActor() {
    return state.doc?.actors.find(a => a.id === state.sel.actorId) || null;
}

function selectedKey() {
    const a = selectedActor();
    if (!a || state.sel.keyIdx == null) return null;
    return a.keys[state.sel.keyIdx] || null;
}

// ---------------- multi-selection + undo ----------------

function setPrimary(actor, key) {
    state.sel = { actorId: actor.id, keyIdx: actor.keys.indexOf(key) };
}

function selectSingleKey(actor, key) {
    state.selKeys.clear();
    state.selKeys.add(key);
    setPrimary(actor, key);
}

function selectActorOnly(actor) {
    state.selKeys.clear();
    state.sel = { actorId: actor.id, keyIdx: null };
}

/** Selected keys re-validated against the live doc — stale references (undo,
 *  import, deleted keys) simply drop out. */
function selectedKeyPairs() {
    const out = [];
    for (const a of state.doc?.actors || []) {
        for (const k of a.keys) if (state.selKeys.has(k)) out.push({ actor: a, key: k });
    }
    return out;
}

// Snapshot-based undo: structural edits push the pre-edit doc JSON here.
const undoStack = [];
const redoStack = [];

function pushUndo() {
    const snap = JSON.stringify(state.doc);
    if (undoStack[undoStack.length - 1] === snap) return;   // no-op — keep history clean
    undoStack.push(snap);
    if (undoStack.length > 60) undoStack.shift();
    redoStack.length = 0;
}

function restoreDoc(snap) {
    state.doc = normalizeDoc(JSON.parse(snap));
    state.selKeys.clear();
    state.sel = { actorId: state.doc.actors[0]?.id ?? null, keyIdx: null };
    state.t = clamp(state.t, 0, sceneDuration(state.doc));
    state.playing = false;
    syncSceneUI();
    updatePlayBtn();
    autosave();
    renderAll();
}

function undo() {
    if (!undoStack.length) { toast('Nothing to undo', true); return; }
    redoStack.push(JSON.stringify(state.doc));
    restoreDoc(undoStack.pop());
    toast('Undo');
}

function redo() {
    if (!redoStack.length) { toast('Nothing to redo', true); return; }
    undoStack.push(JSON.stringify(state.doc));
    restoreDoc(redoStack.pop());
    toast('Redo');
}

function newDoc() {
    return {
        version: DOC_VERSION,
        name: 'New cutscene',
        duration: 8,
        useForBossIntro: false,
        actors: [{
            id: 'knight', name: 'knight', sprite: 'boss_knight_back_1',
            visible: true, isCamera: false, keys: [],
        }],
    };
}

// ---------------- toast ----------------

let toastTimer = null;
function toast(msg, isErr = false) {
    const el = $('toast');
    el.textContent = msg;
    el.className = isErr ? 'err show' : 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = isErr ? 'err' : ''; }, 2600);
}

// ---------------- image cache + sprite resolution ----------------
// Sprite refs in docs are either Assets-style keys (boss_knight_back_1) or raw
// sprite URLs (sprites/....png). Entries are resolved through the game's own
// js/spriteIndex.js first (so crop rects match playback exactly), with the
// pattern rules below as fallback: { key, url, sx, sy, sw, sh }.

const ALIASES = {
    // The static front view lives in the sheets folder (not sprites/enemies/),
    // so the key needs an explicit URL mapping. No design-size override: the
    // stage draws the knight with the game's own math (native frame size ×
    // KNIGHT_SCALE × doc scale — see actorDrawScale), so whatever this file's
    // true size is, the preview matches the game pixel-for-pixel.
    enemy_knight_front: { url: 'sprites/sheets/enemies/knight_front.png' },
};

const imgCache = new Map();   // url -> { img, ok }
const thumbCache = new Map(); // entryKey -> dataURL
let libRefreshTimer = null;

function getImage(url) {
    let rec = imgCache.get(url);
    if (!rec) {
        const img = new Image();
        rec = { img, ok: false };
        img.onload = () => {
            rec.ok = true;
            requestRender();
            // thumbs for sprites that finished loading after the library rendered
            clearTimeout(libRefreshTimer);
            libRefreshTimer = setTimeout(renderLibrary, 120);
        };
        img.onerror = () => { rec.ok = false; };
        img.src = url;
        imgCache.set(url, rec);
    }
    return rec;
}

function resolveEntry(ref) {
    if (!ref) return null;
    // The game resolves refs through the generated sprite index (crop rects
    // for atlas frames) — prefer it so preview crops match playback exactly.
    const indexed = findIndexedSprite(ref);
    if (indexed) return { key: ref, label: ref, group: 'indexed', ...indexed };
    const alias = ALIASES[ref];
    if (alias) return { key: ref, label: ref, group: 'boss', ...alias };
    if (ref.includes('/')) {
        return { key: null, url: ref, label: ref.split('/').pop(), group: 'url' };
    }
    // Assets-style key → FOLDER_MAP rules (mirror js/assets.js _resolvePath)
    const prefix = ref.split('_')[0] + '_';
    const folders = { enemy_: 'enemies', proj_: 'projectiles', tower_: 'towers', effect_: 'effects', map_: 'maps', boss_: 'boss' };
    const folder = folders[prefix];
    if (!folder) return null;
    return {
        key: ref,
        url: `sprites/${folder}/${ref.slice(prefix.length)}.png`,
        label: ref,
        group: prefix === 'boss_' ? 'boss' : prefix.replace('_', ''),
    };
}

// ---------------- sprite library ----------------
// Groups: Boss (always available, built from tuning frame counts), then
// Towers / Heroes / Atlas frames loaded from public/sprites/manifest.json
// (generated by tools/gen-manifest.mjs). Absent manifest → boss group only.

const LIB = { groups: [], byKey: new Map() };

function bossGroupEntries() {
    const BA = TUNING.bossAnim;
    const push = (arr, keyFmt, count) => {
        for (let i = 1; i <= count; i++) arr.push(keyFmt(i));
    };
    const out = [];
    push(out, i => ({ key: `boss_knight_back_${i}`, url: `sprites/boss/knight_back_${i}.png`, label: `knight_back_${i}` }), BA.knight_back.frames);
    push(out, i => ({ key: `boss_equip_sword_${i}`, url: `sprites/boss/equip_sword_${i}.png`, label: `equip_sword_${i}` }), BA.equip_sword.frames);
    push(out, i => ({ key: `boss_slash_${i}`, url: `sprites/boss/slash_${i}.png`, label: `slash_${i}` }), BA.sprites.slash.frames);
    push(out, i => ({ key: `boss_point_${i}`, url: `sprites/boss/point_${i}.png`, label: `point_${i}` }), BA.sprites.point.frames);
    push(out, i => ({ key: `boss_static_${i}`, url: `sprites/boss/static_${i}.png`, label: `static_${i}` }), BA.sprites.static.frames);
    push(out, i => ({ key: `boss_ball_${i}`, url: `sprites/boss/ball_${i}.png`, label: `ball_${i}` }), BA.ball.ballFrames);
    push(out, i => ({ key: `boss_ball_transition_${i}`, url: `sprites/boss/ball_transition_${i}.png`, label: `ball_transition_${i}` }), BA.ball.transitionFrames);
    push(out, i => ({ key: `boss_fly_${i}`, url: `sprites/boss/fly_${i}.png`, label: `fly_${i}` }), BA.fly.frames);
    push(out, i => ({ key: `boss_fly_transition_${i}`, url: `sprites/boss/fly_transition_${i}.png`, label: `fly_transition_${i}` }), BA.fly.transitionFrames);
    out.push({ key: 'enemy_knight_front', url: ALIASES.enemy_knight_front.url, label: 'knight_front' });
    return out.map(e => ({ ...e, group: 'boss' }));
}

function towerKeyFromUrl(url) {
    // sprites/towers/dart_base.png -> tower_dart_base  (inverse FOLDER_MAP)
    const stem = url.replace(/^sprites\/towers\//, '').replace(/\.png$/, '');
    return `tower_${stem}`;
}

async function buildLibrary() {
    const groups = new Map();
    const add = (e) => {
        if (!e.key && !e.url) return;
        e.label = e.label || e.key || e.url;
        if (!groups.has(e.group)) groups.set(e.group, []);
        groups.get(e.group).push(e);
        if (e.key) LIB.byKey.set(e.key, e);
    };
    for (const e of bossGroupEntries()) add(e);

    try {
        const res = await fetch('/sprites/manifest.json');
        if (res.ok) {
            const mf = await res.json();
            for (const [type, def] of Object.entries(mf.towers || {})) {
                const group = def.hero ? 'heroes' : 'towers';
                if (def.base) add({ key: towerKeyFromUrl(def.base), url: def.base, label: `${type} base`, group });
                for (const f of def.frames || []) {
                    add({ key: towerKeyFromUrl(f.url), url: f.url, label: `${type} ${f.frame}`, group });
                }
                for (const [upk, up] of Object.entries(def.upgrades || {})) {
                    if (up.base) add({ key: towerKeyFromUrl(up.base), url: up.base, label: `${upk} base`, group });
                    for (const f of up.frames || []) {
                        add({ key: towerKeyFromUrl(f.url), url: f.url, label: `${upk} ${f.frame}`, group });
                    }
                }
            }
            // Atlas frames: manifest lists sheet json/png pairs; SPRITESHEETS
            // knows the Assets-key prefix for each. TexturePacker JSONs expose
            // frames either as an object or an array.
            for (const sheet of mf.sheets || []) {
                const ss = SPRITESHEETS.find(s => s.sheet === sheet.json);
                if (!ss) continue;
                const prefix = ss.prefix;
                try {
                    const sres = await fetch(sheet.json);
                    if (!sres.ok) continue;
                    const data = await sres.json();
                    const frames = Array.isArray(data.frames)
                        ? data.frames.map(f => ({ name: f.filename, frame: f.frame }))
                        : Object.entries(data.frames || {}).map(([name, f]) => ({ name, frame: f.frame }));
                    for (const f of frames) {
                        if (!f.name || !f.frame) continue;
                        const stem = f.name.replace(/\.png$/, '');
                        add({
                            key: prefix + stem,
                            url: sheet.png,
                            sx: f.frame.x, sy: f.frame.y, sw: f.frame.w, sh: f.frame.h,
                            label: stem, group: `atlas · ${sheet.id}`,
                        });
                    }
                } catch (e) { /* one bad sheet shouldn't kill the library */ }
            }
        }
    } catch (e) {
        // No manifest (e.g. sprites not present) — boss group still works.
        toast('manifest.json not found — library limited to boss sprites', true);
    }

    LIB.groups = [...groups.entries()].map(([name, entries]) => ({ name, entries }));
    renderLibrary();
}

function entryThumbURL(entry) {
    const ck = `${entry.url}|${entry.sx || 0}|${entry.sy || 0}|${entry.sw || 0}|${entry.sh || 0}`;
    const cached = thumbCache.get(ck);
    if (cached) return cached;
    const rec = getImage(entry.url);
    if (!rec.ok) return null;
    const img = rec.img;
    const c = document.createElement('canvas');
    c.width = 56; c.height = 56;
    const cx = c.getContext('2d');
    let sw = entry.sw ?? img.naturalWidth;
    let sh = entry.sh ?? img.naturalHeight;
    if (!sw || !sh) return null;
    // design-size override (fw/fh) doesn't change the thumb — show the art
    const k = Math.min(56 / sw, 56 / sh);
    const dw = sw * k, dh = sh * k;
    cx.drawImage(img, entry.sx ?? 0, entry.sy ?? 0, sw, sh, (56 - dw) / 2, (56 - dh) / 2, dw, dh);
    const url = c.toDataURL();
    thumbCache.set(ck, url);
    return url;
}

// ---------------- stage rendering ----------------

let renderQueued = false;
function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; renderStage(); renderTimeline(); });
}

function renderAll() { renderStage(); renderTimeline(); renderOutliner(); renderInspector(); }

/** plate -> canvas px */
function plateToCanvas(px, py) {
    return { x: px * state.view.zoom + state.view.x, y: py * state.view.zoom + state.view.y };
}

/** canvas px -> plate coords */
function canvasToPlate(px, py) {
    return { x: (px - state.view.x) / state.view.zoom, y: (py - state.view.y) / state.view.zoom };
}

/** canvas px -> world coords (camera-aware) */
function canvasToWorld(px, py) {
    const p = canvasToPlate(px, py);
    const cam = sampleCamera(state.doc, state.t);
    return { x: p.x - (cam.x || 0), y: p.y - (cam.y || 0) };
}

/** world -> plate coords (camera-aware) */
function worldToPlate(wx, wy) {
    const cam = sampleCamera(state.doc, state.t);
    return { x: wx + (cam.x || 0), y: wy + (cam.y || 0) };
}

function mapBgRect(m, rec) {
    const scale = m.imageScale || 1;
    const w = CANVAS_WIDTH * scale;
    let h = CANVAS_HEIGHT * scale;
    if (m.imageMaintainRatio && rec?.ok && rec.img.naturalWidth > 0) {
        h = w * (rec.img.naturalHeight / rec.img.naturalWidth);
    }
    return { x: m.imageOffsetX || 0, y: m.imageOffsetY || 0, w, h };
}

function drawPathsLikeGame(ctx, m, camX) {
    for (const path of m.paths || []) {
        if (!path || !Array.isArray(path.waypoints)) continue;
        if (path.visible === false) continue;   // hidden paths stay hidden (game parity)
        const wps = path.waypoints;
        if (wps.length < 2) continue;
        const pathWidth = path.width || 45;
        const trace = () => {
            ctx.beginPath();
            ctx.moveTo(wps[0].x + camX, wps[0].y);
            for (let i = 1; i < wps.length; i++) {
                const wp = wps[i];
                if (wp.curve) ctx.quadraticCurveTo(wp.curve.cx + camX, wp.curve.cy, wp.x + camX, wp.y);
                else ctx.lineTo(wp.x + camX, wp.y);
            }
        };
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = pathWidth + 8;
        trace(); ctx.stroke();
        ctx.strokeStyle = '#a8825a';
        ctx.lineWidth = pathWidth;
        trace(); ctx.stroke();
    }
}

function drawMapBackground(ctx, camX) {
    const m = Maps[state.mapIdx];
    if (!m) return;
    if (!state.showMap) return;
    let rec = null;
    if (m.image) rec = getImage(`sprites/maps/${m.image}.png`);
    const r = mapBgRect(m, rec);
    if (rec?.ok) {
        ctx.drawImage(rec.img, r.x + camX, r.y, r.w, r.h);
    } else {
        // Same fallback the game uses when the bg is missing, plus a faint
        // grid so the void is still readable for positioning.
        ctx.fillStyle = '#8acc4d';
        ctx.fillRect(r.x + camX, r.y, r.w, r.h);
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1 / state.view.zoom;
        for (let gx = 0; gx <= CANVAS_WIDTH; gx += 80) {
            ctx.beginPath(); ctx.moveTo(gx + camX, r.y); ctx.lineTo(gx + camX, r.y + r.h); ctx.stroke();
        }
        for (let gy = 0; gy <= CANVAS_HEIGHT; gy += 80) {
            ctx.beginPath(); ctx.moveTo(r.x + camX, gy + r.y); ctx.lineTo(r.x + r.w + camX, gy); ctx.stroke();
        }
    }
}

// ---------------- game-parity draw metrics ----------------
// The knight actor is NOT drawn by the cutscene layer in-game — the entity
// renderer (renderCutscene._drawKnightEffects) draws his current frame at
// native size × KNIGHT_SCALE, mirrored unless the doc authors mirror:false.
// Everything else draws on the layer at native size × doc scale, mirrored as
// authored. Both rules live here so the stage preview is pixel-identical to
// the game (scale 1.0 on a knight key = the exact in-game draw size).

/** Uniform multiplier applied to a frame's native pixel size for this state. */
function actorDrawScale(st, isKnight) {
    const k = Math.max(0.01, st.scale || 1);
    return isKnight ? k * KNIGHT_SCALE : k;
}

/** Native (cropped) pixel size of an entry, when known (images load async). */
function entryNativeSize(entry) {
    if (!entry) return null;
    if (entry.sx != null) return { w: entry.sw || 0, h: entry.sh || 0 };
    const rec = imgCache.get(entry.url);
    if (rec?.ok && rec.img.naturalWidth > 0) return { w: rec.img.naturalWidth, h: rec.img.naturalHeight };
    return null;
}

/** On-stage bounding box (plate px) for a sampled state — draw, hit-test and
 *  selection outline all share this so nothing drifts apart. */
function actorDrawSize(entry, st, actor) {
    const isKnight = isKnightActor(actor || null);
    const native = entryNativeSize(entry);
    const k = actorDrawScale(st, isKnight);
    const w = (native ? native.w : (entry?.sw || 40)) * k;
    const h = (native ? native.h : (entry?.sh || 40)) * k;
    return { w, h, k, isKnight, flip: effectiveMirror(st, isKnight) };
}

function drawActorSprite(ctx, entry, st, px, py, actor) {
    const rec = getImage(entry.url);
    const size = actorDrawSize(entry, st, actor);
    if (!rec.ok) {
        // Missing art: placeholder box so the actor is still findable.
        ctx.save();
        ctx.globalAlpha = Math.max(0.15, st.alpha * 0.5);
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2 / state.view.zoom;
        const s = 40 * size.k;
        ctx.strokeRect(px - s / 2, py - s / 2, s, s);
        ctx.beginPath(); ctx.moveTo(px - s / 2, py - s / 2); ctx.lineTo(px + s / 2, py + s / 2); ctx.stroke();
        ctx.restore();
        return;
    }
    const img = rec.img;
    const sw = entry.sx != null ? entry.sw : img.naturalWidth;
    const sh = entry.sx != null ? entry.sh : img.naturalHeight;
    const k = size.k;
    ctx.save();
    ctx.globalAlpha = clamp(st.alpha, 0, 1);
    ctx.translate(px, py);
    if (st.rotation) ctx.rotate(st.rotation * Math.PI / 180);
    ctx.scale(size.flip ? -k : k, k);
    ctx.drawImage(img, entry.sx ?? 0, entry.sy ?? 0, sw, sh, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();
}

function drawWorld(ctx) {
    const cam = sampleCamera(state.doc, state.t);
    const camX = cam.x || 0;
    const m = Maps[state.mapIdx];

    drawMapBackground(ctx, camX);
    if (m && state.showPaths) drawPathsLikeGame(ctx, m, camX);

    if (!state.doc) return;

    // Onion skin: ghost of the selected actor at the neighbouring keys.
    const selA = selectedActor();
    if (selA && state.sel.keyIdx != null) {
        const tprev = selA.keys[state.sel.keyIdx - 1]?.t;
        const tnext = selA.keys[state.sel.keyIdx + 1]?.t;
        for (const gt of [tprev, tnext]) {
            if (gt == null) continue;
            const st = sampleActor(selA, gt);
            const entry = resolveEntry(st.sprite);
            if (!entry) continue;
            ctx.save();
            ctx.globalAlpha = 0.22;
            drawActorSprite(ctx, entry, st, st.x + camX, st.y, selA);
            ctx.restore();
        }
    }

    for (const st of sampleScene(state.doc, state.t)) {
        const entry = resolveEntry(st.sprite);
        if (!entry) continue;
        drawActorSprite(ctx, entry, st, st.x + camX, st.y, st.actor);

        if (st.actor.id === state.sel.actorId) {
            // selection outline + name tag (screen-constant line width)
            const { w, h } = actorDrawSize(entry, st, st.actor);
            ctx.save();
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 1.5 / state.view.zoom;
            ctx.setLineDash([5 / state.view.zoom, 4 / state.view.zoom]);
            ctx.strokeRect(st.x + camX - w / 2, st.y - h / 2, w, h);
            ctx.setLineDash([]);
            ctx.font = `${11 / state.view.zoom}px system-ui`;
            ctx.fillStyle = '#8fd0ff';
            ctx.textAlign = 'center';
            const tag = isKnightActor(st.actor) ? `${st.actor.name} — drives the real boss` : st.actor.name;
            ctx.fillText(tag, st.x + camX, st.y - h / 2 - 6 / state.view.zoom);
            ctx.restore();
        }
    }
}

function renderStage() {
    const ctx = sctx;
    const cw = stageCanvas.width, ch = stageCanvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#07090d';
    ctx.fillRect(0, 0, cw, ch);

    ctx.setTransform(state.view.zoom, 0, 0, state.view.zoom, state.view.x, state.view.y);

    // stage plate = the game screen
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // world content is clipped to the plate, like the real viewport
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.clip();
    drawWorld(ctx);
    ctx.restore();

    // plate border (screen-space thickness)
    ctx.strokeStyle = '#2a3242';
    ctx.lineWidth = 1.5 / state.view.zoom;
    ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // HUD (screen space)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const cam = sampleCamera(state.doc, state.t);
    ctx.font = '11px system-ui';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8b93a3';
    const m = Maps[state.mapIdx];
    const mapName = m ? m.name : '—';
    const missingMap = state.showMap && m?.image && !imgCache.get(`sprites/maps/${m.image}.png`)?.ok;
    ctx.fillText(`zoom ${(state.view.zoom * 100).toFixed(0)}%   t ${state.t.toFixed(2)}s   cam.x ${(cam.x || 0).toFixed(0)}   map: ${mapName}${missingMap ? ' (bg 404 — green fallback)' : ''}`, 10, 16);
    ctx.textAlign = 'right';
    ctx.fillText(state.playing ? '▶ playing' : 'paused', cw - 10, 16);
}

// ---------------- stage view controls ----------------

function updateZoomLabel() {
    $('zoom-label').textContent = `${(state.view.zoom * 100).toFixed(0)}%`;
}

function zoomStageAt(canvasPx, canvasPy, factor) {
    const z0 = state.view.zoom;
    const z1 = clamp(z0 * factor, 0.1, 8);
    if (z1 === z0) return;
    const k = z1 / z0;
    state.view.x = canvasPx - (canvasPx - state.view.x) * k;
    state.view.y = canvasPy - (canvasPy - state.view.y) * k;
    state.view.zoom = z1;
    updateZoomLabel();
    requestRender();
}

function fitViewToContent() {
    // Frame the stage plate ∪ every actor key position (camera-shifted into
    // plate space), padded — imported scenes always become visible instantly.
    const pad = 60;
    let minX = 0, minY = 0, maxX = CANVAS_WIDTH, maxY = CANVAS_HEIGHT;
    if (state.doc) {
        for (const a of state.doc.actors) {
            if (a.isCamera) continue;
            for (const k of a.keys) {
                // sprite-only keys carry no position — skip them (NaN would
                // poison the whole bounding box)
                if (typeof k.x !== 'number' && typeof k.y !== 'number') continue;
                const cam = sampleCamera(state.doc, k.t);
                const px = (typeof k.x === 'number' ? k.x : 0) + (cam.x || 0);
                const py = (typeof k.y === 'number' ? k.y : 0) + (cam.y || 0);
                minX = Math.min(minX, px); minY = Math.min(minY, py);
                maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
            }
        }
    }
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const cw = stageCanvas.width, ch = stageCanvas.height;
    const zoom = clamp(Math.min(cw / (maxX - minX), ch / (maxY - minY)), 0.1, 8);
    state.view.zoom = zoom;
    state.view.x = (cw - (maxX + minX) * zoom) / 2;
    state.view.y = (ch - (maxY + minY) * zoom) / 2;
    updateZoomLabel();
    requestRender();
}

function resetView() {
    state.view = { zoom: 1, x: 0, y: 0 };
    updateZoomLabel();
    requestRender();
}

/** canvas event px -> internal canvas px (CSS-scaled canvas) */
function evCanvasPx(e) {
    const r = stageCanvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (stageCanvas.width / r.width), y: (e.clientY - r.top) * (stageCanvas.height / r.height) };
}

/** setPointerCapture that tolerates synthetic/inactive pointers (tests, odd devices) */
function capturePtr(el, e) {
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* NotFoundError on fake pointerIds */ }
}

// ---------------- stage pointer interactions ----------------

const stageDrag = {
    mode: null,        // 'pan' | 'actor'
    panStart: null,
    actorId: null, keyIdx: null,
    anchor: null,      // {key, idx, created}
    multi: null,       // [{key, ox, oy}] when dragging a multi-selection together
    world0: null,
    startPx: null, moved: false,
};

function hitTestActor(px, py) {
    // topmost first
    const actors = state.doc?.actors || [];
    const cam = sampleCamera(state.doc, state.t);
    const camX = cam.x || 0;
    for (let i = actors.length - 1; i >= 0; i--) {
        const a = actors[i];
        if (a.isCamera || a.visible === false) continue;
        const st = sampleActor(a, state.t);
        const entry = resolveEntry(st.sprite);
        if (!entry) continue;
        const { w, h } = actorDrawSize(entry, st, a);
        const pxp = st.x + camX, pyp = st.y;
        if (Math.abs(px - pxp) <= w / 2 && Math.abs(py - pyp) <= h / 2) return a;
    }
    return null;
}

/** Materialise (or reuse) the key at the playhead for auto-key dragging. */
function anchorKeyAtPlayhead(actor) {
    const t = r3(state.t);
    const existing = actor.keys.findIndex(k => Math.abs(k.t - t) < 0.005);
    if (existing >= 0) return { key: actor.keys[existing], idx: existing, created: false };
    // capture the CURRENT sampled state so nothing jumps
    const st = sampleActor(actor, state.t);
    const key = { t, x: st.x, y: st.y };
    actor.keys.push(key);
    sortKeys(actor.keys);
    return { key, idx: actor.keys.indexOf(key), created: true };
}

stageCanvas.addEventListener('contextmenu', e => e.preventDefault());

stageCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = evCanvasPx(e);
    zoomStageAt(p.x, p.y, e.deltaY < 0 ? 1.15 : 1 / 1.15);
}, { passive: false });

stageCanvas.addEventListener('pointerdown', (e) => {
    const p = evCanvasPx(e);
    const wantsPan = e.button === 1 || e.button === 2 || (e.button === 0 && spaceHeld);
    if (wantsPan) {
        e.preventDefault();
        stageDrag.mode = 'pan';
        stageDrag.panStart = { px: p.x, py: p.y, vx: state.view.x, vy: state.view.y };
        stageCanvas.classList.add('panning');
        capturePtr(stageCanvas, e);
        return;
    }
    if (e.button !== 0 || !state.doc) return;
    const plate = canvasToPlate(p.x, p.y);
    const hit = hitTestActor(plate.x, plate.y);
    if (!hit) {
        state.sel = { actorId: null, keyIdx: null };
        state.selKeys.clear();
        renderAll();
        return;
    }
    // Keep a key selection that belongs to this actor (so box-selected keys can
    // be dragged together on stage); otherwise start fresh.
    const firstSel = hit.keys.find(k => state.selKeys.has(k));
    if (firstSel) state.sel = { actorId: hit.id, keyIdx: hit.keys.indexOf(firstSel) };
    else selectActorOnly(hit);
    stageDrag.mode = 'actor';
    stageDrag.actorId = hit.id;
    stageDrag.startPx = p;
    stageDrag.moved = false;
    stageDrag.anchor = null;
    capturePtr(stageCanvas, e);
    renderAll();
});

stageCanvas.addEventListener('pointermove', (e) => {
    if (!stageDrag.mode) return;
    const p = evCanvasPx(e);
    if (stageDrag.mode === 'pan') {
        state.view.x = stageDrag.panStart.vx + (p.x - stageDrag.panStart.px);
        state.view.y = stageDrag.panStart.vy + (p.y - stageDrag.panStart.py);
        requestRender();
        return;
    }
    // actor drag — dead zone in SCREEN px so the feel is zoom-independent
    if (!stageDrag.moved) {
        const dx = p.x - stageDrag.startPx.x, dy = p.y - stageDrag.startPx.y;
        if (Math.hypot(dx, dy) < 4) return;
        stageDrag.moved = true;
        const actor = selectedActor();
        if (!actor) { stageDrag.mode = null; return; }
        pushUndo();
        const anchored = anchorKeyAtPlayhead(actor);
        stageDrag.anchor = anchored;
        if (state.selKeys.has(anchored.key) && state.selKeys.size > 1) {
            // move the whole selection together (keys that carry positions)
            stageDrag.multi = selectedKeyPairs()
                .map(({ key }) => ({ key, ox: key.x, oy: key.y }))
                .filter(m => typeof m.ox === 'number');
            stageDrag.world0 = canvasToWorld(p.x, p.y);
        } else {
            stageDrag.multi = null;
            selectSingleKey(actor, anchored.key);
            renderInspector();
        }
    }
    if (stageDrag.multi) {
        const w = canvasToWorld(p.x, p.y);
        const dx = w.x - stageDrag.world0.x, dy = w.y - stageDrag.world0.y;
        for (const m of stageDrag.multi) {
            m.key.x = r3(m.ox + dx);
            if (typeof m.oy === 'number') m.key.y = r3(m.oy + dy);
        }
        requestRender();
        return;
    }
    const a = selectedActor();
    if (!a || !stageDrag.anchor) return;
    const world = canvasToWorld(p.x, p.y);
    stageDrag.anchor.key.x = r3(world.x);
    stageDrag.anchor.key.y = r3(world.y);
    requestRender();
});

function endStageDrag(e) {
    if (!stageDrag.mode) return;
    if (stageDrag.mode === 'actor' && stageDrag.moved) {
        autosave();
        renderTimeline(); renderInspector();
    }
    stageDrag.mode = null;
    stageDrag.anchor = null;
    stageDrag.multi = null;
    stageCanvas.classList.remove('panning');
    try { stageCanvas.releasePointerCapture(e.pointerId); } catch (err) { /* synthetic pointerIds throw */ }
}
stageCanvas.addEventListener('pointerup', endStageDrag);
stageCanvas.addEventListener('pointercancel', endStageDrag);

// ---------------- toolbar + keyboard ----------------

$('zoom-in').addEventListener('click', () => {
    zoomStageAt(stageCanvas.width / 2, stageCanvas.height / 2, 1.25);
});
$('zoom-out').addEventListener('click', () => {
    zoomStageAt(stageCanvas.width / 2, stageCanvas.height / 2, 1 / 1.25);
});
$('btn-fit').addEventListener('click', fitViewToContent);
$('btn-11').addEventListener('click', resetView);

let spaceHeld = false;
window.addEventListener('keydown', (e) => {
    const tag = (e.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
    }
    if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
    if (mod && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        const a = selectedActor();
        if (e.shiftKey || !a) selectAllKeys(); else selectAllInLane(a);
        return;
    }
    if (e.code === 'Space') {
        e.preventDefault();
        if (!spaceHeld) { spaceHeld = true; togglePlay(); }
        return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); nudgeSelected(e.shiftKey ? -10 : -1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); nudgeSelected(e.shiftKey ? 10 : 1); return; }
    if (e.key === 'Escape') {
        closeCtxMenu();
        if (state.selKeys.size) {
            state.selKeys.clear();
            state.sel.keyIdx = null;
            renderAll();
        }
        return;
    }
    if (e.key === 'k' || e.key === 'K') {
        const a = selectedActor();
        if (a) addKeyAtTime(a, state.t);
        else toast('Select an actor first', true);
        return;
    }
    if (e.key === 'd' || e.key === 'D') { duplicateSelected(); return; }
    if (e.key === 's' || e.key === 'S') {
        state.snap = !state.snap;
        $('chk-snap').checked = state.snap;
        savePrefs();
        toast(`Snap ${state.snap ? 'on (30fps)' : 'off'}`);
        return;
    }
    if (e.key === 'f' || e.key === 'F') { fitViewToContent(); return; }
    if (e.key === 'r' || e.key === 'R') { state.t = 0; updatePlayBtn(); requestRender(); return; }
    if (e.key === '+' || e.key === '=') { zoomStageAt(stageCanvas.width / 2, stageCanvas.height / 2, 1.25); return; }
    if (e.key === '-' || e.key === '_') { zoomStageAt(stageCanvas.width / 2, stageCanvas.height / 2, 1 / 1.25); return; }
    if (e.key === '0') { resetView(); return; }
    if (e.key === 'Home') { state.t = 0; syncScrubber(); requestRender(); return; }
    if (e.key === 'End') { state.t = sceneDuration(state.doc); syncScrubber(); requestRender(); return; }
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') spaceHeld = false;
});

// ---------------- playback ----------------

let lastFrame = performance.now();
function tick(now) {
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    if (state.playing && state.doc) {
        state.t += dt;
        const dur = sceneDuration(state.doc);
        if (state.t >= dur) { state.t = dur; state.playing = false; updatePlayBtn(); }
        // keep the playhead inside the visible window while playing
        if (state.t > state.tl.end - 0.001 || state.t < state.tl.start) {
            const span = state.tl.end - state.tl.start;
            state.tl.start = Math.max(0, state.t - span * 0.08);
            state.tl.end = state.tl.start + span;
        }
        syncScrubber();
        renderStage(); renderTimeline();
    }
    requestAnimationFrame(tick);
}

function togglePlay() {
    if (!state.doc) return;
    if (!state.playing && state.t >= sceneDuration(state.doc) - 0.001) state.t = 0;
    state.playing = !state.playing;
    updatePlayBtn();
}
function updatePlayBtn() {
    $('btn-play').textContent = state.playing ? '⏸' : '▶';
}
$('btn-play').addEventListener('click', togglePlay);
$('btn-restart').addEventListener('click', () => { state.t = 0; updatePlayBtn(); requestRender(); });

const scrubber = $('scrubber');
scrubber.addEventListener('input', () => {
    if (!state.doc) return;
    state.t = (scrubber.value / 1000) * sceneDuration(state.doc);
    requestRender();
});
function syncScrubber() {
    const dur = state.doc ? sceneDuration(state.doc) : 1;
    scrubber.value = Math.round((state.t / dur) * 1000);
}

// ---------------- timeline ----------------

const TL_PAD = 10;
const TL_RULER_H = 18;   // ruler strip height (drag = scrub playhead)
const TL_NAME_W = 96;    // lane label zone (click = select that actor)

function tlLanes() {
    // camera lane first, then actors in doc order
    const lanes = [];
    for (const a of state.doc?.actors || []) {
        if (a.isCamera) lanes.unshift(a);
        else lanes.push(a);
    }
    return lanes;
}

function tlTimeToX(t) {
    const w = tlCanvas.clientWidth - TL_PAD * 2;
    return TL_PAD + ((t - state.tl.start) / (state.tl.end - state.tl.start)) * w;
}

function tlXToTime(x) {
    const w = tlCanvas.clientWidth - TL_PAD * 2;
    return state.tl.start + ((x - TL_PAD) / w) * (state.tl.end - state.tl.start);
}

function tlNiceStep() {
    const span = state.tl.end - state.tl.start;
    const w = tlCanvas.clientWidth - TL_PAD * 2;
    const target = 90 / w; // seconds per ~90px
    for (const s of [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 30, 60]) {
        if (s >= target) return s;
    }
    return 60;
}

function renderTimeline() {
    const dpr = window.devicePixelRatio || 1;
    const w = tlCanvas.clientWidth, h = tlCanvas.clientHeight;
    if (tlCanvas.width !== Math.round(w * dpr) || tlCanvas.height !== Math.round(h * dpr)) {
        tlCanvas.width = Math.round(w * dpr);
        tlCanvas.height = Math.round(h * dpr);
    }
    const ctx = tctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const { lanes, laneH } = tlLaneMetrics();
    const dur = state.doc ? sceneDuration(state.doc) : 1;

    // ruler
    ctx.font = '9.5px system-ui';
    ctx.fillStyle = '#566072';
    ctx.strokeStyle = '#232b3a';
    ctx.textAlign = 'center';
    const step = tlNiceStep();
    for (let t = Math.ceil(state.tl.start / step) * step; t <= state.tl.end; t += step) {
        const x = tlTimeToX(t);
        ctx.beginPath(); ctx.moveTo(x, TL_RULER_H - 5); ctx.lineTo(x, h); ctx.stroke();
        ctx.fillText(`${t.toFixed(step < 1 ? 2 : 0)}s`, x, 11);
    }

    // lanes
    lanes.forEach((a, li) => {
        const y = TL_RULER_H + li * laneH;
        ctx.fillStyle = a.isCamera ? '#101a28' : (li % 2 ? '#10151f' : '#0e131c');
        ctx.fillRect(0, y, w, laneH - 1);
        ctx.fillStyle = a.isCamera ? '#5aa7e8' : (a.id === state.sel.actorId ? '#cfe6ff' : '#7c8698');
        ctx.font = '10px system-ui';
        ctx.textAlign = 'left';
        const nm = a.isCamera ? '🎥 camera' : a.name;
        ctx.fillText(nm.length > 18 ? nm.slice(0, 17) + '…' : nm, 4, y + laneH / 2 + 3);

        for (let ki = 0; ki < a.keys.length; ki++) {
            const k = a.keys[ki];
            if (k.t < state.tl.start - 0.05 || k.t > state.tl.end + 0.05) continue;
            const x = tlTimeToX(k.t);
            const cy = y + laneH / 2;
            const isP = a.id === state.sel.actorId && ki === state.sel.keyIdx;  // primary
            const isM = state.selKeys.has(k);                                  // in multi-selection
            ctx.save();
            ctx.translate(x, cy);
            ctx.rotate(Math.PI / 4);
            const s = isP ? 5.5 : (isM ? 5 : 4.5);
            ctx.fillStyle = isP ? '#ffd34d' : (isM ? '#f2b53a' : (a.isCamera ? '#3498db' : '#e74c3c'));
            ctx.fillRect(-s, -s, s * 2, s * 2);
            if (isP) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.strokeRect(-s, -s, s * 2, s * 2);
            }
            ctx.restore();
        }
    });

    // duration edge
    const dx = tlTimeToX(dur);
    if (dx < w) {
        ctx.strokeStyle = '#3a455a';
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(dx, 0); ctx.lineTo(dx, h); ctx.stroke();
        ctx.setLineDash([]);
    }

    // playhead
    const px = tlTimeToX(state.t);
    ctx.strokeStyle = '#e8e26a';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();

    // marquee box (drawn while box-selecting)
    if (tlDrag.mode === 'marquee') {
        const mx0 = Math.min(tlDrag.px0, tlDrag.px1), mx1 = Math.max(tlDrag.px0, tlDrag.px1);
        const my0 = Math.min(tlDrag.py0, tlDrag.py1), my1 = Math.max(tlDrag.py0, tlDrag.py1);
        ctx.fillStyle = 'rgba(52, 152, 219, 0.15)';
        ctx.fillRect(mx0, my0, mx1 - mx0, my1 - my0);
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 1;
        ctx.strokeRect(mx0, my0, mx1 - mx0, my1 - my0);
    }

    // selection HUD
    if (state.selKeys.size > 0) {
        ctx.font = '10px system-ui';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffd34d';
        ctx.fillText(`${state.selKeys.size} selected`, w - 6, 11);
    }
    $('time-label').textContent = `${state.t.toFixed(2)}s`;
}

function tlLaneMetrics() {
    const lanes = tlLanes();
    const laneH = Math.min(26, Math.floor((tlCanvas.clientHeight - TL_RULER_H) / Math.max(1, lanes.length)));
    return { lanes, laneH };
}

function tlHitKey(px, py) {
    const { lanes, laneH } = tlLaneMetrics();
    let best = null;
    lanes.forEach((a, li) => {
        const y = TL_RULER_H + li * laneH;
        if (py < y || py > y + laneH) return;
        a.keys.forEach((k, ki) => {
            const x = tlTimeToX(k.t);
            if (Math.abs(px - x) <= 7) {
                const d = Math.abs(px - x);
                if (!best || d < best.d) best = { actor: a, ki, d };
            }
        });
    });
    return best;
}

function selectAllInLane(actor) {
    state.selKeys.clear();
    for (const k of actor.keys) state.selKeys.add(k);
    if (actor.keys.length) setPrimary(actor, actor.keys[0]);
    else state.sel.keyIdx = null;
    renderAll();
}

function selectAllKeys() {
    state.selKeys.clear();
    let first = null;
    for (const a of state.doc?.actors || []) {
        for (const k of a.keys) {
            state.selKeys.add(k);
            if (!first) first = { a, k };
        }
    }
    if (first) setPrimary(first.a, first.k);
    renderAll();
}

/** Shared delta limits so a moved block can never cross an unselected
 *  neighbour (or slide past t=0). Computed once per gesture. */
function computeMoveLimits(pairs) {
    let dMin = -Infinity, dMax = Infinity;
    for (const { actor, origT } of pairs) {
        let prevT = null, nextT = null;
        for (const k of actor.keys) {
            if (state.selKeys.has(k)) continue;
            if (k.t < origT - 1e-6) prevT = k.t;
            else if (k.t > origT + 1e-6) { nextT = k.t; break; }
        }
        dMin = Math.max(dMin, (prevT != null ? prevT + 0.001 : 0) - origT);
        if (nextT != null) dMax = Math.min(dMax, nextT - 0.001 - origT);
    }
    if (dMin > dMax) dMin = dMax = (dMin + dMax) / 2;
    return [dMin, dMax];
}

function moveSelectedBy(dt) {
    const pairs = selectedKeyPairs().map(({ actor, key }) => ({ actor, key, origT: key.t }));
    if (!pairs.length) return false;
    pushUndo();   // deduped when the caller (nudge/drag) already pushed
    const [dMin, dMax] = computeMoveLimits(pairs);
    const d = clamp(dt, dMin, dMax);
    for (const p of pairs) p.key.t = r3(p.origT + d);
    state.t = clamp(state.t, 0, sceneDuration(state.doc));
    autosave();
    renderAll();
    return true;
}

function nudgeSelected(frames) {
    const dt = frames / 30;   // 30fps frames
    if (!selectedKeyPairs().length) {
        // nothing selected — arrows scrub the playhead instead
        state.t = clamp(state.t + dt, 0, sceneDuration(state.doc));
        syncScrubber();
        requestRender();
        return;
    }
    moveSelectedBy(dt);
}

/** Right-click on a key: delete it — or the whole selection when the clicked
 *  key is part of one. */
function deleteKeyHit(hit) {
    const key = hit.actor.keys[hit.ki];
    const doomed = state.selKeys.has(key) && state.selKeys.size > 1
        ? selectedKeyPairs()
        : [{ actor: hit.actor, key }];
    pushUndo();
    for (const { actor, key: k } of doomed) {
        const i = actor.keys.indexOf(k);
        if (i >= 0) actor.keys.splice(i, 1);
        state.selKeys.delete(k);
    }
    if (state.sel.keyIdx != null && !selectedKey()) state.sel.keyIdx = null;
    autosave();
    renderAll();
    toast(doomed.length > 1 ? `${doomed.length} keyframes deleted` : 'Keyframe deleted');
}

function deleteSelected() {
    const pairs = selectedKeyPairs();
    if (!pairs.length) { toast('No keys selected', true); return; }
    pushUndo();
    for (const { actor, key } of pairs) {
        const i = actor.keys.indexOf(key);
        if (i >= 0) actor.keys.splice(i, 1);
    }
    state.selKeys.clear();
    state.sel.keyIdx = null;
    autosave();
    renderAll();
    toast(`${pairs.length} key${pairs.length > 1 ? 's' : ''} deleted`);
}

/** Copies sit one frame after the block's end (span + 1/30s). */
function duplicateSelected() {
    const pairs = selectedKeyPairs();
    if (!pairs.length) { toast('No keys selected', true); return; }
    pushUndo();
    let minT = Infinity, maxT = -Infinity;
    for (const { key } of pairs) {
        minT = Math.min(minT, key.t);
        maxT = Math.max(maxT, key.t);
    }
    const off = Math.max(1 / 30, maxT - minT + 1 / 30);
    const added = [];
    let first = null;
    for (const { actor, key } of pairs) {
        const copy = { ...key, t: r3(key.t + off) };
        while (actor.keys.some(k => Math.abs(k.t - copy.t) < 0.005)) copy.t = r3(copy.t + 1 / 30);
        actor.keys.push(copy);
        sortKeys(actor.keys);
        added.push({ actor, key: copy });
        if (!first) first = { actor, key: copy };
    }
    state.selKeys = new Set(added.map(p => p.key));
    setPrimary(first.actor, first.key);
    autosave();
    renderAll();
    toast(`${added.length} key${added.length > 1 ? 's' : ''} duplicated (+${off.toFixed(2)}s)`);
}

function marqueeKeysInRect(x0, y0, x1, y1) {
    const { lanes, laneH } = tlLaneMetrics();
    const minx = Math.min(x0, x1) - 4, maxx = Math.max(x0, x1) + 4;
    const miny = Math.min(y0, y1) - 4, maxy = Math.max(y0, y1) + 4;
    const out = [];
    lanes.forEach((a, li) => {
        const cy = TL_RULER_H + li * laneH + laneH / 2;
        if (cy < miny || cy > maxy) return;   // lane row not inside the box
        for (const k of a.keys) {
            const x = tlTimeToX(k.t);
            if (x >= minx && x <= maxx) out.push(k);
        }
    });
    return out;
}

function tlZoomAt(px, factor) {
    const t = tlXToTime(px);
    const span0 = state.tl.end - state.tl.start;
    const span1 = clamp(span0 / factor, 0.1, Math.max(30, (state.doc ? sceneDuration(state.doc) : 8) * 2));
    const k = span1 / span0;
    state.tl.start = t - (t - state.tl.start) * k;
    state.tl.end = t + (state.tl.end - t) * k;
    requestRender();
}

function tlPanBy(dtFrac) {
    const span = state.tl.end - state.tl.start;
    state.tl.start += dtFrac * span;
    state.tl.end += dtFrac * span;
    requestRender();
}

// ---------------- timeline context menu ----------------

let ctxMenuEl = null;
function closeCtxMenu() {
    if (ctxMenuEl) { ctxMenuEl.remove(); ctxMenuEl = null; }
}
function openTlContextMenu(e, px, py) {
    closeCtxMenu();
    const { lanes, laneH } = tlLaneMetrics();
    const li = lanes.length ? clamp(Math.floor((py - TL_RULER_H) / laneH), 0, lanes.length - 1) : -1;
    const lane = li >= 0 ? lanes[li] : null;
    const tHere = clamp(r3(tlXToTime(px)), 0, sceneDuration(state.doc));
    const items = [];
    if (lane) {
        items.push({ label: `Add key @ ${tHere.toFixed(2)}s — ${lane.isCamera ? 'camera' : lane.name}`, act: () => addKeyAtTime(lane, tHere) });
        items.push({ label: 'Select all keys in lane', act: () => selectAllInLane(lane) });
    }
    items.push({ label: 'Select all keys (scene)', act: selectAllKeys });
    if (state.selKeys.size) {
        items.push({ label: `Duplicate ${state.selKeys.size} selected (D)`, act: duplicateSelected });
        items.push({ label: `Delete ${state.selKeys.size} selected (Del)`, act: deleteSelected, danger: true });
    }
    const menu = document.createElement('div');
    menu.id = 'ctx-menu';
    for (const it of items) {
        const b = document.createElement('button');
        b.textContent = it.label;
        if (it.danger) b.className = 'danger';
        b.addEventListener('click', () => { closeCtxMenu(); it.act(); });
        menu.appendChild(b);
    }
    document.body.appendChild(menu);
    menu.style.left = Math.max(4, Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 8)) + 'px';
    menu.style.top = Math.max(4, Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 8)) + 'px';
    ctxMenuEl = menu;
}

// close the menu on any click outside it (capture phase, before other handlers)
window.addEventListener('pointerdown', (e) => {
    if (ctxMenuEl && !ctxMenuEl.contains(e.target)) closeCtxMenu();
}, true);
window.addEventListener('wheel', () => closeCtxMenu(), { passive: true });

// ---------------- timeline pointer interactions ----------------

const tlDrag = {
    mode: null,          // 'pan' | 'scrub' | 'scrub-or-marquee' | 'marquee' | 'keys'
    panPx: null,
    px0: 0, py0: 0, px1: 0, py1: 0,
    additive: false, baseSel: null,
    primary: null, pairs: null,
    grabOffset: 0, dMin: 0, dMax: 0, lastD: null,
    moved: false, collapseOnCleanClick: false,
};

function armKeysDrag(hit, px, { collapseOnCleanClick = false } = {}) {
    const primaryKey = hit.actor.keys[hit.ki];
    const pairs = selectedKeyPairs().map(({ actor, key }) => ({ actor, key, origT: key.t }));
    if (!pairs.some(p => p.key === primaryKey)) {
        pairs.push({ actor: hit.actor, key: primaryKey, origT: primaryKey.t });
    }
    const [dMin, dMax] = computeMoveLimits(pairs);
    tlDrag.mode = 'keys';
    tlDrag.primary = { actor: hit.actor, key: primaryKey, origT: primaryKey.t };
    tlDrag.pairs = pairs;
    tlDrag.grabOffset = primaryKey.t - tlXToTime(px);
    tlDrag.dMin = dMin;
    tlDrag.dMax = dMax;
    tlDrag.lastD = null;
    tlDrag.moved = false;
    tlDrag.collapseOnCleanClick = collapseOnCleanClick;
}

tlCanvas.addEventListener('contextmenu', e => e.preventDefault());

tlCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = tlCanvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {   // trackpad horizontal pan
        tlPanBy(e.deltaX / (tlCanvas.clientWidth - TL_PAD * 2));
        return;
    }
    if (e.shiftKey) { tlPanBy(e.deltaY > 0 ? 0.12 : -0.12); return; }
    tlZoomAt(px, e.deltaY < 0 ? 1.15 : 1 / 1.15);
}, { passive: false });

tlCanvas.addEventListener('pointerdown', (e) => {
    if (!state.doc) return;
    const r = tlCanvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;

    // pan: middle / alt / space-drag (shift+wheel also pans)
    if (e.button === 1 || e.altKey || (e.button === 0 && spaceHeld)) {
        e.preventDefault();
        tlDrag.mode = 'pan';
        tlDrag.panPx = px;
        capturePtr(tlCanvas, e);
        return;
    }
    if (e.button === 2) {
        // right: delete the key under the cursor (selection-aware),
        // or open the context menu on empty space
        const hit = tlHitKey(px, py);
        if (hit) deleteKeyHit(hit);
        else openTlContextMenu(e, px, py);
        return;
    }
    if (e.button !== 0) return;

    // ruler drags scrub the playhead
    if (py <= TL_RULER_H) {
        tlDrag.mode = 'scrub';
        state.t = clamp(tlXToTime(px), 0, sceneDuration(state.doc));
        syncScrubber();
        capturePtr(tlCanvas, e);
        renderStage(); renderTimeline();
        return;
    }

    const hit = tlHitKey(px, py);
    if (hit) {
        const key = hit.actor.keys[hit.ki];
        const additive = e.shiftKey || e.ctrlKey || e.metaKey;
        const wasSelected = state.selKeys.has(key);
        if (additive) {
            if (wasSelected) {
                // toggle off
                state.selKeys.delete(key);
                const rest = selectedKeyPairs();
                if (rest.length) setPrimary(rest[rest.length - 1].actor, rest[rest.length - 1].key);
                else state.sel.keyIdx = null;
                renderAll();
                return;
            }
            state.selKeys.add(key);
            setPrimary(hit.actor, key);
            armKeysDrag(hit, px);
        } else {
            if (!wasSelected) selectSingleKey(hit.actor, key);
            // clicking an already-selected key keeps the block grabbed; a clean
            // click (no drag) collapses back to that single key on release
            armKeysDrag(hit, px, { collapseOnCleanClick: wasSelected && state.selKeys.size > 1 });
        }
        capturePtr(tlCanvas, e);
        renderAll();
        return;
    }

    // lane label zone selects the actor
    if (px <= TL_NAME_W) {
        const { lanes, laneH } = tlLaneMetrics();
        const li = Math.floor((py - TL_RULER_H) / laneH);
        if (li >= 0 && li < lanes.length) selectActorOnly(lanes[li]);
        renderAll();
        return;
    }

    // empty lane: click scrubs, dragging becomes a marquee box select
    tlDrag.mode = 'scrub-or-marquee';
    tlDrag.px0 = px; tlDrag.py0 = py; tlDrag.px1 = px; tlDrag.py1 = py;
    tlDrag.additive = e.shiftKey || e.ctrlKey || e.metaKey;
    tlDrag.baseSel = new Set(state.selKeys);
    state.t = clamp(tlXToTime(px), 0, sceneDuration(state.doc));
    syncScrubber();
    capturePtr(tlCanvas, e);
    renderStage(); renderTimeline();
});

tlCanvas.addEventListener('pointermove', (e) => {
    if (!tlDrag.mode) return;
    const r = tlCanvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;

    if (tlDrag.mode === 'pan') {
        const dx = px - tlDrag.panPx;
        tlDrag.panPx = px;
        tlPanBy(-dx / (tlCanvas.clientWidth - TL_PAD * 2));
        return;
    }
    if (tlDrag.mode === 'scrub') {
        state.t = clamp(tlXToTime(px), 0, sceneDuration(state.doc));
        syncScrubber();
        renderStage(); renderTimeline();
        return;
    }
    if (tlDrag.mode === 'scrub-or-marquee') {
        if (Math.hypot(px - tlDrag.px0, py - tlDrag.py0) > 5) {
            tlDrag.mode = 'marquee';
            if (!tlDrag.additive) state.selKeys.clear();
            tlCanvas.classList.add('marquee');
        } else {
            state.t = clamp(tlXToTime(px), 0, sceneDuration(state.doc));
            syncScrubber();
            renderStage(); renderTimeline();
            return;
        }
    }
    if (tlDrag.mode === 'marquee') {
        tlDrag.px1 = px; tlDrag.py1 = py;
        const picked = marqueeKeysInRect(tlDrag.px0, tlDrag.py0, px, py);
        state.selKeys = tlDrag.additive ? new Set([...tlDrag.baseSel, ...picked]) : new Set(picked);
        renderStage(); renderTimeline();
        return;
    }
    if (tlDrag.mode === 'keys') {
        const g = tlDrag;
        const tTarget = tlXToTime(px) + g.grabOffset;
        let d = tTarget - g.primary.origT;
        if (state.snap) d = Math.round(tTarget * 30) / 30 - g.primary.origT;
        d = clamp(d, g.dMin, g.dMax);
        if (!g.moved) { g.moved = true; pushUndo(); }   // capture pre-move state
        if (d !== g.lastD) {
            g.lastD = d;
            for (const p of g.pairs) p.key.t = r3(p.origT + d);
            state.t = clamp(state.t, 0, sceneDuration(state.doc));
            autosave();
            renderAll();
        }
    }
});

function endTlDrag(e) {
    if (tlDrag.mode === 'marquee') {
        // primary = selected key nearest to where the box started
        let best = null, bd = Infinity;
        for (const { actor, key } of selectedKeyPairs()) {
            const d = Math.abs(tlTimeToX(key.t) - tlDrag.px0);
            if (d < bd) { bd = d; best = { actor, key }; }
        }
        if (best) setPrimary(best.actor, best.key);
        else state.sel.keyIdx = null;
        renderAll();
    } else if (tlDrag.mode === 'keys' && tlDrag.collapseOnCleanClick && !tlDrag.moved) {
        selectSingleKey(tlDrag.primary.actor, tlDrag.primary.key);
        renderAll();
    }
    tlDrag.mode = null;
    tlDrag.pairs = null;
    tlCanvas.classList.remove('marquee');
    try { tlCanvas.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
}
tlCanvas.addEventListener('pointerup', endTlDrag);
tlCanvas.addEventListener('pointercancel', endTlDrag);

// Double-click on a key selects its whole lane. It no longer creates keys —
// use K / ＋ Key / right-click → "Add key" instead.
tlCanvas.addEventListener('dblclick', (e) => {
    const r = tlCanvas.getBoundingClientRect();
    const hit = tlHitKey(e.clientX - r.left, e.clientY - r.top);
    if (hit) selectAllInLane(hit.actor);
});

function addKeyAtTime(actor, t) {
    t = Math.max(0, t);
    if (state.snap) t = Math.round(t * 30) / 30;
    t = r3(t);
    if (actor.keys.some(k => Math.abs(k.t - t) < 0.005)) { toast('Key already at this time'); return; }
    pushUndo();
    const st = sampleActor(actor, t);
    const key = { t, x: r3(st.x), y: r3(st.y) };
    if (actor.isCamera) { delete key.y; }
    actor.keys.push(key);
    sortKeys(actor.keys);
    selectSingleKey(actor, key);
    autosave(); renderAll();
    toast(`Key added at ${t.toFixed(2)}s`);
}

// ---------------- outliner ----------------

function renderOutliner() {
    const el = $('outliner');
    el.innerHTML = '';
    for (const a of state.doc?.actors || []) {
        const row = document.createElement('div');
        row.className = 'actor-row' + (a.id === state.sel.actorId ? ' sel' : '');
        row.dataset.actorId = a.id;

        const eye = document.createElement('button');
        eye.className = 'iconbtn' + (a.visible === false ? ' off' : '');
        eye.textContent = a.visible === false ? '○' : '●';
        eye.title = a.visible === false ? 'Show (hidden actors never draw, in editor or game)' : 'Hide';
        eye.addEventListener('click', (e) => {
            e.stopPropagation();
            a.visible = a.visible === false;
            autosave(); renderAll();
        });

        const nm = document.createElement('input');
        nm.type = 'text';
        nm.value = a.name;
        nm.title = 'Actor name — "knight" (any case) drives the real boss in-game';
        nm.addEventListener('input', () => { a.name = nm.value; autosave(); requestRender(); renderInspector(); });
        nm.addEventListener('pointerdown', e => e.stopPropagation());

        row.appendChild(eye);
        row.appendChild(nm);

        if (isKnightActor(a)) {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = 'BOSS';
            row.appendChild(tag);
        }
        if (a.isCamera) {
            const tag = document.createElement('span');
            tag.className = 'tag cam';
            tag.textContent = 'CAM';
            row.appendChild(tag);
        }

        if (!a.isCamera) {
            const del = document.createElement('button');
            del.className = 'iconbtn';
            del.textContent = '✕';
            del.title = 'Delete actor';
            del.addEventListener('click', (e) => {
                e.stopPropagation();
                pushUndo();
                state.doc.actors = state.doc.actors.filter(x => x !== a);
                if (state.sel.actorId === a.id) state.sel = { actorId: null, keyIdx: null };
                state.selKeys.clear();
                autosave(); renderAll();
            });
            row.appendChild(del);
        }

        row.addEventListener('click', () => {
            selectActorOnly(a);
            renderAll();
        });
        el.appendChild(row);
    }
}

$('btn-add-actor').addEventListener('click', () => {
    if (!state.doc) return;
    pushUndo();
    const n = state.doc.actors.length + 1;
    const libKey = state.libSelKey;
    const entry = libKey ? LIB.byKey.get(libKey) : null;
    state.doc.actors.push({
        id: `a${Date.now().toString(36)}`,
        name: `Actor ${n}`,
        sprite: entry ? (entry.key || entry.url) : 'boss_knight_back_1',
        visible: true, isCamera: false,
        keys: [{ t: 0, x: 640, y: 360 }],
    });
    state.sel = { actorId: state.doc.actors[state.doc.actors.length - 1].id, keyIdx: 0 };
    state.selKeys.clear();
    autosave(); renderAll();
});

$('btn-add-camera').addEventListener('click', () => {
    if (!state.doc) return;
    if (findCameraActor(state.doc)) { toast('This scene already has a camera actor', true); return; }
    pushUndo();
    state.doc.actors.unshift({
        id: 'camera', isCamera: true, name: 'Camera', sprite: null, visible: true,
        keys: [{ t: 0, x: 0, easing: 'linear' }],
    });
    state.sel = { actorId: 'camera', keyIdx: 0 };
    state.selKeys.clear();
    autosave(); renderAll();
    toast('Camera added — its x pans the world in-game');
});

// ---------------- inspector ----------------

function fldRow(labelText, value, step, onSet, opts = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'fld' + (opts.full ? ' full' : '');
    const lbl = document.createElement('label');
    lbl.textContent = labelText;
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = step;
    if (value != null) inp.value = value;
    inp.addEventListener('input', () => {
        const v = parseFloat(inp.value);
        if (!isNaN(v)) onSet(v);
    });
    wrap.appendChild(lbl); wrap.appendChild(inp);
    return wrap;
}

function renderInspector() {
    const el = $('inspector');
    el.innerHTML = '';
    const a = selectedActor();
    if (!a) {
        el.innerHTML = '<p class="note">No actor selected. Click one on the stage or in Actors.</p>';
        return;
    }

    // multi-selection panel: bulk easing / mirror + duplicate & delete
    const pairs = selectedKeyPairs();
    if (pairs.length > 1) {
        const ts = pairs.map(p => p.key.t);
        const title = document.createElement('div');
        title.className = 'ktitle';
        title.textContent = `${pairs.length} keys selected · ${Math.min(...ts).toFixed(2)}s → ${Math.max(...ts).toFixed(2)}s`;
        el.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'grid2';
        const eas = document.createElement('div');
        eas.className = 'fld full';
        const el2 = document.createElement('label');
        el2.textContent = 'easing (all)';
        const esel = document.createElement('select');
        for (const name of EASING_NAMES) {
            const o = document.createElement('option');
            o.value = name; o.textContent = name;
            if ((pairs[0].key.easing || 'linear') === name) o.selected = true;
            esel.appendChild(o);
        }
        esel.addEventListener('change', () => {
            for (const p of pairs) p.key.easing = esel.value;
            autosave(); requestRender();
        });
        eas.appendChild(el2); eas.appendChild(esel);
        grid.appendChild(eas);

        if (pairs.some(p => !p.actor.isCamera)) {
            const mir = document.createElement('div');
            mir.className = 'fld full';
            const ml = document.createElement('label');
            ml.textContent = 'mirror (all)';
            const mc = document.createElement('input');
            mc.type = 'checkbox';
            mc.checked = pairs.some(p => !p.actor.isCamera && p.key.mirror);
            mc.addEventListener('change', () => {
                for (const p of pairs) if (!p.actor.isCamera) p.key.mirror = mc.checked;
                autosave(); requestRender();
            });
            mir.appendChild(ml); mir.appendChild(mc);
            grid.appendChild(mir);
        }
        el.appendChild(grid);

        const btns = document.createElement('div');
        btns.className = 'btnrow';
        const dup = document.createElement('button');
        dup.textContent = `Duplicate ${pairs.length}`;
        dup.addEventListener('click', duplicateSelected);
        const del = document.createElement('button');
        del.className = 'danger';
        del.textContent = `Delete ${pairs.length}`;
        del.addEventListener('click', deleteSelected);
        btns.appendChild(dup); btns.appendChild(del);
        el.appendChild(btns);

        const note = document.createElement('p');
        note.className = 'note';
        note.textContent = 'Drag any selected diamond in the timeline to move the whole block sideways (it cannot cross unselected keys). Arrow keys nudge by one frame — Shift for ten.';
        el.appendChild(note);
        return;
    }

    const k = selectedKey();
    const title = document.createElement('div');
    title.className = 'ktitle';
    title.textContent = k ? `${a.name} · key @ ${k.t.toFixed(3)}s` : `${a.name} · base sprite: ${a.sprite || '—'}`;
    el.appendChild(title);

    if (isKnightActor(a)) {
        const hint = document.createElement('div');
        hint.className = 'knight-hint';
        hint.textContent = 'This actor drives the REAL boss in-game: x, y, sprite and alpha apply directly. Scale multiplies his normal draw size (1 = exactly what the game shows) and mirror flips him — both now drive the boss too. The stage shows him mirrored by default, because the game renders the boss art mirrored.';
        el.appendChild(hint);
    }

    if (!k) {
        const grid = document.createElement('div');
        grid.className = 'grid2';
        const spr = document.createElement('div');
        spr.className = 'fld full';
        const lbl = document.createElement('label');
        lbl.textContent = 'sprite';
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = a.sprite || '';
        inp.placeholder = 'boss_knight_back_1 or sprites/... .png';
        inp.addEventListener('input', () => { a.sprite = inp.value.trim() || null; autosave(); requestRender(); });
        spr.appendChild(lbl); spr.appendChild(inp);
        grid.appendChild(spr);
        el.appendChild(grid);
        const hint2 = document.createElement('p');
        hint2.className = 'note';
        hint2.textContent = 'Press K (or ＋ Key) to drop a key at the playhead, drag the actor on stage, or right-click a timeline lane → "Add key". Double-click no longer creates keys.';
        el.appendChild(hint2);
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid2';
    const isCam = a.isCamera;

    grid.appendChild(fldRow('t (s)', k.t, 0.01, v => {
        k.t = r3(Math.max(0, v));
        sortKeys(a.keys);
        state.sel.keyIdx = a.keys.indexOf(k);
        autosave(); requestRender(); renderTimeline();
    }));
    grid.appendChild(fldRow('x', k.x, 1, v => { k.x = r3(v); autosave(); requestRender(); }));
    if (!isCam) grid.appendChild(fldRow('y', k.y, 1, v => { k.y = r3(v); autosave(); requestRender(); }));
    if (!isCam) {
        grid.appendChild(fldRow('scale', k.scale, 0.05, v => { k.scale = Math.max(0.01, v); autosave(); requestRender(); }));
        grid.appendChild(fldRow('rotation', k.rotation, 5, v => { k.rotation = v; autosave(); requestRender(); }));
        grid.appendChild(fldRow('alpha', k.alpha, 0.05, v => { k.alpha = clamp(v, 0, 1); autosave(); requestRender(); }));

        const mir = document.createElement('div');
        mir.className = 'fld';
        const ml = document.createElement('label');
        ml.textContent = 'mirror';
        const mc = document.createElement('input');
        mc.type = 'checkbox';
        mc.checked = !!k.mirror;
        mc.addEventListener('change', () => { k.mirror = mc.checked; autosave(); requestRender(); });
        mir.appendChild(ml); mir.appendChild(mc);
        grid.appendChild(mir);
    }

    const eas = document.createElement('div');
    eas.className = 'fld';
    const el2 = document.createElement('label');
    el2.textContent = 'easing';
    const esel = document.createElement('select');
    for (const name of EASING_NAMES) {
        const o = document.createElement('option');
        o.value = name; o.textContent = name;
        if ((k.easing || 'linear') === name) o.selected = true;
        esel.appendChild(o);
    }
    esel.addEventListener('change', () => { k.easing = esel.value; autosave(); requestRender(); });
    eas.appendChild(el2); eas.appendChild(esel);
    grid.appendChild(eas);

    const spr = document.createElement('div');
    spr.className = 'fld full';
    const sl = document.createElement('label');
    sl.textContent = 'sprite';
    const sinp = document.createElement('input');
    sinp.type = 'text';
    sinp.value = k.sprite || '';
    sinp.placeholder = 'empty = hold previous / base';
    sinp.addEventListener('input', () => { k.sprite = sinp.value.trim() || undefined; autosave(); requestRender(); });
    spr.appendChild(sl); spr.appendChild(sinp);
    grid.appendChild(spr);

    el.appendChild(grid);
}

// ---------------- library UI ----------------

function renderLibrary() {
    const el = $('library');
    el.innerHTML = '';
    const q = ($('lib-search').value || '').trim().toLowerCase();
    for (const g of LIB.groups) {
        const entries = q
            ? g.entries.filter(e => (e.key || e.url).toLowerCase().includes(q) || g.name.toLowerCase().includes(q))
            : g.entries;
        if (!entries.length) continue;
        const wrap = document.createElement('div');
        wrap.className = 'lib-group';
        const gn = document.createElement('div');
        gn.className = 'gname';
        gn.textContent = `${g.name} (${entries.length})`;
        wrap.appendChild(gn);
        const grid = document.createElement('div');
        grid.className = 'lib-grid';
        for (const e of entries) {
            const cell = document.createElement('div');
            cell.className = 'lib-cell' + (state.libSelKey && e.key === state.libSelKey ? ' sel' : '');
            const url = entryThumbURL(e);
            if (url) cell.style.backgroundImage = `url("${url}")`;
            else cell.title = 'loading…';
            const cap = document.createElement('div');
            cap.className = 'cap';
            cap.textContent = e.label;
            cell.appendChild(cap);
            cell.title = e.key || e.url;
            cell.addEventListener('click', () => {
                state.libSelKey = e.key || null;
                applySprite(e);
                renderLibrary();
            });
            grid.appendChild(cell);
        }
        wrap.appendChild(grid);
        el.appendChild(wrap);
    }
}

function applySprite(entry) {
    const ref = entry.key || entry.url;
    const a = selectedActor();
    if (!a) { toast('Select an actor first', true); return; }
    const k = selectedKey();
    if (k && !a.isCamera) {
        k.sprite = ref;
        toast(`Key sprite → ${ref}`);
    } else if (a.isCamera) {
        toast('Camera actors have no sprite', true);
        return;
    } else {
        a.sprite = ref;
        toast(`${a.name} sprite → ${ref}`);
    }
    autosave(); renderInspector(); requestRender();
}

$('lib-search').addEventListener('input', renderLibrary);

// ---------------- scene io + toolbar wiring ----------------

$('scene-name').addEventListener('input', () => {
    if (!state.doc) return;
    state.doc.name = $('scene-name').value;
    autosave();
});
$('chk-boss').addEventListener('change', () => {
    if (!state.doc) return;
    state.doc.useForBossIntro = $('chk-boss').checked;
    autosave();
    toast(state.doc.useForBossIntro
        ? 'Scene will replace the boss intro in-game (saved)'
        : 'Game will use the hardcoded reveal again');
});

$('btn-save').addEventListener('click', () => {
    localStorage.setItem(DOC_STORE, JSON.stringify(state.doc));
    toast('Saved to localStorage — in-game reads kilo_cutscene_v1');
});

$('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.doc, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(state.doc.name || 'cutscene').replace(/[^\w-]+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
});

$('file-import').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    f.text().then(txt => {
        try {
            pushUndo();
            const doc = normalizeDoc(JSON.parse(txt));
            setDoc(doc);
            toast(`Imported "${doc.name}" — ${doc.actors.length} actors`);
        } catch (err) {
            toast(`Import failed: ${err.message}`, true);
        }
    });
});
$('btn-import').addEventListener('click', () => $('file-import').click());

$('btn-vanilla').addEventListener('click', () => {
    pushUndo();
    const doc = normalizeDoc(buildVanillaIntroDoc());
    setDoc(doc);
    toast('Loaded the hardcoded reveal as editable keyframes (boss intro ON)');
});

$('btn-new').addEventListener('click', () => {
    pushUndo();
    setDoc(newDoc());
    toast('New scene');
});

// map background controls
const mapSelect = $('map-select');
for (let i = 0; i < Maps.length; i++) {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = Maps[i].name || `Map ${i + 1}`;
    mapSelect.appendChild(o);
}
mapSelect.value = String(state.mapIdx);
mapSelect.addEventListener('change', () => {
    state.mapIdx = clamp(parseInt(mapSelect.value, 10) || 0, 0, Maps.length - 1);
    savePrefs(); requestRender();
});
$('chk-map').checked = state.showMap;
$('chk-map').addEventListener('change', () => {
    state.showMap = $('chk-map').checked;
    savePrefs(); requestRender();
});
$('chk-paths').checked = state.showPaths;
$('chk-paths').addEventListener('change', () => {
    state.showPaths = $('chk-paths').checked;
    savePrefs(); requestRender();
});
$('chk-snap').checked = state.snap;
$('chk-snap').addEventListener('change', () => {
    state.snap = $('chk-snap').checked;
    savePrefs();
});

// timeline editing buttons (same ops the keyboard/context menu use)
$('btn-add-key').addEventListener('click', () => {
    const a = selectedActor();
    if (a) addKeyAtTime(a, state.t);
    else toast('Select an actor first', true);
});
$('btn-dup-keys').addEventListener('click', duplicateSelected);
$('btn-del-keys').addEventListener('click', deleteSelected);

// ---------------- boot ----------------

function syncSceneUI() {
    $('scene-name').value = state.doc?.name || '';
    $('chk-boss').checked = !!state.doc?.useForBossIntro;
}

loadPrefs();
(function boot() {
    let doc = null;
    try {
        const raw = localStorage.getItem(DOC_STORE);
        if (raw) doc = normalizeDoc(JSON.parse(raw));
    } catch (e) { /* corrupt store — fall through to vanilla */ }
    state.doc = doc || buildVanillaIntroDoc();
    state.sel = { actorId: state.doc.actors[0]?.id ?? null, keyIdx: null };
    syncSceneUI();
    buildLibrary();
    fitViewToContent();
    renderAll();
    updatePlayBtn();
    syncScrubber();
    requestAnimationFrame(tick);
})();

window.addEventListener('resize', requestRender);

// ---------------- debug hook (headless tests / console) ----------------

window.__cutsceneEditor = {
    get doc() { return state.doc; },
    setDoc,
    get state() {
        return {
            t: state.t, playing: state.playing,
            view: { ...state.view },
            mapIdx: state.mapIdx, showMap: state.showMap, showPaths: state.showPaths,
            sel: { ...state.sel },
            selCount: state.selKeys.size,
            libGroups: LIB.groups.map(g => ({ name: g.name, count: g.entries.length })),
        };
    },
    fitViewToContent, resetView,
    sampleScene: (t) => sampleScene(state.doc, t ?? state.t),
    sampleCamera: (t) => sampleCamera(state.doc, t ?? state.t),
    // What the stage WOULD draw right now (game-parity metrics): on-screen
    // size in plate px, effective facing, alpha. w/h are null until the
    // sprite image has loaded (boss frames are loose PNGs, size = native).
    previewMetrics: (t) => {
        const tt = t ?? state.t;
        return sampleScene(state.doc, tt).map((st) => {
            const entry = resolveEntry(st.sprite);
            const native = entryNativeSize(entry);
            const size = actorDrawSize(entry, st, st.actor);
            return {
                id: st.actor.id, name: st.actor.name, sprite: st.sprite,
                isKnight: size.isKnight,
                w: native ? Math.round(size.w * 10) / 10 : null,
                h: native ? Math.round(size.h * 10) / 10 : null,
                flip: size.flip,
                alpha: st.alpha, x: st.x, y: st.y,
            };
        });
    },
    selectMap: (i) => { state.mapIdx = clamp(i | 0, 0, Maps.length - 1); mapSelect.value = String(state.mapIdx); savePrefs(); requestRender(); },
    setMapBg: (v) => { state.showMap = !!v; $('chk-map').checked = !!v; savePrefs(); requestRender(); },
    setPaths: (v) => { state.showPaths = !!v; $('chk-paths').checked = !!v; savePrefs(); requestRender(); },
    addKeyAtTime, anchorKeyAtPlayhead,
    // multi-selection / history controls (headless tests + console)
    selectKeysAt: (actorId, idxs, additive = false) => {
        const a = state.doc?.actors.find(x => x.id === actorId);
        if (!a) return false;
        if (!additive) state.selKeys.clear();
        let last = null;
        for (const i of idxs) {
            if (a.keys[i]) { state.selKeys.add(a.keys[i]); last = { a, k: a.keys[i] }; }
        }
        if (last) setPrimary(last.a, last.k);
        renderAll();
        return true;
    },
    selTimes: () => selectedKeyPairs().map(p => p.key.t).sort((x, y) => x - y),
    tlTimeToX, tlXToTime,
    tlWindow: () => ({ ...state.tl }),
    moveSelectedBy, deleteSelected, duplicateSelected,
    selectAllInLane, selectAllKeys,
    undo, redo,
    history: () => ({ undo: undoStack.length, redo: redoStack.length }),
};
