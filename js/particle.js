import Assets from './assets.js';
import { Names } from './names.js';

export class Particle { 
    constructor(x, y, color) { 
        this.x = x; this.y = y; 
        this.vx = (Math.random() - 0.5) * 10; 
        this.vy = (Math.random() - 0.5) * 10; 
        this.life = 0.3; this.maxLife = 0.3; 
        
        // PRO FIX: Separated scale logic for effects
        this.size = Math.random() * 0.5 + 0.75; // Random size multiplier (0.75 to 1.25)
        this.baseSize = 40; // Base pixel size for pop effects. Change this to make them bigger/smaller!
        
        this.rotation = Math.random() * Math.PI * 0.5;
        this.spin = (Math.random() - 0.5) * 1;
        this.popVariant = Math.floor(Math.random() * 3) + 1; 
    } 
    update(dt) { 
        this.x += this.vx * dt; 
        this.y += this.vy * dt; 
        this.life -= dt; 
        this.rotation += this.spin * dt;
    } 
    draw(ctx) { 
        const asset = Assets.get(Names.getPopEffect(this.popVariant));
        if (asset && asset.loaded) {
            ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            let s = this.baseSize * this.size; 
            ctx.drawImage(asset, -s/2, -s/2, s, s);
            ctx.restore();
            ctx.globalAlpha = 1;
        }
    } 
}