// Belt fixes 2026-11-22: Herengracht 88 drew two tops. The inscribed plan crowned its largest box, which ran away from
// the street (its ends faced the neighbours and the rear), and the narrow street wing got a second, plain roof. The
// crown now moves to the piece whose end sees the street; everything else stays as it was.
import assert from 'node:assert/strict';
import test from 'node:test';
import { crownOnStreetPiece, type Rect, type RoofPlan } from './roofMesh.ts';
import type { StreetFacing } from './streetGableEnds.ts';

const rect = (cx: number, cy: number, ux: number, uy: number, len: number, wid: number): Rect => ({ cx, cy, ux, uy, len, wid, coverage: 1, maxDev: 0 });
// The street lies at +x: only a wall whose outward normal points +x sees it.
const facing: StreetFacing = w => (w.nx > 0.9 ? 1 : Infinity);
const crown: RoofPlan = { kind: 'gable', gable: 'raisedNeck', riseM: 4, gableEnds: [true, true], dormers: true, chimney: true } as RoofPlan;
const wingPlan: RoofPlan = { kind: 'gable', gable: 'plain', riseM: 3 } as RoofPlan;
// 88-shaped: a 10 m wide main box running across the plot (ends at ±y), a 7 m wide wing at the street end (ends at ±x).
const main = { rect: rect(0, 0, 0, 1, 14, 10), plan: crown };
const wing = { rect: rect(8, 0, 1, 0, 6, 7), plan: wingPlan };

test('the crown moves to the piece that sees the street, the back box turns plain and lower', () => {
  const out = crownOnStreetPiece([main, wing], facing);
  assert.ok(out);
  assert.equal(out[1].plan.gable, 'raisedNeck');
  assert.equal(out[1].plan.kind, 'gable');
  assert.equal(out[1].plan.gableEnds, undefined);
  assert.equal(out[1].plan.riseM, 2.8); // 4 × 7/10
  assert.equal(out[0].plan.kind, 'pitched');
  assert.equal(out[0].plan.gable, 'plain');
  assert.equal(out[0].plan.dormers, false);
  assert.ok(out[0].plan.riseM <= crown.riseM);
  assert.deepEqual(out.map(p => p.rect), [main.rect, wing.rect]);
});

test('a row crown keeps its measured rise on the street piece', () => {
  const out = crownOnStreetPiece([{ ...main, plan: { ...crown, rowCrown: {} as never } }, wing], facing);
  assert.equal(out?.[1].plan.riseM, 4);
  assert.equal(out?.[0].plan.rowCrown, undefined);
});

test('nothing changes when the crown already sees the street, or when nothing is known', () => {
  const streetMain = { rect: rect(0, 0, 1, 0, 14, 10), plan: crown };
  assert.equal(crownOnStreetPiece([streetMain, wing], facing), null);
  assert.equal(crownOnStreetPiece([main, wing], undefined), null);
  assert.equal(crownOnStreetPiece([main], facing), null);
  assert.equal(crownOnStreetPiece([{ ...main, plan: { ...crown, gable: 'plain' } }, wing], facing), null);
  assert.equal(crownOnStreetPiece([{ ...main, plan: { ...crown, ridgeDeg: 90 } }, wing], facing), null);
  assert.equal(crownOnStreetPiece([main, { ...wing, plan: { ...wingPlan, ridgeDeg: 0 } }], facing), null);
  assert.equal(crownOnStreetPiece([main, { ...wing, rect: rect(0, 8, 0, 1, 6, 7) }], () => Infinity), null);
});
