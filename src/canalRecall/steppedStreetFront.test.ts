/**
 * Stepped street fronts (2026-11-21, belt review Herengracht 2-90): named regressions on the BAG footprints the review
 * measured, and the byte-identical guard for fronts that are already one run.
 *
 *   Herengracht 62 (0363100012167493): 3.43 m piece, 1.17 m jog out (the stoop block it shares with 60), 1.75 m stub;
 *     drew 3.43 m of a 5.33 m street span. Absorbed: one 5.18 m front on the 3.43 m piece's line.
 *   Herengracht 6 (0363100012179834): 2.77 m piece, 0.18 m jog back, 1.66 m stub; drew 2.75 m. Absorbed: 4.43 m.
 *   Herengracht 82 (0363100012175703): a plain rectangle on a corner; its footprint is untouched. Its "10.6 m front" was
 *     house preview measuring the longest street run (the side-street wall) under the framed 6.68 m canal front.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { absorbRingSteps, absorbSteppedFront, steppedFronts, withFrontSteps, resetFrontSteps, ringArea2, absorbable, type Edge0, type XY } from './steppedStreetFront.ts';
import { framedRun } from './beltReview/frontLine.ts';

const ORIGIN = { lng: 4.9, lat: 52.37 };
const KX = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), KY = 110_540;
const metres = (ring: number[][]): XY[] => ring.map(([lng, lat]) => [(lng - ORIGIN.lng) * KX, (lat - ORIGIN.lat) * KY] as const);

// BAG footprints (building tiles, 2026-11-21), closed GeoJSON rings.
const H62 = [[4.889677, 52.3775286], [4.889984, 52.3774251], [4.8900087, 52.3774522], [4.8900238, 52.3774471], [4.8900363, 52.3774608], [4.8897122, 52.377568], [4.889677, 52.3775286]];
const H6 = [[4.89123, 52.379071], [4.891195, 52.379033], [4.891398, 52.378963], [4.891417, 52.378985], [4.891415, 52.378986], [4.891427, 52.378999], [4.89123, 52.379071]];
const H82 = [[4.889388, 52.376964], [4.889343, 52.376911], [4.889476, 52.376866], [4.889525, 52.376918], [4.889388, 52.376964]];

/** The Herengracht street side: the canal lies to the east-south-east (outward normal bearing ~120 deg). */
const canalSide = (e: Edge0) => e.nx * Math.sin(120 * Math.PI / 180) + e.ny * Math.cos(120 * Math.PI / 180) > 0.8;

function frontEdges(ring: number[][]) {
  let pts = metres(ring.slice(0, -1));
  if (ringArea2(pts) < 0) pts = [...pts].reverse();
  return pts.map((a, i) => { const b = pts[(i + 1) % pts.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]); return { a, b, len, nx: (b[1] - a[1]) / len, ny: -(b[0] - a[0]) / len }; })
    .filter(e => canalSide({ x0: e.a[0], y0: e.a[1], x1: e.b[0], y1: e.b[1], len: e.len, nx: e.nx, ny: e.ny }));
}

test('Herengracht 62: the stoop block and the 3.43 m piece are one 5.18 m front on the main line', () => {
  let pts = metres(H62.slice(0, -1));
  if (ringArea2(pts) < 0) pts = [...pts].reverse();
  const edge = (k: number): Edge0 => { const a = pts[k], b = pts[(k + 1) % pts.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]); return { x0: a[0], y0: a[1], x1: b[0], y1: b[1], len, nx: (b[1] - a[1]) / len, ny: -(b[0] - a[0]) / len }; };
  const [s] = steppedFronts(pts, k => canalSide(edge(k)));
  assert.ok(s, 'a stepped front');
  assert.equal(s.pieces.length, 2);
  assert.equal(s.jogs.length, 1);
  assert.ok(Math.abs(s.mainM - 3.43) < 0.03, `main ${s.mainM}`);
  assert.ok(Math.abs(s.depthM - 1.17) < 0.03, `depth ${s.depthM}`);
  assert.ok(s.stub && absorbable(s));
  const out = absorbSteppedFront(pts, s)!;
  assert.equal(out.length, 4, 'a four-cornered footprint');

  const before = frontEdges(H62), after = frontEdges(absorbRingSteps(H62, ORIGIN, canalSide));
  assert.deepEqual(before.map(e => +e.len.toFixed(2)), [3.43, 1.74]);
  assert.equal(after.length, 1);
  assert.ok(Math.abs(after[0].len - 5.18) < 0.05, `front ${after[0].len}`);
  // On the 3.43 m piece's line (the row's front: 64 next door stands on it).
  const main = before[0], off = (p: XY) => (p[0] - main.a[0]) * main.nx + (p[1] - main.a[1]) * main.ny;
  assert.ok(Math.abs(off(after[0].a)) < 0.02 && Math.abs(off(after[0].b)) < 0.02);
});

test('Herengracht 6: a 0.18 m seam; the 1.65 m stub joins the 2.75 m piece (4.43 m)', () => {
  const before = frontEdges(H6), after = frontEdges(absorbRingSteps(H6, ORIGIN, canalSide));
  assert.deepEqual(before.map(e => +e.len.toFixed(2)), [2.75, 1.65]);
  assert.equal(after.length, 1);
  assert.ok(Math.abs(after[0].len - 4.43) < 0.05, `front ${after[0].len}`);
});

test('Herengracht 82 (one-run front) and every unchanged ring: the same array, the same features', () => {
  assert.equal(absorbRingSteps(H82, ORIGIN, canalSide), H82);
  // A stepped front away from the street is left alone.
  assert.equal(absorbRingSteps(H62, ORIGIN, () => false), H62);
  const f = (id: string, ring: number[][]) => ({ type: 'Feature' as const, properties: { id }, geometry: { type: 'Polygon', coordinates: [ring] } });
  const features = [f('82', H82)], context = [f('84', H82)];
  const streets = Float32Array.from([0, 0, 1, 1]);
  const r = withFrontSteps(features, context, streets, ORIGIN);
  assert.equal(r.features, features);
  assert.equal(r.context, context);
  // No streets: nothing to tell the street side by.
  const s = withFrontSteps([f('62', H62)], [], undefined, ORIGIN);
  assert.equal(s.features[0].geometry.coordinates[0], H62);
});

test('withFrontSteps: absorbs a street-side step, keeps the untouched vertices bit for bit, and FRONT_STEPS=0 turns it off', () => {
  const f = { type: 'Feature' as const, properties: { id: '62' }, geometry: { type: 'Polygon', coordinates: [H62] } };
  // A street 8 m out in front of 62, along its front (metres from ORIGIN).
  const pts = metres(H62.slice(0, -1)), [ax, ay] = pts[1], ux = Math.sin(30 * Math.PI / 180), uy = Math.cos(30 * Math.PI / 180), nx = Math.sin(120 * Math.PI / 180), ny = Math.cos(120 * Math.PI / 180);
  const streets = Float32Array.from([ax + nx * 8 - ux * 20, ay + ny * 8 - uy * 20, ax + nx * 8 + ux * 20, ay + ny * 8 + uy * 20]);
  const on = withFrontSteps([f], [], streets, ORIGIN);
  const ring = on.features[0].geometry.coordinates[0] as number[][];
  assert.notEqual(ring, H62);
  assert.equal(ring.length, 5, 'closed four-cornered ring');
  for (const v of ring) if (!H62.some(w => w[0] === v[0] && w[1] === v[1])) assert.ok(Math.hypot((v[0] - H62[1][0]) * KX, (v[1] - H62[1][1]) * KY) < 8, 'only the front corners move');
  assert.ok(ring.some(v => v === H62[0]) && ring.some(v => v === H62[5]), 'the back corners are the input coordinates');
  const prev = process.env.FRONT_STEPS;
  process.env.FRONT_STEPS = '0'; resetFrontSteps();
  try { assert.equal(withFrontSteps([f], [], streets, ORIGIN).features[0], f); } finally { if (prev === undefined) delete process.env.FRONT_STEPS; else process.env.FRONT_STEPS = prev; resetFrontSteps(); }
});

test('a wide front keeps a deep step (a risalit); a front of whole pieces keeps its pieces', () => {
  // 20 m front, a 1.2 m deep 2 m stub at one end: kept. A 0.3 m seam on the same front: absorbed.
  const ring = (depth: number): XY[] => [[0, 0], [0, -10], [18, -10], [18, -10 - depth], [20, -10 - depth], [20, 0]];
  const facesSouth = (e: Edge0) => e.ny < -0.9;
  const edge = (pts: XY[], k: number): Edge0 => { const a = pts[k], b = pts[(k + 1) % pts.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]); return { x0: a[0], y0: a[1], x1: b[0], y1: b[1], len, nx: (b[1] - a[1]) / len, ny: -(b[0] - a[0]) / len }; };
  // Counter-clockwise: reverse the clockwise literal.
  const ccw = (pts: XY[]) => ringArea2(pts) < 0 ? [...pts].reverse() : pts;
  const deep = ccw(ring(1.2)), shallow = ccw(ring(0.3));
  const d = steppedFronts(deep, k => facesSouth(edge(deep, k)))[0], s = steppedFronts(shallow, k => facesSouth(edge(shallow, k)))[0];
  assert.ok(d && !absorbable(d), 'deep step on a 20 m front kept');
  assert.ok(s && absorbable(s), 'shallow seam absorbed');
  // Two whole 4 m plots with a 0.4 m seam: no stub, kept (Rozengracht multi-plot pands).
  const plots = ccw([[0, 0], [0, -10], [4, -10], [4, -10.4], [8, -10.4], [8, 0]]);
  const p = steppedFronts(plots, k => facesSouth(edge(plots, k)))[0];
  assert.ok(p && !p.stub && !absorbable(p));
});

test('house preview measures the framed run: Herengracht 82 is its 6.64 m canal front, not the 10.61 m side street', () => {
  // Runs as the mesher reported them (metres from the chunk origin); the frame is the photo's wall (walls.json).
  const m = (lng: number, lat: number) => [(lng - ORIGIN.lng) * KX, (lat - ORIGIN.lat) * KY];
  const [a, b, c, d] = [m(4.889388, 52.376964), m(4.889343, 52.376911), m(4.889476, 52.376866), m(4.889525, 52.376918)];
  const runs = [{ id: 'side', lengthM: 10.61, at: [d[0], d[1], a[0], a[1]] as [number, number, number, number] }, { id: 'canal', lengthM: 6.64, at: [c[0], c[1], d[0], d[1]] as [number, number, number, number] }];
  const [fa, fb] = [m(4.889476, 52.376866), m(4.889525, 52.376918)], len = Math.hypot(fb[0] - fa[0], fb[1] - fa[1]);
  const right = [(fb[0] - fa[0]) / len, (fb[1] - fa[1]) / len, 0], frame = { origin: [fa[0], fa[1], 0], right, normal: [right[1], -right[0], 0], len };
  assert.equal(framedRun(runs, frame)?.id, 'canal');
  assert.equal(framedRun([runs[0]], frame), undefined, 'no run on the frame: the caller keeps the longest');
});
