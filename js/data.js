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
    10:{ color: '#9b59b6', radius: 18, size: 36, speed: 130, nextTier: null, isPurple: true, livesLost: 3, rbe: 11, maxHp: 1, splitsInto: [{tier: 5, count: 2}], blocksDamageType: (d) => (d.isPlasma || d.isEnergy || d.isFire || d.isMagic) && !d.canHitPurple },
    11:{ color: '#e74c3c', radius: 20, size: 40, speed: 100, nextTier: null, isRainbow: true, livesLost: 12, rbe: 47, maxHp: 1, splitsInto: [{tier: 9, count: 2}] }, 
    12:{ color: '#e67e22', radius: 20, size: 40, speed: 80, nextTier: null, isCeramic: true, livesLost: 26, rbe: 104, maxHp: 10, splitsInto: [{tier: 11, count: 2}] }, 
    13:{ color: '#2c3e50', radius: 35, size: 115, speed: 40, nextTier: null, isMoab: true, livesLost: 154, rbe: 616, maxHp: 200, splitsInto: [{tier: 12, count: 4}], spriteOffsetX: 0, spriteOffsetY: 0 }, 
    14:{ color: '#e74c3c', radius: 50, size: 140, speed: 30, nextTier: null, isMoab: true, livesLost: 791, rbe: 3164, maxHp: 700, splitsInto: [{tier: 13, count: 4}], spriteOffsetX: 0, spriteOffsetY: 0 }, 
    15:{ color: '#27ae60', radius: 70, size: 170, speed: 20, nextTier: null, isMoab: true, livesLost: 4164, rbe: 16656, maxHp: 4000, splitsInto: [{tier: 14, count: 4}], spriteOffsetX: 0, spriteOffsetY: 0 },
    16:{ color: '#2c3e50', radius: 35, size: 90, speed: 110, nextTier: null, isMoab: true, isDDT: true, livesLost: 816, rbe: 816, maxHp: 400, splitsInto: [{tier: 12, count: 4, forceCamo: true, forceRegen: true}], blocksDamageType: (d) => d.isExplosion || d.isSharp, spriteOffsetX: 0, spriteOffsetY: 0 },
    17:{ color: '#e74c3c', radius: 70, size: 170, speed: 15, nextTier: null, isMoab: true, isBAD: true, livesLost: 55760, rbe: 55760, maxHp: 20000, splitsInto: [{tier: 15, count: 2}, {tier: 16, count: 3}], spriteOffsetX: 0, spriteOffsetY: 0 }
};

// NEW TIMELINE WAVE SYSTEM
// t: Bloon Tier, c: Count, s: Start Time (s), e: End Time (s), camo, regen, fort
export const Waves = [
    // Round 1
    { groups: [ {t:1, c:20, s:0, e:17.51} ] },
    // Round 2
    { groups: [ {t:1, c:30, s:0, e:19} ] },
    // Round 3
    { groups: [ 
        {t:1, c:10, s:0, e:5.1}, {t:2, c:5, s:5.7, e:7.95}, {t:1, c:15, s:9.71, e:16.71} 
    ] },
    // Round 4
    { groups: [ 
        {t:1, c:25, s:0, e:12}, {t:2, c:18, s:7.9, e:10.4}, {t:1, c:10, s:14.51, e:17.31} 
    ] },
    // Round 5
    { groups: [ 
        {t:2, c:12, s:0, e:5.14}, {t:1, c:5, s:5.7, e:7.98}, {t:2, c:15, s:8.6, e:16.5} 
    ] },
    // Round 6
    { groups: [ 
        {t:3, c:4, s:0, e:1.71}, {t:1, c:15, s:5.33, e:10.33}, {t:2, c:15, s:10.8, e:18.7} 
    ] },
    // Round 7
    { groups: [ 
        {t:2, c:10, s:0, e:5.14}, {t:3, c:5, s:5.7, e:10.65}, {t:1, c:20, s:11.81, e:22.65}, {t:2, c:10, s:22.81, e:26.8} 
    ] },
    // Round 8
    { groups: [ 
        {t:2, c:20, s:0, e:10.84}, {t:3, c:2, s:11.42, e:11.99}, {t:1, c:10, s:14.03, e:16}, {t:3, c:12, s:18.27, e:28.87} 
    ] },
    // Round 9
    { groups: [ {t:3, c:30, s:0, e:18.95} ] },
    // Round 10
    { groups: [ 
        {t:2, c:60, s:0, e:35}, {t:2, c:20, s:35, e:44}, {t:2, c:22, s:44, e:47.99} 
    ] },

    // --- GENERATED ESCALATION WAVES (11-40) ---
    // Round 11
    { groups: [ {t:4, c:20, s:0, e:20}, {t:3, c:10, s:10, e:20} ] },
    // Round 12
    { groups: [ {t:4, c:30, s:0, e:25} ] },
    // Round 13
    { groups: [ {t:4, c:20, s:0, e:15}, {t:5, c:10, s:15, e:20}, {t:4, c:10, s:20, e:25} ] },
    // Round 14
    { groups: [ {t:5, c:20, s:0, e:20}, {t:6, c:10, s:10, e:20} ] },
    // Round 15
    { groups: [ {t:5, c:30, s:0, e:20}, {t:7, c:10, s:10, e:20} ] },
    // Round 16
    { groups: [ {t:6, c:20, s:0, e:20}, {t:7, c:20, s:10, e:20} ] },
    // Round 17
    { groups: [ {t:8, c:10, s:0, e:15}, {t:5, c:20, s:5, e:20} ] },
    // Round 18
    { groups: [ {t:9, c:10, s:0, e:15}, {t:6, c:10, s:10, e:20} ] },
    // Round 19
    { groups: [ {t:10, c:10, s:0, e:15}, {t:7, c:10, s:10, e:20} ] },
    // Round 20
    { groups: [ {t:13, c:1, s:0, e:0}, {t:4, c:30, s:5, e:20} ] }, // First MOAB
    // Round 21
    { groups: [ {t:8, c:20, s:0, e:20}, {t:9, c:10, s:10, e:20} ] },
    // Round 22
    { groups: [ {t:10, c:20, s:0, e:20}, {t:8, c:10, s:10, e:20} ] },
    // Round 23
    { groups: [ {t:8, c:20, s:0, e:15, fort:true}, {t:9, c:10, s:15, e:20} ] },
    // Round 24
    { groups: [ {t:5, c:40, s:0, e:20, camo:true} ] },
    // Round 25
    { groups: [ {t:8, c:30, s:0, e:20, fort:true}, {t:10, c:20, s:10, e:20} ] },
    // Round 26
    { groups: [ {t:12, c:10, s:0, e:20}, {t:8, c:20, s:10, e:20} ] },
    // Round 27
    { groups: [ {t:12, c:20, s:0, e:20}, {t:8, c:10, s:10, e:20, camo:true} ] },
    // Round 28
    { groups: [ {t:13, c:3, s:0, e:20}, {t:12, c:10, s:10, e:20} ] },
    // Round 29
    { groups: [ {t:12, c:20, s:0, e:20}, {t:5, c:20, s:10, e:20, regen:true} ] },
    // Round 30
    { groups: [ {t:13, c:5, s:0, e:20}, {t:12, c:20, s:5, e:20} ] },
    // Round 31
    { groups: [ {t:14, c:1, s:0, e:0}, {t:12, c:20, s:5, e:20} ] }, // First BFB
    // Round 32
    { groups: [ {t:12, c:30, s:0, e:20, fort:true} ] },
    // Round 33
    { groups: [ {t:12, c:40, s:0, e:20, camo:true, regen:true} ] },
    // Round 34
    { groups: [ {t:13, c:10, s:0, e:20}, {t:8, c:30, s:10, e:20, fort:true} ] },
    // Round 35
    { groups: [ {t:13, c:10, s:0, e:20}, {t:12, c:30, s:5, e:20} ] },
    // Round 36
    { groups: [ {t:14, c:2, s:0, e:20}, {t:13, c:10, s:5, e:20} ] },
    // Round 37
    { groups: [ {t:12, c:50, s:0, e:20, fort:true} ] },
    // Round 38
    { groups: [ {t:13, c:20, s:0, e:20}, {t:12, c:20, s:10, e:20} ] },
    // Round 39
    { groups: [ {t:14, c:4, s:0, e:20}, {t:13, c:10, s:5, e:20} ] },
    // Round 40
    { groups: [ {t:14, c:1, s:0, e:0}, {t:13, c:10, s:5, e:15}, {t:12, c:20, s:15, e:20} ] } 
];

export let Maps = [
    { name: "The Park", image: "park", waypoints: [{x:-20,y:150},{x:200,y:150},{x:200,y:450},{x:450,y:450},{x:450,y:100},{x:680,y:100}], props: [ {type:'tree',x:100,y:50}, {type:'tree',x:600,y:400}, {type:'bush',x:350,y:250}, {type:'rock',x:100,y:500}, {type:'pond',x:550,y:300} ] },
    { name: "The Ripples", image: "ripples", waypoints: [{x:-20,y:300},{x:150,y:300},{x:150,y:100},{x:400,y:100},{x:400,y:500},{x:550,y:500},{x:550,y:300},{x:680,y:300}], props: [ {type:'tree',x:50,y:500}, {type:'tree',x:600,y:100}, {type:'rock',x:250,y:300}, {type:'bush',x:500,y:400}, {type:'pond',x:50,y:100} ] },
    { name: "The Maze", waypoints: [{x:-20,y:50},{x:600,y:50},{x:600,y:150},{x:100,y:150},{x:100,y:250},{x:600,y:250},{x:600,y:350},{x:100,y:350},{x:100,y:450},{x:600,y:450},{x:600,y:550},{x:-20,y:550}], props: [ {type:'tree',x:300,y:100}, {type:'tree',x:300,y:300}, {type:'rock',x:300,y:500} ] },
    { name: "The Spiral", waypoints: [{x:-20,y:300},{x:150,y:300},{x:150,y:100},{x:300,y:100},{x:300,y:500},{x:150,y:500},{x:150,y:300},{x:400,y:300},{x:400,y:100},{x:550,y:100},{x:550,y:500},{x:400,y:500},{x:400,y:300},{x:680,y:300}], props: [ {type:'tree',x:50,y:50}, {type:'tree',x:650,y:500}, {type:'bush',x:250,y:300} ] },
    { name: "The Intersection", waypoints: [{x:300,y:-20},{x:300,y:200},{x:100,y:200},{x:100,y:400},{x:300,y:400},{x:300,y:550},{x:400,y:550},{x:400,y:400},{x:600,y:400},{x:600,y:200},{x:400,y:200},{x:400,y:-20}], props: [ {type:'rock',x:200,y:300}, {type:'pond',x:500,y:300} ] }
];