// js/towers/spike.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';
import { Projectile } from '../projectile.js';
import { RANGE_SCALE } from '../config.js';

export default {
    stats: { name: "Spike Factory", cost: 1000, range: 35, fireRate: 1.75, damage: 1, projectileSpeed: 0, pierce: 5, lifespan: 50.0, canSeeCamo: true, desc: "Produces spikes on the track. Pops bloons that touch them.", dmgType: 'sharp', hitRadius: 18 },
    upgrades: {
        1: [{name:"Bigger Spikes",cost:400,stat:"pierce",amount:3,desc:"Spikes pop 3 extra bloons."},{name:"Sharp Spikes",cost:500,stat:"damage",amount:1,desc:"Deals 1 extra damage."},{name:"Spiked Ball",cost:2000,stat:"damage",amount:3,desc:"Deals massive damage."},{name:"Spiked Mine",cost:4000,stat:"damage",amount:5,desc:"Deals colossal damage."},{name:"Carpet of Spikes",cost:20000,stat:"pierce",amount:10,desc:"Huge pierce bonus."}], 
        2: [{name:"Faster Production",cost:400,stat:"fireRate",amount:-0.2,desc:"Produces spikes faster."},{name:"Longer Range",cost:300,stat:"range",amount:30,desc:"Increases range."},{name:"Super Range",cost:700,stat:"range",amount:40,desc:"Huge range increase."},{name:"Overdrive",cost:2500,stat:"fireRate",amount:-0.5,desc:"Extreme production speed."},{name:"Spike Storm",cost:10000,stat:"fireRate",amount:-0.3,desc:"Maximum production speed."}], 
        3: [{name:"Lead Spikes",cost:600,stat:"canHitLead",amount:true,desc:"Can pop Lead bloons."},{name:"White Hot Spikes",cost:500,stat:"canHitLead",amount:true,desc:"Can pop Lead bloons."},{name:"Hot Spikes",cost:3000,stat:"dmgType",amount:'fire',desc:"Spikes deal fire damage."},{name:"Perma-Spike",cost:5000,stat:"lifespan",amount:10,desc:"Spikes last 10s longer."},{name:"Apocalypse Spikes",cost:25000,stat:"damage",amount:10,desc:"Apocalyptic damage."}]
    },
    update(tower, dt) {
        if (tower.cooldown <= 0) { tower.fire(null); tower.cooldown = tower.stats.fireRate / (1 + tower.buffedFireRate); }
    },
    fire(tower, target, damage, dmgType) {
        let point = null;
        let validSegments = [];
        let effRange = tower.stats.range * RANGE_SCALE * (1 + tower.buffedRange);
        for (let i = 0; i < GameEngine.map.waypoints.length - 1; i++) {
            const p1 = GameEngine.map.waypoints[i], p2 = GameEngine.map.waypoints[i + 1];
            if (Utils.distToSegment(tower.x, tower.y, p1.x, p1.y, p2.x, p2.y) <= effRange) {
                validSegments.push({ p1, p2 });
            }
        }
        if (validSegments.length > 0) {
            const seg = validSegments[Math.floor(Math.random() * validSegments.length)];
            let t = Math.random();
            point = { x: Utils.lerp(seg.p1.x, seg.p2.x, t), y: Utils.lerp(seg.p1.y, seg.p2.y, t) };
        } else {
            point = GameEngine.map.getNearestPathPoint(tower.x, tower.y);
        }
        GameEngine.projectiles.push(new Projectile(point.x, point.y, damage, null, 'spike', 0, tower.stats.pierce, tower.stats.lifespan, 0, null, 0, tower, dmgType));
    }
};