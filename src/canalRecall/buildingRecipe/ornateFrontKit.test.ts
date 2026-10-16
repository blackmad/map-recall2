import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TriSink, at, band, box, coping, cresting, disc, drum, frame, frustum, grown, hipRoofX, normalOf, opening, openingOutline, panel,
  prismX, prismZ, quoins, rect, reveal, slab, spire, strip, type V3,
} from './ornateFrontKit.ts';

const normal = (a: number[], i: number): V3 => {
  const p = (k: number) => [a[i + k * 3], a[i + k * 3 + 1], a[i + k * 3 + 2]];
  const A = p(0), B = p(1), C = p(2), u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
};
const allNormals = (s: TriSink, c: string) => { const a = s.tris.get(c) ?? [], out: V3[] = []; for (let i = 0; i < a.length; i += 9) out.push(normal(a, i)); return out; };
const area = (s: TriSink, c: string) => allNormals(s, c).reduce((t, n) => t + Math.hypot(...n) / 2, 0);
/** Every edge of a closed solid is used once in each direction. */
function closed(s: TriSink, c: string) {
  const a = s.tris.get(c)!, key = (i: number) => `${a[i].toFixed(4)},${a[i + 1].toFixed(4)},${a[i + 2].toFixed(4)}`, edges = new Map<string, number>();
  for (let i = 0; i < a.length; i += 9) for (let k = 0; k < 3; k++) { const e = `${key(i + k * 3)}>${key(i + ((k + 1) % 3) * 3)}`; edges.set(e, (edges.get(e) ?? 0) + 1); }
  for (const e of edges.keys()) { const [p, q] = e.split('>'); if (edges.get(`${q}>${p}`) !== edges.get(e)) return false; }
  return true;
}
/** Outward: the solid's triangles' normals point away from its centroid on average (signed volume positive). */
const volume = (s: TriSink, c: string) => { const a = s.tris.get(c)!; let v = 0; for (let i = 0; i < a.length; i += 9) { const n = normal(a, i); v += (a[i] * n[0] + a[i + 1] * n[1] + a[i + 2] * n[2]) / 6; } return v; };

test('frames: +x wall faces +z, an east end faces +x; panels face out', () => {
  assert.deepEqual(normalOf(frame([0, 0], [1, 0])), [-0, 1]);
  assert.deepEqual(normalOf(frame([0, 0], [0, -1])), [1, 0]);
  const s = new TriSink();
  panel(s, 'w', frame([0, 0], [1, 0]), rect(0, 4, 0, 3), [rect(1, 2, 1, 2)]);
  for (const n of allNormals(s, 'w')) assert.ok(n[2] > 0 && Math.abs(n[0]) < 1e-9 && Math.abs(n[1]) < 1e-9);
  assert.ok(Math.abs(area(s, 'w') - 11) < 1e-6, 'panel area excludes the hole');
  const e = new TriSink();
  panel(e, 'w', frame([5, 0], [0, -1]), rect(0, 2, 0, 2));
  for (const n of allNormals(e, 'w')) assert.ok(n[0] > 0);
  assert.deepEqual(at(frame([5, 0], [0, -1]), 1, 2, 0.5), [5.5, 2, -1]);
});

test('opening outlines: heads, sizes and winding', () => {
  for (const head of ['flat', 'segment', 'round', 'pointed'] as const) {
    const o = {t: 0, y: 1, w: 2, h: 3, head, rise: head === 'segment' ? 0.3 : undefined};
    const r = openingOutline(o), ys = r.map(p => p[1]), xs = r.map(p => p[0]);
    assert.ok(Math.abs(Math.max(...ys) - 4) < 1e-9 && Math.abs(Math.min(...ys) - 1) < 1e-9, head);
    assert.ok(Math.abs(Math.max(...xs) - 1) < 1e-9 && Math.abs(Math.min(...xs) + 1) < 1e-9, head);
    const signed = r.reduce((t, p, i) => t + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0);
    assert.ok(signed > 0, `${head} outline is counter-clockwise`);
  }
  const g = grown({t: 0, y: 1, w: 2, h: 3}, 0.2, 0.1);
  assert.deepEqual([g.w, g.y, g.h].map(v => +v.toFixed(6)), [2.4, 0.9, 3.3]);
});

test('opening: reveals face into the hole, glass recessed, bars in front of the glass', () => {
  const s = new TriSink(), f = frame([0, 0], [1, 0]);
  opening(s, f, {t: 0, y: 1, w: 2, h: 3}, {depth: 0.2, mullions: 1, transoms: [0.5], panes: [2, 2], mullion: 'm', bar: 'b'});
  const sill = allNormals(s, 'stone').find(n => Math.abs(n[1]) > 1e-9 && Math.abs(n[0]) < 1e-9)!;
  assert.ok(sill[1] > 0, 'sill reveal faces up');
  const g = s.tris.get('glass')!;
  for (let i = 2; i < g.length; i += 3) assert.ok(Math.abs(g[i] + 0.2) < 1e-9, 'glass at the recess depth');
  for (let i = 2; i < s.tris.get('m')!.length; i += 3) assert.ok(s.tris.get('m')![i] > -0.2 + 0.03, 'bars at least 3 cm proud of the glass');
  assert.equal(s.tris.get('m')!.length / 9, 4, 'one mullion and one transom, two triangles each');
});

test('closed solids are closed and wound outward', () => {
  const cases: [string, (s: TriSink) => void][] = [
    ['box', s => box(s, 'x', 0, 2, 0, 1, 0, 3)],
    ['prismX', s => prismX(s, 'x', [[0, 0], [-2, 3], [-4, 0]], 0, 5)],
    ['prismX reversed profile', s => prismX(s, 'x', [[-4, 0], [-2, 3], [0, 0]], 0, 5)],
    ['prismZ', s => prismZ(s, 'x', [[0, 0], [4, 0], [2, 3]], -5, 0)],
    ['frustum', s => frustum(s, 'x', 0, 4, 0, 3, 0, 2, [1, 0.5], true)],
    ['pyramid', s => frustum(s, 'x', 0, 4, 0, 4, 0, 2, 2, true)],
    ['spire', s => spire(s, 'x', 1, 1, 0, 3, 0.5, 0.3, 8, true)],
    ['cone', s => spire(s, 'x', 1, 1, 0, 3, 0.5, 0, 6, true)],
  ];
  for (const [name, make] of cases) {
    const s = new TriSink(); make(s);
    assert.ok(closed(s, 'x'), `${name} closed`);
    assert.ok(volume(s, 'x') > 0, `${name} wound outward`);
  }
});

test('roofs: hipped and gabled ends face out and up', () => {
  const s = new TriSink();
  hipRoofX(s, 'r', 0, 20, 0, -10, 10, 15, -5, ['gable', 'hip'], 5);
  const ns = allNormals(s, 'r');
  assert.equal(ns.length, 6);
  assert.ok(ns.filter(n => n[1] > 0).length === 5, 'four roof planes and the hip face up; the gable cap is vertical');
  assert.ok(ns.some(n => n[0] < 0 && Math.abs(n[1]) < 1e-9), 'west gable faces west');
  assert.ok(ns.some(n => n[0] > 0 && n[1] > 0), 'east hip faces east and up');
});

test('wall details: slabs, bands broken by openings, quoins, discs, strips, cresting, reveals', () => {
  const s = new TriSink(), f = frame([0, 0], [1, 0]);
  slab(s, 'a', f, 0, 1, 0, 1, 0, 0.1); assert.equal(s.tris.get('a')!.length / 9, 10);
  slab(s, 'a2', f, 0, 1, 0, 1, 0, 0.1, false); assert.equal(s.tris.get('a2')!.length / 9, 6);
  band(s, 'b', f, 0, 10, 2, 2.2, 0.08, [{t: 3, y: 1, w: 2, h: 3}, {t: 7, y: 1, w: 2, h: 3}]);
  assert.equal(s.tris.get('b')!.length / 9, 3 * 10, 'three piers between two openings');
  quoins(s, 'q', f, 0, 0, 4, 0.5, 0.8, 0.4, 0.1, 1); assert.equal(s.tris.get('q')!.length / 9, 4 * 6);
  disc(s, 'd', f, 0, 0, 1, 0.1, 12); assert.equal(s.tris.get('d')!.length / 9, 12);
  drum(s, 'dr', f, 0, 0, 1, 0, 0.1, 10); assert.equal(s.tris.get('dr')!.length / 9, 30);
  strip(s, 's', f, [0, 0], [1, 1], 0.1, 0.05); coping(s, 'c', f, [0, 0], [2, 1], 0.3, 0, 0.2);
  for (const n of allNormals(s, 's')) assert.ok(n[2] > 0);
  cresting(s, 'cr', f, 0, 4, 10, 0.5, 0.5); assert.equal(s.tris.get('cr')!.length / 9, 2 + 8);
  reveal(s, 'rv', f, rect(0, 1, 0, 1), 0.2); assert.equal(s.tris.get('rv')!.length / 9, 8);
  for (const v of s.tris.values()) assert.ok(v.every(Number.isFinite));
});
