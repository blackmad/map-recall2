import assert from 'node:assert/strict';
import test from 'node:test';
import { planBuildingRoof, roofTrianglesForOutline, type RoofPlan } from './roofMesh.ts';
import { roofAttachment } from './roofAttachmentAudit.ts';

const ORIGIN = { lng: 4.9, lat: 52.37 };
const KX = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), KY = 110_540;
const DIMS = { bayM: 2, storeyM: 3, cellM: 1.2 };
const toLngLat = (ring: Array<[number, number]>) => [...ring, ring[0]].map(([x, y]) => [ORIGIN.lng + x / KX, ORIGIN.lat + y / KY]);

/** A 14 x 10 m block with a 5 x 5 m corner cut off (a street-corner chamfer). */
const CUT_CORNER: Array<[number, number]> = [[0, 0], [14, 0], [14, 5], [9, 10], [0, 10]];
/** An L: 16 x 9 m bar with a 8 x 7 m wing, half the plan is the second leg. */
const L_SHAPE: Array<[number, number]> = [[0, 0], [16, 0], [16, 9], [8, 9], [8, 16], [0, 16]];

function measure(ring: Array<[number, number]>, plan: RoofPlan, height: number, clip: boolean) {
  const lngLat = toLngLat(ring);
  const wallTop = height - plan.riseM;
  const tris = roofTrianglesForOutline(lngLat, ORIGIN, clip ? plan : { ...plan, clipToOutline: false }, wallTop, DIMS, KX);
  return roofAttachment(ring, tris, wallTop, !!plan.keepLid);
}

/** The first generated hipped/pitched/mansard plan for a style, over ids until the hash picks one. */
function planFor(ring: Array<[number, number]>, style: string, height: number): RoofPlan {
  for (let i = 0; i < 400; i++) {
    const plan = planBuildingRoof(`attach-${i}`, style, height, 0, [...ring, ring[0]], undefined, 1900, null);
    if (plan && ['hipped', 'pitched', 'mansardHip', 'mansard', 'halfHipped'].includes(plan.kind) && plan.pieces) return plan;
  }
  throw new Error('no roof planned');
}

test('a roof box over a cut corner is cut at the walls and no longer hangs over the street', () => {
  const plan = planFor(CUT_CORNER, 'c19', 16);
  assert.equal(plan.clipToOutline, true, 'the plan asks for the cut');
  const unclipped = measure(CUT_CORNER, plan, 16, false);
  const clipped = measure(CUT_CORNER, plan, 16, true);
  assert.ok(unclipped.flags.includes('hang'), `unclipped box hangs ${unclipped.hangM.toFixed(2)} m`);
  assert.ok(!clipped.flags.includes('hang'), `clipped roof hangs ${clipped.hangM.toFixed(2)} m`);
  assert.ok(clipped.hangAreaShare < 0.02);
  assert.ok(Math.abs(clipped.verticalGapM) <= 0.3, 'the eaves still meet the wall top');
});

test('an L footprint is roofed over the whole plan, not a pitched hat on a flat deck', () => {
  for (const style of ['c19', 'canal', 'school']) {
    const plan = planFor(L_SHAPE, style, 18);
    const report = measure(L_SHAPE, plan, 18, true);
    assert.ok(!report.flags.includes('bare-deck'), `${style}: bare deck ${(report.bareDeckShare * 100).toFixed(0)}%`);
    assert.ok(!report.flags.includes('hang'), `${style}: hangs ${report.hangM.toFixed(2)} m`);
  }
});

test('a plain rectangle is untouched by the cut', () => {
  const rect: Array<[number, number]> = [[0, 0], [12, 0], [12, 8], [0, 8]];
  const plan = planFor(rect, 'c19', 15);
  assert.ok(!plan.clipToOutline);
  const report = measure(rect, plan, 15, true);
  assert.deepEqual(report.flags, []);
});
