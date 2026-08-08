// js/webgl/rendererConstants.js
export const ENEMY_NAMES = [null, 'red', 'blue', 'green', 'yellow', 'pink', 'black', 'white', 'lead', 'zebra', 'purple', 'rainbow', 'ceramic', 'moab', 'bfb', 'zomg', 'ddt', 'bad'];
export const CRACKABLE = new Set(['ceramic', 'moab', 'bfb', 'zomg', 'ddt', 'bad']);

export const PLACEMENT_RADIUS = 18;
export const TOWER_RANGE_AFFORDABLE_COLOR = 0xffffff;
export const TOWER_RANGE_OUT_OF_BOUNDS_COLOR = 0xff0000;
export const TOWER_RANGE_ALPHA = 0.2 * 0.6;
export const TOWER_OVERLAP_COLOR = 0xff0000;
export const TOWER_OVERLAP_ALPHA = 1 * 0.6;
export const TOWER_PREVIEW_SPRITE_ALPHA = 0.6;

export const PARTICLE_BASE_SIZE = 45;
export const EXPLOSION_INNER_COLOR = 0xf1c40f;
export const EXPLOSION_DEFAULT_COLOR = 0xe67e22;
export const BEAST_COLORS = [0x2ecc71, 0x27ae60, 0xf1c40f, 0xe67e22, 0xc0392b];
export const BEAST_FALLBACK_COLOR = 0x8e44ad;

export const SHADOW_COLOR = 0x000000;
export const SHADOW_ALPHA = 0.3;
export const SHADOW_SQUASH = 0.3;
export const SHADOW_Y_OFFSET = 0.8;
export const TOWER_SHADOW_SCALE = 22;
export const NIGHT_GLOW_RADIUS = 35;
export const NIGHT_GLOW_INNER_COLOR = 'rgba(255, 240, 150, 0.6)';
export const NIGHT_GLOW_OUTER_COLOR = 'rgba(255, 240, 150, 0)';

export const HITSCAN_COLOR = 0x2c3e50;
export const HITSCAN_LINE_WIDTH = 3;
export const HITSCAN_MAX_LIFE = 0.1;
export const BANANA_CRATE_SIZE = 40;
export const BANANA_SIZE = 25;
export const BANANA_ALPHA_DIVISOR = 2;

export const BOSS_BAR_WIDTH = 450;
export const BOSS_BAR_HEIGHT = 24;
export const BOSS_BAR_SPACING = 36;
export const BOSS_BAR_START_Y = 55;
export const BOSS_BAR_BORDER_COLOR = 0x000000;
export const BOSS_BAR_BORDER_ALPHA = 0.8;
export const BOSS_BAR_EMPTY_COLOR = 0x2c3e50;
export const BOSS_BAR_HIGHLIGHT_COLOR = 0xffffff;
export const BOSS_BAR_HIGHLIGHT_ALPHA = 0.2;

export const CURSOR_FILL_COLOR = 0xffffff;
export const CURSOR_STROKE_COLOR = 0x000000;
export const CURSOR_STROKE_WIDTH = 2;

export const BOSS_WARNING_Y = 360;
export const BOSS_WARNING_OUTER_COLOR = 0xff3232;
export const BOSS_WARNING_OUTER_WIDTH = 6;
export const BOSS_WARNING_INNER_COLOR = 0xe74c3c;
export const BOSS_WARNING_INNER_WIDTH = 2;
export const BOSS_WARNING_STATE_TIMER_DIVISOR = 2.0;

export const TOWER_HIT_RADIUS_PADDING = 4;
export const TOWER_SELECTION_LINE_WIDTH = 3;
export const TOWER_SELECTION_RING_COLOR = 0xe67e22;
export const TOWER_RANGE_FILL_COLOR = 0xe67e22;
export const TOWER_SELECTION_FILL_ALPHA = 0.15;
export const ACID_POOL_COLOR = 0x2ecc71;
export const ACID_FOAM_COLOR = 0xecf0f1;
export const ACID_POOL_LIFE_DIVISOR = 2.0;
export const FLOATING_TEXT_DEFAULT_COLOR = 0xf1c40f;
export const LEAK_FLASH_COLOR = 0xe74c3c;
export const LEAK_FLASH_LINE_WIDTH = 10;

export const KNIGHT_SCALE = 1.65;         // knightRenderer.js: knightScale
export const KNIGHT_TRAIL_SCALE = 1.21;   // knightRenderer.js: trailScale
export const KNIGHT_SWORD_SCALE = 1.5;    // knightRenderer.js: swordScale
export const KNIGHT_SLASH_COLOR = 'rgba(231, 76, 60, 0.8)';
export const KNIGHT_SLASH_EDGE_COLOR = 'rgba(255, 255, 255, 0.9)';
export const KNIGHT_AIM_TRACK_COLOR = 'rgba(231, 76, 60, 0.5)';
export const KNIGHT_AIM_LOCK_COLOR = 'rgba(231, 76, 60, 1)';