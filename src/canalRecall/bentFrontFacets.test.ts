// Feedback 1a223c (Jacob van Lennepkade, OSM r3674867): narrow facets of a bent front drew the whole window cell
// squeezed onto a 1-2 m cant, slivers of window against every turn. bentFrontFacets.ts samples one window at its
// natural width, or plain wall.
import assert from 'node:assert/strict';
import test from 'node:test';
import { bentFrontFacet, facetSpan, facetU, mergeSteppedRuns, FACET_MAX_M, FACET_PIER_M } from './bentFrontFacets.js';
import { wallRuns } from './threeBuildingMesh.js';
import { presetOpenings } from './facadeOpenings.js';
import { STYLE_DIMS } from './facadeCells.js';

type E = { x0: number; y0: number; x1: number; y1: number; len: number; nx: number; ny: number; hole: boolean };
const ring = (pts: Array<[number, number]>): E[] => pts.map((p, i) => {
  const q = pts[(i + 1) % pts.length], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
  return { x0: p[0], y0: p[1], x1: q[0], y1: q[1], len, nx: (q[1] - p[1]) / len, ny: -(q[0] - p[0]) / len, hole: false };
});

// r3674867's kade front round one oriel (edges 43-47 of the relation, metres): an 18 m face, a 1.03 m cant at 45 deg,
// a 1.91 m face, a 0.75 m return and a 1.15 m face, closed into a block behind.
const oriel = ring([[0, 0], [18, 0], [18.73, 0.73], [20.64, 0.73], [20.64, 1.48], [21.79, 1.48], [21.79, -12], [0, -12]]);

test('a cant, return or chamfer between exposed walls is a facet; a front between party walls is not', () => {
  const runs = wallRuns([oriel], () => false);
  const runOf = (e: E) => runs.find(r => r.some(x => x.e === e))!;
  for (const k of [1, 2, 3, 4]) assert.ok(bentFrontFacet([oriel], () => false, runOf(oriel[k])), `edge ${k}`);
  // The same 1.91 m face with party walls either side (a narrow house) keeps its cell.
  const party = (e: E) => e === oriel[1] || e === oriel[3];
  assert.equal(bentFrontFacet([oriel], party, wallRuns([oriel], party).find(r => r.some(x => x.e === oriel[2]))!), false);
});

test('facetSpan: one whole window at its natural width, never two squeezed; plain wall when none fits with piers', () => {
  const o = presetOpenings('r3674867', 'modern'), cell = STYLE_DIMS.modern.bay;
  const span = facetSpan(1.91, cell, o.upper);
  assert.ok(span && span !== 'plain');
  const s = span as { u0: number; u1: number };
  // Natural scale: the span is the facet's share of a cell (no squeeze), or narrower only to stay clear of the next window.
  assert.ok(s.u1 - s.u0 <= 1.91 / cell + 1e-9);
  const inside = o.upper.axes.filter(a => [a - 1, a, a + 1].some(x => x - o.upper.width / 2 >= s.u0 - 1e-9 && x + o.upper.width / 2 <= s.u1 + 1e-9));
  const cut = o.upper.axes.filter(a => [a - 1, a, a + 1].some(x => x + o.upper.width / 2 > s.u0 + 1e-9 && x - o.upper.width / 2 < s.u1 - 1e-9 && !(x - o.upper.width / 2 >= s.u0 - 1e-9 && x + o.upper.width / 2 <= s.u1 + 1e-9)));
  assert.equal(inside.length, 1, JSON.stringify({ s, o: o.upper }));
  assert.equal(cut.length, 0, JSON.stringify({ s, o: o.upper }));
  // A 0.75 m return cannot hold a window and its piers.
  assert.equal(facetSpan(0.75, cell, o.upper), 'plain');
  assert.ok(0.75 < o.upper.width * cell + 2 * FACET_PIER_M);
});

test('facetSpan leaves long or whole-cell walls, and unknown rows, to the bay layout', () => {
  const o = presetOpenings('x', 'modern');
  assert.equal(facetSpan(FACET_MAX_M, 10, o.upper), null);
  assert.equal(facetSpan(2, 1.9, o.upper), null);
  assert.equal(facetSpan(2, 4, undefined), null);
  // A glazing band wider than the facet: the band's middle, glass across.
  const band = facetSpan(1.2, 4, { axes: [0.5], width: 0.9, sill: 0.1, head: 0.9 }) as { u0: number; u1: number };
  assert.ok(Math.abs(band.u0 - 0.35) < 1e-9 && Math.abs(band.u1 - 0.65) < 1e-9);
});

test('facetU maps metres along the facet onto its span, shared by the facet\'s walls', () => {
  assert.equal(facetU({ u0: 0.1, u1: 0.5 }, 0, 2), 0.1);
  assert.ok(Math.abs(facetU({ u0: 0.1, u1: 0.5 }, 1, 2) - 0.3) < 1e-12);
  assert.equal(facetU({ u0: 0.1, u1: 0.5 }, 2, 2), 0.5);
});

// Feedback f8f282, Prinsengracht 136-138 (pand 0363100012165018), its BAG ring in metres: the canal front (edges 10-24)
// is 1-3 m pieces offset by 0.1-0.5 m jogs, each of which ended a run, so each piece drew a squeezed bay.
const prinsengracht136 = ring([[0, 0], [-8.56, 4.86], [-11.21, 3.98], [-10.67, 2.32], [-8.97, 1.44], [-10.06, -0.44], [-9.72, -0.55], [-11.08, -2.98], [-11.42, -2.76], [-14.48, -8.07], [-7.0, -12.38], [-6.66, -11.72], [-6.73, -11.61], [-5.44, -9.29], [-5.3, -9.29], [-3.94, -6.96], [-4.21, -6.52], [-3.67, -5.53], [-3.13, -5.53], [-2.99, -5.31], [-2.92, -5.2], [-1.83, -3.32], [-1.97, -3.21], [-0.61, -0.77], [-0.48, -0.88]]);

test('mergeSteppedRuns: a front stepped by sub-metre jogs is one run, the jogs listed (Prinsengracht 136-138)', () => {
  const runs = wallRuns([prinsengracht136], () => false);
  const front = (rs: ReadonlyArray<ReadonlyArray<{ e: E }>>) => rs.find(r => r.some(x => x.e === prinsengracht136[12]))!;
  assert.ok(front(runs).length <= 2, 'before: the front is cut at every jog');
  const { runs: merged, jogs } = mergeSteppedRuns(runs, Math.cos(25 * Math.PI / 180));
  const f = front(merged);
  for (const k of [10, 12, 14, 16, 18, 20, 22, 24]) assert.ok(f.some(x => x.e === prinsengracht136[k]), `edge ${k} on the front`);
  for (const k of [11, 13, 15, 17, 21, 23]) assert.ok(jogs.has(prinsengracht136[k]), `edge ${k} is a jog`);
  const laid = f.filter(x => !jogs.has(x.e)).reduce((s, x) => s + x.e.len, 0);
  assert.ok(laid > 12 && laid < 14, String(laid));
  // Every edge is still drawn exactly once.
  assert.equal(merged.flat().length, runs.flat().length);
  // A real corner (the 2.8 m and 1.7 m returns at the back) is never a jog.
  assert.ok(!jogs.has(prinsengracht136[1]) && !jogs.has(prinsengracht136[2]));
});

test('mergeSteppedRuns leaves fronts without jogs as they are', () => {
  const runs = wallRuns([oriel], () => false);
  const { runs: merged, jogs } = mergeSteppedRuns(runs, Math.cos(25 * Math.PI / 180));
  assert.equal(jogs.size, 0);
  assert.deepEqual(merged, runs);
});
