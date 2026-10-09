// Usage: node scripts/landmarks/worship-contact.mjs <dir> <id> <frontAz> <threeQuarterAz>
// Builds <dir>/contact.png = reference | model front | model 3/4 | in game (each 450px tall).
import sharp from 'sharp';
import fs from 'node:fs';
const [d, id, a1, a2] = process.argv.slice(2);
const H = 450;
const files = [`${d}/ref.jpg`, `${d}/${id}-az${a1}.png`, `${d}/${id}-az${a2}.png`, `${d}/game.png`];
const tiles = [];
for (const f of files) {
  const buf = fs.existsSync(f) ? await sharp(f).resize({height: H}).png().toBuffer()
    : await sharp({create: {width: 600, height: H, channels: 3, background: '#ccc'}}).png().toBuffer();
  tiles.push({buf, w: (await sharp(buf).metadata()).width});
}
let x = 0;
const comp = tiles.map(t => { const c = {input: t.buf, left: x, top: 0}; x += t.w; return c; });
await sharp({create: {width: x, height: H, channels: 3, background: '#fff'}}).composite(comp).png().toFile(`${d}/contact.png`);
console.log(x, H);
