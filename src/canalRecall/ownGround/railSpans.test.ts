// railSpans.ts (lane rails-classb 2026-11-10): untagged rail viaducts over streets drawn as deck spans.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SPAN_CLEAR_M, SPAN_HEADROOM_M, SPAN_LAND_M, underpassSpans, type SpanStreet } from './railSpans.ts';
import { RAIL_SECTION, railMeshes, type RailWay } from './railTracks.ts';
import type { Vec2 } from './surface.ts';

// A tram along x (0..120) at y = 0, its floor at +4.5 (over SPAN_HEADROOM_M); a street along y at x = 60, 8 m wide.
const tram = (extra: Partial<RailWay> = {}): RailWay => ({ kind: 'tram', bridge: false, service: false, points: [[0, 0], [120, 0]], ...extra });
const street: SpanStreet = { points: [[60, -40], [60, 40]], half: 4 };
const floor3 = () => 4.5;
// The street lies at 0 in a 24 m wide dip (x 48..72), the embankment at +4.5 elsewhere.
const dip = (x: number) => (Math.abs(x - 60) < 12 ? 0 : 4.5);

test('a street 4.5 m under a track off the bridges is a deck span, landing where the fill meets the floor', () => {
  const spans = underpassSpans(tram(), floor3, [street], (x: number) => dip(x));
  assert.equal(spans.length, 1);
  const [s] = spans;
  assert.equal(s.clear, 4.5);
  // The span covers the street's strip and runs on to the fill (within the extension step).
  assert.ok(s.s0 <= 60 - 4 - 1.5 && s.s0 >= 47 && s.s0 <= 49, `s0 ${s.s0}`);
  assert.ok(s.s1 >= 71 && s.s1 <= 73, `s1 ${s.s1}`);
});

test('no span: clearance under 1 m, a bridge way, a parallel street, a tunnel cut, a climbing path, one AHN outlier', () => {
  // 0.8 m under the floor.
  assert.equal(underpassSpans(tram(), floor3, [street], (x: number) => (Math.abs(x - 60) < 12 ? 3.7 : 4.5)).length, 0);
  // Already a bridge.
  assert.equal(underpassSpans(tram({ bridge: true }), floor3, [street], (x: number) => dip(x)).length, 0);
  // A street beside the track (crossing at 5 degrees).
  const beside: SpanStreet = { points: [[0, -3], [120, 7.5]], half: 4 };
  assert.equal(underpassSpans(tram(), floor3, [beside], (x: number) => dip(x)).length, 0);
  // In a tunnel cut's box: the trench's floor is measured.
  assert.equal(underpassSpans(tram(), floor3, [street], (x: number) => dip(x), (x: number) => x > 50 && x < 70).length, 0);
  // A path up a dike to a level crossing: the land falls away from the bed on both sides, but rises to meet it.
  const dike = (_x: number, y: number) => Math.max(0, 4.5 - 0.4 * Math.abs(y));
  assert.equal(underpassSpans(tram(), floor3, [{ points: [[60, -40], [60, 40]], half: 1.5 }], dike).length, 0);
  // At grade with one AHN spike in the street's samples: the median ignores it.
  const spike = (x: number, y: number) => (Math.abs(x - 60) < 0.5 && Math.abs(y - 4.45) < 0.5 ? -5 : 4.5);
  assert.equal(underpassSpans(tram(), floor3, [street], spike).length, 0);
});

test('no span over the street the track lies in: embedded_rails, or a street the track runs along before it crosses', () => {
  const height = (x: number) => dip(x);
  assert.equal(underpassSpans(tram(), floor3, [{ ...street, embedded: true }], height).length, 0);
  // The track runs 30 m along a street's strip (x 30..60), then the street turns away across it at x = 60.
  const along: SpanStreet = { points: [[30, 1], [60, 1], [62, -40]], half: 4 };
  assert.equal(underpassSpans(tram(), floor3, [along], height).length, 0);
  // The plain crossing still spans.
  assert.equal(underpassSpans(tram(), floor3, [street], height).length, 1);
});

test('a dual carriageway under one deck: the two spans merge', () => {
  const a: SpanStreet = { points: [[55, -40], [55, 40]], half: 3 }, b: SpanStreet = { points: [[65, -40], [65, 40]], half: 3 };
  const spans = underpassSpans(tram(), floor3, [a, b], (x: number) => dip(x));
  assert.equal(spans.length, 1);
  assert.ok(spans[0].s0 < 52 && spans[0].s1 > 68);
});

test('railMeshes: a span is a deck (slab 1.1 m deep, open under it, not flattened by the crossing), elsewhere unchanged', () => {
  const way = tram(), height = (x: number) => dip(x);
  const levels = new Map([[way, { s: [0, 120], z: [4.5, 4.5] }]]);
  const base = { ways: [way], inCell: () => true, height, levels, atGrade: (p: Vec2, q: Vec2) => (p[0] - 57) * (q[0] - 57) < 0 };
  // `ramps: false`: without the crossing ramps (lane rails-uncover) the crossing pulls one piece down (the V and its wall).
  const plain = railMeshes({ ...base, ramps: false });
  const spans = new Map([[way, underpassSpans(way, floor3, [street], height)]]);
  const withSpan = railMeshes({ ...base, ramps: false, spans, under: () => 'land', spanUnder: (x: number, y: number) => (Math.abs(x - 60) < 4.5 && Math.abs(y) < 40 ? 'road' : 'land') });
  // Before: the raised track's slab reaches down into the street (a wall across it); the crossing flattened the bed.
  const lowest = (m: { positions: number[] }, x0: number, x1: number) => { let z = Infinity; for (let i = 0; i < m.positions.length; i += 3) if (m.positions[i] > x0 && m.positions[i] < x1) z = Math.min(z, m.positions[i + 2]); return z; };
  assert.ok(lowest(plain.slab, 50, 70) < 0.5, `plain slab bottom ${lowest(plain.slab, 50, 70)}`);
  assert.ok(lowest(withSpan.slab, 50, 70) > 4.5 - RAIL_SECTION.slabDepth - 0.05, `span soffit ${lowest(withSpan.slab, 50, 70)}`);
  // The ballast stays on the deck over the street.
  assert.ok(lowest(withSpan.ballast, 56, 64) >= 4.5 - 0.01, `ballast over the street ${lowest(withSpan.ballast, 56, 64)}`);
  assert.equal(withSpan.stats.spans, 1);
  assert.ok((withSpan.stats.spanMetres ?? 0) > 20 && (withSpan.stats.spanMetres ?? 0) < 26);
  // The structure: piers on the land under the span, none on the street.
  assert.ok((withSpan.stats.structure?.piers ?? 0) >= 1);
  // Away from the span (x < 40, x > 80) the bed is the same vertices as without spans.
  const far = (m: { positions: number[] }) => { const out: string[] = []; for (let i = 0; i < m.positions.length; i += 3) if (m.positions[i] < 40 || m.positions[i] > 80) out.push(m.positions.slice(i, i + 3).map(v => v.toFixed(4)).join(',')); return out.sort().join(';'); };
  assert.equal(far(withSpan.ballast), far(plain.ballast));
  // No span map, or an empty one: byte-identical.
  assert.deepEqual(railMeshes({ ...base, ramps: false, spans: new Map() }), plain);
  // With the ramps the bed comes down into the dip at the tram's grade: no slab wall across the street, the ballast on it.
  const ramped = railMeshes(base);
  assert.equal(lowest(ramped.slab, 56, 64), Infinity);
  assert.ok(lowest(ramped.ballast, 56, 64) < 0.5, `ramped ballast ${lowest(ramped.ballast, 56, 64)}`);
  assert.ok(SPAN_LAND_M < 1);
});

test('no span without headroom: a street 1.5-3.5 m under the floor is the profile\'s grade, not a viaduct (Piet Kranenbergpad, lane rails-uncover)', () => {
  for (const clear of [1.5, 3, 3.5]) {
    const land = (x: number) => (Math.abs(x - 60) < 12 ? 4.5 - clear : 4.5);
    assert.equal(underpassSpans(tram(), floor3, [street], land).length, 0, `clear ${clear}`);
    // The old rule (SPAN_CLEAR_M) decked it.
    assert.equal(underpassSpans(tram(), floor3, [street], land, undefined, SPAN_CLEAR_M).length, 1, `old rule, clear ${clear}`);
  }
  assert.ok(SPAN_HEADROOM_M >= RAIL_SECTION.slabDepth + 2.5);
});
