# Tower and Hero Module Interface

This describes the current implementation. Tower and hero definitions are data/behavior objects; they are not mixed into the Tower prototype.

- Tower definitions are registered in js/towers/index.js.
- Hero definitions are registered in js/heroes/index.js.
- js/registry.js exposes getBehavior(type), which resolves a definition against those registries.
- Placed entities are instances of Tower. Hero extends Tower.
- Generic attack/update behavior lives in js/towerBehavior.js. Rendering is handled by Pixi modules under js/webgl/.

## Tower definition

A tower module exports one default object. At minimum it should provide:
- stats: base name, cost, range, cooldown/fire rate, damage, pierce, damage type, projectile type and tower-specific values used by the engine.
- upgrades: paths 1, 2 and 3, normally arrays of five upgrade definitions.

See js/towers/dart.js for an example and js/towers/index.js for the registration point.

## Optional behavior hooks

The generic engine resolves behavior through getBehavior(tower.type). Common hooks include:

| Hook | Typical signature | Purpose |
| --- | --- | --- |
| fire | fire(tower, target, damage, dmgType, isCrit, effects, engine) | Spawn attack projectiles. |
| update | update(tower, dt, engine) | Custom per-step behavior. |
| updateSupport | updateSupport(tower, dt, engine) | Support aura/passive logic. |
| ability | ability(tower, engine) | First ability. |
| ability2 / ability3 | ability2(tower, engine) | Further abilities where supported. |
| postUpgrade | postUpgrade(tower, path) | Apply side effects after an upgrade. |
| canBuyTier5 | canBuyTier5(tower, path, engine) | Tower-specific Tier 5 purchase rule. |

Only add hooks that the engine actually calls. Search current call sites before adding a method name.

## Upgrade definitions

An upgrade commonly contains name, cost and desc. Optional fields include stat and amount for a direct stat change, cooldownMult for attack cooldown scaling, and extraMods for additional stat changes or unlock flags.

The engine applies generic changes in Tower._applyUpgradeStats() and then calls the behavior's post-upgrade hook. Inspect that method before adding a new upgrade field; unknown fields are not automatically meaningful.

## Rendering

The live renderer is PixiJS. Tower visuals are implemented in js/webgl/renderTowers.js and related modules. Do not assume an old Canvas 2D draw(ctx, ...) hook is automatically called by the live renderer. Follow js/webgl/MIGRATION.md and current Pixi patterns.

## Checklist for a new tower

1. Add js/towers/<type>.js with stats and upgrade paths.
2. Import it and add its key to TowerRegistry in js/towers/index.js.
3. Add its shop category in TOWER_CATEGORIES.
4. Add sprite assets and update/regenerate the sprite manifest as appropriate.
5. Implement only the custom hooks needed.
6. Add tests for upgrade values, damage/pierce, abilities, placement constraints and custom behavior.
7. Test all upgrade paths in the browser, including save/load if it has special state.

## Shared-state cautions

- Do not mutate a definition's stats object for per-instance values. Tower copies stats for each placed tower.
- Store runtime state on the individual tower instance and initialize/reset it consistently.
- Prefer the engine parameter supplied to hooks instead of reaching for the global singleton.
- When behavior relies on an invariant, add a focused test and explain it briefly.
