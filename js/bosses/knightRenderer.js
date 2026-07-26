// js/bosses/knightRenderer.js
import Assets from '../assets.js';
import { CANVAS_WIDTH } from '../constants.js';

export const knightScale = 1.65; 
export const trailScale = 1.21;

const KnightRenderer = {
    draw(ctx) {
        let originalSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;

        // Draw Trail
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

        // Draw Knight
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

        // Draw Spinning Slashes
        for (let s of this.spinningSlashes) {
            ctx.save();
            ctx.globalAlpha = s.alpha;
            // FIX: Removed shadowBlur, using a thicker red line instead for the glow effect
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
            ctx.lineWidth = 10;
            ctx.beginPath();
            let p1x = s.pivotX - Math.cos(s.angle) * s.length;
            let p1y = s.pivotY - Math.sin(s.angle) * s.length;
            let p2x = s.pivotX + Math.cos(s.angle) * s.length;
            let p2y = s.pivotY + Math.sin(s.angle) * s.length;
            ctx.moveTo(p1x, p1y);
            ctx.lineTo(p2x, p2y);
            ctx.stroke();
            
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(p1x, p1y);
            ctx.lineTo(p2x, p2y);
            ctx.stroke();
            ctx.restore();
        }

        // Draw Thrown Swords
        for (let s of this.thrownSwords) {
            if (s.isCursorSword && (s.phase === 'track' || s.phase === 'lock')) {
                ctx.save();
                ctx.strokeStyle = s.phase === 'lock' ? 'rgba(231, 76, 60, 1)' : 'rgba(231, 76, 60, 0.5)';
                ctx.lineWidth = 3;
                ctx.setLineDash([15, 10]);
                ctx.beginPath();
                ctx.moveTo(s.x + 20, s.y);
                ctx.lineTo(CANVAS_WIDTH, s.y);
                ctx.stroke();
                ctx.restore();
            }

            let swordAsset = Assets.get('proj_knightsword');
            if (swordAsset && swordAsset.loaded) {
                ctx.save();
                ctx.translate(s.x, s.y);
                ctx.rotate(0); 
                let w = swordAsset.width * 1.5;
                let h = swordAsset.height * 1.5;
                ctx.drawImage(swordAsset, -w / 2, -h / 2, w, h);
                ctx.restore();
            } else {
                ctx.save();
                ctx.translate(s.x, s.y);
                ctx.fillStyle = '#bdc3c7';
                ctx.fillRect(-20, -4, 40, 8);
                ctx.fillStyle = '#7f8c8d';
                ctx.fillRect(15, -8, 10, 16);
                ctx.restore();
            }
        }

        ctx.imageSmoothingEnabled = originalSmoothing;
    }
};

export default KnightRenderer;