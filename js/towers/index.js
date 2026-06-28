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

export const TowerRegistry = { 
    dart, boomerang, tack, ninja, sniper, ice, glue, bomb, spike, farm, village, 
    super: superMonkey, sub, buccaneer, mortar, wizard, engineer, alchemist 
};

export const TowerStats = Object.fromEntries(Object.entries(TowerRegistry).map(([k, v]) => [k, v.stats]));
export const Upgrades = Object.fromEntries(Object.entries(TowerRegistry).map(([k, v]) => [k, v.upgrades]));