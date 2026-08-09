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
import Brickell from './brickell.js';
import Etienne from './etienne.js';
import Psi from './psi.js';
import Geraldo from './geraldo.js';
import Corvus from './corvus.js';
import Rosalia from './rosalia.js';
import Silas from './silas.js';
import DanDMonke from './dan_d_monke.js';
import { createPlaceholderHero } from './placeholder.js';

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
    adora: Adora,
    brickell: Brickell,
    etienne: Etienne,
    psi: Psi,
    geraldo: Geraldo,
    corvus: Corvus,
    rosalia: Rosalia,
    silas: Silas,
    dan_d_monke: DanDMonke
};

// Automatically generate stats and levels exports
export const HeroStats = {};
export const HeroLevels = {};
for (let key in HeroRegistry) {
    HeroStats[key] = HeroRegistry[key].stats;
    HeroLevels[key] = HeroRegistry[key].levels;
}
