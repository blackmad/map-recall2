// Before/after sheet for the period-walls strip: per place, the real street (panorama), chase off/on, aerial off/on.
//   node scripts/look/period-walls-sheet.mjs [dir=artifacts/period-walls/strip] -> <dir>/sheet.jpg
import sharp from 'sharp';
import { existsSync } from 'node:fs';
const dir = process.argv[2] || 'artifacts/period-walls/strip';
const places = ['nassaukade', 'bloemgracht', 'pijp-govert-flinck', 'zuid-verhulst', 'nieuwwest-deyssel'];
const W = 480, H = 300, LABEL = 26, cols = ['pano', 'chase off', 'chase ON', 'aerial off', 'aerial ON', 'row pano', 'row off', 'row ON'];
const file = (p, c) => c === 'row pano' ? `${dir}/pano/${p}-row.jpg` : c === 'pano' ? `${dir}/pano/${p}.jpg` : `${dir}/${c.endsWith('ON') ? 'on' : 'off'}/${p}-${c.split(' ')[0]}.png`;
const label = t => Buffer.from(`<svg width="${W}" height="${LABEL}"><rect width="100%" height="100%" fill="#111"/><text x="8" y="18" font-family="Helvetica" font-size="15" fill="#fff">${t}</text></svg>`);
const tiles = [];
for (const [r, p] of places.entries()) for (const [c, col] of cols.entries()) {
  const f = file(p, col);
  if (!existsSync(f)) continue;
  tiles.push({ input: await sharp(f).resize(W, H, { fit: 'cover' }).toBuffer(), left: c * W, top: r * (H + LABEL) + LABEL });
  tiles.push({ input: label(`${p} — ${col.includes('pano') ? `real ${col === 'pano' ? 'street' : 'row'} (data.amsterdam.nl panorama, CC BY 4.0)` : col}`), left: c * W, top: r * (H + LABEL) });
}
await sharp({ create: { width: W * cols.length, height: places.length * (H + LABEL), channels: 3, background: '#000' } }).composite(tiles).jpeg({ quality: 86 }).toFile(`${dir}/sheet.jpg`);
console.log(`${dir}/sheet.jpg`);
