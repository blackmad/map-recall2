// Before/after sheet for the period-walls strip: per place, the real street (panorama), then the chase (and
// Nassaukade's row) frame flag off, the first measured palette (#46) and the sunlit one (#50), then the aerials.
//   node scripts/look/period-walls-sheet.mjs [dir=artifacts/period-walls/strip] -> <dir>/sheet.jpg
// <dir>/off, <dir>/on-old and <dir>/on hold the frames; <dir>/luma.json (period-walls-luma.ts) labels the walls' luma.
import sharp from 'sharp';
import { existsSync, readFileSync } from 'node:fs';
const dir = process.argv[2] || 'artifacts/period-walls/strip';
const luma = existsSync(`${dir}/luma.json`) ? JSON.parse(readFileSync(`${dir}/luma.json`, 'utf8')) : {};
const places = ['nassaukade', 'bloemgracht', 'pijp-govert-flinck', 'zuid-verhulst', 'nieuwwest-deyssel'];
const W = 480, H = 300, LABEL = 26;
const cols = [['pano', 'real street'], ['off:chase', 'flag off'], ['on-old:chase', 'measured #46'], ['on:chase', 'measured + sunlit #50'], ['off:aerial', 'aerial off'], ['on:aerial', 'aerial #50']];
const rowCols = [['rowpano', 'real row'], ['off:row', 'row off'], ['on-old:row', 'row #46'], ['on:row', 'row #50']];
const file = (p, c) => c === 'pano' ? `${dir}/pano/${p}.jpg` : c === 'rowpano' ? `${dir}/pano/${p}-row.jpg` : `${dir}/${c.split(':')[0]}/${p}-${c.split(':')[1]}.png`;
const lumaOf = (p, c) => { const k = c === 'pano' ? 'pano' : c.split(':')[0]; const v = luma[p]?.[k]; return v && !c.endsWith('aerial') ? ` · wall luma ${Math.round(v.luma)}` : ''; };
const label = t => Buffer.from(`<svg width="${W}" height="${LABEL}"><rect width="100%" height="100%" fill="#111"/><text x="8" y="18" font-family="Helvetica" font-size="15" fill="#fff">${t}</text></svg>`);
const rows = [...places.map(p => [p, cols]), ['nassaukade', rowCols]];
const tiles = [];
for (const [r, [p, cs]] of rows.entries()) for (const [c, [col, name]] of cs.entries()) {
  const f = file(p, col);
  if (!existsSync(f)) continue;
  tiles.push({ input: await sharp(f).resize(W, H, { fit: 'cover' }).toBuffer(), left: c * W, top: r * (H + LABEL) + LABEL });
  tiles.push({ input: label(`${p} — ${name}${col.includes('row') ? '' : lumaOf(p, col)}`), left: c * W, top: r * (H + LABEL) });
}
await sharp({ create: { width: W * cols.length, height: rows.length * (H + LABEL), channels: 3, background: '#000' } }).composite(tiles).jpeg({ quality: 86 }).toFile(`${dir}/sheet.jpg`);
console.log(`${dir}/sheet.jpg`);
