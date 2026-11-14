# Saves and Configuration

## Player configuration

js/config.js owns persistent player configuration. The storage key is td_config. Defaults are in DEFAULT_DATA and older configurations are upgraded through the migrations object. The reviewed branch uses schema version 17.

When adding persistent data, update the default shape and add a migration if existing players need a value or transformation. Do not assume old local saves contain new fields.

## Saved runs

The current run snapshot is stored in Config.data.savedRun. js/gameSession.js serializes map/difficulty, lives/cash, wave and tower state.

js/savedRunValidation.js validates the snapshot before the active engine is mutated. Keep validation in sync with new persistent fields or entity types. Invalid saves are rejected without replacing the saved data.

## Custom maps

The Map Editor serializes map data into Config.data.customMaps. During config loading those maps are added to the runtime map collection. Saved map indices therefore depend on built-in/custom map ordering staying consistent.

## Cutscene documents

The Cutscene Editor has separate local-storage keys for its document and stage preferences. The editor/runtime document math is shared in js/cutsceneRuntime.js. A saved scene overrides the in-game boss intro only when useForBossIntro is enabled.

## Safe changes

- Bump the config schema version only when a migration is required.
- Keep migrations deterministic and safe for partially populated old data.
- Add tests for old and current save formats.
- Validate persisted values before applying them to live objects.
- Never commit real user save data or browser local-storage dumps.
