// @vitest-environment jsdom
// Loads EVERY game module in a DOM environment. Catches import-order / circular-import
// regressions (e.g. a module using GameEngine at top level before it is populated).
import { it, expect } from 'vitest';

const loaders = import.meta.glob('../js/**/*.js');

it('every game module loads', async () => {
  const entries = Object.entries(loaders).filter(([f]) =>
    !f.includes('/backups/') && !f.includes('/js/tests/') && !f.endsWith('/main.js'));
  const failures = [];
  for (const [f, load] of entries) {
    try { await load(); } catch (e) { failures.push(f + ': ' + String(e.message).split('\n')[0]); }
  }
  expect(entries.length).toBeGreaterThan(100);
  expect(failures).toEqual([]);
}, 60000);
