// Brick tone of photo crops (look/brickTone.ts): per crop the brick median, the whole-wall median, the light trim, how
// the crop was lit and the brick's hue and saturation; then the albedo pooled one vote per camera system.
//   node --import tsx scripts/look/measure-brick-tone.ts [--json out.json] [--lightness=#hex]
//        [--system=<name>] <image>[@x0,y0,x1,y1] ... [--system=<other>] <image> ...
// `--system` tags the images after it with a camera system (default: the image's directory). The optional box is in
// shares of the image (0..1), for photos that show more than one wall. `--lightness` is the exposure-calibrated wall
// colour whose L* the albedo keeps (default: the crops' combined brick).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { brickAlbedo, combineBrickTones, cropLight, labHueChroma, measureBrickTone, rgbToHsl, type BrickTone, type Rgb } from '../../src/canalRecall/look/brickTone.ts';

const hex = (c: readonly number[]) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.findIndex(a => a === `--${k}` || a.startsWith(`--${k}=`)); if (i < 0) return null; const a = args.splice(i, 1)[0]; return a.includes('=') ? a.split('=')[1] : args.splice(i, 1)[0]; };
const jsonOut = opt('json'), lightnessArg = opt('lightness');
const rows: ({ source: string; system: string; box: number[] | null; light: 'diffuse' | 'sunlit' } & BrickTone)[] = [];
let system: string | null = null;
for (const arg of args) {
  if (arg.startsWith('--system=')) { system = arg.slice(9); continue; }
  const [file, boxArg] = arg.split('@');
  const box = boxArg ? boxArg.split(',').map(Number) : null;
  let img = sharp(file);
  const meta = await img.metadata();
  if (box) {
    const [x0, y0, x1, y1] = box, W = meta.width!, H = meta.height!;
    img = img.extract({ left: Math.round(x0 * W), top: Math.round(y0 * H), width: Math.round((x1 - x0) * W), height: Math.round((y1 - y0) * H) });
  }
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const t = measureBrickTone(data, info.channels);
  if (!t) { console.log(`${path.basename(file)}: no wall`); continue; }
  rows.push({ source: path.basename(file) + (boxArg ? '@' + boxArg : ''), system: system ?? path.basename(path.dirname(file)), box, light: cropLight(t), ...t });
}
const fmt = (c: Rgb | null) => (c ? hex(c) : '   -   ');
const hs = (c: readonly number[]) => { const [h, s, l] = rgbToHsl(c), lab = labHueChroma(c); return `HSL ${h.toFixed(0).padStart(3)}/${s.toFixed(2)}/${l.toFixed(2)} Lab L${lab.L.toFixed(0).padStart(3)} h${lab.hue.toFixed(0).padStart(4)} C${lab.chroma.toFixed(1).padStart(5)}`; };
console.log('system'.padEnd(16), 'source'.padEnd(40), 'light  ', 'brick  ', 'brick'.padEnd(40), 'wall   ', 'trim    r/b ', 'split brick/joint/dark/bright/sky+leaf');
for (const r of rows) {
  const trimRB = r.lightTrim ? (r.lightTrim[0] / Math.max(1, r.lightTrim[2])).toFixed(2) : '  - ';
  console.log(r.system.slice(0, 16).padEnd(16), r.source.slice(0, 40).padEnd(40), r.light.padEnd(7), fmt(r.brick), hs(r.brick).padEnd(40), fmt(r.wall), fmt(r.lightTrim), trimRB.padStart(4), r.split ? 'y' : 'n', [r.counts.brick, r.counts.joint, r.counts.dark, r.counts.bright, r.counts.sky + r.counts.leaf].join('/'));
}
if (rows.length) {
  const all = combineBrickTones(rows.map(r => r.brick));
  console.log(`\nevery crop pooled (old style, one vote per crop): ${hex(all)} ${hs(all)}`);
  const lightness = lightnessArg ?? hex(all);
  const a = brickAlbedo(rows.map(r => ({ system: r.system, tone: r })), lightness);
  if (a) {
    for (const s of a.systems) console.log(`  ${s.system.padEnd(16)} diffuse crops ${String(s.crops).padStart(2)}  hue ${s.hue.toFixed(0).padStart(3)}  C*/L* ${s.chromaPerL.toFixed(3)}`);
    if (a.sunlitOnly.length) console.log(`  sunlit only (left out): ${a.sunlitOnly.join(', ')}`);
    console.log(`albedo at the L* of ${lightness}: ${a.hex} ${hs(a.rgb)}`);
  } else console.log('no diffuse crop: no albedo');
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(rows.map(({ source, system, box, light, brick, wall, lightTrim, hsl, wallLuma, counts, split }) => ({ source, system, box, light, brick: hex(brick), wall: hex(wall), lightTrim: lightTrim && hex(lightTrim), hsl, wallLuma, counts, split })), null, 1));
