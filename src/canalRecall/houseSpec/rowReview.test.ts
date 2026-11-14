import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReview, detectMode } from './rowReview.ts';

const full = (over: Record<string, string> = {}) => ['same-houses', 'roof-line', 'colour-family', 'white-amount', 'roof-storey-dormers', 'window-rhythm-dressings', 'invented']
  .map(b => over[b] ?? `${b} | ALL | PASS | fine`).join('\n');

test('all pass', () => assert.equal(parseReview(full()).verdict, 'pass'));
test('a fail in the first four blocks blocks the row', () => {
  const r = parseReview(full({ 'roof-line': 'roof-line | 100 | FAIL | pointed gable in the drawing\nroof-line | 98 | PASS | ok' }));
  assert.equal(r.verdict, 'blocked'); assert.equal(r.blocks['roof-line'], 'fail'); assert.equal(r.fails[0].house, '100');
});
test('a fail in a later block does not block', () => assert.equal(parseReview(full({ invented: 'invented | 96 | FAIL | balconies' })).verdict, 'pass-with-fails'));
test('malformed or incomplete answers are invalid, never a pass', () => {
  assert.equal(parseReview('looks good to me').verdict, 'invalid');
  assert.equal(parseReview(full().replace('PASS', 'MAYBE')).verdict, 'invalid');
  const r = parseReview(full({ 'same-houses': 'same-houses | 110 | PASS | ok' }), ['110', '108']);
  assert.equal(r.verdict, 'invalid'); assert.match(r.problems.join(), /108/);
});
test('bulleted and quoted lines parse', () => assert.equal(parseReview(full().split('\n').map(l => `- ${l}`).join('\n')).verdict, 'pass'));
test('an overall FAIL blocks', () => assert.equal(parseReview(full() + '\noverall | ALL | FAIL | not recognisable').verdict, 'blocked'));
test('white-amount blocks', () => assert.equal(parseReview(full({ 'white-amount': 'white-amount | 98 | FAIL | speklagen far too heavy' })).verdict, 'blocked'));

const bo = (over: Record<string, string> = {}) => ['same-houses', 'roof-line', 'colour-family', 'white-amount', 'invented'].map(b => over[b] ?? `${b} | ALL | PASS | fine`).join('\n');
test('blocking-only mode: five blocks, any FAIL blocks, ornament not required', () => {
  assert.equal(detectMode(bo()), 'blocking-only'); assert.equal(detectMode(full()), 'full');
  assert.equal(parseReview(bo()).verdict, 'pass');
  assert.equal(parseReview(bo({ invented: 'invented | 90 | FAIL | frieze invented' })).verdict, 'blocked');
  assert.equal(parseReview(bo().replace(/invented.*/, '')).verdict, 'invalid');
  assert.equal(parseReview(full({ invented: 'invented | 90 | FAIL | x' }), undefined, 'full').verdict, 'pass-with-fails');
});
