// js/spriteIndex.js — minimal repo-side sprite index.
//
// The full generated sprite index is normally produced from the public sprite
// tree. This small fallback keeps the Knight intro assets resolvable in source
// checkouts that do not have the generated index available.

const KNIGHT_FRONT_ENTRY = Object.freeze({
    key: 'enemy_knight_front',
    url: 'sprites/sheets/enemies/knight_front.png',
    fw: 122,
    fh: 117
});

export const SPRITE_LIBRARY = [KNIGHT_FRONT_ENTRY];

export function findEntry(key) {
    if (typeof key !== 'string' || !key) return null;

    if (key === 'enemy_knight_front') return KNIGHT_FRONT_ENTRY;

    if (key.startsWith('boss_')) {
        return { key, url: `sprites/boss/${key.slice(5)}.png` };
    }

    return null;
}
