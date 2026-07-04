// particle.js
// Implements particle effects for explosions and visual feedback.

import Assets from './assets.js';
import { Names } from './names.js';

const ALPHA_MAX = 1;
const BASE_SIZE = 45;

export class Particle {
    constructor() {
        this.active = false;
        this.reset();
    }

    init(x, y, color) {
        this.active = true;
        this.x = x;
        this.y = y;
        // Random velocity between -75 and 75
        this.vx = (Math.random() - 0.5) * 150;
        this.vy = (Math.random() - 0.5) * 150;
        this.life = 0.4;
        this.maxLife = 0.4;
        // Random scale modifier between 0.75 and 1.25
        this.size = Math.random() * 0.5 + 0.75;
        this.rotation = Math.random() * Math.PI * 2;
        this.spin = (Math.random() - 0.5) * 10;
        this.popVariant = Math.floor(Math.random() * 3) + 1;
    }

    reset() {
        this.active = false;
        this.life = 0;
        // Minor optimization: clear references to help GC
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.rotation = 0;
        this.spin = 0;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        this.rotation += this.spin * dt;
    }

    draw(ctx) {
        const asset = Assets.get(Names.getPopEffect(this.popVariant));
        if (!asset || !asset.loaded) return;

        // Avoid drawing if dead or invisible
        if (this.life <= 0) return;

        const alpha = Math.max(0, this.life / this.maxLife);
        if (alpha === 0) return;

        ctx.globalAlpha = alpha;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        const s = BASE_SIZE * this.size;
        ctx.drawImage(asset, -s / 2, -s / 2, s, s);
        
        ctx.restore();
        
        // Must reset global alpha to 1 to prevent state bleeding
        if (alpha < ALPHA_MAX) {
            ctx.globalAlpha = ALPHA_MAX;
        }
    }
}
