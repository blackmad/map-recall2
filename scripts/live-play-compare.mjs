// Side-by-side before/after sheet for live-play reports (under ~300 KB as JPEG).
//   node scripts/live-play-compare.mjs <out.jpg> [--crop=x,y,w,h] [--width=1600] <label>=<png> <label>=<png> ...
import sharp from 'sharp';

const args = process.argv.slice(2);
const out = args.shift();
const opt = k => args.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const crop = opt('crop')?.split(',').map(Number);
const width = Number(opt('width') || 1600);
const panels = args.filter(a => !a.startsWith('--')).map(a => { const i = a.indexOf('='); return { label: a.slice(0, i), file: a.slice(i + 1) }; });
const each = Math.floor(width / panels.length);
const bufs = [];
let h = 0;
for (const p of panels) {
  let img = sharp(p.file);
  if (crop) img = img.extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] });
  const b = await img.resize({ width: each }).png().toBuffer();
  const m = await sharp(b).metadata();
  h = Math.max(h, m.height);
  const svg = Buffer.from(`<svg width="${each}" height="34"><rect width="100%" height="34" fill="rgba(0,0,0,0.6)"/><text x="10" y="23" font-family="Helvetica, Arial" font-size="18" fill="#fff">${p.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
  bufs.push(await sharp(b).composite([{ input: svg, top: 0, left: 0 }]).png().toBuffer());
}
await sharp({ create: { width: each * panels.length, height: h, channels: 3, background: '#000' } })
  .composite(bufs.map((input, i) => ({ input, left: i * each, top: 0 })))
  .jpeg({ quality: 80, mozjpeg: true }).toFile(out);
const { size } = await import('node:fs').then(fs => fs.statSync(out));
console.log(out, `${(size / 1024).toFixed(0)} KB`);
