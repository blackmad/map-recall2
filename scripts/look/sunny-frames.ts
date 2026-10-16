// Region statistics of live-play frames for the look lanes (docs/images/look/sunny-20261016.jpg).
//   npx tsx scripts/look/sunny-frames.ts <dir> [<beforeDir>] [--json=out.json]
// Each place needs <name>.clean.png (no HUD) and <name>.mask.png (scripts/look/region-mask.js, live-play-shots.mjs
// MASK=1). Per frame: median luma (Rec. 709 on sRGB, 0-255) and chroma (max - min, 0-255) of the facade walls, the
// roofs, the paved ground, the water, the sky and the whole frame, plus the median colour; with <beforeDir>, the
// ΔE76 of each layer's median colour against the same layer before.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { regionOfMask, regionStats, type Layer, type RegionStats } from '../../src/canalRecall/look/frameRegions.ts';

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const jsonOut = process.argv.find(a => a.startsWith('--json='))?.slice(7);
const [dir, beforeDir] = args;

async function rgb(file: string) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function measure(d: string): Promise<Record<string, Record<Layer, RegionStats | null>>> {
  const out: Record<string, Record<Layer, RegionStats | null>> = {};
  for (const f of fs.readdirSync(d).filter(f => f.endsWith('.mask.png')).sort()) {
    const name = f.slice(0, -'.mask.png'.length);
    const mask = await rgb(path.join(d, f)), clean = await rgb(path.join(d, `${name}.clean.png`));
    const regions = regionOfMask(mask.data, clean.data, mask.width, mask.height);
    out[name] = regionStats(clean.data, regions);
  }
  return out;
}

const after = await measure(dir);
const before = beforeDir ? await measure(beforeDir) : null;
const layers: Layer[] = ['wall', 'roof', 'paved', 'road', 'cycle', 'water', 'park', 'sky', 'frame'];
const lab = (c: readonly number[]) => {
  const lin = c.map(v => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  const X = (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047, Y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2], Z = (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const dE = (a: readonly number[], b: readonly number[]) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const cell = (s: RegionStats | null) => (s ? `${s.luma}/${s.chroma}` : '–');
console.log(`| place | ${layers.map(l => `${l} luma/chroma`).join(' | ')} |`);
console.log(`|---|${layers.map(() => '---').join('|')}|`);
for (const [name, row] of Object.entries(after)) {
  const b = before?.[name];
  console.log(`| ${name} | ${layers.map(l => {
    if (!b) return cell(row[l]);
    const x = b[l], y = row[l];
    return `${cell(x)} → ${cell(y)}${x && y ? ` (ΔE ${dE(x.median, y.median).toFixed(1)})` : ''}`;
  }).join(' | ')} |`);
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ after, before }, null, 1));
