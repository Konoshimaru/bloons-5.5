import { describe, expect, it } from 'vitest';
import { attachEngineModule } from '../js/engineComposition.js';

describe('attachEngineModule', () => {
    it('attaches methods and returns the original engine object', () => {
        const engine = { existing: true };
        const module = { pauseGame() { return 'paused'; } };

        expect(attachEngineModule(engine, 'EngineInput', module)).toBe(engine);
        expect(engine.pauseGame()).toBe('paused');
        expect(engine.existing).toBe(true);
    });

    it('rejects duplicate property names instead of silently overwriting them', () => {
        const engine = { update() { return 'core update'; } };
        const module = {
            update() { return 'module update'; },
            handleInput() { return true; }
        };

        expect(() => attachEngineModule(engine, 'EngineInput', module))
            .toThrow(/EngineInput.*duplicate engine property: update/);
        expect(engine.update()).toBe('core update');
        expect(engine.handleInput).toBeUndefined();
    });

    it('preserves getter descriptors from subsystem modules', () => {
        const engine = {};
        const module = Object.defineProperty({}, 'currentMode', {
            enumerable: true,
            configurable: true,
            get() { return 'debug'; }
        });

        attachEngineModule(engine, 'TestModule', module);
        expect(engine.currentMode).toBe('debug');
        expect(Object.getOwnPropertyDescriptor(engine, 'currentMode').get).toBeTruthy();
    });

    it('rejects invalid targets and modules with useful errors', () => {
        expect(() => attachEngineModule(null, 'BadModule', {})).toThrow(/target/);
        expect(() => attachEngineModule({}, 'BadModule', null)).toThrow(/must be an object/);
    });

    it('does not partially apply a module when any collision exists', () => {
        const engine = { occupied: 1 };
        const module = { available: 2, occupied: 3 };

        expect(() => attachEngineModule(engine, 'MixedModule', module)).toThrow(/occupied/);
        expect(engine.available).toBeUndefined();
        expect(engine.occupied).toBe(1);
    });
});
