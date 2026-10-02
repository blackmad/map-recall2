// Contact sheets of storefront references: 16 per sheet, each labelled with its index and slug,
// a red tick where the POI pin falls along the wall, and a scale bar in metres.
//   node scripts/storefronts/contact-sheet.mjs tmp/storefronts/refs tmp/storefronts/sheets [startIndex]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const [dir, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const slugs = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
const W = 360, H = 260, PER = 16, COLS = 4;
for (let s = 0; s * PER < slugs.length; s++) {
  const tiles = [];
  for (const [k, slug] of slugs.slice(s * PER, (s + 1) * PER).entries()) {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, `${slug}.json`), 'utf8'));
    const img = sharp(path.join(dir, meta.image)).resize(W, H - 30, { fit: 'contain', background: '#222' });
    const scale = Math.min(W / meta.width, (H - 30) / meta.height), ox = (W - meta.width * scale) / 2;
    const tick = meta.nearAlongM != null ? ox + meta.nearAlongM * meta.pixelsPerMetre * scale : null;
    const label = `${s * PER + k} ${slug}`.slice(0, 44).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const svg = Buffer.from(`<svg width="${W}" height="${H}"><rect y="${H - 30}" width="${W}" height="30" fill="#111"/><text x="6" y="${H - 10}" font-size="15" fill="#fff" font-family="sans-serif">${label}</text>${tick != null ? `<rect x="${tick - 1}" y="0" width="3" height="${H - 30}" fill="#ff2a2a" opacity="0.8"/>` : ''}<text x="${W - 70}" y="${H - 10}" font-size="12" fill="#bbb" font-family="sans-serif">${meta.wall.lengthM.toFixed(1)} m</text></svg>`);
    const tile = await sharp({ create: { width: W, height: H, channels: 3, background: '#222' } }).composite([{ input: await img.toBuffer(), top: 0, left: 0 }, { input: svg, top: 0, left: 0 }]).png().toBuffer();
    tiles.push({ input: tile, top: Math.floor(k / COLS) * H, left: (k % COLS) * W });
  }
  const rows = Math.ceil(tiles.length / COLS);
  await sharp({ create: { width: COLS * W, height: rows * H, channels: 3, background: '#000' } }).composite(tiles).jpeg({ quality: 82 }).toFile(path.join(outDir, `sheet-${String(s).padStart(2, '0')}.jpg`));
}
console.log(`${Math.ceil(slugs.length / PER)} sheets for ${slugs.length} references`);
