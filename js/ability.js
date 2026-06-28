// js/ability.js
export class Ability {
    constructor(maxCooldown = 60, duration = 0) {
        this.maxCooldown = maxCooldown;
        this.cooldown = 0;
        this.duration = duration;
        this.activeTime = 0;
    }

    canUse() {
        return this.cooldown <= 0;
    }

    trigger() {
        this.cooldown = this.maxCooldown;
        this.activeTime = this.duration;
    }

    update(dt) {
        if (this.cooldown > 0) {
            this.cooldown = Math.max(0, this.cooldown - dt);
        }
        if (this.activeTime > 0) {
            this.activeTime = Math.max(0, this.activeTime - dt);
        }
    }

    isActive() {
        return this.activeTime > 0;
    }
}