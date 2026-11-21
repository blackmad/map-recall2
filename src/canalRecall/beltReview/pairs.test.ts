import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupingFromPairs, pairQueue } from './stages.ts';
import type { FaceBundle } from './types.ts';

const bundle = (units: Record<string, string>, split: string[] = []) => ({
  face: { pands: ['a', 'b', 'c', 'd'].map(pandId => ({ pandId, address: pandId })) },
  description: { pands: Object.entries(units).map(([pandId, id]) => ({ pandId, group: { unit: { id } } })) },
  grouping: { units: split.map(p => ({ id: `david-${p}`, pandIds: [p], source: 'david' })), links: [] },
}) as unknown as FaceBundle;

test('pairQueue asks only neighbours the city map groups, minus houses split out by hand', () => {
  assert.deepEqual(pairQueue(bundle({ a: 'u1', b: 'u1', c: 'u1', d: 'u2' })), [['a', 'b'], ['b', 'c']]);
  assert.deepEqual(pairQueue(bundle({ a: 'u1', b: 'u1', c: 'u1' }, ['b'])), []);
});

test('groupingFromPairs: one joins, twin links right to left, the rest stay separate', () => {
  const at = '2026-11-21T00:00:00Z';
  const g = groupingFromPairs(bundle({}), { 'a|b': { answer: 'one', by: 'david', at }, 'b|c': { answer: 'twin', by: 'david', at }, 'c|d': { answer: 'unsure', by: 'david', at } });
  assert.deepEqual(g.units.map(u => u.pandIds), [['a', 'b'], ['c'], ['d']]);
  assert.deepEqual(g.links.map(l => [l.pandId, l.kind, l.target]), [['c', 'sameAs', 'b']]);
});
