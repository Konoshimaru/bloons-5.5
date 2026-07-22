// js/projectileHitResolution.js
import { Utils } from './utils.js';
import { GameEngine } from './engine.js';
import { DamageType, createDmgType } from './damageTypes.js';

const ProjectileHitResolution = {
    _checkCollisions() {
        const nearby = GameEngine.enemyGrid.query(this.x, this.y, this.radius + 40);
        for (const e of nearby) {
            if (!e.alive) continue;
            
            if (this.type !== 'spike' && this.type !== 'spike_opult' && this.type !== 'juggernaut' && this.type !== 'ultra_juggernaut' && this.hitEnemies.has(e)) continue;
            
            if (e.isCamo && !(this.tower && (this.tower.stats.canSeeCamo || this.tower.buffedCamo))) continue;
            
            const eRad = e.radius || e.data.radius || 10;
            if (Utils.withinRange(this.x, this.y, e.x, e.y, eRad + this.radius)) {
                this.hit(e);
                if (this.type !== 'spike' && this.type !== 'spike_opult' && this.type !== 'juggernaut' && this.type !== 'ultra_juggernaut') this.hitEnemies.add(e);
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
            this._handleExplosiveHit();
        } else if (enemy) {
            this._handleStandardHit(enemy);
        }
    },

    _isExplosive() {
        return this.type === 'bomb' || this.type === 'mortar_shell' || this.type === 'potion' || this.type === 'flash_bomb' || this.type === 'sticky_bomb' || this.type === 'ice_bomb' || (this.effects && this.effects.isExplosive);
    },

    _handleExplosiveHit() {
        const expRadius = this._getExplosionRadius();
        GameEngine.explosions.push({ x: this.x, y: this.y, radius: 0, maxRadius: expRadius, life: 0.3, maxLife: 0.3, color: this._getExplosionColor() });
        
        const bombDmgType = this._createBombDmgType();
        const nearby = GameEngine.enemyGrid.query(this.x, this.y, expRadius);
        const maxPierce = this._getExplosionPierce();
        
        let hits = 0;
        for (const e of nearby) {
            if (hits >= maxPierce) break;
            if (!e.alive) continue;
            if (e.data.blocksDamageType && e.data.blocksDamageType(bombDmgType)) continue;
            
            if (e.isCamo && !(this.effects && this.effects.canSeeCamo) && !(this.tower && (this.tower.stats.canSeeCamo || this.tower.buffedCamo))) continue;
            if (e.data.isLead && !(this.effects && this.effects.canHitLead) && !(bombDmgType.canHitLead)) continue;
            if (e.data.isMoab && !(this.effects && this.effects.canHitMoab)) continue;
            
            if (Utils.withinRange(this.x, this.y, e.x, e.y, expRadius)) {
                const expDmg = this._getExplosionDamage();
                const dmg = e.takeDamage(expDmg, bombDmgType, this.effects, this.tower);
                if (dmg === -1) continue;
                if (this.tower) this.tower.damageDealt += dmg;
                
                if (this.effects && this.effects.freeze) {
                    if (e.data.isMoab) {
                        if (this.effects.superBrittle) {
                            e.brittle = true; e.brittleBonus = 5; e.brittleTimer = 4.0; e.isCamo = false;
                        } else if (this.effects.embrittlement) {
                            e.brittle = true; e.brittleBonus = 1; e.brittleTimer = 4.0; e.isCamo = false;
                        }
                    } else {
                        if (!e.isFrozen || this.effects.reFreeze) {
                            if (!(e.data.isWhite || e.data.isZebra)) {
                                e.applySlow(0.0, this.effects.freezeDuration || 1.5, true);
                            }
                        }
                    }
                }
                
                if (this.effects && this.effects.permafrost) {
                    e.permafrostSlow = 0.5;
                }
                
                hits++;
            }
        }

        if (this.type === 'arrow') {
            this.pierce--;
            if (this.pierce <= 0) this.alive = false;
        } else {
            this.alive = false;
        }
    },

    _getExplosionRadius() {
        return this.effects && this.effects.explosionRadius ? this.effects.explosionRadius : (this.tower ? this.tower.stats.explosionRadius : 60);
    },

    _getExplosionColor() {
        if (this.type === 'potion') return '#9b59b6';
        if (this.type === 'ice_bomb') return '#1abc9c';
        return '#e67e22';
    },

    _createBombDmgType() {
        const bombCanHitLead = this.tower ? (this.tower.stats.canHitLead || this.tower.buffedLead || (this.effects && this.effects.canHitLead)) : true;
        return createDmgType(DamageType.EXPLOSION, {
            isFire: this.dmgType.isFire,
            isAcid: this.type === 'potion',
            moabDmg: this.dmgType.moabDmg || 0,
            fortifiedDmg: this.dmgType.fortifiedDmg || 0,
            canHitLead: bombCanHitLead
        });
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
        
        // FIX: Apply custom damage bonuses from effects (Super Monkey Ultravision/Dark Champion)
        if (this.effects && this.effects.camoDmg && enemy.isCamo) dmg += this.effects.camoDmg;
        if (this.effects && this.effects.ceramicDmg && enemy.data.isCeramic) dmg += this.effects.ceramicDmg;

        const actualDmg = enemy.takeDamage(dmg, this.dmgType, this.effects, this.tower);
        if (actualDmg === -1 || isNaN(actualDmg)) {
            this.alive = false;
            return;
        }
        
        if (this.tower) this.tower.damageDealt += actualDmg;
        
        if (this.effects && this.effects.freeze) {
            if (enemy.data.isMoab) {
                if (!enemy.data.isBAD) {
                    enemy.applySlow(0.0, this.effects.freezeDuration || 2.0, false); 
                }
                if (this.effects.superBrittle) {
                    enemy.brittle = true; enemy.brittleBonus = 5; enemy.brittleTimer = 4.0; enemy.isCamo = false;
                } else if (this.effects.embrittlement) {
                    enemy.brittle = true; enemy.brittleBonus = 1; enemy.brittleTimer = 4.0; enemy.isCamo = false;
                }
            } else {
                if (!(enemy.data.isWhite || enemy.data.isZebra)) {
                    if (!enemy.isFrozen || this.effects.reFreeze) {
                        enemy.applySlow(0.0, this.effects.freezeDuration || 1.5, true);
                    }
                }
            }
        }
        
        if (this.effects && this.effects.permafrost) {
            enemy.permafrostSlow = 0.5;
        }
        
        if (this.effects && this.effects.slow) {
            enemy.applySlow(this.effects.slow, this.effects.slowDuration, this.type === 'ice');
        }
        
        if (this.type === 'ninja' && this.target === enemy) {
            this.target = null;
        }

        if (this.effects && this.effects.ricochet > 0) {
            const nearby = GameEngine.enemyGrid.query(this.x, this.y, this.effects.ricochetRange);
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

        this.pierce--;
        if (this.pierce <= 0 && this.type !== 'boomerang') {
            if (this.type === 'ultra_juggernaut' && !this.hasSplit) {
                this.split();
            }
            this.alive = false;
        }
    }
};

export default ProjectileHitResolution;