// Bound catch-up work per animation frame. A genuine update() exception still
// propagates to GameEngine.loop; a slow frame merely yields its remaining steps.
export function runFixedStepsWithinBudget(
    update, requestedSteps, stepDt, budgetMs, now = () => performance.now()
) {
    if (typeof update !== 'function') throw new TypeError('update must be a function.');
    if (!Number.isInteger(requestedSteps) || requestedSteps < 0) {
        throw new RangeError('requestedSteps must be a non-negative integer.');
    }
    if (!Number.isFinite(stepDt) || stepDt <= 0) {
        throw new RangeError('stepDt must be a positive finite number.');
    }
    if (!Number.isFinite(budgetMs) || budgetMs < 0) {
        throw new RangeError('budgetMs must be a non-negative finite number.');
    }
    if (typeof now !== 'function') throw new TypeError('now must be a function.');

    const startTime = now();
    let completedSteps = 0;
    while (completedSteps < requestedSteps) {
        update(stepDt);
        completedSteps++;
        // Always allow at least one step so a very small budget cannot starve
        // the simulation forever. Stop only after the completed step returns.
        if (now() - startTime > budgetMs) break;
    }
    return { completedSteps, skippedSteps: requestedSteps - completedSteps };
}
