// js/towers/index.js
import dart from './dart.js';
import boomerang from './boomerang_monkey.js';
import tack from './tack.js';
import ninja from './ninja.js';
import sniper from './sniper.js';
import ice from './ice.js';
import glue from './glue.js';
import bomb from './bomb.js';
import spike from './spike.js';
import farm from './farm.js';
import village from './village.js';
import superMonkey from './super.js';
import sub from './sub.js';
import buccaneer from './buccaneer_monkey.js';
import mortar from './mortar.js';
import wizard from './wizard.js';
import engineer from './engineer.js';
import alchemist from './alchemist.js';
import farmer from './farmer.js';
import { createPlaceholderTower } from './placeholder.js';

const placeholderTowers = [
    ['desperado', 'Desperado', 500, 'Placeholder Primary tower.'],
    ['ace', 'Monkey Ace', 800, 'Placeholder Military tower. Flies around the map.'],
    ['heli', 'Heli Pilot', 1000, 'Placeholder Military tower. Flies to target location.'],
    ['dartling', 'Dartling Gunner', 950, 'Placeholder Military tower. Shoots where you aim.'],
    ['druid', 'Druid', 500, 'Placeholder Magic tower.'],
    ['mermonkey', 'Mermonkey', 750, 'Placeholder Magic tower. Buffs water towers.'],
    ['beast', 'Beast Handler', 550, 'Placeholder Support tower. Merges with other beasts.']
];

export const TowerRegistry = {
    dart, boomerang, tack, ninja, sniper, ice, glue, bomb, spike, farm, village,
    super: superMonkey, sub, buccaneer, mortar, wizard, engineer, alchemist, farmer
};

placeholderTowers.forEach(([key, name, cost, desc]) => {
    TowerRegistry[key] = createPlaceholderTower(name, cost, desc);
});

// --- CATEGORY INJECTION ---
const TOWER_CATEGORIES = {
    // Primary
    dart: 'Primary', boomerang: 'Primary', bomb: 'Primary', tack: 'Primary', 
    ice: 'Primary', glue: 'Primary', desperado: 'Primary',
    // Military
    sniper: 'Military', sub: 'Military', buccaneer: 'Military', ace: 'Military', 
    heli: 'Military', mortar: 'Military', dartling: 'Military',
    // Magic
    wizard: 'Magic', super: 'Magic', ninja: 'Magic', alchemist: 'Magic', 
    druid: 'Magic', mermonkey: 'Magic',
    // Support
    farm: 'Support', spike: 'Support', village: 'Support', engineer: 'Support', 
    beast: 'Support', farmer: 'Support'
};

// Assign the category to the tower's stats if it doesn't already exist
for (const key in TowerRegistry) {
    if (TowerRegistry[key].stats && !TowerRegistry[key].stats.category) {
        TowerRegistry[key].stats.category = TOWER_CATEGORIES[key] || 'Primary';
    }
}
// -------------------------

export const TowerStats = Object.fromEntries(Object.entries(TowerRegistry).map(([k, v]) => [k, v.stats]));
export const Upgrades = Object.fromEntries(Object.entries(TowerRegistry).map(([k, v]) => [k, v.upgrades]));