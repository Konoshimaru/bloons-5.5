// js/cheats.js
// ============================================================================
// OWNER CHEAT - "Konoshi"
// ============================================================================
// A single hidden cheat unlocks all meta progression. It only surfaces when
// the player profile is named "Konoshi" (case-insensitive): the Profile menu
// then shows an "Unlock Everything" button. Nothing here is reachable with
// any other name, and the unlock itself goes through the same Config fields
// the normal progression uses, so saves stay schema-valid.
//
// Grants:
//   - every registered tower AND hero (unlockedTowers)
//   - every configured paragon (paragonUnlocks) with its XP bar filled to the
//     unlock threshold (towerXp), so the MONKEYS-menu paragon section agrees
//   - every Monkey Knowledge perk in all four trees (monkeyKnowledge)
//     plus a pile of knowledge points for future trees
// Money, levels and stats are NOT touched - "unlock" is not "rich".
// ============================================================================
import { TowerStats } from './towers/index.js';
import { HeroRegistry } from './heroes/index.js';
import { PARAGON_POWER_RULES } from './paragonPower.js';
import MKData from './monkeyKnowledgeData.js';

// The profile name that reveals the cheat UI. Compared case-insensitively
// against the trimmed player name so "Konoshi" / "konoshi" both work.
export const CHEAT_NAME = 'konoshi';

export function isCheater(ConfigLike) {
    const name = String((ConfigLike && ConfigLike.data && ConfigLike.data.playerName) || '')
        .trim().toLowerCase();
    return name === CHEAT_NAME;
}

// Every MK node id across all trees, discovered defensively: the data module
// exposes tree getters, so call whatever functions exist and keep the nodes.
function _allKnowledgeIds() {
    const ids = [];
    for (const fn of Object.values(MKData || {})) {
        if (typeof fn !== 'function') continue;
        try {
            const nodes = fn();
            if (Array.isArray(nodes)) for (const n of nodes) if (n && n.id) ids.push(n.id);
        } catch (e) { /* a tree that fails to build must not block the cheat */ }
    }
    return ids;
}

// Grants everything listed in the header. Returns a small summary for the
// UI status line. Pure data mutation + one save - no engine state, so it is
// safe to call from any menu.
export function unlockEverything(ConfigLike) {
    const data = ConfigLike && ConfigLike.data;
    if (!data) return { towers: 0, paragons: 0, knowledge: 0 };

    const towerTypes = Object.keys(TowerStats).filter(k => !k.startsWith('paragon_'));
    const heroTypes = Object.keys(HeroRegistry);
    data.unlockedTowers = [...new Set([...(data.unlockedTowers || []), ...towerTypes, ...heroTypes])];

    if (!data.paragonUnlocks) data.paragonUnlocks = {};
    if (!data.towerXp) data.towerXp = {};
    for (const [key, cfg] of Object.entries(PARAGON_POWER_RULES)) {
        data.paragonUnlocks[key] = true;
        data.towerXp[key] = Math.max(data.towerXp[key] || 0, cfg.xpToUnlock || 500000);
    }

    const knowledgeIds = _allKnowledgeIds();
    if (!data.monkeyKnowledge) data.monkeyKnowledge = {};
    for (const id of knowledgeIds) data.monkeyKnowledge[id] = true;
    data.knowledgePoints = Math.max(data.knowledgePoints || 0, 999);

    ConfigLike.save();
    return {
        towers: towerTypes.length + heroTypes.length,
        paragons: Object.keys(PARAGON_POWER_RULES).length,
        knowledge: knowledgeIds.length,
    };
}
