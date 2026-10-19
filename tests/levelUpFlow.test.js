// @vitest-environment jsdom
// Integration tests of the REAL level-up flow (real Config, real level data, real DOM).
// The older levelManager.test.js only covers reconcileLevel(), which is why rewards that were
// granted but never saved / shown went unnoticed.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ui = vi.hoisted(() => ({ UI: { updateMetaStats: vi.fn() } }));
vi.mock('../js/ui.js', () => ui);
vi.mock('../js/dragManager.js', () => ({ updateShopPrices: vi.fn() }));

import { GameEngine } from '../js/engineRef.js';
import { Config } from '../js/config.js';
import { LevelManager, parseRewards } from '../js/levelManager.js';
import { LevelProgression } from '../js/levelData.js';

const saved = () => {
  for (let i = 0; i < localStorage.length; i++) {
    const v = localStorage.getItem(localStorage.key(i));
    if (v && v.includes('"playerLevel"')) return JSON.parse(v);
  }
  return null;
};
const xpFor = (level) => LevelProgression[level].xpFromPrev;
const pickFirstCard = () => {
  document.querySelector('#level-up-select-menu .level-up-card').click();
  document.querySelector('#level-up-confirm').click();
};

function startAt(level, { claimedUpTo = level, towers = ['dart', 'quincy'], state = 'menu' } = {}) {
  document.body.innerHTML = '<div id="game-container"></div>';
  localStorage.clear();
  Config.data.playerLevel = level;
  Config.data.playerXP = 0;
  Config.data.playerXPToNext = LevelProgression[level + 1].xpFromPrev;
  Config.data.claimedLevels = [];
  for (let l = 2; l <= claimedUpTo; l++) Config.data.claimedLevels.push(l);
  Config.data.unlockedTowers = [...towers];
  Config.data.knowledgePoints = 10;
  Config.data.monkeyMoney = 100;
  GameEngine.gameState = state;
  LevelManager._pendingLevels = [];
  LevelManager._levelUpActive = false;
  LevelManager._pausedForLevelUp = false;
  LevelManager._shownInteractive = 0;
  ui.UI.updateMetaStats.mockClear();
}

describe('parseRewards', () => {
  it('reads any money amount and the knowledge multiplier', () => {
    expect(parseRewards('Monkey Money 50')).toMatchObject({ monkeyMoney: 50, knowledge: 0, giftBox: false });
    expect(parseRewards('Monkey Money 200, Ezili')).toMatchObject({ monkeyMoney: 200 });
    expect(parseRewards('Monkey Knowledge Point ×1')).toMatchObject({ knowledge: 1 });
    expect(parseRewards('Monkey Knowledge Point ×3, Map Editor')).toMatchObject({ knowledge: 3 });
    expect(parseRewards('Monkey Knowledge Point ×1, Monkey Knowledge, Contested Territory, Gift Box (Desperado)'))
      .toMatchObject({ knowledge: 1, giftBox: true });
    expect(parseRewards('Primary tower (except Desperado)')).toMatchObject({ monkeyMoney: 0, knowledge: 0, giftBox: false });
  });
  it('every level in the game data pays what its text says', () => {
    let mk = 0, mm = 0;
    for (const d of Object.values(LevelProgression)) { const r = parseRewards(d.unlocks || ''); mk += r.knowledge; mm += r.monkeyMoney; }
    expect(mk).toBe(123);
    expect(mm).toBe(650);
  });
});

describe('rewards are granted, SAVED and SHOWN (regression: save + HUD refresh ran before the grant)', () => {
  beforeEach(() => startAt(30));

  it('a currency-only level is saved with its reward and marked claimed', () => {
    LevelManager.addXP(xpFor(31));                       // level 31: Monkey Knowledge Point ×1
    expect(Config.data.knowledgePoints).toBe(11);
    const s = saved();
    expect(s.knowledgePoints).toBe(11);
    expect(s.claimedLevels).toContain(31);
    expect(s.playerLevel).toBe(31);
  });

  it('the HUD is refreshed AFTER the reward, so it shows the new value', () => {
    const seen = [];
    ui.UI.updateMetaStats.mockImplementation(() => seen.push(Config.data.knowledgePoints));
    LevelManager.addXP(xpFor(31));
    expect(seen[seen.length - 1]).toBe(11);
  });

  it('announces silent rewards with a toast instead of granting them invisibly', () => {
    LevelManager.addXP(xpFor(31));
    const toast = document.querySelector('#levelup-toasts .levelup-toast');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('Level 31');
    expect(toast.textContent).toContain('+1 Monkey Knowledge Point');
  });

  it('several currency-only levels at once give ONE summarised toast', () => {
    LevelManager.addXP(xpFor(31) + xpFor(32) + xpFor(33));
    const toasts = document.querySelectorAll('#levelup-toasts .levelup-toast');
    expect(toasts.length).toBe(1);
    expect(toasts[0].textContent).toContain('Levels 31–33');
    expect(Config.data.claimedLevels).toEqual(expect.arrayContaining([31, 32, 33]));
  });

  it('an already-claimed level is never paid twice', () => {
    LevelManager.addXP(xpFor(31));
    Config.data.playerLevel = 30; Config.data.playerXP = 0; Config.data.playerXPToNext = xpFor(31);
    LevelManager.addXP(xpFor(31));                       // reaches level 31 again
    expect(Config.data.knowledgePoints).toBe(11);
  });
});

describe('tower pick screen', () => {
  beforeEach(() => startAt(1, { state: 'playing' }));

  it('pauses the run, needs a selection + confirm, then unlocks, saves and resumes', () => {
    LevelManager.addXP(xpFor(2));                        // level 2: Primary tower pick
    expect(GameEngine.gameState).toBe('levelup');
    expect(document.querySelector('#level-up-select-menu h2').textContent).toContain('Level 2');

    const confirm = document.querySelector('#level-up-confirm');
    expect(confirm.disabled).toBe(true);                 // no accidental unlock
    confirm.click();
    expect(document.querySelector('#level-up-select-menu')).not.toBeNull();

    const card = document.querySelector('.level-up-card');
    const type = card.dataset.tower;
    card.click();
    expect(confirm.disabled).toBe(false);
    confirm.click();

    expect(Config.data.unlockedTowers).toContain(type);
    expect(Config.data.claimedLevels).toContain(2);
    expect(saved().unlockedTowers).toContain(type);
    expect(document.querySelector('#level-up-select-menu')).toBeNull();
    expect(GameEngine.gameState).toBe('playing');
  });

  it('never offers an excluded (Gift Box) tower', () => {
    LevelManager.addXP(xpFor(2));
    const offered = [...document.querySelectorAll('.level-up-card')].map(c => c.dataset.tower);
    expect(offered).not.toContain('desperado');
    expect(offered).not.toContain('dart');               // already unlocked
  });

  it('shows a progress counter and walks through several levels in order', () => {
    LevelManager.addXP(LevelProgression[8].totalXp);     // levels 2..8 at once: 5 Primary + 2 Military picks
    expect(document.querySelector('#level-up-select-menu').textContent).toContain('Level-up 1 of 7');
    let screens = 0;
    while (document.querySelector('#level-up-select-menu')) { pickFirstCard(); if (++screens > 20) break; }
    expect(screens).toBe(7);
    expect(Config.data.claimedLevels).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(Config.data.unlockedTowers.length).toBe(2 + 7);
    expect(GameEngine.gameState).toBe('playing');
    expect(document.querySelectorAll('.overlay').length).toBe(0);   // nothing left stacked
  });

  it('double-click on a card unlocks it directly', () => {
    LevelManager.addXP(xpFor(2));
    const card = document.querySelector('.level-up-card');
    const type = card.dataset.tower;
    card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(Config.data.unlockedTowers).toContain(type);
  });

  it('lists the other rewards of the level on the screen (hero + pick on level 15)', () => {
    startAt(14);
    LevelManager.addXP(xpFor(15));                       // Magic tower + Captain Churchill, Benjamin, Pat Fusty
    const text = document.querySelector('#level-up-select-menu').textContent;
    expect(text).toContain('Captain Churchill');
    pickFirstCard();
    expect(Config.data.unlockedTowers).toEqual(expect.arrayContaining(['churchill', 'benjamin', 'pat_fusty']));
    expect(document.querySelector('#hero-unlocked-popup')).toBeNull();   // no second popup stacked on top
  });

  it('when nothing is left to pick, the +1 Knowledge bonus is paid once, on Continue', () => {
    startAt(1, { towers: ['dart', 'quincy', 'boomerang', 'tack', 'ice', 'glue', 'bomb'] });   // all Primary but Desperado
    LevelManager.addXP(xpFor(2));
    expect(Config.data.knowledgePoints).toBe(10);        // not granted just by opening the screen
    document.querySelector('#level-up-confirm').click();
    expect(Config.data.knowledgePoints).toBe(11);
    expect(Config.data.claimedLevels).toContain(2);
  });
});

describe('hero unlock levels', () => {
  it('level 14 shows the hero popup, continues the queue on close, and claims the level', () => {
    startAt(13);
    LevelManager.addXP(xpFor(14) + xpFor(15));           // Gwendolin, then the Magic pick
    expect(document.querySelector('#hero-unlocked-popup')).not.toBeNull();
    expect(document.querySelector('#level-up-select-menu')).toBeNull();        // not at the same time
    expect(Config.data.unlockedTowers).toContain('gwendolin');
    document.querySelector('#hero-unlocked-close').click();
    expect(document.querySelector('#hero-unlocked-popup')).toBeNull();
    expect(document.querySelector('#level-up-select-menu')).not.toBeNull();    // next level now
    expect(Config.data.claimedLevels).toContain(14);
  });
});

describe('resumeUnclaimed (rewards lost by older versions / closing the game mid-screen)', () => {
  it('pays a reached-but-unclaimed currency level exactly once and saves it', () => {
    startAt(31, { claimedUpTo: 30 });
    expect(LevelManager.resumeUnclaimed()).toBe(true);
    expect(Config.data.knowledgePoints).toBe(11);
    expect(saved().claimedLevels).toContain(31);
    expect(LevelManager.resumeUnclaimed()).toBe(false);
    expect(Config.data.knowledgePoints).toBe(11);
  });
  it('re-opens the pick screen for an unclaimed category level', () => {
    startAt(3, { claimedUpTo: 2 });
    LevelManager.resumeUnclaimed();
    expect(document.querySelector('#level-up-select-menu h2').textContent).toContain('Level 3');
  });
  it('does nothing when everything is claimed', () => {
    startAt(31);
    expect(LevelManager.resumeUnclaimed()).toBe(false);
  });
});
