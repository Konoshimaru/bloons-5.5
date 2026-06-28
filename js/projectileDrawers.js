// js/projectileDrawers.js
export const ProjectileDrawers = {
    dart: (ctx) => { 
        ctx.fillStyle = '#8B4513'; ctx.fillRect(-10, -2, 15, 4); 
        ctx.fillStyle = '#95a5a6'; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(0, -3); ctx.lineTo(0, 3); ctx.fill(); 
        ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-15, -3); ctx.lineTo(-15, 3); ctx.fill(); 
    },
    super_dart: (ctx) => { 
        ctx.fillStyle = '#e74c3c'; ctx.fillRect(-10, -4, 20, 8); 
        ctx.fillStyle = '#00ffff'; ctx.fillRect(-10, -2, 15, 4); 
    },
    spike_opult: (ctx) => {
        let r = 8;
        ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#95a5a6'; 
        for(let i=0; i<8; i++) { ctx.rotate(Math.PI/4); ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r+4, -2); ctx.lineTo(r+4, 2); ctx.fill(); }
    },
    juggernaut: (ctx) => {
        let r = 12;
        ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#95a5a6'; 
        for(let i=0; i<8; i++) { ctx.rotate(Math.PI/4); ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r+4, -2); ctx.lineTo(r+4, 2); ctx.fill(); }
    },
    ultra_juggernaut: (ctx) => {
        let r = 16;
        ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#95a5a6'; 
        for(let i=0; i<8; i++) { ctx.rotate(Math.PI/4); ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r+4, -2); ctx.lineTo(r+4, 2); ctx.fill(); }
    },
    arrow: (ctx, p) => { 
        ctx.fillStyle = p.isCrit ? '#f1c40f' : '#2c3e50'; ctx.fillRect(-12, -1, 24, 2); 
        ctx.fillStyle = '#95a5a6'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(8, -3); ctx.lineTo(8, 3); ctx.fill(); 
    },
    boomerang: (ctx) => { 
        ctx.fillStyle = '#8e44ad'; ctx.fillRect(-10, -3, 15, 6); 
        ctx.beginPath(); ctx.arc(5, 0, 5, -Math.PI/2, Math.PI/2); ctx.fill(); 
    },
    tack: (ctx) => { 
        ctx.fillStyle = '#e67e22'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); 
    },
    ice: (ctx) => { 
        ctx.fillStyle = '#1abc9c'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); 
    },
    glue: (ctx) => { 
        ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill(); 
    },
    spike: (ctx) => { 
        ctx.fillStyle = '#95a5a6'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(10, 10); ctx.lineTo(-10, 10); ctx.fill(); 
    },
    bomb: (ctx) => { 
        ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); 
    },
    super: (ctx) => { 
        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(5, 0); ctx.stroke(); 
        ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(0, -3); ctx.lineTo(0, 3); ctx.fill(); 
    },
    ninja: (ctx) => { 
        ctx.fillStyle = '#2c3e50'; 
        ctx.beginPath(); 
        for(let i=0; i<8; i++) {
            let ang = (i / 8) * Math.PI * 2;
            let r = (i % 2 === 0) ? 8 : 3;
            if (i === 0) ctx.moveTo(Math.cos(ang)*r, Math.sin(ang)*r);
            else ctx.lineTo(Math.cos(ang)*r, Math.sin(ang)*r);
        }
        ctx.closePath(); ctx.fill(); 
    },
    wizard_bolt: (ctx) => { 
        ctx.fillStyle = '#9b59b6'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill(); 
        ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); 
    },
    nail: (ctx) => { 
        ctx.fillStyle = '#bdc3c7'; ctx.fillRect(-10, -1, 14, 2); 
        ctx.fillStyle = '#7f8c8d'; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(10, -3); ctx.lineTo(10, 3); ctx.fill(); 
    },
    potion: (ctx) => { 
        ctx.fillStyle = '#9b59b6'; ctx.beginPath(); ctx.arc(0, 2, 6, 0, Math.PI * 2); ctx.fill(); 
        ctx.fillStyle = '#34495e'; ctx.fillRect(-3, -6, 6, 4); 
    }
};

// Aliases for sub-types
ProjectileDrawers.juggernaut_sub = ProjectileDrawers.juggernaut;