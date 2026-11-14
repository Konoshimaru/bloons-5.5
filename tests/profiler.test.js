import { afterEach, describe, expect, it } from 'vitest';
import { Profiler } from '../js/profiler.js';

afterEach(() => { Profiler.reset(); Profiler.enabled = true; });

function makeEngine() {
    const sniper = { type:'sniper', upgrades:[0,0,5], targetingMode:'Strong',
        stats:{ eliteDefender:true, shrapnel:true, bounces:2 } };
    return {
        towers:[sniper], selectedPlacedTower:sniper, enemies:[],
        projectilePool:{active:[]}, particlePool:{active:[]}, explosions:[], floatingTexts:[],
        waveManager:{currentWave:2},
        towerGrid:{stats:()=>({cells:1,entities:1,maxBucket:1})},
        enemyGrid:{stats:()=>({cells:0,entities:0,maxBucket:0})},
        rendererName:'WebGL', canvas:{width:1280,height:720}, gameState:'playing', fps:60,
    };
}

describe('capture-only performance diagnostics',()=>{
    it('records stage timings, counters, and tower loadout metadata',()=>{
        const engine=makeEngine();
        Profiler.startCapture();
        const token=Profiler.beginMeasure('sniper.targetDamage');
        expect(token).not.toBeNull();
        Profiler.endMeasure(token);
        Profiler.count('sniper.shots',2);
        Profiler.count('sniper.targetScans');
        Profiler.record(engine,{sim:24,render:1,total:16.7,steps:2});
        expect(Profiler.session[0].counts['sniper.shots']).toBe(2);
        expect(Profiler.session[0].counts['sniper.targetScans']).toBe(1);
        Profiler.stopCapture();
        const report=Profiler.buildReport(engine,Profiler.session);
        expect(report.hotspots.timingMs['sniper.targetDamage']).toHaveProperty('p95');
        expect(report.hotspots.countTotals['sniper.shots']).toBe(2);
        expect(report.meta.towerDetails[0]).toMatchObject({
            type:'sniper', upgrades:[0,0,5], targetingMode:'Strong',
            eliteDefender:true, shrapnel:true, bounces:2,
        });
        expect(report.meta.selectedTower).toMatchObject({type:'sniper',upgrades:[0,0,5]});
        expect(Profiler.formatReport(report)).toContain('Diagnostic timings');
    });
    it('does not collect detail metrics outside explicit capture',()=>{
        expect(Profiler.beginMeasure('sniper.fire')).toBeNull();
        Profiler.count('sniper.shots');
        expect(Profiler._frameMeasures).toEqual({});
        expect(Profiler._frameCounts).toEqual({});
    });
    it('resets counters between recorded frames',()=>{
        const engine=makeEngine();
        Profiler.startCapture();
        Profiler.count('sniper.shots');
        Profiler.record(engine,{sim:2,render:1,total:16.7,steps:1});
        Profiler.record(engine,{sim:2,render:1,total:16.7,steps:1});
        expect(Profiler.session[0].counts['sniper.shots']).toBe(1);
        expect(Profiler.session[1].counts).toEqual({});
    });
});
