// particle.js
import Assets from './assets.js';
import { Names } from './names.js';
import { GLOBAL_SCALE } from './constants.js';

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
        this.vx = (Math.random() - 0.5) * 60;
        this.vy = (Math.random() - 0.5) * 60;
        this.life = 0.25;
        this.maxLife = 0.25;
        this.size = Math.random() * 0.5 + 0.75;
        this.rotation = Math.random() * Math.PI * 2;
        this.spin = (Math.random() - 0.5) * 3;
        // PRO FIX: Randomly select 1, 2, or 3
        this.popVariant = Math.floor(Math.random() * 3) + 1;
    }

    reset() {
        this.active = false;
        this.life = 0;
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

        if (this.life <= 0) return;

        const alpha = Math.max(0, this.life / this.maxLife);
        if (alpha === 0) return;

        ctx.globalAlpha = alpha;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        const s = BASE_SIZE * this.size * GLOBAL_SCALE; // PRO FIX: Apply global scale to particle size
        ctx.drawImage(asset, -s / 2, -s / 2, s, s);

        ctx.restore();

        if (alpha < ALPHA_MAX) {
            ctx.globalAlpha = ALPHA_MAX;
        }
    }
}