import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanTargets, metres } from './targets.ts';

test('murals are dropped; a model within 25 m or with the same name marks a piece modelled', () => {
  const out = scanTargets(
    [
      { id: 'a', name: 'Homomonument', k: 'memorial', lng: 4.884722, lat: 52.374444 },
      { id: 'b', name: 'Some wall', k: 'mural', lng: 4.9, lat: 52.37 },
      { id: 'c', name: 'Het Lieverdje', k: 'statue', lng: 4.8897, lat: 52.3694 },
      { id: 'd', name: 'Multatuli', k: 'statue', lng: 4.8, lat: 52.3 },
    ],
    [
      { id: 'homomonument', name: 'Homomonument', lng: 4.884693, lat: 52.374432 },
      { id: 'multatuli-standbeeld', name: 'Multatuli', lng: 4.88, lat: 52.37 },
    ],
  );
  assert.deepEqual(out.map((t) => [t.id, t.m ?? null]), [['a', 'homomonument'], ['c', null], ['d', 'multatuli-standbeeld']]);
});

test('metres is about right at Amsterdam latitude', () => {
  assert.ok(Math.abs(metres(4.89, 52.37, 4.89, 52.371) - 110.5) < 1);
});
