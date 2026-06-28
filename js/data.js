export const EnemyTypes = {
    1: { color: '#e74c3c', radius: 12, size: 24, speed: 60, nextTier: null, livesLost: 1, rbe: 1, maxHp: 1 }, 
    2: { color: '#3498db', radius: 14, size: 28, speed: 80, nextTier: 1, livesLost: 1, rbe: 2, maxHp: 1 },   
    3: { color: '#2ecc71', radius: 16, size: 32, speed: 120, nextTier: 2, livesLost: 1, rbe: 3, maxHp: 1 },  
    4: { color: '#f1c40f', radius: 18, size: 36, speed: 180, nextTier: 3, livesLost: 1, rbe: 4, maxHp: 1 },  
    5: { color: '#ff00ff', radius: 20, size: 40, speed: 240, nextTier: 4, livesLost: 1, rbe: 5, maxHp: 1 },  
    6: { color: '#2c3e50', radius: 12, size: 32, speed: 100, nextTier: null, isBlack: true, livesLost: 3, rbe: 11, maxHp: 1, splitsInto: [{tier: 5, count: 2}], blocksDamageType: (d) => d.isExplosion }, 
    7: { color: '#ffffff', radius: 12, size: 32, speed: 110, nextTier: null, isWhite: true, livesLost: 3, rbe: 11, maxHp: 1, splitsInto: [{tier: 5, count: 2}], blocksDamageType: (d) => d.isIce }, 
    8: { color: '#95a5a6', radius: 18, size: 32, speed: 50, nextTier: null, isLead: true, livesLost: 6, rbe: 23, maxHp: 1, splitsInto: [{tier: 6, count: 2}], blocksDamageType: (d) => d.isSharp && !d.canHitLead },
    9: { color: '#bdc3c7', radius: 18, size: 36, speed: 120, nextTier: null, isZebra: true, livesLost: 6, rbe: 23, maxHp: 1, splitsInto: [{tier: 6, count: 1}, {tier: 7, count: 1}], blocksDamageType: (d) => d.isExplosion || d.isIce }, 
    10:{ color: '#9b59b6', radius: 18, size: 36, speed: 130, nextTier: null, isPurple: true, livesLost: 3, rbe: 11, maxHp: 1, splitsInto: [{tier: 5, count: 2}], blocksDamageType: (d) => d.isPlasma || d.isEnergy || d.isFire || d.isMagic }, 
    11:{ color: '#e74c3c', radius: 20, size: 40, speed: 100, nextTier: null, isRainbow: true, livesLost: 12, rbe: 47, maxHp: 1, splitsInto: [{tier: 9, count: 2}] }, 
    12:{ color: '#e67e22', radius: 20, size: 40, speed: 80, nextTier: null, isCeramic: true, livesLost: 26, rbe: 104, maxHp: 10, splitsInto: [{tier: 11, count: 2}] }, 
    13:{ color: '#2c3e50', radius: 35, size: 115, speed: 40, nextTier: null, isMoab: true, livesLost: 154, rbe: 616, maxHp: 200, splitsInto: [{tier: 12, count: 4}], spriteOffsetX: 0, spriteOffsetY: 0 }, 
    14:{ color: '#e74c3c', radius: 50, size: 140, speed: 30, nextTier: null, isMoab: true, livesLost: 791, rbe: 3164, maxHp: 700, splitsInto: [{tier: 13, count: 4}], spriteOffsetX: 0, spriteOffsetY: 0 }, 
    15:{ color: '#27ae60', radius: 70, size: 170, speed: 20, nextTier: null, isMoab: true, livesLost: 4164, rbe: 16656, maxHp: 4000, splitsInto: [{tier: 14, count: 4}], spriteOffsetX: 0, spriteOffsetY: 0 },
    16:{ color: '#2c3e50', radius: 35, size: 90, speed: 110, nextTier: null, isMoab: true, isDDT: true, livesLost: 816, rbe: 816, maxHp: 400, splitsInto: [{tier: 12, count: 4, forceCamo: true, forceRegen: true}], blocksDamageType: (d) => d.isExplosion || d.isSharp, spriteOffsetX: 0, spriteOffsetY: 0 },
    17:{ color: '#e74c3c', radius: 70, size: 170, speed: 15, nextTier: null, isMoab: true, isBAD: true, livesLost: 55760, rbe: 55760, maxHp: 20000, splitsInto: [{tier: 15, count: 2}, {tier: 16, count: 3}], spriteOffsetX: 0, spriteOffsetY: 0 }
};

export const Waves = [
    { r: 20 }, { r: 35 }, { r: 25, b: 5 }, { r: 35, b: 18 }, { r: 5, b: 27 }, { r: 15, b: 15, g: 4 }, { r: 20, b: 20, g: 5 }, { r: 10, b: 20, g: 14 }, { g: 30 }, { b: 102 },
    { r: 10, b: 10, g: 12, y: 3 }, { b: 15, g: 10, y: 5 }, { b: 50, g: 23 }, { r: 49, b: 15, g: 10, y: 9 }, { r: 20, b: 15, g: 12, y: 10, p: 5 }, { g: 40, y: 8 }, { y: 12, reg: ['y'] }, { g: 80 }, { g: 10, y: 4, y2: 5, p: 15, reg: ['y2'] }, { bl: 6 },
    { y: 40, p: 14 }, { w: 16 }, { bl: 7, w: 7 }, { b: 20, g: 1, camo: ['g'] }, { y: 25, pu: 10, reg: ['y'] }, { p: 23, z: 4 }, { r: 100, b: 60, g: 45, y: 45 }, { l: 6 }, { y: 50, y2: 15, reg: ['y2'] }, { l: 9 },
    { bl: 8, w: 8, z: 8, z2: 2, reg: ['z2'] }, { bl: 15, w: 20, pu: 10 }, { r: 20, y: 13, camo: ['r', 'y'] }, { y: 160, z: 6 }, { p: 35, bl: 30, w: 25, rb: 5 }, { p: 140, g: 20, camo: ['g'], reg: ['g'] }, { bl: 25, w: 25, w2: 7, z: 10, l: 15, camo: ['w2'] }, { p: 42, w: 17, z: 10, l: 14, c: 2 }, { bl: 10, w: 10, z: 20, rb: 18, rb2: 2, reg: ['rb2'] }, { m: 1 },
    { bl: 60, z: 60 }, { rb: 6, rb2: 5, reg: ['rb'], camo: ['rb2'] }, { rb: 10, c: 7 }, { z: 50 }, { p: 180, pu: 10, l: 4, rb: 25, camo: ['pu'], fort: ['l'] }, { c: 6, fort: ['c'] }, { p: 70, c: 12, camo: ['p'] }, { p: 40, pu: 30, rb: 40, c: 3, reg: ['p', 'pu'], camo: ['pu'], fort: ['c'] }, { g: 343, z: 20, rb: 20, rb2: 10, c: 18, reg: ['rb2'] }, { r: 20, l: 8, c: 20, m: 2, fort: ['l'] },
    { rb: 10, c: 15, reg: ['rb'], camo: ['c'] }, { rb: 25, c: 10, m: 2 }, { p: 80, m: 3, camo: ['p'] }, { c: 35, m: 2 }, { c: 45, m: 1 }, { rb: 40, m: 1, camo: ['rb'] }, { rb: 40, m: 4 }, { c: 15, c2: 10, m: 5, fort: ['c2'] }, { l: 50, c: 20, c2: 10, camo: ['l'], reg: ['c2'] }, { bfb: 1 }
];

export let Maps = [
    { name: "The Park", image: "park", waypoints: [{x:-20,y:150},{x:200,y:150},{x:200,y:450},{x:450,y:450},{x:450,y:100},{x:680,y:100}], props: [ {type:'tree',x:100,y:50}, {type:'tree',x:600,y:400}, {type:'bush',x:350,y:250}, {type:'rock',x:100,y:500}, {type:'pond',x:550,y:300} ] },
    { name: "The Ripples", image: "ripples", waypoints: [{x:-20,y:300},{x:150,y:300},{x:150,y:100},{x:400,y:100},{x:400,y:500},{x:550,y:500},{x:550,y:300},{x:680,y:300}], props: [ {type:'tree',x:50,y:500}, {type:'tree',x:600,y:100}, {type:'rock',x:250,y:300}, {type:'bush',x:500,y:400}, {type:'pond',x:50,y:100} ] },
    { name: "The Maze", waypoints: [{x:-20,y:50},{x:600,y:50},{x:600,y:150},{x:100,y:150},{x:100,y:250},{x:600,y:250},{x:600,y:350},{x:100,y:350},{x:100,y:450},{x:600,y:450},{x:600,y:550},{x:-20,y:550}], props: [ {type:'tree',x:300,y:100}, {type:'tree',x:300,y:300}, {type:'rock',x:300,y:500} ] },
    { name: "The Spiral", waypoints: [{x:-20,y:300},{x:150,y:300},{x:150,y:100},{x:300,y:100},{x:300,y:500},{x:150,y:500},{x:150,y:300},{x:400,y:300},{x:400,y:100},{x:550,y:100},{x:550,y:500},{x:400,y:500},{x:400,y:300},{x:680,y:300}], props: [ {type:'tree',x:50,y:50}, {type:'tree',x:650,y:500}, {type:'bush',x:250,y:300} ] },
    { name: "The Intersection", waypoints: [{x:300,y:-20},{x:300,y:200},{x:100,y:200},{x:100,y:400},{x:300,y:400},{x:300,y:550},{x:400,y:550},{x:400,y:400},{x:600,y:400},{x:600,y:200},{x:400,y:200},{x:400,y:-20}], props: [ {type:'rock',x:200,y:300}, {type:'pond',x:500,y:300} ] }
];