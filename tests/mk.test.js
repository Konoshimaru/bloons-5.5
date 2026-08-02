import { describe, it, expect } from 'vitest';
import MKData from '../js/monkeyKnowledgeData.js';
import { MKEffects } from '../js/monkeyKnowledgeEffects.js';

describe('Monkey Knowledge System Integrity', () => {
  // 1. Gather all valid perk IDs from the data file
  const allPerks = [
    ...MKData.getPrimaryTree(),
    ...MKData.getMilitaryTree(),
    ...MKData.getMagicTree(),
    ...MKData.getSupportTree(),
    ...MKData.getHeroesTree()
  ];

  // Ignore 'core' nodes as they just unlock the tree, they don't have effects
  const perkIds = allPerks.map(p => p.id).filter(id => id !== 'core');

  // 2. Gather all IDs that actually have effects implemented
  const effectIds = new Set();
  for (const key in MKEffects) {
    const arr = MKEffects[key];
    if (Array.isArray(arr)) {
      arr.forEach(eff => effectIds.add(eff.id));
    }
  }

  it('should have an effect implemented for every declared perk', () => {
    const missingEffects = [];
    
    for (const id of perkIds) {
      if (!effectIds.has(id)) {
        missingEffects.push(id);
      }
    }

    // This will print exactly which perks are missing effects if it fails
    expect(missingEffects).toEqual([]);
  });
});