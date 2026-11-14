import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeBuurt, describedBin, describedFields, describedShown, sumDescribed, type ViewLike } from './described.js';
import type { TierId } from './coverage.js';

test('describedFields: only what the generic route draws', () => {
  assert.deepEqual(describedFields(undefined), []);
  assert.deepEqual(describedFields({ src: {} }), []);
  // a register entry that states only a wall finish, or a one-storey count, describes nothing drawable
  assert.deepEqual(describedFields({ storeys: 1 } as ViewLike), []);
  assert.deepEqual(describedFields({ wallHex: 'brick' }), []);
  assert.deepEqual(describedFields({ storeys: 4, bays: 5, corniceCrown: true, wallHex: '#37332f', shop: false }), ['storeys', 'bays', 'crown', 'colour', 'ground']);
  assert.deepEqual(describedFields({ gable: 'spout' }), ['crown']);
  assert.deepEqual(describedFields({ groundM: 3.4 }), ['ground']);
  assert.deepEqual(describedFields({ stoop: {} }), ['ground']);
});

const tiers = new Map<string, TierId>([['model', 'ordinaryGlb'], ['chunk', 'chunk'], ['type', 'buildingType'], ['g', 'generic']]);
const live = new Map<string, ViewLike>([
  ['a', { storeys: 4, bays: 3, src: { storeys: 'vision-judge', bays: 'vision-judge' } }], ['model', { storeys: 3 }], ['chunk', { gable: 'bell' }], ['type', { bays: 2 }], ['g', { wallHex: '#aa5533', src: { wallHex: 'monument-text' } }], ['empty', {}],
]);

test('describeBuurt: counts only generic-tier pands with drawable fields; models, chunks and types are not described', () => {
  const r = describeBuurt({ pands: ['a', 'b', 'model', 'chunk', 'type', 'g', 'empty'], tierOf: tiers, live });
  assert.equal(r.live.pands, 2); // a and g
  assert.equal(r.live.share, Math.round(1e4 * 2 / 7) / 1e4);
  assert.deepEqual(r.live.fields, { storeys: 1, bays: 1, crown: 0, colour: 1, ground: 0 });
  assert.equal(r.live.photo, 1, 'a is read from the front, g is register text');
  assert.equal(r.staged, undefined, 'no staged key without a staged set');
});

test('describeBuurt: staged pands are separate, never double-counted with live, and still need the generic tier', () => {
  const staged = new Map<string, ViewLike>([['a', { storeys: 5 }], ['b', { storeys: 3, corniceCrown: true }], ['model', { storeys: 3 }], ['empty', { bays: 4 }]]);
  const r = describeBuurt({ pands: ['a', 'b', 'model', 'empty'], tierOf: tiers, live, staged });
  assert.equal(r.live.pands, 1, 'a is live');
  assert.equal(r.staged!.pands, 2, 'b and empty; a is already live, model is drawn by a model');
  assert.deepEqual(r.staged!.fields, { storeys: 1, bays: 1, crown: 1, colour: 0, ground: 0 });
  assert.equal(describedShown(r, false), r.live.share);
  assert.equal(describedShown(r, true), r.live.share + r.staged!.share);
});

test('sumDescribed and describedBin', () => {
  const a = describeBuurt({ pands: ['a', 'g'], tierOf: tiers, live, staged: new Map() });
  const sum = sumDescribed([a, undefined, describeBuurt({ pands: ['x'], tierOf: tiers, live })]);
  assert.equal(sum.live.pands, 2);
  assert.equal(sum.buurtenLive, 1);
  assert.equal(sum.buurtenStaged, 0);
  assert.deepEqual([0, 0.001, 0.02, 0.07, 0.2, 0.4, 0.9].map(describedBin), [0, 1, 2, 3, 4, 5, 6]);
});
