import { CANVAS_WIDTH } from './constants.js';

export const BossHealthBarHandler = {
    activeBosses: [],

    registerBoss(enemy) {
        if (this.activeBosses.some(b => b.enemy === enemy)) return;
        
        this.activeBosses.push({
            enemy: enemy,
            maxHp: enemy._maxHp || enemy.hp,
            name: enemy.data.name || "Boss",
            color: enemy.data.color || '#e74c3c'
        });
    },

    unregisterBoss(enemy) {
        this.activeBosses = this.activeBosses.filter(b => b.enemy !== enemy);
    },

    draw(ctx) {
        if (this.activeBosses.length === 0) return;

        this.activeBosses = this.activeBosses.filter(b => b.enemy && b.enemy.alive);
        if (this.activeBosses.length === 0) return;

        const barWidth = 450;
        const barHeight = 24;
        const spacing = 36;
        
        // Center within the playable game area (1280 - 300px sidebar = 980px)
        const gameAreaWidth = CANVAS_WIDTH - 300; 
        const startX = (gameAreaWidth - barWidth) / 2; 
        const startY = 55; 

        ctx.save();
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        this.activeBosses.forEach((boss, index) => {
            const y = startY + (index * spacing);
            const currentHp = Math.max(0, boss.enemy.hp);
            const hpPercent = boss.maxHp > 0 ? currentHp / boss.maxHp : 0;

            // Background Border
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(startX - 3, y - 3, barWidth + 6, barHeight + 6);

            // Empty Bar Background
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(startX, y, barWidth, barHeight);

            // Health Bar Fill
            ctx.fillStyle = boss.color;
            ctx.fillRect(startX, y, barWidth * hpPercent, barHeight);

            // Inner Highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(startX, y, barWidth * hpPercent, barHeight / 2);

            // Text (Name and HP)
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${boss.name}: ${Math.ceil(currentHp)} / ${boss.maxHp}`, startX + barWidth / 2, y + barHeight / 2);
        });

        ctx.restore();
    }
};