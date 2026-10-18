// tools/gen-map-thumbs.mjs
// Writes a small WebP thumbnail for every day-time map background in
// public/sprites/maps/ into public/sprites/maps/thumbs/. The map select menu
// shows these instead of the multi-megabyte full-size backgrounds.
// Run after adding or changing a map image:   npm run gen:thumbs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const dir = path.dirname(fileURLToPath(import.meta.url));
const MAPS = path.join(dir, '..', 'public', 'sprites', 'maps');
const OUT = path.join(MAPS, 'thumbs');
const W = 480, H = 270;

fs.mkdirSync(OUT, { recursive: true });
const files = fs.readdirSync(MAPS).filter(f => /\.png$/i.test(f) && !/_night\.png$/i.test(f));

let total = 0;
for (const file of files) {
    const name = file.replace(/\.png$/i, '');
    const dest = path.join(OUT, `${name}.webp`);
    await sharp(path.join(MAPS, file))
        .resize(W, H, { fit: 'cover', position: 'centre' })
        .webp({ quality: 78 })
        .toFile(dest);
    const kb = Math.round(fs.statSync(dest).size / 1024);
    total += kb;
    console.log(`${name}.webp  ${kb} KB`);
}
console.log(`\n${files.length} thumbnails, ${total} KB total -> ${path.relative(process.cwd(), OUT)}`);
