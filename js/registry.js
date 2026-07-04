// js/registry.js
// Single source of truth for resolving a tower-or-hero type key to its
// behavior definition. Centralizes the `TowerRegistry[type] || HeroRegistry[type]`
// lookup so it can never drift out of sync across call sites.
import { TowerRegistry } from './towers/index.js';
import { HeroRegistry } from './heroes/index.js';

/**
 * Resolves a placed entity's `type` to its behavior object.
 * Towers live in TowerRegistry; heroes (including placeholders) live in HeroRegistry.
 * A given type is only ever present in one of the two registries.
 *
 * @param {string} type - The entity type key (e.g. 'dart', 'quincy').
 * @returns {object|null} The behavior definition, or null if unknown.
 */
export function getBehavior(type) {
    return TowerRegistry[type] || HeroRegistry[type] || null;
}
