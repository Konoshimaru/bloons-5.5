import { describe, it, expect, vi, beforeEach } from 'vitest';

const data = vi.hoisted(() => ({
  playerLevel: 1,
  claimedLevels: [],
  unlockedTowers: ['dart', 'quincy'],
  monkeyMoney: 0,
  knowledgePoints: 0,
  unlocks: {}
}));

vi.mock('../js/engine.js', () => ({
  GameEngine: { gameState: 'menu', waveManager: { currentWave: 1 }, config: { data: {} } }
}));

vi.mock('../js/ui.js', () => ({ UI: { updateMetaStats: vi.fn() } }));
vi.mock('../js/dragManager.js', () => ({ updateShopPrices: vi.fn() }));
vi.mock('../js/heroes/index.js', () => ({
  HeroStats: {},
  HeroRegistry: {
    gwendolin: { stats: { name: 'Gwendolin' } },
    churchill: { stats: { name: 'Captain Churchill' } }
  }
}));

vi.mock('../js/towers/index.js', () => {
  const mk = (name, category, opts = {}) => ({ name, category, cost: 100, ...opts });
  return {
    TowerStats: {
      dart: mk('Dart Monkey', 'Primary'),
      boomerang: mk('Boomerang Monkey', 'Primary'),
      tack: mk('Tack Shooter', 'Primary'),
      ice: mk('Ice Monkey', 'Primary'),
      glue: mk('Glue Gunner', 'Primary'),
      bomb: mk('Bomb Shooter', 'Primary'),
      desperado: mk('Desperado', 'Primary'),
      sniper: mk('Sniper Monkey', 'Military'),
      sub: mk('Monkey Sub', 'Military'),
      buccaneer: mk('Monkey Buccaneer', 'Military'),
      ace: mk('Monkey Ace', 'Military'),
      heli: mk('Heli Pilot', 'Military'),
      mortar: mk('Mortar Monkey', 'Military'),
      dartling: mk('Dartling Gunner', 'Military'),
      wizard: mk('Wizard Monkey', 'Magic'),
      super: mk('Super Monkey', 'Magic'),
      ninja: mk('Ninja Monkey', 'Magic'),
      alchemist: mk('Alchemist', 'Magic'),
      druid: mk('Druid', 'Magic'),
      skywarden: mk('Skywarden', 'Magic'),
      mermonkey: mk('Mermonkey', 'Magic'),
      farm: mk('Banana Farm', 'Support'),
      spike: mk('Spike Factory', 'Support'),
      village: mk('Monkey Village', 'Support'),
      engineer: mk('Engineer Monkey', 'Support'),
      farmer: mk('Banana Farmer', 'Support', { unlockKey: 'farmer' }),
      beast: mk('Beast Handler', 'Support')
    },
    TOWER_CATEGORIES: {
      dart: 'Primary', boomerang: 'Primary', tack: 'Primary', ice: 'Primary',
      glue: 'Primary', bomb: 'Primary', desperado: 'Primary',
      sniper: 'Military', sub: 'Military', buccaneer: 'Military', ace: 'Military',
      heli: 'Military', mortar: 'Military', dartling: 'Military',
      wizard: 'Magic', super: 'Magic', ninja: 'Magic', alchemist: 'Magic',
      druid: 'Magic', skywarden: 'Magic', mermonkey: 'Magic',
      farm: 'Support', spike: 'Support', village: 'Support',
      engineer: 'Support', farmer: 'Support', beast: 'Support'
    }
  };
});

const configMock = vi.hoisted(() => ({
  Config: {
    data: null,
    save: vi.fn()
  }
}));

vi.mock('../js/config.js', () => {
  configMock.Config.data = data;
  return configMock;
});

import { LevelManager } from '../js/levelManager.js';

function claimAllLevels() {
  for (let l = 2; l <= data.playerLevel; l++) data.claimedLevels.push(l);
}

describe('LevelManager reconcile', () => {
  beforeEach(() => {
    data.playerLevel = 1;
    data.claimedLevels = [];
    data.unlockedTowers = ['dart', 'quincy'];
    data.monkeyMoney = 0;
    data.knowledgePoints = 0;
    data.unlocks = {};
  });

  it('unlocks towers that could never have been picked once the player passes a category final level', () => {
    data.playerLevel = 56;
    claimAllLevels();
    // All levels claimed, but Ninja and Spike were never picked.
    LevelManager.reconcileLevel();

    expect(data.unlockedTowers).toContain('ninja');
    expect(data.unlockedTowers).toContain('spike');
  });

  it('never grants Gift Box towers or money-gated towers via reconcile', () => {
    data.playerLevel = 56;
    claimAllLevels();
    LevelManager.reconcileLevel();

    expect(data.unlockedTowers).not.toContain('mermonkey');
    expect(data.unlockedTowers).not.toContain('beast');
    expect(data.unlockedTowers).not.toContain('farmer');
  });

  it('grants every pickable tower regardless of player level (no per-level gating)', () => {
    data.playerLevel = 3;
    claimAllLevels();
    LevelManager.reconcileLevel();

    expect(data.unlockedTowers).toContain('boomerang'); // Primary
    expect(data.unlockedTowers).toContain('sniper'); // Military
    expect(data.unlockedTowers).toContain('ninja'); // Magic
    expect(data.unlockedTowers).toContain('spike'); // Support
  });

  it('grants monkey money, gift box and knowledge per level, with towers granted first', () => {
    data.playerLevel = 34;
    data.claimedLevels = [];
    LevelManager.reconcileLevel();

    // Money levels: 13, 18, 25, 27, 29 (+50 each) and 33 (+200)
    expect(data.monkeyMoney).toBe(450);
    // Knowledge levels: 30, 31, 32, 34
    expect(data.knowledgePoints).toBe(4);
    // Gift Box at level 30
    expect(data.unlockedTowers).toContain('desperado');
    expect(data.unlockedTowers).toContain('mermonkey');
    // Category batch still grants pickable towers
    expect(data.unlockedTowers).toContain('ninja');
    expect(data.unlockedTowers).toContain('spike');
    // Farmer still cash-gated
    expect(data.unlockedTowers).not.toContain('farmer');
    expect(data.claimedLevels).toContain(34);
  });

  it('unclaimed category levels still end up fully granted', () => {
    data.playerLevel = 10;
    data.claimedLevels = [2, 3, 4, 5, 6]; // Primary claimed, Military 7-12 unclaimed
    LevelManager.reconcileLevel();

    expect(data.unlockedTowers).toContain('sniper');
    expect(data.unlockedTowers).toContain('ace');
  });

  it('unlocks heroes by name on their levels (hero popup no-ops in node)', () => {
    data.playerLevel = 14; // unlocks "Gwendolin"
    data.claimedLevels = [];
    LevelManager.reconcileLevel();

    expect(data.unlockedTowers).toContain('gwendolin');
    expect(data.claimedLevels).toContain(14);
  });
});