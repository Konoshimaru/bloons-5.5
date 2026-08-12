// js/benchmark/scenarios.js
//
// The scenario library. Each scenario declares:
//   id/name/group/desc       — identity + metadata (rendered in the UI)
//   sim                      — true: full update()+render() per frame
//                              false: render() only (pure draw cost)
//   params / paramDefs       — tunables surfaced as number inputs
//   setup(ctx, P)            — build the scene (may be async: e.g. preload
//                              upgrade sprites). ctx is the shared harness
//                              context with placeTower/spawnEnemy/engine.
//   step(ctx, P)             — runs every measured frame BEFORE update()
//                              (used to hold enemies in range / advance anims)
//   post(ctx, P)             — runs every frame AFTER update() (respawners)
//
// P is the merged parameter object (scenario.params + UI overrides).

import { TowerStats } from '../towers/index.js';
import { PixiAssets } from '../webgl/pixiAssets.js';
import { gridPoints as grid } from './harness.js';

const TOWER_TYPES = Object.keys(TowerStats);

function keepAlive(e) {
    e.lives = 999999;
    if (e.gameState !== 'playing') e.gameState = 'playing';
}

// Holds every enemy at fixed coordinates so towers keep firing without
// letting bloons walk out of range or leak.
function holdAllAt(enemies, cx, cy, spread = 14) {
    let i = 0;
    for (const en of enemies) {
        if (!en.alive) continue;
        const row = i % 10;
        en.x = cx;
        en.y = cy + (row - 5) * spread;
        en.distanceTraveled = 0;
        i++;
    }
}

// Replaces dead enemies 1:1 so a firing scenario sustains a constant load.
function respawnTo(ctx, targetCount, tier, spawnX, spawnY, spread = 14) {
    const e = ctx.engine;
    const alive = e.enemies.filter((en) => en.alive).length;
    let need = targetCount - alive;
    while (need > 0) {
        ctx.spawnEnemy(tier, spawnX, spawnY + (((targetCount - need) % 10) - 5) * spread);
        need--;
    }
}

const upgradeKeysFor = (type, ups) => {
    const keys = [];
    for (let p = 1; p <= 3; p++) {
        const t = ups[p - 1] || 0;
        if (t <= 0) continue;
        keys.push(`tower_${type}_p${p}_t${t}`);
        keys.push(`tower_${type}_p${p}_t${t}_base`);
        keys.push(`tower_${type}_p${p}_t${t}_a`);
        keys.push(`tower_${type}_p${p}_t${t}_arm`);
    }
    return keys;
};

export const SCENARIOS = [

    // ---------- Baseline ----------
    {
        id: 'empty-render', name: 'Empty map · render only', group: 'Baseline',
        desc: 'Nothing but the map background. The minimum draw cost.',
        sim: false, params: {}, paramDefs: [],
        setup() {},
        step: null, post: null,
    },
    {
        id: 'empty-sim', name: 'Empty map · full sim', group: 'Baseline',
        desc: 'The whole update() pipeline (grids, wave manager, UI) with an empty map.',
        sim: true, params: {}, paramDefs: [],
        setup() {},
        step: null, post: null,
    },

    // ---------- Primary ----------
    {
        id: 'dart-idle', name: 'Dart Monkeys ×16 · idle', group: 'Primary',
        desc: '16 dart monkeys doing nothing. Pure sprite draw cost.',
        sim: false, params: { count: 16 },
        paramDefs: [{ key: 'count', label: 'Towers', min: 1, max: 200, step: 1 }],
        setup(ctx, P) {
            for (const [x, y] of grid(P.count, 640, 360, 8, 80)) ctx.placeTower('dart', x, y);
        },
        step: null, post: null,
    },
    {
        id: 'dart-sim', name: 'Dart Monkeys ×16 · sim idle', group: 'Primary',
        desc: '16 dart monkeys idling through the full sim (target search every frame).',
        sim: true, params: { count: 16 },
        paramDefs: [{ key: 'count', label: 'Towers', min: 1, max: 200, step: 1 }],
        setup(ctx, P) {
            for (const [x, y] of grid(P.count, 640, 360, 8, 80)) ctx.placeTower('dart', x, y);
        },
        step: null, post: null,
    },
    {
        id: 'dart-fire', name: 'Dart Monkeys ×12 · firing at bloons', group: 'Primary',
        desc: '12 darts, one bloon glued in front of each, full sim. Heavy projectile + pop + particle load.',
        sim: true, params: { count: 12 },
        paramDefs: [{ key: 'count', label: 'Towers', min: 1, max: 64, step: 1 }],
        state: {},
        setup(ctx, P) {
            const pairs = [];
            for (const [x, y] of grid(P.count, 640, 360, 6, 70)) {
                const t = ctx.placeTower('dart', x, y);
                const en = ctx.spawnEnemy(1, x, y + 24);
                pairs.push([t, en]);
            }
            this.state.pairs = pairs;
        },
        step(ctx, P) {
            keepAlive(ctx.engine);
            for (const [t, en] of this.state.pairs) {
                if (!en.alive) continue;
                en.x = t.x; en.y = t.y + 24; en.distanceTraveled = 0;
            }
        },
        post(ctx, P) {
            for (const pair of this.state.pairs) {
                if (!pair[1].alive) pair[1] = ctx.spawnEnemy(1, pair[0].x, pair[0].y + 24);
            }
        },
    },

    // ---------- Military ----------
    {
        id: 'sniper-idle', name: 'Snipers ×16 · idle', group: 'Military',
        desc: '16 snipers standing idle — renders the tall 507×1665 base sprite.',
        sim: false, params: { count: 16 },
        paramDefs: [{ key: 'count', label: 'Towers', min: 1, max: 200, step: 1 }],
        setup(ctx, P) {
            for (const [x, y] of grid(P.count, 640, 360, 8, 80)) ctx.placeTower('sniper', x, y);
        },
        step: null, post: null,
    },
    {
        id: 'sniper-sim', name: 'Snipers ×16 · sim idle', group: 'Military',
        desc: '16 snipers idling through the full sim.',
        sim: true, params: { count: 16 },
        paramDefs: [{ key: 'count', label: 'Towers', min: 1, max: 200, step: 1 }],
        setup(ctx, P) {
            for (const [x, y] of grid(P.count, 640, 360, 8, 80)) ctx.placeTower('sniper', x, y);
        },
        step: null, post: null,
    },
    {
        id: 'sniper-fire', name: 'Snipers ×8 · firing at bloons', group: 'Military',
        desc: '8 snipers + 40 bloons held in range, full sim. Reproduces the 20 FPS complaint.',
        sim: true, params: { count: 8, enemies: 40 },
        paramDefs: [
            { key: 'count', label: 'Snipers', min: 1, max: 64, step: 1 },
            { key: 'enemies', label: 'Bloons', min: 1, max: 200, step: 1 },
        ],
        setup(ctx, P) {
            for (const [x, y] of grid(P.count, 300, 360, 2, 80)) ctx.placeTower('sniper', x, y);
            for (let i = 0; i < P.enemies; i++) ctx.spawnEnemy(1, 720, 360 + ((i % 10) - 5) * 14);
        },
        step(ctx, P) {
            keepAlive(ctx.engine);
            holdAllAt(ctx.engine.enemies, 720, 360, 14);
        },
        post(ctx, P) {
            respawnTo(ctx, P.enemies, 1, 720, 360, 14);
        },
    },
    {
        id: 'sniper-anim', name: 'Snipers ×8 · forced attack-full anim', group: 'Diagnostic',
        desc: 'Full-body attack frames (the ~1665px-tall sprites) swapped every frame. No sim. Isolates the sprite-swap cost.',
        sim: false, params: { count: 8 },
        paramDefs: [{ key: 'count', label: 'Snipers', min: 1, max: 64, step: 1 }],
        setup(ctx, P) {
            for (const [x, y] of grid(P.count, 640, 360, 2, 90)) {
                ctx.placeTower('sniper', x, y, null, { isFullAnim: true });
            }
        },
        step(ctx, P) {
            for (const t of ctx.engine.towers) {
                t.attackAnimFrame = ((t.attackAnimFrame || 0) + 1) % 23;
            }
        },
        post: null,
    },

    // ---------- Magic / Supers ----------
    {
        id: 'mixed-zoo', name: 'Mixed zoo · every tower type ×1', group: 'Magic',
        desc: 'One of every registered tower type (no sim). Sprite-variety stress.',
        sim: false, params: {},
        paramDefs: [],
        setup(ctx) {
            const pts = grid(TOWER_TYPES.length, 640, 360, Math.ceil(Math.sqrt(TOWER_TYPES.length)), 78);
            TOWER_TYPES.forEach((type, i) => {
                const [x, y] = pts[i] || [640, 360];
                ctx.placeTower(type, x, y);
            });
        },
        step: null, post: null,
    },
    {
        id: 'upgraded', name: 'Upgraded towers ×24 · tier 2-2-0', group: 'Magic',
        desc: '24 upgraded towers (custom bases + overlays + arms) across 6 types. Sprite-count stress.',
        sim: false, params: { count: 24 },
        paramDefs: [{ key: 'count', label: 'Towers', min: 1, max: 200, step: 1 }],
        setup: async function (ctx, P) {
            const types = ['dart', 'sniper', 'super', 'ninja', 'wiz', 'bomb'];
            const ups = [2, 2, 0];
            const keys = [];
            for (const type of types) keys.push(...upgradeKeysFor(type, ups));
            await PixiAssets.preloadManifest(keys);
            const pts = grid(P.count, 640, 360, Math.ceil(Math.sqrt(P.count)), 78);
            pts.forEach(([x, y], i) => ctx.placeTower(types[i % types.length], x, y, ups));
        },
        step: null, post: null,
    },

    // ---------- Enemies ----------
    {
        id: 'wave-render', name: 'Bloon wave ×60 · render only', group: 'Enemies',
        desc: '60 red bloons rendered, not simulated.',
        sim: false, params: { enemies: 60 },
        paramDefs: [{ key: 'enemies', label: 'Bloons', min: 1, max: 400, step: 1 }],
        setup(ctx, P) {
            for (let i = 0; i < P.enemies; i++) {
                const en = ctx.spawnEnemy(1);
                en.x = 640 + ((i % 20) - 10) * 12;
                en.y = 360 + (Math.floor(i / 20) - 1) * 16;
            }
        },
        step: null, post: null,
    },
    {
        id: 'wave-sim', name: 'Bloon wave ×60 · sim (moving)', group: 'Enemies',
        desc: '60 red bloons marching the path, constantly respawned at the start. Pathfinding + spawn churn.',
        sim: true, params: { enemies: 60 },
        paramDefs: [{ key: 'enemies', label: 'Bloons', min: 1, max: 400, step: 1 }],
        setup(ctx, P) {
            for (let i = 0; i < P.enemies; i++) ctx.spawnEnemy(1);
        },
        step(ctx, P) {
            keepAlive(ctx.engine);
        },
        post(ctx, P) {
            respawnTo(ctx, P.enemies, 1, null, null);
        },
    },

    // ---------- Stress / environment ----------
    {
        id: 'night', name: 'Night mode · 16 darts + 40 bloons', group: 'Stress',
        desc: 'Full sim in night mode — per-tower radial-gradient glow + enemies.',
        sim: true, params: { count: 16, enemies: 40 },
        paramDefs: [
            { key: 'count', label: 'Towers', min: 1, max: 100, step: 1 },
            { key: 'enemies', label: 'Bloons', min: 1, max: 200, step: 1 },
        ],
        setup(ctx, P) {
            ctx.engine.isNight = true;
            for (const [x, y] of grid(P.count, 640, 360, 8, 80)) ctx.placeTower('dart', x, y);
            for (let i = 0; i < P.enemies; i++) ctx.spawnEnemy(1, 640, 360 + ((i % 10) - 5) * 14);
        },
        step(ctx, P) {
            keepAlive(ctx.engine);
            holdAllAt(ctx.engine.enemies, 640, 360, 14);
        },
        post(ctx, P) {
            respawnTo(ctx, P.enemies, 1, 640, 360, 14);
        },
    },
    {
        id: 'selected-glow', name: 'Selection glow · 24 darts (1 selected)', group: 'Stress',
        desc: '24 darts with one selected — measures the new white blur/ColorMatrix glow filter.',
        sim: false, params: { count: 24 },
        paramDefs: [{ key: 'count', label: 'Towers', min: 1, max: 200, step: 1 }],
        setup(ctx, P) {
            const towers = [];
            for (const [x, y] of grid(P.count, 640, 360, 8, 80)) towers.push(ctx.placeTower('dart', x, y));
            ctx.engine.selectedPlacedTower = towers[0];
        },
        step: null, post: null,
    },
];

export const SCENARIO_GROUPS = ['Baseline', 'Primary', 'Military', 'Magic', 'Enemies', 'Diagnostic', 'Stress'];
