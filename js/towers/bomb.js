// js/towers/bomb.js

// We must import GameEngine and Projectile so this file can talk to the main game.
import { GameEngine } from '../engine.js';
import { Projectile } from '../projectile.js';

export default {
    // STATS: This is the base profile for a Level 0 Bomb Shooter.
    // The engine reads this object the moment you place the tower.
    stats: { 
        name: "Bomb Shooter", 
        cost: 375, 
        range: 40,                 // Targeting radius in BTD6 units (multiplied by RANGE_SCALE in engine)
        fireRate: 1.5,             // Attack cooldown in seconds (Shoots every 1.5s)
        damage: 1,                 // Direct hit damage (usually irrelevant for bombs, explosionDamage is used instead)
        pierce: 1,                 // How many bloons the bomb projectile itself hits before falling
        projectileSpeed: 300,      // How fast the bomb arcs through the air
        explosionRadius: 36,       // The radius of the blast in pixels
        explosionDamage: 1,        // How much damage bloons inside the blast take
        explosionPierce: 40,       // IMPORTANT: How many bloons the explosion can hit. Without this, it hits 0!
        lifespan: 1.0,             // How long the bomb lives before disappearing if it hits nothing
        canHitLead: true,          // Bypasses the Lead bloon immunity
        desc: "Launches a powerful bomb at the Bloons. Slow rate of fire but affects a radius around the explosion.", 
        dmgType: 'explosion',      // Tells the engine this is explosion damage (used for Black/Zebra immunities)
        hitRadius: 18              // The clickable circle size when you try to select the placed tower
    },
    
    // UPGRADES: The engine reads these arrays when you click an upgrade button.
    // 'stat' is the exact key from the stats object above that you want to change.
    // 'amount' is the value added to that stat (use negative numbers to subtract).
    upgrades: {
        1: [ // PATH 1: Blast Size & Damage
            { name: "Bigger Bombs", cost: 250, stat: "explosionRadius", amount: 6, desc: "Shoots larger bombs, they have a larger blast area and more popping power." },
            { name: "Frag Bombs", cost: 650, stat: "explosionDamage", amount: 1, desc: "Deals 1 extra explosion damage." },
            { name: "Bloon Impact", cost: 1100, stat: "explosionRadius", amount: 30, desc: "Huge explosion radius." }, 
            { name: "Cluster Bombs", cost: 2800, stat: "explosionDamage", amount: 2, desc: "Deals 2 extra explosion damage." },
            { name: "Bloon Crush", cost: 55000, stat: "explosionDamage", amount: 10, desc: "Colossal explosion damage." }
        ],
        2: [ // PATH 2: Fire Rate & Range
            // EXAMPLE: To make this a 0.75x multiplier, we use amount: -0.375 
            // (1.5 - 0.375 = 1.125s cooldown).
            { name: "Faster Reload", cost: 250, stat: "fireRate", amount: -0.375, desc: "Reloads faster. (1.5 - 0.375 = 1.125s)" }, 
            { name: "Missile Launcher", cost: 400, stat: "fireRate", amount: -0.30, desc: "Exchanges bombs for missiles, which fire faster, fly faster, and increase range." , extraMods: { projectileSpeed: 50, range: 4}},
            { name: "MOAB Mauler", cost: 1000, stat: "range", amount: 40, desc: "Huge range increase." }, 
            { name: "MOAB Assassin", cost: 3450, stat: "fireRate", amount: -0.5, desc: "Reloads even faster." }, 
            { name: "MOAB Eliminator", cost: 28000, stat: "fireRate", amount: -0.5, desc: "Maximum reload speed." }
        ],
        3: [ // PATH 3: Camo & Alternate Damage
            { name: "Extra Range", cost: 200, stat: "canSeeCamo", amount: true, desc: "Can detect Camo bloons." }, 
            { name: "Frag Bombs", cost: 300, stat: "explosionDamage", amount: 2, desc: "Deals 2 extra explosion damage." }, 
            { name: "Cluster Bombs", cost: 700, stat: "explosionDamage", amount: 5, desc: "Deals colossal explosion damage." }, 
            { name: "Recursive Cluster", cost: 2500, stat: "explosionRadius", amount: 50, desc: "Massive explosion radius." }, 
            { name: "Bomb Blitz", cost: 23000, stat: "explosionDamage", amount: 20, desc: "Apocalyptic damage." }
        ]
    },
    
    // FIRE: This function is called by the engine every time the cooldown reaches 0.
    // It receives the tower instance, the target bloon, and the calculated damage/types.
    fire(tower, target, damage, dmgType, isCrit, effects) {
        // We create a new Projectile instance and push it into the game's projectile array.
        // We pass in all the tower's current stats so the projectile knows how fast to fly, 
        // how long to live, and what kind of explosion to create when it hits.
        GameEngine.projectiles.push(new Projectile(
            tower.x,                        // Spawn X
            tower.y,                        // Spawn Y
            damage,                         // Base damage
            target,                         // The bloon it is seeking
            'bomb',                         // Projectile type (used for sprite name and collision logic)
            tower.stats.projectileSpeed,    // Speed
            tower.stats.pierce,             // Pierce
            tower.stats.lifespan,           // Lifespan
            null,                           // fixedAngle (null means it aims at the target)
            null,                           // effects (DoTs, slows, etc)
            0,                              // angleOffset (0 means straight at target)
            tower,                          // The tower that fired it (used for granting pop cash/XP)
            dmgType                         // Damage type object (isExplosion, canHitLead, etc)
        ));
    }
};