// Usage: node scripts/landmarks/discovery-f-contact.mjs <dir> <out.png> <label=file> ...
// Lays the given images side by side at 420 px tall (reference | model views) with a caption strip.
import sharp from 'sharp';
const [dir, out, ...items] = process.argv.slice(2);
const H = 420;
const tiles = [];
for (const item of items) {
  const [label, file] = item.split('=');
  const buf = await sharp(`${dir}/${file}`).resize({height: H}).png().toBuffer();
  tiles.push({label, buf, w: (await sharp(buf).metadata()).width});
}
const total = tiles.reduce((s, t) => s + t.w, 0);
let x = 0;
const comp = [];
const caps = [];
for (const t of tiles) {
  comp.push({input: t.buf, left: x, top: 22});
  caps.push(`<text x="${x + 6}" y="15" font-family="sans-serif" font-size="13" fill="#222">${t.label}</text>`);
  x += t.w;
}
comp.push({input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="22">${caps.join('')}</svg>`), left: 0, top: 0});
await sharp({create: {width: total, height: H + 22, channels: 3, background: '#fff'}}).composite(comp).png().toFile(out);
console.log(total, H + 22);
