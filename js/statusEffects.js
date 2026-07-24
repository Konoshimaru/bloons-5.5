// js/statusEffects.js
// Declarative countdown-based status effects for Enemy, following the same
// registry pattern already used by MKEffects (monkeyKnowledgeEffects.js).
//
// Scope note: this only covers the three "countdown timer -> reset to
// baseline at zero" effects (slow/freeze, brittle/embrittlement, damage-over-time).
// gojoSlow/infinityTint are continuous-recovery decays (not hard-cutoff timers)
// and dipped/isGoldified/permafrostSlow/deepFreezeLayers are permanent-until-
// overwritten flags with no automatic decay — none of those gain anything from
// being folded into this registry, so they're intentionally left as plain
// fields on Enemy, exactly as they are today.
//
// Adding a new timed effect in the future is now: add one entry below.
// No new fields to remember to reset, no new countdown block to hand-write.

export const TimedEffects = [
    {
        id: 'slow',
        timerField: 'slowTimer',
        onExpire(e) {
            e.slowFactor = 1.0;
            e.isFrozen = false;
        }
    },
    {
        id: 'brittle',
        timerField: 'brittleTimer',
        onExpire(e) {
            e.brittle = false;
            e.brittleBonus = 0;
            e.leadStripped = false;
        }
    },
    {
        id: 'dot',
        timerField: 'dotTimer',
        tickField: 'dotTick',
        tickInterval: 1.0, // DOT_TICK_INTERVAL in enemy.js
        onTick(e) {
            e.takeDamage(e.dotDmg, { isAcid: true, canHitLead: true });
        }
        // No onExpire: dotDmg is intentionally left as-is when the timer
        // expires, matching current behavior (it's just not applied again
        // until something sets dotTimer > 0 again).
    }
];

/**
 * Replaces the hand-written slowTimer/brittleTimer/dotTimer blocks in
 * Enemy._updateTimers(). Call once per enemy per update tick.
 */
export function updateTimedEffects(enemy, dt) {
    for (const eff of TimedEffects) {
        if (enemy[eff.timerField] <= 0) continue;

        enemy[eff.timerField] -= dt;

        if (eff.tickField) {
            enemy[eff.tickField] += dt;
            if (enemy[eff.tickField] >= eff.tickInterval) {
                enemy[eff.tickField] = 0;
                if (eff.onTick) eff.onTick(enemy);
            }
        }

        if (enemy[eff.timerField] <= 0 && eff.onExpire) {
            eff.onExpire(enemy);
        }
    }
}