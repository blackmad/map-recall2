import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkFeatures, previewRowIds } from './preview.ts';

const f = (id: string, near: boolean) => ({ properties: { id: `NL.IMBAG.Pand.${id}`, near } });
const own = [f('1', true), f('2', false), f('3', true), f('4', false)], others = [f('5', false), f('2', false)];
const keep = (x: { properties: Record<string, unknown> }) => x.properties.near === true;

test('no PREVIEW_ROW_IDS: the chunk is exactly the near features of the own tile (byte-identical to before)', () => {
  assert.equal(previewRowIds(undefined).size, 0);
  assert.deepEqual(chunkFeatures(own, others, keep, previewRowIds(undefined)), own.filter(keep));
  assert.deepEqual(chunkFeatures(own, others, keep, previewRowIds('')), own.filter(keep));
});

test('row ids past ROW_M and across a tile edge are kept, once each, own tile first', () => {
  const ids = chunkFeatures(own, others, keep, previewRowIds('2,5')).map(x => x.properties.id);
  assert.deepEqual(ids, ['NL.IMBAG.Pand.1', 'NL.IMBAG.Pand.2', 'NL.IMBAG.Pand.3', 'NL.IMBAG.Pand.5']);
});

test('a hidden (kit) pand stays out even when named in the row', () => {
  const ids = chunkFeatures(own, others, keep, previewRowIds('4'), new Set(['NL.IMBAG.Pand.4'])).map(x => x.properties.id);
  assert.deepEqual(ids, ['NL.IMBAG.Pand.1', 'NL.IMBAG.Pand.3']);
});
