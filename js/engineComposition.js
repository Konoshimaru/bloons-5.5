// js/engineComposition.js
// Composes shared objects from focused subsystem modules.
// Unlike Object.assign(), this checks every property name before mutation and
// requires deliberate override declarations for wrapper/delegation methods.

export function attachModuleMethods(target, moduleName, module, { allowOverrides = [] } = {}) {
    if (!target || (typeof target !== 'object' && typeof target !== 'function')) {
        throw new TypeError('Module composition target must be an object.');
    }
    if (!module || typeof module !== 'object') {
        throw new TypeError(`Module "${moduleName}" must be an object.`);
    }
    if (!Array.isArray(allowOverrides) || !allowOverrides.every(name => typeof name === 'string')) {
        throw new TypeError('allowOverrides must be an array of property names.');
    }

    const descriptors = Object.getOwnPropertyDescriptors(module);
    const names = Object.keys(descriptors);
    const collisions = names.filter(name =>
        Object.prototype.hasOwnProperty.call(target, name)
    );
    const allowed = new Set(allowOverrides);
    const undeclared = collisions.filter(name => !allowed.has(name));
    const staleAllowlist = allowOverrides.filter(name => !collisions.includes(name));

    if (undeclared.length > 0 || staleAllowlist.length > 0) {
        const details = [];
        if (undeclared.length > 0) {
            details.push(`undeclared duplicate names: ${undeclared.join(', ')}`);
        }
        if (staleAllowlist.length > 0) {
            details.push(`allowlisted names not present on target: ${staleAllowlist.join(', ')}`);
        }
        throw new Error(`Cannot attach module "${moduleName}": ${details.join('; ')}.`);
    }

    const nonConfigurable = collisions.filter(name =>
        Object.getOwnPropertyDescriptor(target, name)?.configurable === false
    );
    if (nonConfigurable.length > 0) {
        throw new Error(
            `Cannot attach module "${moduleName}": target properties cannot be replaced: ${nonConfigurable.join(', ')}.`
        );
    }

    Object.defineProperties(target, descriptors);
    return target;
}
