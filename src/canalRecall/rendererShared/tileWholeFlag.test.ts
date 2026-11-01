import assert from 'node:assert/strict';
import test from 'node:test';
import { askedTileWhole, DESKTOP_TILE_WHOLE_SHARE, tileWholeShareFlag } from './sharedFrame';

test('tileWhole: only an explicit value counts; a query string without it keeps the device default', () => {
  assert.equal(askedTileWhole(null), null, 'URLSearchParams.get of a missing key');
  assert.equal(askedTileWhole(undefined), null);
  assert.equal(askedTileWhole(''), null);
  assert.equal(askedTileWhole('0'), 0);
  assert.equal(askedTileWhole('2'), 2);
  assert.equal(askedTileWhole(0.6), 0.6);
  assert.equal(askedTileWhole('3'), null, 'out of range');
  assert.equal(askedTileWhole('x'), null);
  const g = globalThis as any;
  const saved = { location: g.location, matchMedia: g.matchMedia };
  try {
    g.location = { search: '?engine=own' };
    g.matchMedia = (q: string) => ({ matches: q === '(pointer: coarse)' });
    assert.equal(tileWholeShareFlag(), 2, 'touch: tiles on screen only, whatever else the query holds');
    g.matchMedia = () => ({ matches: false });
    assert.equal(tileWholeShareFlag(), DESKTOP_TILE_WHOLE_SHARE);
    g.location = { search: '?engine=own&tileWhole=0' };
    assert.equal(tileWholeShareFlag(), 0, 'an explicit 0 still forces whole');
  } finally { g.location = saved.location; g.matchMedia = saved.matchMedia; }
});
