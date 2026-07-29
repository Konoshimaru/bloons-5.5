# Tower Module Interface

This document defines the implicit interface that tower modules (e.g., `towers/dart.js`) 
and hero modules (e.g., `heroes/quincy.js`) implement. 

A tower module is simply an object exported as `default` from a file in the `towers/` or `heroes/` 
directory. It is registered in `towers/index.js` (or `heroes/index.js`) and mixed into the 
`Tower` or `Hero` class prototype via `Object.assign`.

## Required Properties

### `stats: Object`
The base statistics object for the tower.
- `name` (String): Display name.
- `cost` (Number): Base cost to place the tower.
- `range` (Number): Base targeting range in game units (before `RANGE_SCALE` and `GLOBAL_SCALE`).
- `fireRate` (Number): Base attack cooldown in seconds.
- `damage` (Number): Base damage per hit.
- `pierce` (Number): Base pierce per projectile.
- `dmgType` (String): The damage type (e.g., 'sharp', 'explosion', 'energy', 'normal', 'fire').
- `projectileType` (String): The sprite key used for projectiles (e.g., 'dart', 'bomb', 'laser').
- `hitRadius` (Number): The radius used for click-selection and placement overlap checks.
- `category` (String): 'Primary', 'Military', 'Magic', or 'Support'. Used for MK and Village buffs.

### `upgrades: Object`
An object defining the upgrade tree. Keys are paths (`1`, `2`, `3`), and values are arrays of 5 upgrade objects.
- Each upgrade object typically contains:
  - `name` (String)
  - `cost` (Number)
  - `desc` (String)
  - `stat` (String, optional): The stat to modify.
  - `amount` (Number/Boolean, optional): The amount to add/multiply/set.
  - `cooldownMult` (Number, optional): Multiplies the tower's attack cooldown.
  - `extraMods` (Object, optional): Additional stats to add directly to `tower.stats`.

---

## Optional Hooks (Methods)

These methods are called by the generic engine if they exist on the module.

### `fire(tower, target, damage, dmgType, isCrit, effects, engine)`
**Called by:** `towerBehavior.js` (`_delegateFire`)
**Purpose:** Spawns the projectile(s) for the tower's standard attack.
**Arguments:**
- `tower`: The tower instance executing the attack.
- `target`: The targeted `Enemy` object (can be null for Spike Factory).
- `damage`: The final calculated damage (including buffs/crits).
- `dmgType`: The composed damage type object.
- `isCrit`: Boolean indicating if this is a critical hit.
- `effects`: Status effects to apply on hit (e.g., `{ knockback: 20 }`).
- `engine`: The `GameEngine` instance (useful for accessing `projectilePool`).
**Note:** If this method is omitted, the engine defaults to spawning a single standard projectile.

### `update(tower, dt, engine)`
**Called by:** `tower.js` (via `TowerBehavior.update`) every frame.
**Purpose:** Per-frame custom logic (e.g., Sentry spawning, Beast Handler power scaling, Farm income generation).
**Arguments:**
- `tower`: The tower instance.
- `dt`: Delta time in seconds.
- `engine`: The `GameEngine` instance.

### `updateSupport(tower, dt, engine)`
**Called by:** `simulationLoop.js` (`_updateTowers`) every frame, *before* standard `update`.
**Purpose:** Passive aura/buff logic separate from attacking. Used by Village (buffing nearby towers), Farm (generating bananas), and Ninja/Sniper (global buffs).
**Arguments:**
- `tower`: The tower instance.
- `dt`: Delta time in seconds.
- `engine`: The `GameEngine` instance.

### `draw(ctx, tower, isPreview)`
**Called by:** `renderer.js` (`_drawEntities`) every render frame.
**Purpose:** Custom rendering beyond just drawing the base/arm sprites.
**Arguments:**
- `ctx`: The Canvas 2D rendering context.
- `tower`: The tower instance.
- `isPreview`: Boolean indicating if this is drawing a placement preview (useful for hiding UI elements or dynamic effects).
**Note:** If omitted, `towerRenderer.js` handles drawing the base sprite, arm sprite, and attack animations.

### `ability(tower, engine)`
**Called by:** `engineInput.js` (`activateAbility`) when the player clicks an ability button.
**Purpose:** Executes the active ability (e.g., stunning bloons, spawning a trap, granting cash).
**Arguments:**
- `tower`: The tower instance.
- `engine`: The `GameEngine` instance.

### `postUpgrade(tower, path)`
**Called by:** `tower.js` (`_postUpgradeHook`) immediately after an upgrade is purchased and stats are applied.
**Purpose:** One-time logic triggered by specific upgrades (e.g., Beast Handler spawning a new beast, Super Monkey unlocking the Vengeful temple).
**Arguments:**
- `tower`: The tower instance.
- `path`: The upgrade path that was just upgraded (1, 2, or 3).
```
