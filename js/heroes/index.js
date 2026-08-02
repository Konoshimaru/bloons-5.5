// js/heroes/index.js
import Quincy from './quincy.js';
import Gwendolin from './gwendolin.js';
import Gojo from './gojo.js'; 
import Geto from './geto.js';
import Sauda from './sauda.js';
import StrikerJones from './striker_jones.js';
import Obyn from './obyn.js';
import Churchill from './churchill.js';
import Benjamin from './benjamin.js';
import Ezili from './ezili.js';
import PatFusty from './pat_fusty.js';
import Adora from './adora.js';
import { createPlaceholderHero } from './placeholder.js';

const placeholderHeroes = [
    ['brickell', 'Admiral Brickell', 750, 'Naval Commander'],
    ['etienne', 'Etienne', 850, 'Drone Operator'],
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
    gojo: Gojo,
    geto: Geto,
    sauda: Sauda,
    striker_jones: StrikerJones,
    obyn: Obyn,
    churchill: Churchill,
    benjamin: Benjamin,
    ezili: Ezili,
    pat_fusty: PatFusty,
    adora: Adora
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
