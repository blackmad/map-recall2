// One sheet per place for look comparisons: frames side by side, a luma table under each column (mean Rec. 709
// luma of sRGB 0–255 over the whole frame and over named pixel rectangles), JPEG kept under a size budget.
//   node scripts/ground-look-sheet.mjs <out.jpg> [--width=2800] [--title=...] [--json=<out.json>] [--max-kb=400]
//        --region=<name>:x0,y0,x1,y1 ...  <label>=<png> ...
import sharp from 'sharp';
import fs from 'node:fs';

const args = process.argv.slice(2);
const out = args.shift();
const opt = k => args.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const width = Number(opt('width') || 2800), title = opt('title') || '', maxKb = Number(opt('max-kb') || 400);
const regions = args.filter(a => a.startsWith('--region=')).map(a => { const [name, r] = a.slice(9).split(':'); return { name, rect: r.split(',').map(Number) }; });
const panels = args.filter(a => !a.startsWith('--')).map(a => { const i = a.indexOf('='); return { label: a.slice(0, i), file: a.slice(i + 1) }; });
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function lumas(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const mean = ([x0, y0, x1, y1]) => { let s = 0, n = 0; for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) { const i = (y * W + x) * 3; s += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; n++; } return n ? Math.round(s / n) : null; };
  return { scene: mean([0, 0, W, H]), ...Object.fromEntries(regions.map(r => [r.name, mean(r.rect)])) };
}

const each = Math.floor(width / panels.length), head = title ? 44 : 0, rowH = 26, tableH = 14 + rowH * (1 + regions.length);
const bufs = [], table = {};
let h = 0;
for (const p of panels) {
  const L = await lumas(p.file);
  table[p.label] = L;
  // Region outlines on the frame (thin), so a reader sees what each number covers.
  const meta = await sharp(p.file).metadata();
  const outline = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}">${regions.map(r => `<rect x="${r.rect[0]}" y="${r.rect[1]}" width="${r.rect[2] - r.rect[0]}" height="${r.rect[3] - r.rect[1]}" fill="none" stroke="#ff00ff" stroke-width="2"/>`).join('')}</svg>`);
  const framed = await sharp(p.file).composite([{ input: outline }]).png().toBuffer();
  const b = await sharp(framed).resize({ width: each }).png().toBuffer();
  const m = await sharp(b).metadata();
  h = Math.max(h, m.height);
  const label = Buffer.from(`<svg width="${each}" height="34"><rect width="100%" height="34" fill="rgba(0,0,0,0.65)"/><text x="10" y="24" font-family="Helvetica, Arial" font-size="20" font-weight="bold" fill="#fff">${esc(p.label)}</text></svg>`);
  bufs.push(await sharp(b).composite([{ input: label, top: 0, left: 0 }]).png().toBuffer());
}
const rows = ['scene', ...regions.map(r => r.name)];
const tables = panels.map(p => Buffer.from(`<svg width="${each}" height="${tableH}"><rect width="100%" height="100%" fill="#f6f3ec"/>${rows.map((r, i) => `<text x="16" y="${30 + i * rowH}" font-family="Helvetica, Arial" font-size="18" fill="#3b352c">${esc(r)}</text><text x="${each - 16}" y="${30 + i * rowH}" text-anchor="end" font-family="Helvetica, Arial" font-size="18" font-weight="bold" fill="#1f1c17">${table[p.label][r] ?? '–'}</text>`).join('')}<line x1="${each - 1}" y1="0" x2="${each - 1}" y2="${tableH}" stroke="#d8d0c0"/></svg>`));
const titleSvg = title ? [{ input: Buffer.from(`<svg width="${each * panels.length}" height="${head}"><rect width="100%" height="100%" fill="#1f1c17"/><text x="14" y="30" font-family="Helvetica, Arial" font-size="22" fill="#fbf8f2">${esc(title)}</text></svg>`), left: 0, top: 0 }] : [];
const composite = [...titleSvg, ...bufs.map((input, i) => ({ input, left: i * each, top: head })), ...tables.map((input, i) => ({ input, left: i * each, top: head + h }))];
let q = 82, size = Infinity;
while (q >= 40) {
  await sharp({ create: { width: each * panels.length, height: head + h + tableH, channels: 3, background: '#000' } }).composite(composite).jpeg({ quality: q, mozjpeg: true }).toFile(out);
  size = fs.statSync(out).size;
  if (size <= maxKb * 1024) break;
  q -= 6;
}
if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify({ regions, luma: table }, null, 1));
console.log(out, `${(size / 1024).toFixed(0)} KB q${q}`, JSON.stringify(table));
