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
  // Likely building edges: full-height colour breaks in the upper floors (above 4 m), where shops
  // don't interfere. An edge well inside the crop means the panorama is misregistered: set `shift`.
  {
    const { data, info } = await sharp(`tmp/storefronts/refs/${meta.image}`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const W0 = info.width, rows = Math.max(4, Math.floor(info.height - 4 * meta.pixelsPerMetre)), col = [];
    for (let x = 0; x < W0; x++) { let r = 0, g = 0, b = 0; for (let y = 0; y < rows; y++) { const i = (y * W0 + x) * 3; r += data[i]; g += data[i + 1]; b += data[i + 2]; } col.push([r / rows, g / rows, b / rows]); }
    const k = Math.max(3, Math.round(0.3 * meta.pixelsPerMetre)), score = col.map((_, x) => {
      if (x < k || x >= W0 - k) return 0;
      let d = 0; for (let c = 0; c < 3; c++) { let l = 0, r = 0; for (let j = 1; j <= k; j++) { l += col[x - j][c]; r += col[x + j - 1][c]; } d += Math.abs(l - r) / k; }
      return d;
    });
    const sorted = [...score].sort((p, q) => p - q), med = sorted[sorted.length >> 1] || 1;
    for (let x = k; x < W0 - k; x++) {
      const m = x / meta.pixelsPerMetre;
      if (score[x] > Math.max(40, med * 3) && score[x] === Math.max(...score.slice(Math.max(0, x - k), x + k)) && m > 0.3 && m < meta.wall.lengthM - 0.3)
        svg += `<rect x="${x * S - 1}" y="0" width="2" height="${h}" fill="#ffd400" opacity="0.55" stroke-dasharray="6 6"/><text x="${x * S + 3}" y="14" font-size="12" fill="#ffd400" font-family="sans-serif">${m.toFixed(1)}</text>`;
    }
  }
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
