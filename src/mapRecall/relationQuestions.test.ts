import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StreetFeature } from '../types';
import { buildRelationQuestion, distractorFeatures, isObscure, longestAxisMetres } from './relationQuestions';

const f = (name: string, lat: number, lon: number, over: Partial<StreetFeature> = {}): StreetFeature => ({
  id: name, name, type: 'street', cityId: 'amsterdam', center: [lat, lon], difficulty: 'medium', clues: [], distractors: [], funFact: '',
  path: [[lat, lon - 0.001], [lat, lon + 0.001]], ...over,
} as StreetFeature);

test('obscure: low prominence or short, never a neighbourhood', () => {
  assert.equal(isObscure(f('A', 52.37, 4.9, { prominenceScore: 5 })), true);
  assert.equal(isObscure(f('A', 52.37, 4.9, { prominenceScore: 300, path: [[52.37, 4.88], [52.37, 4.92]] })), false);
  assert.equal(isObscure(f('A', 52.37, 4.9, { prominenceScore: 300 })), true); // ~136 m long
  assert.equal(isObscure(f('A', 52.37, 4.9, { type: 'neighborhood', prominenceScore: 1 })), false);
  assert.ok(Math.abs(longestAxisMetres(f('A', 52.37, 4.9)) - 136) < 5);
});

test('axis question: the larger separation, either name can be the answer', () => {
  const target = f('Jan Vethstraat', 52.355, 4.880, { prominenceScore: 4, distractors: ['Chris Lebeaustraat', 'Elsewhere'] });
  const west = f('Chris Lebeaustraat', 52.356, 4.870); // ~680 m west, 111 m north
  const q0 = buildRelationQuestion(target, [target, west], 0)!;
  assert.equal(q0.kind, 'axis');
  assert.equal(q0.prompt, 'Which is further west: Jan Vethstraat or Chris Lebeaustraat?');
  assert.equal(q0.answer, 'Chris Lebeaustraat');
  const q1 = buildRelationQuestion(target, [target, west], 1)!;
  assert.equal(q1.prompt, 'Which is further east: Chris Lebeaustraat or Jan Vethstraat?');
  assert.equal(q1.answer, 'Jan Vethstraat');
  assert.equal(q1.other.name, 'Chris Lebeaustraat');
});

test('north-south when that axis separates more', () => {
  const target = f('T', 52.360, 4.880, { prominenceScore: 4, distractors: ['N'] });
  const north = f('N', 52.364, 4.881);
  const q = buildRelationQuestion(target, [north], 0)!;
  assert.equal(q.kind, 'axis');
  if (q.kind === 'axis') assert.equal(q.direction, 'south');
  assert.equal(q.answer, 'T');
});

test('too close on both axes: the neighbourhood form, or nothing', () => {
  const target = f('T', 52.360, 4.880, { prominenceScore: 4, distractors: ['Near'], neighborhood: 'Overtoomse Veld' });
  const near = f('Near', 52.361, 4.881, { neighborhood: 'Slotervaart' });
  const q = buildRelationQuestion(target, [near], 0)!;
  assert.equal(q.kind, 'neighbourhood');
  assert.equal(q.prompt, 'Which of these is in Overtoomse Veld?');
  assert.equal(q.answer, 'T');
  const sameHood = f('Near', 52.361, 4.881, { neighborhood: 'Overtoomse Veld' });
  assert.equal(buildRelationQuestion(target, [sameHood], 0), null);
});

test('no distractor in the pool, or a well-known place: keep four names', () => {
  const target = f('T', 52.360, 4.880, { prominenceScore: 4, distractors: ['Missing'] });
  assert.equal(buildRelationQuestion(target, [f('Other', 52.37, 4.9)], 0), null);
  const famous = f('Famous', 52.360, 4.880, { prominenceScore: 400, path: [[52.36, 4.87], [52.36, 4.89]], distractors: ['W'] });
  assert.equal(buildRelationQuestion(famous, [f('W', 52.36, 4.86)], 0), null);
});

test('distractors resolve by name, nearest first, never neighbourhoods', () => {
  const target = f('T', 52.36, 4.88, { distractors: ['Far', 'Near', 'Area'] });
  const result = distractorFeatures(target, [f('Far', 52.40, 4.88), f('Near', 52.361, 4.88), f('Area', 52.36, 4.88, { type: 'neighborhood' })]);
  assert.deepEqual(result.map(({ name }) => name), ['Near', 'Far']);
});

test('a crossing street too close to compare is passed over for the nearest one that clears 250 m', () => {
  const target = f('T', 52.360, 4.880, { prominenceScore: 4, distractors: ['Crossing', 'Further'] });
  const crossing = f('Crossing', 52.3605, 4.8805);
  const further = f('Further', 52.360, 4.886); // ~410 m east
  const q = buildRelationQuestion(target, [crossing, further], 0)!;
  assert.equal(q.kind, 'axis');
  assert.equal(q.other.name, 'Further');
  assert.equal(q.answer, 'T'); // further west
});
