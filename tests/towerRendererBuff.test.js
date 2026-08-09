import { describe, it, expect, vi } from 'vitest';

vi.mock('../js/towers/index.js', () => ({ Upgrades: {}, TowerStats: {}, TowerRegistry: {} }));
vi.mock('../js/heroes/index.js', () => ({ HeroStats: {}, HeroRegistry: {} }));
vi.mock('../js/engine.js', () => ({ GameEngine: { selectedPlacedTower: null, config: { data: {} } } }));
vi.mock('../js/registry.js', () => ({ getBehavior: () => null }));
vi.mock('../js/mobile.js', () => ({ MobileManager: { spriteScale: 1, isActive: false } }));

function makeStub2DContext() {
  const methods = [
    'translate', 'scale', 'rotate', 'arc', 'ellipse', 'beginPath', 'moveTo', 'lineTo',
    'closePath', 'fill', 'stroke', 'fillRect', 'strokeRect', 'clearRect', 'save',
    'restore', 'bezierCurveTo', 'quadraticCurveTo', 'fillText', 'strokeText',
    'createRadialGradient', 'createLinearGradient', 'drawImage', 'setTransform',
    'clip', 'rect'
  ];
  const target = { _drawImageCalls: [] };
  return new Proxy(target, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (methods.includes(prop)) {
        return (...args) => {
          if (prop === 'drawImage') target._drawImageCalls.push(args);
          if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
            return { addColorStop: () => {} };
          }
        };
      }
      return undefined;
    },
    set(target, prop, value) { target[prop] = value; return true; }
  });
}

// Minimal DOM stub for pre-rendered icon canvases
const iconCanvases = [];
globalThis.document = {
  createElement: () => {
    const c = { width: 0, height: 0, getContext: () => makeStub2DContext() };
    iconCanvases.push(c);
    return c;
  }
};

import TowerRenderer from '../js/towerRenderer.js';

function makeTower() {
  const t = {
    x: 400,
    y: 300,
    hitRadius: 16,
    stats: { scale: 1 },
    activeBuffs: [],
    bananas: [],
    hitscans: [],
    type: 'dart'
  };
  t._getBuffIconCanvas = TowerRenderer._getBuffIconCanvas;
  return t;
}

describe('TowerRenderer buff icon rendering', () => {
  it('draws one icon per active buff via drawImage', () => {
    const t = makeTower();
    t.activeBuffs = [
      { id: 'village', name: 'Village Buff', duration: 0.5, stacks: 1, data: { type: 'village' } },
      { id: 'jd', name: 'Jungle Drums', duration: 0.5, stacks: 1, data: { type: 'jd' } },
      { id: 'ptr', name: 'Primary Training', duration: 0.5, stacks: 1, data: { type: 'ptr' } },
      { id: 'pm', name: 'Primary Mentoring', duration: 0.5, stacks: 1, data: { type: 'pm' } },
      { id: 'pe', name: 'Primary Expertise', duration: 0.5, stacks: 1, data: { type: 'pe' } },
      { id: 'radar', name: 'Radar Scanner', duration: 0.5, stacks: 1, data: { type: 'radar' } }
    ];
    const ctx = makeStub2DContext();

    expect(() => TowerRenderer._drawBuffs.call(t, ctx)).not.toThrow();
    expect(ctx._drawImageCalls.length).toBe(6);
  });

  it('renders an icon canvas for every known village buff type without throwing', () => {
    const types = ['village', 'jd', 'ptr', 'pm', 'pe', 'cta', 'radar', 'mib', 'alch', 'alch_dip', 'oc'];
    const ctx = makeStub2DContext();
    for (const type of types) {
      expect(() => TowerRenderer._getBuffIconCanvas(type)).not.toThrow();
    }
    // First call should have created and cached canvases; second call returns from cache
    expect(TowerRenderer._getBuffIconCanvas('village')).toBe(TowerRenderer._getBuffIconCanvas('village'));
  });

  it('skips buff drawing entirely when there are no active buffs', () => {
    const t = makeTower();
    const ctx = makeStub2DContext();
    TowerRenderer._drawBuffs.call(t, ctx);
    expect(ctx._drawImageCalls.length).toBe(0);
  });
});
