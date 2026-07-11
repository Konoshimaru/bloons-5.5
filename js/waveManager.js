// waveManager.js
import { Waves } from './data.js';
import { Enemy } from './enemy.js';
import { GameEngine } from './engine.js';
import { UI } from './ui.js';

const SPAWN_INTERVAL_DEFAULT = 0.35;
const AUTO_WAVE_DELAY = 0.1;
const ENDLESS_BASE_ROUND = 141;

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
        GameEngine.enemies.length = 0;
        this.spawnQueue.length = 0;
        GameEngine.projectilePool.clear();
        GameEngine.particlePool.clear();
        GameEngine.explosions.length = 0;
        GameEngine.acidPools.length = 0;
        this.waveActive = false;
    }

    startWave() {
        this.currentWave++;
        this.waveActive = true;
        this.waveTime = 0;
        this.spawnQueue.length = 0;

        const waveData = this._getWaveData(this.currentWave);
        this._buildSpawnQueue(waveData);

        GameEngine.flavorText = `Wave ${this.currentWave}`;
        GameEngine.flavorTimer = 5.0;
        GameEngine.updateUI();
    }

    _getWaveData(waveNum) {
        const waveData = Waves[waveNum - 1];
        if (waveData) return waveData;
        return this._generateEndlessWave(waveNum);
    }

    _generateEndlessWave(waveNum) {
        const progress = waveNum - ENDLESS_BASE_ROUND;
        const groups = [];

        const m = Math.floor(progress / 5) + 2;
        const c = 5 + Math.floor(progress / 2);
        const z = waveNum >= 50 ? Math.floor((waveNum - 50) / 5) + 1 : 0;
        const ddt = waveNum >= 60 ? Math.floor((waveNum - 60) / 10) + 1 : 0;
        const bad = waveNum >= 70 ? Math.floor((waveNum - 70) / 20) + 1 : 0;
        const zomg = waveNum >= 50 ? Math.floor((waveNum - 50) / 15) + 1 : 0;

        if (bad > 0) groups.push({ t: 17, c: bad, s: 0, e: 5, fort: true });
        if (zomg > 0) groups.push({ t: 15, c: zomg, s: 0, e: 10, fort: true });
        if (ddt > 0) groups.push({ t: 16, c: ddt, s: 0, e: 10, camo: true, regen: true, fort: true });
        if (m > 0) groups.push({ t: 13, c: m, s: 0, e: 15, fort: true });
        if (c > 0) groups.push({ t: 12, c: c, s: 0, e: 20, fort: true });
        if (z > 0) groups.push({ t: 9, c: z, s: 0, e: 20 });

        return { groups };
    }

    _buildSpawnQueue(waveData) {
        if (!waveData || !waveData.groups) return;

        for (const group of waveData.groups) {
            const count = group.c;
            const start = group.s;
            const end = group.e;

            const interval = count > 1 ? (end - start) / (count - 1) : 0;

            for (let i = 0; i < count; i++) {
                this.spawnQueue.push({
                    time: start + (i * interval),
                    tier: group.t,
                    camo: group.camo || false,
                    regen: group.regen || false,
                    fort: group.fort || false,
                    hpMod: group.hpMod
                });
            }
        }

        this.spawnQueue.sort((a, b) => a.time - b.time);
    }

    update(dt) {
        if (this.nextWaveTimer > 0) {
            this.nextWaveTimer -= dt;
            if (this.nextWaveTimer <= 0) this.startWave();
            return;
        }

        if (!this.waveActive) return;

        this.waveTime += dt;
        this._processSpawns();

        let activeEnemies = GameEngine.enemies.some(e => e.alive && e.tier !== 99);
        if (this.spawnQueue.length === 0 && !activeEnemies) {
            this._completeWave();
        }
    }

    _processSpawns() {
        while (this.spawnQueue.length > 0 && this.spawnQueue[0].time <= this.waveTime) {
            const spawn = this.spawnQueue.shift();
            
            // PRO FIX: Assign pathIndex randomly if multiple paths exist
            const pathCount = GameEngine.map.paths.length;
            const pathIndex = pathCount > 1 ? Math.floor(Math.random() * pathCount) : 0;
            
            GameEngine.enemies.push(new Enemy(
                spawn.tier,
                GameEngine.map,
                spawn.camo,
                spawn.regen,
                spawn.tier,
                spawn.fort,
                spawn.hpMod,
                pathIndex
            ));
        }
    }

    _completeWave() {
        this.waveActive = false;

        if (!GameEngine.difficulty || !GameEngine.difficulty.noIncome || GameEngine.difficulty.allowWaveCash) {
            const cashEarned = 100 + this.currentWave;
            GameEngine.addCash(cashEarned);
            GameEngine.log(`Wave ${this.currentWave} Complete! +$${cashEarned}`);

            this._processTowerEndOfRound();
        }

        if (GameEngine.hero) {
            this._grantHeroXP();
        }

        GameEngine.updateUI();

        if (this.autoWaveEnabled) {
            this.nextWaveTimer = AUTO_WAVE_DELAY;
        } else {
            GameEngine.speedState = 0;
            GameEngine.timeScale = 1;
            UI.updateWaveSpeedBtn(GameEngine.speedState);
        }
    }

    _processTowerEndOfRound() {
        for (const t of GameEngine.towers) {
            if (!t) continue;

            if (t.type === 'farm' && t.stats.isBank) {
                const cap = t.stats.bankCap || 7000;
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

    _grantHeroXP() {
        const round = this.currentWave;
        let xp = 0;
        if (round <= 20) {
            xp = round * 20 + 20;
        } else if (round <= 50) {
            xp = round * 50 - 380;
        } else {
            xp = round * 90 - 2880;
        }
        GameEngine.hero.gainXp(xp);
    }
}