import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateVerdict } from './gate.ts';

test('gate: Jev quality below the deployed threshold fails, Gemini yes on trunk/branches/van fails', () => {
  assert.deepEqual(gateVerdict({ sha: 'x', jev: { score: 0.9, occluded: 0.1, closeUp: 0, quality: 0.81, tokens: 1 } }), { pass: true, reasons: [] });
  assert.equal(gateVerdict({ sha: 'x', jev: { score: 0.5, occluded: 0.5, closeUp: 0, quality: 0.25, tokens: 1 } }).pass, false);
  const g = gateVerdict({ sha: 'x', jev: { score: 0.9, occluded: 0.1, closeUp: 0, quality: 0.81, tokens: 1 }, gemini: { van: 0.1, trunk: 0.8, branches: 0.2, tokens: 1 } });
  assert.equal(g.pass, false); assert.match(g.reasons[0], /gemini trunk/);
});
test('gate: no Jev record means not gated, never a pass', () => {
  assert.equal(gateVerdict({ sha: 'x' }).pass, null);
});
