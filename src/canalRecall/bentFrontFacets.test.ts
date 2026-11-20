// Feedback 1a223c (Jacob van Lennepkade, OSM r3674867): narrow facets of a bent front drew the whole window cell
// squeezed onto a 1-2 m cant, slivers of window against every turn. bentFrontFacets.ts samples one window at its
// natural width, or plain wall.
import assert from 'node:assert/strict';
import test from 'node:test';
import { bentFrontFacet, facetSpan, facetU, FACET_MAX_M, FACET_PIER_M } from './bentFrontFacets.js';
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
