// js/projectileTypeConfig.js
// Declarative configuration for projectile subtypes.

export const ProjectileTypeConfig = {
    bomb:             { isExplosive: true, explosionColor: '#e67e22' },
    mortar_shell:     { isExplosive: true, explosionColor: '#e67e22' },
    potion:           { isExplosive: true, explosionColor: '#9b59b6', isAcid: true },
    flash_bomb:       { isExplosive: true, explosionColor: '#e67e22' },
    sticky_bomb:      { isExplosive: true, explosionColor: '#e67e22' },
    ice_bomb:         { isExplosive: true, explosionColor: '#1abc9c' },
    
    spike:            { exemptFromHitTracking: true },
    spike_opult:      { exemptFromHitTracking: true },
    juggernaut:       { exemptFromHitTracking: true },
    ultra_juggernaut: { exemptFromHitTracking: true, splitsOnZeroPierce: true },
    
    boomerang:        { survivesZeroPierce: true },
    arrow:            { decrementsPierceOnExplosion: true }
    
    // blue is intentionally omitted so it uses the default {} (standard hit handler)
};