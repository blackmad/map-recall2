/**
 * Measure a mottled brick wall's tones (issue #77, buildingTypes/mottle.ts) from boxes in sunlit crops (sunlit-crops.ts).
 * All boxes are pooled: the tones and the mean are of every kept brick pixel together.
 *
 *   node --import tsx scripts/building-types/brick-mottle.ts [--k=4] .cache/building-types/sunlit/<pand>-<time>.jpg:x0,y0,x1,y1 ...
 *
 * Boxes are 0..1 crop coordinates (origin top-left). Prints the wall mean (the palette tint) and a `mottle` block for the spec.
 * A box may name a white reference in the same crop, `<file>:<box>@<white box>` (white paint of the same facade, unclipped):
 * its pixels are scaled per channel so that white reads the sunlit frame white (exposure.ts `whiteReferenced`), which
 * removes an overcast crop's exposure and sky cast before pooling.
 */
import sharp from 'sharp';
import {SUNLIT_FRAME_WHITE} from '../../src/canalRecall/buildingTypes/exposure.ts';
import {measureMottle, mottleGain, mottleRatios, type Rgb} from '../../src/canalRecall/buildingTypes/mottle.ts';

const k = Number(process.argv.find(a => a.startsWith('--k='))?.slice(4) ?? '4');
const px: Rgb[] = [], used: string[] = [];
async function pixels(file: string, box: string): Promise<Rgb[]> {
  const [x0, y0, x1, y1] = box.split(',').map(Number), img = sharp(file), {width = 0, height = 0} = await img.metadata();
  const {data, info} = await img.extract({left: Math.round(x0 * width), top: Math.round(y0 * height), width: Math.max(1, Math.round((x1 - x0) * width)), height: Math.max(1, Math.round((y1 - y0) * height))}).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const out: Rgb[] = [];
  for (let j = 0; j < data.length; j += info.channels) out.push([data[j], data[j + 1], data[j + 2]]);
  return out;
}
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const target = [1, 3, 5].map(i => parseInt(SUNLIT_FRAME_WHITE.slice(i, i + 2), 16));
for (const a of process.argv.slice(2).filter(a => !a.startsWith('--'))) {
  const i = a.lastIndexOf(':'), file = a.slice(0, i), [box, whiteBox] = a.slice(i + 1).split('@');
  const p = await pixels(file, box);
  let scale = [1, 1, 1];
  if (whiteBox) {
    const w = await pixels(file, whiteBox), white = [0, 1, 2].map(c => median(w.map(q => q[c])));
    if (Math.max(...white) >= 250) console.warn(`white box of ${file} is clipped (${white}); exposure not recoverable`);
    scale = white.map((v, c) => target[c] / Math.max(1, v));
  }
  for (const q of p) px.push([0, 1, 2].map(c => Math.min(255, q[c] * scale[c])) as Rgb);
  used.push(`${file.split('/').pop()} [${box}]${whiteBox ? ` white [${whiteBox}] x${scale.map(v => v.toFixed(2)).join('/')}` : ''} ${p.length}px`);
}
const m = measureMottle(px, k), ratios = mottleRatios(m);
console.log(used.join('\n'));
console.log(`kept ${m.kept}/${px.length} brick pixels; mean ${m.mean}; cell gain ${mottleGain(ratios).toFixed(3)}`);
console.log(JSON.stringify({tones: m.tones}));
for (const [i, t] of m.tones.entries()) console.log(t.hex, t.share, 'ratio', ratios[i].map(v => v.toFixed(2)).join('/'));
