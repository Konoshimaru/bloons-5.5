// Data-driven fidelity tests against official BTD6 values (Bloons wiki).
// Unlike damage.test.js these use the REAL data modules, so they fail when the data drifts.
import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { G, addCash } = vi.hoisted(() => {
  const addCash = vi.fn();
  return { addCash, G: { difficulty: null, waveManager: { currentWave: 1 }, addCash, addPopCash: vi.fn(), addSessionXp: () => {}, spawnPopEffect: () => {}, enemies: [], explosions: [], enemyGrid: { query: () => [] } } };
});
vi.mock('../js/engineRef.js', () => ({ GameEngine: G }));
vi.mock('../js/audio.js', () => ({ AudioEngine: { playSfx: () => {} } }));
vi.mock('../js/assets.js', () => ({ default: { get: () => null } }));
vi.mock('../js/config.js', () => ({ Config: { data: {} }, RANGE_SCALE: 3.0 }));

import { WavesData } from '../js/waves.js';
import { EnemyTypes } from '../js/data.js';
import { Enemy } from '../js/enemy.js';
import { roundSpeedRamp, statusDurationFactor, cashMultForRound, treeLayers, leakLives, singleChildSplit } from '../js/btd6Rules.js';
import { canBeAoeTarget, isHiddenFrom, dealDamage } from '../js/combat.js';
import { BASE_SPEED } from '../js/constants.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const TIER = { Red:1, Blue:2, Green:3, Yellow:4, Pink:5, Black:6, White:7, Lead:8, Zebra:9, Purple:10, Rainbow:11, Ceramic:12, MOAB:13, BFB:14, ZOMG:15, DDT:16, BAD:17 };
const re = /((?:(?:Camo|Regrow|Fortified) )*)(Red|Blue|Green|Yellow|Pink|Black|White|Lead|Zebra|Purple|Rainbow|Ceramic|MOAB|BFB|ZOMG|DDT|BAD)×(\d+)/g;

function loadWiki() {
  const out = {};
  for (const line of fs.readFileSync(path.join(dir, 'fixtures/btd6-rounds.txt'), 'utf8').trim().split('\n')) {
    const [n, dur, groups] = line.split('|');
    const c = {};
    for (const m of groups.matchAll(re)) {
      const t = TIER[m[2]];
      const k = `${t}|${t === 16 ? 1 : +m[1].includes('Camo')}|${+m[1].includes('Regrow')}|${+m[1].includes('Fortified')}`; // DDT is always camo
      c[k] = (c[k] || 0) + +m[3];
    }
    out[+n] = { dur: +dur, c };
  }
  return out;
}
function repoRound(i) {
  const c = {}; let end = 0;
  for (const g of WavesData[i - 1].groups) {
    const t = g.t; const k = `${t}|${t === 16 ? 1 : +!!g.camo}|${+!!g.regen}|${+!!g.fort}`;
    c[k] = (c[k] || 0) + g.c; end = Math.max(end, g.e);
  }
  return { dur: end, c };
}

describe('rounds 1-140 match the official list', () => {
  const wiki = loadWiki();
  it('has 140 rounds', () => expect(WavesData.length).toBe(140));
  it('composition (type / camo / regrow / fortified counts) matches for every round', () => {
    const bad = [];
    for (let r = 1; r <= 140; r++) if (JSON.stringify(Object.entries(wiki[r].c).sort()) !== JSON.stringify(Object.entries(repoRound(r).c).sort())) bad.push(r);
    expect(bad).toEqual([]);
  });
  it('duration matches for every round (±0.06s)', () => {
    const bad = [];
    for (let r = 1; r <= 140; r++) if (Math.abs(wiki[r].dur - repoRound(r).dur) > 0.06) bad.push([r, wiki[r].dur, repoRound(r).dur]);
    expect(bad).toEqual([]);
  });
});

describe('bloon data', () => {
  it('rbe = maxHp + sum(child rbe) for every tier (layer structure invariant)', () => {
    for (const [k, d] of Object.entries(EnemyTypes)) {
      if (d.splitsInto) {
        const kids = d.splitsInto.reduce((s, c) => s + c.count * EnemyTypes[c.tier].rbe, 0);
        expect(d.rbe, `tier ${k}`).toBe(d.maxHp + kids);
      } else if (d.nextTier) expect(d.rbe, `tier ${k}`).toBe(1 + EnemyTypes[d.nextTier].rbe);
    }
  });
  it('speeds follow the BTD6 ratios (Red = 1.0)', () => {
    const ratio = { 1:1, 2:1.4, 3:1.8, 4:3.2, 5:3.5, 6:1.8, 7:2.0, 8:1.0, 9:1.8, 10:3.0, 11:2.2, 12:2.5, 13:1.0, 14:0.25, 15:0.18, 16:2.64, 17:0.18 };
    for (const [t, r] of Object.entries(ratio)) expect(EnemyTypes[t].speed / BASE_SPEED, `tier ${t}`).toBeCloseTo(r, 5);
  });
  it('leak lives: RBE up to round 80, Super Ceramic rule from round 81', () => {
    const L = (t, o) => leakLives(t, o);
    expect(L(12, {})).toBe(104); expect(L(13, {})).toBe(616); expect(L(14, {})).toBe(3164);
    expect(L(15, {})).toBe(16656); expect(L(17, {})).toBe(55760);
    expect(L(8, { fortified: true })).toBe(26); expect(L(12, { fortified: true })).toBe(114);
    expect(L(13, { fortified: true })).toBe(856);
    expect(L(13, { round: 90 })).toBe(460); expect(L(13, { round: 90, fortified: true })).toBe(700);
    expect(L(16, { round: 90 })).toBe(660); expect(L(16, { round: 90, fortified: true })).toBe(1100);
  });
});

describe('late-game rules', () => {
  it('speed ramp (rounds 81+) matches the wiki jumps', () => {
    expect(roundSpeedRamp(80)).toBe(1); expect(roundSpeedRamp(100)).toBeCloseTo(1.4);
    expect(roundSpeedRamp(101)).toBeCloseTo(1.6); expect(roundSpeedRamp(151)).toBeCloseTo(3.0);
    expect(roundSpeedRamp(201)).toBeCloseTo(4.5); expect(roundSpeedRamp(252)).toBeCloseTo(6.0);
  });
  it('status duration reduction only starts on round 150', () => {
    expect(statusDurationFactor(100)).toBe(1); expect(statusDurationFactor(149)).toBe(1);
    expect(statusDurationFactor(150)).toBe(0.9); expect(statusDurationFactor(350)).toBe(0.5);
  });
});

describe('cash per pop', () => {
  // official "Base cash" column, rounds 1-80 (already includes the per-round pop modifier)
  const wikiCash = {1:20,2:35,3:35,4:71,5:59,6:57,7:75,8:92,9:90,10:204,11:78,12:80,13:169,14:145,15:151,16:152,17:48,18:240,19:141,20:66,21:230,22:176,23:154,24:43,25:210,26:207,27:535,28:138,29:260,30:207,31:406,32:495,33:72,34:778,35:1015,36:760,37:1202,38:1139,39:1620,40:381,41:2040,42:517,43:1135,44:1150,45:2277,46:570,47:1490,48:2695,49:4609,50:2866,51:947.5,52:1443.5,53:771.5,54:2043.5,55:2328,56:1130.5,57:1702,58:2140,59:2000,60:762.5,61:1071,62:1224.4,63:2663,64:685.8,65:2906.6,66:838.2,67:856.6,68:609.8,69:1222,70:2448.8,71:1332,72:1332,73:1219.6,74:2870,75:2492.4,76:1140,77:2363.2,78:4684,79:6530,80:1220.2};
  it('$1 per layer x round modifier reproduces the official base cash for rounds 1-80', () => {
    const bad = [];
    for (let r = 1; r <= 80; r++) {
      let sum = 0;
      for (const g of WavesData[r - 1].groups) sum += g.c * treeLayers(g.t) * cashMultForRound(r);
      if (Math.abs(sum - wikiCash[r]) > Math.max(0.6, wikiCash[r] * 0.001)) bad.push([r, wikiCash[r], Math.round(sum * 10) / 10]);
    }
    expect(bad).toEqual([]);
  });
  it('layer counts: Red 1, Pink 5, Ceramic 95, MOAB 381, BFB 1525, ZOMG 6101', () => {
    expect([1, 5, 12, 13, 14, 15].map(treeLayers)).toEqual([1, 5, 95, 381, 1525, 6101]);
  });
  it('the real Enemy pays $1 per popped layer (a Pink hit for 5 pays 5 layers)', () => {
    G.waveManager.currentWave = 1; G.addPopCash.mockClear();
    const e = mk(5);
    e._handleStandardDamage(5, {}, {}, null);
    expect(G.addPopCash).toHaveBeenCalledWith(5);
  });
  it('late rounds pay the round modifier, with no $1 floor', () => {
    G.waveManager.currentWave = 70; G.addPopCash.mockClear();
    mk(12).giveCash(true, null);
    expect(G.addPopCash).toHaveBeenCalledWith(0.2);
  });
});

function mk(tier) {
  const e = Object.create(Enemy.prototype);
  return Object.assign(e, { tier, data: { ...EnemyTypes[tier] }, alive: true, hp: EnemyTypes[tier].maxHp, _maxHp: EnemyTypes[tier].maxHp, isFortified: false, slowFactor: 1, _updateSpriteCache() {}, _spawnIceShards() {} });
}

describe('regression: layer pop keeps the late-game speed ramp', () => {
  it('Pink -> Yellow at round 100 is Yellow speed x1.4, not base Yellow speed', () => {
    G.waveManager.currentWave = 100;
    const e = mk(5); e.data.speed = EnemyTypes[5].speed * roundSpeedRamp(100);
    e._handleStandardDamage(1, {}, {}, null);
    expect(e.tier).toBe(4);
    expect(e.data.speed).toBeCloseTo(EnemyTypes[4].speed * 1.4);
  });
});

describe('shared AoE rules (combat.js)', () => {
  const base = { alive: true, isCamo: false };
  it('skips dead, untargetable, damage/collision-immune bloons', () => {
    expect(canBeAoeTarget({ ...base, alive: false }, null)).toBe(false);
    expect(canBeAoeTarget({ ...base, untargetable: true }, null)).toBe(false);
    expect(canBeAoeTarget({ ...base, damageImmune: true }, null)).toBe(false);
    expect(canBeAoeTarget({ ...base, collisionImmune: true }, null)).toBe(false);
    expect(canBeAoeTarget(base, null)).toBe(true);
  });
  it('camo needs detection from the attack or the tower', () => {
    const camo = { ...base, isCamo: true };
    expect(canBeAoeTarget(camo, { stats: {} })).toBe(false);
    expect(canBeAoeTarget(camo, { stats: { canSeeCamo: true } })).toBe(true);
    expect(canBeAoeTarget(camo, { stats: {}, buffedCamo: true })).toBe(true);
    expect(canBeAoeTarget(camo, { stats: {} }, true)).toBe(true);
  });
});

describe('camo detection is one rule for every tower', () => {
  const camoBloon = { alive: true, isCamo: true };
  it('buffs (Village / Sub / Etienne) count, not only the tower stat', () => {
    expect(isHiddenFrom({ stats: {} }, camoBloon)).toBe(true);
    expect(isHiddenFrom({ stats: { canSeeCamo: true } }, camoBloon)).toBe(false);
    expect(isHiddenFrom({ stats: {}, buffedCamo: true }, camoBloon)).toBe(false);
    expect(isHiddenFrom({ stats: {} }, { alive: true })).toBe(false);
  });
  it('dealDamage credits the tower and its parent, ignoring NaN / -1', () => {
    const parent = { damageDealt: 0 }, tower = { damageDealt: 0, parentTower: parent };
    dealDamage({ takeDamage: () => 7 }, 1, {}, {}, tower);
    dealDamage({ takeDamage: () => -1 }, 1, {}, {}, tower);
    dealDamage({ takeDamage: () => NaN }, 1, {}, {}, tower);
    expect(tower.damageDealt).toBe(7); expect(parent.damageDealt).toBe(7);
  });
});

describe('round 81+: one child per layer (non-MOAB-class)', () => {
  it('Lead -> 1 Black, Black/White/Purple -> 1 Pink, Rainbow -> 1 Zebra, Ceramic -> 1 Rainbow', () => {
    expect(singleChildSplit(8)).toEqual([{ tier: 6, count: 1 }]);
    for (const t of [6, 7, 10]) expect(singleChildSplit(t)).toEqual([{ tier: 5, count: 1 }]);
    expect(singleChildSplit(11)).toEqual([{ tier: 9, count: 1 }]);
    expect(singleChildSplit(12)).toEqual([{ tier: 11, count: 1 }]);
  });
  it('MOAB-class bloons keep all their children (MOAB -> 4 Ceramic)', () => {
    expect(singleChildSplit(13)).toEqual(EnemyTypes[13].splitsInto);
    expect(singleChildSplit(17)).toEqual(EnemyTypes[17].splitsInto);
  });
});
