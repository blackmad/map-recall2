/**
 * Reviewer roof pins (reviewRoofs.ts): Den Texstraat 9, 18, 24 (3DBAG ridge 2-3 m over the photographed cornice).
 *   node --import tsx --test src/canalRecall/blockFace/reviewRoofs.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyRoofPins, pinTopRow, roofPinProblems, type MeasuredEavesEntry, type RoofPin} from './reviewRoofs.ts';

const P = '0363100012179435', Q = '0363100012179380';
const strip = {height: 800, pixelsPerMetre: 40};
const entry = (pand: string): MeasuredEavesEntry => ({pand, stripRow: 800 - 13.5 * 40, frontRoof: {}, evidence: 'auto-place'});

test('problems: id, exactly one roof form, ranges, reason, duplicates', () => {
  assert.deepEqual(roofPinProblems([{pandId: P, ridgeM: 14.4, reason: 'strip'}]), []);
  assert.deepEqual(roofPinProblems([{pandId: P, flatBehindCornice: true, reason: 'strip'}]), []);
  assert.match(roofPinProblems([{pandId: '1', ridgeM: 14, reason: 'x'}])[0], /16-digit/);
  assert.match(roofPinProblems([{pandId: P, reason: 'x'}])[0], /one of ridgeM/);
  assert.match(roofPinProblems([{pandId: P, ridgeM: 14, flatBehindCornice: true, reason: 'x'}])[0], /exclusive/);
  assert.deepEqual(roofPinProblems([{pandId: P, eavesM: 13.2, reason: 'row line'}]), []);
  assert.match(roofPinProblems([{pandId: P, ridgeM: 2, reason: 'x'}])[0], /4\.\.40/);
  assert.match(roofPinProblems([{pandId: P, ridgeM: 14, reason: ''}])[0], /reason required/);
  assert.match(roofPinProblems([{pandId: P, ridgeM: 14, reason: 'a'}, {pandId: P, ridgeM: 15, reason: 'b'}])[0], /pinned twice/);
});

test('no pins: the very same entries (byte-identical)', () => {
  const e = [entry(P)];
  assert.equal(applyRoofPins(e, [], [P], strip), e);
});

test('a ridge pin caps the front roof of its pand only, above the cornice row', () => {
  const pins: RoofPin[] = [{pandId: P, ridgeM: 14.4, reason: 'photo shows sky over the dormer'}];
  const out = applyRoofPins([entry(P), entry(Q)], pins, [P, Q], strip);
  assert.equal(out[0].frontRoof?.topRow, Math.round(800 - 14.4 * 40));
  assert.ok(out[0].frontRoof!.topRow! < out[0].stripRow);
  assert.match(out[0].evidence, /reviewer roof pin/);
  assert.deepEqual(out[1], entry(Q));
});

test('flatBehindCornice leaves one row of rise; a ridge under the cornice is clamped above it', () => {
  const stripRow = 800 - 13.5 * 40;
  assert.equal(pinTopRow({pandId: P, flatBehindCornice: true, reason: 'x'}, stripRow, strip), stripRow - 1);
  assert.equal(pinTopRow({pandId: P, ridgeM: 10, reason: 'x'}, stripRow, strip), stripRow - 1);
});

test('a pin for a pand with no entry needs its own eavesM; a pin for a pand outside the run is ignored', () => {
  assert.deepEqual(applyRoofPins([], [{pandId: P, ridgeM: 14.4, reason: 'x'}], [P], strip), []);
  const out = applyRoofPins([], [{pandId: P, ridgeM: 14.4, eavesM: 13.5, reason: 'x'}], [P], strip);
  assert.equal(out[0].stripRow, 800 - 13.5 * 40);
  assert.equal(out[0].frontRoof?.topRow, 800 - 14.4 * 40);
  assert.deepEqual(applyRoofPins([entry(Q)], [{pandId: P, ridgeM: 14.4, reason: 'x'}], [Q], strip), [entry(Q)]);
});

test('an eaves-only pin moves the cornice row and leaves the roof cap alone; with a ridge both move', () => {
  const only = applyRoofPins([entry(P)], [{pandId: P, eavesM: 13.2, reason: 'row line'}], [P], strip);
  assert.equal(only[0].stripRow, Math.round(800 - 13.2 * 40));
  assert.deepEqual(only[0].frontRoof, {});
  const both = applyRoofPins([entry(P)], [{pandId: P, eavesM: 13.2, ridgeM: 14.4, reason: 'x'}], [P], strip);
  assert.equal(both[0].stripRow, Math.round(800 - 13.2 * 40));
  assert.equal(both[0].frontRoof?.topRow, Math.round(800 - 14.4 * 40));
});
