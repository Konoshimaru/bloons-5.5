// constants.js
// PRO FIX: Dedicated file for canvas dimensions to break circular dependencies.

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;
export const GLOBAL_SCALE = 1.3; // Code-only global size modifier for hitboxes, ranges, sprites

// NEW: Layout constants for Flexbox separation
export const SIDEBAR_WIDTH = 220;
export const GAME_AREA_WIDTH = CANVAS_WIDTH - SIDEBAR_WIDTH; // 1060