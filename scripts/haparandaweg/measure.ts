/**
 * Measure frame lines in a rectified elevation: runs of rows/columns where a colour mask covers most of the span.
 *   node --import tsx scripts/haparandaweg/measure.ts <image> --mask=red|dark|light [--x0=0 --x1=W --y0=0 --y1=H] [--rows=0.6] [--cols=0.5] [--ppm=50]
 * Prints horizontal bands (y px, thickness) and vertical bands (x px, thickness) in px and metres from the crop's left/top.
 */
import sharp from 'sharp';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const file = process.argv[2];
const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const x0 = Number(arg('x0', '0')), x1 = Number(arg('x1', String(W))), y0 = Number(arg('y0', '0')), y1 = Number(arg('y1', String(H)));
const ppm = Number(arg('ppm', '50')), mask = arg('mask', 'red');
const is = (x: number, y: number) => {
  const o = (y * W + x) * 3, r = data[o], g = data[o + 1], b = data[o + 2];
  if (mask === 'red') return r > 60 && r - g > 30 && r - b > 20;
  if (mask === 'dark') return r + g + b < 200;
  if (mask === 'light') return r + g + b > 560;
  if (mask === 'frame') { const m = (r + g + b) / 3; return m < 120 && Math.abs(r - b) < 25; }
  return false;
};
const bands = (n: number, lo: number, hi: number, frac: number, at: (i: number, j: number) => boolean) => {
  const out: [number, number][] = [];
  let s = -1;
  for (let i = 0; i <= n; i++) {
    let c = 0;
    if (i < n) for (let j = lo; j < hi; j++) if (at(i, j)) c++;
    const on = i < n && c / (hi - lo) >= frac;
    if (on && s < 0) s = i;
    if (!on && s >= 0) { out.push([s, i - s]); s = -1; }
  }
  return out;
};
const fmt = (b: [number, number][]) => b.map(([p, t]) => `${p}+${t} (${(p / ppm).toFixed(2)}m)`).join('  ');
console.log('rows  :', fmt(bands(y1, x0, x1, Number(arg('rows', '0.6')), (y, x) => y >= y0 && is(x, y)).filter(b => b[1] >= 2)));
console.log('cols  :', fmt(bands(x1, y0, y1,Number(arg('cols', '0.5')), (x, y) => x >= x0 && is(x, y)).filter(b => b[1] >= 2)));
