// Which street triangles lie inside a junction fill polygon (the red cycle-lane smear at junctions).
//
//   npx tsx scripts/own-ground/probe-junction-overlap.ts <lng> <lat> [radiusM=60] [layer=cycle]
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

const ROOT = 'public/data/extracts/amsterdam';
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
await store.init();
const [lng, lat, radius, layer] = [Number(process.argv[2]), Number(process.argv[3]), Number(process.argv[4] ?? 60), process.argv[5] ?? 'cycle'];
const [x, y] = toLocal(lng, lat);
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
