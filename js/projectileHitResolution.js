// js/projectileHitResolution.js
import { Utils } from './utils.js';
import { GameEngine } from './engine.js';
import { DamageType, createDmgType } from './damageTypes.js';
import { ProjectileTypeConfig } from './projectileTypeConfig.js';
import { GLOBAL_SCALE } from './constants.js'; 

// Reusable scratch arrays for enemyGrid.query. Each call site gets its own array
// because a query result may be iterated while a different query runs (e.g. an
// explosion resolving inside a collision loop must not reuse the collision array).
const _collideScratch = [];
const _explosionScratch = [];
const _ricochetScratch = [];

const ProjectileHitResolution = {
    _checkCollisions() {
        const nearby = GameEngine.enemyGrid.query(this.x, this.y, this.radius + 40, _collideScratch);
        const cfg = ProjectileTypeConfig[this.type] || {};
        
        for (const e of nearby) {
            if (!e.alive) continue;
            
            // FIX: Big Squeeze immunity
            if (e.untargetable || e.damageImmune || e.collisionImmune) continue;
            
            if (!cfg.exemptFromHitTracking && this.hitEnemies.has(e)) continue;
            
            if (e.isCamo && !(this.tower && (this.tower.stats.canSeeCamo || this.tower.buffedCamo))) continue;
            
            const eRad = e.radius || e.data.radius || 10;
            if (Utils.withinRange(this.x, this.y, e.x, e.y, eRad + this.radius)) {
                this.hit(e);
                if (!cfg.exemptFromHitTracking) this.hitEnemies.add(e);
                if (!this.alive) break;
            }
        }
    },

    split() {
        if (this.hasSplit) return;
        this.hasSplit = true;
        for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2;
            const p = GameEngine.projectilePool.get();
            p.init(this.x, this.y, 2, null, 'juggernaut_sub', 400, 10, 1.0, ang, null, 0, this.tower, this.dmgType, this.isCrit);
            p.bonusCeramic = this.bonusCeramic;
        }
    },

    hit(enemy) {
        if (this._isExplosive()) {
            this._handleExplosiveHit(enemy);
        } else if (enemy) {
            this._handleStandardHit(enemy);
        }
    },

    _isExplosive() {
        const cfg = ProjectileTypeConfig[this.type] || {};
        return !!cfg.isExplosive || (this.effects && this.effects.isExplosive);
    },

    _handleExplosiveHit(primaryEnemy) {
        const expRadius = this._getExplosionRadius();
        const expColor = this._getExplosionColor();
        GameEngine.explosions.push({ x: this.x, y: this.y, radius: 0, maxRadius: expRadius, life: 0.3, maxLife: 0.3, color: expColor });
        
        const bombDmgType = this._createBombDmgType();
        
        // Effects-based explosives (Quincy explosive arrows, wizard fireballs,
        // sentries) also deal their own direct damage to the collided enemy;
        // inherently explosive projectile types (bomb, mortar_shell, etc.)
        // fold all their damage into the blast itself, matching BTD5.
        const cfg = ProjectileTypeConfig[this.type] || {};
        if (primaryEnemy && !cfg.isExplosive) {
            this._applyDirectHit(primaryEnemy);
        }
        
        const nearby = GameEngine.enemyGrid.query(this.x, this.y, expRadius, _explosionScratch);
        const maxPierce = this._getExplosionPierce();
        
        let hits = 0;
        for (const e of nearby) {
            if (hits >= maxPierce) break;
            if (!e.alive) continue;
            
            // FIX: Big Squeeze immunity
            if (e.untargetable || e.damageImmune || e.collisionImmune) continue;
            
            if (e.isCamo && !(this.effects && this.effects.canSeeCamo) && !(this.tower && (this.tower.stats.canSeeCamo || this.tower.buffedCamo))) continue;
            if (e.data.isLead && !bombDmgType.canHitLead) continue;
            if (e.data.isMoab && !bombDmgType.canHitMoab) continue;
            
            if (Utils.withinRange(this.x, this.y, e.x, e.y, expRadius)) {
                // Effects (freeze/permafrost) apply BEFORE the damage block
                // check, so Cold Sentry freezes Black/Zebra/DDT even though
                // their explosion damage is blocked.
                this._applyExplosionEffects(e);
                
                if (e.data.blocksDamageType && e.data.blocksDamageType(bombDmgType)) continue;
                
                const expDmg = this._getExplosionDamage();
                const dmg = e.takeDamage(expDmg, bombDmgType, this.effects, this.tower);
                if (dmg === -1) continue;
                
                if (this.tower) {
                    this.tower.damageDealt += dmg;
                    if (this.tower.parentTower) this.tower.parentTower.damageDealt += dmg;
                }
                
                if (this.isCrit && dmg > 0 && GameEngine.floatingTexts) {
                    GameEngine.floatingTexts.push({
                        x: e.x, 
                        y: e.y - 15,
                        text: `${dmg}!`,
                        life: 0.6, 
                        maxLife: 0.6,
                        color: '#f1c40f', 
                        vy: -40
                    });
                }
                
                hits++;
            }
        }

        if (this.effects && this.effects.fragCount > 0) {
            for (let i = 0; i < this.effects.fragCount; i++) {
                let angle = (i / this.effects.fragCount) * Math.PI * 2;
                let p = GameEngine.projectilePool.get();
                p.init(this.x, this.y, this.effects.fragDamage || 1, null, 'tack', 400, 2, 0.3, angle, {canHitLead: false}, 0, this.tower, {isSharp: true});
            }
        }
        if (this.effects && this.effects.clusterCount > 0) {
            for (let i = 0; i < this.effects.clusterCount; i++) {
                let angle = (i / this.effects.clusterCount) * Math.PI * 2;
                let p = GameEngine.projectilePool.get();
                p.init(this.x, this.y, this.effects.clusterDamage || 1, null, 'bomb', 300, 1, 0.5, angle, {isExplosive: true, explosionRadius: 15, explosionDamage: this.effects.clusterDamage || 1, explosionPierce: 10, canHitLead: true}, 0, this.tower, {isExplosion: true, canHitLead: true});
            }
        }

        if (cfg.decrementsPierceOnExplosion) {
            this.pierce--;
            if (this.pierce <= 0) this.alive = false;
        } else {
            this.alive = false;
        }
    },

    _getExplosionRadius() {
        const GS = typeof GLOBAL_SCALE === 'number' ? GLOBAL_SCALE : 1.0; 
        let r = this.effects && this.effects.explosionRadius ? this.effects.explosionRadius : (this.tower ? this.tower.stats.explosionRadius : 60);
        return r * GS;
    },

    _getExplosionColor() {
        const cfg = ProjectileTypeConfig[this.type] || {};
        return cfg.explosionColor || '#e67e22';
    },

    _createBombDmgType() {
        const cfg = ProjectileTypeConfig[this.type] || {};
        const dt = this.dmgType || {};
        const tower = this.tower;
        const bombCanHitLead = dt.canHitLead || (tower && (tower.stats.canHitLead || tower.buffedLead)) || (this.effects && this.effects.canHitLead);
        const bombCanHitMoab = dt.canHitMoab || (tower && tower.stats.canHitMoab) || (this.effects && this.effects.canHitMoab);
        return createDmgType(DamageType.EXPLOSION, {
            isFire: dt.isFire || false,
            isAcid: !!cfg.isAcid,
            moabDmg: dt.moabDmg || 0,
            fortifiedDmg: dt.fortifiedDmg || 0,
            canHitLead: bombCanHitLead,
            canHitMoab: bombCanHitMoab
        });
    },

    _applySlowEffect(enemy) {
        if (!this.effects || !this.effects.slow) return;
        let factor = this.effects.slow;
        if (enemy.data.isMoab && this.effects.moabSlow) {
            factor = Math.max(factor, this.effects.moabSlow);
        }
        enemy.applySlow(factor, this.effects.slowDuration, this.type === 'ice');
    },

    _applyDirectHit(enemy) {
        if (!enemy || !enemy.alive) return;
        this.hitEnemies.add(enemy);
        
        let dmg = this.damage;
        if (this.bonusCeramic && enemy.data.isCeramic) dmg += this.bonusCeramic;
        if (this.effects && this.effects.camoDmg && enemy.isCamo) dmg += this.effects.camoDmg;
        if (this.effects && this.effects.ceramicDmg && enemy.data.isCeramic) dmg += this.effects.ceramicDmg;
        
        this._applySlowEffect(enemy);
        
        const actualDmg = enemy.takeDamage(dmg, this.dmgType, this.effects, this.tower);
        if (actualDmg === -1 || isNaN(actualDmg)) return;
        
        if (this.tower) {
            this.tower.damageDealt += actualDmg;
            if (this.tower.parentTower) this.tower.parentTower.damageDealt += actualDmg;
        }
    },

    // Freeze/permafrost/stun-like hit effects shared by explosive blasts.
    // Kept independent of damage immunity so ice effects still land on
    // explosion-blocking bloons (Black/Zebra/DDT) — see _handleExplosiveHit.
    _applyExplosionEffects(e) {
        if (!this.effects) return;
        if (this.effects.freeze) {
            if (e.data.isMoab) {
                if (this.effects.superBrittle) {
                    e.brittle = true; e.brittleBonus = 5; e.brittleTimer = 4.0; e.isCamo = false;
                } else if (this.effects.embrittlement) {
                    e.brittle = true; e.brittleBonus = 1; e.brittleTimer = 4.0; e.isCamo = false;
                }
            } else {
                if (!e.isFrozen || this.effects.reFreeze) {
                    if (!(e.data.isWhite || e.data.isZebra)) {
                        e.applySlow(0.0, this.effects.freezeDuration || this.effects.freeze || 1.5, true);
                    }
                }
            }
        }
        
        if (this.effects.permafrost) {
            e.permafrostSlow = 0.5;
        }
        
        this._applySlowEffect(e);
    },

    _getExplosionPierce() {
        return (this.effects && this.effects.explosionPierce) ? this.effects.explosionPierce : ((this.tower && this.tower.stats.explosionPierce) ? this.tower.stats.explosionPierce : 100);
    },

    _getExplosionDamage() {
        return (this.effects && this.effects.explosionDamage) ? this.effects.explosionDamage : (this.tower ? this.tower.stats.explosionDamage : 2);
    },

    _handleStandardHit(enemy) {
        this.hitEnemies.add(enemy);
        
        let dmg = this.damage;
        if (this.bonusCeramic && enemy.data.isCeramic) dmg += this.bonusCeramic;
        
        if (this.effects && this.effects.camoDmg && enemy.isCamo) dmg += this.effects.camoDmg;
        if (this.effects && this.effects.ceramicDmg && enemy.data.isCeramic) dmg += this.effects.ceramicDmg;

        const actualDmg = enemy.takeDamage(dmg, this.dmgType, this.effects, this.tower);
        if (actualDmg === -1 || isNaN(actualDmg)) {
            this.alive = false;
            return;
        }
        
        if (this.tower) {
            this.tower.damageDealt += actualDmg;
            if (this.tower.parentTower) this.tower.parentTower.damageDealt += actualDmg;
            
            if (this.isCrit && actualDmg > 0 && GameEngine.floatingTexts) {
                GameEngine.floatingTexts.push({
                    x: enemy.x, 
                    y: enemy.y - 15,
                    text: `${actualDmg}!`,
                    life: 0.6, 
                    maxLife: 0.6,
                    color: '#f1c40f', 
                    vy: -40
                });
            }
        }
        
        if (this.effects && this.effects.freeze) {
            if (enemy.data.isMoab) {
                if (!enemy.data.isBAD) {
                    enemy.applySlow(0.0, this.effects.freezeDuration || this.effects.freeze || 2.0, false); 
                }
                if (this.effects.superBrittle) {
                    enemy.brittle = true; enemy.brittleBonus = 5; enemy.brittleTimer = 4.0; enemy.isCamo = false;
                } else if (this.effects.embrittlement) {
                    enemy.brittle = true; enemy.brittleBonus = 1; enemy.brittleTimer = 4.0; enemy.isCamo = false;
                }
            } else {
                if (!(enemy.data.isWhite || enemy.data.isZebra)) {
                    if (!enemy.isFrozen || this.effects.reFreeze) {
                        enemy.applySlow(0.0, this.effects.freezeDuration || this.effects.freeze || 1.5, true);
                    }
                }
            }
        }
        
        if (this.effects && this.effects.permafrost) {
            enemy.permafrostSlow = 0.5;
        }
        
        this._applySlowEffect(enemy);
        
        if (this.type === 'ninja' && this.target === enemy) {
            this.target = null;
        }

        if (this.type === 'trident' && this.tower) {
            const expRadius = this.tower.stats.explosionRadius || 15;
            const expDmg = this.tower.stats.explosionDamage || 2;
            const expPierce = this.tower.stats.explosionPierce || 3;
            GameEngine.explosions.push({ x: this.x, y: this.y, radius: 0, maxRadius: expRadius, life: 0.2, maxLife: 0.2, color: '#3498db' });
            Utils.applyAoeDamage(GameEngine, this.x, this.y, expRadius, expDmg, this.dmgType, this.tower, this.effects, { maxHits: expPierce });
        }

        if (this.effects && this.effects.ricochet > 0) {
            const nearby = GameEngine.enemyGrid.query(this.x, this.y, this.effects.ricochetRange, _ricochetScratch);
            let bestDistSq = this.effects.ricochetRange * this.effects.ricochetRange;
            let nextTarget = null;
            for (const e of nearby) {
                if (!e.alive || this.hitEnemies.has(e)) continue;
                const dSq = Utils.distanceSq(this.x, this.y, e.x, e.y);
                if (dSq < bestDistSq) {
                    bestDistSq = dSq;
                    nextTarget = e;
                }
            }
            if (nextTarget) {
                this.target = nextTarget;
                this.angle = Utils.angle(this.x, this.y, nextTarget.x, nextTarget.y);
                this.effects.ricochet--;
                this.pierce = Math.max(this.pierce, 1); 
                this.alive = true;
                return; 
            }
        }

        const cfg = ProjectileTypeConfig[this.type] || {};
        this.pierce--;
        
        if (this.pierce <= 0 && !cfg.survivesZeroPierce) {
            if (cfg.splitsOnZeroPierce && !this.hasSplit) {
                this.split();
            }
            this.alive = false;
        }
    }
};

export default ProjectileHitResolution;