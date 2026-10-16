// Which street triangles lie inside a junction fill polygon (the red cycle-lane smear at junctions).
//
//   npx tsx scripts/own-ground/probe-junction-overlap.ts <lng> <lat> [radiusM=60] [layer=cycle]
//   npx tsx scripts/own-ground/probe-junction-overlap.ts --pairs <lng> <lat> [radiusM=30] [roads=1]
//
// --pairs (roads-v1): builds the 3×3 cells around the point (with the BGT partition unless roads=0) and counts, for
// every pair of road layers {asphalt, klinker, cycle, paving, gravel}, the triangles of A within the radius whose
// centroid lies inside a triangle of B and under its plane or within 5 mm over it: a surface hidden by another or
// in a depth fight with it (surfaces 5 mm or more above another, the painted lane ribbons and the band model's
// stacks, are the design). Counted apart: `hidden` (more than 5 mm under) and `fight` (within ±5 mm). The count
// must be 0 at the named junctions.
//
// Builds every way near the point on its own (flat ground), and counts the
// triangles of `layer` whose centroid falls inside a junction polygon: those
// are drawn over the junction asphalt (cycle outranks asphalt in the depth
// tie-break), so the count must be 0 for the road layers.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { prepareWays, resolvePriorSidewalks, junctionGeometry, buildStreets, type LocalWay } from '../../src/canalRecall/ownGround/streets.ts';

import { buildCell, type BuiltCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';

const ROOT = 'public/data/extracts/amsterdam';
const readExtract = async (path: string) => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
if (process.argv[2] === '--pairs') { await pairs(); process.exit(0); }
const store = new GroundStore(readExtract);
await store.init();
const [lng, lat, radius, layer] = [Number(process.argv[2]), Number(process.argv[3]), Number(process.argv[4] ?? 60), process.argv[5] ?? 'cycle'];
const [x, y] = toLocal(lng, lat);

async function pairs(): Promise<void> {
  const [lng, lat, radius, roads] = [Number(process.argv[3]), Number(process.argv[4]), Number(process.argv[5] ?? 30), process.argv[6] !== '0'];
  const s = new GroundStore(readExtract, { roads });
  await s.init();
  const [x, y] = toLocal(lng, lat), key = s.cellAt(x, y);
  const cells: BuiltCell[] = [];
  for (const k of GroundStore.neighbours(key).filter(k => s.covers(k))) cells.push(buildCell(await s.cellInput(k, 0)));
  const LAYERS = ['asphalt', 'klinker', 'cycle', 'paving', 'gravel'] as const;
  type Tri = { cx: number; cy: number; cz: number; a: number; b: number; c: number; p: Float32Array };
  const tris: Record<string, Tri[]> = {};
  for (const l of LAYERS) {
    tris[l] = [];
    for (const c of cells) {
      const m = c.layers[l];
      if (!m) continue;
      const p = m.positions, idx = m.indices;
      for (let t = 0; t < idx.length; t += 3) {
        const a = idx[t] * 3, b = idx[t + 1] * 3, k = idx[t + 2] * 3, cx = (p[a] + p[b] + p[k]) / 3, cy = (p[a + 1] + p[b + 1] + p[k + 1]) / 3;
        if (Math.hypot(cx - x, cy - y) > radius + 30) continue;
        tris[l].push({ cx, cy, cz: (p[a + 2] + p[b + 2] + p[k + 2]) / 3, a, b, c: k, p });
      }
    }
  }
  const zAt = (t: Tri, px: number, py: number): number | null => {
    const p = t.p, A = t.a, B = t.b, C = t.c;
    const d = (p[B + 1] - p[C + 1]) * (p[A] - p[C]) + (p[C] - p[B]) * (p[A + 1] - p[C + 1]);
    if (Math.abs(d) < 1e-12) return null;
    const u = ((p[B + 1] - p[C + 1]) * (px - p[C]) + (p[C] - p[B]) * (py - p[C + 1])) / d, v = ((p[C + 1] - p[A + 1]) * (px - p[C]) + (p[A] - p[C]) * (py - p[C + 1])) / d;
    if (u < -1e-9 || v < -1e-9 || u + v > 1 + 1e-9) return null;
    return u * p[A + 2] + v * p[B + 2] + (1 - u - v) * p[C + 2];
  };
  const counts: Record<string, number> = {}, lanes: Record<string, number> = {};
  // PAIRS_VERBOSE=1: the first overlaps of each pair with the polygons under them (RoadIndex) and the heights above the relief.
  const verbose = process.env.PAIRS_VERBOSE === '1';
  const input = await s.cellInput(key, 0);
  const index = roads && (input.roads || input.roadsAround?.some(Boolean)) ? new RoadIndex([input.roads, ...(input.roadsAround ?? [])]) : null;
  let total = 0;
  for (const A of LAYERS) for (const B of LAYERS) {
    if (A === B) continue;
    let n = 0, lane = 0;
    for (const t of tris[A]) {
      if (Math.hypot(t.cx - x, t.cy - y) > radius) continue;
      for (const u of tris[B]) {
        if (Math.abs(u.cx - t.cx) > 30 || Math.abs(u.cy - t.cy) > 30) continue;
        const z = zAt(u, t.cx, t.cy);
        if (z === null || t.cz - z >= 0.005) continue;
        if (t.cz - z < -0.005) lane++; else n++;
        if (verbose && n + lane <= 4) console.log(`  ${A} ${t.cz - z < -0.005 ? 'under' : 'fighting'} ${B} at ${t.cx.toFixed(1)},${t.cy.toFixed(1)} dz ${(t.cz - z).toFixed(3)} above relief ${(t.cz - s.surface.ground(t.cx, t.cy)).toFixed(3)}/${(z - s.surface.ground(t.cx, t.cy)).toFixed(3)} deckWeight ${s.surface.deckWeight(t.cx, t.cy).toFixed(2)} polygons ${index ? index.findAll(t.cx, t.cy).map(k => `${index.records[k].c}/${index.records[k].k}/h${index.records[k].h}${k < index.own ? '' : '(around)'}`).join(' ') : '-'}`);
        break;
      }
    }
    if (n) counts[`${A} with ${B}`] = n;
    if (lane) lanes[`${A} under ${B}`] = lane;
    total += n + lane;
  }
  console.log(JSON.stringify({ at: [lng, lat], radiusM: radius, roads, cells: cells.map(c => c.key), triangles: Object.fromEntries(LAYERS.map(l => [l, tris[l].filter(t => Math.hypot(t.cx - x, t.cy - y) <= radius).length])), fight: counts, hidden: lanes }));
  console.log(`road-layer triangles hidden under or fighting another within ${radius} m: ${total}`);
}
const input = await store.cellInput(store.cellAt(x, y), 0);
const seen = new Set<number>(), all: LocalWay[] = [];
for (const e of [input.osm, ...input.osmAround]) if (e) for (const w of prepareWays(e.ways, input.project)) if (!seen.has(w.id)) { seen.add(w.id); all.push(w); }
const ways = resolvePriorSidewalks(all);
const nodes = junctionGeometry(ways);
const inPoly = (poly: readonly number[][], px: number, py: number) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; } return c; };
const near = [...nodes.values()].filter(n => n.kind === 'junction' && Math.hypot(n.p[0] - x, n.p[1] - y) < radius);
console.log(`junction nodes within ${radius} m: ${near.length}`);
const rows: Record<string, number> = {};
let total = 0;
for (const w of ways) {
  if (!w.points.some(q => Math.hypot(q[0] - x, q[1] - y) < radius + 30)) continue;
  const m = (buildStreets(ways, () => 0, { step: 3, only: q => q.id === w.id }) as unknown as Record<string, { positions: number[]; indices: number[] }>)[layer];
  const p = m.positions;
  for (let t = 0; t < m.indices.length; t += 3) {
    const a = m.indices[t] * 3, b = m.indices[t + 1] * 3, c = m.indices[t + 2] * 3;
    const cx = (p[a] + p[b] + p[c]) / 3, cy = (p[a + 1] + p[b + 1] + p[c + 1]) / 3;
    if (Math.hypot(cx - x, cy - y) > radius) continue;
    for (const n of near) if (inPoly(n.polygon, cx, cy)) { const k = `way ${w.id} (${w.tags.highway} ${w.tags.name ?? ''}) in junction at ${n.p.map(v => v.toFixed(0)).join(',')} owner ${n.owner}`; rows[k] = (rows[k] ?? 0) + 1; total++; }
  }
}
console.log(rows);
console.log(`${layer} triangles inside junction polygons: ${total}`);
