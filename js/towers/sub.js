import { GameEngine } from '../engine.js';
import { Projectile } from '../projectile.js';

export default {
    stats: { name: "Monkey Sub", cost: 500, range: 35, fireRate: 1.1, damage: 1, projectileSpeed: 400, pierce: 1, lifespan: 0.8, desc: "Fires homing torpedoes. Must be placed on water.", dmgType: 'sharp', projectileType: 'dart', hitRadius: 18, waterOnly: true },
    upgrades: {
        1: [{name:"Advanced Intel",cost:300,stat:"range",amount:30,desc:"Towers in range of the sub can target anywhere the sub can see (visual only for now).", extraMods: {pierce: 1}}],
        2: [{name:"Barbed Darts",cost:400,stat:"pierce",amount:1,desc:"+1 pierce."},{name:"Heat Tipped Darts",cost:500,stat:"canHitLead",amount:true,desc:"Can pop Lead bloons."}],
        3: [{name:"Twin Guns",cost:800,stat:"fireRate",amount:-0.3,desc:"Attacks faster."},{name:"Airburst Darts",cost:1200,stat:"pierce",amount:2,desc:"+2 pierce."}],
        4: [{name:"Submerge",cost:1500,stat:"isAbility",amount:true,desc:"Ability: Submerges to shoot homing darts."}],
        5: [{name:"Energizer",cost:8500,stat:"damage",amount:2,desc:"Deals extra damage.", extraMods: {pierce: 5}}]
    },
    fire(tower, target, damage, dmgType) {
        GameEngine.projectiles.push(new Projectile(tower.x, tower.y, damage, target, 'dart', tower.stats.projectileSpeed, tower.stats.pierce, tower.stats.lifespan, null, null, 0, tower, dmgType));
    },
        ability(tower, engine) {
        engine.log("First Strike Capability!");
        let target = null;
        let bestVal = -Infinity;
        for (let e of engine.enemies) {
            if (!e.alive) continue;
            if (e.data.isMoab && e.hp > bestVal) { bestVal = e.hp; target = e; }
        }
        if (target) {
            target.takeDamage(10000, { isExplosion: true, canHitLead: true });
            engine.explosions.push({ x: target.x, y: target.y, radius: 0, maxRadius: 150, life: 0.5, maxLife: 0.5, color: '#3498db' });
        }
    }
};