/**
 * Research tool (De Baarsjes type library, 2026-10-14): the vertical profile of one or more pands on a face's rectified
 * strip, for measuring storey lines, window sill/head lines, painted band heights, window shares, canopy and glass-block
 * band heights. Not a gate; prints numbers that go into a type's `evidence`.
 *
 *   node --import tsx scripts/research/strip-row-profile.ts --face=evertsen-7-41 --pands=071876,081449 [--from=0 --to=19] [--rows]
 *
 * Pixels are classed as in blockFace/stripPalette.ts (`classifyPixel`: glass, accent = light low-saturation paint and
 * frames, wall). Per 0.05 m row (height above the strip's ground line) it reports the accent, glass and wall shares over
 * the span (middle 90 % of the span, so party-wall downpipes do not count) and the row's median colour. Runs:
 *   - `white` rows: accent share >= 0.55 (`--white=`) (a painted band, a canopy fascia, a white window band);
 *   - `glass` rows: glass share >= 0.22 (a window storey);
 * and per glass run the share of the span's columns that are glazed (the storey's window share).
 */
import fs from 'node:fs';
import sharp from 'sharp';
import {classifyPixel} from '../../src/canalRecall/blockFace/stripPalette.ts';
import {toHex, type Rgb} from '../../src/canalRecall/blockFace/wallColour.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const face = arg('face');
if (!face) throw Error('--face=<id> --pands=<id,id>');
const strip = JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/strip.json`, 'utf8'));
const img = strip.image ?? `staging/block-face/${face}/strip.jpg`;
const {data, info} = await sharp(img).removeAlpha().raw().toBuffer({resolveWithObject: true});
const ppm: number = strip.pixelsPerMetre, H = info.height;
const want = (arg('pands') ?? '').split(',').filter(Boolean);
const spans = strip.spans.filter((s: any) => !want.length || want.some(w => s.pandId.endsWith(w)));
const from = Number(arg('from') ?? 0), to = Number(arg('to') ?? H / ppm), step = 0.05;
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const px = (x: number, y: number): Rgb => { const i = (y * info.width + x) * 3; return [data[i], data[i + 1], data[i + 2]]; };

interface Row {m: number; accent: number; glass: number; wall: number; colour: string}
for (const s of spans) {
  const [a0, a1] = s.px as [number, number], pad = Math.round((a1 - a0) * 0.05), x0 = a0 + pad, x1 = a1 - pad;
  const rows: Row[] = [];
  for (let m = from; m < to; m += step) {
    const yTop = Math.round(H - (m + step) * ppm), yBot = Math.round(H - m * ppm);
    const c = {accent: 0, glass: 0, wall: 0, void: 0}, cols: Rgb[] = [];
    for (let y = Math.max(0, yTop); y < Math.min(H, yBot); y++) for (let x = x0; x < x1; x++) { const p = px(x, y); c[classifyPixel(p)]++; cols.push(p); }
    const n = c.accent + c.glass + c.wall;
    if (!n || c.void > n) continue;
    rows.push({m: +m.toFixed(2), accent: +(c.accent / n).toFixed(2), glass: +(c.glass / n).toFixed(2), wall: +(c.wall / n).toFixed(2), colour: toHex([0, 1, 2].map(k => median(cols.map(p => p[k]))) as Rgb)});
  }
  const runs = (ok: (r: Row) => boolean) => {
    const out: [number, number][] = [];
    for (const r of rows) { const last = out.at(-1); if (!ok(r)) continue; if (last && Math.abs(r.m - last[1]) < step * 1.5) last[1] = r.m + step; else out.push([r.m, r.m + step]); }
    return out.map(([a, b]) => [+a.toFixed(2), +b.toFixed(2)] as [number, number]);
  };
  const whiteMin = Number(arg("white") ?? 0.55), white = runs(r => r.accent >= whiteMin);
  // `--open`: window rows are glass OR white (white-framed windows behind white curtains read as accent, not glass).
  const openMin = Number(arg("open") ?? 0), glass = runs(r => (openMin ? r.glass + r.accent >= openMin : r.glass >= 0.22)).filter(([a, b]) => b - a >= 0.4);
  // Window share per glass run: columns whose glass share over the run is >= 0.5.
  const shares = glass.map(([a, b]) => {
    const yTop = Math.round(H - b * ppm), yBot = Math.round(H - a * ppm); let glazed = 0;
    for (let x = x0; x < x1; x++) { let g = 0; for (let y = yTop; y < yBot; y++) { const k = classifyPixel(px(x, y)); if (k === 'glass' || k === 'accent') g++; } if (g / (yBot - yTop) >= 0.5) glazed++; }
    return +(glazed / (x1 - x0)).toFixed(2);
  });
  console.log(`# ${face} ${s.pandId.slice(-6)} px ${a0}-${a1} (${((a1 - a0) / ppm).toFixed(2)} m)`);
  console.log(`  white runs (m): ${white.map(r => `${r[0]}-${r[1]} (${(r[1] - r[0]).toFixed(2)})`).join(', ')}`);
  console.log(`  glass runs (m): ${glass.map((r, i) => `${r[0]}-${r[1]} share ${shares[i]}`).join(', ')}`);
  if (process.argv.includes('--rows')) for (const r of rows) console.log(`  ${r.m.toFixed(2).padStart(6)} a ${r.accent.toFixed(2)} g ${r.glass.toFixed(2)} w ${r.wall.toFixed(2)} ${r.colour}`);
}
