import assert from 'node:assert/strict';
import test from 'node:test';
import {abstentions, candidateIds, validateClassification} from './classify-block-candidates';

const ids = ['ground-001', 'ground-002'];
const row = (id: string) => ({id, role: 'door', visibility: 'visible', confidence: 0.72,
  evidence: 'Dark paired leaves beneath an arch', reason: 'Upper edge is partly obscured'});

test('candidate files accept candidates or features, never duplicate IDs', () => {
  assert.deepEqual(candidateIds({candidates: ids.map(id => ({id}))}), ids);
  assert.deepEqual(candidateIds({features: ids.map(id => ({id}))}), ids);
  assert.throws(() => candidateIds({candidates: [{id: 'same'}, {id: 'same'}]}), /duplicate/);
  assert.throws(() => candidateIds({candidates: [{id: 'bad id'}]}), /invalid/);
});

test('classifications must cover exact IDs once with no coordinate fields', () => {
  assert.deepEqual(validateClassification({classifications: ids.map(row)}, ids), ids.map(row));
  assert.throws(() => validateClassification({classifications: [row(ids[0])]}, ids), /Incomplete/);
  assert.throws(() => validateClassification({classifications: [row(ids[0]), row(ids[0])]}, ids), /duplicate/);
  assert.throws(() => validateClassification({classifications: [row(ids[0]), {...row(ids[1]), bbox: [0, 0, 1, 1]}]}, ids), /coordinates/);
  assert.throws(() => validateClassification({classifications: [row(ids[0]), {...row(ids[1]), role: 'invented-balcony'}]}, ids), /Invalid fields/);
});

test('a rejected model response abstains for every known ID', () => {
  const rows = abstentions(ids, 'invalid-model-output');
  assert.deepEqual(rows.map(value => value.id), ids);
  assert.ok(rows.every(value => value.role === 'unknown' && value.visibility === 'unknown' && value.confidence === 0));
  assert.deepEqual(validateClassification({classifications: rows}, ids), rows);
});
