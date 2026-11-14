// js/webgl/renderFailurePolicy.js
// Pure policy for recovering from optional Pixi draw-method failures.

export const OPTIONAL_DRAW_RETRY_FRAMES = Object.freeze([30, 120]);
export const MAX_OPTIONAL_DRAW_FAILURES = 3;

// If any of these passes fail, the world output can become incomplete or
// misleading. Let the engine's top-level renderer handler stop the session.
const CRITICAL_DRAW_METHODS = new Set([
    '_drawBackground',
    '_drawTowers',
    '_drawEnemies',
    '_drawProjectiles',
    '_compositeWorld'
]);

export function isCriticalDrawMethod(methodName) {
    return CRITICAL_DRAW_METHODS.has(methodName);
}

export function canAttemptDraw(state, frame) {
    if (!state) return true;
    if (state.disabled) return false;
    return frame >= state.retryAtFrame;
}

/**
 * Returns updated optional-method failure state.
 * The first retry waits 30 frames, the second 120 frames; the third failure
 * disables the method until PixiRenderer is reinitialized/page is reloaded.
 */
export function recordDrawFailure(previousState, frame) {
    const failures = (previousState?.failures || 0) + 1;
    const disabled = failures >= MAX_OPTIONAL_DRAW_FAILURES;
    const retryDelay = OPTIONAL_DRAW_RETRY_FRAMES[failures - 1] ?? 0;

    return {
        failures,
        disabled,
        retryAtFrame: disabled ? Number.POSITIVE_INFINITY : frame + retryDelay
    };
}
