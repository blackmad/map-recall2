import assert from 'node:assert/strict';
import test from 'node:test';
import {mottleSpots, type SpotRect} from './mottleSpots';

const hosts: SpotRect[] = [
  {t0: 0, t1: 0.6, y0: 0, y1: 2.4}, // a pier
  {t0: 0, t1: 12, y0: 2.4, y1: 2.9}, // a ledge
  {t0: 2, t1: 2.2, y0: 0, y1: 2.4}, // too narrow for any patch
];
const spec = {hosts, seed: 7, coverage: 0.2, size: [0.18, 0.4] as [number, number]};
const area = (r: SpotRect) => (r.t1 - r.t0) * (r.y1 - r.y0);

test('mottleSpots is deterministic per seed and changes with it', () => {
  assert.deepEqual(mottleSpots(spec), mottleSpots(spec));
  assert.notDeepEqual(mottleSpots(spec), mottleSpots({...spec, seed: 8}));
});

test('every patch rectangle lies inside its host with the margin, and patches never overlap', () => {
  const spots = mottleSpots(spec);
  assert.ok(spots.length > 5);
  const all: {h: number; r: SpotRect}[] = [];
  for (const s of spots) for (const r of s.rects) {
    const h = hosts[s.host];
    assert.ok(r.t0 >= h.t0 + 0.04 - 1e-9 && r.t1 <= h.t1 - 0.04 + 1e-9 && r.y0 >= h.y0 + 0.04 - 1e-9 && r.y1 <= h.y1 - 0.04 + 1e-9, 'inside host');
    assert.ok(r.t1 > r.t0 && r.y1 > r.y0);
    all.push({h: s.host, r});
  }
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i].r, b = all[j].r;
    const ov = Math.min(a.t1, b.t1) - Math.max(a.t0, b.t0), oh = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    assert.ok(!(ov > 1e-9 && oh > 1e-9), 'no overlapping rectangles (lobes only abut)');
  }
});

test('coverage lands near the target and never on a host too small for a patch', () => {
  const spots = mottleSpots(spec);
  assert.equal(spots.filter(s => s.host === 2).length, 0);
  const ledge = spots.filter(s => s.host === 1).flatMap(s => s.rects).reduce((t, r) => t + area(r), 0);
  const share = ledge / area(hosts[1]);
  assert.ok(share > 0.12 && share < 0.3, `ledge coverage ${share.toFixed(2)}`);
  assert.deepEqual(mottleSpots({...spec, coverage: 0}), []);
});

test('mottleSpots refuses bad ranges', () => {
  assert.throws(() => mottleSpots({...spec, coverage: 1}), /coverage/);
  assert.throws(() => mottleSpots({...spec, size: [0.4, 0.2]}), /size/);
});
