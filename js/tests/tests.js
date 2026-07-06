// js/tests/tests.js
// Browser-based test runner for bloons-5.5.
// Open tests.html to run. Results are printed to console and displayed on page.

import { deepFreeze } from '../utils.js';
import { DamageType, createDmgType, resolveDmgType } from '../damageTypes.js';
import { EnemyTypes } from '../data.js';
import { Difficulties } from '../config.js';

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

// ─── 1. Cash-per-round formula ───────────────────────────────────────────────
console.log("\n── Cash-per-round formula ──");

function cashPerRound(round) {
    // Mirrors waveManager.js:_completeWave
    return 100 + round;
}

assertEqual(cashPerRound(1), 101, "Round 1 → $101");
assertEqual(cashPerRound(5), 105, "Round 5 → $105");
assertEqual(cashPerRound(20), 120, "Round 20 → $120");
assertEqual(cashPerRound(50), 150, "Round 50 → $150");
assertEqual(cashPerRound(100), 200, "Round 100 → $200");

// ─── 2. blocksDamageType immunity matrix ────────────────────────────────────
console.log("\n── blocksDamageType immunity matrix ──");

// Black bloon (tier 6): blocks explosion
{
    const black = EnemyTypes[6];
    assert(black.blocksDamageType, "Black has blocksDamageType");
    assert(black.blocksDamageType({ isExplosion: true, canHitLead: false }) === true, "Black blocks explosion");
    assert(black.blocksDamageType({ isSharp: true, canHitLead: true }) === false, "Black does NOT block sharp");
}

// White bloon (tier 7): blocks ice
{
    const white = EnemyTypes[7];
    assert(white.blocksDamageType({ isIce: true, canHitLead: false }) === true, "White blocks ice");
    assert(white.blocksDamageType({ isExplosion: true, canHitLead: true }) === false, "White does NOT block explosion");
}

// Lead bloon (tier 8): blocks sharp unless canHitLead
{
    const lead = EnemyTypes[8];
    assert(lead.blocksDamageType({ isSharp: true, canHitLead: false }) === true, "Lead blocks sharp (no canHitLead)");
    assert(lead.blocksDamageType({ isSharp: true, canHitLead: true }) === false, "Lead allows sharp (with canHitLead)");
    assert(lead.blocksDamageType({ isExplosion: true, canHitLead: true }) === false, "Lead does NOT block explosion");
}

// Zebra bloon (tier 9): blocks explosion AND ice
{
    const zebra = EnemyTypes[9];
    assert(zebra.blocksDamageType({ isExplosion: true }) === true, "Zebra blocks explosion");
    assert(zebra.blocksDamageType({ isIce: true }) === true, "Zebra blocks ice");
    assert(zebra.blocksDamageType({ isSharp: true }) === false, "Zebra does NOT block sharp");
}

// Purple bloon (tier 10): blocks plasma/energy/fire/magic unless canHitPurple
{
    const purple = EnemyTypes[10];
    assert(purple.blocksDamageType({ isPlasma: true, canHitPurple: false }) === true, "Purple blocks plasma");
    assert(purple.blocksDamageType({ isPlasma: true, canHitPurple: true }) === false, "Purple allows plasma (canHitPurple)");
    assert(purple.blocksDamageType({ isEnergy: true, canHitPurple: false }) === true, "Purple blocks energy");
    assert(purple.blocksDamageType({ isFire: true, canHitPurple: false }) === true, "Purple blocks fire");
    assert(purple.blocksDamageType({ isMagic: true, canHitPurple: false }) === true, "Purple blocks magic");
    assert(purple.blocksDamageType({ isSharp: true, canHitPurple: false }) === false, "Purple does NOT block sharp");
}

// Red bloon (tier 1): no blocksDamageType
{
    const red = EnemyTypes[1];
    assert(!red.blocksDamageType, "Red has no blocksDamageType");
}

// Rainbow bloon (tier 11): no blocksDamageType
{
    const rainbow = EnemyTypes[11];
    assert(!rainbow.blocksDamageType, "Rainbow has no blocksDamageType");
}

// DDT (tier 16): blocks explosion AND sharp
{
    const ddt = EnemyTypes[16];
    assert(ddt.blocksDamageType({ isExplosion: true }) === true, "DDT blocks explosion");
    assert(ddt.blocksDamageType({ isSharp: true }) === true, "DDT blocks sharp");
    assert(ddt.blocksDamageType({ isPlasma: true, canHitLead: true }) === false, "DDT does NOT block plasma");
}

// ─── 3. deepFreeze / resolveDmgType ──────────────────────────────────────────
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
    assertEqual(resolveDmgType('glue'), DamageType.NONE, "resolveDmgType('glue') → NONE");
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

// ─── 4. Difficulty hpMod plumbing ─────────────────────────────────────────────
console.log("\n── Difficulty hpMod plumbing ──");

{
    for (const key of Object.keys(Difficulties)) {
        const diff = Difficulties[key];
        assertEqual(diff.hpMod, 1.0, `${key} hpMod = 1.0`);
    }
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n═══════════════════════════════════`);
console.log(`  ${results.passed} passed, ${results.failed} failed`);
console.log(`═══════════════════════════════════\n`);

// Export results for the HTML page to display
window.__testResults = results;
