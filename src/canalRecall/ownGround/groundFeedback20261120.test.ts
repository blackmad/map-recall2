// Lane fb-ground2-20261120 (feedback round #396, second pass): the Doelensluis plein's wet-ground holes and faces
// (4c1344ce, wetGroundEdges.ts) and the tapered survey edges across De Clercqstraat (3b8ca68b, bridgeGaps.ts
// taperDeckEdges). Pure, synthetic; the named places are pinned in scripts/own-ground/bridge-feedback-pins.ts.
//   node --import tsx --test src/canalRecall/ownGround/groundFeedback20261120.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { insideRings, liftLandInRings, wetGroundShores, WET_FACE_MIN_M } from './wetGroundEdges';
import { taperDeckEdges, DECK_EDGE_TAPER } from './bridgeGaps';
import type { Vec2 } from './surface';

const sq = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
/** A 20 × 20 m mask at 0.5 m, all water (sdf −range). */
const waterMask = () => ({ x0: 0, y0: 0, res: 0.5, width: 40, height: 40, range: 4, sdf: new Float32Array(1600).fill(-4) });
const at = (m: ReturnType<typeof waterMask>, sdf: Float32Array, x: number, y: number) => sdf[Math.floor(y / m.res) * m.width + Math.floor(x / m.res)];

test('liftLandInRings: land inside a ring, water outside; byte-identical with no ring near', () => {
  const m = waterMask(), out = liftLandInRings(m, [sq(5, 5, 15, 15)]);
  assert.ok(at(m, out, 10, 10) > 0, 'the ring centre is land');
  assert.ok(at(m, out, 2, 2) < 0, 'outside stays water');
  assert.deepEqual(liftLandInRings(m, [sq(100, 100, 110, 110)]), m.sdf);
});

test('liftLandInRings: a sliver bracketed by surveyed ground at street height is lifted; the open edge is not', () => {
  const m = waterMask(), rings = [sq(2, 2, 9.6, 18), sq(10.4, 2, 18, 18)];
  const covered = insideRings(rings), out = liftLandInRings(m, rings, { covered, clear: () => true });
  assert.ok(at(m, out, 10, 10) > 0, 'the 0.8 m slit between the polygons is ground');
  assert.ok(at(m, out, 1, 10) < 0, 'the open water beside the plein stays water');
  const low = liftLandInRings(m, rings, { covered, clear: () => false });
  assert.ok(at(m, low, 10, 10) < 0, 'not at street height: the slit stays water');
});

test('wetGroundShores: a face only where open water lies outside, water on its left', () => {
  const ring = sq(0, 0, 10, 10); // ccw
  const shores = wetGroundShores([ring], (x, _y) => x > 10);
  assert.equal(shores.length, 1);
  const s = shores[0];
  for (const p of s) assert.ok(Math.abs(p[0] - 10) < 1e-9, 'on the east edge');
  // Water (x > 10) on the left of the walk: walking south.
  assert.ok(s[s.length - 1][1] < s[0][1]);
  assert.equal(wetGroundShores([ring], () => false).length, 0);
  // Shorter than WET_FACE_MIN_M of open water: no face.
  assert.equal(wetGroundShores([ring], (x, y) => x > 10 && y > 10 - WET_FACE_MIN_M / 2).length, 0);
});

test('taperDeckEdges: an abrupt narrowing tapers at DECK_EDGE_TAPER; never narrows; identical when gentle', () => {
  const s = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
  const left = Float64Array.from(s, x => (x <= 10 ? 20 : 6)), right = Float64Array.from(s, () => 6);
  const t = taperDeckEdges(s, { left, right });
  for (let i = 0; i < s.length; i++) assert.ok(t.left[i] >= left[i]);
  for (let i = 1; i < s.length; i++) assert.ok(t.left[i - 1] - t.left[i] <= DECK_EDGE_TAPER + 1e-9);
  assert.equal(t.left[11], 20 - DECK_EDGE_TAPER);
  assert.deepEqual(t.right, right);
  const gentle = Float64Array.from(s, x => 10 - x * 0.1);
  assert.deepEqual(taperDeckEdges(s, { left: gentle, right }).left, gentle);
});
