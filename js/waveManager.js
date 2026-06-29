import { Waves } from './data.js';
import { Enemy } from './enemy.js';
import { GameEngine } from './engine.js';
import { UI } from './ui.js';

export class WaveManager {
    constructor() { 
        this.currentWave = 0; 
        this.spawnQueue = []; 
        this.waveTime = 0; 
        this.waveActive = false; 
        this.autoWaveEnabled = false; 
        this.nextWaveTimer = 0; 
    }
    
    clearField() {
        GameEngine.enemies = []; 
        this.spawnQueue = []; 
        
        // PRO FIX: Use Object Pool clear instead of old array!
        GameEngine.projectilePool.clear(); 
        GameEngine.particlePool.clear(); 
        
        GameEngine.explosions = []; 
        GameEngine.acidPools = [];
        this.waveActive = false;
    }
    
    startWave() { 
        this.currentWave++; 
        this.waveActive = true; 
        this.waveTime = 0; 
        this.spawnQueue = [];
        
        let waveData = Waves[this.currentWave - 1];
        
        // If we run out of defined waves, generate a procedural endless wave
        if (!waveData) {
            const m = Math.floor((this.currentWave - 40) / 5) + 2;
            const c = 5 + Math.floor((this.currentWave - 40) / 2);
            const z = this.currentWave >= 50 ? Math.floor((this.currentWave - 50) / 5) + 1 : 0;
            const ddt = this.currentWave >= 60 ? Math.floor((this.currentWave - 60) / 10) + 1 : 0;
            const bad = this.currentWave >= 70 ? Math.floor((this.currentWave - 70) / 20) + 1 : 0;
            const zomg = this.currentWave >= 50 ? Math.floor((this.currentWave - 50) / 15) + 1 : 0;
            waveData = { groups: [] };
            if (bad > 0) waveData.groups.push({t: 17, c: bad, s: 0, e: 5, fort: true});
            if (zomg > 0) waveData.groups.push({t: 15, c: zomg, s: 0, e: 10, fort: true});
            if (ddt > 0) waveData.groups.push({t: 16, c: ddt, s: 0, e: 10, camo: true, regen: true, fort: true});
            if (m > 0) waveData.groups.push({t: 13, c: m, s: 0, e: 15, fort: true});
            if (c > 0) waveData.groups.push({t: 12, c: c, s: 0, e: 20, fort: true});
            if (z > 0) waveData.groups.push({t: 9, c: z, s: 0, e: 20});
        }
        
        // Build the spawn queue from the timeline data
        for (let group of waveData.groups) {
            let count = group.c;
            let start = group.s;
            let end = group.e;
            
            let interval = 0;
            if (count > 1) {
                interval = (end - start) / (count - 1);
            }
            
            for (let i = 0; i < count; i++) {
                let spawnTime = start + (i * interval);
                this.spawnQueue.push({
                    time: spawnTime,
                    tier: group.t,
                    camo: group.camo || false,
                    regen: group.regen || false,
                    fort: group.fort || false
                });
            }
        }
        
        this.spawnQueue.sort((a, b) => a.time - b.time);
        
        GameEngine.flavorText = `Wave ${this.currentWave}`;
        GameEngine.flavorTimer = 5.0;
        GameEngine.updateUI(); 
    }
    
    update(dt) { 
        if (this.nextWaveTimer > 0) { 
            this.nextWaveTimer -= dt; 
            if (this.nextWaveTimer <= 0) this.startWave(); 
        } 
        
        if (!this.waveActive) return; 
        
        this.waveTime += dt;
        
        // Check spawn queue
        while (this.spawnQueue.length > 0 && this.spawnQueue[0].time <= this.waveTime) {
            let spawn = this.spawnQueue.shift(); 
            GameEngine.enemies.push(new Enemy(spawn.tier, GameEngine.map, spawn.camo, spawn.regen, spawn.tier, spawn.fort));
        }
        
        // Wave ends when queue is empty AND no enemies are left on screen
        if (this.spawnQueue.length === 0 && GameEngine.enemies.length === 0) { 
            this.waveActive = false; 
            if (!GameEngine.difficulty || !GameEngine.difficulty.noIncome) {
                GameEngine.addCash(100 + (this.currentWave * 20)); 
                for (let t of GameEngine.towers) {
                    if (t) {
                        if (t.type === 'farm' && t.stats.isBank) {
                            let cap = t.stats.bankCap || 7000;
                            if (t.bankBalance < cap) {
                                t.bankBalance = Math.min(cap, Math.floor(t.bankBalance * 1.15));
                            }
                            if (t.upgrades[2] >= 2 && t.bankBalance >= cap) {
                                GameEngine.addCash(Math.floor(t.bankBalance)); t.bankBalance = 0;
                            }
                        }
                        if (t.type === 'farm' && t.stats.wallStreet) {
                            GameEngine.addCash(4000); GameEngine.lives += 15; GameEngine.updateUI();
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
            GameEngine.updateUI(); GameEngine.log(`Wave ${this.currentWave} Complete!`); 
            if (this.autoWaveEnabled) { this.nextWaveTimer = 0.1; } else { GameEngine.speedState = 0; GameEngine.timeScale = 1; UI.updateWaveSpeedBtn(GameEngine.speedState); } 
        } 
    }
}