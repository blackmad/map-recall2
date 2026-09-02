import assert from 'node:assert/strict';
import { exactConsensus, FACADE_GRAMMAR_COUNT_FIELDS, FACADE_GRAMMAR_FIELDS, FACADE_GRAMMAR_VALIDATION_ENUMS, isAbstention, normalizeFacadeGrammarLabel } from '../src/canalRecall/building/facadeGrammarInference.ts';

const enums = { windowPattern: ['regular-grid', 'unknown'], facadeMaterial: ['brick', 'uncertain'], windowFrameColour: ['black', 'natural-wood'] };
const keys = ['targetVisible', 'visibilityConfidence', 'visibleStoreys', 'bayCount', 'groundFloorDistinct', 'rationale', ...Object.keys(enums)];
const raw = { targetVisible: true, visibilityConfidence: .9, visibleStoreys: 3, bayCount: 'unknown', groundFloorDistinct: null, rationale: 'clear view', windowPattern: 'regular-grid', facadeMaterial: 'brick', windowFrameColour: 'natural-wood' };
const first = normalizeFacadeGrammarLabel(raw, enums, keys);
assert.equal(first.bayCount, null, 'provider unknown count is safely normalized to null');
assert.throws(() => normalizeFacadeGrammarLabel({ ...raw, facadeMaterial: 'invented' }, enums, keys), /controlled vocabulary/);
assert.throws(() => normalizeFacadeGrammarLabel({ ...raw, windowFrameColour: 'orange' }, enums, keys), /controlled vocabulary/);
assert.throws(() => normalizeFacadeGrammarLabel({ ...raw, extra: true }, enums, keys), /fields/);
const second = normalizeFacadeGrammarLabel({ ...raw, bayCount: null, visibilityConfidence: .8, rationale: 'also clear' }, enums, keys);
const agreed = exactConsensus([first, second], keys);
assert.equal(agreed.bayCount, null);
assert.equal(agreed.facadeMaterial, 'brick');
assert.ok(!('visibilityConfidence' in agreed));
assert.ok(!('rationale' in agreed));

// The published vocabulary is a data contract: a re-measurement must be able to validate
// an old run against exactly the enums that run was extracted with.
for (const field of ['facadeMaterial', 'facadeColour', 'roofline', 'windowFrameColour']) {
  assert.ok(FACADE_GRAMMAR_FIELDS.includes(field), `${field} is part of the published grammar`);
  assert.ok(FACADE_GRAMMAR_VALIDATION_ENUMS[field]?.length, `${field} has a controlled vocabulary`);
}
assert.ok(FACADE_GRAMMAR_VALIDATION_ENUMS.windowFrameColour.includes('natural-wood'), 'frames keep their one non-facade colour');
for (const field of FACADE_GRAMMAR_COUNT_FIELDS) assert.ok(!(field in FACADE_GRAMMAR_VALIDATION_ENUMS), `${field} is a count, not an enum`);

// Agreeing that nothing is visible is agreement without information; the measurement
// must be able to tell those two apart or a blind field looks like a reliable one.
for (const value of [null, undefined, 'unknown', 'not-visible', 'uncertain']) assert.ok(isAbstention(value), `${String(value)} is an abstention`);
for (const value of ['brick', 'flat-parapet', 0, 3, false]) assert.ok(!isAbstention(value), `${String(value)} is an observation`);

process.stdout.write('Facade grammar inference checks passed.\n');
