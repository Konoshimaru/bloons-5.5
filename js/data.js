// data.js
import { deepFreeze } from './utils.js';
import { EnemyTypesData } from './bloons.js';
import { WavesData } from './waves.js';

export const EnemyTypes = deepFreeze(EnemyTypesData);
export const Waves = deepFreeze(WavesData);

let _maps = [
    {
        "name": "Monkey Meadow",
        "paths": [
            {
                "waypoints": [
                    { "x": 0, "y": 310 },
                    { "x": 540, "y": 310 },
                    { "x": 530, "y": 160 },
                    { "x": 360, "y": 150 },
                    { "x": 360, "y": 580 },
                    { "x": 180, "y": 580 },
                    { "x": 180, "y": 420 },
                    { "x": 680, "y": 420 },
                    { "x": 700, "y": 260, "curve": { "cx": 690, "cy": 390 } },
                    { "x": 820, "y": 260 },
                    { "x": 800, "y": 520, "curve": { "cx": 830, "cy": 470 } },
                    { "x": 480, "y": 530 },
                    { "x": 480, "y": 720 }
                ],
                "visible": false
            }
        ],
        "props": [],
        "waterBrushes": [],
        "imageScale": 0.85,
        "imageOffsetX": 0,
        "imageOffsetY": -25,
        "image": "monkey_meadow",
        "imageMaintainRatio": true
    },
    { name: "The Park", image: "park", paths: [{ waypoints: [{x:-24,y:180},{x:240,y:180},{x:240,y:540},{x:540,y:540},{x:540,y:120},{x:816,y:120}] }], props: [ {type:'tree',x:120,y:60}, {type:'tree',x:720,y:480}, {type:'bush',x:420,y:300}, {type:'rock',x:120,y:600}, {type:'pond',x:660,y:360, r:36} ] },
    { name: "The Ripples", image: "ripples", paths: [{ waypoints: [{x:-24,y:360},{x:180,y:360},{x:180,y:120},{x:480,y:120},{x:480,y:600},{x:660,y:600},{x:660,y:360},{x:816,y:360}] }], props: [ {type:'tree',x:60,y:600}, {type:'tree',x:720,y:120}, {type:'rock',x:300,y:360}, {type:'bush',x:600,y:480}, {type:'pond',x:60,y:120, r:36} ] },
    { name: "The Maze", paths: [{ waypoints: [{x:-24,y:60},{x:720,y:60},{x:720,y:180},{x:120,y:180},{x:120,y:300},{x:720,y:300},{x:720,y:420},{x:120,y:420},{x:120,y:540},{x:720,y:540},{x:720,y:660},{x:-24,y:660}] }], props: [ {type:'tree',x:360,y:120}, {type:'tree',x:360,y:360}, {type:'rock',x:360,y:600} ] },
    { name: "The Spiral", paths: [{ waypoints: [{x:-24,y:360},{x:180,y:360},{x:180,y:120},{x:360,y:120},{x:360,y:600},{x:180,y:600},{x:180,y:360},{x:480,y:360},{x:480,y:120},{x:660,y:120},{x:660,y:600},{x:480,y:600},{x:480,y:360},{x:816,y:360}] }], props: [ {type:'tree',x:60,y:60}, {type:'tree',x:780,y:600}, {type:'bush',x:300,y:360} ] },
    { name: "The Intersection", paths: [{ waypoints: [{x:360,y:-24},{x:360,y:240},{x:120,y:240},{x:120,y:480},{x:360,y:480},{x:360,y:660},{x:480,y:660},{x:480,y:480},{x:720,y:480},{x:720,y:240},{x:480,y:240},{x:480,y:-24}] }], props: [ {type:'rock',x:240,y:360}, {type:'pond',x:600,y:360, r:36} ] }
];

_maps.forEach(m => deepFreeze(m));
export let Maps = _maps;