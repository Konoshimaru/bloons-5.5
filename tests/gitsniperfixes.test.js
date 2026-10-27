// @vitest-environment jsdom
// ============================================================================
// v1.4.4 GitHub-lineage sniper/perf regression guard.
//
// Owner report: "the game still lags heavily with the sniper - there's one
// GitHub version with a sniper fix, look for it and see if we had a
// regression." The GitHub repo (Konoshimaru/bloons-5.5) carries a whole
// sniper-lag fix lineage across TWO branches; this suite pins every fix from
// every one of those commits so a future refactor can never silently drop
// one again. Audit result (2026-10-28): ALL of them are present in this
// tree - there is NO regression - and this file keeps it that way.
//
// The audited commits:
//   7056779  "performance fix 2"              (main)      Jul 20
//   5bac0c0  "performance fix"                (main)      Jul 20
//   823611e  "roaring knight lag fix"         (main)      Aug  9
//   27f11a7  "sniper needs fix cause lag"     (main)      Aug 11
//   5f87a0d  "temporary fix ... 9999 to 999"  (main)      Aug 11 - REVERTED by
//            the author himself in 088355e; 9999 is the intended final state
//   2a7c064  "sniper lag improvement"         (main)      Aug 13
//   0bad3c4  "fully fixed sniper lag"         (test-version ONLY!) Aug 13
//   d29d4af  "ace fix and perfomrnace improvements" (main)      Aug 19
//   4e2bd10  "confirming knight fix update"   (test-version)       Oct 19
//
// NOTE on 0bad3c4: it lives ONLY on the test-version branch and never made it
// to main - that is exactly the class of silent loss this guard prevents.
// ============================================================================
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

vi.mock('../js/audio.js', () => ({
    AudioEngine: { playSfx: vi.fn(), playMenuMusic: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Source pins - one it() per GitHub commit, one expect() per fix hunk.
// ---------------------------------------------------------------------------
describe('GitHub sniper-fix lineage: 2a7c064 "sniper lag improvement"', () => {
    let towerBehavior, sniperSrc, pixiSrc;
    beforeAll(() => {
        towerBehavior = read('js/towerBehavior.js');
        sniperSrc = read('js/towers/sniper.js');
        pixiSrc = read('js/webgl/pixiRenderer.js');
    });

    it('cooldown can never drift indefinitely (clamp at -1)', () => {
        expect(towerBehavior).toMatch(/if \(tower\.cooldown < -1\) tower\.cooldown = -1;/);
    });

    it('a fruitless target scan parks the cooldown (no per-tick rescans)', () => {
        expect(towerBehavior).toMatch(
            /tower\.cooldown = Math\.max\(tower\.cooldown, TARGET_RESCAN_INTERVAL\);/
        );
    });

    it('line-of-sight blockers are cached once on the MAP, not per tower', () => {
        expect(towerBehavior).toMatch(/engine\.map\._losBlockers/);
        expect(towerBehavior).not.toMatch(/tower\._losBlockers/);
    });

    it('Elite Support re-buff is throttled (~0.4s refresh, not 60x/s churn)', () => {
        expect(sniperSrc).toMatch(/_eliteBuffTimer/);
        expect(sniperSrc).toMatch(/if \(refresh\) \{\s*\n\s*t\.addBuff\('sniper_elite'/);
    });

    it('attack animation frames are preloaded via the generated manifest', () => {
        expect(pixiSrc).toMatch(/fetch\('sprites\/manifest\.json'\)/);
        expect(pixiSrc).toMatch(/attack_full/);
    });
});

describe('GitHub sniper-fix lineage: 0bad3c4 "fully fixed sniper lag" (test-version branch)', () => {
    let towerBehavior, renderTowers;
    beforeAll(() => {
        towerBehavior = read('js/towerBehavior.js');
        renderTowers = read('js/webgl/renderTowers.js');
    });

    it('_findTarget skips the distance math for global-range towers', () => {
        expect(towerBehavior).toMatch(/const isGlobal = tower\.stats\.range === 9999;/);
        expect(towerBehavior).toMatch(/const needDist = !isGlobal \|\| currentTargeting === 'Close' \|\| minRange > 0;/);
    });

    it('_getAnimationAsset is cached per upgrade state (no per-shot resolution)', () => {
        expect(towerBehavior).toMatch(/tower\._animAssetCacheKey === upgradeKey && tower\._animAssetCache/);
        expect(towerBehavior).toMatch(/tower\._animAssetCacheKey = upgradeKey;/);
    });

    it('tower shadows are dirty-checked, not rebuilt every frame (Pixi v8 buffer churn)', () => {
        expect(renderTowers).toMatch(/if \(entry\._shadowR !== shadowR\) \{/);
    });

    it('night glow is dirty-checked on radius AND alpha', () => {
        expect(renderTowers).toMatch(/entry\._nightGlowR !== glowR \|\| entry\._nightAlpha !== engine\.nightAlpha/);
        expect(renderTowers).toMatch(/else if \(entry\._nightAlpha !== 0\) \{/);
    });
});

describe('GitHub sniper-fix lineage: 7056779 "performance fix 2" (sniper rework)', () => {
    it('bounce targets are ranked by distanceSq (no sqrt per candidate)', () => {
        const src = read('js/towers/sniper.js');
        expect(src).toMatch(/bestDistSq/);
        expect(src).toMatch(/Utils\.distanceSq\(currentTarget\.x, currentTarget\.y, e\.x, e\.y\)/);
    });

    it('supply-drop banana crates still animate their fall', () => {
        const src = read('js/towers/sniper.js');
        expect(src).toMatch(/b\.progress \+= dt \/ 0\.8/);
    });
});

describe('GitHub sniper-fix lineage: 823611e "roaring knight lag fix"', () => {
    it('the Knight boss (tier 99) is NOT double-updated by the enemy loop', () => {
        const src = read('js/simulationLoop.js');
        expect(src).toMatch(/if \(e\.tier === 99\) continue;/);
    });
});

describe('GitHub sniper-fix lineage: 4e2bd10 "confirming knight fix update"', () => {
    it('the Knight is flagged as a free mover (towers aim AT him, not along the path)', () => {
        const src = read('js/bosses/knight.js');
        expect(src).toMatch(/this\.followsPath = false;/);
    });

    it('_findTarget skips invulnerable/untargetable enemies (rolling Knight)', () => {
        const src = read('js/towerBehavior.js');
        expect(src).toMatch(/if \(e\.invulnerable \|\| e\.untargetable\) continue;/);
    });

    it('lead aim refuses non-path-followers and is exported for reuse', () => {
        const src = read('js/towerBehavior.js');
        expect(src).toMatch(/export function computeLeadAim\(/);
        expect(src).toMatch(/if \(target\.followsPath === false \|\| !\(target\.data\.speed > 0\)\) return null;/);
    });

    it('the cached-target fast path also rejects invulnerable/untargetable', () => {
        const src = read('js/towerBehavior.js');
        expect(src).toMatch(
            /cached\.alive && !cached\.invulnerable && !cached\.untargetable && cached\._spawnId/
        );
    });
});

describe('GitHub sniper-fix lineage: d29d4af "ace fix and perfomrnace improvements"', () => {
    it('fireWithoutTarget towers release their volley with a null pendingTarget', () => {
        const src = read('js/towerBehavior.js');
        expect(src).toMatch(/else if \(!pending && tower\.stats\.fireWithoutTarget\) \{[\s\S]*?_executeFire\(tower, null, engine\);/);
        const ace = read('js/towers/ace.js');
        expect(ace).toMatch(/fireWithoutTarget: true/);
    });

    it('Ace machine-gun targeting is cached with a 0.2s refresh + spawn-id validation', () => {
        const ace = read('js/towers/ace.js');
        expect(ace).toMatch(/_gunTargetTimers\[mode\] = 0\.2;/);
        expect(ace).toMatch(/cached\._spawnId === tower\._gunTargetSpawnIds\[mode\]/);
        expect(ace).toMatch(/tower\._aceDt = dt;/);
    });

    it('post-CHIMPS cutscene MOAB lookup is cached, not re-scanned every frame', () => {
        const src = read('js/engine.js');
        expect(src).toMatch(/let damagedMoab = this\._postChimpsMoab;/);
        expect(src).toMatch(/this\._postChimpsMoab = damagedMoab;/);
    });

    it('Profiler samples live in a ring buffer (no push+shift reindex)', () => {
        const src = read('js/profiler.js');
        expect(src).toMatch(/this\.buffer\[this\._head\] = s;/);
        expect(src).toMatch(/this\._head = \(this\._head \+ 1\) % this\.maxSamples;/);
    });

    it('explosions/acid pools cap via swap-remove (no shift() reindex)', () => {
        const src = read('js/simulationLoop.js');
        expect(src).toMatch(/this\.explosions\[0\] = this\.explosions\[this\.explosions\.length - 1\]; this\.explosions\.pop\(\);/);
        expect(src).toMatch(/this\.acidPools\[0\] = this\.acidPools\[this\.acidPools\.length - 1\]; this\.acidPools\.pop\(\);/);
    });

    it('wave display only rewrites the DOM on a real change', () => {
        const src = read('js/ui.js');
        expect(src).toMatch(/if \(wave === this\._prevWave\) return;/);
    });

    it('renderers sweep dead entries via frameGen stamps, not per-frame Sets', () => {
        for (const f of ['js/webgl/renderTowers.js', 'js/webgl/renderUI.js', 'js/webgl/renderProjectiles.js', 'js/webgl/renderWorld.js']) {
            expect(read(f)).toMatch(/_frameGen = \(this\._frameGen \+ 1\) \|\| 1;/);
        }
        expect(read('js/webgl/renderTowers.js')).toMatch(/const EMPTY_OVERLAYS = \[\];/);
        expect(read('js/webgl/renderTowers.js')).toMatch(/this\._frameMscale = mscale;/);
    });

    it('projectile renderer caches pop + banana textures (no per-frame string keys)', () => {
        const src = read('js/webgl/renderProjectiles.js');
        expect(src).toMatch(/this\._popTextureCache = new Map\(\);/);
        expect(src).toMatch(/this\._bananaTexture = PixiAssets\.get\(Names\.getBanana\(\)\);/);
    });

    it('enemy/HeroVFX renderers write into reused scratch objects/arrays', () => {
        expect(read('js/webgl/renderEnemies.js')).toMatch(/entry\._baseInfo/);
        expect(read('js/webgl/renderHeroVFX.js')).toMatch(/const _blobScratch = new Array\(34\);/);
        expect(read('js/webgl/renderHeroVFX.js')).toMatch(/const _captureScratch = new Array\(82\);/);
        expect(read('js/webgl/renderHeroVFX.js')).toMatch(/const _waveScratch = new Array\(202\);/);
    });

    it('Knight: point anim holds at peak until the throw releases; trail pool is capped', () => {
        expect(read('js/bosses/knight.js')).toMatch(/this\.pointRelease = false;/);
        expect(read('js/bosses/knightAttacks.js')).toMatch(/this\.pointRelease = true;/);
        expect(read('js/bosses/knightAttacks.js')).toMatch(/if \(this\.pointRelease && !this\.spriteAnimReverse\) this\.spriteAnimReverse = true;/);
        expect(read('js/webgl/renderCutscene.js')).toMatch(/const MAX_TRAIL = 15;/);
    });

    it('loading minigame: hold-to-repeat is dt-driven and the vignette gradient is cached', () => {
        const src = read('js/loadingMinigame.js');
        expect(src).toMatch(/let holdActive = false;/);
        expect(src).toMatch(/while \(holdTimer >= T\.holdRepeat\) \{/);
        expect(src).toMatch(/ctx\.fillStyle = vignetteGradient;/);
        const tuning = read('js/tuning.js');
        expect(tuning).toMatch(/holdRepeat: 0\.12/);
        expect(tuning).toMatch(/fadeInTime: 0\.6/);
    });
});

describe('GitHub sniper-fix lineage: the range saga (5f87a0d -> 088355e)', () => {
    // 5f87a0d dropped the sniper to range 999 as a "temporary fix"; the author
    // himself REVERTED it the next day (088355e) once 2a7c064 landed, and the
    // commit the owner linked as "the fixed version" (2a7c064) runs at 9999.
    // The real lag fixes are the targeting/LOS/render hunks pinned above, NOT
    // the range - so this pins the intended final state to stop a future
    // audit from "helpfully" restoring 999 and changing gameplay.
    it('the sniper keeps its intended global range of 9999', () => {
        const src = read('js/towers/sniper.js');
        expect(src).toMatch(/range: 9999,/);
    });
});

// ---------------------------------------------------------------------------
// Behavioral pins - the two fixes whose EFFECT is cheap to exercise for real.
// ---------------------------------------------------------------------------
describe('behavioral: fruitless scans park the cooldown (real tower fixture)', () => {
    it('an idle 0-0-5 sniper holds a parked cooldown instead of re-scanning every tick', async () => {
        const { GameEngine } = await import('../js/engineRef.js');
        const { Tower } = await import('../js/tower.js');

        GameEngine.enemies = [];
        GameEngine.towers = [];
        GameEngine.waveManager = { currentWave: 1, waveActive: true };
        GameEngine.hasLeakingEnemy = false;
        GameEngine.nightAlpha = 0;
        GameEngine.difficulty = undefined;
        GameEngine.config = { data: {} };
        GameEngine.lives = 150;
        GameEngine.cash = 100000;
        GameEngine.log = () => {};
        GameEngine.addCash = () => {};
        GameEngine.spawnPopEffect = () => {};
        GameEngine.updateUI = () => {};
        GameEngine.deselectAll = () => {};
        GameEngine.selectedPlacedTower = null;
        GameEngine.mouse = { x: 400, y: 300 };
        GameEngine.enemyGrid = { query: () => [] };
        GameEngine.projectilePool = { active: [] };
        GameEngine.particlePool = { active: [] };
        GameEngine.explosions = [];
        GameEngine.floatingTexts = [];
        GameEngine.map = {
            props: [],
            getTotalLength: () => 1000,
            getPositionAtDistance: () => ({ x: 0, y: 0, finished: true }),
        };

        const sniper = new Tower(640, 300, 'sniper');
        sniper.upgrades = [0, 0, 5];
        sniper._recalculateStats();
        GameEngine.towers.push(sniper);

        const DT = 1 / 60;
        sniper.update(DT, GameEngine); // first fruitless scan
        // 0bad3c4 + 2a7c064: the cooldown is parked at the rescan interval so
        // firingReady goes false and the tower stops scanning every tick.
        expect(sniper._targetRescanTimer).toBeGreaterThan(0);
        expect(sniper.cooldown).toBeGreaterThanOrEqual(0.15 - 1e-9);
        // Without parking, cooldown would have drifted to <= 0 long ago.
        for (let i = 0; i < 120; i++) sniper.update(DT, GameEngine);
        expect(sniper.cooldown).toBeLessThanOrEqual(0.15 + 1e-9);
        expect(sniper._cachedTarget).toBeNull();
    });
});

describe('behavioral: Elite Support re-buff throttle (real sniper module)', () => {
    it('4 seconds of updateSupport re-adds the buff ~10 times, not 240', async () => {
        const { GameEngine } = await import('../js/engineRef.js');
        const sniperTower = (await import('../js/towers/sniper.js')).default;

        const target = { type: 'sniper', addBuff: vi.fn(), buffedFireRate: 0 };
        const source = { stats: { globalSniperBuff: true } };
        GameEngine.towers = [source, target];

        const DT = 1 / 60;
        for (let i = 0; i < 240; i++) sniperTower.updateSupport(source, DT);

        // 0.4s refresh over 4s -> ~10 re-buffs (bounded generously), while the
        // fire-rate scalar is re-applied on EVERY tick so the buff never lapses.
        expect(target.addBuff.mock.calls.length).toBeGreaterThan(4);
        expect(target.addBuff.mock.calls.length).toBeLessThanOrEqual(14);
        expect(target.buffedFireRate).toBe(0.33);
    });
});

// ---------------------------------------------------------------------------
// v1.4.4 wiring - the runtime version badge + package cross-check.
// ---------------------------------------------------------------------------
describe('v1.4.4 version badge wiring', () => {
    it('GAME_VERSION matches package.json (single source of truth, no drift)', async () => {
        const { GAME_VERSION } = await import('../js/constants.js');
        const pkg = JSON.parse(read('package.json'));
        expect(GAME_VERSION).toBe(pkg.version);
    });

    it('the main menu carries the badge element and menuController fills it', () => {
        expect(read('index.html')).toMatch(/id="mm-version-badge"/);
        const mc = read('js/menuController.js');
        expect(mc).toMatch(/import \{ GAME_VERSION \} from '\.\/constants\.js';/);
        expect(mc).toMatch(/badge\.textContent = `v\$\{GAME_VERSION\}`/);
    });

    it('the Update Log has the v1.4.4 gold entry', () => {
        expect(read('index.html')).toMatch(/v1\.4\.4 — Guarded optimizations/);
    });

    it('the Update Log has the v1.4.5 gold entry (guard-comment wave)', () => {
        expect(read('index.html')).toMatch(/v1\.4\.5 — Regression armor/);
    });
});
