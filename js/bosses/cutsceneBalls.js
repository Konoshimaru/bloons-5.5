// js/bosses/cutsceneBalls.js
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants.js';

const ballCanvas = document.createElement('canvas');
ballCanvas.width = CANVAS_WIDTH;
ballCanvas.height = CANVAS_HEIGHT;
const ballCtx = ballCanvas.getContext('2d');

const ballOutlineCanvas = document.createElement('canvas');
ballOutlineCanvas.width = CANVAS_WIDTH;
ballOutlineCanvas.height = CANVAS_HEIGHT;
const ballOutlineCtx = ballOutlineCanvas.getContext('2d');

window.BallsConfig = {
    giantCount: 30,       giantMinR: 80,        giantMaxR: 100,       giantOffsetX: 10,
    massCount: 2000,      massMinR: 10,         massMaxR: 40,         massOffsetX: 50,
    drifterCount: 100,    drifterMinR: 10,      drifterMaxR: 40,      drifterSpeed: 60,
    drifterFadeRate: 2,   drifterShrinkRate: 50,
    spreadX: 200,         outlineWidth: 4,      screenOffset: 0
};

const CutsceneBalls = {
    blackBalls: [],
    ballCenterX: -500,

    init() {
        const cfg = window.BallsConfig || {};
        this.blackBalls = [];
        this.ballCenterX = -500; 
        const spread = cfg.spreadX ?? 200;
        
        for(let i=0; i < (cfg.giantCount ?? 15); i++) {
            this.blackBalls.push({
                ox: (Math.random() - 0.5) * spread - (cfg.giantOffsetX ?? 300),
                oy: Math.random() * CANVAS_HEIGHT - CANVAS_HEIGHT / 2,
                r: (cfg.giantMinR ?? 50) + Math.random() * ((cfg.giantMaxR ?? 80) - (cfg.giantMinR ?? 50)),
                phase: Math.random() * Math.PI * 2,
                speed: 0.5 + Math.random() * 1,
                type: 'giant',
                alpha: 1.0
            });
        }
        
        for(let i=0; i < (cfg.massCount ?? 60); i++) {
            this.blackBalls.push({
                ox: (Math.random() - 0.5) * spread - (cfg.massOffsetX ?? 100), 
                oy: Math.random() * CANVAS_HEIGHT - CANVAS_HEIGHT / 2,
                r: (cfg.massMinR ?? 10) + Math.random() * ((cfg.massMaxR ?? 25) - (cfg.massMinR ?? 10)),
                phase: Math.random() * Math.PI * 2,
                speed: 1 + Math.random() * 2,
                type: 'mass',
                alpha: 1.0
            });
        }
        
        for(let i=0; i < (cfg.drifterCount ?? 30); i++) {
            this.blackBalls.push({
                ox: (Math.random() - 0.5) * spread,
                oy: Math.random() * CANVAS_HEIGHT - CANVAS_HEIGHT / 2,
                r: (cfg.drifterMinR ?? 8) + Math.random() * ((cfg.drifterMaxR ?? 20) - (cfg.drifterMinR ?? 8)),
                vx: (cfg.drifterSpeed ?? 150) + Math.random() * 50,
                phase: Math.random() * Math.PI * 2,
                speed: 2 + Math.random() * 3,
                type: 'drifter',
                alpha: 1.0
            });
        }
    },

    update(dt) {
        const cfg = window.BallsConfig || {};
        let targetX = cfg.screenOffset ?? 0;

        this.ballCenterX += (targetX - this.ballCenterX) * dt * 2.0;

        for(let b of this.blackBalls) {
            if (b.type === 'drifter') {
                b.ox += b.vx * dt;
                if (b.ox > 200) { 
                    b.r -= dt * (cfg.drifterShrinkRate ?? 30);
                    b.alpha -= dt * (cfg.drifterFadeRate ?? 0.5);
                    
                    if (b.r <= 0 || b.alpha <= 0) {
                        b.ox = -300;
                        b.oy = Math.random() * CANVAS_HEIGHT - CANVAS_HEIGHT / 2;
                        b.r = (cfg.drifterMinR ?? 8) + Math.random() * ((cfg.drifterMaxR ?? 20) - (cfg.drifterMinR ?? 8));
                        b.alpha = 1.0;
                    }
                }
            }
        }
    },

    draw(ctx) {
        const cfg = window.BallsConfig || {};
        ballCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ballOutlineCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const outlineWidth = cfg.outlineWidth ?? 4;
        const time = performance.now() / 1000;

        const getPos = (b) => {
            let sx = this.ballCenterX + b.ox + Math.sin(time * b.speed + b.phase) * 10;
            let sy = (CANVAS_HEIGHT / 2) + b.oy + Math.cos(time * b.speed + b.phase) * 10;
            return { x: sx, y: sy };
        };

        ballOutlineCtx.fillStyle = '#ffffff';
        for (let b of this.blackBalls) {
            if (b.r > 0) {
                let p = getPos(b);
                ballOutlineCtx.globalAlpha = b.alpha !== undefined ? b.alpha : 1.0;
                ballOutlineCtx.beginPath();
                ballOutlineCtx.arc(p.x, p.y, b.r, 0, Math.PI * 2);
                ballOutlineCtx.fill();
            }
        }
        ballOutlineCtx.globalAlpha = 1.0;

        ballOutlineCtx.globalCompositeOperation = 'destination-out';
        ballOutlineCtx.fillStyle = '#000000';
        for (let b of this.blackBalls) {
            let innerR = Math.max(0, b.r - outlineWidth);
            if (innerR > 0) {
                let p = getPos(b);
                ballOutlineCtx.globalAlpha = b.alpha !== undefined ? b.alpha : 1.0;
                ballOutlineCtx.beginPath();
                ballOutlineCtx.arc(p.x, p.y, innerR, 0, Math.PI * 2);
                ballOutlineCtx.fill();
            }
        }
        ballOutlineCtx.globalCompositeOperation = 'source-over';
        ballOutlineCtx.globalAlpha = 1.0;

        ballCtx.fillStyle = '#000000';
        for (let b of this.blackBalls) {
            if (b.r > 0) {
                let p = getPos(b);
                ballCtx.globalAlpha = b.alpha !== undefined ? b.alpha : 1.0;
                ballCtx.beginPath();
                ballCtx.arc(p.x, p.y, b.r, 0, Math.PI * 2);
                ballCtx.fill();
            }
        }
        ballCtx.globalAlpha = 1.0;

        ctx.drawImage(ballCanvas, 0, 0);
        ctx.drawImage(ballOutlineCanvas, 0, 0);
    },

    reset() {
        this.blackBalls = [];
        this.ballCenterX = -500;
    }
};

export default CutsceneBalls;