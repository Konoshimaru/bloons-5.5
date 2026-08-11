// js/projectileTypeConfig.js
// Declarative configuration for projectile subtypes.

export const ProjectileTypeConfig = {
    bomb:             { isExplosive: true, explosionColor: '#e67e22' },
    missile:          { isExplosive: true, explosionColor: '#e67e22' },
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
    arrow:            { decrementsPierceOnExplosion: true },
        // Add these to the ProjectileTypeConfig object
    beast_attack:    { isExplosive: true, explosionColor: '#3498db', decrementsPierceOnExplosion: true },
    beast_water:     { isExplosive: true, explosionColor: '#2980b9', decrementsPierceOnExplosion: true },
    beast_land:      { isExplosive: true, explosionColor: '#27ae60', decrementsPierceOnExplosion: true },
    beast_air:       { isExplosive: true, explosionColor: '#f1c40f', decrementsPierceOnExplosion: true },
        // Add to ProjectileTypeConfig
    thorn:            { exemptFromHitTracking: true } // Thorns pass through and hit instantly
    
    // blue, trident, wavelet, ice_ball, tentacle intentionally omitted 
    // so they use the default {} (standard hit handler)
};
