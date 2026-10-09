/** Geometry gate for the Pathé de Munt landmark (scripts/landmarks/pathe-de-munt-builder.ts).
 *   npx tsx scripts/check-pathe-de-munt-geometry.ts
 * - height matches the 3DBAG LoD2.2 survey; the blade sign never rises above it;
 * - every vertex stays inside the BAG footprint, except the blade sign (<= 1 m over the pavement);
 * - no detached or floating parts: starting from the 3DBAG shell, every facade facet, detail and
 *   sign part must lie within 5 cm of something already attached; the max such gap is reported;
 * - the folded facets stay under the surveyed parapet roof (looking down, the shell is hit first);
 * - triangle budget <= 12k.
 */
import assert from 'node:assert/strict';
import * as T from 'three';
import type {BuildingTools} from './landmarks/cultural-builders';
import {buildPatheDeMunt} from './landmarks/pathe-de-munt-builder';
import data from './landmarks/pathe-de-munt-footprints.json';

type Part = {g: T.BufferGeometry; role: string; colour: string; tris: T.Triangle[]; box: T.Box3};
const parts: Part[] = [];
const push = (g: T.BufferGeometry, colour: string) => {
  const n = g.index ? g.toNonIndexed() : g, p = n.getAttribute('position'), tris: T.Triangle[] = [];
  for (let i = 0; i < p.count; i += 3) tris.push(new T.Triangle(new T.Vector3().fromBufferAttribute(p, i), new T.Vector3().fromBufferAttribute(p, i + 1), new T.Vector3().fromBufferAttribute(p, i + 2)));
  n.computeBoundingBox();
  parts.push({g: n, role: g.userData.role ?? 'unknown', colour, tris, box: n.boundingBox!.clone()});
};
const add: BuildingTools['add'] = (g, c, x = 0, y = 0, z = 0, a = 0) => { const role = g.userData.role; g.rotateY(a); g.translate(x, y, z); g.userData.role = role; push(g, c); };
const unsupported = () => { throw Error('pathe builder must route everything through add()'); };
buildPatheDeMunt(0, 0, {add, box: unsupported, prism: unsupported, gableRoof: unsupported, hip: unsupported, window: unsupported, clock: unsupported, sign: unsupported} as unknown as BuildingTools, (g, hex) => push(g, hex));

for (const p of parts) assert.ok(['shell', 'facade', 'detail', 'sign'].includes(p.role), `untagged part (${p.colour})`);
const triangles = parts.reduce((s, p) => s + p.tris.length, 0);
assert.ok(triangles <= 12000, `triangle budget: ${triangles}`);

// Height against the survey.
const roofMax = Math.max(...data.roofs.flatMap(r => r.rings.flat().map(v => v[1])));
const yMax = (pred: (p: Part) => boolean) => Math.max(...parts.filter(pred).map(p => p.box.max.y));
const bodyTop = yMax(p => p.role !== 'sign'), signTop = yMax(p => p.role === 'sign');
assert.ok(Math.abs(bodyTop - roofMax) < 0.2, `body top ${bodyTop} vs 3DBAG ${roofMax}`);
assert.ok(signTop <= roofMax + 0.01, `blade sign ${signTop} rises above the survey ${roofMax}`);
assert.ok(Math.min(...parts.map(p => p.box.min.y)) > -0.03, 'below ground');

// Footprint containment (plan distance outside the BAG ring).
const ring = data.ring[0].map(v => new T.Vector2(v[0], v[1]));
const outside = (x: number, z: number) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > z) !== (b.y > z) && x < (b.x - a.x) * (z - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  if (inside) return 0;
  let best = Infinity;
  for (let i = 0; i + 1 < ring.length; i++) {
    const a = ring[i], b = ring[i + 1], ab = b.clone().sub(a), t = Math.max(0, Math.min(1, new T.Vector2(x, z).sub(a).dot(ab) / Math.max(ab.lengthSq(), 1e-9)));
    best = Math.min(best, a.clone().addScaledVector(ab, t).distanceTo(new T.Vector2(x, z)));
  }
  return best;
};
let bodyOut = 0, signOut = 0, shellOut = 0, detailOut = 0;
for (const p of parts) for (const t of p.tris) for (const v of [t.a, t.b, t.c]) {
  const o = outside(v.x, v.z);
  if (p.role === 'sign') signOut = Math.max(signOut, o); else if (p.role === 'shell') shellOut = Math.max(shellOut, o); else if (p.role === 'detail') detailOut = Math.max(detailOut, o); else bodyOut = Math.max(bodyOut, o);
}
// 3DBAG roof polygons are a separate survey from the BAG ring; they may differ by a few decimetres.
assert.ok(shellOut < 0.5, `3DBAG shell outside the BAG footprint by ${shellOut.toFixed(3)} m`);
assert.ok(bodyOut < 0.05, `authored facade outside the BAG footprint by ${bodyOut.toFixed(3)} m`);
// Surface-mounted poster cases and door frames may stand a few centimetres proud of the street line.
assert.ok(detailOut < 0.15, `details stand ${detailOut.toFixed(3)} m proud of the footprint`);
assert.ok(signOut < 1.0, `blade sign projects ${signOut.toFixed(3)} m`);

// Attachment: grow from the shell; a part attaches when a vertex of either is < 5 cm from a triangle of the other.
const LIMIT = 0.05, scratch = new T.Vector3();
const gapTo = (p: Part, targets: Part[]) => {
  let best = Infinity;
  const verts = p.tris.flatMap(t => [t.a, t.b, t.c]);
  for (const q of targets) {
    if (q.box.distanceToPoint(p.box.getCenter(scratch)) > p.box.getSize(new T.Vector3()).length() / 2 + best) continue;
    // both directions, so face-to-face contact (a bracket under a panel) counts
    for (const [tris, pts] of [[q.tris, verts], [p.tris, q.tris.flatMap(t => [t.a, t.b, t.c])]] as const) for (const t of tris) for (const v of pts) {
      t.closestPointToPoint(v, scratch);
      const d = scratch.distanceTo(v);
      if (d < best) { best = d; if (best === 0) return 0; }
    }
  }
  return best;
};
const attached = parts.filter(p => p.role === 'shell'), pending = parts.filter(p => p.role !== 'shell'), gaps = new Map<Part, number>();
for (let progress = true; progress && pending.length;) {
  progress = false;
  for (let i = pending.length - 1; i >= 0; i--) {
    const g = gapTo(pending[i], attached);
    if (g < LIMIT) { gaps.set(pending[i], g); attached.push(pending[i]); pending.splice(i, 1); progress = true; }
  }
}
const floating = pending.map(p => ({role: p.role, colour: p.colour, gap: +gapTo(p, attached).toFixed(3), at: p.box.getCenter(new T.Vector3()).toArray().map(n => +n.toFixed(2))}));
assert.deepEqual(floating, [], 'detached / floating parts');
// Facade facets must touch the shell or a neighbouring facet (shared edges, no slivers).
// Report each part's final gap to the nearest other attached surface (BFS order can overstate it).
for (const p of gaps.keys()) gaps.set(p, gapTo(p, attached.filter(q => q !== p)));
if (process.env.DEBUG) for (const [p, g] of gaps) if (g > 0.01) console.log('gap', p.role, p.colour, g.toFixed(3), p.box.getCenter(new T.Vector3()).toArray().map(n => +n.toFixed(2)));
const maxGap = (role: string) => Math.max(0, ...[...gaps].filter(([p]) => p.role === role).map(([, g]) => g));

// Folded facets stay below the surveyed parapet roof: from above, the front zone shows shell roof first.
const meshes = parts.map(p => { const m = new T.Mesh(p.g, new T.MeshBasicMaterial({side: T.DoubleSide})); m.userData.role = p.role; return m; });
const [A, C] = [data.ring[0][1], data.ring[0][2]], L = Math.hypot(C[0] - A[0], C[1] - A[1]), t = [(C[0] - A[0]) / L, (C[1] - A[1]) / L], inward = [t[1], -t[0]];
let roofProbes = 0;
for (let U = 1; U < 19.6; U += 0.75) for (const d of [0.4, 1.2, 2.0]) {
  const x = A[0] + t[0] * U + inward[0] * d, z = A[1] + t[1] * U + inward[1] * d;
  const hit = new T.Raycaster(new T.Vector3(x, 40, z), new T.Vector3(0, -1, 0)).intersectObjects(meshes, false).find(h => h.object.userData.role !== 'sign');
  assert.ok(hit && hit.object.userData.role === 'shell', `facade pokes through the parapet roof at U=${U.toFixed(2)} d=${d}: ${hit?.object.userData.role} y=${hit?.point.y.toFixed(2)}`);
  roofProbes++;
}

console.log(JSON.stringify({passed: true, triangles, parts: parts.length, roofMax: +roofMax.toFixed(2), bodyTop: +bodyTop.toFixed(2), signTop: +signTop.toFixed(2),
  bodyOutsideFootprintM: +bodyOut.toFixed(3), shellOutsideFootprintM: +shellOut.toFixed(3), detailProudM: +detailOut.toFixed(3), signProjectionM: +signOut.toFixed(3),
  maxAttachmentGapM: {facade: +maxGap('facade').toFixed(4), detail: +maxGap('detail').toFixed(4), sign: +maxGap('sign').toFixed(4)}, roofProbes}));
