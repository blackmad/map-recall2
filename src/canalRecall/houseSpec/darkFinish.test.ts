// Dark-finish veto (lane d1-wall-colour round 2, 2026-11-14): the describer phrase reader on real D1 belt notes, the capture
// and neighbour rules, and the veto's effect on wall sample v2 (no lift, no chroma gain).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DARK_FINISH, capturesDark, darkFinish, describerDarkPhrase, neighboursDark } from './darkFinish.ts';
import { WALL_SAMPLE, estimateWall, labOf, wallSampleV2, type CaptureSample } from './wallSample.ts';

const A = (notes: string, finish = 'painted-brick', pale = false) => ({ readable: true, finish, pale, notes });

test('describer: the described front called dark or black is taken (D1 belt notes)', () => {
  for (const n of [
    'The outline is shifted right over the neighbour; the described front is the black-painted four-bay house with a light frieze cornice.', // 0363100012167645
    'The outline is shifted right; the described front is the dark-painted three-bay house. A tree trunk stands in front of the middle axis.', // 0363100012167646
    'OUTLINE-SHIFT: outline shifted right onto the right neighbour\'s left bay; this three-storey dark front holds most of it.', // 0363100012172362
    'A van hides the foot of the ground storey; the wall is painted near-black.', // 0363100012179307
    'Narrow black two-bay front; branches cross the white top.', // 0363100012172046
  ]) assert.ok(describerDarkPhrase(A(n)), n);
});
test('describer: a dark neighbour, side wall, image or light is not the front', () => {
  for (const n of [
    'OUTLINE-SHIFT: outline is shifted right onto the dark neighbour\'s left bay, but this red-and-white front holds most of it.', // 0363100012167670
    'The image is dark and cars and bicycles hide the foot of the front; the cornice runs on into the similar right neighbour.', // 0363100012167482
    'A tree stands in front of the middle bay; dusk light makes the windows dark.', // 0363100012167902
    'OUTLINE-SHIFT: outline shifted right onto the dark warehouse gable next door; described the brick neck-gable front.', // 0363100012174680
  ]) assert.equal(describerDarkPhrase(A(n, 'brick')), null, n);
  assert.equal(describerDarkPhrase(A('Black painted front.', 'stucco')), null, 'stucco is not a dark brick finish');
  assert.equal(describerDarkPhrase(A('Black painted front.', 'painted-brick', true)), null, 'the reader also said pale');
  assert.equal(describerDarkPhrase({ readable: false, finish: 'painted-brick', notes: 'Black painted front.' }), null);
});

test('captures: every corrected capture dark, at least capMinN of them', () => {
  assert.equal(capturesDark([]), null);
  assert.equal(capturesDark([0.3])!.dark, false, 'one capture is not agreement');
  assert.equal(capturesDark([0.3, 0.33, 0.35])!.dark, true);
  assert.equal(capturesDark([0.3, 0.33, DARK_FINISH.capMaxL + 0.01])!.dark, false);
});
test('neighbours: darker than the street wall either side in the same cut, the neighbours reading normal', () => {
  const c = (L: number, l: number | null, r: number | null) => ({ L, left: l == null ? null : { L: l }, right: r == null ? null : { L: r } });
  assert.equal(neighboursDark([c(0.3, null, null)]), null);
  assert.equal(neighboursDark([c(0.3, 0.5, 0.52), c(0.32, 0.48, null)])!.dark, true);
  assert.equal(neighboursDark([c(0.3, 0.5, 0.52)])!.dark, false, 'one cut is not enough');
  assert.equal(neighboursDark([c(0.3, 0.33, 0.35), c(0.29, 0.34, 0.3)])!.dark, false, 'a dark row: neighbours dark too (shade, not paint)');
});

test('veto: a dark front is not lifted and gains no chroma; the receipt carries the evidence', () => {
  const s = (hex: string, y: number, pinned = false): CaptureSample => ({ hex, pinned, refs: { white: [1, 1, 1], scene: [y, y, y], n: 1 } });
  const caps = [s('#2e2c2a', 0.03, true), s('#34302d', 0.04), s('#2c2a29', 0.035)];
  const lifted = estimateWall(caps)!, kept = estimateWall(caps, WALL_SAMPLE, true)!;
  assert.ok(labOf(lifted.hex).L > labOf(lifted.raw).L + 0.08, 'v2 lifts an underexposed capture');
  assert.ok(labOf(kept.hex).L <= labOf(kept.raw).L + 0.03, 'vetoed: kept near the sample');
  assert.ok(labOf(kept.hex).C <= labOf(lifted.hex).C);
  const fact = darkFinish({ describer: 'black-painted four-bay house', captures: capturesDark([0.3, 0.32]), neighbours: null });
  assert.deepEqual(fact.by, ['describer'], 'capture agreement is a receipt, not a vote (captureVotes false)');
  assert.deepEqual(darkFinish({ describer: null, captures: capturesDark([0.3, 0.32]), neighbours: null }, { ...DARK_FINISH, captureVotes: true }).by, ['captures']);
  const f = wallSampleV2(caps, WALL_SAMPLE, fact)!;
  assert.deepEqual(f.darkFinish, fact);
  assert.ok(labOf(f.drawn).L < labOf(wallSampleV2(caps)!.drawn).L);
  // no evidence: the round-1 result, byte-identical
  assert.deepEqual(wallSampleV2(caps, WALL_SAMPLE, darkFinish({ describer: null, captures: null, neighbours: null })), { ...wallSampleV2(caps)!, darkFinish: { dark: false, by: [], describer: null, captures: null, neighbours: null } });
});
