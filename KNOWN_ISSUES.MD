Known Issues & Technical Debt
Resolved
Monkey Knowledge Perks: targeted_pineapples, bank_deposits, elite_mil_training, emergency_unlock, master_double, and paragon_of_power were missing their declarative effects. Added to monkeyKnowledgeEffects.js and verified via Vitest.
Dev Mode Crash Handling: loop() now rethrows errors in import.meta.env.DEV instead of silently swallowing them behind the game-over screen.
GameEngine Duplicate Keys: Removed duplicate enemies: [] and towers: [] declarations in engine.js.
Active / Technical Debt
Mobile Sprite Scaling: The 1.2x mobile scale is applied manually to towerRenderer.js, enemyRenderer.js, projectile.js, and towers/dart.js. Needs to be centralized in a Renderer base class or mScale context wrapper to prevent new towers from forgetting it.
GameEngine Singleton: GameEngine is a 100+ property flat object mixed in from three modules. Needs to be consolidated into clearly-scoped sub-objects (state.entities, state.economy, state.session).
Testing Coverage: Current tests only cover Monkey Knowledge structural integrity. Needs unit tests for damage calculations (crit, pierce, MK multipliers) and economy (sell rate, upgrade cost scaling).