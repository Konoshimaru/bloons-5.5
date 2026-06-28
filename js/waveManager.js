import { Waves } from './data.js';
import { Enemy } from './enemy.js';
import { GameEngine } from './engine.js';
import { UI } from './ui.js';

export class WaveManager {
    constructor() { this.currentWave = 0; this.enemiesToSpawn = []; this.spawnTimer = 0; this.spawnInterval = 0.35; this.waveActive = false; this.autoWaveEnabled = false; this.nextWaveTimer = 0; }
    
    clearField() {
        GameEngine.enemies = []; this.enemiesToSpawn = []; GameEngine.projectiles = []; GameEngine.explosions = []; this.waveActive = false; this.spawnTimer = 0;
    }
    
    startWave() { 
        this.currentWave++; this.waveActive = true; this.spawnTimer = 0; 
        
        let waveData = Waves[this.currentWave - 1];
        if (!waveData) {
            const bfb = Math.floor((this.currentWave - 60) / 10) + 1;
            const m = Math.floor((this.currentWave - 60) / 5) + 2;
            const c = 5 + Math.floor((this.currentWave - 60) / 2);
            const z = this.currentWave >= 80 ? Math.floor((this.currentWave - 80) / 5) + 1 : 0;
            const ddt = this.currentWave >= 90 ? Math.floor((this.currentWave - 90) / 10) + 1 : 0;
            const bad = this.currentWave >= 100 ? Math.floor((this.currentWave - 100) / 20) + 1 : 0;
            const zomg = this.currentWave >= 70 ? Math.floor((this.currentWave - 70) / 15) + 1 : 0;
            waveData = { bfb: bfb, m: m, c: c, z: z, ddt: ddt, bad: bad, zomg: zomg, fort: ['c', 'l', 'm', 'bfb', 'ddt', 'bad', 'zomg'] };
        }
        this.enemiesToSpawn = [];
        const map = { r:1, b:2, g:3, y:4, p:5, bl:6, w:7, l:8, z:9, pu:10, rb:11, c:12, m:13, bfb:14, zomg:15, ddt:16, bad:17 };
        for (let key in waveData) {
            if (['camo', 'reg', 'fort'].includes(key)) continue;
            const tier = map[key.replace(/\d/g, '')];
            const count = waveData[key];
            const isCamo = waveData.camo && waveData.camo.includes(key);
            const isReg = waveData.reg && waveData.reg.includes(key);
            const isFort = waveData.fort && waveData.fort.includes(key);
            for (let i = 0; i < count; i++) { this.enemiesToSpawn.push({ t: tier, c: isCamo, r: isReg, fort: isFort }); }
        }
        this.enemiesToSpawn.sort(() => Math.random() - 0.5);
        GameEngine.flavorText = this.getWaveFlavor(this.currentWave);
        GameEngine.flavorTimer = 5.0;
        GameEngine.updateUI(); 
    }
    
    getWaveFlavor(waveNum) {
        let wave = Waves[waveNum - 1];
        if (!wave) return `Endless Wave ${waveNum}: Scaling difficulty!`;
        let parts = [];
        const names = { r:'Red', b:'Blue', g:'Green', y:'Yellow', p:'Pink', bl:'Black', w:'White', l:'Lead', z:'Zebra', pu:'Purple', rb:'Rainbow', c:'Ceramic', m:'MOAB', bfb:'BFB', zomg:'ZOMG', ddt:'DDT', bad:'BAD' };
        for (let key in wave) {
            if (['camo', 'reg', 'fort'].includes(key)) continue;
            let count = wave[key];
            let baseName = key.replace(/\d/g, '');
            let name = names[baseName];
            let prefix = "";
            if (wave.camo && wave.camo.includes(key)) prefix += "Camo ";
            if (wave.reg && wave.reg.includes(key)) prefix += "Regrow ";
            if (wave.fort && wave.fort.includes(key)) prefix += "Fortified ";
            parts.push(`${count} ${prefix}${name}${count > 1 ? 's' : ''}`);
        }
        return `Wave ${waveNum}: ${parts.join(', ')}`;
    }
    
    update(dt) { 
        if (this.nextWaveTimer > 0) { this.nextWaveTimer -= dt; if (this.nextWaveTimer <= 0) this.startWave(); } 
        if (!this.waveActive) return; 
        if (this.enemiesToSpawn.length > 0) { 
            this.spawnTimer += dt; 
            if (this.spawnTimer >= this.spawnInterval) { 
                this.spawnTimer = 0; 
                const e = this.enemiesToSpawn.shift(); 
                GameEngine.enemies.push(new Enemy(e.t, GameEngine.map, e.c, e.r, e.t, e.fort)); 
            } 
        } else if (GameEngine.enemies.length === 0) { 
            this.waveActive = false; 
            if (!GameEngine.difficulty || !GameEngine.difficulty.noIncome) {
                GameEngine.addCash(100 + (this.currentWave * 20)); 
                for (let t of GameEngine.towers) {
                    if (t) {
                        // PRO FIX: Banana Farm End of Round Logic
                        if (t.type === 'farm' && t.stats.isBank) {
                            let cap = t.stats.bankCap || 7000;
                            if (t.bankBalance < cap) {
                                t.bankBalance = Math.min(cap, Math.floor(t.bankBalance * 1.15));
                            }
                            if (t.upgrades[2] >= 2 && t.bankBalance >= cap) {
                                GameEngine.addCash(Math.floor(t.bankBalance)); 
                                t.bankBalance = 0;
                            }
                        }
                        if (t.type === 'farm' && t.stats.wallStreet) {
                            GameEngine.addCash(4000); 
                            GameEngine.lives += 15; 
                            GameEngine.updateUI();
                        }
                    }
                }
            }
            if (GameEngine.hero) {
                let round = this.currentWave;
                let xp = 0;
                if (round <= 20) xp = round * 20 + 20;
                else if (round <= 50) xp = round * 50 - 380;
                else xp = round * 90 - 2880;
                GameEngine.hero.gainXp(xp);
            }
            GameEngine.updateUI(); 
            GameEngine.log(`Wave ${this.currentWave} Complete!`); 
            if (this.autoWaveEnabled) { 
                this.nextWaveTimer = 0.1; 
            } else { 
                GameEngine.speedState = 0; 
                GameEngine.timeScale = 1; 
                UI.updateWaveSpeedBtn(GameEngine.speedState); 
            } 
        } 
    }
}