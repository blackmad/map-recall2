import assert from 'node:assert/strict';
import test from 'node:test';
import { LandmarkHighlight, type HighlightFocusLike, type HighlightTargets } from './landmarkHighlight';

function targets(footprints: Map<string, HighlightFocusLike>, owner: unknown = {}) {
  const log: string[] = [];
  const t: HighlightTargets = {
    owner,
    setHighlighted: (ids) => { log.push(`lit:${ids.join(',')}`); },
    footprint: (ids) => { log.push('scan'); return footprints.get(ids.join(',')) ?? null; },
    marker: (focus) => { log.push(`marker:${focus ? (focus.polygons ? 'footprint' : 'point') : 'none'}`); },
  };
  return { t, log };
}

const AF: [number, number] = [4.8839, 52.3752];

test('the same landmark sent again (relight, a fresh notice object) lights nothing twice', () => {
  const fp = new Map<string, HighlightFocusLike>([['w1', { lngLat: AF, ids: ['w1'], polygons: [[[AF]]] }]]);
  const { t, log } = targets(fp);
  const h = new LandmarkHighlight();
  assert.equal(h.apply(['w1'], AF, t), true);
  for (let i = 0; i < 60; i++) assert.equal(h.apply(['w1'], [AF[0], AF[1]], t), false);
  assert.deepEqual(log, ['lit:w1', 'scan', 'marker:footprint']);
});

test('a footprint that loads after the card is picked up on a later send, without re-lighting', () => {
  const fp = new Map<string, HighlightFocusLike>();
  const { t, log } = targets(fp);
  const h = new LandmarkHighlight();
  h.apply(['w1'], AF, t);
  fp.set('w1', { lngLat: AF, ids: ['w1'], polygons: [[[AF]]] });
  h.apply(['w1'], AF, t);
  h.apply(['w1'], AF, t);
  assert.deepEqual(log, ['lit:w1', 'scan', 'marker:point', 'scan', 'marker:footprint']);
});

test('a different landmark, a cleared card and a new facades instance all send again', () => {
  const { t, log } = targets(new Map());
  const h = new LandmarkHighlight();
  h.apply([], AF, t); // a statue: a point marker, nothing to scan for
  h.apply([], AF, t);
  h.apply(['w2'], [4.88, 52.36], t);
  h.apply([], null, t);
  h.apply([], null, t);
  const fresh = targets(new Map(), {});
  h.apply([], null, fresh.t);
  assert.deepEqual(log, ['lit:', 'marker:point', 'lit:w2', 'scan', 'marker:point', 'lit:', 'marker:none']);
  assert.deepEqual(fresh.log, ['lit:', 'marker:none']);
});
