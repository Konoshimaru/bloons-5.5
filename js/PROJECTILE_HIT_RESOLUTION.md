/**
 * PROJECTILE DAMAGE RESOLUTION GUIDE
 * ==================================
 * There are two distinct paths for dealing damage in this engine. Which one
 * is used depends on the projectile's type and the `effects` object passed
 * into it via `p.init()`.
 *
 * PATH 1: Direct-Hit Damage
 * - Uses `p.damage` (passed in from `tower.stats.damage`).
 * - Resolved in `_handleStandardHit()`.
 * - Applies `p.damage` to the single enemy it hits.
 * - Reduced by `p.pierce` per hit.
 * - Used by: Dart, Boomerang, Sniper, Wizard, etc.
 *
 * PATH 2: Explosion (AoE) Damage
 * - Uses `p.effects.explosionDamage` OR `p.tower.stats.explosionDamage`.
 * - Resolved in `_handleExplosiveHit()`.
 * - The projectile acts as a trigger. When it hits an enemy (or expires), 
 *   it creates an explosion that damages all enemies within `explosionRadius`.
 * - The explosion's pierce is determined by `explosionPierce`.
 * - Used by: Bomb Shooter, Mortar, Explosive Sentry, Mermonkey Trident.
 *
 * NOTE ON ENGINEER SENTRIES:
 * Engineer sentries are a variant of Path 2. They attach an `effects` object
 * containing `isExplosive`, `explosionRadius`, `explosionDamage`, etc., 
 * directly to the projectile upon creation in `sentryEntity.js`. The generic
 * `_isExplosive()` check below detects this and routes them to Path 2.
 */