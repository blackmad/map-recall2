// Orthophoto tones of the open-ground covers (lane open-ground-look 2026-11-10).
//
//   npx tsx scripts/own-ground/measure-open-ground-tones.ts [--dir=artifacts/own-ground/staging/open-ground-v1] [--out=artifacts/own-ground/open-ground-tones.json]
//   ... --cells=-11_5,10_-6 [--box=300]   # instead of the spots: a --box m square at the centre of each cell's largest area per cover
//
// Inside the open-ground-v1 polygons of each OPEN_GROUND_SPOTS spot's 300 m box, the PDOK 8 cm orthophoto on a 0.5 m
// grid (raw sRGB; the polygon also under four points 0.6 m around), dehazed as road-look-v2 measure. Each cover's texels
// are split into shade and sun by Otsu on luma; the pooled sun median is the tone the look is set against.
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fromLocal, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { decodeLine, inRings } from '../../src/canalRecall/ownGround/parks.ts';
import type { OpenGroundCell } from '../../src/canalRecall/ownGround/groundSurface.ts';
import { OPEN_GROUND_SPOTS } from '../../src/canalRecall/ownGround/openGroundRegressions.ts';
import { dehaze, luma } from './road-look-v2.ts';
import { otsu } from './measure-spot-tones.ts';
import { OrthoTiles } from './ortho.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const DIR = arg('dir', 'artifacts/own-ground/staging/open-ground-v1'), OUT = arg('out', 'artifacts/own-ground/open-ground-tones.json');
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; };
const medianRgb = (px: number[][]) => [0, 1, 2].map(c => Math.round(median(px.map(p => p[c]))));

const ortho = new OrthoTiles();
const pooled = new Map<string, number[][]>();
const perSpot: Record<string, Record<string, { n: number; median: number[] }>> = {};
// --cells: one box per cover per cell, centred on the cell's largest polygon of that cover (its first vertex's ring centroid).
const cellsArg = arg('cells', '');
const spots = cellsArg ? cellsArg.split(',').flatMap(key => {
  const c = JSON.parse(gunzipSync(readFileSync(join(DIR, 'cells', `${key}.json.gz`))).toString()) as OpenGroundCell;
  const best = new Map<string, { n: number; at: [number, number] }>();
  for (const a of c.areas) {
    const r = decodeLine(a.r[0]), n = r.length, at: [number, number] = [r.reduce((s, p) => s + p[0], 0) / n, r.reduce((s, p) => s + p[1], 0) / n];
    const xs = r.map(p => p[0]), ys = r.map(p => p[1]), size = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    if (size > (best.get(a.k)?.n ?? 0)) best.set(a.k, { n: size, at });
  }
  return [...best].map(([k, b]) => { const [lng, lat] = fromLocal(b.at[0], b.at[1]); return { name: `${key}-${k}`, cell: key, lng, lat }; });
}) : OPEN_GROUND_SPOTS;
for (const spot of spots) {
  const f = join(DIR, 'cells', `${spot.cell}.json.gz`);
  if (!existsSync(f)) continue;
  const cell = JSON.parse(gunzipSync(readFileSync(f)).toString()) as OpenGroundCell;
  const [cx, cy] = toLocal(spot.lng, spot.lat), R = Number(arg('box', '300')) / 2;
  await ortho.hold(ortho.tilesUnder(cx - R, cy - R, cx + R, cy + R));
  perSpot[spot.name] = {};
  for (const a of cell.areas) {
    const rings = a.r.map(decodeLine);
    const xs = rings[0].map(p => p[0]), ys = rings[0].map(p => p[1]);
    if (Math.max(...xs) < cx - R || Math.min(...xs) > cx + R || Math.max(...ys) < cy - R || Math.min(...ys) > cy + R) continue;
    for (let x = Math.ceil(Math.max(Math.min(...xs), cx - R) * 2) / 2; x <= Math.min(Math.max(...xs), cx + R); x += 0.5) for (let y = Math.ceil(Math.max(Math.min(...ys), cy - R) * 2) / 2; y <= Math.min(Math.max(...ys), cy + R); y += 0.5) {
      if (!inRings(rings, x, y) || ![[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]].every(([dx, dy]) => inRings(rings, x + dx, y + dy))) continue;
      const raw = ortho.rgbAt(x, y);
      if (!raw) continue;
      (pooled.get(a.k) ?? pooled.set(a.k, []).get(a.k)!).push(dehaze(raw));
      const s = perSpot[spot.name];
      (s[a.k] ??= { n: 0, median: [] }).n++;
    }
  }
  ortho.release();
}
const out: Record<string, unknown> = {};
for (const [k, px] of pooled) {
  const t = otsu(px.map(p => luma(p)));
  const sun = px.filter(p => luma(p) >= t), shade = px.filter(p => luma(p) < t);
  out[k] = { n: px.length, otsu: Math.round(t), sun: { n: sun.length, median: medianRgb(sun), luma: Math.round(luma(medianRgb(sun))) }, shade: { n: shade.length, median: medianRgb(shade) }, all: medianRgb(px) };
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ what: 'PDOK 8 cm orthophoto (Beeldmateriaal Nederland, CC BY 4.0) dehazed tones inside open-ground-v1 polygons', covers: out, perSpot }, null, 1));
console.log(JSON.stringify(out, null, 1));
