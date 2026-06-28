export default {
    stats: { name: "Sniper Monkey",   drawSize: 150 , cost: 350, range: 9999, fireRate: 2.0, damage: 3, isHitscan: true, desc: "Shoots globally with high damage. Slow fire rate.", dmgType: 'sharp', hitRadius: 18 },

    upgrades: {
        1: [{name:"Heavy Rounds",cost:400,stat:"damage",amount:2,desc:"Deals 2 extra damage."},{name:"Armor Piercing",cost:500,stat:"canHitLead",amount:true,desc:"Can pop Lead bloons."},{name:"Cripple MOAB",cost:3000,stat:"damage",amount:10,desc:"Deals colossal damage."},{name:"Mauler",cost:5000,stat:"damage",amount:20,desc:"Deals ultimate damage."},{name:"Tier V Sniper",cost:30000,stat:"damage",amount:50,desc:"Godlike damage."}], 
        2: [{name:"Faster Reload",cost:500,stat:"fireRate",amount:-0.5,desc:"Reloads faster."},{name:"Night Vision",cost:600,stat:"canSeeCamo",amount:true,desc:"Can detect Camo bloons."},{name:"Semi-Auto",cost:1500,stat:"fireRate",amount:-1.0,desc:"Very fast reload."},{name:"Full Auto",cost:3000,stat:"fireRate",amount:-0.5,desc:"Extremely fast reload."},{name:"Rapid Fire",cost:12000,stat:"fireRate",amount:-0.5,desc:"Maximum fire rate."}], 
        3: [{name:"Shrapnel Shot",cost:800,stat:"fireRate",amount:-0.3,desc:"Attacks faster."},{name:"Bouncing Bullet",cost:1200,stat:"fireRate",amount:-0.4,desc:"Attacks even faster."},{name:"Supply Drop",cost:6000,stat:"fireRate",amount:-0.6,desc:"Extreme attack speed."},{name:"Elite Sniper",cost:4000,stat:"damage",amount:5,desc:"Deals 5 extra damage."},{name:"Elite Defender",cost:25000,stat:"damage",amount:20,desc:"Deals massive damage."}]
    },
    fire(tower, target, damage, dmgType) {
        let dmg = target.takeDamage(damage, dmgType);
        tower.damageDealt += dmg;
        tower.hitscans.push({ x1: tower.x, y1: tower.y, x2: target.x, y2: target.y, life: 0.1 });
    }
};