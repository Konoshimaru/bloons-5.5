// @vitest-environment jsdom
// Loads EVERY game module in a DOM environment. Catches import-order / circular-import
// regressions (e.g. a module using GameEngine at top level before it is populated).
import { it, expect } from 'vitest';

const loaders = import.meta.glob('../js/**/*.js');
// Files used as <script type="module"> entry points of an HTML page (main game, editors...) run
// page-specific DOM code on import, so they are not "game modules": exclude them automatically.
const pages = import.meta.glob('../*.html', { query: '?raw', import: 'default', eager: true });
const entryPoints = new Set(
  Object.values(pages).flatMap((html) => [...html.matchAll(/<script[^>]*type="module"[^>]*src="\/?([^"]+)"/g)].map((m) => m[1]))
);

it('attaches focused production subsystem methods to their owning classes and objects', async () => {
  const [{ Projectile }, { Tower }, { UI }, { KnightEnemy }] = await Promise.all([
    import('../js/projectile.js'),
    import('../js/tower.js'),
    import('../js/ui.js'),
    import('../js/bosses/knight.js')
  ]);

  expect(Projectile.prototype._checkCollisions).toBeTypeOf('function');
  expect(Projectile.prototype._handleExplosiveHit).toBeTypeOf('function');
  expect(Tower.prototype.canUpgrade).toBeTypeOf('function');
  expect(Tower.prototype.activateAbility).toBeTypeOf('function');
  expect(UI.refreshSelectedTower).toBeTypeOf('function');
  expect(UI._updateUpgradeCards).toBeTypeOf('function');
  expect(KnightEnemy.prototype._startSwordThrow).toBeTypeOf('function');
  expect(KnightEnemy.prototype._updateState).toBeTypeOf('function');
});

it('every game module loads', async () => {
  const entries = Object.entries(loaders).filter(([f]) =>
    !f.includes('/backups/') && !f.includes('/js/tests/') &&
    !entryPoints.has(f.replace('../', '')));
  const failures = [];
  for (const [f, load] of entries) {
    try { await load(); } catch (e) { failures.push(f + ': ' + String(e.message).split('\n')[0]); }
  }
  expect(entries.length).toBeGreaterThan(100);
  expect(failures).toEqual([]);
}, 60000);
