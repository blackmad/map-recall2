import test from 'node:test';
import assert from 'node:assert/strict';
import {slopedLawnEdge, type LawnEdgeSpec} from './slopedLawnEdge';

// an edge along +x from a raised end (7.5 m) falling to the ground at x = 50; outward is -z (north)
const spec: LawnEdgeSpec = {
  a: [0, 0], b: [50, 0], heightAt: x => Math.max(0.2, 7.5 - 0.15 * x), outSign: 1, fascia: 0.6, proud: 0.25, setback: 0.9, step: 2,
  zones: [{s0: 0, s1: 20, kind: 'glass', mullion: 2.5}, {s0: 20, s1: 50, kind: 'wall', material: 'stone'}],
};

test('outward is the edge direction turned clockwise for outSign 1', () => {
  const r = slopedLawnEdge(spec);
  const front = r.quads.find(q => q.material === 'copper' && q.out[1] === 0)!;
  assert.ok(front.out[2] < -0.99, 'faces -z');
  for (const p of front.pts) assert.ok(Math.abs(p[2] + 0.25) < 1e-9, 'the fascia front stands 0.25 m out');
});

test('fronts follow the slope under the fascia and stop where the edge meets the ground', () => {
  const r = slopedLawnEdge(spec);
  const fronts = r.quads.filter(q => q.material === 'glass' || q.material === 'stone');
  assert.ok(fronts.length > 0);
  for (const q of fronts) {
    for (const p of q.pts) assert.ok(Math.abs(p[2] - 0.9) < 1e-9, 'set back 0.9 m');
    const top = Math.max(...q.pts.map(p => p[1]));
    const x = Math.max(...q.pts.map(p => p[0]));
    assert.ok(top <= 7.5 - 0.15 * (x - 2) - 0.6 + 1e-9, 'under the fascia');
  }
  const last = Math.max(...fronts.flatMap(q => q.pts.map(p => p[0])));
  assert.ok(last > 44 && last < 47, `fronts end where the fascia reaches the ground (x ${last})`);
  assert.ok(fronts.some(q => q.material === 'glass') && fronts.some(q => q.material === 'stone'));
});

test('mullions stand on the glass zone only', () => {
  const r = slopedLawnEdge(spec);
  const ms = r.quads.filter(q => q.material === 'frame');
  assert.equal(ms.length, 7);   // 2.5 .. 17.5
  for (const q of ms) assert.ok(Math.max(...q.pts.map(p => p[0])) < 20);
});

test('outSign -1 flips the outward side', () => {
  const r = slopedLawnEdge({...spec, outSign: -1});
  assert.ok(r.quads.find(q => q.material === 'copper' && q.out[1] === 0)!.out[2] > 0.99);
});
