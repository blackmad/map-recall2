// Usage: node scripts/landmarks/contact-sheet.mjs <out.png> <file> [<file> ...]
// Generic contact sheet: every tile resized to 450 px tall, left to right; a missing file leaves a grey tile.
// Typical order: reference photo(s) | model front at street height | 3/4 | rear | in-game shot.
import sharp from 'sharp';
import fs from 'node:fs';
const [out, ...files] = process.argv.slice(2);
const H = 450;
const tiles = [];
for (const f of files) {
  const buf = fs.existsSync(f) ? await sharp(f).resize({height: H}).png().toBuffer()
    : await sharp({create: {width: 600, height: H, channels: 3, background: '#ccc'}}).png().toBuffer();
  tiles.push({buf, w: (await sharp(buf).metadata()).width});
}
let x = 0;
const comp = tiles.map(t => { const c = {input: t.buf, left: x, top: 0}; x += t.w; return c; });
await sharp({create: {width: x, height: H, channels: 3, background: '#fff'}}).composite(comp).png().toFile(out);
console.log(out, x, H);
