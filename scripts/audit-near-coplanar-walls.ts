// Near-coplanar wall audit (issue #123, Oosterdokseiland striping 2026-10-30).
// `audit-building-coplanar.ts` groups triangles by an exact plane key, so two walls a few
// centimetres or a fraction of a degree apart (OSM building:parts drawn twice, a part and its
// neighbour overlapping a little) never meet in it. This scans the generated ordinary-building
// mesh for SAME-FACING vertical triangles of different buildings that lie within TOL_M of each
// other's plane and overlap on it: those stripe at game distance (depth precision is coarser
// than a few cm at 100 m). Back-to-back party walls face away from each other and are not seen.
//
// Usage: node --import tsx scripts/audit-near-coplanar-walls.ts [--all] [--tile=x/y.geojson.gz]... [--out=path]
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildFeatureChunk } from '../src/canalRecall/threeBuildingFeatures.ts';
import type { Chunk } from '../src/canalRecall/threeBuildingMesh.ts';
import { dropNestedDuplicates } from '../src/canalRecall/buildingNesting.ts';
import { NEAR_COPLANAR_M, polygonArea, subtractConvex, type Point2 } from '../src/canalRecall/coplanarSurfaces.ts';

/** Plane distance that still stripes: the mesh builder's own tolerance. */
export const TOL_M = NEAR_COPLANAR_M;
const COS = Math.cos(2 * Math.PI / 180);
const MIN_AREA_M2 = 0.05;

type Tri = { id: string; n: [number, number]; p: number[][]; box: [number, number, number, number] };
export type NearHit = { ids: [string, string]; areaM2: number; maxOffsetM: number };

export function auditNearCoplanar(chunk: Chunk): NearHit[] {
  const owner = new Array<string>(chunk.vertexCount);
  for (const r of chunk.ranges) owner.fill(r.id, r.start, r.start + r.count);
  const tris: Tri[] = [];
  for (let i = 0; i < chunk.indices.length; i += 3) {
    const p = [0, 1, 2].map(k => Array.from(chunk.positions.slice(chunk.indices[i + k] * 3, chunk.indices[i + k] * 3 + 3)));
    const u = p[1].map((v, k) => v - p[0][k]), v = p[2].map((v, k) => v - p[0][k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...n); if (len < 1e-6) continue;
    // Chunk positions are z-up (east, north, height): a wall has a near-zero z normal.
    if (Math.abs(n[2] / len) > 1e-3) continue;
    const h = Math.hypot(n[0], n[1]);
    const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
    tris.push({ id: owner[chunk.indices[i]], n: [n[0] / h, n[1] / h], p, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
  }
  const CELL = 10, grid = new Map<string, number[]>();
  tris.forEach((t, i) => {
    for (let x = Math.floor((t.box[0] - TOL_M) / CELL); x <= Math.floor((t.box[2] + TOL_M) / CELL); x++)
      for (let z = Math.floor((t.box[1] - TOL_M) / CELL); z <= Math.floor((t.box[3] + TOL_M) / CELL); z++) {
        const key = `${x},${z}`; const b = grid.get(key); if (b) b.push(i); else grid.set(key, [i]);
      }
  });
  const hits = new Map<string, NearHit>();
  const seen = new Set<string>();
  for (const bucket of grid.values()) for (let a = 0; a < bucket.length; a++) for (let b = a + 1; b < bucket.length; b++) {
    const i = Math.min(bucket[a], bucket[b]), j = Math.max(bucket[a], bucket[b]);
    const A = tris[i], B = tris[j];
    if (A.id === B.id) continue;
    if (A.n[0] * B.n[0] + A.n[1] * B.n[1] < COS) continue;
    if (A.box[0] > B.box[2] + TOL_M || B.box[0] > A.box[2] + TOL_M || A.box[1] > B.box[3] + TOL_M || B.box[1] > A.box[3] + TOL_M) continue;
    const key = `${i}:${j}`; if (seen.has(key)) continue; seen.add(key);
    const d0 = A.n[0] * A.p[0][0] + A.n[1] * A.p[0][1];
    const off = Math.max(...B.p.map(q => Math.abs(A.n[0] * q[0] + A.n[1] * q[1] - d0)));
    if (off > TOL_M) continue;
    // Project both onto A's wall plane: s along the wall, z up.
    const sx = -A.n[1], sy = A.n[0];
    const proj = (t: Tri): Point2[] => {
      let poly = t.p.map(q => [q[0] * sx + q[1] * sy, q[2]] as Point2);
      if ((poly[1][0] - poly[0][0]) * (poly[2][1] - poly[0][1]) - (poly[1][1] - poly[0][1]) * (poly[2][0] - poly[0][0]) < 0) poly = poly.toReversed();
      return poly;
    };
    const pa = proj(A), pb = proj(B);
    const overlap = polygonArea(pa) - subtractConvex(pa, pb).reduce((s, p) => s + polygonArea(p), 0);
    if (overlap < MIN_AREA_M2) continue;
    const ids = [A.id, B.id].sort() as [string, string], pk = ids.join('|');
    const hit = hits.get(pk) ?? { ids, areaM2: 0, maxOffsetM: 0 };
    hit.areaM2 += overlap; hit.maxOffsetM = Math.max(hit.maxOffsetM, off); hits.set(pk, hit);
  }
  return [...hits.values()].filter(h => h.areaM2 >= 1).sort((a, b) => b.areaM2 - a.areaM2);
}

if (process.argv[1]?.endsWith('audit-near-coplanar-walls.ts')) {
  const root = 'public/data/extracts/amsterdam/building-tiles/14';
  const named = process.argv.filter(a => a.startsWith('--tile=')).map(a => a.slice(7));
  const tiles = process.argv.includes('--all')
    ? fs.readdirSync(root).flatMap(x => fs.readdirSync(`${root}/${x}`).filter(y => y.endsWith('.gz')).map(y => `${x}/${y}`))
    : named.length ? named : ['8415/5383.geojson.gz'];
  const out = process.argv.find(a => a.startsWith('--out='))?.slice(6);
  const rows: Array<{ tile: string } & NearHit> = [];
  for (const tile of tiles) {
    const source = JSON.parse(gunzipSync(fs.readFileSync(`${root}/${tile}`)).toString());
    for (const h of auditNearCoplanar(buildFeatureChunk(dropNestedDuplicates(source.features), 'photo', 'coarse'))) rows.push({ tile, ...h });
  }
  const ids = new Set(rows.flatMap(r => r.ids));
  const summary = { tiles: tiles.length, pairs: rows.length, buildings: ids.size, areaM2: Math.round(rows.reduce((s, r) => s + r.areaM2, 0)), largest: rows.sort((a, b) => b.areaM2 - a.areaM2).slice(0, 12).map(r => ({ ...r, areaM2: Math.round(r.areaM2), maxOffsetM: +r.maxOffsetM.toFixed(3) })) };
  if (out) { fs.mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true }); fs.writeFileSync(out, JSON.stringify({ summary, rows }, null, 1)); }
  console.log(JSON.stringify(summary, null, 1));
}
