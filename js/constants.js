// constants.js

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;
export const GLOBAL_SCALE = 1.3; // Code-only global size modifier for hitboxes, ranges, sprites

// NEW: Layout constants for Flexbox separation
export const SIDEBAR_WIDTH = 220;
export const GAME_AREA_WIDTH = CANVAS_WIDTH - SIDEBAR_WIDTH; // 1060

// Speed of a Red bloon in px/s. Every other bloon is BASE_SPEED * (BTD6 speed ratio) in bloons.js.
// (BTD6: Red = 25 units/s.)
export const BASE_SPEED = 60;

// Single shared scale constant. Import this instead of re-declaring
// `const GS = typeof GLOBAL_SCALE ...` in every file.
export const GS = GLOBAL_SCALE;
