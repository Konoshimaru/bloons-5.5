// js/engineComposition.js
// Composes the current GameEngine singleton from focused subsystem objects.
// Unlike Object.assign(), this rejects duplicate names and preserves property
// descriptors (including getters) so method ownership cannot be overwritten
// silently during module initialization.

export function attachEngineModule(engine, moduleName, module) {
    if (!engine || (typeof engine !== 'object' && typeof engine !== 'function')) {
        throw new TypeError('Engine composition target must be an object.');
    }
    if (!module || typeof module !== 'object') {
        throw new TypeError(`Engine module "${moduleName}" must be an object.`);
    }

    const descriptors = Object.getOwnPropertyDescriptors(module);
    const names = Object.keys(descriptors);
    const collisions = names.filter(name =>
        Object.prototype.hasOwnProperty.call(engine, name)
    );

    if (collisions.length > 0) {
        throw new Error(
            `Cannot attach engine module "${moduleName}": duplicate engine propert${collisions.length === 1 ? 'y' : 'ies'}: ${collisions.join(', ')}.`
        );
    }

    Object.defineProperties(engine, descriptors);
    return engine;
}
