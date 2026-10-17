// js/towerFactory.js
// Import-free factory slot so tower behaviors (e.g. village) can create towers without importing
// tower.js, which would create a dependency cycle. tower.js registers `create` when it loads.
export const towerFactory = { create: null };
