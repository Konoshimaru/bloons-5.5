# Adding a Hero

Heroes share the tower runtime but add levels, XP and hero-specific abilities.

Create js/heroes/<hero>.js as a default-exported object. Use js/heroes/quincy.js as a reference. A hero definition normally includes stats with isHero: true, xpTable, levels keyed by level number, and optional hooks such as update, fire, ability and ability2.

Import the definition in js/heroes/index.js and add it to HeroRegistry. HeroStats and HeroLevels are derived from that registry.

js/hero.js handles XP accumulation, level progression and applying level stats. Keep the format consistent with existing heroes. A missing level entry should be intentional.

Use Pixi renderer modules under js/webgl/ and existing portrait/sprite naming conventions. Cover XP thresholds, level unlocks, stat changes, abilities, targeting and save/load. Test at least one important unlock in the browser.
