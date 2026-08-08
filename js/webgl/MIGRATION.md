# WebGL (PixiJS) Migration — Handoff Doc

**Read this whole doc before touching code.** It's written to let a fresh
session pick this up cold, with zero prior context.

## What this is

Goal: fully replace the Canvas2D renderer (`js/renderer.js`,
`js/towerRenderer.js`, `js/enemyRenderer.js`, `js/projectileDrawers.js`,
hero specials in `js/heroes/*.js`) with a PixiJS-based WebGL renderer, then
delete the Canvas2D code.

Approach: **side-by-side during development, full replacement at the end.**
Game logic (`engine.js`, `simulationLoop.js`, `towerBehavior.js`,
`enemyDamage.js`, etc.) is **completely untouched** — this is a
rendering-layer swap only. State stays the single source of truth; the new
renderer just reads from it, same as the old one does.

**Nothing here is live for normal players.** The new renderer is only
reachable via a `?webgl=1` URL debug flag, wired in `js/engine.js`. Normal
gameplay is 100% unaffected — the Canvas2D path is untouched and still what
everyone actually plays on.

## How to try it

```
npm install
npm run dev
```
Open the dev URL, add `?webgl=1` to it, start a game. Check the browser
console for `[webgl debug]` log lines (confirms Pixi loaded) and any errors.

## Current state, honestly

**Structurally covered** (traced against the real source code, builds clean
with `vite build`, but only spot-checked in an actual browser — see
"What's actually been visually verified" below):
- Map background (real per-map scale/offset math, not a naive stretch)
- All 29 tower types: base sprite, upgrade-path overlay compositing, attack
  animations/arm sprites, per-tower `SpriteConfig` offset/scale fine-tuning,
  buff-state additive effects (fire wells, arctic wind, riptides, monster
  form, fan club aura, ace's landing pad + flying-body position override)
- `dart` and `mermonkey` have dedicated ports (they don't use the generic
  tower render path at all in the original — see "Key discoveries" below)
- Enemies: base sprite + camo/regen modifiers, damage-crack overlay,
  MOAB/BFB/ZOMG blade animation, squeeze/crush transform, frozen overlay,
  slow ring, brittle ring, infinity tint (approximated, see below), stun
  overlay — full verified z-order (see `canvasGraphicsAdapter.js` and the
  round-by-round log at the bottom of this doc for exact order)
- Projectiles: sprite is primary path; vector-shape fallback reuses
  `projectileDrawers.js` **unmodified** via `CanvasGraphicsAdapter`
- Heroes: 10 of 13 fully covered (`Hero extends Tower`, so 6 heroes needed
  zero extra code once towers worked; 3 more got a small extra effect
  ported: `gwendolin`, `obyn`, `quincy`)
- Real gradient support in `CanvasGraphicsAdapter` (`createRadialGradient`),
  used by `wizard`'s fire wells
- Tower placement preview: range ring + valid/invalid/afford-tinted ghost
  sprite, matching `renderer.js`'s `_drawPlacementPreview` (see Round below).
- Selected-tower outline + range ring (`_drawSelection`) — distinct from
  the placement-preview ghost above; this is the orange ring shown around
  an already-placed tower the player has clicked on.
- Beasts, sentries, particles (pop effects), explosions, acid pools, and
  floating damage/cash text — entity types `_drawEntities`/`render()`
  draws that weren't covered by the original "Structurally covered" list
  at all. Beasts and sentries are simple enough in the original (plain
  circles/rects/text, no sprite assets) that they're drawn natively with
  `PIXI.Graphics`/`PIXI.Text` rather than through `CanvasGraphicsAdapter`.
  Particles reuse the same sprite-pooling pattern as projectiles; acid
  pools and floating texts use the same per-object-identity pooling
  pattern as beasts/sentries. Explosions have no stable per-object identity
  to pool against (plain objects, swap-popped on expiry), so they're
  redrawn each frame into one shared `Graphics` instead — see the Round
  entries below for details and the one known cosmetic gap (beast-to-owner
  dashed line renders solid; Pixi has no dashed-stroke API).
- Leak-flash screen-border effect (`_drawLeakFlash`).
- Tower + sentry shadows (`utils.js`'s `drawShadow`) — every placed tower
  now gets the same flat squashed-ellipse shadow as the original, ported
  natively via `Graphics.ellipse()` (sentries already had theirs from an
  earlier round; this round added the tower side and unified both onto
  shared `SHADOW_*` constants).
- Sniper-family hitscan beam lines (`towerRenderer.js`'s `_drawHitscans`)
  and farm/village/sniper-crate banana pickups (`_drawBananas`) — both
  live per-tower in the original (`tower.hitscans`/`tower.bananas`) but
  are combined across all towers here; hitscans into one shared `Graphics`
  (like explosions — no stable per-line identity, ~100ms lifetime),
  bananas pooled by object identity (like particles — persist several
  seconds). Found this round while reading `towerRenderer.js`'s `draw()`
  top-to-bottom rather than assuming the generic sprite path covered
  everything a tower draws.
- Boss health bar UI (`BossHealthBarHandler.draw`) — the stacked name/HP
  bars shown during MOAB-class boss fights. Pure screen-space UI, ported
  straight onto the 'overlay' layer with no coordinate-system wrinkles.
- Per-tower night-mode glow (`towerRenderer.js`, `engine.nightAlpha > 0`)
  — turned out to already be unblocked by the earlier gradient-fill work
  for wizard's fire wells; just hadn't been done yet.
- Custom gameplay cursor + the OS-cursor-hide it depends on
  (`engine.canvas.style.cursor = 'none'` during play). The hide is plain
  DOM/CSS and identical regardless of renderer, but was never wired up in
  `pixiRenderer.js` since this file never touched `engine.canvas` directly
  before. Includes the boss-screen-split cursor-position nudge, applied
  even though the screen-split visual itself isn't ported (see below) —
  the underlying `boss.currentOffset` simulation value is set regardless
  of which renderer is active, so applying it here keeps the cursor
  consistent with what the split *would* show once that's ported too.

**Input & interaction — coordinate math fixed, rest still unverified:**
Click-to-select, drag-and-drop placement, and touch all convert a raw
screen point to world coordinates via `canvas.width / rect.width` in
several files (`engineInput.js`, `input.js`, `dragManager.js`, `mobile.js`).
This round found and fixed a real bug at the root: `pixiApp.js` was
initializing Pixi with `resolution: devicePixelRatio`, which (via
`autoDensity`) makes `canvas.width` the physical pixel-backing-store size
(e.g. 2560 on a 2x display) while every one of those call sites assumes
`canvas.width` equals the logical 1280x720 game space — which is what it
always was under Canvas2D, since that path never did DPR scaling. Net
effect before this fix: every click/drag/touch position would have been
scaled wrong by the device's pixel ratio on any HiDPI screen (most phones,
retina Macs), silently breaking placement/selection there while appearing
to work fine on a 1x display. Fixed by pinning `resolution: 1` — see the
comment in `pixiApp.js` for the full reasoning and what to update if HiDPI
rendering is wanted later. This fixes the coordinate math itself, but the
actual drag-and-drop flow in `dragManager.js` is still unverified — the
selection ring itself is ported now (`_drawSelection`, see below), but
whether clicking a placed tower actually sets `engine.selectedPlacedTower`
and drags correctly hasn't been exercised in a browser — "probably works
now" is not the same as tested.

**Known real gaps, not started:**
- `geto`, `gojo`, `sauda` — the 3 heroes with fully custom, complex
  `draw()` overrides (523/399/459 lines respectively). Deliberately not
  rushed — see reasoning in Round 4 below.
- Farm/village *static* draw path — currently falls through to the generic
  tower path, which may already be close (farm calls `drawBaseTower` +
  static banana overlay) but hasn't been specifically verified. Note the
  *dynamic* banana-drop pickups (the ones that arc out and sit on the
  ground for several seconds) are a separate thing and are now ported —
  see `_drawBananas` below.
- Menu background animation (`renderer.js _drawMenuBackground`) — low
  priority, cosmetic only
- Map editor (`mapEditor.js`) — separate canvas element, intentionally out
  of scope, can stay Canvas2D forever if desired
- **A wider set of `renderer.js`/`towerRenderer.js` subsystems than this doc
  previously let on are not ported at all yet** (found across three rounds
  by diffing every top-level `_draw*` method — and, this round, every
  *per-tower* draw call inside `towerRenderer.js`'s own `draw()` — against
  what `pixiRenderer.js` actually implements; see the Round entries below
  for the full audits). What's still missing, now that floating text/
  leak-flash/acid pools/selection/shadows/hitscans/bananas are ported (see
  below):
  - Dev overlay, main-menu scenery, hitbox debug overlay
    (`_drawDevOverlay`/`_drawMainMenuScenery`/`_drawHitboxes`).
    `_drawCursor` is now ported (see below), so removed from this list.
  - Outer-composite effects layered after `_worldCanvas` is drawn in the
    original: **the boss screen-split visual** (slicing the world canvas
    into offset top/bottom halves), and `CutsceneManager` draw (the
    cutscene "balls"/camera-pan system). Live outside `render()`'s main
    entity pass and easy to miss when scanning method names.
    `BossHealthBarHandler` draw and the **boss warning-line telegraph**
    (the simpler, non-splitting half of that same original `if/else if`
    branch) are now ported — see below. Screen-split itself is a real
    architectural change (needs rendering the world layers to a
    RenderTexture and drawing two offset slices of it), not just a new
    element, so it's left for a dedicated round.
  - **Per-tower night-mode glow is now ported** (`towerRenderer.js`'s
    `draw()`, the `engine.nightAlpha > 0` branch) — a radial gradient halo
    around every placed tower while night mode is active, using the same
    `FillGradient` technique proven out for wizard's fire wells, applied
    natively here (`textureSpace: 'local'`, since this lives inside each
    tower's own container rather than a shared world-space layer like the
    adapter's version does).
  
  None of this was silently broken by anything this round — it was simply
  never started, and the "Structurally covered" list above was accurate for
  what it claimed but didn't make the *absence* of these subsystems
  explicit. Flagging clearly now per this doc's own "don't overstate status"
  principle.

**Known approximations (flagged in code, not silently passed off as exact):**
- Infinity tint: real original uses `globalCompositeOperation: 'source-atop'`
  which has no `Graphics`-fill equivalent; approximated as a semi-transparent
  tinted duplicate sprite. Close, not pixel-identical.
- Gradient fill coordinate mapping (`textureSpace: 'global'` in
  `canvasGraphicsAdapter.js`'s `createRadialGradient`) is built from Pixi v8's
  documented API but **not confirmed against an actual browser render**. If
  fire wells look positioned/scaled wrong, check here first.

## What's actually been visually verified (important)

This sandbox environment has no browser — all of the above was verified by
careful source reading + `vite build` success, not by seeing it render. The
person running this project has looked at the actual rendered output twice
so far and found real bugs both times that careful code-reading missed:

1. **Round 1 report:** background stretched, bloon sprites offset wrong,
   dart upgrades out of place → traced to real bugs (missing per-map
   scale/offset math, missing `spriteOffsetX/Y` + `GLOBAL_SCALE`, and a
   genuine behavioral divergence in how `dart` positions its overlays) →
   fixed.
2. **Round 2 report:** "bloons and moabs still squashed" → traced to
   `sprite.width = sprite.height = targetSize` forcing a square bounding
   box instead of uniform scale-by-max-dimension → fixed.

**Takeaway for whoever picks this up next: get eyes on an actual render as
early as possible, and treat "builds without errors" as a floor, not a
finish line.** The bugs found so far were exactly the kind that are invisible
from reading code carefully — they only show up when you look at the
screen. Don't extrapolate "structurally covered" in the table above into
"visually correct" without checking.

## Why PixiJS over raw WebGL2

Chosen per project owner's preference. Practical reasons it fit well:
- `PIXI.Graphics`'s `moveTo/lineTo/arc/fill` API closely mirrors the
  Canvas2D path API already used throughout this codebase, so the ~200+
  vector-drawing calls across `projectileDrawers.js`, tower buff effects,
  and hero specials can often be **reused verbatim** via
  `CanvasGraphicsAdapter` instead of hand-translated shape by shape — this
  turned out to be the single highest-leverage decision in this migration;
  see "The adapter pattern" below.
- Handles texture batching automatically — relevant given 463 sprite files.
- `Assets.load()` gives async loading/caching for free.

## Key discoveries worth knowing before continuing

1. **A tower calling `drawBaseTower()` doesn't guarantee the generic
   renderer is otherwise correct for it.** Several towers (`ice`, `wizard`,
   `ace`) draw an extra effect *before* `drawBaseTower` (behind the tower,
   not in front — an earlier pass got this backwards), and `alchemist`/`dart`
   skip `drawBaseTower` entirely under certain states (full early-return in
   the original, needs the generic render hidden, not layered under/over).
   This class of bug was only caught by actually reading each tower's full
   `draw()` function, not by pattern-matching on "does it call
   drawBaseTower." Worth doing the same full read for anything not yet
   verified.

2. **`Hero extends Tower`, and heroes are pushed into `engine.towers`** the
   same as regular towers (`engineInput.js`: `this.towers.push(newTower)`
   runs unconditionally). This meant heroes needed almost no dedicated
   rendering work — assumed at first that they'd need a whole separate
   system; they didn't. Worth asking this kind of "is this actually a
   separate system, or does an existing one already cover it" question
   before scoping new work as bigger than it is.

3. **The adapter pattern (`canvasGraphicsAdapter.js`) is the most reusable
   piece of this whole migration.** It's a thin shim implementing enough of
   the Canvas2D path API (`beginPath/moveTo/lineTo/arc/closePath/fill/
   stroke/fillRect/rotate/createRadialGradient`) that *existing, correct*
   drawer functions can run against `PIXI.Graphics` with zero modification.
   This avoided re-deriving ~30 projectile shapes, several tower effects,
   and will very likely make the `geto`/`gojo`/`sauda` port much faster than
   a from-scratch translation would be — check there first before writing
   new vector-drawing code by hand.

4. **Squares vs. uniform scaling.** Any time you set a sprite's size, check
   whether the original used `drawImageCentered`-style uniform
   scale-by-max-dimension (most sprites) or a genuinely flat square
   (`ctx.drawImage(img, -s/2, -s/2, s, s)` — only the stun overlay does
   this). Setting `sprite.width = sprite.height = X` directly is the bug
   that caused the "squashed" report — use the `_sizeUniform` helper in
   `pixiRenderer.js` by default, and only skip it if you've confirmed the
   original genuinely forces a square.

## Suggested order of attack for continuing

1. **Get real visual verification going, wider than 2 spot-checks.**
   Highest-value next step by far, and now doubly true after three rounds
   of changes (resolution fix, placement preview, beasts/sentries/
   particles/explosions/acid pools/floating text/selection/leak-flash/
   shadows/hitscans/bananas, four layer-order fixes) verified only by
   careful reading, never by seeing them render — same caveat as
   everything else in this doc. Try: several tower types at various
   upgrade tiers, several enemy tiers/states (frozen, camo, regen,
   brittle, MOAB-class with cracks), a hero, placing a Beast/Druid or
   Sentry-producing tower to check minion rendering, triggering explosions
   (bomb tower, mortar) and acid pools (acid bloons, corrosive tower
   effects), popping a bloon and checking crit floating text, clicking a
   placed tower to check the selection ring vs. the placement-preview
   ghost look distinct and correct, leaking a bloon to check the
   screen-flash border, firing a sniper to check the hitscan beam line,
   placing a farm/village and letting it drop bananas, checking that every
   placed tower now has a shadow under it — and all of the above on both a
   1x and a HiDPI display to confirm the resolution fix actually holds.
2. **Port the remaining `renderer.js`/`towerRenderer.js` subsystems**:
   per-tower night-mode glow (`ctx.createRadialGradient`, same blocker as
   wizard's fire wells — needs real `Graphics` gradient-fill support
   first), dev overlay, custom cursor, main-menu scenery, hitbox debug
   overlay, and the two remaining outer-composite effects (boss
   warning-line/screen-split rendering, `CutsceneManager`'s cutscene-ball
   draw + camera-pan offset). `BossHealthBarHandler` is done. None of
   these block basic playability the way the previous rounds' items did —
   they're polish/dev-tooling/night-mode/cutscene-specific at this point.
3. Finish input/interaction verification — the coordinate-math root cause
   is fixed (see above), but the actual `dragManager.js` drag-and-drop flow
   hasn't been exercised.
4. `geto`/`gojo`/`sauda` dedicated ports, using the adapter pattern.
5. Farm/village verification (may already be fine, just unconfirmed).
6. Only once all the above visually match Canvas2D output: swap
   `dom.js`/`engine.js` to default to `PixiRenderer`, delete
   `renderer.js`/`towerRenderer.js`/`enemyRenderer.js`/`projectileDrawers.js`
   and the Image-based half of `assets.js`.

## Files in this folder

- `pixiApp.js` — Pixi Application bootstrap + fixed render-layer stack
  (`background → path → towerUnderEffects → towers → enemies → projectiles
  → effects → overlay`)
- `pixiAssets.js` — texture cache, same key scheme as `js/assets.js`
- `pixiRenderer.js` — the actual renderer (this is the file you'll spend
  most of your time in — it's grown large, use search rather than reading
  top to bottom)
- `canvasGraphicsAdapter.js` — the reuse-pattern shim described above

## Round-by-round change log (for archaeology, not required reading)

<details>
<summary>Expand for the detailed history of what was found/fixed each round</summary>


### Round 1: initial POC (map background + towers)
Built `pixiApp.js`, `pixiAssets.js`, `pixiRenderer.js` from scratch. Proved
the pipeline against real map background + tower base sprites.

### Round 2: enemies, projectiles, tower overlays/animations, buff effects
Added full enemy rendering, projectile rendering (+ the adapter pattern,
first used here), tower upgrade-overlay compositing + attack animations,
and `SpriteConfig` offset support (discovered this was the actual root
cause of most "custom tower" positioning logic, not a separate concern).

### Round 2.5: visual bug fixes (first real browser feedback)
Project owner reported: background stretched, bloon sprites offset wrong,
dart upgrades out of place. Traced and fixed:
- Background was naively stretched to full canvas instead of using the real
  per-map `imageScale`/`imageOffsetX/Y`/`imageMaintainRatio` math.
- Enemy sprites were missing `spriteOffsetX/Y` (only blades had it) and a
  `GLOBAL_SCALE` multiplier.
- `dart` doesn't use per-overlay `SpriteConfig` lookups like the generic
  path — it shares ONE offset (based on its single best upgrade path/tier)
  across base, arm, AND every overlay. Also has a "catapult" sprite special
  case (path-1 tier-3+) and a fan-club-buff early-return that skips the
  normal render entirely. Gave it a dedicated `_updateDartVisual` rather
  than patching the generic path further. Preserved (didn't "fix") what
  looks like a copy-paste bug in the original's `_a` overlay key lookup
  (uses loop index instead of actual tier) — flagged in comments, not
  silently changed, since it's existing game behavior.

### Round: "be smart about this" — rescoping custom-draw towers
Prompted to check whether all 11 towers with custom `draw()` overrides
really needed bespoke rendering. Checked all 11: 9 of them call
`tower.drawBaseTower()` (the generic path) and only add a small extra
effect for rare states. Only `mermonkey` and `dart` reimplement the base
render itself. Real remaining scope was much smaller than "11 separate
renderers" — implemented `SpriteConfig` support (benefits all towers) plus
4 additive effects (`ice`, `mermonkey`, `alchemist`, `dart`) that turned out
to all use plain fillStyle, compatible with the adapter as-is.

### Round: full enemy status effects + blade/squeeze/stun
Added MOAB/BFB/ZOMG blade animation (with the correct stage/frame asset
fallback chain), squeeze/crush death transform, stun overlay (wall-clock
animated), brittle status ring. Fixed a dropped `container.rotation` line
(introduced and caught within the same pass via careful re-checking before
declaring it done).

### Round: z-order correction pass (prompted by "let's get eyes on a render")
After trying and failing to get a headless browser working in this sandbox
(network egress blocked to Chromium's download host), the project owner ran
it locally and reported specific visual bugs. This led to:
- Discovering `ice`/`wizard`/`ace` draw their effects **behind** the tower,
  not above — an earlier pass had put all "tower effects" in one layer
  ABOVE towers, which was wrong for these three.
- `alchemist`'s monster-form was double-rendering (monster effect PLUS the
  generic tower underneath) — original does a full early-return, same bug
  shape as `dart`'s fan-club case.
- `ace` needed a body-position override (renders at `planeX/Y/planeAngle`
  during its flying ability, not the tower's logical `x/y`) plus an
  unconditional landing-pad effect.
- Restructured to a dedicated `towerUnderEffects` layer sitting between
  `path` and `towers` in the stage, fixing all of the above at once.

### Round: "bloons and moabs still squashed"
Found `sprite.width = sprite.height = targetSize` was forcing a square
bounding box on enemy base/crack/blade sprites and mermonkey's base,
stretching any non-square sprite. The generic tower path already did
uniform scale-by-max-dimension correctly; enemies/mermonkey just weren't
using the same approach. Fixed via a shared `_sizeUniform` helper. Checked
the stun overlay too and confirmed it's genuinely meant to be square in the
original — left as-is, only added a missing `GLOBAL_SCALE` multiplier there.

### Round: full enemy status-effect z-order pass
Went back through `enemyRenderer.js` end to end rather than assuming the
earlier pass was complete. Found the blade overlay was layered ABOVE the
base sprite — backwards; it's drawn first in the original (behind the
base). Fixed, and ported three states that hadn't been accounted for at
all: frozen overlay (image, falls back to a ring), slow ring, and
camo/regen overlay (skipped when the base sprite is already a dedicated
camo/regen texture). Also implemented infinity tint for the first time
(approximated — see caveats above).

Full verified z-order, bottom to top: blade → base → crack → (frozen
overlay OR slow ring, tier < 13 only) → camo/regen overlay (tier < 13
only) → brittle ring → infinity tint → stun overlay.

### Round: heroes
Discovered `Hero extends Tower` and heroes are pushed into `engine.towers`
unconditionally — meaning the tower renderer already covers heroes for
free. Checked all 13 heroes' `draw()` individually: 6 needed zero extra
code, 3 more (`gwendolin`, `obyn`, `quincy`) needed a small behind-the-tower
effect (ported), and 3 (`geto`, `gojo`, `sauda`) have fully custom,
substantial `draw()` overrides — deliberately not rushed given how many
subtle bugs shallow ports have produced elsewhere in this project.

### Round: real gradient support
Added `createRadialGradient`/`addColorStop` to `CanvasGraphicsAdapter`
(backed by Pixi's `FillGradient`), letting `wizard.js`'s fire wells run
through the actual original gradient code instead of a flat-color
approximation. Falls back to solid color if the gradient fill throws, so it
can't hard-crash rendering. Coordinate mapping verified against Pixi v8's
documented API but not against an actual browser render — flagged above.

### Round: input coordinate-math fix + placement preview + honest gap audit
Continued from the suggested order of attack (items 2 and 5). No browser
available in this sandbox environment either (network egress blocked, and
this time `node_modules` wasn't even installed, so not even a `vite build`
sanity check was possible this round — everything below is source-reading
only, more so than usual, so treat it as even less verified than prior
rounds until someone runs it).

- **Found and fixed the input coordinate bug flagged as a risk in the
  previous round's notes.** `pixiApp.js` set `resolution:
  Math.min(devicePixelRatio, 2)` with `autoDensity: true`, which makes Pixi
  set the canvas's backing-store `width`/`height` to the *physical* pixel
  size rather than the logical 1280x720 game size. Every input call site
  across `engineInput.js`, `input.js`, `dragManager.js`, and `mobile.js`
  computes `scaleX = canvas.width / rect.width` assuming `canvas.width` is
  the logical size — true under the original Canvas2D context (which never
  did DPR scaling), false the moment Pixi's `resolution` is anything other
  than 1. Fixed by pinning `resolution: 1` in `pixiApp.js`, with a detailed
  comment there for whoever wants HiDPI crispness later (that would require
  updating every one of those call sites at the same time, not just this
  one file). This was a source-reading-only fix — no browser to confirm the
  before/after click position, so verify this first when a browser is
  available.
- **Ported the tower-placement preview** (range ring + valid/invalid/
  afford-tinted ghost sprite) into `pixiRenderer.js`, matching
  `renderer.js`'s `_drawPlacementPreview`/`_checkPlacementOverlap`. Reuses
  `_applySpriteConfig` (the same helper already used for placed towers) so
  the ghost sprite's scale/offset matches where the tower will actually
  render once placed. Colors/alphas hand-translated from the original's
  `ctx.globalAlpha = 0.6` + rgba fillStyle combinations into flat
  Pixi-fill `{color, alpha}` values — see the constants at the top of
  `pixiRenderer.js`. Did NOT port `_drawSelection` (the *placed/selected*
  tower's outline+range ring, a separate method) — flagged as a gap, not
  silently left out.
- **Audited every top-level `_draw*` method `renderer.js`'s `render()`
  actually calls against what `pixiRenderer.js` implements**, method name
  by method name, rather than trusting the "Structurally covered" summary
  further up this doc. Found several entire subsystems with zero Pixi
  implementation that weren't explicitly called out as gaps before:
  particles, explosions, acid pools, floating text, leak-flash,
  `_drawSelection`, dev overlay, cursor, main-menu scenery, hitbox debug,
  and the boss-warning-line/cutscene/boss-health-bar compositing that
  happens after the main entity pass. None of this is a regression from
  this round's changes — it was already true, just not written down
  explicitly. Added to the gap list above so the next session (or the
  project owner skimming this doc) has an accurate picture rather than
  over-trusting the summary table.

### Round: beasts, sentries, particles, explosions + layer-order fix
Continued straight on from the previous round's own suggested next steps.
Same sandbox limitation as last round applies (no browser, no
`node_modules`/`vite build` — source-reading + `node --check` syntax
validation only, nothing rendered or visually confirmed).

- **Ported the four remaining entity types `_drawEntities` draws that
  weren't in the original "Structurally covered" list at all: beasts,
  sentries, particles, explosions.** Found while investigating
  `_drawEntities` line-by-line rather than trusting the method-name audit
  from the previous round (that audit checked `render()`'s top-level
  `_draw*` calls, but `_drawEntities` itself fans out into `beast.draw()`/
  `sentry.draw()`, which aren't visible as separate method names — worth
  remembering for future audits of this kind: check what nested draw calls
  a method makes, not just its own name).
  - Beasts (`beastEntity.js`) and sentries (`sentryEntity.js`) are drawn
    with plain colored circles/rects/text in the original, no sprite
    assets — ported natively with `PIXI.Graphics`/`PIXI.Text` rather than
    through `CanvasGraphicsAdapter`, since the adapter only covers the
    narrow path-API subset `projectileDrawers.js` uses (no `ellipse`, no
    `setLineDash`, no text). One known cosmetic gap: the beast's dashed
    line back to its owner tower renders as a solid line, since
    `PIXI.Graphics` has no dashed-stroke equivalent to
    `ctx.setLineDash()`.
  - Particles (`particle.js`, pop effects) reuse the exact sprite-pooling
    pattern already established for projectiles — same identity-per-
    pooled-object approach, since `Particle` instances come from
    `engine.particlePool` (an `ObjectPool`) the same way projectiles do.
  - Explosions (`engine.explosions`) are plain object literals pushed by
    several different files (`beastEntity.js`, `enemyDamage.js`,
    `projectile.js`, `projectileHitResolution.js`, `sentryEntity.js`) and
    swap-popped on expiry — no stable identity to key a pooling `Map`
    against the way every other entity type here has, so instead of
    per-object sprites this clears and redraws one shared `Graphics` every
    frame with all currently-active explosions. Simple and cheap given
    they're few and short-lived (0.1–0.5s).
- **Found and fixed a real z-order bug in `pixiApp.js`'s layer stack**,
  found while figuring out which layer to put the new minion-type entities
  in and cross-checking against `_drawEntities`'s actual draw order
  (towers → beasts → sentries → projectiles → enemies → particles). The
  existing layer array had `'enemies'` before `'projectiles'`, which in
  Pixi's child-order-is-z-order model means enemies rendered *underneath*
  projectiles — backwards from the original, where projectiles draw first
  and enemies draw on top of them. Also added two new layers: `'minions'`
  (beasts/sentries, sitting between towers and projectiles, matching the
  original's draw order) and `'explosions'` (sitting right after `'path'`,
  since the original draws `_drawExplosions` *before* `_drawEntities`
  entirely — explosion burst circles render underneath towers/enemies, not
  over them, in the original). Corrected order is now: `background → path
  → explosions → towerUnderEffects → towers → minions → projectiles →
  enemies → effects (particles) → overlay`. This is a source-reading-only
  fix, like everything else in this doc not explicitly marked otherwise —
  worth a specific visual check (fire a mortar/bomb near a bloon pack and
  confirm the enemy sprites aren't hidden behind the projectile or
  explosion visuals).

### Round: acid pools, floating text, selection ring, leak-flash
Continued straight on from the previous round's suggested next steps
(items 2's remaining pieces). Same sandbox limitation applies — no
browser, no `node_modules`; verified with `node --check` (syntax only) and
careful reading against `renderer.js`, nothing rendered or visually
confirmed.

- **Ported `_drawSelection`** — the orange outline ring + translucent range
  fill shown around a tower the player has clicked to select. Kept
  deliberately distinct from the placement-preview ghost from the previous
  round (separate `Graphics` object, separate constants
  `TOWER_HIT_RADIUS_PADDING`/`TOWER_SELECTION_LINE_WIDTH`/
  `TOWER_SELECTION_FILL_ALPHA`, matching `renderer.js`'s own separate
  constants for the two) since they're visually similar but semantically
  different (about-to-place vs. already-placed-and-selected) and the
  original never conflates them.
- **Ported `_drawAcidPools`** — pooled by object identity the same way
  beasts/sentries are (plain objects, but persist across many frames with
  stable identity, unlike explosions/floating text which are much shorter
  lived and get created continuously).
- **Ported `_drawFloatingTexts`** (crit/damage/cash popups) using
  `PIXI.Text` with native `stroke` styling in place of the original's
  manual `strokeText`+`fillText` double-draw — same visual result, fewer
  draw calls. Pooled by object identity (same pattern as acid pools),
  added to a dedicated sub-container of the `overlay` layer so it reliably
  ends up stacked below the placement preview/selection/leak-flash
  regardless of per-frame call order.
- **Ported `_drawLeakFlash`** — trivial, a single `Graphics` rect-stroke
  redrawn each frame from `engine.leakFlash`.
- **Added a fourth layer, `acidPools`**, positioned right after `path` and
  before `explosions`/`towerUnderEffects`/entities, matching where
  `renderer.js`'s `render()` actually calls `_drawAcidPools` — before
  `_drawExplosions`, which is itself before `_drawEntities`. Also
  documented (in `pixiApp.js`'s layer-order comment) the intended internal
  stacking order of the four elements now sharing the single `overlay`
  layer: floating text → placement preview → selection → leak-flash,
  enforced by each method's lazy-init-on-first-call happening in that
  fixed order in `render()`, not by any explicit z-index mechanism — worth
  double-checking visually since this is a slightly fragile way to get
  correct ordering (fine as long as `render()`'s call order isn't
  reshuffled later without also re-checking this).
- Remaining gap list trimmed to reflect what's actually left: dev overlay,
  cursor, main-menu scenery, hitbox debug overlay, tower/sentry shadows,
  and the outer-composite boss-warning-line/cutscene/boss-health-bar
  effects that live outside `render()`'s main pass. None of these block
  basic playability the way the previous two rounds' items did.
- **Housekeeping note:** partway through this round, an interrupted/retried
  edit left `pixiRenderer.js` with duplicated `const` declarations and
  duplicated method bodies for `_drawAcidPools`/`_drawFloatingTexts`/
  `_drawSelection`/`_drawLeakFlash` — the file briefly failed to parse at
  all (`node --check` caught it immediately:
  `SyntaxError: Identifier '...' has already been declared`). Cleaned up by
  deduplicating both the top-of-file `const` block and the four methods,
  keeping the more complete of each duplicate pair. Re-verified with
  `node --check` across every file in `js/webgl/` afterward — all clean.
  Mentioning this explicitly rather than quietly fixing it, since a
  from-scratch review of this file by anyone else should know it went
  through that. If something in the surviving code looks like it doesn't
  quite match this doc's description of it, that's the most likely reason
  — worth a diff against git history if one exists.

### Round: tower shadows, hitscans, bananas + one more gap found
Continued from this round's own suggested next steps (item 2's shadow
piece). Same sandbox limitation as every prior round — no browser, no
`node_modules` — verified with `node --check` (syntax only) plus careful
line-by-line reading against `towerRenderer.js`, nothing rendered.

- **Ported tower shadows.** Sentries already had theirs from an earlier
  round; towers didn't. Added a `Graphics` ellipse as the bottom-most
  child of each tower's existing container (drawn once per tower, sized
  from `tower.stats.scale`), matching `towerRenderer.js`'s unconditional
  `drawShadow()` call at the top of `draw()` — including for the
  alchemist-monster-form case, which still gets a shadow in the original
  even though its normal base sprite is hidden and replaced by
  `_drawMonsterForm` elsewhere. Unified both tower and sentry shadows onto
  one set of shared `SHADOW_*` constants instead of each having their own
  copy of the same magic numbers.
- **Found two more real gaps by reading `towerRenderer.js`'s `draw()`
  top-to-bottom instead of stopping at the shadow line** — the same lesson
  as two rounds ago about checking nested draw calls, not just top-level
  method names, applied one level deeper this time (inside a single
  tower's own draw method, not just `_drawEntities`'s entity-type list).
  - `_drawHitscans`: sniper-family instant beam lines. Ported — combined
    across all towers into one shared `Graphics` (same reasoning as
    explosions: no stable per-line identity, ~100ms lifetime, cheap to
    fully redraw every frame).
  - `_drawBananas`: the physical banana/crate pickups dropped by farm/
    village/sniper's crate ability (distinct from the *static* banana
    overlay on a farm's sprite, which the generic tower path already
    handles). Ported — combined across all towers, pooled by object
    identity like particles (these persist several seconds, unlike
    hitscans). One known simplification: the original falls back to a
    small drawn yellow arc shape if the banana image asset isn't loaded;
    this just hides the sprite in that case instead. Shouldn't matter in
    practice since the asset preloads with everything else, but flagging
    since it's not byte-for-byte identical fallback behavior.
  - **Not ported**: the per-tower night-mode radial-gradient glow at the
    very top of `draw()` (`engine.nightAlpha > 0` branch). Same blocker as
    wizard's fire wells (`ctx.createRadialGradient`, no `Graphics`
    gradient-fill equivalent wired up yet) — added to the gap list above
    rather than attempted with a flat-color approximation.
- This also means the farm/village gap note earlier in this doc ("may
  already be close, just unverified") was a bit optimistic — the *static*
  sprite+banana-overlay path was probably fine, but the *dynamic* banana
  drop animation was a full, separate, entirely-missing subsystem until
  this round. Updated that framing implicitly by moving bananas into the
  "now ported" list rather than leaving it bundled under the vaguer
  farm/village line.

### Round: boss health bar, and a deliberate non-decision on the heroes
Continued from this round's own suggested next steps. Same sandbox
limitation as every prior round — no browser, no `node_modules` —
`node --check` (syntax only) plus reading, nothing rendered.

- **Considered `geto`/`gojo`/`sauda` first** (item 4 in the suggested
  order), since it's the largest remaining named gap. Read all three
  `draw()` overrides in full (`heroes/geto.js` 523 lines, `heroes/gojo.js`
  399, `heroes/sauda.js` 459) — each has its own custom particle-style
  sub-entities (geto's `spirits`/`hands`, each with their own nested
  `draw()`) well beyond a simple sprite/adapter port. Deliberately did
  **not** attempt a shallow port this round, for the same reason the
  previous "heroes" round gave for skipping these three specifically:
  this project has repeatedly turned up subtle bugs from exactly this kind
  of rushed, large, custom-visual port (see the tower buff-effects
  z-order bug, the enemy-overlay z-order bug, and this session's own
  file-corruption incident, as examples of what "moving fast" has cost
  here before). These three heroes deserve their own dedicated round with
  room to actually trace each sub-entity's draw order and math carefully,
  not a rushed pass squeezed in alongside other work. Left untouched,
  still flagged in the gap list, no partial/broken attempt committed.
- **Ported `BossHealthBarHandler.draw()` instead** — picked as the next
  most tractable, real-gameplay-value item once the heroes were set aside.
  Turned out to be simple: pure screen-space UI (stacked bar +
  name/HP text per active MOAB-class boss), drawn after the world canvas
  is already composited in the original, so no camera-offset or
  world-coordinate interaction to reason about — straightforward port
  onto the 'overlay' layer, pooled by the health-bar-entry object's
  identity (mirroring `BossHealthBarHandler.activeBosses` itself) the same
  way beasts/sentries/particles are. Replicated the original's
  dead-boss-pruning-as-a-side-effect-of-draw() behavior for exact parity,
  even though it's normally redundant with `unregisterBoss()` already
  being called on boss death elsewhere.
- Remaining outer-composite cluster is now down to just the boss
  warning-line/screen-split effect and `CutsceneManager` (cutscene "balls"
  + the camera-pan offset applied to the world canvas during cutscenes) —
  the latter is probably the next-most-involved item left in the whole
  gap list, since it would require the pixi renderer to understand and
  apply a camera offset to the entire world-layer stack, which nothing
  here currently does.

### Round: night-mode glow, custom cursor (final pass, tight budget)
Last round of this session, done deliberately small and self-contained
given limited remaining budget — same reasoning as the heroes
non-decision two rounds ago: better to do one or two things fully and
verifiably than start something large and leave it half-checked. Same
sandbox limitation as always — no browser, verified with `node --check`
plus a full duplicate-identifier sweep (both `const` names and method/
field names) after each change, learned the hard way earlier this session.

- **Ported per-tower night-mode glow.** Was flagged as blocked on gradient
  support, but that support was actually already built (for wizard's fire
  wells, a few rounds back) — just hadn't been circled back to. Added as
  another child in each tower's container, using the same `FillGradient`
  technique, `textureSpace: 'local'` since it lives inside the tower's own
  already-positioned container rather than a shared world-space layer.
- **Ported the custom gameplay cursor** (`_drawCursor`) plus its other
  half, the OS-cursor-hide (`engine.canvas.style.cursor = 'none'` during
  play) — the latter is plain CSS and was simply never wired into this
  file before, since nothing here had touched `engine.canvas` directly
  until now. Without both together you'd get either two overlapping
  cursors or none. Includes the boss-screen-split position nudge from the
  original, applied even though the screen-split *visual* itself isn't
  ported — the underlying simulation value it reads is set independent of
  which renderer is active.
- **Ported the boss warning-line telegraph** too — the simpler sibling of
  the screen-split branch in the same original `if/else if`. Just a
  double-stroked fading red line across the screen, no camera/composite
  interaction, so genuinely separable from the harder screen-split half
  which stays unported (see gap list above for why that one's a real
  architectural change, not just a missing element).
- Also fixed a stale comment on `_drawPlacementPreview` left over from an
  earlier round, still claiming `_drawSelection`/`_drawLeakFlash` weren't
  ported when they in fact were ported two rounds ago — a reminder that
  comments next to code drift out of date just like the gap list itself
  does, and are worth a periodic sanity pass, not just the list.

**Where this leaves things:** the only real gaps left are `geto`/`gojo`/
`sauda`, `CutsceneManager` (camera-pan + cutscene balls — the most
structurally involved remaining item, since nothing here applies any
camera offset to the world layer stack yet), the boss warning-line/
screen-split visual, and pure dev-tooling (`_drawDevOverlay`,
`_drawMainMenuScenery`, `_drawHitboxes`). None of the four should block a
normal playthrough. What *should* block calling this migration done is
still the same thing it's been every round: **nobody has looked at this
render in a browser yet.**

### Round: warning-line, and a defensive isolation pass instead of more features
Checked the remaining big items before deciding what to spend the rest of
this session's budget on. Same sandbox limitation throughout — no
browser, `node --check` plus a full duplicate-identifier sweep after each
change.

- **Ported the boss warning-line telegraph**, splitting it cleanly off
  from its sibling in the same original `if/else if` block (the boss
  screen-split visual, which is NOT ported — see below for why).
- **Checked `CutsceneManager.draw()` and `CutsceneBalls.draw()`** (the two
  pieces of the cutscene system) before deciding whether to attempt them.
  Both are genuinely hard, not just long:
  - `CutsceneManager.draw()` uses an offscreen canvas + `source-in`
    composite mode to extract a silhouette of the boss sprite, then clips
    and rotates two halves of it for a "ripping apart" animation. No
    `Graphics`-fill equivalent for arbitrary-sprite silhouette extraction
    exists in this codebase yet (the `infinity` tint approximation earlier
    in this doc is the closest analog, and that one's already flagged as
    "close, not exact" for a much simpler effect).
  - `CutsceneBalls.draw()` spawns up to ~2000 particles and uses
    `destination-out` composite mode to punch ring-shaped holes for an
    outline effect. Also has no clean `Graphics`-fill equivalent, and at
    that particle count a naive per-ball Pixi Graphics approach would need
    real profiling before trusting it not to tank frame rate, which isn't
    possible to do without a browser.
  
  Both are cutscene-only (rare, specific boss encounter), not core
  gameplay, and both are exactly the "large, custom, hard to verify by
  reading alone" category this session has repeatedly declined to rush
  (same call as the heroes, same call as boss screen-split). Left
  untouched, added to the gap list.
- **Spent the remainder of the budget on risk reduction instead of more
  features**: wrapped every one of `render()`'s ~19 sub-draw calls in a
  `_safeDraw()` helper (try/catch, logs each failing method once instead
  of spamming every frame, keeps retrying rather than permanently
  disabling — most methods `.clear()` their own state first, so a
  mid-method throw still gets the stale visual wiped next frame instead of
  stuck on screen). Rationale: this file has accumulated ~20 draw methods
  over many rounds, every single one verified only by reading, never by
  running. It's entirely plausible at least one has a real-game-state
  runtime bug that hasn't been caught. Without this, one throwing method
  would silently stop every draw call after it in that frame — this
  doesn't fix that bug, but it stops "one wrong visual" from turning into
  "black screen," which matters a lot given how much of this file nobody
  has watched run yet.

**Where this leaves things, one more time, honestly:** feature coverage is
now about as complete as it reasonably gets without either (a) rushing the
genuinely hard remaining items (heroes, screen-split, cutscene), which
this session declined to do on purpose, or (b) actually running this in a
browser, which no round this session was able to do. The defensive pass
above is a hedge against the risk that (b) creates, not a substitute for
it. Doing (b) is still, by a wide margin, the single most valuable thing
anyone picking this up next can do before writing another line here.

### Round: first real browser feedback, and Gojo's VFX ported natively
The owner finally ran this in a browser (`?webgl=1`) and reported real bugs
— exactly the thing every prior round said hadn't happened yet and was the
biggest source of risk.

- **Fixed: tower shadows rotated with the tower.** Confirmed by reading —
  `utils.js`'s `drawShadow(ctx, x, y, r)` is called before any rotation
  transform in the original (`towerRenderer.js` draws it, then rotates for
  the sprite), so the shadow is always a flat, axis-aligned ellipse. In the
  Pixi port, `entry.shadow` was a child of the same `container` that gets
  `container.rotation = angle + PI/2`, so it inherited that rotation. Fixed
  by counter-rotating the shadow (`entry.shadow.rotation = -container.rotation`)
  each frame in `_drawTowers` — cancels the inherited rotation while still
  riding along on the container's position for free.
- **Reported: towers render too small, uniformly, from placement.** Traced
  the sizing formula in both `_updateGenericTowerVisual`/`_applySpriteConfig`
  and `_updateDartVisual` against the originals (`towerRenderer.js`'s
  `_drawAsset`, `dart.js`'s `getDrawParams`) line-by-line and found them
  identical — no discrepancy found by reading. Owner then clarified this
  wasn't actually a webgl-port bug: a pre-existing config that scaled
  certain heroes (e.g. Gojo) up after placement, unrelated to the
  Canvas2D/WebGL split. Not fixed because there was nothing to fix — noting
  it here so it isn't rediscovered and re-investigated from scratch next
  round.
- **Ported Gojo's ability VFX natively** (new file `renderHeroVFX.js`),
  the first of the three reverted heroes. The earlier adapter-hack attempt
  failed because Gojo's VFX (`drawMaxBlueVFX`/`drawRedTyphoonVFX`/
  `drawHollowPurpleVFX`) uses `globalCompositeOperation = 'screen'` and
  nested `ctx.rotate()`/`ctx.scale()` on gradient blobs, neither of which
  `CanvasGraphicsAdapter` supports (it only forwards flat, unscaled paths).
  Went native instead: Pixi's `Graphics.blendMode = 'screen'` covers the
  composite mode, and the rotate+scale is baked directly into each blob's
  polygon points by hand (same trick the adapter itself uses internally,
  applied once per shape instead of accumulated per draw call — for a
  uniform scale factor, rotating-then-scaling a point equals scaling-then-
  rotating it, so one `rotScale()` helper covers both canvas calls at
  once). Covers: the phase-transition/Maximum-Blue blob VFX, both Reversal
  Red variants, Hollow Purple charge-and-projectile, the Limitless aura,
  and the basic-attack blue wells. Gradient-filled *strokes* (Red Typhoon's
  arcs) are the one part of this I'm least sure about — Pixi v8's
  `stroke({ fill: gradient })` should work per the documented API shape,
  same as `canvasGraphicsAdapter.js`'s existing fill-gradient handling, but
  it's untested like everything else in this file.
- **Still not done: Geto, Sauda.** Same adapter limitation almost
  certainly applies to both (worth re-reading `heroes/geto.js` and
  `heroes/sauda.js` fresh rather than assuming the exact same shape of fix
  applies — Geto's spirits/hands sub-entities in particular look like
  they'll need their own pooling, not just a VFX-layer port like Gojo's).

**Where this leaves things:** one real bug fixed and verified against the
original's logic (not against a running browser — that's still not
available here), one reported issue traced to not actually being a bug,
and one of three heroes ported. The pattern holds: browser feedback from
the owner is still the fastest way to find what reading code alone misses
— worth doing again for the shadow fix and the new Gojo VFX before trusting
either.

### Round: Sauda ported natively too
Same session, continued straight on to the second of the three reverted
heroes.

- **Ported Sauda's VFX** (same `renderHeroVFX.js`, new `_drawSaudaEntry`).
  Simpler case than Gojo — no blend modes, just three things the adapter
  couldn't do because it only forwards vector path calls, never
  `drawImage`: the aftersword pulse (one radial-gradient circle, easy),
  the Sword Charge shadow duplicates (pooled `tower_sauda_base` sprites
  running along each path), and the attack slashes (pooled `proj_slash`
  sprites). Pool sizes track `tower.chargeShadows`/`tower.slashes` length
  each frame, same reconcile-by-push/pop pattern used elsewhere in this
  codebase.
- **Also fixed a real gap in `renderTowers.js`'s generic path**, not just
  added new VFX: the original hides Sauda's own sprite entirely during
  Sword Charge (`if (!tower.chargeLockout || tower.chargeLockout <= 0)`)
  since the charging duplicates stand in for her — the generic tower
  renderer had no idea `chargeLockout` existed and would've kept drawing
  her stationary base sprite on top of/alongside the charge duplicates.
  Added a `type === 'sauda' && tower.chargeLockout > 0` branch mirroring
  the existing alchemist-monster-form hide pattern right above it.
- **One structural note for whoever ports Geto next**: the shadow and
  slash sprite pools initially shared one container and got
  `addChild`-ed directly to it as they were created. Caught before it
  shipped — since pool sizes change independently frame to frame, sprites
  created later always land at the end of Pixi's display list regardless
  of which pool they belong to, so the fixed "shadows under slashes"
  stacking from the original could drift after enough charge cycles. Fixed
  by giving each pool its own sub-container in a fixed add order instead.
  Worth checking for the same pattern in any new pooled-sprite code.

**Still unported: Geto.** Now the only one of the three left. Its own
`spirits`/`hands` sub-entities (per the gap list) are the reason it's
likely more than a same-shape repeat of this round.

### Round: Geto ported — all three heroes now done
Same session, continued through to the last of the three.

- **Ported Geto's VFX** (same `renderHeroVFX.js`, new `_drawGetoEntry` +
  helpers). The most involved of the three:
  - **Uzumaki spirits** (condensing phase, up to 90 at once) — each is a
    5-segment tapered "worm" spine with its own face, drawn via `poly()`
    for the body and a real Pixi `Container` (position + rotation) for the
    face, standing in for the original's `ctx.translate`+`ctx.rotate`
    before drawing an unrotated ellipse. Pooled per-slot since the spirit
    count is fixed for the life of one cast.
  - **Uzumaki firing phase** — the blast (screen-blend radial gradient)
    plus `_StretchedHand` tentacles (bezier arm + 5 fanned finger curves),
    with the rotation baked into each point by hand the same way Gojo's
    blobs were, since these also only exist in a rotated local frame in
    the original.
  - **CE Field** — the one genuinely different case: this is a *full-
    canvas screen-space overlay* (`fillRect(0,0,1000,700)`), not tower-
    relative like everything else in this file. Added to the `overlay`
    layer instead of `towerUnderEffects`, same layer `_drawLeakFlash` in
    `renderUI.js` already uses for exactly this kind of thing — worth
    checking that pattern before assuming everything is tower-local.
  - **Curse Capture tether** — dashed quadratic-curve line to the
    captured target plus traveling dots. Pixi has no `setLineDash`
    equivalent, so the curve is sampled into segments and every-other-one
    is skipped to fake the dash pattern; exact dash phase/spacing wasn't
    verified against a running browser.
  - **Squids/worms** — squids use a real sprite (`proj_squid` exists in
    assets), worms don't (`proj_worm` is missing) so they always hit the
    vector fallback (screen-blend hue-cycling circles) in practice. Pooled
    per-slot with both a sprite and a fallback-Graphics child so a slot
    can serve either kind across its lifetime without recreating objects.

**All three reverted heroes (Gojo, Sauda, Geto) are now ported.** None of
it has been seen in a browser by anyone other than the owner's two bug
reports earlier this round (shadow rotation, tower scale) — both real
findings that reading code alone had missed on prior passes. That pattern
held up consistently enough this session that it's worth stating plainly:
the fastest way to find what's actually wrong with any of tonight's work
is still to run it, not to re-read it.

### Round: boss screen-split, the one flagged as needing an architecture change
Same session, kept going into the item MIGRATION.md had explicitly called
out as different in kind from everything else on the gap list.

**Why this one couldn't be a per-entity port like the others.** The
original doesn't draw the split effect per-object — it renders the *entire
game world* to an offscreen canvas (`_worldCanvas` in `renderer.js`) every
frame, then in one final compositing step either draws that whole canvas
straight, or slices it into top/bottom halves and draws each half at a
horizontal offset (the screen-tear attack). There's no way to reproduce
"slice this already-rendered image in half and offset each half" by
changing what any individual tower/enemy/effect draws — the thing being
split has to exist as a renderable image first.

**What changed:**
- **`pixiApp.js`** — the 11 world-space layers (`background` through
  `overlay`) now live under a `worldContainer` instead of being direct
  children of `app.stage`. Added a 1280×720 `RenderTexture`
  (`worldTexture`), a `compositeLayer` (shows that texture, split or not),
  and a `screenUI` layer (boss health bar, warning line, cursor, dev
  overlay — the four things the original draws straight to the final
  canvas *after* the split step, so they never get torn in half
  themselves). `compositeLayer` and `screenUI` are the only things left
  directly on `app.stage`.
- **Switched off Pixi's own ticker** (`autoStart: false`, plus an explicit
  `app.ticker.stop()`). This is the part most likely to matter if
  something looks wrong: capturing the world to a texture and then
  compositing that texture both have to happen in a fixed order every
  frame, strictly after all the entity-drawing code above them has run.
  Pixi's independent auto-ticker gave no such guarantee — it renders on
  its own schedule, racing against the game's own render call however
  browser rAF happened to interleave them that frame. `pixiRenderer.js`
  now does one explicit `app.renderer.render(app.stage)` itself, as the
  literal last line of the frame, inside the new `_compositeWorld`
  method — same single-synchronous-call shape the original Canvas2D
  renderer already had.
- **`renderUI.js`** — added `_compositeWorld`, which does the
  world→texture render pass, then picks full/warning/split exactly like
  `renderer.js` lines ~85-126 (warning line wins over split, matching the
  original's if/else-if order, not just "whichever is checked first"). Also
  moved `_drawBossHealthBar`/`_drawBossWarningLine`/`_drawCursor`/
  `_drawDevOverlay` from the `overlay` layer to the new `screenUI` layer —
  they were sharing a layer with genuinely world-space content
  (floating text, placement preview, selection, leak-flash) before this,
  which hadn't caused a visible bug yet only because nothing was splitting
  anything yet. Left alone: everything else already in `overlay`.

**Explicitly not touched:** camera pan (`CutsceneManager.cameraOffsetX`).
The original applies that as a translate before drawing into
`_worldCanvas`; since `CutsceneManager` itself still isn't ported at all
(see below), there's nothing to pan yet. When it is, that offset belongs
on `worldContainer.x` before the render-to-texture call in
`_compositeWorld` — not folded into this round's work now.

**Still unported: `CutsceneManager`** (camera-pan + the cutscene balls/
punch-hole particle effect + dialogue), main-menu scenery, hitbox-debug
styling parity. Of everything left on the original gap list, `CutsceneManager`
is now the only piece flagged as hard; screen-split and all three heroes
are done.

This round is a bigger structural bet than anything else in this file —
a change to how frames get rendered at all, not just what's drawn. Please
test this before building anything else on top of it.

### Round: CutsceneManager — the last item on the original gap list
Owner explicitly chose to keep going past the screen-split architecture
change rather than pause to test it first, after being asked directly.
Noting that here so it's clear this was a deliberate call, not this
session skipping its own advice.

**Why this needed more infrastructure than a per-entity port, again.**
Two things about the original that don't fit the "draw this tower/enemy"
pattern everything else in this file follows:
- The ball swarm and the knight/slash/rip visuals are split by the
  original into two different exemption categories relative to the boss
  screen-split composite added last round — balls are split-affected but
  NOT camera-pan-affected; the knight/slash/rip are camera-pan-affected
  but NOT split-affected. Neither fits inside the existing `worldContainer`
  (split+pan together) or `screenUI` (neither) from last round.
- The silhouette-rip effect needs an actual render-to-texture-then-recolor
  step, not just vector drawing — same category of problem as the
  screen-split itself.

**What changed:**
- **`pixiApp.js`** — `worldContainer` split into `pannedContainer` (the 11
  existing layers, moves with `CutsceneManager.cameraOffsetX`) plus two
  pan-immune-but-still-split-affected siblings: `revealBar` (the black
  strip exposed on the left edge when the camera pans, matching the
  original's conditional fillRect) and a new `cutsceneBalls` layer. Also
  added `cutsceneLayer`, a new top-level `app.stage` child between
  `compositeLayer` and `screenUI` — pan-affected but split-immune, for the
  knight/slash/rip visuals (`CutsceneManager.draw()`'s equivalent).
- **New file `renderCutscene.js`** — `_drawCutsceneBalls`,
  `_drawCutscene`, `_drawCutsceneRevealBar`. The ball swarm
  ("~2000-particle punch-hole effect" per the old gap-list description)
  turned out simpler in Pixi than the original: Canvas2D has no per-shape
  stroke alignment, so the original fakes a ring outline with a second
  offscreen canvas and a fill-then-destination-out-cut trick; Pixi's
  `stroke({ alignment: 0 })` does the same "inward ring" directly, one
  Graphics, one pass, no second canvas needed.
- **The silhouette-rip** (states `slashing`/`waiting_to_rip`/`ripping`) —
  the piece MIGRATION.md had flagged hardest of everything left. The
  original renders the target boss to an offscreen canvas, then uses
  `globalCompositeOperation='source-in'` + a white fillRect to recolor
  every non-transparent pixel white while preserving its exact alpha
  shape. Ported using `ColorMatrixFilter` with a matrix whose R/G/B rows
  are `[0,0,0,0,1]` (ignore input color, always output white) and alpha
  row `[0,0,0,1,0]` (pass alpha through) — the GPU equivalent of the same
  trick, applied once to a `RenderTexture` capture of just the target's
  base sprite. The two falling-apart halves during `ripping` are two
  rotated Containers, each holding a copy of that same texture positioned
  so the target's own world position lands at the container's local
  origin, masked to a 200×400 strip either side of center — direct
  translation of the original's nested `ctx.translate`/`ctx.rotate`/
  `ctx.rect`/`ctx.clip` calls into Pixi transforms + a mask Graphics.
- **Known simplification**: the silhouette only captures the target's
  base body sprite, not its blade overlay or hp-bar/status effects (see
  `enemyRenderer.js`'s `_drawBlades`, called separately in the original).
  The rip lasts under a second and it's the overall shape that sells the
  beat, not per-pixel parity, so this was judged not worth a second
  capture pass — worth a look if it reads wrong in practice.
- **`renderEnemies.js`** — one small but necessary fix: `KnightEnemy` uses
  `tier = 99` and a direct `.sprite` string property instead of fitting
  the tier-indexed `ENEMY_NAMES` lookup every other enemy uses. Without an
  explicit skip, the generic enemy renderer would try to look up
  `ENEMY_NAMES[99]` (out of range), draw nothing useful for the tier-99
  entry it just created a pool slot for, and then `renderCutscene.js`'s
  own dedicated knight sprite would draw on top of that broken slot rather
  than replacing it. Added `if (enemy.tier === 99) continue;` with a
  comment pointing at where it's actually handled instead.

**Everything on the original gap list is now either done or explicitly
out of scope** (main-menu scenery, hitbox-debug exact styling, dev
overlay — all low-priority per the original list, never picked up this
session). Gojo, Sauda, Geto, boss screen-split, and CutsceneManager — the
five items that mattered — are all implemented now.

**None of this has run in a browser.** Three sessions' worth of work
happened back-to-back on the strength of "the code reads as correct
against the original," the exact pattern this file has warned about
since its very first entry. The owner's two bug reports earlier tonight
(shadow rotation, tower scale) were both real and both invisible to
reading alone. There is meaningfully more surface area for that same
thing to have happened again here — a full render-loop change plus five
substantial features in one sitting — and meaningfully less of this
session's own attention left to have caught it. Test before extending
further.

### Round: the main menu wasn't rendering at all
Owner reported this directly rather than it surfacing from a browser
test — worth noting since it means it's still unverified, just now
written.

**What was actually missing.** MIGRATION.md's gap list had "main-menu
scenery" filed as low-priority decoration. That undersold it:
`pixiRenderer.js` had no branch at all for `engine.gameState === 'menu'`,
so the full gameplay pipeline — which assumes `engine.map` exists — ran
unconditionally every frame, menu included. Nothing crashed (`_safeDraw`
guards each call), but nothing resembling the actual menu rendered
either. This wasn't a missing decoration, it was a missing early return.

**What changed:**
- **New file `renderMenu.js`** — ports `_drawMainMenuScenery` (real-world
  time-of-day sky gradient, stars, sun/moon, drifting clouds, hills, a
  bouncing bloon mascot, two trees, falling darts). All pure vector
  Canvas2D drawing in the original — no sprites, no blend modes — so this
  was a plain Graphics port, simpler than most of tonight's work.
- **`pixiApp.js`** — added `menuLayer`, a top-level `app.stage` child
  alongside `compositeLayer`/`cutsceneLayer`/`screenUI`.
- **`pixiRenderer.js`** — added the actual missing branch: when
  `engine.gameState === 'menu' || !engine.map`, show only `menuLayer` +
  dev overlay (matching the original's early return exactly, right down
  to which two calls it makes), hide `compositeLayer`/`cutsceneLayer`,
  and skip the entire gameplay pipeline below. Also calls
  `_drawCursor`/`_drawBossHealthBar`/`_drawBossWarningLine` in this
  branch too even though the original doesn't — those three already
  self-clear/self-gate on `screenUI` (see renderUI.js), so calling them
  here is free insurance against stale graphics surviving from a previous
  play session showing through under the menu, not a behavior change.

**Caught something worth flagging for anything written after this**:
while writing this file's sky gradient (the first *linear* gradient
anywhere in this migration — everywhere else has been radial), checked
Pixi's `FillGradient` source directly rather than assuming the
`textureSpace: 'local'` pattern already used for every radial gradient
this session would carry over unchanged. It wouldn't have — for a linear
gradient, local-space start/end are normalized 0-1 across the shape's own
bounding box, not the absolute pixel coordinates every radial gradient
call this session used. Switched this one gradient to
`textureSpace: 'global'` (literal world-space pixels, unambiguous)
instead of working out the local-space transform math by hand.
Worth stating plainly since it's good news, not just a caveat: this also
means every earlier radial gradient (Gojo's blobs, Sauda's aftersword,
Geto's blast/spirits/squids, the pre-existing night-glow effect) *is*
correct as written — center and outerCenter being equal in all of them
makes the local-space transform self-normalize regardless of the
absolute radius passed in, which isn't true in general and doesn't
extend to linear gradients or to radial gradients with differing
center/outerCenter, so this isn't a rule of thumb to carry forward
without re-deriving it for whatever the next shape actually is.

</details>
