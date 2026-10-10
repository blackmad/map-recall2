/**
 * Vertical frame lines per floor band of a rectified elevation, as fractions of module spans.
 *   node --import tsx scripts/haparandaweg/rowcols.ts <image> --mask=red --ys=125-225,255-380,... [--split=27,310,601,890] [--thr=0.55] [--ppm=50]
 * For each y-range prints the x centres (px and metres) of vertical bands and, when --split is given, each as a fraction of its span.
 */
import sharp from 'sharp';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const { data, info } = await sharp(process.argv[2]).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, mask = arg('mask', 'red'), thr = Number(arg('thr', '0.55')), ppm = Number(arg('ppm', '50'));
const split = arg('split').split(',').filter(Boolean).map(Number);
const is = (x: number, y: number) => {
  const o = (y * W + x) * 3, r = data[o], g = data[o + 1], b = data[o + 2];
  if (mask === 'red') return r > 60 && r - g > 30 && r - b > 20;
  if (mask === 'dark') return r + g + b < Number(arg('dk', '200'));
  const m = (r + g + b) / 3; return m < Number(arg('fr', '120')) && Math.abs(r - b) < 30;
};
for (const rng of arg('ys').split(',')) {
  const [a, b] = rng.split('-').map(Number), xs: number[] = [];
  let s = -1;
  for (let x = 0; x <= W; x++) {
    let c = 0;
    if (x < W) for (let y = a; y < b; y++) if (is(x, y)) c++;
    const on = x < W && c / (b - a) >= thr;
    if (on && s < 0) s = x;
    if (!on && s >= 0) { if (x - s >= 3) xs.push((s + x - 1) / 2); s = -1; }
  }
  const frac = (x: number) => {
    for (let i = 0; i + 1 < split.length; i++) if (x >= split[i] - 1 && x <= split[i + 1] + 1) return `${i}:${((x - split[i]) / (split[i + 1] - split[i])).toFixed(2)}`;
    return '-';
  };
  console.log(`y ${rng}:`, xs.map(x => `${x.toFixed(0)}${split.length ? '[' + frac(x) + ']' : ''}`).join(' '));
}
