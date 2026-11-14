Known Issues & Technical Debt
Resolved
Monkey Knowledge Perks: targeted_pineapples, bank_deposits, elite_mil_training, emergency_unlock, master_double, and paragon_of_power were missing their declarative effects. Added to monkeyKnowledgeEffects.js and verified via Vitest.
Dev Mode Crash Handling: loop() now rethrows errors in import.meta.env.DEV instead of silently swallowing them behind the game-over screen.
GameEngine Duplicate Keys: Removed duplicate enemies: [] and towers: [] declarations in engine.js.
Active / Technical Debt
Mobile Sprite Scaling: The 1.2x mobile scale is applied manually to towerRenderer.js, enemyRenderer.js, projectile.js, and towers/dart.js. Needs to be centralized in a Renderer base class or mScale context wrapper to prevent new towers from forgetting it.
GameEngine Singleton: GameEngine is a 100+ property flat object mixed in from three modules. Needs to be consolidated into clearly-scoped sub-objects (state.entities, state.economy, state.session).
Testing Coverage: The repository now has dedicated Vitest suites for damage, economy, upgrades, heroes, bosses, and regression fixes. Remaining gap: browser-level visual and high-load stress coverage, especially fast-fire Snipers at 1x/10x/20x.

Sniper high-fire-rate performance (reported 2026-11-14): compatible global-range towers now share one target scan per simulation substep; fast global Snipers also reuse a still-valid target for up to 50ms of simulation time, and zero-bounce shots no longer allocate bounce-tracking Sets. The user-reported slowdown is NOT marked resolved yet: browser profiling is still required at 1x, 10x, and 20x, including fast-fire Snipers with Shrapnel Shot.