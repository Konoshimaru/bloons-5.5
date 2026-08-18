// js/generatedMaps.js
// Procedurally-generated maps: single source of truth shared by the game
// (js/data.js) and the background-image generator (tools/gen-map-bgs.mjs).
//
// These maps are baked with their own themed background PNGs
// (sprites/maps/<image>.png + <image>_night.png). Each map sets
// imageScale:1 / offsets:0 / imageMaintainRatio:false so a 1280x720 PNG fills
// the canvas exactly. Paths are baked into the background image too, so every
// path here has `visible:false` (the engine never redraws it), matching how
// Monkey Meadow / Bloon Circles / Alpine Run / Park Path are authored.
//
// Props use the modern hitbox format ({type:'hitbox', shape, x, y, r}). The
// `decor` field is optional metadata read ONLY by the generator to draw the
// matching scenery into the background; the game ignores it and just uses the
// shape/radius for placement blocking.

export const GeneratedMaps = [
    {
        name: "The Ripples",
        image: "ripples",
        imageScale: 1,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageMaintainRatio: false,
        theme: "beach",
        paths: [{
            width: 45,
            visible: false,
            waypoints: [
                { x: 0, y: 380 }, { x: 200, y: 380 }, { x: 200, y: 200 },
                { x: 440, y: 200 }, { x: 440, y: 520 }, { x: 680, y: 520 },
                { x: 680, y: 300 }, { x: 920, y: 300 }, { x: 920, y: 560 },
                { x: 1160, y: 560 }, { x: 1160, y: 380 }, { x: 1280, y: 380 }
            ]
        }],
        props: [
            { type: 'hitbox', shape: 'circle', x: 100, y: 620, r: 26, decor: 'palm' },
            { type: 'hitbox', shape: 'circle', x: 980, y: 120, r: 26, decor: 'palm' },
            { type: 'hitbox', shape: 'circle', x: 1180, y: 620, r: 22, decor: 'palm' },
            { type: 'hitbox', shape: 'circle', x: 320, y: 80, r: 18, decor: 'rock' },
            { type: 'hitbox', shape: 'circle', x: 760, y: 620, r: 20, decor: 'rock' },
            { type: 'hitbox', shape: 'circle', x: 100, y: 80, r: 18, decor: 'bush' },
            { type: 'hitbox', shape: 'circle', x: 600, y: 380, r: 16, decor: 'bush' }
        ],
        waterBrushes: [
            { thickness: 110, points: [{ x: 1180, y: 120 }, { x: 1210, y: 140 }] },
            { thickness: 90, points: [{ x: 60, y: 480 }, { x: 90, y: 500 }] }
        ]
    },
    {
        name: "The Maze",
        image: "maze",
        imageScale: 1,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageMaintainRatio: false,
        theme: "hedge",
        paths: [{
            width: 45,
            visible: false,
            waypoints: [
                { x: 0, y: 60 }, { x: 1000, y: 60 }, { x: 1000, y: 180 },
                { x: 200, y: 180 }, { x: 200, y: 300 }, { x: 1000, y: 300 },
                { x: 1000, y: 420 }, { x: 200, y: 420 }, { x: 200, y: 540 },
                { x: 1000, y: 540 }, { x: 1000, y: 660 }, { x: 0, y: 660 }
            ]
        }],
        props: [
            { type: 'hitbox', shape: 'circle', x: 500, y: 120, r: 22, decor: 'hedge' },
            { type: 'hitbox', shape: 'circle', x: 500, y: 240, r: 22, decor: 'hedge' },
            { type: 'hitbox', shape: 'circle', x: 500, y: 360, r: 22, decor: 'hedge' },
            { type: 'hitbox', shape: 'circle', x: 500, y: 480, r: 22, decor: 'hedge' },
            { type: 'hitbox', shape: 'circle', x: 500, y: 600, r: 22, decor: 'hedge' },
            { type: 'hitbox', shape: 'circle', x: 1200, y: 80, r: 24, decor: 'tree' },
            { type: 'hitbox', shape: 'circle', x: 1200, y: 640, r: 24, decor: 'tree' },
            { type: 'hitbox', shape: 'circle', x: 80, y: 360, r: 24, decor: 'tree' }
        ],
        waterBrushes: []
    },
    {
        name: "The Spiral",
        image: "spiral",
        imageScale: 1,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageMaintainRatio: false,
        theme: "desert",
        paths: [{
            width: 45,
            visible: false,
            waypoints: [
                { x: -38, y: 360 }, { x: 282, y: 360 }, { x: 282, y: 188 },
                { x: 565, y: 188 }, { x: 565, y: 600 }, { x: 282, y: 600 },
                { x: 282, y: 360 }, { x: 753, y: 360 }, { x: 753, y: 188 },
                { x: 1035, y: 188 }, { x: 1035, y: 600 }, { x: 753, y: 600 },
                { x: 753, y: 360 }, { x: 1280, y: 360 }
            ]
        }],
        props: [
            { type: 'hitbox', shape: 'circle', x: 80, y: 80, r: 20, decor: 'cactus' },
            { type: 'hitbox', shape: 'circle', x: 1100, y: 80, r: 20, decor: 'cactus' },
            { type: 'hitbox', shape: 'circle', x: 1200, y: 620, r: 22, decor: 'cactus' },
            { type: 'hitbox', shape: 'circle', x: 60, y: 620, r: 22, decor: 'rock' },
            { type: 'hitbox', shape: 'circle', x: 640, y: 380, r: 16, decor: 'rock' }
        ],
        waterBrushes: [
            { thickness: 70, points: [{ x: 120, y: 360 }] }
        ]
    },
    {
        name: "The Intersection",
        image: "intersection",
        imageScale: 1,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageMaintainRatio: false,
        theme: "city",
        paths: [{
            width: 45,
            visible: false,
            waypoints: [
                { x: 560, y: -40 }, { x: 560, y: 260 }, { x: 260, y: 260 },
                { x: 260, y: 460 }, { x: 560, y: 460 }, { x: 560, y: 720 },
                { x: 760, y: 720 }, { x: 760, y: 460 }, { x: 1060, y: 460 },
                { x: 1060, y: 260 }, { x: 760, y: 260 }, { x: 760, y: -40 }
            ]
        }],
        props: [
            { type: 'hitbox', shape: 'box', x: 160, y: 120, w: 110, h: 110, decor: 'building' },
            { type: 'hitbox', shape: 'box', x: 1120, y: 120, w: 110, h: 110, decor: 'building' },
            { type: 'hitbox', shape: 'box', x: 160, y: 600, w: 110, h: 110, decor: 'building' },
            { type: 'hitbox', shape: 'box', x: 1120, y: 600, w: 110, h: 110, decor: 'building' },
            { type: 'hitbox', shape: 'circle', x: 880, y: 360, r: 34, decor: 'fountain' }
        ],
        waterBrushes: [
            { thickness: 68, points: [{ x: 880, y: 360 }] }
        ]
    },
    {
        name: "Candy Lane",
        image: "candy_lane",
        imageScale: 1,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageMaintainRatio: false,
        theme: "candy",
        paths: [{
            width: 45,
            visible: false,
            waypoints: [
                { x: 0, y: 400 }, { x: 240, y: 400 }, { x: 240, y: 200 },
                { x: 520, y: 200 }, { x: 520, y: 540 }, { x: 320, y: 540 },
                { x: 320, y: 420 }, { x: 720, y: 420 }, { x: 720, y: 160 },
                { x: 1000, y: 160 }, { x: 1000, y: 480 }, { x: 780, y: 480 },
                { x: 780, y: 340 }, { x: 1180, y: 340 }, { x: 1180, y: 560 },
                { x: 1280, y: 560 }
            ]
        }],
        props: [
            { type: 'hitbox', shape: 'circle', x: 120, y: 620, r: 20, decor: 'lollipop' },
            { type: 'hitbox', shape: 'circle', x: 1100, y: 100, r: 20, decor: 'lollipop' },
            { type: 'hitbox', shape: 'circle', x: 620, y: 100, r: 20, decor: 'lollipop' },
            { type: 'hitbox', shape: 'circle', x: 120, y: 120, r: 22, decor: 'gumdrop' },
            { type: 'hitbox', shape: 'circle', x: 1160, y: 620, r: 22, decor: 'gumdrop' },
            { type: 'hitbox', shape: 'circle', x: 640, y: 640, r: 22, decor: 'gumdrop' }
        ],
        waterBrushes: [
            { thickness: 80, points: [{ x: 480, y: 700 }, { x: 540, y: 715 }] }
        ]
    },
    {
        name: "Winter Falls",
        image: "winter_falls",
        imageScale: 1,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageMaintainRatio: false,
        theme: "winter",
        paths: [{
            width: 45,
            visible: false,
            waypoints: [
                { x: 0, y: 160 }, { x: 280, y: 160 }, { x: 280, y: 380 },
                { x: 560, y: 380 }, { x: 560, y: 160 }, { x: 840, y: 160 },
                { x: 840, y: 520 }, { x: 560, y: 520 }, { x: 560, y: 660 },
                { x: 920, y: 660 }, { x: 920, y: 320 }, { x: 1180, y: 320 },
                { x: 1180, y: 640 }, { x: 1280, y: 640 }
            ]
        }],
        props: [
            { type: 'hitbox', shape: 'circle', x: 100, y: 620, r: 22, decor: 'pine' },
            { type: 'hitbox', shape: 'circle', x: 480, y: 80, r: 22, decor: 'pine' },
            { type: 'hitbox', shape: 'circle', x: 1080, y: 100, r: 22, decor: 'pine' },
            { type: 'hitbox', shape: 'circle', x: 1220, y: 600, r: 20, decor: 'rock' }
        ],
        waterBrushes: [
            { thickness: 62, color: '#9ecbe8', points: [{ x: 140, y: 420 }, { x: 240, y: 440 }] },
            { thickness: 62, color: '#9ecbe8', points: [{ x: 1080, y: 560 }, { x: 1180, y: 580 }] }
        ]
    },
    {
        name: "Volcanic Ridge",
        image: "volcanic_ridge",
        imageScale: 1,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageMaintainRatio: false,
        theme: "volcano",
        paths: [{
            width: 45,
            visible: false,
            waypoints: [
                { x: 0, y: 560 }, { x: 260, y: 560 }, { x: 260, y: 360 },
                { x: 520, y: 360 }, { x: 520, y: 560 }, { x: 780, y: 560 },
                { x: 780, y: 260 }, { x: 1040, y: 260 }, { x: 1040, y: 480 },
                { x: 1280, y: 480 }
            ]
        }],
        props: [
            { type: 'hitbox', shape: 'circle', x: 140, y: 180, r: 24, decor: 'rock' },
            { type: 'hitbox', shape: 'circle', x: 1180, y: 640, r: 24, decor: 'rock' },
            { type: 'hitbox', shape: 'circle', x: 520, y: 140, r: 20, decor: 'rock' },
            { type: 'hitbox', shape: 'circle', x: 820, y: 640, r: 22, decor: 'rock' }
        ],
        waterBrushes: [
            { thickness: 70, color: '#e67e22', points: [{ x: 120, y: 400 }, { x: 160, y: 420 }] },
            { thickness: 70, color: '#e67e22', points: [{ x: 1180, y: 200 }, { x: 1210, y: 220 }] }
        ]
    },
    {
        name: "Enchanted Forest",
        image: "enchanted_forest",
        imageScale: 1,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageMaintainRatio: false,
        theme: "forest",
        paths: [{
            width: 45,
            visible: false,
            waypoints: [
                { x: 0, y: 300 }, { x: 240, y: 300 }, { x: 240, y: 120 },
                { x: 520, y: 120 }, { x: 520, y: 420 }, { x: 260, y: 420 },
                { x: 260, y: 560 }, { x: 560, y: 560 }, { x: 560, y: 240 },
                { x: 820, y: 240 }, { x: 820, y: 500 }, { x: 1080, y: 500 },
                { x: 1080, y: 200 }, { x: 1280, y: 200 }
            ]
        }],
        props: [
            { type: 'hitbox', shape: 'circle', x: 100, y: 620, r: 26, decor: 'tree' },
            { type: 'hitbox', shape: 'circle', x: 1180, y: 620, r: 26, decor: 'tree' },
            { type: 'hitbox', shape: 'circle', x: 400, y: 620, r: 18, decor: 'mushroom' },
            { type: 'hitbox', shape: 'circle', x: 1080, y: 380, r: 18, decor: 'mushroom' },
            { type: 'hitbox', shape: 'circle', x: 80, y: 140, r: 18, decor: 'mushroom' }
        ],
        waterBrushes: [
            { thickness: 90, color: '#b39ddb', points: [{ x: 1220, y: 420 }, { x: 1250, y: 440 }] }
        ]
    },
    {
        name: "Neon Alley",
        image: "neon_alley",
        imageScale: 1,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageMaintainRatio: false,
        theme: "neon",
        paths: [{
            width: 45,
            visible: false,
            waypoints: [
                { x: 0, y: 120 }, { x: 300, y: 120 }, { x: 300, y: 320 },
                { x: 600, y: 320 }, { x: 600, y: 120 }, { x: 900, y: 120 },
                { x: 900, y: 480 }, { x: 600, y: 480 }, { x: 600, y: 600 },
                { x: 900, y: 600 }, { x: 900, y: 360 }, { x: 1200, y: 360 },
                { x: 1200, y: 560 }, { x: 1280, y: 560 }
            ]
        }],
        props: [
            { type: 'hitbox', shape: 'box', x: 140, y: 240, w: 100, h: 100, decor: 'neonBuilding' },
            { type: 'hitbox', shape: 'box', x: 470, y: 240, w: 100, h: 100, decor: 'neonBuilding' },
            { type: 'hitbox', shape: 'box', x: 760, y: 240, w: 100, h: 100, decor: 'neonBuilding' },
            { type: 'hitbox', shape: 'box', x: 1120, y: 480, w: 100, h: 100, decor: 'neonBuilding' },
            { type: 'hitbox', shape: 'circle', x: 760, y: 560, r: 22, decor: 'rock' }
        ],
        waterBrushes: [
            { thickness: 46, color: '#5f7cbd', points: [{ x: 1120, y: 140 }, { x: 1150, y: 160 }] }
        ]
    }
];