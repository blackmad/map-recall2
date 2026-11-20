// Lane retail-fit: measured glass tone per bay on a bay strip (bay-strip.ts output, 50 px/m, bottom 7 m): the median
// sRGB of the glass between 0.6 and 3.6 m above the pavement and 15-85% of the bay's width, per bay.
//   npx tsx scripts/retail-fit/glass-tone.ts --strip=<png> --bays=<n> [--gap=4]
import sharp from 'sharp';
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const strip = arg('strip')!, bays = Number(arg('bays')), gap = Number(arg('gap') ?? 4);
const { data, info } = await sharp(strip).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const bw = (info.width + gap) / bays - gap;
const hex = (c: number[]) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
for (let b = 0; b < bays; b++) {
  const x0 = Math.round(b * (bw + gap) + 0.15 * bw), x1 = Math.round(b * (bw + gap) + 0.85 * bw);
  const y0 = info.height - 3.6 * 50, y1 = info.height - 0.6 * 50;
  const ch: number[][] = [[], [], []];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) for (let c = 0; c < 3; c++) ch[c].push(data[(y * info.width + x) * 3 + c]);
  const med = ch.map(a => a.sort((p, q) => p - q)[a.length >> 1]);
  const lum = 0.2126 * med[0] + 0.7152 * med[1] + 0.0722 * med[2];
  console.log(`bay ${b}\t${hex(med)}\tL ${lum.toFixed(0)}`);
}
