// js/bosses/knight.js
import { GameEngine } from '../engine.js';
import { Enemy } from '../enemy.js';
import { EnemyTypes } from '../data.js';
import Assets from '../assets.js';
import { BossHealthBarHandler } from '../BossHealthBarHandler.js';
// --- KNIGHT CONFIG ---
export const knightScale = 1.65; 
export const trailScale = 1.21;  

// PRO FIX: Lazy load boss music to avoid downloading the track on page load
let _bossMusic = null;
export function getBossMusic() {
    if (!_bossMusic) {
        _bossMusic = new Audio('music/boss/blackknife.mp3');
        _bossMusic.loop = true;
    }
    return _bossMusic;
}

export class KnightEnemy extends Enemy {
    constructor(x, y) {
        super(); 
        this.init(13, GameEngine.map, false, false, 13, false, 1.0); 
        
        this.tier = 99; 
        this.x = x;
        this.y = y;
        this.alpha = 1; 
        this.sprite = 'enemy_knight_back'; 
        this.data = { ...EnemyTypes[13], name: "Black Knight", radius: 45, size: 90, isMoab: true, splitsInto: [] };
        this.hp = 50000; 
        this._maxHp = 50000;
        this.distanceTraveled = 0; 
        this.angle = 0;
        
        this.time = 0; 
        this.knightTrail = [];
        this.trailTimer = 0;
        this.isCinematic = true; 

        // PRO FIX: Register this boss with the health bar handler
        BossHealthBarHandler.registerBoss(this);
    }

    update(dt) {
        this.time += dt / 1.25; 
        this.y = 300 + Math.cos(this.time * 3) * 20;

        if (!this.isCinematic) {
            this.x = 200 + Math.sin(this.time * 2) * 30;
        }

        this.trailTimer += dt;
        if (this.trailTimer > 0.04) {
            this.knightTrail.unshift({ x: this.x, y: this.y, alpha: 0.7 * this.alpha });
            this.trailTimer = 0;
        }
        
        if (this.knightTrail.length > 25) this.knightTrail.pop();

        for (let i = this.knightTrail.length - 1; i >= 0; i--) {
            let t = this.knightTrail[i];
            t.x -= (120 / 1.25) * dt; 
            t.y -= (20 / 1.25) * dt;  
            t.alpha -= dt * 0.8;
            if (t.alpha <= 0) this.knightTrail.splice(i, 1);
        }
    }

    takeDamage(damage, dmgType, effects) {
        if (this.isCinematic) return 0; 
        if (this._isImmune(dmgType, effects)) return -1;
        this.hp -= damage;
        if (this.hp <= 0) {
            this.alive = false;
            GameEngine.spawnPopEffect(this.x, this.y, '#000000');
            getBossMusic().pause(); 
            
            // PRO FIX: Unregister this boss from the health bar handler
            BossHealthBarHandler.unregisterBoss(this);
        }
        return damage;
    }

    draw(ctx) {
        let originalSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;

        for (let t of this.knightTrail) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, t.alpha);
            ctx.translate(t.x, t.y);
            ctx.scale(-1, 1);
            let asset = Assets.get('enemy_knight_front');
            if (asset && asset.loaded) {
                let w = asset.width * trailScale;
                let h = asset.height * trailScale;
                ctx.drawImage(asset, -w / 2, -h / 2, w, h);
            }
            ctx.restore();
        }

        ctx.save();
        ctx.globalAlpha = Math.min(1, this.alpha);
        ctx.translate(this.x, this.y);
        ctx.scale(-1, 1);
        let asset = Assets.get(this.sprite);
        if (asset && asset.loaded) {
            let w = asset.width * knightScale;
            let h = asset.height * knightScale;
            ctx.drawImage(asset, -w / 2, -h / 2, w, h);
        }
        ctx.restore();

        ctx.imageSmoothingEnabled = originalSmoothing;
    }
}