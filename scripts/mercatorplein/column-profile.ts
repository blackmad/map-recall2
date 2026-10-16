/**
 * Brightness profile down one pixel column (or along one row) of a rectified crop, for reading edges (tower top, eaves,
 * window heads) in metres rather than by eye: prints runs of similar luminance with their extent in crop pixels and metres.
 *
 *   node --import tsx scripts/mercatorplein/column-profile.ts <crop.jpg> --x=700 [--ppm=50] [--top-m=32] [--step=4]
 *   node --import tsx scripts/mercatorplein/column-profile.ts <crop.jpg> --y=900 [--ppm=50]
 *
 * Column mode reports heights as top-m - y/ppm (the crop's top edge is top-m above its ground); row mode reports
 * metres along the wall from the crop's left edge.
 */
import sharp from 'sharp';
const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const file = process.argv[2], ppm = Number(arg('ppm', '50')), topM = Number(arg('top-m', '32')), step = Number(arg('step', '4'));
const {data, info} = await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject: true});
const lum = (x: number, y: number) => { let s = 0, n = 0; for (let dx = -2; dx <= 2; dx++) for (let dy = -1; dy <= 1; dy++) { const xx = Math.min(info.width - 1, Math.max(0, x + dx)), yy = Math.min(info.height - 1, Math.max(0, y + dy)), i = (yy * info.width + xx) * 3; s += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; n++; } return s / n; };
const col = arg('x') !== '', at = Number(col ? arg('x') : arg('y')), len = col ? info.height : info.width;
let start = 0, prev = col ? lum(at, 0) : lum(0, at), acc: number[] = [prev];
const runs: string[] = [];
const flush = (end: number) => {
  const m = acc.reduce((a, b) => a + b, 0) / acc.length;
  const a = col ? (topM - start / ppm).toFixed(2) : (start / ppm).toFixed(2), b = col ? (topM - end / ppm).toFixed(2) : (end / ppm).toFixed(2);
  runs.push(`${String(start).padStart(5)}-${String(end).padEnd(5)} ${col ? 'h' : 'u'} ${a}..${b} m  lum ${m.toFixed(0)}`);
};
for (let p = step; p < len; p += step) {
  const v = col ? lum(at, p) : lum(p, at);
  if (Math.abs(v - prev) > 28) { flush(p); start = p; acc = []; }
  acc.push(v); prev = v;
}
flush(len - 1);
console.log(runs.join('\n'));
