// tools/gen-manifest.mjs
// Scans public/sprites/ and writes public/sprites/manifest.json so the
// sprite editor can auto-load everything from the server (vite) instead of
// requiring a manual folder pick. Run: node tools/gen-manifest.mjs
import fs from 'node:fs';
import path from 'node:path';

const SPRITES_DIR = new URL('../public/sprites/', import.meta.url).pathname
    .replace(/^\/([A-Za-z]:)/, '$1'); // windows: strip leading slash
const OUT = path.join(SPRITES_DIR, 'manifest.json');

// Display names + categories mirror js/towers/index.js TOWER_CATEGORIES and
// the hero file names. Kept local so the generator has no game imports.
const TOWER_NAMES = {
    dart: 'Dart Monkey', boomerang: 'Boomerang Monkey', bomb: 'Bomb Shooter',
    tack: 'Tack Shooter', ice: 'Ice Monkey', glue: 'Glue Gunner',
    ninja: 'Ninja Monkey', sniper: 'Sniper Monkey', sub: 'Monkey Sub',
    buccaneer: 'Monkey Buccaneer', ace: 'Monkey Ace', heli: 'Heli Pilot',
    mortar: 'Mortar Monkey', dartling: 'Dartling Gunner', super: 'Super Monkey',
    wizard: 'Wizard Monkey', alchemist: 'Alchemist', druid: 'Druid',
    farm: 'Banana Farm', spike: 'Spike Factory', village: 'Monkey Village',
    engineer: 'Engineer Monkey', beast: 'Beast Handler', farmer: 'Banana Farmer',
    mermonkey: 'Mermonkey', desperado: 'Desperado', skywarden: 'Skywarden',
};

const HERO_IDS = new Set([
    'adora', 'benjamin', 'brickell', 'churchill', 'corvus', 'dan_d_monke',
    'etienne', 'ezili', 'geraldo', 'geto', 'gojo', 'gwendolin', 'obyn',
    'pat_fusty', 'psi', 'quincy', 'rosalia', 'sauda', 'silas', 'striker_jones',
]);

const BASE_RE = /^([a-z0-9_]+)_base\.png$/;
const FULL_RE = /^([a-z0-9_]+)_attack_full_(\d+)\.png$/;

// type -> { base: url, frames: {0: url}, upgrades: { type_pX_tY: {...} } }
const towers = {};

function ensureType(type) {
    if (!towers[type]) towers[type] = { base: null, frames: {}, upgrades: {} };
    return towers[type];
}

function assignTo(towerType, frameSet, url, frame) {
    if (frameSet.frames[frame] === undefined) frameSet.frames[frame] = url;
}

// --- Scan towers/heroes (both live under sprites/towers) ---
const towersDir = path.join(SPRITES_DIR, 'towers');
for (const file of fs.readdirSync(towersDir)) {
    if (!file.endsWith('.png') || file.endsWith('.bak')) continue;
    const rel = `sprites/towers/${file}`;
    const base = file.match(BASE_RE);
    if (base) {
        const type = base[1];
        const upgrade = type.match(/^(.*)_p(\d+)_t(\d+)$/);
        if (upgrade) {
            const parent = upgrade[1];
            const upKey = type;
            const t = ensureType(parent);
            if (!t.upgrades[upKey]) t.upgrades[upKey] = { base: null, frames: {} };
            t.upgrades[upKey].base = rel;
        } else {
            ensureType(type).base = rel;
        }
        continue;
    }
    const full = file.match(FULL_RE);
    if (full) {
        const type = full[1];
        const frame = parseInt(full[2], 10);
        const upgrade = type.match(/^(.*)_p(\d+)_t(\d+)$/);
        if (upgrade) {
            const t = ensureType(upgrade[1]);
            if (!t.upgrades[type]) t.upgrades[type] = { base: null, frames: {} };
            assignTo(type, t.upgrades[type], rel, frame);
        } else {
            assignTo(type, ensureType(type), rel, frame);
        }
    }
}

// --- Scan sheets: sheets/<name>/<name>.json + .png pairs ---
const sheets = [];
const sheetsDir = path.join(SPRITES_DIR, 'sheets');
if (fs.existsSync(sheetsDir)) {
    for (const dir of fs.readdirSync(sheetsDir)) {
        const sub = path.join(sheetsDir, dir);
        if (!fs.statSync(sub).isDirectory()) continue;
        const json = path.join(sub, `${dir}.json`);
        const png = path.join(sub, `${dir}.png`);
        if (fs.existsSync(json) && fs.existsSync(png)) {
            sheets.push({
                id: dir,
                json: `sprites/sheets/${dir}/${dir}.json`,
                png: `sprites/sheets/${dir}/${dir}.png`,
            });
        }
    }
}

// --- Emit manifest (order base towers alphabetically, heroes last) ---
const ordered = {};
const towerKeys = Object.keys(towers).sort();
for (const type of towerKeys) {
    const isHero = HERO_IDS.has(type);
    const entry = towers[type];
    ordered[type] = {
        name: isHero ? null : (TOWER_NAMES[type] || type),
        hero: isHero,
        base: entry.base,
        frames: Object.keys(entry.frames).sort((a, b) => a - b)
            .map(f => ({ frame: parseInt(f, 10), url: entry.frames[f] })),
        upgrades: Object.fromEntries(
            Object.keys(entry.upgrades).sort().map(k => [k, {
                base: entry.upgrades[k].base,
                frames: Object.keys(entry.upgrades[k].frames).sort((a, b) => a - b)
                    .map(f => ({ frame: parseInt(f, 10), url: entry.upgrades[k].frames[f] })),
            }])
        ),
    };
}

const manifest = {
    generated: new Date().toISOString(),
    towers: ordered,
    sheets,
};

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2));
const count = Object.keys(ordered).length;
console.log(`Wrote ${OUT}: ${count} tower/hero types, ${sheets.length} sheets`);