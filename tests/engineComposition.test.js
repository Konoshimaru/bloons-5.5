import { describe, expect, it } from 'vitest';
import { attachModuleMethods } from '../js/engineComposition.js';

describe('attachModuleMethods', () => {
    it('attaches methods and returns the original target object', () => {
        const target = { existing: true };
        const module = { pauseGame() { return 'paused'; } };

        expect(attachModuleMethods(target, 'EngineInput', module)).toBe(target);
        expect(target.pauseGame()).toBe('paused');
        expect(target.existing).toBe(true);
    });

    it('rejects duplicate property names instead of silently overwriting them', () => {
        const target = { update() { return 'core update'; } };
        const module = {
            update() { return 'module update'; },
            handleInput() { return true; }
        };

        expect(() => attachModuleMethods(target, 'EngineInput', module))
            .toThrow(/EngineInput.*undeclared duplicate names: update/);
        expect(target.update()).toBe('core update');
        expect(target.handleInput).toBeUndefined();
    });

    it('allows only explicitly declared wrapper overrides', () => {
        const target = { refreshMapSelector() { return 'selector'; } };
        const module = { refreshMapSelector() { return 'delegated'; } };

        attachModuleMethods(target, 'menuController', module, {
            allowOverrides: ['refreshMapSelector']
        });
        expect(target.refreshMapSelector()).toBe('delegated');
    });

    it('rejects stale or unnecessary allowlist entries', () => {
        expect(() => attachModuleMethods({}, 'menuController', {
            refreshMapSelector() {}
        }, { allowOverrides: ['refreshMapSelector'] }))
            .toThrow(/allowlisted names not present on target/);
    });

    it('preserves getter descriptors from subsystem modules', () => {
        const target = {};
        const module = Object.defineProperty({}, 'currentMode', {
            enumerable: true,
            configurable: true,
            get() { return 'debug'; }
        });

        attachModuleMethods(target, 'TestModule', module);
        expect(target.currentMode).toBe('debug');
        expect(Object.getOwnPropertyDescriptor(target, 'currentMode').get).toBeTruthy();
    });

    it('rejects invalid targets and modules with useful errors', () => {
        expect(() => attachModuleMethods(null, 'BadModule', {})).toThrow(/target/);
        expect(() => attachModuleMethods({}, 'BadModule', null)).toThrow(/must be an object/);
    });

    it('does not partially apply a module when a collision exists', () => {
        const target = { occupied: 1 };
        const module = { available: 2, occupied: 3 };

        expect(() => attachModuleMethods(target, 'MixedModule', module)).toThrow(/occupied/);
        expect(target.available).toBeUndefined();
        expect(target.occupied).toBe(1);
    });
});
