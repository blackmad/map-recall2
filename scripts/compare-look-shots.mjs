// Pixel comparison of two look-shot directories (tests/e2e/look-consistency.spec.ts).
//   node scripts/compare-look-shots.mjs <dirA> <dirB> [--max-diff-pixels=N] [--crop-top=PX] [--diff-out=DIR]
// Prints, per PNG present in both, the count of differing pixels, the largest
// channel difference and the mean luma of each side. Exit 1 when any image
// differs by more than --max-diff-pixels (default: report only).
import sharp from 'sharp';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const [a, b, ...flags] = process.argv.slice(2);
if (!a || !b) { console.error('usage: compare-look-shots.mjs <dirA> <dirB> [--max-diff-pixels=N]'); process.exit(2); }
const limitFlag = flags.find(f => f.startsWith('--max-diff-pixels='));
const limit = limitFlag ? Number(limitFlag.split('=')[1]) : Infinity;
const diffOut = flags.find(f => f.startsWith('--diff-out='))?.slice(11);
// --crop-top=N ignores the top N px (the far skyline, where coarse tiles stream in and out run to run).
const cropTop = Number(flags.find(f => f.startsWith('--crop-top='))?.slice(11) ?? 0);
const pngs = dir => readdirSync(dir, { recursive: true }).map(String).filter(f => f.endsWith('.png')).sort();
const raw = file => sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let failed = false;
for (const file of pngs(a)) {
  const other = join(b, file);
  if (!existsSync(other)) { console.log(`${file}: missing in ${b}`); continue; }
  const [x, y] = await Promise.all([raw(join(a, file)), raw(other)]);
  if (x.info.width !== y.info.width || x.info.height !== y.info.height) { console.log(`${file}: size differs`); failed = true; continue; }
  let differing = 0, maxDelta = 0, lumaA = 0, lumaB = 0;
  const n = x.info.width * x.info.height;
  const diff = diffOut ? Buffer.alloc(n * 3) : null, m = n - cropTop * x.info.width;
  for (let i = cropTop * x.info.width * 4; i < n * 4; i += 4) {
    const d = Math.max(Math.abs(x.data[i] - y.data[i]), Math.abs(x.data[i + 1] - y.data[i + 1]), Math.abs(x.data[i + 2] - y.data[i + 2]));
    if (d) differing++;
    if (diff) { const g = (0.299 * x.data[i] + 0.587 * x.data[i + 1] + 0.114 * x.data[i + 2]) * 0.3; diff[i / 4 * 3] = d ? 255 : g; diff[i / 4 * 3 + 1] = d ? 0 : g; diff[i / 4 * 3 + 2] = d ? 255 : g; }
    if (d > maxDelta) maxDelta = d;
    lumaA += 0.299 * x.data[i] + 0.587 * x.data[i + 1] + 0.114 * x.data[i + 2];
    lumaB += 0.299 * y.data[i] + 0.587 * y.data[i + 1] + 0.114 * y.data[i + 2];
  }
  if (differing > limit) failed = true;
  if (diff && differing) { const out = join(diffOut, file); mkdirSync(dirname(out), { recursive: true }); await sharp(diff, { raw: { width: x.info.width, height: x.info.height, channels: 3 } }).png().toFile(out); }
  console.log(`${file}: ${differing} px differ (${(100 * differing / m).toFixed(3)}%), max channel delta ${maxDelta}, mean luma ${(lumaA / m).toFixed(1)} -> ${(lumaB / m).toFixed(1)}`);
}
process.exit(failed ? 1 : 0);
