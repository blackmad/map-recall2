/**
 * Prepare ground-tier crops for OCR: upscale, even out the light, sharpen.
 *
 * The reader already runs on the ground tier (110 px/m over a ~4.9 m band,
 * against 45 px/m for the whole facade), so resolution is not the thing left to
 * fix. What is left is that a fascia is small text under uneven light: sun on
 * one half, shadow on the other, an awning cutting across. Vision reads the lit
 * half and drops the rest, which is where partial words come from.
 *
 * Three steps, the standard recipe for small text under uneven light:
 *   - 3x Lanczos upscale, because Vision does better on larger glyphs and
 *     `minimumTextHeight` is a fraction of image height;
 *   - CLAHE over 64x64 tiles, which normalises contrast *locally* so a shadowed
 *     half is lifted without blowing out the lit half;
 *   - a mild sharpen to recover edges the upscale softened.
 *
 * Measured over 45 storefront crops in `da-costa-jordaan-v1`, counting lines at
 * confidence >= 0.5 with at least three characters:
 *
 *     raw ground crop      33 storefronts read, 104 text lines
 *     prepared             38 storefronts read, 158 text lines
 *
 * So it is worth doing, but read the second number rather than the first: most
 * of the gain is *more fragments*, not cleaner ones. On De Clercqstraat 70,
 * "Handwork Boutiqur" became "Handwork Boutique" while a second reading of the
 * same words degraded to "Handwork Borfiaue". Preparation buys more attempts at
 * each sign, with errors that differ between attempts. That is only an
 * improvement if the consumer votes across readings rather than taking the
 * first — see the fragment-consensus step in SIGN_PHOTOGRAPHY_PLAN.md.
 *
 * Usage:
 *   npx tsx scripts/facade-eval/prep-ocr-crops.ts [--evidence=<dir>] [--out=<dir>]
 *                                                 [--scale=3] [--tile=64] [--max-slope=3]
 *                                                 [--only=<sha>,<sha>]
 */
import { mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);

const EVIDENCE = arg('evidence') ?? 'public/data/city-expansion/evidence';
const OUT = arg('out') ?? '.cache/ocr-prep';
const SCALE = Number(arg('scale') ?? 3);
/** CLAHE tile size in pixels of the *upscaled* image. */
const TILE = Number(arg('tile') ?? 64);
const MAX_SLOPE = Number(arg('max-slope') ?? 3);

await mkdir(OUT, { recursive: true });

const files = (await readdir(EVIDENCE)).filter(f => f.endsWith('.jpg'));
const only = arg('only');
const wanted = only ? new Set(only.split(',').map(s => `${s.trim()}.jpg`)) : null;

let done = 0;
let skipped = 0;
for (const file of files) {
  if (wanted && !wanted.has(file)) continue;
  const source = path.join(EVIDENCE, file);
  const target = path.join(OUT, `${path.basename(file, '.jpg')}.png`);
  if (existsSync(target)) { skipped += 1; continue; }
  const meta = await sharp(source).metadata();
  if (!meta.width) continue;
  await sharp(source)
    .resize({ width: Math.round(meta.width * SCALE), kernel: 'lanczos3' })
    .clahe({ width: TILE, height: TILE, maxSlope: MAX_SLOPE })
    .sharpen({ sigma: 1 })
    .toFile(target);
  done += 1;
  if (done % 100 === 0) process.stdout.write(`  ${done} prepared\n`);
}

console.log(`prepared ${done}, skipped ${skipped} already present -> ${OUT}`);
console.log('Feed these to run_vision_ocr.ts in place of the raw crops, and vote across readings.');
