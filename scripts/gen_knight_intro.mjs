// scripts/gen_knight_intro.mjs
//
// Regenerates download/knight-intro.json from buildVanillaIntroDoc() — the
// exact same doc the editor's "Import vanilla" button produces, so importing
// this file and clicking the button are bit-identical.
//
// Doc semantics (post parity-fix):
//   - knight scale 1.0 = the entity renderer's own draw size
//     (native frame size × KNIGHT_SCALE 1.65) — exactly what the game shows.
//   - knight mirror:true authors the game's unconditional body flip so it is
//     visible/editable per keyframe in the editor timeline.
//
// Run: node scripts/gen_knight_intro.mjs   (from the btd_repo root)
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildVanillaIntroDoc } from '../js/cutsceneRuntime.js';

const doc = buildVanillaIntroDoc();
mkdirSync(new URL('../../download/', import.meta.url), { recursive: true });
writeFileSync(new URL('../../download/knight-intro.json', import.meta.url), JSON.stringify(doc, null, 2) + '\n');
console.log(`wrote ../../download/knight-intro.json — "${doc.name}", ${doc.duration}s, ${doc.actors.length} actors`);
