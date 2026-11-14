// Shared hard limits used by both the simulation cleanup pass and burst
// producers. Keeping the values in one module prevents a projectile source
// from creating more active objects than the loop is prepared to process.
export const MAX_ACTIVE_PROJECTILES = 1500;
export const MAX_ACTIVE_PARTICLES = 400;
