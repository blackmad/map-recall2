/**
 * Side-by-side crops for reading the survey: `--bags=<6- or 16-digit>,...` -> staging/canal-windows/montage-<name>.png,
 * each crop at its own 50 px/m scale x `--scale` (default 1), labelled with the pand id, so widths compare directly.
 * A 1 m grid tick on the left edge of every crop helps read window sizes.
 *
 *   node --import tsx scripts/research/canal-windows/montage.ts --bags=176665,179751 --name=a [--scale=1.5] [--alt]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const root = 'staging/pand-reference-walls', all = fs.readdirSync(root).filter(d => /^\d{16}$/.test(d));
const scale = Number(arg('scale', '1')), file = process.argv.includes('--alt') ? 'front-alt.jpg' : 'front.jpg';
const bags = arg('bags').split(',').map(b => all.find(d => d.endsWith(b))!).filter(Boolean);
const tiles = await Promise.all(bags.map(async bag => {
  const meta = await sharp(path.join(root, bag, file)).metadata(), w = Math.round(meta.width! * scale), h = Math.round(meta.height! * scale);
  const ticks = Array.from({length: Math.floor(h / (50 * scale))}, (_, k) => `<line x1="0" x2="${k % 5 ? 6 : 14}" y1="${h - k * 50 * scale}" y2="${h - k * 50 * scale}" stroke="#ff0" stroke-width="2"/>`).join('');
  const img = await sharp(path.join(root, bag, file)).resize(w, h).composite([{input: Buffer.from(`<svg width="${w}" height="${h}">${ticks}</svg>`), left: 0, top: 0}]).png().toBuffer();
  return {img, w, h, bag};
}));
const H = Math.max(...tiles.map(t => t.h)) + 24, W = tiles.reduce((s, t) => s + t.w + 8, 0);
let x = 0;
const comps = tiles.flatMap(t => { const c = [{input: t.img, left: x, top: 24 + H - 24 - t.h}, {input: Buffer.from(`<svg width="${t.w}" height="22"><text x="2" y="16" font-size="14" font-family="Helvetica">${t.bag.slice(-6)}</text></svg>`), left: x, top: 0}]; x += t.w + 8; return c; });
const out = `staging/canal-windows/montage-${arg('name', 'x')}.png`;
await sharp({create: {width: W, height: H, channels: 3, background: '#fff'}}).composite(comps).png().toFile(out);
console.log(out, W, H);
