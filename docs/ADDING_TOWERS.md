# Adding a Tower

Tower definitions are data/behavior objects registered in js/towers/index.js.

## 1. Create the definition

Create js/towers/<type>.js and export a default object. Use js/towers/dart.js as a reference. Include stats (name, cost, range, cooldown, damage, pierce and projectile values), three upgrade paths and only the custom behavior hooks the tower needs.

Read js/towers/TOWER_INTERFACE.md for current hook names and signatures.

## 2. Register it

In js/towers/index.js, import the definition, add it to TowerRegistry, and add its category in TOWER_CATEGORIES. TowerStats and Upgrades are derived from the registry; do not maintain duplicate tables.

## 3. Implement behavior

Use hooks such as fire, update, updateSupport, abilities and upgrade hooks only when generic behavior is insufficient. Prefer the supplied engine parameter to accessing global GameEngine.

For projectiles, follow existing Projectile initialization and pooling. Check js/projectileTypeConfig.js and collision/damage rules when introducing a new projectile type.

## 4. Add visuals

The live renderer is under js/webgl/. Review renderTowers.js, sprite configuration and the sprite manifest workflow. Add source images/frames using existing naming conventions, then run npm run gen:manifest when needed.

Do not assume a legacy Canvas 2D draw method is called by the Pixi renderer.

## 5. Test

Cover base stats/upgrades, damage and pierce, abilities, support effects, placement rules, asset keys and save/load if the tower has special state. Test the tower in the browser at several tiers and at high game speed.
