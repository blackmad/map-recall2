// City-wide census of building:part overlaps and slender parts (feedback fc427560, IJdok; lane
// part-overlap-20261110, docs/reports/part-overlap-20261110.md).
//
// Two classes, both measured on the building-tiles the game streams, after dropNestedDuplicates (the runtime's
// own first step), each feature counted once:
//  1. Interpenetrating ground parts: two features that both stand on the ground (base <= BASE_M), overlap in plan by
//     at least MIN_OVERLAP_M2 and MIN_OVERLAP_SHARE of the smaller, where one top is below the other. The lower
//     one's boundary is sampled every SAMPLE_M: a sample inside the taller footprint and more than COPLANAR_M from
//     its walls is a hidden wall (inside a closed solid, depth-tested away); one within COPLANAR_M is a wall that can
//     stripe against the taller one's wall (what audit-near-coplanar-walls measures on the mesh).
//  2. Slender parts (measured with dropNestedDuplicates' slender rule off; `slenderRule` lists what it drops): footprints whose mean thickness 2A/P is at most SLENDER_M (a 1 m glass bridge, a 0.5 m fin),
//     standing beside a host feature (within HOST_M) that is at least as tall. They are drawn as one flat-coloured
//     windowless slab on the host's windowed facade.
//
//   node --import tsx scripts/audit-part-overlaps.ts [--out=path.json]
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import pc from 'polygon-clipping';
import { dropNestedDuplicates } from '../src/canalRecall/buildingNesting.ts';
import type { BuildingFeature } from '../src/canalRecall/buildingTileSource.ts';

const ROOT = path.join('public', 'data', 'extracts', 'amsterdam');
const BASE_M = 0.5, MIN_OVERLAP_M2 = 5, MIN_OVERLAP_SHARE = 0.05, TOP_GAP_M = 0.5;
const SAMPLE_M = 0.5, COPLANAR_M = 0.3, SLENDER_M = 1.0, HOST_M = 0.6;
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6);

type Ring = [number, number][];
type Entry = { id: string; base: number; top: number; colour?: string; polys: Ring[][]; box: number[]; area: number; perim: number; c: [number, number] };
const K = 111_320, kx = K * Math.cos(52.37 * Math.PI / 180);
const toM = ([x, y]: number[]): [number, number] => [x * kx, y * K];

const ringArea = (r: Ring) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return Math.abs(a) / 2; };
const ringLen = (r: Ring) => { let l = 0; for (let i = 1; i < r.length; i++) l += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]); return l; };
const mpArea = (mp: Ring[][]) => mp.reduce((s, p) => s + p.reduce((t, r, i) => t + (i ? -1 : 1) * ringArea(r), 0), 0);
function inside([x, y]: [number, number], r: Ring) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; }
  return c;
}
function distToRing([x, y]: [number, number], r: Ring) {
  let best = Infinity;
  for (let i = 1; i < r.length; i++) {
    const [ax, ay] = r[i - 1], [bx, by] = r[i], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
  }
  return best;
}
const insidePolys = (p: [number, number], mp: Ring[][]) => mp.some(poly => inside(p, poly[0]) && !poly.slice(1).some(h => inside(p, h)));
const distPolys = (p: [number, number], mp: Ring[][]) => Math.min(...mp.flatMap(poly => poly.map(r => distToRing(p, r))));

// Centrum stadsdeel (boundaries.json rings are [lat, lng]).
const centrum = (JSON.parse(fs.readFileSync(path.join(ROOT, 'boundaries.json'), 'utf8')) as Array<{ name: string; kind: string; geometry: number[][][][] }>)
  .find(b => b.name === 'Centrum' && b.kind === 'suburb')!.geometry.map(poly => poly.map(r => r.map(([lat, lng]) => toM([lng, lat]))));
const inCentrum = (c: [number, number]) => insidePolys(c, centrum as Ring[][]);

const entries = new Map<string, Entry>();
/** Features the slender rule in dropNestedDuplicates removes (counted on the slender:false set). */
const ruleDropped = new Set<string>();
const tileDir = path.join(ROOT, 'building-tiles', '14');
for (const x of fs.readdirSync(tileDir)) {
  if (!/^\d+$/.test(x)) continue;
  for (const file of fs.readdirSync(path.join(tileDir, x))) {
    if (!file.endsWith('.geojson.gz')) continue;
    const features = JSON.parse(gunzipSync(fs.readFileSync(path.join(tileDir, x, file))).toString()).features as BuildingFeature[];
    const kept = new Set(dropNestedDuplicates(features).map(f => String(f.properties?.id ?? '')));
    for (const f of dropNestedDuplicates(features, { slender: false })) {
      if (!kept.has(String(f.properties?.id ?? ''))) ruleDropped.add(String(f.properties?.id ?? ''));
      const id = String(f.properties?.id ?? ''); if (!id || entries.has(id)) continue;
      const g = f.geometry as { type: string; coordinates: number[][][] | number[][][][] } | null;
      if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue;
      const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates as number[][][][]).map(p => (p as number[][][]).map(r => r.map(toM)));
      const pts = polys.flatMap(p => p[0]);
      if (pts.length < 4) continue;
      const box = [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))];
      const base = typeof f.properties?.minHeight === 'number' ? f.properties.minHeight as number : 0;
      const top = typeof f.properties?.height === 'number' ? f.properties.height as number : base + 5;
      const area = mpArea(polys), perim = polys.reduce((s, p) => s + ringLen(p[0]), 0);
      entries.set(id, { id, base, top, colour: f.properties?.colour as string | undefined, polys, box, area, perim, c: [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2] });
    }
  }
}
const list = [...entries.values()];
const CELL = 50, grid = new Map<string, number[]>();
list.forEach((e, i) => { for (let gx = Math.floor(e.box[0] / CELL); gx <= Math.floor(e.box[2] / CELL); gx++) for (let gy = Math.floor(e.box[1] / CELL); gy <= Math.floor(e.box[3] / CELL); gy++) { const k = `${gx},${gy}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); } });
function neighbours(i: number, pad: number) {
  const e = list[i], seen = new Set<number>();
  for (let gx = Math.floor((e.box[0] - pad) / CELL); gx <= Math.floor((e.box[2] + pad) / CELL); gx++) for (let gy = Math.floor((e.box[1] - pad) / CELL); gy <= Math.floor((e.box[3] + pad) / CELL); gy++) for (const j of grid.get(`${gx},${gy}`) ?? []) {
    if (j === i || seen.has(j)) continue; const o = list[j];
    if (o.box[0] > e.box[2] + pad || o.box[2] < e.box[0] - pad || o.box[1] > e.box[3] + pad || o.box[3] < e.box[1] - pad) continue;
    seen.add(j);
  }
  return seen;
}
const lngLat = ([x, y]: [number, number]) => [+(x / kx).toFixed(6), +(y / K).toFixed(6)];

const allList = [...entries.values()];
// ---- 1. interpenetrating ground parts --------------------------------------------------------------------------
type Pair = { lower: string; taller: string; lowerTop: number; tallerTop: number; overlapM2: number; hiddenWallM: number; coplanarWallM: number; at: number[]; centrum: boolean };
const pairs: Pair[] = [];
list.forEach((a, i) => {
  if (a.base > BASE_M) return;
  for (const j of neighbours(i, 0)) {
    const b = list[j];
    if (b.base > BASE_M || j < i) continue;
    if (Math.abs(a.top - b.top) < TOP_GAP_M) continue;
    const [lower, taller] = a.top < b.top ? [a, b] : [b, a];
    let inter: Ring[][];
    try { inter = pc.intersection(lower.polys as never, taller.polys as never) as Ring[][]; } catch { continue; }
    const overlap = mpArea(inter);
    if (overlap < MIN_OVERLAP_M2 || overlap < MIN_OVERLAP_SHARE * Math.min(a.area, b.area)) continue;
    let hidden = 0, coplanar = 0;
    for (const poly of lower.polys) for (const r of poly) for (let k = 1; k < r.length; k++) {
      const len = Math.hypot(r[k][0] - r[k - 1][0], r[k][1] - r[k - 1][1]), n = Math.max(1, Math.round(len / SAMPLE_M));
      for (let s = 0; s < n; s++) {
        const t = (s + 0.5) / n, p: [number, number] = [r[k - 1][0] + (r[k][0] - r[k - 1][0]) * t, r[k - 1][1] + (r[k][1] - r[k - 1][1]) * t];
        const d = distPolys(p, taller.polys);
        if (d <= COPLANAR_M) coplanar += len / n; else if (insidePolys(p, taller.polys)) hidden += len / n;
      }
    }
    pairs.push({ lower: lower.id, taller: taller.id, lowerTop: lower.top, tallerTop: taller.top, overlapM2: +overlap.toFixed(1), hiddenWallM: +hidden.toFixed(1), coplanarWallM: +coplanar.toFixed(1), at: lngLat(lower.c), centrum: inCentrum(lower.c) });
  }
});

// ---- 2. slender parts --------------------------------------------------------------------------------------------
type Slender = { id: string; base: number; top: number; thicknessM: number; areaM2: number; colour: string | null; host: string; at: number[]; centrum: boolean };
const slender: Slender[] = [];
list.forEach((e, i) => {
  const t = 2 * e.area / (e.perim || 1);
  if (t > SLENDER_M || e.area < 0.5) return;
  let host: Entry | null = null;
  for (const j of neighbours(i, HOST_M)) {
    const o = list[j];
    if (o.top < e.top - TOP_GAP_M || o.area <= e.area) continue;
    const near = e.polys[0][0].some(p => distPolys(p, o.polys) <= HOST_M || insidePolys(p, o.polys));
    if (near && (!host || o.area > host.area)) host = o;
  }
  if (!host) return;
  slender.push({ id: e.id, base: e.base, top: e.top, thicknessM: +t.toFixed(2), areaM2: +e.area.toFixed(1), colour: e.colour ?? null, host: host.id, at: lngLat(e.c), centrum: inCentrum(e.c) });
});

const sum = (xs: number[]) => +xs.reduce((s, x) => s + x, 0).toFixed(0);
const visiblePairs = pairs.filter(p => p.coplanarWallM >= 1);
const report = {
  generated: new Date().toISOString().slice(0, 10),
  tolerances: { BASE_M, MIN_OVERLAP_M2, MIN_OVERLAP_SHARE, TOP_GAP_M, SAMPLE_M, COPLANAR_M, SLENDER_M, HOST_M },
  features: list.length,
  interpenetrating: {
    pairs: pairs.length, overlapM2: sum(pairs.map(p => p.overlapM2)), hiddenWallM: sum(pairs.map(p => p.hiddenWallM)), coplanarWallM: sum(pairs.map(p => p.coplanarWallM)),
    centrumPairs: pairs.filter(p => p.centrum).length, centrumOverlapM2: sum(pairs.filter(p => p.centrum).map(p => p.overlapM2)),
    pairsWithCoplanarWall: visiblePairs.length,
    top: [...pairs].sort((a, b) => b.overlapM2 - a.overlapM2).slice(0, 10),
    topCoplanar: [...pairs].sort((a, b) => b.coplanarWallM - a.coplanarWallM).slice(0, 10),
  },
  slenderRule: (() => {
    const gone = allList.filter(e => ruleDropped.has(e.id));
    return { dropped: gone.length, centrum: gone.filter(e => inCentrum(e.c)).length, wallAreaM2: sum(gone.map(e => e.perim * (e.top - e.base))),
      centrumIds: gone.filter(e => inCentrum(e.c)).map(e => ({ id: e.id, base: e.base, top: e.top, at: lngLat(e.c) })),
      top: [...gone].sort((a, b) => b.perim * (b.top - b.base) - a.perim * (a.top - a.base)).slice(0, 10).map(e => ({ id: e.id, base: e.base, top: e.top, areaM2: +e.area.toFixed(1), at: lngLat(e.c), centrum: inCentrum(e.c) })) };
  })(),
  slender: {
    note: 'measured with the slender rule off; parts the rule drops are in slenderRule',
    parts: slender.length, centrum: slender.filter(s => s.centrum).length,
    floating: slender.filter(s => s.base > BASE_M).length,
    byColour: Object.fromEntries([...slender.reduce((m, s) => m.set(s.colour ?? 'none', (m.get(s.colour ?? 'none') ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])),
    top: [...slender].sort((a, b) => (b.top - b.base) * b.areaM2 / b.thicknessM - (a.top - a.base) * a.areaM2 / a.thicknessM).slice(0, 10),
  },
};
const text = JSON.stringify(report, null, 1);
if (out) fs.writeFileSync(out, text + '\n');
console.log(text);
