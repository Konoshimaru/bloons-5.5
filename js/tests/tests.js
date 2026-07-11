// js/tests/tests.js
import { deepFreeze } from '../utils.js';
import { DamageType, createDmgType, resolveDmgType } from '../damageTypes.js';
import { EnemyTypes } from '../data.js';
import { Difficulties } from '../config.js';
import { getSfxAssetChoices } from '../audio.js';
import { CutsceneManager } from '../cutscene.js'; // PRO FIX: Import CutsceneManager

const results = { passed: 0, failed: 0, errors: [] };

function assert(condition, label) {
    if (condition) {
        results.passed++;
        console.log(`  ✓ ${label}`);
    } else {
        results.failed++;
        const msg = `  ✗ ${label}`;
        results.errors.push(msg);
        console.error(msg);
    }
}

function assertEqual(actual, expected, label) {
    if (actual === expected) {
        results.passed++;
        console.log(`  ✓ ${label}`);
    } else {
        results.failed++;
        const msg = `  ✗ ${label} — expected ${expected}, got ${actual}`;
        results.errors.push(msg);
        console.error(msg);
    }
}

// 1. Cash-per-round formula
console.log("\n── Cash-per-round formula ──");
function cashPerRound(round) { return 100 + round; }
assertEqual(cashPerRound(1), 101, "Round 1 → $101");
assertEqual(cashPerRound(5), 105, "Round 5 → $105");
assertEqual(cashPerRound(20), 120, "Round 20 → $120");
assertEqual(cashPerRound(50), 150, "Round 50 → $150");
assertEqual(cashPerRound(100), 200, "Round 100 → $200");

// 2. blocksDamageType immunity matrix
console.log("\n── blocksDamageType immunity matrix ──");
{
    const black = EnemyTypes[6];
    assert(black.blocksDamageType, "Black has blocksDamageType");
    assert(black.blocksDamageType({ isExplosion: true, canHitLead: false }) === true, "Black blocks explosion");
    assert(black.blocksDamageType({ isSharp: true, canHitLead: true }) === false, "Black does NOT block sharp");
}
{
    const white = EnemyTypes[7];
    assert(white.blocksDamageType({ isIce: true, canHitLead: false }) === true, "White blocks ice");
    assert(white.blocksDamageType({ isExplosion: true, canHitLead: true }) === false, "White does NOT block explosion");
}
{
    const lead = EnemyTypes[8];
    assert(lead.blocksDamageType({ isSharp: true, canHitLead: false }) === true, "Lead blocks sharp (no canHitLead)");
    assert(lead.blocksDamageType({ isSharp: true, canHitLead: true }) === false, "Lead allows sharp (with canHitLead)");
    assert(lead.blocksDamageType({ isExplosion: true, canHitLead: true }) === false, "Lead does NOT block explosion");
}
{
    const zebra = EnemyTypes[9];
    assert(zebra.blocksDamageType({ isExplosion: true }) === true, "Zebra blocks explosion");
    assert(zebra.blocksDamageType({ isIce: true }) === true, "Zebra blocks ice");
    assert(zebra.blocksDamageType({ isSharp: true }) === false, "Zebra does NOT block sharp");
}
{
    const purple = EnemyTypes[10];
    assert(purple.blocksDamageType({ isPlasma: true, canHitPurple: false }) === true, "Purple blocks plasma");
    assert(purple.blocksDamageType({ isPlasma: true, canHitPurple: true }) === false, "Purple allows plasma (canHitPurple)");
    assert(purple.blocksDamageType({ isEnergy: true, canHitPurple: false }) === true, "Purple blocks energy");
    assert(purple.blocksDamageType({ isFire: true, canHitPurple: false }) === true, "Purple blocks fire");
    assert(purple.blocksDamageType({ isMagic: true, canHitPurple: false }) === true, "Purple blocks magic");
    assert(purple.blocksDamageType({ isSharp: true, canHitPurple: false }) === false, "Purple does NOT block sharp");
}
{
    const red = EnemyTypes[1];
    assert(!red.blocksDamageType, "Red has no blocksDamageType");
}
{
    const rainbow = EnemyTypes[11];
    assert(!rainbow.blocksDamageType, "Rainbow has no blocksDamageType");
}
{
    const ddt = EnemyTypes[16];
    assert(ddt.blocksDamageType({ isExplosion: true }) === true, "DDT blocks explosion");
    assert(ddt.blocksDamageType({ isSharp: true }) === true, "DDT blocks sharp");
    assert(ddt.blocksDamageType({ isPlasma: true, canHitLead: true }) === false, "DDT does NOT block plasma");
}

// 3. deepFreeze / resolveDmgType
console.log("\n── deepFreeze / resolveDmgType ──");
{
    const obj = { a: { b: 2 }, c: 3 };
    deepFreeze(obj);
    assert(Object.isFrozen(obj), "deepFreeze freezes top level");
    assert(Object.isFrozen(obj.a), "deepFreeze freezes nested objects");
    let threw = false;
    try { obj.c = 99; } catch (e) { threw = true; }
    assert(threw, "deepFreeze prevents mutation (strict mode)");
}
{
    assertEqual(resolveDmgType('sharp'), DamageType.SHARP, "resolveDmgType('sharp')");
    assertEqual(resolveDmgType('explosion'), DamageType.EXPLOSION, "resolveDmgType('explosion')");
    assertEqual(resolveDmgType('ice'), DamageType.ICE, "resolveDmgType('ice')");
    assertEqual(resolveDmgType('plasma'), DamageType.PLASMA, "resolveDmgType('plasma')");
    assertEqual(resolveDmgType('energy'), DamageType.ENERGY, "resolveDmgType('energy')");
    assertEqual(resolveDmgType('fire'), DamageType.FIRE, "resolveDmgType('fire')");
    assertEqual(resolveDmgType('magic'), DamageType.MAGIC, "resolveDmgType('magic')");
    assertEqual(resolveDmgType('acid'), DamageType.ACID, "resolveDmgType('acid')");
    assertEqual(resolveDmgType('heavy'), DamageType.HEAVY, "resolveDmgType('heavy')");
    
    // PRO FIX: Test that glue resolves correctly (previous bug)
    assert(resolveDmgType('glue') !== DamageType.NONE, "resolveDmgType('glue') is not NONE");
    assertEqual(resolveDmgType('nonexistent'), DamageType.NONE, "resolveDmgType('nonexistent') → NONE");
    assertEqual(resolveDmgType(''), DamageType.NONE, "resolveDmgType('') → NONE");
}
{
    const dmg = createDmgType(DamageType.SHARP, { canHitLead: true, moabDmg: 2 });
    assert(dmg.isSharp === true, "createDmgType preserves base");
    assert(dmg.canHitLead === true, "createDmgType applies mods");
    assert(dmg.moabDmg === 2, "createDmgType applies moabDmg");
}
{
    const dmg = createDmgType(null, { canHitLead: true });
    assert(dmg.canHitLead === true, "createDmgType(null, mods) → mods only");
}

// 4. Difficulty hpMod plumbing
console.log("\n── Difficulty hpMod plumbing ──");
{
    for (const key of Object.keys(Difficulties)) {
        const diff = Difficulties[key];
        assertEqual(diff.hpMod, 1.0, `${key} hpMod = 1.0`);
    }
}

// 5. Restored SFX mapping regression
console.log("\n── Restored SFX mapping regression ──");
{
    assertEqual(getSfxAssetChoices('pop').length, 4, "Pop has four restored variants");
    assert(getSfxAssetChoices('moab_destroy').includes('moab_destroy1.mp3'), "MOAB destroy assets restored");
    assert(getSfxAssetChoices('moab_hit').includes('moab_hit2.mp3'), "MOAB hit assets restored");
    assert(getSfxAssetChoices('ceramic_hit').includes('ceramic_hit.mp3'), "Ceramic hit asset restored");
    assert(getSfxAssetChoices('frozen_hit').includes('frozen_hit.mp3'), "Frozen hit asset restored");
}

// PRO FIX: 6. CutsceneManager state machine
console.log("\n── CutsceneManager state machine ──");
{
    CutsceneManager.reset();
    assertEqual(CutsceneManager.state, 'idle', "CutsceneManager resets to idle");
    assert(CutsceneManager.knightEnemy === null, "knightEnemy is null after reset");

    const mockMoab = { tier: 13, data: { splitsInto: [{tier: 1, count: 1}] } };
    CutsceneManager.trigger(mockMoab);
    assertEqual(CutsceneManager.state, 'slashing', "Trigger sets state to slashing");
    assert(CutsceneManager.target === mockMoab, "Target is set correctly");
    assertEqual(mockMoab.data.splitsInto.length, 0, "Trigger clears splitsInto");

    CutsceneManager.reset();
    const mockBfb = { tier: 14, data: { splitsInto: [] } };
    CutsceneManager.trigger(mockBfb);
    assertEqual(CutsceneManager.state, 'idle', "Trigger ignores non-MOAB tier");
}

// Summary
console.log(`\n═══════════════════════════════════`);
console.log(`  ${results.passed} passed, ${results.failed} failed`);
console.log(`═══════════════════════════════════\n`);

window.__testResults = results;