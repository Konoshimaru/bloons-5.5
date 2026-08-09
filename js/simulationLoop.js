// js/simulationLoop.js
import { Utils } from './utils.js';
import { getBehavior } from './registry.js';
import { AudioEngine } from './audio.js';

const MAX_PROJECTILES = 1500;
const MAX_PARTICLES = 400;
const MAX_EXPLOSIONS = 100;
const MAX_ACID_POOLS = 100;

const _foamScratch = [];
const _acidScratch = [];

const SimulationLoop = {
    _updateLimitsAndTimers(dt) {
        if (this.projectilePool.active.length > MAX_PROJECTILES) this.projectilePool.removeAt(0);
        if (this.particlePool.active.length > MAX_PARTICLES) this.particlePool.removeAt(0);
        if (this.explosions.length > MAX_EXPLOSIONS) this.explosions.shift();
        if (this.acidPools.length > MAX_ACID_POOLS) this.acidPools.shift();
        if (this.flavorTimer > 0) this.flavorTimer -= dt;
        if (this.leakFlash > 0) this.leakFlash -= dt;
    },

    _updateAcidPools(dt) {
        for (let i = this.acidPools.length - 1; i >= 0; i--) {
            const pool = this.acidPools[i];
            pool.life -= dt; 
            if (pool.life <= 0) { this.acidPools.splice(i, 1); continue; }
            
            // Cleansing Foam Splat Logic
            if (pool.isFoam) {
                const nearby = this.enemyGrid.query(pool.x, pool.y, pool.radius, _foamScratch);
                for (const e of nearby) {
                    if (pool.pierce <= 0) break;
                    if (!e.alive || pool.hitEnemies.has(e)) continue;
                    if (Utils.withinRange(pool.x, pool.y, e.x, e.y, pool.radius + e.data.radius)) {
                        pool.hitEnemies.add(e);
                        if (e.isCamo) { e.isCamo = false; e._updateSpriteCache(); }
                        if (e.isRegen) { e.isRegen = false; e._updateSpriteCache(); }
                        if (e.data.isLead && !e.leadStripped) { 
                            e.leadStripped = true; 
                            e.takeDamage(1, { isNormal: true }); // Pop the lead layer
                            e._updateSpriteCache(); 
                        }
                        pool.pierce--;
                    }
                }
            } else {
                // Standard Acid Pool Logic
                pool.tick -= dt;
                if (pool.tick <= 0) {
                    pool.tick = 1.0;
                    const nearby = this.enemyGrid.query(pool.x, pool.y, pool.radius, _acidScratch);
                    for (const e of nearby) {
                        if (e.alive && Utils.withinRange(pool.x, pool.y, e.x, e.y, pool.radius)) {
                            e.takeDamage(pool.dmg, { isAcid: true, canHitLead: true });
                        }
                    }
                }
            }
        }
    },

    _updateFloatingTexts(dt) {
        if (!this.floatingTexts) return;
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.life -= dt;
            ft.y += (ft.vy || -20) * dt; // Float upwards
            if (ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    },

    _updateEnemies(dt) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (!e) continue;
            // The knight boss (tier 99) is already updated once by
            // CutsceneManager.update() every frame; updating it here too
            // would run its state machine/attacks/trail at 2x speed during
            // the fight. Its removal on death is handled by the cutscene's
            // reset(), not the swap-remove below, so skipping is safe.
            if (e.tier === 99) continue;
            e.update(dt);
            if (!e.alive) {
                const last = this.enemies.pop();
                if (i < this.enemies.length) { this.enemies[i] = last; }
                this.enemyPool.release(e);
            }
        }
    },

    _updateTowers(dt) {
        for (const t of this.towers) {
            if (!t) continue;
            t.buffedRange = 0; t.buffedFireRate = 0; t.buffedCamo = false; t.buffedLead = false;
            t.discount = 0; t.buffedDmg = 0; t.buffedPierce = 0; t.buffedValueMult = 0;
            t.buffedProjSpeed = 1.0; 
            t.abilityCdMult = 1.0;
        }
        this.hasIceShardTower = false; this.hasLeakingEnemy = false;
        if (this.map) {
            const totalLen = this.map.getTotalLength();
            if (totalLen > 0) {
                const leakThreshold = totalLen * 0.75;
                for (const e of this.enemies) { if (e.alive && e.distanceTraveled > leakThreshold) { this.hasLeakingEnemy = true; break; } }
            }
        }
        this.towerGrid.clear();
        for (const t of this.towers) { if (t) this.towerGrid.insert(t); }
        for (const t of this.towers) {
            if (!t) continue;
            const behavior = getBehavior(t.type);
            if (behavior && behavior.updateSupport) { behavior.updateSupport(t, dt); }
            if (t.type === 'ice' && t.upgrades[0] >= 3) { this.hasIceShardTower = true; }
        }
        for (const t of this.towers) { if (t) t.update(dt, this); }
    },

    _updateBeasts(dt) {
        for (let i = this.beasts.length - 1; i >= 0; i--) {
            const b = this.beasts[i];
            if (!b) continue;
            b.update(dt, this);
            if (!b.alive) {
                const last = this.beasts.pop();
                if (i < this.beasts.length) { this.beasts[i] = last; }
            }
        }
    },

    _updateSentries(dt) {
        for (let i = this.sentries.length - 1; i >= 0; i--) {
            const s = this.sentries[i];
            if (!s) continue;
            s.update(dt, this);
            if (!s.alive) {
                if (this.selectedPlacedTower === s) this.deselectAll();
                if (s.parentTower && s.parentTower.sentries) {
                    const idx = s.parentTower.sentries.indexOf(s);
                    if (idx > -1) s.parentTower.sentries.splice(idx, 1);
                }
                const last = this.sentries.pop();
                if (i < this.sentries.length) { this.sentries[i] = last; }
            }
        }
    },

    _updateEconomy(dt) {
        if (this.mouse.x === undefined) return;
        for (const t of this.towers) {
            if (!t || !t.bananas || t.bananas.length === 0) continue;
            for (let i = t.bananas.length - 1; i >= 0; i--) {
                const b = t.bananas[i];
                if (b.progress < 1) continue;
                
                const distSq = Utils.distanceSq(this.mouse.x, this.mouse.y, b.x, b.y);
                const range = t.stats.collectionRange || 40;
                
                if (distSq < range * range) {
                    const dist = Math.sqrt(distSq) || 1;
                    const speed = 500 * dt;
                    b.x += ((this.mouse.x - b.x) / dist) * speed;
                    b.y += ((this.mouse.y - b.y) / dist) * speed;
                    if (dist < 15) {
                        this.addCash(b.value); t.cashGenerated = (t.cashGenerated || 0) + b.value;
                        AudioEngine.playSfx('cash'); t.bananas.splice(i, 1);
                    }
                }
            }
        }
    },

    _updateProjectiles(dt) {
        const projectiles = this.projectilePool.active;
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            if (!p) continue;
            p.update(dt);
            if (!p.alive) { this.projectilePool.removeAt(i); }
        }
    },

    _updateExplosions(dt) {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            if (!exp) continue;
            exp.life -= dt;
            if (exp.maxLife > 0) { exp.radius = (1 - exp.life / exp.maxLife) * (exp.maxRadius || 0); }
            if (exp.life <= 0) {
                const last = this.explosions.pop();
                if (i < this.explosions.length) { this.explosions[i] = last; }
            }
        }
    },

    _updateParticles(dt) {
        const particles = this.particlePool.active;
        for (let i = particles.length - 1; i >= 0; i--) {
            const pt = particles[i];
            if (!pt) continue;
            pt.update(dt);
            if (pt.life <= 0) { this.particlePool.removeAt(i); }
        }
    }
};

export default SimulationLoop;
