import Quincy from './quincy.js';
import Gwendolin from './gwendolin.js';
import Gojo from './gojo.js'; 
import { createPlaceholderHero } from './placeholder.js';

const placeholderHeroes = [
    ['striker_jones', 'Striker Jones', 750, 'Artillery Commander'],
    ['obyn', 'Obyn Greenfoot', 750, 'Forest Guardian'],
    ['churchill', 'Captain Churchill', 2000, 'Tank'],
    ['benjamin', 'Benjamin', 1200, 'Code Monkey'],
    ['ezili', 'Ezili', 750, 'Voodoo Monkey'],
    ['pat_fusty', 'Pat Fusty', 500, 'Giant Monkey'],
    ['adora', 'Adora', 1000, 'High Priestess'],
    ['brickell', 'Admiral Brickell', 750, 'Naval Commander'],
    ['etienne', 'Etienne', 850, 'Drone Operator'],
    ['sauda', 'Sauda', 550, 'Swordmaster'],
    ['psi', 'Psi', 1000, 'Psionic Monkey'],
    ['geraldo', 'Geraldo', 1400, 'Mystic Shopkeeper'],
    ['corvus', 'Corvus', 1600, 'Spirit Walker'],
    ['rosalia', 'Rosalia', 1000, 'Tinkerer'],
    ['silas', 'Silas', 1100, 'Ice Shaper'],
    ['dan_d_monke', "Dan D'Monke", 800, 'Courtly Monkey']
];

export const HeroRegistry = {
    quincy: Quincy,
    gwendolin: Gwendolin,
    gojo: Gojo 
};

// Inject all placeholders into the registry
placeholderHeroes.forEach(([key, name, cost, desc]) => {
    HeroRegistry[key] = createPlaceholderHero(name, cost, desc);
});

// Automatically generate stats and levels exports
export const HeroStats = {};
export const HeroLevels = {};
for (let key in HeroRegistry) {
    HeroStats[key] = HeroRegistry[key].stats;
    HeroLevels[key] = HeroRegistry[key].levels;
}