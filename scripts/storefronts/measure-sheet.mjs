// Reading sheet for writing storefront specs: each reference crop at 2x with a metre ruler,
// the pin, and the wall length, so bay widths can be read off in metres.
//   node scripts/storefronts/measure-sheet.mjs <out.jpg> slug...
import fs from 'node:fs';
import sharp from 'sharp';
const [out, ...slugs] = process.argv.slice(2);
const S = 2, tiles = [];
for (const slug of slugs) {
  const meta = JSON.parse(fs.readFileSync(`tmp/storefronts/refs/${slug}.json`, 'utf8'));
  const w = meta.width * S, h = meta.height * S, ppm = meta.pixelsPerMetre * S, rh = 40;
  let svg = `<svg width="${w}" height="${h + rh}"><rect y="${h}" width="${w}" height="${rh}" fill="#111"/>`;
  for (let m = 0; m <= meta.wall.lengthM + 1e-6; m += 0.5) { const x = m * ppm, major = Math.abs(m - Math.round(m)) < 1e-6; svg += `<rect x="${x - 0.5}" y="${h}" width="1" height="${major ? 12 : 6}" fill="#fff"/>` + (major ? `<text x="${x + 2}" y="${h + 22}" font-size="12" fill="#fff" font-family="sans-serif">${m}</text>` : ''); }
  for (let z = 1; z * ppm < h; z++) svg += `<rect x="0" y="${h - z * ppm}" width="8" height="1" fill="#0ff"/><text x="10" y="${h - z * ppm + 4}" font-size="11" fill="#0ff" font-family="sans-serif">${z}</text>`;
  if (meta.nearAlongM != null) svg += `<rect x="${meta.nearAlongM * ppm - 1}" y="0" width="2" height="${h}" fill="#ff2a2a" opacity="0.7"/>`;
  svg += `<text x="6" y="${h + 36}" font-size="13" fill="#ff0" font-family="sans-serif">${slug}  (${meta.wall.lengthM.toFixed(1)} m)</text></svg>`;
  const img = await sharp(`tmp/storefronts/refs/${meta.image}`).resize(w, h).toBuffer();
  tiles.push(await sharp({ create: { width: w, height: h + rh, channels: 3, background: '#000' } }).composite([{ input: img, top: 0, left: 0 }, { input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer());
}
// Stack vertically, each tile left-aligned.
const metas = await Promise.all(tiles.map(t => sharp(t).metadata()));
const W = Math.max(...metas.map(m => m.width)), H = metas.reduce((s, m) => s + m.height + 6, 0);
let y = 0; const comps = tiles.map((t, i) => { const c = { input: t, top: y, left: 0 }; y += metas[i].height + 6; return c; });
await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 85 }).toFile(out);
console.log(out, W, H);
