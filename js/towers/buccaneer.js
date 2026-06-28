import { GameEngine } from '../engine.js';
import { Projectile } from '../projectile.js';

export default {
    stats: { name: "Buccaneer Monkey", cost: 500, range: 35, fireRate: 1.5, damage: 1, projectileSpeed: 600, pierce: 2, lifespan: 0.5, desc: "Fires darts from both sides. Must be placed on water.", dmgType: 'sharp', projectileType: 'dart', hitRadius: 18, waterOnly: true },
    upgrades: {
        1: [{name:"Grapeshot",cost:300,stat:"pierce",amount:2,desc:"+2 pierce."}],
        2: [{name:"Hot Shot",cost:400,stat:"dmgType",amount:'fire',desc:"Fires hot darts that pop lead."}],
        3: [{name:"Faster Boats",cost:400,stat:"fireRate",amount:-0.3,desc:"Attacks faster."},{name:"Longer Range",cost:300,stat:"range",amount:30,desc:"Increases range."}],
        4: [{name:"Destroyer",cost:1800,stat:"fireRate",amount:-0.8,desc:"Extreme attack speed."}],
        5: [{name:"Aircraft Carrier",cost:12000,stat:"damage",amount:2,desc:"Deals extra damage and launches planes (visual only for now).", extraMods: {pierce: 5}}]
    },
    fire(tower, target, damage, dmgType) {
        GameEngine.projectiles.push(new Projectile(tower.x, tower.y, damage, target, 'dart', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, null, 0, tower, dmgType));
        GameEngine.projectiles.push(new Projectile(tower.x, tower.y, damage, null, 'dart', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, tower.angle + Math.PI, null, 0, tower, dmgType));
    }
};