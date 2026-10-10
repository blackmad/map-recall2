// Usage: node scripts/landmarks/big-contact.mjs <outPng> <img1> <img2> ... : tiles every image at 450 px height, left to right.
import sharp from 'sharp';
import fs from 'node:fs';
const [out, ...files] = process.argv.slice(2);
const H = 450, tiles = [];
for (const f of files) {
  const buf = fs.existsSync(f) ? await sharp(f).resize({height: H}).png().toBuffer() : await sharp({create: {width: 400, height: H, channels: 3, background: '#ccc'}}).png().toBuffer();
  tiles.push({buf, w: (await sharp(buf).metadata()).width});
}
let x = 0;
const comp = tiles.map(t => { const c = {input: t.buf, left: x, top: 0}; x += t.w; return c; });
await sharp({create: {width: x, height: H, channels: 3, background: '#fff'}}).composite(comp).png().toFile(out);
console.log(out, x, H);
