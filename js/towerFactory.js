// js/towerFactory.js
// Import-cycle boundary: tower behavior modules can request Tower instances
// without importing tower.js (which itself imports the tower behavior registry).

let createImplementation = null;

/**
 * Register the concrete Tower constructor without exposing a writable factory
 * slot to every importing module. Re-registration is allowed for Vite HMR.
 */
export function registerTowerFactory(create) {
    if (typeof create !== 'function') {
        throw new TypeError('Tower factory registration requires a function.');
    }
    createImplementation = create;
}

export const towerFactory = Object.freeze({
    create(...args) {
        if (!createImplementation) {
            throw new Error(
                'Tower factory is not initialized. Import js/tower.js before creating towers from behavior modules.'
            );
        }
        return createImplementation(...args);
    }
});
