// js/spriteIndex.js — PLACEHOLDER (repo-side only)
//
// The real sprite index is generated from public/sprites/** by
// tools/gen_sprite_index.py (shipped in btd-animator.zip). If you are seeing
// this placeholder, the generator output was lost with the workspace — the
// game and cutscenePlayback.js import findEntry from here, so this stub keeps
// the module graph resolvable. Copy the generated js/spriteIndex.js from your
// local copy (btd-animator.zip) over this file for full sprite resolution.
//
// Interface (must match the generated file):
//   findEntry(key) -> { key, url, sx?, sy?, sw?, sh?, fw?, fh? } | null
//   SPRITE_LIBRARY -> array of the same entries

export const SPRITE_LIBRARY = [];

export function findEntry(key) {
    if (typeof key !== 'string' || !key) return null;
    // Minimal resolution for the knight-intro assets so the cutscene keeps
    // working even with this stub: boss frames + the static front view.
    if (key === 'enemy_knight_front') {
        return { key, url: 'sprites/sheets/enemies/knight_front.png', fw: 122, fh: 117 };
    }
    if (key.startsWith('boss_')) {
        return { key, url: `sprites/boss/${key.slice(5)}.png` };
    }
    return null;
}
