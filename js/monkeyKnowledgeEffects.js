// monkeyKnowledgeEffects.js
// Declarative Monkey Knowledge effects. 

export const MKEffects = {
    // Applied once during Tower initialization
    base: [
        { id: 'extra_darts', type: ['dart'], stat: 'pierce', amount: 1 },
        { id: 'hard_tacks', type: ['tack'], stat: 'canHitFrozen', amount: true },
        { id: 'cheap_rangs', type: ['boomerang'], stat: 'cost', amount: -50 },
        { id: 'inc_lifespan', type: ['dart', 'bomb', 'tack', 'glue'], stat: 'lifespan', amount: 0.2 },
        { id: 'advanced_logistics', type: ['sniper', 'sub', 'buccaneer', 'ace', 'heli', 'mortar', 'dartling'], stat: 'cost', amount: 0.95, mode: 'mult' },
        { id: 'naval_upgrades', type: ['buccaneer', 'sub'], stat: 'pierce', amount: 1 },
        { id: 'airforce_upgrades', type: ['ace', 'heli'], stat: 'pierce', amount: 1 },
        { id: 'lingering_magic', type: ['wizard', 'super', 'ninja', 'druid'], stat: 'lifespan', amount: 1.2, mode: 'mult' },
        { id: 'hot_magic', type: ['wizard', 'super', 'ninja', 'druid', 'alchemist'], stat: 'canHitFrozen', amount: true },
        { id: 'flat_pack', type: ['farm', 'village'], stat: 'cost', amount: 0.98, mode: 'mult' },
        { id: 'one_more_spike', type: ['spike'], stat: 'pierce', amount: 1 },
        { id: 'hero_favors', hero: true, stat: 'cost', amount: 0.9, mode: 'mult' },
        { id: 'heroic_reach', hero: true, stat: 'range', amount: 3 },
        { id: 'heroic_velocity', hero: true, stat: 'projectileSpeed', amount: 1.1, mode: 'mult' }
    ],

    // Applied during stat recalculation
    cooldown: [
        { id: 'fast_tack', type: ['tack'], stat: '_cooldownMult', amount: 0.92, mode: 'mult' },
        { id: 'fast_glue', type: ['glue'], stat: '_cooldownMult', amount: 0.90, mode: 'mult' },
        { id: 'come_on_everybody', type: ['dart', 'boomerang', 'bomb', 'tack', 'ice', 'glue'], stat: '_cooldownMult', amount: 0.95, mode: 'mult', condition: (t, eng) => eng.towers.every(tw => !tw || (['dart', 'boomerang', 'bomb', 'tack', 'ice', 'glue'].includes(tw.type) && tw.upgrades[0] < 3 && tw.upgrades[1] < 3 && tw.upgrades[2] < 3)) },
        { id: 'gun_coolant', type: ['ace'], stat: '_cooldownMult', amount: 0.90, mode: 'mult' },
        { id: 'rapid_razors', type: ['heli'], condition: t => t.upgrades[1] >= 2, stat: '_cooldownMult', amount: 0.80, mode: 'mult' },
        { id: 'flanking_maneuvers', type: ['sniper', 'sub', 'buccaneer'], condition: t => t.targetingMode === 'Last', stat: '_cooldownMult', amount: 0.90, mode: 'mult' },
        { id: 'speedy_brewing', type: ['alchemist'], stat: '_cooldownMult', amount: 0.95, mode: 'mult' },
        { id: 'veteran_training', stat: '_cooldownMult', amount: 0.97, mode: 'mult' },
        { id: 'quick_hands', hero: true, stat: '_cooldownMult', amount: 0.96, mode: 'mult' }
    ],

    // Applied during stat recalculation
    tier: [
        { id: 'poppy_blades', type: ['tack'], condition: t => t.upgrades[1] >= 3, stat: 'pierce', amount: 2 },
        { id: 'icy_chill', type: ['ice'], stat: 'range', amount: 3 },
        { id: 'more_splatty', type: ['glue'], condition: t => t.upgrades[1] >= 2, stat: 'pierce', amount: 2 },
        { id: 'extra_bounce', type: ['boomerang'], condition: t => t.upgrades[1] >= 2, stat: 'pierce', amount: 30 },
        { id: 'four_and_four', type: ['dart'], condition: t => t.upgrades[1] >= 2, stat: 'fourAndFour', amount: true },
        { id: 'force_vs_force', type: ['dart'], condition: t => t.upgrades[0] >= 3, stat: 'moabDmg', amount: 2 },
        { id: 'big_inferno', type: ['tack'], condition: t => t.upgrades[0] >= 5, stat: 'explosionRadius', amount: 3 },
        { id: 'so_cold', type: ['ice'], condition: t => t.upgrades[0] >= 1, stat: 'permafrostSlow', amount: 0.4 },
        { id: 'aviation_glue', type: ['glue'], condition: t => t.upgrades[2] >= 4, stat: 'slow', amount: 0.55 },
        { id: 'mega_mauler', type: ['bomb'], condition: t => t.upgrades[1] >= 3, stat: 'moabDmg', amount: 2 },
        { id: 'hard_press', type: ['boomerang'], condition: t => t.upgrades[2] >= 3, stat: 'hardPressMult', amount: 1.3 },
        { id: 'big_cryo', type: ['ice'], condition: t => t.upgrades[2] >= 3, stat: 'explosionRadius', amount: 1.12, mode: 'mult' },
        { id: 'hypothermia', type: ['ice'], condition: t => t.upgrades[1] >= 4, stat: 'freezeDuration', amount: 1.0 },
        { id: 'violent_impact', type: ['bomb'], condition: t => t.upgrades[0] >= 2, stat: 'stunDurationMult', amount: 1.25 },
        { id: 'long_turbo', type: ['boomerang'], condition: t => t.upgrades[1] >= 4, stat: 'turboDuration', amount: 15 },
        { id: 'bionic_aug', type: ['boomerang'], condition: t => t.upgrades[1] >= 4, stat: 'turboSeesCamo', amount: true },
        { id: 'fraggy_frags', type: ['bomb'], condition: t => t.upgrades[0] >= 2, stat: 'fragCount', amount: 2 },
        { id: 'crossbow_reach', type: ['dart'], condition: t => t.upgrades[0] >= 3, stat: 'range', amount: 3 },
        { id: 'recurring_rangs', type: ['boomerang'], stat: 'recurringRangs', amount: true },
        { id: 'big_bunch', type: ['buccaneer'], condition: t => t.upgrades[0] >= 2, stat: 'grapeCount', amount: 1 },
        { id: 'accel_aerodarts', type: ['ace'], stat: 'projectileSpeed', amount: 1.5, mode: 'mult' },
        { id: 'ceramic_shock', type: ['sniper'], stat: 'ceramicShock', amount: true },
        { id: 'breaking_ballistic', type: ['sub'], condition: t => t.upgrades[1] >= 3, stat: 'ceramicDmg', amount: 1 },
        { id: 'faster_takedowns', type: ['buccaneer'], condition: t => t.upgrades[2] >= 4, stat: 'abilityCd', amount: -5 },
        { id: 'extra_burny_stuff', type: ['mortar'], condition: t => t.upgrades[2] >= 1, stat: 'dotTick', amount: 1.0 },
        { id: 'gorgon_storm', type: ['dartling'], condition: t => t.upgrades[2] >= 4, stat: 'gorgonStorm', amount: true },
        { id: 'quad_burst', type: ['sub'], condition: t => t.upgrades[1] >= 2, stat: 'splitCount', amount: 4 },
        { id: 'trade_agreements', type: ['buccaneer'], condition: t => t.upgrades[2] >= 3, stat: 'income', amount: 20 },
        { id: 'paint_stripper', type: ['mortar'], condition: t => t.upgrades[0] >= 4, stat: 'canStripDDTFortified', amount: true },
        { id: 'cross_the_streams', type: ['dartling'], condition: t => t.upgrades[0] >= 5, stat: 'crossStreams', amount: true },
        { id: 'wingmonkey', type: ['ace'], stat: 'canWingmonkey', amount: true },
        { id: 'charged_chinooks', type: ['heli'], condition: t => t.upgrades[2] >= 4, stat: 'chinookCashMult', amount: 1.25 },
        { id: 'master_defender', type: ['sniper'], condition: t => t.upgrades[2] >= 5, stat: 'masterDefender', amount: true },
        { id: 'sub_admiral', type: ['sub'], condition: t => t.upgrades[1] >= 5, stat: 'subAdmiral', amount: true },
        { id: 'door_gunner', type: ['heli'], condition: t => t.upgrades[2] >= 5, stat: 'canDoorGunner', amount: true },
        { id: 'super_range', type: ['super'], condition: t => t.upgrades[0] >= 1, stat: 'range', amount: 3 },
        { id: 'heavy_knockback', type: ['super'], condition: t => t.upgrades[2] >= 2, stat: 'knockbackMult', amount: 1.05 },
        { id: 'diversion_tactics', type: ['ninja'], condition: t => t.upgrades[1] >= 1, stat: 'distractionChance', amount: 0.025 },
        { id: 'strike_down_false', type: ['super'], condition: t => t.upgrades[0] >= 3 && t.upgrades[0] < 5, stat: 'canHitPurple', amount: true },
        { id: 'flame_jet', type: ['wizard'], condition: t => t.upgrades[1] >= 3, stat: 'projectileSpeed', amount: 1.5, mode: 'mult' },
        { id: 'strong_tonic', type: ['alchemist'], condition: t => t.upgrades[1] >= 4, stat: 'tonicDuration', amount: 24 },
        { id: 'cold_front', type: ['druid'], condition: t => t.upgrades[1] >= 4, stat: 'lightningFreezes', amount: true },
        { id: 'arcane_impale', type: ['wizard'], condition: t => t.upgrades[0] >= 4, action: t => { t.stats.moabDmg = (t.stats.moabDmg || 0) + 1; t.stats.ceramicDmg = (t.stats.ceramicDmg || 0) + 1; } },
        { id: 'acid_stability', type: ['alchemist'], stat: 'acidPoolLife', amount: 12 },
        { id: 'xray_ultra', type: ['super'], condition: t => t.upgrades[1] >= 2, stat: 'canSeeThroughBlockers', amount: true },
        { id: 'deadly_tranquility', type: ['ninja'], condition: t => t.upgrades[0] >= 4, stat: 'projectileCount', amount: 1 },
        { id: 'there_can_be_only_one', type: ['super'], condition: t => t.upgrades[0] >= 5, stat: 'canBeVengeful', amount: true },
        { id: 'vine_rupture', type: ['druid'], condition: t => t.upgrades[2] >= 5, stat: 'hasVineRupture', amount: true },
        { id: 'tiny_tornadoes', type: ['druid'], condition: t => t.upgrades[1] >= 3, stat: 'splitTornadoes', amount: true },
        { id: 'insider_trades', type: ['village'], condition: t => t.upgrades[2] >= 2, stat: 'discount', amount: 0.02 },
        { id: 'more_valuable_bananas', type: ['farm'], condition: t => t.upgrades[1] >= 1, stat: 'bananaValueMult', amount: 0.05 },
        { id: 'vigilant_sentries', type: ['engineer'], condition: t => t.upgrades[0] >= 1, stat: 'sentryLife', amount: 5 },
        { id: 'thicker_foams', type: ['engineer'], condition: t => t.upgrades[1] >= 2, stat: 'foamPierce', amount: 3 },
        { id: 'very_shreddy', type: ['spike'], condition: t => t.upgrades[1] >= 2, stat: 'moabDmg', amount: 1 },
        { id: 'bigger_banks', type: ['farm'], condition: t => t.upgrades[1] >= 3, stat: 'bankCap', amount: 2500 },
        { id: 'big_traps', type: ['engineer'], condition: t => t.upgrades[2] >= 4, stat: 'trapRbe', amount: 30 },
        { id: 'healthy_bananas', type: ['farm'], condition: t => t.upgrades[2] >= 3, action: t => { t.stats.healthyBananas = t.upgrades[2] >= 4 ? 3 : 1; } },
        { id: 'to_arms', type: ['village'], condition: t => t.upgrades[1] >= 4, stat: 'abilityDuration', amount: 3 },
        { id: 'more_splody', hero: true, stat: 'explosionPierce', amount: 2 },
        { id: 'big_bloon_blueprints', hero: true, stat: 'moabDmg', amount: 1 },
        { id: 'weak_point', hero: true, action: t => { t.stats.ceramicDmg = (t.stats.ceramicDmg || 0) + 1; t.stats.fortifiedDmg = (t.stats.fortifiedDmg || 0) + 1; } }
    ],

    // Applied inside TowerEconomy.upgrade()
    upgradeCost: [
        { id: 'budget_clusters', type: ['bomb'], condition: t => t.upgrades[0] === 2, mode: 'sub', amount: 100 },
        { id: 'cheaper_solution', type: ['glue'], condition: t => t.upgrades[1] === 4, mode: 'sub', amount: 1000 },
        { id: 'cheaper_maiming', type: ['sniper'], condition: t => t.upgrades[0] === 3, mode: 'sub', amount: 1000 },
        { id: 'aeronautic_subsidy', type: ['ace'], condition: t => t.upgrades[0] === 4, mode: 'mult', amount: 0.9 },
        { id: 'budget_battery', type: ['mortar'], condition: t => t.upgrades[1] === 4, mode: 'sub', amount: 600 },
        { id: 'magic_tricks', type: ['wizard'], condition: t => t.upgrades[0] === 0 || t.upgrades[0] === 1, mode: 'sub', amount: 25 },
        { id: 'cheaper_doubles', type: ['ninja'], condition: t => t.upgrades[1] === 1, mode: 'sub', amount: 100 },
        { id: 'warm_oak', type: ['druid'], condition: t => t.upgrades[0] === 1, mode: 'sub', amount: 100 },
        { id: 'hi_value_mines', type: ['spike'], condition: t => t.upgrades[0] === 3, mode: 'sub', amount: 1500 }
    ],

    // Applied inside TowerEconomy.sell()
    // FIX: flat_pack uses an action to dynamically check for better_sell_deals
    sellRate: [
        { id: 'better_sell_deals', stat: 'resaleRate', amount: 0.75 },
        { id: 'flat_pack', type: ['farm', 'village'], action: (t, eng) => {
            const mk = eng.config.data.mkActive === false ? {} : (eng.config.data.monkeyKnowledge || {});
            return mk['better_sell_deals'] ? 0.77 : 0.72;
        }},
        { id: 'farm_resale', type: ['farm'], condition: t => t.upgrades[2] >= 2, stat: 'resaleRate', amount: 0.80 }
    ],

    // --- HERO SPECIFIC EFFECTS ---

    heroInit: [
        { id: 'empowered_heroes', hero: true, action: (hero) => {
            while (hero.level < 3) {
                hero._levelUp();
            }
        }}
    ],

    // FIX: Use stat/amount for static multipliers to be fully generic
    heroXpGain: [
        { id: 'self_taught', hero: true, stat: 'mult', amount: 1.10 },
        { id: 'monkeys_together', hero: true, action: (hero, engine) => {
            let heroCount = 0;
            for (let t of engine.towers) {
                if (t && t.stats.isHero) heroCount++;
            }
            if (heroCount > 1) {
                return 1 + (heroCount - 1) * 0.05;
            } else {
                return 1.05;
            }
        }}
    ],

    heroBuyLevel: [
        { id: 'scholarships', hero: true, stat: 'mult', amount: 0.9 }
    ],

    // --- VILLAGE SUPPORT EFFECTS ---

    villageBuff: [
        { id: 'inland_revenue', condition: t => t.upgrades[2] >= 3, stat: 'cashMult', amount: 0.1 }
    ],

    // --- ENEMY SPECIFIC EFFECTS ---

    enemyInit: [
        { id: 'big_bloon_sabotage', condition: e => e.data.isMoab, stat: '_maxHp', amount: 0.90, mode: 'mult' }
    ],

    // --- ENGINE SPECIFIC EFFECTS ---

    gameInit: [
        { id: 'more_cash', action: (eng) => eng.cash += 200 },
        { id: 'bonus_glue', action: (eng, diff, classes) => { const t = new classes.Tower(350, 350, 'glue'); eng.towers.push(t); } },
        { id: 'mana_shield', condition: (eng, diff) => diff.name !== 'Impoppable', action: (eng, diff) => { eng.maxManaShield = 25; eng.manaShield = 25; } },
        { id: 'monkey_education', action: (eng) => eng.globalXpMult = 1.08 }
    ],

    // FIX: Added unlock_free_dart as an alwaysActive entry to sync with UI checks
    towerPlacement: [
        { id: 'bonus_monkey', type: ['dart'], condition: (eng, type) => !eng.isSandbox && eng.difficulty && !eng.difficulty.noSelling && !eng.towers.some(t => t.type === 'dart'), action: (cost) => 0 },
        { id: 'unlock_free_dart', type: ['dart'], alwaysActive: true, condition: (eng, type) => !eng.isSandbox && eng.difficulty && !eng.difficulty.noSelling && eng.config.data.unlocks.freeFirstDartMonkey && !eng.towers.some(t => t.type === 'dart'), action: (cost) => 0 },
        { id: 'military_conscription', type: ['sniper', 'sub', 'buccaneer', 'ace', 'heli', 'mortar', 'dartling'], condition: (eng, type) => !eng.isSandbox && !eng.towers.some(t => ['sniper', 'sub', 'buccaneer', 'ace', 'heli', 'mortar', 'dartling'].includes(t.type)), action: (cost) => Math.floor(cost * 0.66) },
        { id: 'first_line_of_defense', type: ['spike'], condition: (eng, type) => !eng.isSandbox && !eng.towers.some(t => t.type === 'spike'), action: (cost) => Math.max(0, cost - 150) },
        { id: 'farm_subsidy', type: ['farm'], condition: (eng, type) => !eng.isSandbox && !eng.towers.some(t => t.type === 'farm'), action: (cost) => Math.max(0, cost - 100) }
    ],

    abilityCooldown: [
        { id: 'global_cooldowns', stat: 'cdMult', amount: 0.97 },
        { id: 'ability_discipline', hero: true, condition: (t, slot) => slot === 2, stat: 'cdMult', amount: 0.90 },
        { id: 'ability_mastery', hero: true, condition: (t, slot) => slot === 1 && t.level >= 20, stat: 'cdMult', amount: 0.70 }
    ],

    // FIX: Use stat/amount for economy effects to be fully generic
    economy: [
        { id: 'backroom_deals', stat: 'imfTaxRate', amount: 0.40 },
        { id: 'mo_monkey_money', stat: 'mmRewardMult', amount: 1.10 }
    ]
};