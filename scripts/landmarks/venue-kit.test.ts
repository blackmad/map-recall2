import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import type {Frame} from './nearbar-kit';
import {setSink} from './nearbar-kit';
import {arcLettering, clipRingByLine, clipRingByY, cutFrontWalls, insidePoly, modillionCentres, pedimentOutline, pedimentSolid, profileGeometry, segDist, TriSink, verticalLettering} from './venue-kit';

/** BuildingTools that only collects geometries per colour. */
const collector = () => {
  const got: {g: T.BufferGeometry; c: string}[] = [];
  return {b: {add: (g: T.BufferGeometry, c: string) => { got.push({g, c}); }} as unknown as BuildingTools, got};
};
const boxOf = (gs: T.BufferGeometry[]) => { const bb = new T.Box3(); for (const g of gs) { g.computeBoundingBox(); bb.union(g.boundingBox!); } return bb; };
/** A wall along +x with the kit's outward normal n = (-tz, tx) = +z. */
const F: Frame = {origin: [0, 0], tangent: [1, 0], n: [0, 1]};

test('clipRingByLine keeps one side of a vertical plane and stays planar', () => {
  // a sloping roof plane y = x / 2 over the square 0..4 x 0..4
  const ring = [[0, 0, 0], [4, 2, 0], [4, 2, 4], [0, 0, 4]];
  const left = clipRingByLine(ring, [2, 0], [2, 4], 1), right = clipRingByLine(ring, [2, 0], [2, 4], -1);
  const xs = (r: number[][]) => r.map(p => p[0]);
  assert.ok(xs(left).every(x => x <= 2 + 1e-9) || xs(left).every(x => x >= 2 - 1e-9));
  assert.ok(Math.min(...xs(left)) < 2 !== Math.min(...xs(right)) < 2, 'the two sides differ');
  for (const p of [...left, ...right]) assert.ok(Math.abs(p[1] - p[0] / 2) < 1e-9, 'clipped points lie in the plane');
  assert.deepEqual(clipRingByLine(ring, [10, 0], [10, 4], xs(left)[0] < 2 ? -1 : 1).length, 0);
});

test('insidePoly and segDist', () => {
  const sq: [number, number][] = [[0, 0], [4, 0], [4, 4], [0, 4]];
  assert.ok(insidePoly([2, 2], sq));
  assert.ok(!insidePoly([5, 2], sq));
  const q = segDist([2, 3], [0, 0], [4, 0]);
  assert.equal(q.d, 3); assert.equal(q.u, 0.5);
});

test('modillionCentres spans both ends at no more than the pitch', () => {
  const c = modillionCentres(1, 11, 0.6);
  assert.equal(c[0], 1); assert.ok(Math.abs(c[c.length - 1] - 11) < 1e-9);
  for (let i = 1; i < c.length; i++) assert.ok(c[i] - c[i - 1] >= 0.6 - 1e-9 && c[i] - c[i - 1] < 1.2);
  assert.deepEqual(modillionCentres(0, 0.2, 1), [0, 0.2]);
});

test('pedimentOutline insets every side by the same distance', () => {
  const w = 4.7, h = 1.3, inset = 0.18, outer = pedimentOutline(w, h), inner = pedimentOutline(w, h, inset);
  assert.deepEqual(outer[2], [0, h]);
  const dist = (p: [number, number], a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    return Math.abs(dx * (a[1] - p[1]) - dy * (a[0] - p[0])) / Math.hypot(dx, dy);
  };
  for (const p of inner) {
    const d = Math.min(dist(p, outer[0], outer[1]), dist(p, outer[1], outer[2]), dist(p, outer[2], outer[0]));
    assert.ok(Math.abs(d - inset) < 1e-9, `inner vertex ${p} is ${d} from the outer outline`);
  }
});

test('pedimentSolid stays inside its outline and the tympanum sits behind the rakes', () => {
  setSink(0);
  const {b, got} = collector();
  pedimentSolid(b, F, 5, 10, 4, 1.2, {d: 0.3, rake: 0.2, tymp: 'white', trim: 'stone'});
  const bb = boxOf(got.map(x => x.g));
  assert.ok(bb.min.x >= 3 - 1e-6 && bb.max.x <= 7 + 1e-6 && bb.min.y >= 10 - 1e-6 && bb.max.y <= 11.2 + 1e-6);
  const tymp = boxOf(got.filter(x => x.c === 'white').map(x => x.g)), trim = boxOf(got.filter(x => x.c === 'stone').map(x => x.g));
  assert.ok(tymp.max.z < trim.max.z, 'tympanum is shallower than the rakes');
});

test('verticalLettering reads upward and stays within its column', () => {
  setSink(0);
  const {b, got} = collector(), px = 0.05;
  const width = verticalLettering(b, F, 'ARTI', 2, 5, px, 0.02, 'white');
  assert.ok(got.length > 0);
  const bb = boxOf(got.map(x => x.g));
  assert.ok(bb.min.y >= 5 - 1e-9 && Math.abs(bb.max.y - (5 + width)) < px + 1e-5, 'text runs up the wall over its width');
  assert.ok(bb.max.x - bb.min.x <= 7 * px + 1e-5, 'glyph height lies across the column');
});

test('profileGeometry extrudes outwards with outward-facing windings', () => {
  const g = profileGeometry(F, 0, 3, [[0, 0], [0.4, 0], [0.4, 0.3], [0, 0.3]]);
  const bb = boxOf([g]);
  assert.ok(Math.abs(bb.max.z - 0.4) < 1e-6 && Math.abs(bb.min.z) < 1e-6 && Math.abs(bb.max.x - 3) < 1e-6);
  // signed volume of a closed outward-wound mesh is positive
  const p = g.getAttribute('position'); let vol = 0;
  for (let i = 0; i < p.count; i += 3) {
    const a = new T.Vector3().fromBufferAttribute(p, i), c = new T.Vector3().fromBufferAttribute(p, i + 1), d = new T.Vector3().fromBufferAttribute(p, i + 2);
    vol += a.dot(c.clone().cross(d)) / 6;
  }
  assert.ok(Math.abs(vol - 3 * 0.4 * 0.3) < 1e-6, `volume ${vol}`);
});

test('TriSink winds each triangle to the wanted normal and drops degenerate ones', () => {
  const s = new TriSink();
  s.tri('stone', [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, -1]);
  s.tri('stone', [0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 0, 1]);
  const t = s.tris.get('stone')!;
  assert.equal(t.length, 9);
  const u = [t[3] - t[0], t[4] - t[1], t[5] - t[2]], v = [t[6] - t[0], t[7] - t[1], t[8] - t[2]];
  assert.ok(u[0] * v[1] - u[1] * v[0] < 0);
});

test('clipRingByY keeps the gable above a section top and drops slivers', () => {
  const gable = [[0, 0, 0], [6, 0, 0], [6, 10, 0], [3, 13, 0], [0, 10, 0]];
  const top = clipRingByY(gable, 10, 1);
  assert.ok(top.every(p => p[1] >= 10 - 1e-9));
  assert.equal(top.length, 3);
  const low = clipRingByY(gable, 10, -1);
  assert.ok(low.every(p => p[1] <= 10 + 1e-9) && low.length === 4);
  assert.deepEqual(clipRingByY(gable, 12.99, 1), []);
});

test('arcLettering centres the text on the arc top and keeps every run on the radius band', () => {
  setSink(0);
  const {b, got} = collector(), px = 0.03, r = 4, ct = 23.9, cy = 1;
  const span = arcLettering(b, F, 'DE CLUB', ct, cy, r, px, 0.03, 'stone');
  assert.ok(span > 0 && span < Math.PI / 2);
  const bb = boxOf(got.map(x => x.g));
  assert.ok(Math.abs((bb.min.x + bb.max.x) / 2 - ct) < 0.05, 'centred on the arc');
  assert.ok(bb.max.y <= cy + r + 7 * px + 0.02 && bb.max.y > cy + r, 'top letters sit on the radius');
  assert.ok(bb.min.y > cy + r * Math.cos(span / 2) - 0.1, 'ends follow the arc down');
});

test('cutFrontWalls keeps each range of a front wall only above its drawn top', () => {
  // a 10 m front along +x (outward normal +z), 8 m tall; a back wall 5 m in stays untouched
  const front = {type: 'WallSurface', rings: [[[0, 0, 0], [10, 0, 0], [10, 8, 0], [0, 8, 0]]]} as const;
  const back = {type: 'WallSurface', rings: [[[0, 0, -5], [10, 0, -5], [10, 8, -5], [0, 8, -5]]]} as const;
  const out = cutFrontWalls([front, back] as never, [[0, 0], [10, 0]], {a: [0, 0], b: [10, 0]}, [[-1, 4, 6], [4, 11, 9]]);
  assert.equal(out.length, 2, 'the second range is above the wall top, so only the first range and the back wall remain');
  const kept = out.find(s => s.rings[0].every(p => p[2] === 0))!;
  assert.ok(kept.rings[0].every(p => p[1] >= 6 - 1e-9 && p[0] <= 4 + 1e-9));
  assert.ok(out.includes(back as never));
});
