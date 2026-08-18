// js/spriteSheets.js
// Shared spritesheet manifest used by BOTH asset paths:
//  - js/assets.js        (Canvas2D)  — reports sheet frames as loaded so the
//    animation-decision logic (towerBehavior._getAnimationAsset) picks the
//    upgrade full-anim instead of falling back to the base sprite.
//  - js/webgl/pixiAssets.js (WebGL)  — serves the actual Texture for the frame.
// The game's key scheme is untouched; only the backing resource changes.

export const SPRITESHEETS = Object.freeze([
    {
        prefix: 'tower_bomb_p3_t1_attack_full_',
        sheet: 'sprites/sheets/bomb_p3_t1_attack/bomb_p3_t1_attack.json',
        // frameCount: exclusive upper bound — only frames 0..frameCount-1 exist
        // in the sheet. Used to stop the animation at the last real frame.
        frameCount: 14,
        frame: key => key.replace('tower_', '') + '.png',
    },
    {
        prefix: 'tower_boomerang_p1_t1_attack_full_',
        sheet: 'sprites/sheets/boomerang_p1_t1_attack/boomerang_p1_t1_attack.json',
        frameCount: 13,
        frame: key => key.replace('tower_', '') + '.png',
    },
    {
        prefix: 'tower_boomerang_p2_t3_attack_full_',
        sheet: 'sprites/sheets/boomerang_p2_t3_attack/boomerang_p2_t3_attack.json',
        frameCount: 10,
        frame: key => key.replace('tower_', '') + '.png',
    },
    {
        prefix: 'tower_dart_p1_t3_attack_full_',
        sheet: 'sprites/sheets/dart_p1_t3_attack/dart_p1_t3_attack.json',
        frameCount: 20,
        frame: key => key.replace('tower_', '') + '.png',
    },
    {
        prefix: 'tower_glue_p1_t4_attack_full_',
        sheet: 'sprites/sheets/glue_p1_t4_attack/glue_p1_t4_attack.json',
        frameCount: 13,
        frame: key => key.replace('tower_', '') + '.png',
    },
    {
        prefix: 'tower_ninja_attack_full_',
        sheet: 'sprites/sheets/ninja_attack/ninja_attack.json',
        frameCount: 10,
        frame: key => key.replace('tower_', '') + '.png',
    },
    {
        prefix: 'tower_tack_p1_t1_attack_full_',
        sheet: 'sprites/sheets/tack_p1_t1_attack/tack_p1_t1_attack.json',
        frameCount: 7,
        frame: key => key.replace('tower_', '') + '.png',
    },
    {
        prefix: 'tower_tack_p2_t4_attack_full_',
        sheet: 'sprites/sheets/tack_p2_t4_attack/tack_p2_t4_attack.json',
        frameCount: 16,
        frame: key => key.replace('tower_', '') + '.png',
    },
    {
        prefix: 'tower_wizard_attack_full_',
        sheet: 'sprites/sheets/wizard_attack/wizard_attack.json',
        frameCount: 14,
        frame: key => key.replace('tower_', '') + '.png',
    },
    {
        // MOAB + BFB are packed atlases: body (enemy_moab), damage cracks
        // (enemy_moab_1..3) and every blade stage/frame key resolve through
        // atlas frames. ZOMG/BAD still use loose PNGs. frameCount is 0
        // because enemy keys are not pure-digit-suffixed (sheetHasFrame
        // never admits them, so the Canvas2D path keeps using loose files).
        prefix: 'enemy_moab',
        sheet: 'sprites/sheets/moab/moab.json',
        frameCount: 0,
        frame: key => key.replace('enemy_', '') + '.png',
    },
    {
        prefix: 'enemy_bfb',
        sheet: 'sprites/sheets/bfb/bfb.json',
        frameCount: 0,
        frame: key => key.replace('enemy_', '') + '.png',
    },
    {
        // All effect sprites share one atlas (banana/pop/slash/stun/status
        // overlays). frameCount is 0 because these keys are NOT numeric-suffixed
        // (banana, pop2, stun_1...) — sheetHasFrame only admits pure-digit keys,
        // and any effect key whose frame is absent from the atlas falls back to
        // the loose sprites/effects/<name>.png via pixiAssets.
        prefix: 'effect_',
        sheet: 'sprites/sheets/effects/effects.json',
        frameCount: 0,
        frame: key => key.replace('effect_', '') + '.png',
    },
]);

export function getSheetForKey(key) {
    for (const entry of SPRITESHEETS) {
        if (key.startsWith(entry.prefix)) return entry;
    }
    return null;
}

// True when `key` is a frame that actually exists in one of the sheets (used
// by the Canvas2D decision path, which has no network access to the JSON).
export function sheetHasFrame(key) {
    const entry = getSheetForKey(key);
    if (!entry) return false;
    const digits = key.slice(entry.prefix.length).match(/^(\d+)$/);
    if (!digits) return false;
    return parseInt(digits[1], 10) < entry.frameCount;
}