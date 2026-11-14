# Adding or Changing Bloons

Bloon definitions are numeric tier data in js/bloons.js, exported from js/data.js as EnemyTypes. Wave definitions in js/waves.js and js/abrWaves.js refer to those tiers.

The Enemy class in js/enemy.js owns runtime behavior such as movement, HP, status effects, regrow, splitting and damage. Adding a data entry alone does not implement all behaviors of a new enemy.

Before adding a tier, trace the tier-to-name mapping (ENEMY_NAMES in enemy.js), EnemyTypesData in bloons.js, tier application and child/split rules, damage immunities, status effects, fortified/regrow behavior, sprite naming/manifest lookup and wave data that spawns it.

Wave groups use tier and spawn timing/count fields. Read adjacent waves before changing the structure. Alternate Bloons Rounds are stored separately in js/abrWaves.js.

For new or modified enemies, test HP/layers, movement speed, RBE/cash behavior, children/splitting, camo/lead/fortified/regrow interactions where relevant, damage immunities and sprite loading. Add a regression test for special interactions.
