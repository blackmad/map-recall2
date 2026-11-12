// Ground v2 partition (lane G2a #372) on synthetic cells: closure, noding, holes, levels and steps, seams between two
// neighbours, determinism. Real cells are pinned by scripts/own-ground/check-ground-v2.ts.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Rect } from './groundStore';
import { arrange, bakeSurface, LOD0_OPTIONS, LOD1_OPTIONS, splitAtLines, type PartitionGroup, type PartitionFeature, type SurfaceBakeInput, type Vec2 } from './groundPartition';
import { GRID_Q } from './groundV2Format';

const groups: PartitionGroup[] = [
  { name: 'water', rank: 0, layer: null, level: 0, flat: false, source: 'water' },
  { name: 'carriage', rank: 1, layer: 'asphalt', level: 0, flat: false, source: 'bgtCarriage' },
  { name: 'foot', rank: 4, layer: 'paving', level: 1, flat: false, source: 'bgtFoot' },
  { name: 'park', rank: 8, layer: 'lawn', level: 0, flat: true, source: 'park' },
  { name: 'land', rank: 11, layer: 'land', level: 0, flat: true, source: 'land' },
];
const box = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
/** A road running east across both cells, a pavement beside it, a pond, a park overlapping the road (the road wins). */
const features: PartitionFeature[] = [
  { group: 1, id: 'road', rings: [box(-20, 40, 220, 50)] },
  { group: 2, id: 'foot', rings: [[[-20, 50], [220, 50.4], [220, 53], [-20, 53]]] },
  { group: 0, id: 'pond', rings: [box(70, 10, 80, 20)] },
  { group: 3, id: 'park', rings: [box(20, 45, 60, 90), box(30, 60, 40, 70)] },
];
// A gentle slope with a bump: Steiner points and refinement get work, deterministically.
const height = (x: number, y: number) => 0.01 * x - 0.004 * y + 0.4 * Math.exp(-((x - 30) ** 2 + (y - 80) ** 2) / 50);
const input = (key: string, rect: Rect): SurfaceBakeInput => ({ key, rect, groups, features, restGroup: 4, height, levelZ: [0.03, 0.14] });
const A: Rect = [0, 0, 100, 100], B: Rect = [100, 0, 200, 100];

test('arrangement: precedence clip, exact closure, holes kept', () => {
  const a = arrange(input('0_0', A));
  const area = (g: number) => a.pieces.filter(p => p.group === g).flatMap(p => p.poly).reduce((s, poly) => {
    const ra = (r: [number, number][]) => { let v = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) v += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(v / 2); };
    return s + ra(poly[0]) - poly.slice(1).reduce((t, h) => t + ra(h), 0);
  }, 0) / 1e6;
  assert.equal(Math.round(area(0)), 100); // pond
  assert.equal(Math.round(area(1)), 1000); // road across the cell
  // The park (40 × 45) loses the road strip (45..50: 200), the pavement over it (2.9 m deep: 116) and its hole (100).
  assert.equal(Math.round(area(3)), 1384);
  const total = [0, 1, 2, 3, 4].reduce((s, g) => s + area(g), 0);
  assert.ok(Math.abs(total - 10000) < 0.01, `closure ${total}`);
});

test('splitAtLines: the seam crossing is one integer, whichever way the segment runs', () => {
  const rect: Rect = [0, 0, 100000, 100000];
  const f = splitAtLines([[-5000, 1234], [5000, 9877], [5000, 20000], [-5000, 1234]], rect);
  const r = splitAtLines([[-5000, 1234], [5000, 20000], [5000, 9877], [-5000, 1234]], rect);
  const onSeam = (ring: [number, number][]) => ring.filter(p => p[0] === 0).map(p => p.join(',')).sort();
  assert.deepEqual(onSeam(f), onSeam(r));
  assert.equal(onSeam(f).length, 2);
});

test('bake: a closed partition, no cracks, water dropped, kerb steps between levels', () => {
  const b = bakeSurface(input('0_0', A), LOD0_OPTIONS);
  assert.ok(Math.abs(b.stats.closureM2) < 0.01);
  assert.equal(b.stats.unclassified, 0);
  assert.equal(b.stats.failedEdges.length, 0);
  // Drawn area: the rect minus the pond.
  const drawn = b.stats.triM2.reduce((s, a, g) => s + (g === 0 ? 0 : a), 0);
  assert.ok(Math.abs(drawn - 9900) < 0.5, `drawn ${drawn}`);
  // The road / pavement boundary is a step: duplicated vertices joined by a strip.
  assert.ok(b.stats.stepTriangles > 0);
  const lifted = [...b.level].filter(l => l === 1).length;
  assert.ok(lifted > 0);
  // Every vertex sits at relief + its level's lift (mm).
  for (let i = 0; i < b.u.length; i += 7) {
    const x = A[0] + b.u[i] / GRID_Q * 100, y = A[1] + b.v[i] / GRID_Q * 100;
    assert.ok(Math.abs(b.zMm[i] - Math.round((height(x, y) + [0.03, 0.14][b.level[i]]) * 1000)) <= 1);
  }
  assert.ok(b.stats.errP999 <= 50, `float p99.9 ${b.stats.errP999} mm`);
});

test('seams: two neighbours bake identical vertices along their shared side', () => {
  const a = bakeSurface(input('0_0', A), LOD0_OPTIONS), b = bakeSurface(input('1_0', B), LOD0_OPTIONS);
  const side = (s: typeof a, u: number) => [...s.u.keys()].filter(i => s.u[i] === u).map(i => `${s.v[i]}:${s.zMm[i]}:${s.oct[2 * i]},${s.oct[2 * i + 1]}`).sort();
  const east = side(a, GRID_Q), west = side(b, 0);
  assert.ok(east.length > 50);
  assert.deepEqual(east, west);
});

test('determinism: the same input bakes the same arrays', () => {
  const p = bakeSurface(input('0_0', A), LOD0_OPTIONS), q = bakeSurface(input('0_0', A), LOD0_OPTIONS);
  assert.deepEqual([p.u, p.v, p.zMm, p.tris, p.steps].map(a => [...a]), [q.u, q.v, q.zMm, q.tris, q.steps].map(a => [...a]));
});

test('LOD 1: simplified arcs, no steps, still closed and seam-equal', () => {
  const a = bakeSurface(input('0_0', A), LOD1_OPTIONS), b = bakeSurface(input('1_0', B), LOD1_OPTIONS);
  assert.ok(Math.abs(a.stats.closureM2) < 0.01); assert.equal(a.stats.stepTriangles, 0); assert.equal(a.stats.unclassified, 0);
  const side = (s: typeof a, u: number) => [...s.u.keys()].filter(i => s.u[i] === u).map(i => `${s.v[i]}:${s.zMm[i]}`).sort();
  assert.deepEqual(side(a, GRID_Q), side(b, 0));
});

test('floor caps: the cap ring is a constraint, its triangles sit at min(cap, relief), a wall stands where the relief outside is higher, both seams agree', () => {
  // An embankment 3 m high over x 120..180 (the deck's abutments), a deck 20 m wide over y 30..60 straddling the seam
  // at x = 100 and the embankment's west foot. The street under the deck is at 0.
  const bank = (x: number, y: number) => (x > 130 ? 3 : x > 120 ? (x - 120) * 0.3 : 0) + 0.002 * y;
  const ring: Vec2[] = box(90, 30, 150, 60), z = 0;
  const capped = (x: number, y: number) => (x > 90 && x < 150 && y > 30 && y < 60 ? Math.min(z, bank(x, y)) : bank(x, y));
  const inp = (key: string, rect: Rect, caps: boolean): SurfaceBakeInput => ({ key, rect, groups, features: [], restGroup: 4, height: caps ? capped : bank, levelZ: [0.03, 0.14], ...(caps ? { relief: bank, caps: [{ ring, z }] } : {}) });
  const a = bakeSurface(inp('0_0', A, true), LOD0_OPTIONS), b = bakeSurface(inp('1_0', B, true), LOD0_OPTIONS);
  assert.ok(b.stats.capTris > 0);
  assert.equal(b.stats.failedEdges.length, 0);
  // Inside the ring every vertex is at the cap (+ the land lift); the wall: step triangles on the ring at x = 150 and
  // where the bank rises (x > 120), none at the west end (x = 90) where the relief is not above the cap.
  const zIn: number[] = [];
  for (let i = 0; i < b.u.length; i++) { const x = 100 + (b.u[i] / GRID_Q) * 100, y = (b.v[i] / GRID_Q) * 100; if (x > 91 && x < 149 && y > 31 && y < 59) zIn.push(b.zMm[i]); }
  assert.ok(zIn.length > 0 && zIn.every(v => v === 30), `inside ${[...new Set(zIn)].slice(0, 5)}`);
  assert.ok(b.steps.length > 0);
  // Seams: the two cells' vertices on x = 100 match (positions and heights).
  const seam = (s: typeof a, u: number) => { const o: string[] = []; for (let i = 0; i < s.u.length; i++) if (s.u[i] === u) o.push(`${s.v[i]}:${s.zMm[i]}`); return [...new Set(o)].sort(); };
  assert.deepEqual(seam(a, GRID_Q), seam(b, 0));
  // No caps: the bake is the one without the option.
  const plain = bakeSurface(inp('1_0', B, false), LOD0_OPTIONS), none = bakeSurface({ ...inp('1_0', B, false), caps: [] }, LOD0_OPTIONS);
  assert.deepEqual([...none.zMm], [...plain.zMm]);
  assert.deepEqual([...none.tris], [...plain.tris]);
});
