// Labelled contact sheet of ride-review frames (JPEG, kept under MAX_KB by lowering quality).
//   node scripts/ride-review/contact.mjs <out.jpg> [--cols=4] [--width=400] [--max-kb=400] <label>=<png> ...
import sharp from 'sharp';
import fs from 'node:fs';

const args = process.argv.slice(2);
const out = args.shift();
const opt = (k, d) => Number(args.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d);
const cols = opt('cols', 4), each = opt('width', 400), maxKb = opt('max-kb', 400);
const panels = args.filter(a => !a.startsWith('--')).map(a => { const i = a.indexOf('='); return { label: a.slice(0, i), file: a.slice(i + 1) }; });
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const tiles = [];
let h = 0;
for (const p of panels) {
  const b = await sharp(p.file).resize({ width: each }).png().toBuffer();
  const m = await sharp(b).metadata();
  h = Math.max(h, m.height);
  const svg = Buffer.from(`<svg width="${each}" height="22"><rect width="100%" height="22" fill="rgba(0,0,0,0.7)"/><text x="6" y="16" font-family="Helvetica, Arial" font-size="13" fill="#fff">${esc(p.label)}</text></svg>`);
  tiles.push(await sharp(b).composite([{ input: svg, top: 0, left: 0 }]).png().toBuffer());
}
const rows = Math.ceil(tiles.length / cols);
const base = sharp({ create: { width: each * cols, height: h * rows, channels: 3, background: '#111' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % cols) * each, top: Math.floor(i / cols) * h })));
const png = await base.png().toBuffer();
for (let q = 82; q >= 40; q -= 6) {
  await sharp(png).jpeg({ quality: q, mozjpeg: true }).toFile(out);
  if (fs.statSync(out).size <= maxKb * 1024) break;
}
console.log(out, `${(fs.statSync(out).size / 1024).toFixed(0)} KB`, `${tiles.length} frames`);
