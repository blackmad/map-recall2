/**
 * Metre grid over a rectified wall crop (landmark-brief.ts output: wall start at the left edge, ground at the bottom row,
 * pixels per metre = width / wall length). For reading facade measurements off the photo instead of guessing them.
 *
 *   node --import tsx scripts/landmarks/elevation-grid.ts --crop=artifacts/landmark-briefs/<id>/w16-337.jpg --len=13.9
 *        [--out=...png] [--x0=0 --x1=len --y0=0 --y1=top] [--zoom=2] [--step=1]
 */
import sharp from 'sharp';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const crop = arg('crop'), len = Number(arg('len'));
if (!crop || !len) { console.error('--crop and --len required'); process.exit(2); }
const meta = await sharp(crop).metadata();
const W = meta.width!, H = meta.height!, ppm = W / len;
const x0 = Number(arg('x0', '0')), x1 = Number(arg('x1', String(len))), y0 = Number(arg('y0', '0')), y1 = Number(arg('y1', String(H / ppm)));
const zoom = Number(arg('zoom', '1')), step = Number(arg('step', '1'));
const left = Math.max(0, Math.round(x0 * ppm)), right = Math.min(W, Math.round(x1 * ppm));
const top = Math.max(0, Math.round(H - y1 * ppm)), bottom = Math.min(H, Math.round(H - y0 * ppm));
const w = right - left, h = bottom - top, ow = Math.round(w * zoom), oh = Math.round(h * zoom);
const major = (m: number) => Math.abs(m - Math.round(m / 5) * 5) < 1e-6;
let svg = `<svg width="${ow}" height="${oh}" xmlns="http://www.w3.org/2000/svg">`;
for (let m = Math.ceil(x0 / step) * step; m <= x1 + 1e-9; m += step) {
  const X = (m * ppm - left) * zoom;
  svg += `<line x1="${X}" y1="0" x2="${X}" y2="${oh}" stroke="${major(m) ? '#ff0' : '#0ff'}" stroke-opacity="${major(m) ? 0.8 : 0.45}"/>`;
  svg += `<text x="${X + 2}" y="12" font-size="11" fill="#ff0" font-family="sans-serif">${+m.toFixed(2)}</text>`;
}
for (let m = Math.ceil(y0 / step) * step; m <= y1 + 1e-9; m += step) {
  const Y = (H - m * ppm - top) * zoom;
  svg += `<line x1="0" y1="${Y}" x2="${ow}" y2="${Y}" stroke="${major(m) ? '#ff0' : '#f0f'}" stroke-opacity="${major(m) ? 0.8 : 0.45}"/>`;
  svg += `<text x="2" y="${Y - 2}" font-size="11" fill="#f0f" font-family="sans-serif">${+m.toFixed(2)}</text>`;
}
svg += '</svg>';
const out = arg('out', crop.replace(/\.jpg$/, '.grid.png'));
await sharp(crop).extract({left, top, width: w, height: h}).resize(ow, oh).composite([{input: Buffer.from(svg)}]).png().toFile(out);
console.log(`${out} ${ow}x${oh} ppm ${ppm.toFixed(2)} wall height ${(H / ppm).toFixed(2)} m`);
