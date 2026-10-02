// Contact sheet of alternate-wall crops (refs-alt/<slug>-w<N>.jpg), 12 per sheet, for picking the real front.
//   node scripts/storefronts/alt-sheet.mjs tmp/storefronts/refs-alt out-prefix
import fs from 'node:fs';
import sharp from 'sharp';
const [dir, prefix] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).filter(s => JSON.parse(fs.readFileSync(`${dir}/${s}.json`, 'utf8')).width > 20).sort();
const W = 480, H = 300, PER = 12, COLS = 3;
for (let s = 0; s * PER < files.length; s++) {
  const tiles = [];
  for (const [k, name] of files.slice(s * PER, (s + 1) * PER).entries()) {
    const m = JSON.parse(fs.readFileSync(`${dir}/${name}.json`, 'utf8'));
    const img = await sharp(`${dir}/${m.image}`).resize(W, H - 26, { fit: 'contain', background: '#222' }).toBuffer();
    const svg = Buffer.from(`<svg width="${W}" height="${H}"><rect y="${H - 26}" width="${W}" height="26" fill="#111"/><text x="6" y="${H - 8}" font-size="14" fill="#fff" font-family="sans-serif">${name} (${m.wall.lengthM.toFixed(1)} m)</text></svg>`);
    tiles.push({ input: await sharp({ create: { width: W, height: H, channels: 3, background: '#222' } }).composite([{ input: img, top: 0, left: 0 }, { input: svg, top: 0, left: 0 }]).png().toBuffer(), top: Math.floor(k / COLS) * H, left: (k % COLS) * W });
  }
  await sharp({ create: { width: COLS * W, height: Math.ceil(tiles.length / COLS) * H, channels: 3, background: '#000' } }).composite(tiles).jpeg({ quality: 80 }).toFile(`${prefix}-${String(s).padStart(2, '0')}.jpg`);
}
console.log(files.length, 'alt walls');
