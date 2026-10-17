// js/combat.js
// Shared combat helpers. Deliberately has NO imports (so any module can use it without
// creating an import cycle). Before this file existed, the "can this explosion hit that
// bloon" rules and the explosion visual were re-implemented in ~50 places, with slightly
// different rules each time (e.g. Utils.applyAoeDamage ignored untargetable / collisionImmune
// bloons and never credited a sub-tower's parent).

// Rules shared by EVERY area attack: alive, not in an immune state (Big Squeeze etc.),
// and camo visibility (the attack's own override, or the owning tower's camo detection).
export function canBeAoeTarget(e, source, canSeeCamoOverride = false) {
    if (!e || !e.alive) return false;
    if (e.untargetable || e.damageImmune || e.collisionImmune) return false;
    if (e.isCamo && !canSeeCamoOverride && !(source && towerSeesCamo(source))) return false;
    return true;
}

// Camo detection: the tower's own ability OR a buff (Village radar, Sub, Etienne UAV...).
// Every "can this tower target that camo bloon" check must go through here; several towers used
// to test only stats.canSeeCamo and silently ignored the buff.
export function towerSeesCamo(tower) {
    return !!(tower.stats.canSeeCamo || tower.buffedCamo);
}
export function isHiddenFrom(tower, e) {
    return !!e.isCamo && !towerSeesCamo(tower);
}

// takeDamage + credit in one call (replaces the repeated
// `let d = e.takeDamage(...); if (!isNaN(d) && d !== -1) tower.damageDealt += d;`).
export function dealDamage(e, dmg, dmgType, effects, source) {
    const d = e.takeDamage(dmg, dmgType, effects, source);
    if (!isNaN(d) && d !== -1) creditDamage(source, d);
    return d;
}

// Credit damage to the tower that dealt it (and to its parent for sub-towers: sentries, etc.).
export function creditDamage(source, dmg) {
    if (!source) return;
    source.damageDealt += dmg;
    if (source.parentTower) source.parentTower.damageDealt += dmg;
}

// The one explosion visual. `engine` is passed in (GameEngine or the local `engine`) to keep
// this module import-free.
export function spawnExplosion(engine, x, y, radius, life, color) {
    engine.explosions.push({ x, y, radius: 0, maxRadius: radius, life, maxLife: life, color });
}
